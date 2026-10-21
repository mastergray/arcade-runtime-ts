// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer (browser composition and production-build acceptance)

// Dependencies:
import { createServer, type Server } from "node:http";             // Serves only selected ignored inputs and build artifacts
import { existsSync, readFileSync } from "node:fs";               // Reads the documented private preload inputs
import { basename, dirname, resolve } from "node:path";            // Resolves and confines configured local files
import { fileURLToPath } from "node:url";                          // Locates the worktree without a recorded absolute path
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Required in-memory TypeScript page server

// Type dependencies:
import type { TestCase, TestFile } from "../run.ts";               // Test manifest shapes

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details retained only by this process.
interface PreloadConfig {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
    readonly files: ReadonlyArray<string>;
}

// INTERFACE :: untrusted fields accepted from the ignored preload JSON.
interface RawPreloadConfig {
    readonly family?: unknown;
    readonly machine?: unknown;
    readonly bios?: unknown;
    readonly roms?: unknown;
    readonly samples?: unknown;
}

// INTERFACE :: disposable server for production artifacts and selected private inputs.
interface ResourceServer {
    readonly server: Server;
    readonly url: string;
}

// INTERFACE :: privacy-safe result of the real player run.
interface ProductionResult {
    readonly auditOk: boolean;
    readonly running: boolean;
    readonly validCanvas: boolean;
    readonly inputAccepted: boolean;
    readonly persistCompleted: boolean;
    readonly destroyed: boolean;
}

// INTERFACE :: result of composing the real player classes with W0 doubles in Chromium.
interface DoublesResult {
    readonly statuses: string[];
    readonly canvas: { readonly width: number; readonly height: number; readonly pixel: number[] };
    readonly machineAvailable: boolean;
    readonly inputAvailable: boolean;
    readonly audioAvailable: boolean;
    readonly exits: number;
    readonly idleAfterExit: boolean;
    readonly destroyed: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Resolved at run time only
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;                    // Sole route to ignored private inputs
const TIMEOUT = 90_000;

const PAGE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>ArcadePlayer acceptance</title>
  <style>#container { width: 640px; height: 480px; } canvas { display: block; }</style>
</head>
<body>
  <div id="container"><canvas id="canvas" width="0" height="0"></canvas></div>
  <script type="module">
    import ArcadePlayer from "/src/ArcadePlayer/ArcadePlayer.js";
    import FakeArcadeAdapter from "/tests/support/FakeArcadeAdapter.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";

    const canvas = document.querySelector("#canvas");
    const container = document.querySelector("#container");
    const api = window.arcadePlayerAcceptance = {};

