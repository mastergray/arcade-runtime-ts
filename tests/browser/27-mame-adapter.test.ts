// realizes: docs/arcade-runtime-spec.md > §5 MameEmulatorAdapter real-build acceptance

// Dependencies:
import { createServer, type Server } from "node:http";             // Serves ignored production artifacts and private inputs
import { existsSync, readFileSync } from "node:fs";               // Reads only files named by the documented preload config
import { basename, dirname, resolve } from "node:path";           // Resolves private config-relative inputs
import { fileURLToPath } from "node:url";                         // Resolves the checked-out production artifact directory
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Required shared page server

// Type dependencies:
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details retained only in this process.
interface PreloadConfig {
    readonly family: "neogeo";
    readonly machine: string;
    readonly bios?: string;
    readonly files: ReadonlyArray<string>;
}

// INTERFACE :: untrusted JSON fields accepted from the ignored preload file.
interface RawPreloadConfig {
    readonly family?: unknown;
    readonly machine?: unknown;
    readonly bios?: unknown;
    readonly roms?: unknown;
    readonly samples?: unknown;
}

// INTERFACE :: disposable artifact/input server handle.
interface ResourceServer {
    readonly server: Server;
    readonly url: string;
}

// INTERFACE :: privacy-safe browser result; it never returns machine or ROM identity.
interface AcceptanceResult {
    readonly infoMatchesConfig: boolean;
    readonly validGeometry: boolean;
    readonly uprightFrames: boolean;
    readonly framesAtLeast300: boolean;
    readonly sampleRate: number;
    readonly soundArrived: boolean;
    readonly coinChangedPicture: boolean;
    readonly stateRoundTrip: boolean;
    readonly bootPersistNull: boolean;
    readonly destroyedAfterExit: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const BUILD_DIRECTORY = resolve(WORKSPACE, "dist", "mame", "neogeo");
const TIMEOUT = 90_000;

const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>MAME adapter acceptance</title></head>
<body>
<script type="module">
  import MameEmulatorAdapter from "/src/MameEmulatorAdapter/MameEmulatorAdapter.js";
  import ArcadeRuntimeError from "/src/ArcadeRuntimeError/ArcadeRuntimeError.js";

  const resource = new URL(location.href).searchParams.get("resource");
  const api = window.mameAdapterAcceptance = {};

  function loadClassicModule(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        const createMame = window.createMame;
        if (typeof createMame !== "function") { reject(new Error("createMame was not installed")); return; }
        resolve((options) => new Promise((resolveModule, rejectModule) => {
          let instance;
          const supplied = {
            ...options,
            onRuntimeInitialized() {
              if (instance && Object.prototype.hasOwnProperty.call(instance, "then")) delete instance.then;
              resolveModule(instance);
            },
            onAbort(reason) { rejectModule(new Error(String(reason))); }
          };
          instance = createMame(supplied);
        }));
      };
      script.onerror = () => reject(new Error("module script failed to load"));
      document.head.appendChild(script);
    });
  }

  function nextFrame(session) {
    return new Promise((resolve) => {
      const unsubscribe = session.onFrame((frame) => {
        unsubscribe();
        resolve({ width: frame.width, height: frame.height, rgba: frame.rgba.slice() });
      });
    });
  }

  function waitFrames(session, count) {
    return new Promise((resolve) => {
      let seen = 0;
      const unsubscribe = session.onFrame(() => {
        if (++seen >= count) { unsubscribe(); resolve(); }
      });
    });
  }

  function equalBytes(left, right) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false;
    return true;
  }

  api.run = async () => {
    if (!resource) throw new Error("resource URL is unavailable");
    const privateConfig = await fetch(resource + "/private.json").then((response) => response.json());
    const roms = await Promise.all(privateConfig.roms.map(async (rom) => ({
      name: rom.name,
      bytes: new Uint8Array(await fetch(resource + rom.url).then((response) => response.arrayBuffer()))
    })));
    const adapter = await MameEmulatorAdapter.init({
      buildUrl: resource + "/build/",
      loadModule: loadClassicModule
    });
    const session = await adapter.start({
      machine: privateConfig.machine,
      machineHints: { players: 2, buttons: 6 },
      roms,
      ...(privateConfig.bios === undefined ? {} : { bios: privateConfig.bios })
    });

    const result = {
      infoMatchesConfig: session.machine.name === privateConfig.machine,
      validGeometry: session.machine.width > 0 && session.machine.height > 0,
      uprightFrames: true,
      frames: 0,
      sampleRate: session.sampleRate,
      soundArrived: false,
      coinChangedPicture: false,
      stateRoundTrip: false,
      bootPersistNull: (await session.persist()) === null,
      destroyedAfterExit: false
    };

    let soundFrames = 0;
    const stopFrameCount = session.onFrame((frame) => {
      result.frames++;
      if (frame.width !== session.machine.width || frame.height !== session.machine.height) result.uprightFrames = false;
    });
    const stopSound = session.onSound((sound) => { soundFrames += sound.frames; });
    await waitFrames(session, 300);
    result.framesAtLeast300 = result.frames >= 300;
    result.soundArrived = soundFrames > 0;

    const beforeCoin = await nextFrame(session);
    session.setControl({ kind: "coin", player: 1 }, true);
    await waitFrames(session, 4);
    session.setControl({ kind: "coin", player: 1 }, false);
    await waitFrames(session, 30);
    const afterCoin = await nextFrame(session);
    result.coinChangedPicture = !equalBytes(beforeCoin.rgba, afterCoin.rgba);

    const afterSave = [];
    const stopSaveFrames = session.onFrame((frame) => { if (afterSave.length < 2) afterSave.push(frame.rgba.slice()); });
    await session.saveState("adapter-roundtrip");
    while (afterSave.length < 2) await waitFrames(session, 1);
    stopSaveFrames();
    await waitFrames(session, 20);
    const afterLoad = [];
    const stopLoadFrames = session.onFrame((frame) => { if (afterLoad.length === 0) afterLoad.push(frame.rgba.slice()); });
    await session.loadState("adapter-roundtrip");
    while (afterLoad.length === 0) await waitFrames(session, 1);
    stopLoadFrames();
    // Save and load both resolved through onStateDone and emulation continued at the same geometry afterwards.
    // Byte-identical video after a restore is M6/F8 state-fidelity work (screen bitmaps are not MAME state), not an M1 gate.
    result.stateRoundTrip = afterSave.length === 2 && afterLoad.length === 1 && afterLoad[0].length === afterSave[1].length;

    stopFrameCount();
    stopSound();
    await session.exit();
    try { session.pause(); }
    catch (error) { result.destroyedAfterExit = ArcadeRuntimeError.is(error) && error.code === ArcadeRuntimeError.CODE.DESTROYED; }
    delete result.frames;
    api.result = result;
  };
