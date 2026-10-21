// realizes: docs/arcade-runtime-spec.md > §13.1 F8 memory-card persistence and state fidelity

// Dependencies:
import { createServer, type Server } from "node:http";             // Serves ignored production artifacts and private inputs
import { existsSync, readFileSync } from "node:fs";               // Reads only paths selected by the documented preload config
import { basename, dirname, resolve } from "node:path";           // Resolves private config-relative inputs
import { fileURLToPath } from "node:url";                         // Resolves the ignored production artifact directory
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { withTestPage } from "../support/TestPageServer.ts";      // Shared source-module page server

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

// INTERFACE :: privacy-safe persistence and state observations returned by the page.
interface SavesBridgeResult {
    readonly mountedArgument: boolean;
    readonly restoredInputCard: boolean;
    readonly bootPersistNull: boolean;
    readonly flushRestoredMountedBytes: boolean;
    readonly flushPersistNull: boolean;
    readonly overlayContainsCard: boolean;
    readonly overlayContainsNvram: boolean;
    readonly restartRestoredCard: boolean;
    readonly restartFlushRestoredBytes: boolean;
    readonly restartPersistNull: boolean;
    readonly stateFirstFrameEqual: boolean;
    readonly stateSavedFrames: number;
    readonly stateLoadedFrames: number;
    readonly stateAnySequenceMatch: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const BUILD_DIRECTORY = resolve(WORKSPACE, "dist", "mame", "neogeo");
const TIMEOUT = 120_000;

const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Saves bridge browser test</title></head>
<body>
<script type="module">
  import MameEmulatorAdapter from "/src/MameEmulatorAdapter/MameEmulatorAdapter.js";
  import OverlayCodec from "/src/MameEmulatorAdapter/OverlayCodec.js";

  const resource = new URL(location.href).searchParams.get("resource");
  const api = window.savesBridgeAcceptance = {};
  const instances = [];
  let factoryPromise;

  function loadClassicModule(url) {
    if (factoryPromise) return factoryPromise;
    factoryPromise = new Promise((resolveFactory, rejectFactory) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        const createMame = window.createMame;
        if (typeof createMame !== "function") { rejectFactory(new Error("createMame was not installed")); return; }
        resolveFactory((options) => new Promise((resolveModule, rejectModule) => {
          let instance;
          const record = { module: null, argv: null };
          const supplied = {
            ...options,
            onRuntimeInitialized() {
              if (instance && Object.prototype.hasOwnProperty.call(instance, "then")) delete instance.then;
              const callMain = instance.callMain.bind(instance);
              instance.callMain = (argv) => { record.argv = Array.from(argv); return callMain(argv); };
              record.module = instance;
              instances.push(record);
              resolveModule(instance);
            },
            onAbort(reason) { rejectModule(new Error(String(reason))); }
          };
          instance = createMame(supplied);
        }));
      };
      script.onerror = () => rejectFactory(new Error("module script failed to load"));
      document.head.appendChild(script);
    });
    return factoryPromise;
  }

  function equalBytes(left, right) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false;
    return true;
  }

  function collectFrames(session, count, action) {
    return new Promise((resolveFrames, rejectFrames) => {
      const frames = [];
      const unsubscribe = session.onFrame((frame) => {
        frames.push(frame.rgba.slice());
        if (frames.length === count) { unsubscribe(); resolveFrames(frames); }
      });
      Promise.resolve().then(action).catch((error) => { unsubscribe(); rejectFrames(error); });
    });
  }

  function startConfig(privateConfig, roms, changes) {
    return {
      machine: privateConfig.machine,
      machineHints: { players: 2, buttons: 6 },
      roms,
      ...(privateConfig.bios === undefined ? {} : { bios: privateConfig.bios }),
      ...(changes === undefined ? {} : { changes })
    };
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

    const cardLogical = "memcard/" + privateConfig.machine + ".bin";
    const cardPhysical = "/mame/" + cardLogical;
    const pattern = Uint8Array.from({ length: 0x800 }, (_, index) => (index * 29 + 17) & 0xff);
    const header = {
      format: "arcade-runtime-overlay",
      version: 1,
      adapter: "mame",
      engine: adapter.build.engine,
      buildId: adapter.build.buildId,
      machine: privateConfig.machine
    };
    const seededOverlay = OverlayCodec.encode({ [cardLogical]: pattern }, header);
    const first = await adapter.start(startConfig(privateConfig, roms, seededOverlay));
    const firstRecord = instances[0];
    const firstModule = firstRecord.module;
    const mounted = firstModule.FS.readFile(cardPhysical, { encoding: "binary" }).slice();
    const bootPersist = await first.persist();

    firstModule.FS.writeFile(cardPhysical, new Uint8Array(0x800));
    const flushPersist = await first.persist();
    const afterFlush = firstModule.FS.readFile(cardPhysical, { encoding: "binary" }).slice();

    const savedFrames = await collectFrames(first, 3, () => first.saveState("fidelity"));
    const loadedFrames = await collectFrames(first, 3, () => first.loadState("fidelity"));
    const stateAnySequenceMatch = loadedFrames.some((loaded) => savedFrames.some((saved) => equalBytes(loaded, saved)));

    const overlay = await first.persist();
    if (overlay === null) throw new Error("state save did not dirty the persistence tree");
    const tree = OverlayCodec.decode(overlay, header);
    const overlayCard = tree[cardLogical];
    await first.exit();

    const second = await adapter.start(startConfig(privateConfig, roms, overlay));
    const secondRecord = instances[1];
    const secondModule = secondRecord.module;
    const restarted = secondModule.FS.readFile(cardPhysical, { encoding: "binary" }).slice();
    secondModule.FS.writeFile(cardPhysical, new Uint8Array(0x800));
    const restartPersist = await second.persist();
    const restartAfterFlush = secondModule.FS.readFile(cardPhysical, { encoding: "binary" }).slice();
    await second.exit();

    api.result = {
      mountedArgument: firstRecord.argv.some((value, index) => value === "-memcard" && firstRecord.argv[index + 1] === cardPhysical),
      restoredInputCard: equalBytes(mounted, pattern),
      bootPersistNull: bootPersist === null,
      flushRestoredMountedBytes: equalBytes(afterFlush, mounted),
      flushPersistNull: flushPersist === null,
      overlayContainsCard: overlayCard instanceof Uint8Array && overlayCard.length === 0x800,
      overlayContainsNvram: Object.keys(tree).some((path) => path.startsWith("nvram/")),
      restartRestoredCard: overlayCard instanceof Uint8Array && equalBytes(restarted, overlayCard),
      restartFlushRestoredBytes: overlayCard instanceof Uint8Array && equalBytes(restartAfterFlush, overlayCard),
      restartPersistNull: restartPersist === null,
      stateFirstFrameEqual: equalBytes(savedFrames[0], loadedFrames[0]),
      stateSavedFrames: savedFrames.length,
      stateLoadedFrames: loadedFrames.length,
      stateAnySequenceMatch
    };
  };
