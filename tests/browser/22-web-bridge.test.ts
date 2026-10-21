// realizes: docs/arcade-runtime-spec.md > §4.3.1 real production bridge contract

// Dependencies:
import { createServer, type Server } from "node:http";            // Serves the generated module and configured local ROMs
import { existsSync, readFileSync } from "node:fs";              // Reads ignored artifacts and preload configuration
import { dirname, extname, resolve } from "node:path";           // Resolves config-relative files without exposing their paths
import { fileURLToPath } from "node:url";                        // Resolves the ignored default artifact directory
import CTGBrowserTest from "ctg-js-browser-test";                 // Chromium pipeline

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details used only by the local server
interface PreloadConfig {
    readonly family: "neogeo" | "cps1";
    readonly machine: string;
    readonly bios?: string;
    readonly roms: readonly string[];
}

// INTERFACE :: server handle and URL for one production-module case
interface BridgePageServer {
    readonly server: Server;
    readonly url: string;
}

interface MainBridgeResult {
    readonly audio960: boolean;
    readonly callMainReturned: boolean;
    readonly exitCount: number;
    readonly frameMatchesInfo: boolean;
    readonly geometryMatchesFamily: boolean;
    readonly inputFrameAdvanced: boolean;
    readonly infoIsValid: boolean;
    readonly loadOk: boolean;
    readonly nonBlack: boolean;
    readonly nvramBytes: number;
    readonly nvramFiles: number;
    readonly nvramFlushOk: boolean;
    readonly pauseReturnedZero: boolean;
    readonly postLoadFrameAdvanced: boolean;
    readonly refreshMatchesFamily: boolean;
    readonly saveOk: boolean;
    readonly stateBytes: number;
    readonly ticks: number;
}

interface MissingBiosResult {
    readonly callMainReturned: boolean;
    readonly errorBeforeFrontendDone: boolean;
    readonly frontendResult: number;
    readonly logCount: number;
    readonly runningRetained: boolean;
    readonly ticks: number;
}

interface BridgeBrowserApi {
    error?: string;
    main?: MainBridgeResult;
    missing?: MissingBiosResult;
    runMain: () => Promise<void>;
    runMissingBios: () => Promise<void>;
}