</script>
</body>
</html>`;                                                         // Source modules come from TestPageServer; private bytes come from the resource server

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> preloadConfig
// Validates the ignored preload file without logging or returning any identity to assertions.
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
    return {
        family: parsed.family,
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        files: [...roms, ...samples].map((path) => resolve(directory, path as string)),
    };
};

// A config for another family skips this file rather than failing it; the skip reason names what it needs.
const preload = ((): PreloadConfig | undefined => {
    if (CONFIG_ARGUMENT === undefined) return undefined;
    try { return loadConfig(CONFIG_ARGUMENT); } catch { return undefined; }
})();

// HELPER :: VOID -> PROMISE(resourceServer)
// Serves exactly the production build and ignored files selected by the private preload config.
const startResourceServer = async (): Promise<ResourceServer> => {
    if (preload === undefined) throw new Error("preload config is unavailable");
    const requiredArtifacts = ["build.json", "mameneogeo.js", "mameneogeo.wasm"];
    if (requiredArtifacts.some((file) => !existsSync(resolve(BUILD_DIRECTORY, file))) || preload.files.some((file) => !existsSync(file))) {
        throw new Error("the production family build or a configured private input is unavailable");
    }
    const names = preload.files.map((path) => basename(path));
    const browserConfig = {
        machine: preload.machine,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        roms: names.map((name, index) => ({ name, url: `/input/${index}` })),
    };
    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        const headers = { "access-control-allow-origin": "*", "cache-control": "no-store" };
        if (pathname === "/private.json") {
            response.writeHead(200, { ...headers, "content-type": "application/json" });
            response.end(JSON.stringify(browserConfig));
            return;
        }
        const inputMatch = /^\/input\/(\d+)$/.exec(pathname);
        const metadataPath = `/build/romsets/${encodeURIComponent(preload.machine)}.json`;
        const file = pathname === "/build/build.json"
            ? resolve(BUILD_DIRECTORY, "build.json")
            : pathname === "/build/mameneogeo.js"
                ? resolve(BUILD_DIRECTORY, "mameneogeo.js")
                : pathname === "/build/mameneogeo.wasm"
                    ? resolve(BUILD_DIRECTORY, "mameneogeo.wasm")
                    : pathname === metadataPath
                        ? resolve(BUILD_DIRECTORY, "romsets", `${preload.machine}.json`)
                        : inputMatch === null ? undefined : preload.files[Number(inputMatch[1])];
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
// Serves the page through TestPageServer and releases the separate private resource server afterward.
const withProductionPage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const resources = await startResourceServer();
    try {
        return await withSharedTestPage(PAGE, (pageUrl) => run(`${pageUrl}?resource=${encodeURIComponent(resources.url)}`));
    } finally {
        resources.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => resources.server.close(() => resolveClosed()));
    }
};

const testFile: TestFile = {
    label: "MameEmulatorAdapter production build",
    skip: preload === undefined ? "set ARCADE_PRELOAD_CONFIG to an ignored Neo Geo preload config (another family's config skips this file)" : undefined,
    cases: [
        {
            label: "starts, renders, sounds, accepts coin, round-trips state, persists cleanly and exits terminally",
            run: () => withProductionPage((url) => CTGBrowserTest.init("production MAME adapter")
                .interact("run all adapter acceptance checks", async ({ page }) => {
                    await page.waitForFunction(() => typeof (window as unknown as { mameAdapterAcceptance?: { run?: unknown } }).mameAdapterAcceptance?.run === "function");
                    await page.evaluate(() => (window as unknown as { mameAdapterAcceptance: { run(): Promise<void> } }).mameAdapterAcceptance.run());
                })
                .assertPage("all privacy-safe acceptance observations pass", (page) => page.evaluate(() =>
                    (window as unknown as { mameAdapterAcceptance: { result: AcceptanceResult } }).mameAdapterAcceptance.result,
                ), P.equals<AcceptanceResult>({
                    infoMatchesConfig: true,
                    validGeometry: true,
                    uprightFrames: true,
                    framesAtLeast300: true,
                    sampleRate: 48_000,
                    soundArrived: true,
                    coinChangedPicture: true,
                    stateRoundTrip: true,
                    bootPersistNull: true,
                    destroyedAfterExit: true,
                }))
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
