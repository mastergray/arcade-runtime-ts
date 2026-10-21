// realizes: docs/arcade-runtime-spec.md > §10.6 ArcadeCabinet (browser composition, IndexedDB and production-build acceptance)

// Dependencies:
import { createServer, type Server } from "node:http";             // Serves selected ignored inputs and production build artifacts
import { existsSync, readFileSync } from "node:fs";               // Reads only the documented private preload inputs
import { basename, dirname, resolve } from "node:path";            // Resolves and confines configured local files
import { fileURLToPath } from "node:url";                          // Locates the worktree without recording an absolute path
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Required shared in-memory page server

// Type dependencies:
import type { TestCase, TestFile } from "../run.ts";               // Test manifest shapes

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details retained only by the Node test process.
interface PreloadConfig {
    readonly machine: string;                                     // Private machine name, never emitted in assertions
    readonly bios?: string;                                       // Private BIOS choice, when configured
    readonly files: ReadonlyArray<string>;                        // Resolved ignored archive paths
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

// INTERFACE :: privacy-safe result of the double-backed real-page composition case.
interface DoublesResult {
    readonly restored: number[];
    readonly sourceTypes: { readonly keyboard: boolean; readonly gamepads: boolean };
    readonly defaultKeyboardReachedSession: boolean;
    readonly saved: boolean;
    readonly stored: number[];
    readonly idleAfterExit: boolean;
    readonly sourcesGoneAfterExit: boolean;
    readonly restarted: boolean;
    readonly destroyed: boolean;
    readonly exits: number;
}

// INTERFACE :: privacy-safe result of the real production cabinet run.
interface ProductionResult {
    readonly auditOk: boolean;
    readonly running: boolean;
    readonly validCanvas: boolean;
    readonly sourcesAttached: boolean;
    readonly inputDispatched: boolean;
    readonly saveCompleted: boolean;
    readonly savesCleared: boolean;
    readonly destroyed: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root resolved at run time only
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;                    // Sole route to ignored private inputs
const BUILD_DIRECTORY = resolve(WORKSPACE, "dist", "mame", "neogeo");      // Public family build path, never a private ROM path
const TIMEOUT = 90_000;

const PAGE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>ArcadeCabinet acceptance</title>
  <style>#container { width: 640px; height: 480px; } canvas { display: block; }</style>
</head>
<body>
  <div id="container"><canvas id="canvas" width="0" height="0"></canvas></div>
  <script type="module">
    import ArcadeCabinet from "/src/ArcadeCabinet/ArcadeCabinet.js";
    import ArcadeStorage from "/src/ArcadeStorage/ArcadeStorage.js";
    import FakeArcadeAdapter from "/tests/support/FakeArcadeAdapter.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";

    const canvas = document.querySelector("#canvas");
    const container = document.querySelector("#container");
    const api = window.arcadeCabinetAcceptance = {};