interface RawPreloadConfig {
    readonly family?: unknown;
    readonly machine?: unknown;
    readonly bios?: unknown;
    readonly roms?: unknown;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const DEFAULT_ARTIFACT = resolve(WORKSPACE, "dist", "mame", "neogeo", "mameneogeo.js");   // The build-mame output for the M1 family
const ARTIFACT = resolve(process.env.ARCADE_WEB_BRIDGE_ARTIFACT ?? DEFAULT_ARTIFACT);
const WASM_ARTIFACT = `${ARTIFACT.slice(0, -extname(ARTIFACT).length)}.wasm`;
const TIMEOUT = 90_000;

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Web bridge contract</title>
<script src="/mame.js"></script>
<script>
(function () {
  'use strict';
  var api = window.bridgeTest = {};

  function runtime(config, omitBios) {
    return new Promise(function (resolveRuntime, rejectRuntime) {
      var module;
      var ticks = 0;
      var frames = 0;
      var lastFrame = null;
      var nonBlack = false;
      var soundFrames = [];
      var stateDone = [];
      var exitCount = 0;
      var frontendResult = null;
      var frontendLogCount = 0;
      var logs = [];
      var options = {
        noInitialRun: true,
        locateFile: function (name) { return name.endsWith('.wasm') ? '/mame.wasm' : name; },
        print: function () {},
        printErr: function () {},
        web: {
          onTick: function () { ticks++; },
          onFrame: function (pointer, width, height) {
            frames++;
            var bytes = module.HEAPU8.subarray(pointer, pointer + width * height * 4);
            var visible = 0;
            for (var offset = 0; offset < bytes.length; offset += 4) {
              if ((bytes[offset] | bytes[offset + 1] | bytes[offset + 2]) !== 0) visible++;
            }
            if (visible > 0) nonBlack = true;
            lastFrame = { width: width, height: height, visible: visible };
          },
          onSound: function (pointer, count) {
            var samples = module.HEAPF32.subarray(pointer >>> 2, (pointer >>> 2) + count * 2);
            soundFrames.push({ count: count, length: samples.length });
          },
          onStateDone: function (ok) { stateDone.push(ok); },
          onExit: function () { exitCount++; },
          onFrontendDone: function (result) {
            frontendResult = result;
            frontendLogCount = logs.length;
          },
          onLog: function (level, pointer) {
            logs.push({ level: level, text: module.UTF8ToString(pointer) });
          }
        },
        onRuntimeInitialized: function () { resolveRuntime(context()); },
        onAbort: function (reason) { rejectRuntime(new Error(String(reason))); }
      };
      module = createMame(options);

      function context() {
        return {
          module: module,
          values: function () {
            return {
              ticks: ticks,
              frames: frames,
              lastFrame: lastFrame,
              nonBlack: nonBlack,
              soundFrames: soundFrames,
              stateDone: stateDone,
              exitCount: exitCount,
              frontendResult: frontendResult,
              frontendLogCount: frontendLogCount,
              logs: logs
            };
          }
        };
      }
    });
  }

  function mountInputs(module, config, omitBios) {
    module.FS.mkdirTree('/roms');
    module.FS.mkdirTree('/mame/sta');
    module.FS.mkdirTree('/mame/nvram');
    module.FS.mkdirTree('/mame/cfg');
    return Promise.all(config.roms.map(function (rom, index) {
      if (omitBios && index === config.biosRomIndex) return null;
      return fetch(rom.url).then(function (response) {
        if (!response.ok) throw new Error('ROM request failed');
        return response.arrayBuffer();
      }).then(function (bytes) {
        module.FS.writeFile('/roms/' + rom.name, new Uint8Array(bytes));
      });
    }));
  }

  function argv(config) {
    var args = [
      config.machine,
      '-rompath', '/roms',
      '-video', 'web',
      '-sound', 'web',
      '-samplerate', '48000',
      '-nothrottle',
      '-noautoframeskip',
      '-joystick',
      '-nvram_directory', '/mame/nvram',
      '-state_directory', '/mame/sta',
      '-cfg_directory', '/mame/cfg',
      '-skip_gameinfo'
    ];
    if (config.bios) args.push('-bios', config.bios);
    return args;
  }

  function fileSummary(FS, root) {
    var files = 0;
    var bytes = 0;
    function visit(path) {
      FS.readdir(path).forEach(function (name) {
        if (name === '.' || name === '..') return;
        var child = path + '/' + name;
        var stat = FS.stat(child);
        if (FS.isDir(stat.mode)) visit(child);
        else { files++; bytes += stat.size; }
      });
    }
    visit(root);
    return { files: files, bytes: bytes };
  }

  function waitForState(run, values, start) {
    for (var attempt = 0; attempt < 180 && values().stateDone.length === start; attempt++) run(1);
    return values().stateDone[start] === 1;
  }

  api.runMain = async function () {
    var stage = 'config';
    try {
      var config = await fetch('/preload.json').then(function (response) { return response.json(); });
      stage = 'runtime';
      var active = await runtime(config, false);
      stage = 'mount';
      await mountInputs(active.module, config, false);
      var callMainReturned = false;
      stage = 'callMain';
      active.module.callMain(argv(config));
      callMainReturned = true;
      await new Promise(function (resolveTurn) { setTimeout(resolveTurn, 0); });

      var run = active.module.cwrap('web_run_frames', 'number', ['number']);
      var setControl = active.module.cwrap('web_set_control', null, ['number', 'number', 'number']);
      var pause = active.module.cwrap('web_pause', null, []);
      var resume = active.module.cwrap('web_resume', null, []);
      var save = active.module.cwrap('web_save_state', null, ['string']);
      var load = active.module.cwrap('web_load_state', null, ['string']);
      var flush = active.module.cwrap('web_flush_nvram', 'number', []);
      var exit = active.module.cwrap('web_exit', null, []);
      var machineInfo = active.module.cwrap('web_machine_info', 'number', []);
      var initialFlush = flush();
      var initialInfo = active.module.UTF8ToString(machineInfo());
      if (initialInfo === '{}') {
        var initialValues = active.values();
        throw new Error('machine was not retained: ' + JSON.stringify({
          frontendResult: initialValues.frontendResult,
          logs: initialValues.logs.map(function (record) {
            return {
              level: record.level,
              unknownOption: record.text.includes('Unknown option'),
              unknownSystem: record.text.includes('Unknown system'),
              requiredFiles: record.text.includes('Required files'),
              video: record.text.includes('video'),
              sound: record.text.includes('sound')
            };
          })
        }));
      }

      stage = 'frames';
      for (var frame = 0; frame < 120; frame++) run(1);
      stage = 'machine info';
      var info = JSON.parse(active.module.UTF8ToString(machineInfo()));
      var expected = config.family === 'neogeo'
        ? { width: 320, height: 224, refresh: 59.185606 }
        : { width: 384, height: 224, refresh: 59.637405 };

      var beforeInput = active.values().ticks;
      stage = 'input';
      setControl(0, 3, 1);
      var inputFrames = run(1);
      setControl(0, 3, 0);
      var inputFrameAdvanced = inputFrames === 1 && active.values().ticks === beforeInput + 1;

      stage = 'pause';
      pause();
      var pauseReturnedZero = run(1) === 0;
      resume();

      var stateIndex = active.values().stateDone.length;
      stage = 'save';
      save('w3-roundtrip');
      var saveOk = waitForState(run, active.values, stateIndex);
      var postSaveFlush = flush();
      var statePath = '/mame/sta/w3-roundtrip.sta';
      var stateBytes = active.module.FS.analyzePath(statePath).exists
        ? active.module.FS.stat(statePath).size : 0;
      stateIndex = active.values().stateDone.length;
      stage = 'load';
      load('w3-roundtrip');
      var loadOk = waitForState(run, active.values, stateIndex);
      var postLoadFrameAdvanced = loadOk && run(1) === 1;

      stage = 'flush';
      var postLoadFlush = flush();
      if (postLoadFlush !== 0) throw new Error('NVRAM flush failed: ' + JSON.stringify({
        initial: initialFlush, postSave: postSaveFlush, postLoad: postLoadFlush,
        saveOk: saveOk, loadOk: loadOk
      }));
      stage = 'NVRAM summary';
      var nvram = fileSummary(active.module.FS, '/mame/nvram');
      stage = 'exit';
      exit();
      exit();

      var values = active.values();
      api.main = {
        audio960: values.soundFrames.length > 0 && values.soundFrames.every(function (chunk) {
          return chunk.count === 960 && chunk.length === 1920;
        }),
        callMainReturned: callMainReturned,
        exitCount: values.exitCount,
        frameMatchesInfo: values.lastFrame !== null
          && values.lastFrame.width === info.width && values.lastFrame.height === info.height,
        geometryMatchesFamily: info.width === expected.width && info.height === expected.height,
        webLive: info.webLive,
        inputFrameAdvanced: inputFrameAdvanced,
        infoIsValid: typeof info.name === 'string' && info.name.length > 0
          && typeof info.description === 'string' && info.description.length > 0
          && (info.orientation === 'horizontal' || info.orientation === 'vertical')
          && typeof info.aspectRatio === 'number' && info.aspectRatio > 0
          && Number.isInteger(info.players) && info.players >= 1 && info.players <= 4
          && Number.isInteger(info.buttons) && info.buttons >= 0 && info.buttons <= 6
          && Array.isArray(info.bios) && typeof info.hasNvram === 'boolean',
        loadOk: loadOk,
        nonBlack: values.nonBlack,
        nvramBytes: nvram.bytes,
        nvramFiles: nvram.files,
        nvramFlushOk: postLoadFlush === 0,
        pauseReturnedZero: pauseReturnedZero,
        postLoadFrameAdvanced: postLoadFrameAdvanced,
        refreshMatchesFamily: Math.abs(info.refreshHz - expected.refresh) < 0.01,
        saveOk: saveOk,
        stateBytes: stateBytes,
        ticks: values.ticks
      };
    } catch (error) {
      api.error = stage + ': ' + (error && error.stack ? error.stack : String(error));
      throw error;
    }
  };

  api.runMissingBios = async function () {
    try {
      var config = await fetch('/preload.json').then(function (response) { return response.json(); });
      if (config.biosRomIndex < 0) throw new Error('Configured family has no identifiable BIOS archive');
      var failed = await runtime(config, true);
      await mountInputs(failed.module, config, true);
      var callMainReturned = false;
      failed.module.callMain(argv(config));
      callMainReturned = true;
      var values = failed.values();
      var machineInfo = failed.module.cwrap('web_machine_info', 'number', []);
      var runningRetained = failed.module.UTF8ToString(machineInfo()) !== '{}';
      api.missing = {
        callMainReturned: callMainReturned,
        errorBeforeFrontendDone: values.frontendLogCount > 0
          && values.logs.slice(0, values.frontendLogCount).some(function (record) { return record.level === 0; }),
        frontendResult: values.frontendResult,
        logCount: values.logs.length,
        runningRetained: runningRetained,
        ticks: values.ticks
      };
    } catch (error) {
      api.error = error && error.stack ? error.stack : String(error);
      throw error;
    }
  };
})();
</script>`;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> preloadConfig
// Validates the ignored preload file without logging any private value.
const loadConfig = (argument: string): PreloadConfig => {
    const configPath = resolve(argument);
    const directory = dirname(configPath);
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as RawPreloadConfig;
    if ((parsed.family !== "neogeo" && parsed.family !== "cps1")
        || typeof parsed.machine !== "string"
        || !/^[a-z0-9_]+$/.test(parsed.machine)
        || (parsed.bios !== undefined && typeof parsed.bios !== "string")
        || !Array.isArray(parsed.roms)
        || parsed.roms.length === 0
        || parsed.roms.some((path) => typeof path !== "string")) {
        throw new Error("ARCADE_PRELOAD_CONFIG is not a valid bridge preload config");
    }
    return {
        family: parsed.family,
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        roms: parsed.roms.map((path) => resolve(directory, path as string)),
    };
};

// A config for another family skips this file rather than failing it; the skip reason names what it needs.
const preload = ((): PreloadConfig | undefined => {
    if (CONFIG_ARGUMENT === undefined) return undefined;
    try { return loadConfig(CONFIG_ARGUMENT); } catch { return undefined; }
})();

// HELPER :: VOID -> PROMISE(bridgePageServer)
// Serves only the generated module, its wasm, and files named by the ignored config.
const startBridgePageServer = async (): Promise<BridgePageServer> => {
    if (preload === undefined) throw new Error("preload config is unavailable");
    if (!existsSync(ARTIFACT) || !existsSync(WASM_ARTIFACT)) {
        throw new Error("Build the production web bridge under .cache/w3-web before running this case");
    }

    const romNames = preload.roms.map((path) => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1));
    const biosRomIndex = romNames.findIndex((name) => name.toLowerCase() === `${preload.family}.zip`);
    const browserConfig = {
        family: preload.family,
        machine: preload.machine,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        biosRomIndex,
        roms: romNames.map((name, index) => ({ name, url: `/rom/${index}` })),
    };

    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (pathname === "/") {
            response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
            response.end(PAGE);
            return;
        }
        if (pathname === "/preload.json") {
            response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            response.end(JSON.stringify(browserConfig));
            return;
        }
        const romMatch = /^\/rom\/(\d+)$/.exec(pathname);
        const path = pathname === "/mame.js"
            ? ARTIFACT
            : pathname === "/mame.wasm"
                ? WASM_ARTIFACT
                : romMatch === null
                    ? undefined
                    : preload.roms[Number(romMatch[1])];
        if (path === undefined || !existsSync(path)) {
            response.writeHead(404).end();
            return;
        }
        const mediaType = pathname.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : pathname.endsWith(".wasm")
                ? "application/wasm"
                : "application/zip";
        response.writeHead(200, { "content-type": mediaType, "cache-control": "no-store" });
        response.end(readFileSync(path));
    });

    await new Promise<void>((resolveListening, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolveListening();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("bridge server did not bind a TCP port");
    return { server, url: `http://127.0.0.1:${address.port}/` };
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs a browser pipeline and always releases the private local server.
const withBridgePage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const page = await startBridgePageServer();
    try {
        return await run(page.url);
    } finally {
        page.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => page.server.close(() => resolveClosed()));
    }
};