    function frame(width, height) {
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let offset = 0; offset < rgba.length; offset += 4) {
        rgba[offset] = 10;
        rgba[offset + 1] = 20;
        rgba[offset + 2] = 30;
        rgba[offset + 3] = 255;
      }
      return { width, height, rgba };
    }

    function waitForCanvas() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const poll = () => {
          if (canvas.width > 0 && canvas.height > 0) { resolve(); return; }
          if (++attempts > 600) { reject(new Error("player did not draw a frame")); return; }
          requestAnimationFrame(poll);
        };
        poll();
      });
    }

    api.runDoubles = async () => {
      const session = new FakeArcadeSession();
      const adapter = new FakeArcadeAdapter().script("resolve", session);
      const player = await ArcadePlayer.init({
        canvas,
        container,
        game: {
          machine: "fake",
          machineHints: { players: 2, buttons: 6 },
          roms: [{ name: "synthetic.zip", bytes: new Uint8Array([1, 2, 3]) }]
        },
        adapter,
        fetch: async () => { throw new Error("unexpected fetch"); }
      });
      const statuses = [];
      let exits = 0;
      player.on("status", (status) => statuses.push(status));
      player.on("exit", () => { exits++; });
      await player.start();
      const machineAvailable = player.machine.name === "fake";
      const inputAvailable = typeof player.input.press === "function";
      const audioAvailable = typeof player.audio.unlock === "function";
      session.emitFrame(frame(2, 1));
      const pixel = Array.from(canvas.getContext("2d").getImageData(0, 0, 1, 1).data);
      player.input.tap({ kind: "coin", player: 1 }, 1);
      session.emitTick();
      session.emitExit();
      const idleAfterExit = player.status === "idle";
      await player.destroy();
      api.doubles = {
        statuses,
        canvas: { width: canvas.width, height: canvas.height, pixel },
        machineAvailable,
        inputAvailable,
        audioAvailable,
        exits,
        idleAfterExit,
        destroyed: player.status === "destroyed"
      };
    };

    api.runProduction = async () => {
      const resource = new URL(location.href).searchParams.get("resource");
      if (!resource) throw new Error("resource URL is unavailable");
      const config = await fetch(resource + "/private.json").then((response) => response.json());
      const player = await ArcadePlayer.init({
        canvas,
        container,
        game: {
          machine: config.machine,
          machineHints: { players: 2, buttons: 6 },
          roms: config.roms.map((rom) => resource + rom.url),
          ...(config.bios === undefined ? {} : { bios: config.bios })
        },
        adapterConfig: { buildUrl: resource + "/build/" }
      });
      const report = await player.audit();
      await player.start();
      const running = player.status === "running";
      await waitForCanvas();
      let inputAccepted = true;
      try { player.input.tap({ kind: "coin", player: 1 }, 3); }
      catch { inputAccepted = false; }
      const persisted = await player.persist();
      const persistCompleted = persisted === null || persisted instanceof Uint8Array;
      const validCanvas = canvas.width > 0 && canvas.height > 0;
      await player.destroy();
      api.production = {
        auditOk: report.status === "ok" && report.problems.length === 0,
        running,
        validCanvas,
        inputAccepted,
        persistCompleted,
        destroyed: player.status === "destroyed"
      };
    };
  </script>
</body>
</html>`;                                                         // Repository modules are transpiled by TestPageServer

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> preloadConfig
// Validates the ignored config and resolves only paths explicitly named by it.
const loadConfig = (argument: string): PreloadConfig => {
    const configPath = resolve(argument);
    const directory = dirname(configPath);
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as RawPreloadConfig;
    const roms = Array.isArray(parsed.roms) ? parsed.roms : [];
    const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
    if (typeof parsed.family !== "string" || !/^[a-z0-9-]+$/.test(parsed.family)
        || typeof parsed.machine !== "string" || !/^[a-z0-9_]+$/.test(parsed.machine)
        || (parsed.bios !== undefined && typeof parsed.bios !== "string")
        || roms.length === 0
        || [...roms, ...samples].some((path) => typeof path !== "string")) {
        throw new Error("ARCADE_PRELOAD_CONFIG is not a valid arcade preload config");
    }
    const files = [...roms, ...samples].map((path) => resolve(directory, path as string));
    const names = files.map((path) => basename(path).toLowerCase());
    if (new Set(names).size !== names.length) throw new Error("ARCADE_PRELOAD_CONFIG contains duplicate basenames");
    return {
        family: parsed.family,
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        files,
    };
};

const preload = CONFIG_ARGUMENT === undefined ? undefined : loadConfig(CONFIG_ARGUMENT);   // Never read res/ without the documented environment variable

// HELPER :: VOID -> PROMISE(resourceServer)
// Serves the selected build directory, its one machine metadata document and configured files; nothing else under res/ is reachable.
const startResourceServer = async (): Promise<ResourceServer> => {
    if (preload === undefined) throw new Error("preload config is unavailable");
    const buildDirectory = resolve(WORKSPACE, "dist", "mame", preload.family);
    if (!existsSync(resolve(buildDirectory, "build.json")) || preload.files.some((file) => !existsSync(file))) {
        throw new Error("the production family build or a configured private input is unavailable");
    }
    const inputPaths = preload.files.map((path) => `/input/${encodeURIComponent(basename(path))}`);
    const browserConfig = {
        machine: preload.machine,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        roms: preload.files.map((path, index) => ({ name: basename(path), url: inputPaths[index]! })),
    };
    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        const headers = { "access-control-allow-origin": "*", "cache-control": "no-store" };
        if (pathname === "/private.json") {
            response.writeHead(200, { ...headers, "content-type": "application/json" });
            response.end(JSON.stringify(browserConfig));
            return;
        }

        const metadataPath = `/build/romsets/${encodeURIComponent(preload.machine)}.json`;
        let file: string | undefined;
        const inputIndex = inputPaths.indexOf(pathname);
        if (inputIndex >= 0) file = preload.files[inputIndex];
        else if (pathname === metadataPath) file = resolve(buildDirectory, "romsets", `${preload.machine}.json`);
        else {
            const artifactMatch = /^\/build\/([^/]+)$/.exec(pathname);
            if (artifactMatch !== null && basename(artifactMatch[1]!) === artifactMatch[1]) file = resolve(buildDirectory, artifactMatch[1]!);
        }
        if (file === undefined || !existsSync(file)) {
            response.writeHead(404, headers).end();
            return;
        }
        const contentType = pathname.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : pathname.endsWith(".wasm") ? "application/wasm"
                : pathname.endsWith(".json") ? "application/json" : "application/zip";
        response.writeHead(200, { ...headers, "content-type": contentType });
        response.end(readFileSync(file));
    });
    await new Promise<void>((resolveListening, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolveListening();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("resource server did not bind a TCP port");
    return { server, url: `http://127.0.0.1:${address.port}` };
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Serves PAGE through the shared server.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Adds the private resource server for the gated production case and always closes it.
const withProductionPage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const resources = await startResourceServer();
    try {
        return await withTestPage((pageUrl) => run(`${pageUrl}?resource=${encodeURIComponent(resources.url)}`));
    } finally {
        resources.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => resources.server.close(() => resolveClosed()));
    }
};