    function waitForCanvas() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const poll = () => {
          if (canvas.width > 0 && canvas.height > 0) { resolve(); return; }
          if (++attempts > 1200) { reject(new Error("cabinet did not draw a frame")); return; }
          requestAnimationFrame(poll);
        };
        poll();
      });
    }

    api.runDoubles = async () => {
      const storage = ArcadeStorage.init({ key: "cabinet-browser-doubles" });
      await storage.clear();
      await storage.save(new Uint8Array([3, 4]));
      const first = new FakeArcadeSession();
      first.script("persist", "resolve", new Uint8Array([7, 8]));
      const adapter = new FakeArcadeAdapter().script("resolve", first);
      const cabinet = await ArcadeCabinet.init({
        canvas,
        container,
        game: {
          machine: "fake",
          machineHints: { players: 2, buttons: 6 },
          roms: [{ name: "synthetic.zip", bytes: new Uint8Array([1, 2, 3]) }]
        },
        controls: { keyboard: {}, gamepads: {} },
        adapter,
        fetch: async () => { throw new Error("unexpected fetch"); },
        storage
      });
      await cabinet.start();
      const restored = Array.from(adapter.startCalls[0].changes ?? []);
      const sourceTypes = { keyboard: cabinet.keyboard !== null, gamepads: cabinet.gamepads !== null };
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
      const defaultKeyboardReachedSession = first.held.includes("p1:direction:up");
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp" }));
      const saved = await cabinet.save();
      const stored = Array.from((await storage.load()) ?? []);
      first.emitExit();
      const idleAfterExit = cabinet.player.status === "idle" && !cabinet.isStarted;
      const sourcesGoneAfterExit = cabinet.keyboard === null && cabinet.gamepads === null;
      const second = new FakeArcadeSession();
      adapter.script("resolve", second);
      await cabinet.start();
      const restarted = cabinet.isStarted && cabinet.keyboard !== null && cabinet.gamepads !== null;
      await cabinet.destroy();
      await cabinet.destroy();
      api.doubles = {
        restored,
        sourceTypes,
        defaultKeyboardReachedSession,
        saved,
        stored,
        idleAfterExit,
        sourcesGoneAfterExit,
        restarted,
        destroyed: cabinet.player.status === "destroyed",
        exits: second.calls.filter((call) => call.method === "exit").length
      };
    };

    api.runProduction = async () => {
      const resource = new URL(location.href).searchParams.get("resource");
      if (!resource) throw new Error("resource URL is unavailable");
      const config = await fetch(resource + "/private.json").then((response) => response.json());
      const storage = ArcadeStorage.init({ key: "cabinet-production-acceptance" });
      await storage.clear();
      const cabinet = await ArcadeCabinet.init({
        canvas,
        container,
        game: {
          machine: config.machine,
          machineHints: { players: 2, buttons: 6 },
          roms: config.roms.map((rom) => resource + rom.url),
          ...(config.bios === undefined ? {} : { bios: config.bios })
        },
        controls: { keyboard: {}, gamepads: {} },
        adapterConfig: { buildUrl: resource + "/build/" },
        storage
      });
      const report = await cabinet.audit();
      await cabinet.start();
      const running = cabinet.isStarted && cabinet.player.status === "running";
      await waitForCanvas();
      let inputDispatched = true;
      try {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit5" }));
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Digit5" }));
      } catch { inputDispatched = false; }
      let saveCompleted = false;
      try { saveCompleted = typeof (await cabinet.save()) === "boolean"; }
      catch { saveCompleted = false; }
      await cabinet.clearSaves();
      const savesCleared = (await storage.load()) === null;
      const sourcesAttached = cabinet.keyboard !== null && cabinet.gamepads !== null;
      const validCanvas = canvas.width > 0 && canvas.height > 0;
      await cabinet.destroy();
      api.production = {
        auditOk: report.status === "ok" && report.problems.length === 0,
        running,
        validCanvas,
        sourcesAttached,
        inputDispatched,
        saveCompleted,
        savesCleared,
        destroyed: cabinet.player.status === "destroyed"
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
// Validates the ignored Neo Geo preload file without logging or returning any private identity to assertions.
const loadConfig = (argument: string): PreloadConfig => {
    const configPath = resolve(argument);
    const directory = dirname(configPath);
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as RawPreloadConfig;
    const roms = Array.isArray(parsed.roms) ? parsed.roms : [];
    const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
    if (parsed.family !== "neogeo"
        || typeof parsed.machine !== "string" || !/^[a-z0-9_]+$/.test(parsed.machine)
        || (parsed.bios !== undefined && typeof parsed.bios !== "string")
        || roms.length === 0
        || [...roms, ...samples].some((path) => typeof path !== "string")) {
        throw new Error("ARCADE_PRELOAD_CONFIG is not a valid Neo Geo preload config");
    }
    const files = [...roms, ...samples].map((path) => resolve(directory, path as string));
    const names = files.map((path) => basename(path).toLowerCase());
    if (new Set(names).size !== names.length) throw new Error("ARCADE_PRELOAD_CONFIG contains duplicate basenames");
    return {
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        files,
    };
};

const preload = CONFIG_ARGUMENT === undefined ? undefined : loadConfig(CONFIG_ARGUMENT);   // Never reads res/ without the documented environment variable

// HELPER :: VOID -> PROMISE(resourceServer)
// Serves exactly the production Neo Geo build and ignored archives selected by the private preload config.
const startResourceServer = async (): Promise<ResourceServer> => {
    if (preload === undefined) throw new Error("preload config is unavailable");
    const requiredArtifacts = ["build.json", "mameneogeo.js", "mameneogeo.wasm"];
    if (requiredArtifacts.some((file) => !existsSync(resolve(BUILD_DIRECTORY, file))) || preload.files.some((file) => !existsSync(file))) {
        throw new Error("the production Neo Geo build or a configured private input is unavailable");
    }
    const inputPaths = preload.files.map((path) => `/input/${encodeURIComponent(basename(path))}`);
    const browserConfig = {
        machine: preload.machine,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        roms: inputPaths.map((url) => ({ url })),
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
        const inputIndex = inputPaths.indexOf(pathname);
        const file = pathname === "/build/build.json"
            ? resolve(BUILD_DIRECTORY, "build.json")
            : pathname === "/build/mameneogeo.js"
                ? resolve(BUILD_DIRECTORY, "mameneogeo.js")
                : pathname === "/build/mameneogeo.wasm"
                    ? resolve(BUILD_DIRECTORY, "mameneogeo.wasm")
                    : pathname === metadataPath
                        ? resolve(BUILD_DIRECTORY, "romsets", `${preload.machine}.json`)
                        : inputIndex < 0 ? undefined : preload.files[inputIndex];
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
// Serves PAGE through the shared test page server.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Adds the private resource server for the gated production case and always releases it.
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
        label: "composes sources and real IndexedDB storage with doubles in a real page, cleans up on exit and restarts",
        run: () => withTestPage((url) => CTGBrowserTest.init("ArcadeCabinet browser doubles")
            .interact("run the double-backed cabinet", async ({ page }) => {
                await page.waitForFunction(() => typeof (window as unknown as { arcadeCabinetAcceptance?: { runDoubles?: unknown } }).arcadeCabinetAcceptance?.runDoubles === "function");
                await page.evaluate(() => (window as unknown as { arcadeCabinetAcceptance: { runDoubles(): Promise<void> } }).arcadeCabinetAcceptance.runDoubles());
            })
            .assertPage("sources, storage, exit cleanup, restart and terminal destroy all pass", (page) => page.evaluate(() =>
                (window as unknown as { arcadeCabinetAcceptance: { doubles: DoublesResult } }).arcadeCabinetAcceptance.doubles,
            ), P.equals<DoublesResult>({
                restored: [3, 4],
                sourceTypes: { keyboard: true, gamepads: true },
                defaultKeyboardReachedSession: true,
                saved: true,
                stored: [7, 8],
                idleAfterExit: true,
                sourcesGoneAfterExit: true,
                restarted: true,
                destroyed: true,
                exits: 1,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    },
];

if (preload !== undefined) cases.push({
    label: "audits and starts the private production Neo Geo build through ArcadeCabinet.init",
    run: () => withProductionPage((url) => CTGBrowserTest.init("ArcadeCabinet production build")
        .interact("audit, start, attach sources, dispatch input, persist and destroy", async ({ page }) => {
            await page.waitForFunction(() => typeof (window as unknown as { arcadeCabinetAcceptance?: { runProduction?: unknown } }).arcadeCabinetAcceptance?.runProduction === "function");
            await page.evaluate(() => (window as unknown as { arcadeCabinetAcceptance: { runProduction(): Promise<void> } }).arcadeCabinetAcceptance.runProduction());
        })
        .assertPage("all privacy-safe cabinet observations pass", (page) => page.evaluate(() =>
            (window as unknown as { arcadeCabinetAcceptance: { production: ProductionResult } }).arcadeCabinetAcceptance.production,
        ), P.equals<ProductionResult>({
            auditOk: true,
            running: true,
            validCanvas: true,
            sourcesAttached: true,
            inputDispatched: true,
            saveCompleted: true,
            savesCleared: true,
            destroyed: true,
        }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "ArcadeCabinet browser and production behavior",
    cases,
};

export default testFile;
