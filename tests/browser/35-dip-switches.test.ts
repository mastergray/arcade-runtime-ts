// realizes: docs/arcade-runtime-spec.md > §12 M8 BIOS and DIP switches

// Dependencies:
import { createServer, type Server } from "node:http";             // Serves ignored production artifacts and private inputs
import { existsSync, readFileSync } from "node:fs";               // Reads only the documented preload config and generated metadata
import { basename, dirname, resolve } from "node:path";           // Resolves private config-relative inputs
import { fileURLToPath } from "node:url";                         // Resolves the checked-out production artifact directory
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Required shared page server

// Type dependencies:
import type { RomSetMetadata } from "../../src/RomSetAudit/types.ts";   // Generated DIP metadata shape
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details retained only in this process.
interface PreloadConfig {
    readonly family: "namco-classic";
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

// INTERFACE :: the two private DIP maps sent only to the local browser page.
interface DipSelections {
    readonly baseline: Readonly<Record<string, string>>;
    readonly changed: Readonly<Record<string, string>>;
}

// INTERFACE :: disposable artifact/input server handle.
interface ResourceServer {
    readonly server: Server;
    readonly url: string;
}

// INTERFACE :: privacy-safe visual observations returned by the page.
interface DipAcceptanceResult {
    readonly sameGeometry: boolean;
    readonly stableBaseline: boolean;
    readonly changedActiveRegion: boolean;
    readonly comparedCheckpoints: number;
    readonly region: "upright active-screen interior (5%-95% on both axes)";
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const BUILD_DIRECTORY = resolve(WORKSPACE, "dist", "mame", "namco-classic");
const TIMEOUT = 120_000;

const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>DIP-switch browser acceptance</title></head>
<body>
<script type="module">
  import MameEmulatorAdapter from "/src/MameEmulatorAdapter/MameEmulatorAdapter.js";

  const resource = new URL(location.href).searchParams.get("resource");
  const api = window.dipSwitchAcceptance = {};
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
      script.onerror = () => rejectFactory(new Error("module script failed to load"));
      document.head.appendChild(script);
    });
    return factoryPromise;
  }

  function fastPacing() {
    let now = 0;
    let nextHandle = 1;
    const pending = new Map();
    return {
      clock: () => now,
      scheduler: {
        request(callback) {
          const handle = nextHandle++;
          const timer = setTimeout(() => {
            pending.delete(handle);
            now += 1000 / 60;
            callback(now);
          }, 0);
          pending.set(handle, timer);
          return handle;
        },
        cancel(handle) {
          const timer = pending.get(handle);
          if (timer !== undefined) clearTimeout(timer);
          pending.delete(handle);
        }
      }
    };
  }

  // The comparison region excludes the outer 5% border on every side and retains the upright active-screen
  // interior where the service screen renders its DIP table. Four equally spaced emulated-frame checkpoints
  // distinguish a selected difficulty/lives value from ordinary transient redraws.
  function activeRegion(frame) {
    const left = Math.floor(frame.width * 0.05);
    const right = Math.ceil(frame.width * 0.95);
    const top = Math.floor(frame.height * 0.05);
    const bottom = Math.ceil(frame.height * 0.95);
    const bytes = new Uint8Array((right - left) * (bottom - top) * 4);
    let target = 0;
    for (let y = top; y < bottom; y++) {
      const start = (y * frame.width + left) * 4;
      const end = (y * frame.width + right) * 4;
      bytes.set(frame.rgba.subarray(start, end), target);
      target += end - start;
    }
    return bytes;
  }

  function equalBytes(left, right) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false;
    return true;
  }

  async function capture(adapter, privateConfig, roms, dipswitches) {
    const session = await adapter.start({
      machine: privateConfig.machine,
      machineHints: { players: 2, buttons: 6 },
      roms,
      ...(privateConfig.bios === undefined ? {} : { bios: privateConfig.bios }),
      dipswitches
    });
    const checkpoints = new Set([60, 120, 180, 240]);
    const frames = [];
    let seen = 0;
    await new Promise((resolveFrames) => {
      const unsubscribe = session.onFrame((frame) => {
        seen++;
        if (checkpoints.has(seen)) frames.push({ width: frame.width, height: frame.height, bytes: activeRegion(frame) });
        if (seen === 240) { unsubscribe(); resolveFrames(); }
      });
    });
    await session.exit();
    return frames;
  }

  api.run = async () => {
    if (!resource) throw new Error("resource URL is unavailable");
    const privateConfig = await fetch(resource + "/private.json").then((response) => response.json());
    const roms = await Promise.all(privateConfig.roms.map(async (rom) => ({
      name: rom.name,
      bytes: new Uint8Array(await fetch(resource + rom.url).then((response) => response.arrayBuffer()))
    })));
    const pacing = fastPacing();
    const adapter = await MameEmulatorAdapter.init({
      buildUrl: resource + "/build/",
      loadModule: loadClassicModule,
      scheduler: pacing.scheduler,
      clock: pacing.clock
    });

    const baselineA = await capture(adapter, privateConfig, roms, privateConfig.selections.baseline);
    const baselineB = await capture(adapter, privateConfig, roms, privateConfig.selections.baseline);
    const changed = await capture(adapter, privateConfig, roms, privateConfig.selections.changed);
    const sameGeometry = baselineA.length === changed.length && baselineA.every((frame, index) =>
      frame.width === changed[index].width && frame.height === changed[index].height);
    const stable = baselineA.map((frame, index) => equalBytes(frame.bytes, baselineB[index].bytes));
    api.result = {
      sameGeometry,
      stableBaseline: stable.every(Boolean),
      changedActiveRegion: stable.some((isStable, index) => isStable && !equalBytes(baselineA[index].bytes, changed[index].bytes)),
      comparedCheckpoints: baselineA.length,
      region: "upright active-screen interior (5%-95% on both axes)"
    };
  };