const cases: TestCase[] = [
    {
        label: "composes real display, audio and input with doubles in a real page, draws a frame and handles natural exit",
        run: () => withTestPage((url) => CTGBrowserTest.init("ArcadePlayer browser doubles")
            .interact("run the double-backed player", async ({ page }) => {
                await page.waitForFunction(() => typeof (window as unknown as { arcadePlayerAcceptance?: { runDoubles?: unknown } }).arcadePlayerAcceptance?.runDoubles === "function");
                await page.evaluate(() => (window as unknown as { arcadePlayerAcceptance: { runDoubles(): Promise<void> } }).arcadePlayerAcceptance.runDoubles());
            })
            .assertPage("the composed classes expose their surfaces and cleanly reach destroyed", (page) => page.evaluate(() =>
                (window as unknown as { arcadePlayerAcceptance: { doubles: DoublesResult } }).arcadePlayerAcceptance.doubles,
            ), P.equals<DoublesResult>({
                statuses: ["starting", "running", "idle", "destroyed"],
                canvas: { width: 2, height: 1, pixel: [10, 20, 30, 255] },
                machineAvailable: true,
                inputAvailable: true,
                audioAvailable: true,
                exits: 1,
                idleAfterExit: true,
                destroyed: true,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    },
];

if (preload !== undefined) cases.push({
    label: "audits and starts the private production family build through ArcadePlayer.init",
    run: () => withProductionPage((url) => CTGBrowserTest.init("ArcadePlayer production build")
        .interact("audit, start, accept input, persist and destroy", async ({ page }) => {
            await page.waitForFunction(() => typeof (window as unknown as { arcadePlayerAcceptance?: { runProduction?: unknown } }).arcadePlayerAcceptance?.runProduction === "function");
            await page.evaluate(() => (window as unknown as { arcadePlayerAcceptance: { runProduction(): Promise<void> } }).arcadePlayerAcceptance.runProduction());
        })
        .assertPage("all privacy-safe player observations pass", (page) => page.evaluate(() =>
            (window as unknown as { arcadePlayerAcceptance: { production: ProductionResult } }).arcadePlayerAcceptance.production,
        ), P.equals<ProductionResult>({
            auditOk: true,
            running: true,
            validCanvas: true,
            inputAccepted: true,
            persistCompleted: true,
            destroyed: true,
        }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "ArcadePlayer browser and production behavior",
    cases,
};

export default testFile;