const testFile: TestFile = {
    label: "MAME 0.161 production web bridge",
    skip: preload === undefined
        ? "set ARCADE_PRELOAD_CONFIG to an ignored §11.1 preload config"
        : undefined,
    cases: [
        {
            label: "drives frames, media, controls, state and exit through §4.3.1",
            run: () => withBridgePage((url) => CTGBrowserTest.init("production bridge happy path")
                .interact("run the production module by hand", async ({ page }) => {
                    await page.waitForFunction(() =>
                        typeof (window as unknown as { bridgeTest?: BridgeBrowserApi }).bridgeTest?.runMain === "function");
                    await page.evaluate(async () => {
                        const bridge = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest;
                        try {
                            await bridge.runMain();
                        } catch {
                            throw new Error(bridge.error ?? "web bridge run failed");
                        }
                    });
                })
                .assertPage(
                    "callMain returns and 120 explicit steps produce matching native media",
                    (page) => page.evaluate(() => {
                        const result = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest.main;
                        return result?.callMainReturned === true
                            && result.ticks >= 120
                            && result.frameMatchesInfo
                            && result.geometryMatchesFamily
                            && result.refreshMatchesFamily
                            && result.nonBlack
                            && result.audio960;
                    }),
                    true,
                )
                .assertPage(
                    "machine metadata, virtual input, pause and scheduled state operations work",
                    (page) => page.evaluate(() => {
                        const result = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest.main;
                        return result?.infoIsValid === true
                            && result.inputFrameAdvanced
                            && result.pauseReturnedZero
                            && result.saveOk
                            && result.loadOk
                            && result.postLoadFrameAdvanced
                            && result.stateBytes > 0;
                    }),
                    true,
                )
                .assertPage(
                    "NVRAM flush completes and exit fires exactly once",
                    (page) => page.evaluate(() => {
                        const result = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest.main;
                        return result !== undefined
                            && result.nvramFlushOk
                            && result.exitCount === 1;
                    }),
                    true,
                )
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
        {
            label: "reports a missing BIOS before any emulated frame",
            run: () => withBridgePage((url) => CTGBrowserTest.init("production bridge audit failure")
                .interact("omit the configured family BIOS archive", async ({ page }) => {
                    await page.waitForFunction(() =>
                        typeof (window as unknown as { bridgeTest?: BridgeBrowserApi }).bridgeTest?.runMissingBios === "function");
                    await page.evaluate(async () => {
                        const bridge = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest;
                        try {
                            await bridge.runMissingBios();
                        } catch {
                            throw new Error(bridge.error ?? "missing-BIOS run failed");
                        }
                        const result = bridge.missing;
                        if (result?.callMainReturned !== true
                            || result.frontendResult !== 2
                            || !result.errorBeforeFrontendDone
                            || result.ticks !== 0) {
                            throw new Error(`audit observation ${JSON.stringify(result)}`);
                        }
                    });
                })
                .assertPage(
                    "ordered error logs precede missing-files status and no tick fires",
                    (page) => page.evaluate(() => {
                        const result = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest.missing;
                        return result?.callMainReturned === true
                            && result.frontendResult === 2
                            && result.errorBeforeFrontendDone
                            && result.ticks === 0;
                    }),
                    true,
                )
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