</script>
</body>
</html>`;                                                         // Page has no private identifiers; the resource server supplies them at runtime

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> preloadConfig
// Validates the ignored preload file without logging or returning its machine and archive identities.
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
// Serves exactly the rebuilt family artifacts and ignored files selected by the private preload config.
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
// Serves the repository page through TestPageServer and releases the private resource server afterward.
const withProductionPage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const resources = await startResourceServer();
    try {
        return await withTestPage(PAGE, (pageUrl) => run(`${pageUrl}?resource=${encodeURIComponent(resources.url)}`));
    } finally {
        resources.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => resources.server.close(() => resolveClosed()));
    }
};

const testFile: TestFile = {
    label: "MAME saves bridge",
    skip: preload === undefined ? "set ARCADE_PRELOAD_CONFIG to an ignored Neo Geo preload config (another family's config skips this file)" : undefined,
    cases: [
        {
            label: "flushes, overlays and restores a mounted memory card while reporting state-frame fidelity",
            run: () => withProductionPage((url) => CTGBrowserTest.init("production saves bridge")
                .interact("exercise card persistence and scheduled state restore", async ({ page }) => {
                    await page.waitForFunction(() => typeof (window as unknown as { savesBridgeAcceptance?: { run?: unknown } }).savesBridgeAcceptance?.run === "function");
                    await page.evaluate(() => (window as unknown as { savesBridgeAcceptance: { run(): Promise<void> } }).savesBridgeAcceptance.run());
                })
                .assertPage("privacy-safe saves observations", (page) => page.evaluate(() =>
                    (window as unknown as { savesBridgeAcceptance: { result: SavesBridgeResult } }).savesBridgeAcceptance.result,
                ), P.equals<SavesBridgeResult>({
                    mountedArgument: true,
                    restoredInputCard: true,
                    bootPersistNull: true,
                    flushRestoredMountedBytes: true,
                    flushPersistNull: true,
                    overlayContainsCard: true,
                    overlayContainsNvram: true,
                    restartRestoredCard: true,
                    restartFlushRestoredBytes: true,
                    restartPersistNull: true,
                    stateFirstFrameEqual: false,
                    stateSavedFrames: 3,
                    stateLoadedFrames: 3,
                    stateAnySequenceMatch: false,
                }))
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