</script>
</body>
</html>`;                                                         // Private identities stay behind the resource server

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> preloadConfig?
// Accepts only the Namco-classic preload; another family's documented config skips this gated file.
const loadConfig = (argument: string): PreloadConfig | undefined => {
    const configPath = resolve(argument);
    const directory = dirname(configPath);
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as RawPreloadConfig;
    if (parsed.family !== "namco-classic") return undefined;
    const roms = Array.isArray(parsed.roms) ? parsed.roms : [];
    const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
    if (typeof parsed.machine !== "string" || !/^[a-z0-9_]+$/.test(parsed.machine)
        || (parsed.bios !== undefined && typeof parsed.bios !== "string")
        || roms.length === 0
        || [...roms, ...samples].some((path) => typeof path !== "string")) {
        throw new Error("ARCADE_PRELOAD_CONFIG is not a valid Namco-classic preload config");
    }
    return {
        family: parsed.family,
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        files: [...roms, ...samples].map((path) => resolve(directory, path as string)),
    };
};

const preload = CONFIG_ARGUMENT === undefined ? undefined : loadConfig(CONFIG_ARGUMENT);

// HELPER :: preloadConfig -> dipSelections
// Selects a documented visible field and enables the service screen for a stable, same-frame pixel comparison.
const selectionsFor = (config: PreloadConfig): DipSelections => {
    const path = resolve(BUILD_DIRECTORY, "romsets", `${config.machine}.json`);
    const metadata = JSON.parse(readFileSync(path, "utf8")) as RomSetMetadata;
    const dipswitches = metadata.dipswitches ?? [];
    const effect = dipswitches.find((dipswitch) => dipswitch.name.toLowerCase() === "difficulty")
        ?? dipswitches.find((dipswitch) => dipswitch.name.toLowerCase() === "lives");
    const service = dipswitches.find((dipswitch) => dipswitch.name.toLowerCase() === "service mode");
    const defaultSetting = effect?.values.find((setting) => setting.default);
    const changedSetting = effect?.values.find((setting) => !setting.default);
    const serviceOn = service?.values.find((setting) => setting.name.toLowerCase() === "on" && !setting.default)
        ?? service?.values.find((setting) => !setting.default);
    if (effect === undefined || service === undefined || defaultSetting === undefined || changedSetting === undefined || serviceOn === undefined) {
        throw new Error("the private Namco-classic title lacks the documented visible DIP fields");
    }
    return {
        baseline: { [service.name]: serviceOn.name, [effect.name]: defaultSetting.name },
        changed: { [service.name]: serviceOn.name, [effect.name]: changedSetting.name },
    };
};

// HELPER :: VOID -> PROMISE(resourceServer)
// Serves exactly the production build, selected metadata and ignored files named by the private config.
const startResourceServer = async (): Promise<ResourceServer> => {
    if (preload === undefined) throw new Error("preload config is unavailable");
    const requiredArtifacts = ["build.json", "mamenamco-classic.js", "mamenamco-classic.wasm"];
    if (requiredArtifacts.some((file) => !existsSync(resolve(BUILD_DIRECTORY, file))) || preload.files.some((file) => !existsSync(file))) {
        throw new Error("the production family build or a configured private input is unavailable");
    }
    const names = preload.files.map((path) => basename(path));
    const browserConfig = {
        machine: preload.machine,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        roms: names.map((name, index) => ({ name, url: `/input/${index}` })),
        selections: selectionsFor(preload),
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
            : pathname === "/build/mamenamco-classic.js"
                ? resolve(BUILD_DIRECTORY, "mamenamco-classic.js")
                : pathname === "/build/mamenamco-classic.wasm"
                    ? resolve(BUILD_DIRECTORY, "mamenamco-classic.wasm")
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
// Serves the source page through TestPageServer and releases the private resource server afterward.
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
    label: "Namco-classic DIP switches",
    skip: preload === undefined ? "set ARCADE_PRELOAD_CONFIG to the ignored Namco-classic DIP preload config" : undefined,
    cases: [
        {
            label: "a changed lives or difficulty DIP produces a stable pixel difference on the service screen",
            run: () => withProductionPage((url) => CTGBrowserTest.init("production DIP cfg")
                .interact("capture default, repeat-default and changed DIP sessions", async ({ page }) => {
                    await page.waitForFunction(() => typeof (window as unknown as { dipSwitchAcceptance?: { run?: unknown } }).dipSwitchAcceptance?.run === "function");
                    await page.evaluate(() => (window as unknown as { dipSwitchAcceptance: { run(): Promise<void> } }).dipSwitchAcceptance.run());
                })
                .assertPage("the documented upright active-screen region changes only for the selected DIP", (page) => page.evaluate(() =>
                    (window as unknown as { dipSwitchAcceptance: { result: DipAcceptanceResult } }).dipSwitchAcceptance.result,
                ), P.equals<DipAcceptanceResult>({
                    sameGeometry: true,
                    stableBaseline: true,
                    changedActiveRegion: true,
                    comparedCheckpoints: 4,
                    region: "upright active-screen interior (5%-95% on both axes)",
                }))
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
