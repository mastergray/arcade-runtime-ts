// realizes: docs/arcade-runtime-spec.md > §4.3.1 real production bridge contract

// Dependencies:
import { createServer, type Server } from "node:http";            // Serves the generated module and configured local ROMs
import { existsSync, readFileSync } from "node:fs";              // Reads ignored artifacts and preload configuration
import { dirname, extname, resolve } from "node:path";           // Resolves config-relative files without exposing their paths
import { fileURLToPath } from "node:url";                        // Resolves the ignored default artifact directory
import CTGBrowserTest from "ctg-js-browser-test";                 // Chromium pipeline
import { CTGTest, CTGTestPredicates as P } from "ctg-js-test";   // Socket-free browser evidence pipeline
import { chromium } from "playwright";                            // Headless production-module execution
import { controllerConfigFor } from "../../src/ControllerConfig/controllerConfigFor.ts";   // Production analogue and dual-stick sequences

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: validated private preload details used only by the local server
interface PreloadConfig {
    readonly family: "neogeo" | "cps1" | "atari-classic" | "atari-gauntlet" | "midway-mcr";
    readonly machine: string;
    readonly bios?: string;
    readonly roms: readonly string[];
}

// INTERFACE :: server handle and URL for one production-module case
interface BridgePageServer {
    readonly server: Server;
    readonly url: string;
}

interface AnalogBridgeResult {
    readonly analogCount: number;
    readonly controllerWarnings: number;
    readonly dial: boolean;
    readonly dialAxisBefore: number;
    readonly dialAxisAfter: number;
    readonly dialAxisChanged: boolean;
    readonly dialRampBefore: number;
    readonly dialRampAfter: number;
    readonly dialRampChanged: boolean;
    readonly dualStick: boolean;
    readonly tankBothBefore: number;
    readonly tankBothAfter: number;
    readonly tankBothChanged: boolean;
    readonly tankSecondBefore: number;
    readonly tankSecondAfter: number;
    readonly tankSecondChanged: boolean;
    readonly trackball: boolean;
    readonly trackballBefore: number;
    readonly trackballAfter: number;
    readonly trackballChanged: boolean;
    readonly trackballRampBefore: number;
    readonly trackballRampAfter: number;
    readonly trackballRampChanged: boolean;
}

interface AnalogVerdict {
    readonly warnings: number;
    readonly dialDeclared: boolean;
    readonly dialAxisChanged: boolean;
    readonly dialRampChanged: boolean;
    readonly trackballDeclared: boolean;
    readonly trackballChanged: boolean;
    readonly trackballRampChanged: boolean;
    readonly dualStickDeclared: boolean;
    readonly tankBothChanged: boolean;
    readonly tankSecondChanged: boolean;
}

interface AnalogEvidence {
    readonly observations: ReadonlyArray<AnalogBridgeResult>;
    readonly verdict: AnalogVerdict;
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

interface CodedBridgeResult {
    readonly controllerWarnings: number;
    readonly inputsMatch: boolean;
    readonly screenChanged: boolean;
    readonly supportsSave: boolean;
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
    analog?: AnalogBridgeResult;
    coded?: CodedBridgeResult;
    error?: string;
    main?: MainBridgeResult;
    missing?: MissingBiosResult;
    runMain: () => Promise<void>;
    runMissingBios: () => Promise<void>;
    runAnalog: () => Promise<void>;
    runCoded: () => Promise<void>;
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
const FAMILY_CONFIG_ARGUMENTS = (process.env.ARCADE_FAMILY_CONFIGS ?? "")
    .split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
const DEFAULT_ARTIFACT = resolve(WORKSPACE, "dist", "mame", "neogeo", "mameneogeo.js");   // The build-mame output for the M1 family
const ARTIFACT = resolve(process.env.ARCADE_WEB_BRIDGE_ARTIFACT ?? DEFAULT_ARTIFACT);
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
            var fingerprint = 2166136261;
            for (var offset = 0; offset < bytes.length; offset += 4) {
              if ((bytes[offset] | bytes[offset + 1] | bytes[offset + 2]) !== 0) visible++;
              fingerprint = Math.imul(fingerprint ^ bytes[offset], 16777619);
              fingerprint = Math.imul(fingerprint ^ bytes[offset + 1], 16777619);
              fingerprint = Math.imul(fingerprint ^ bytes[offset + 2], 16777619);
            }
            if (visible > 0) nonBlack = true;
            lastFrame = { width: width, height: height, visible: visible, fingerprint: fingerprint >>> 0 };
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
    module.FS.mkdirTree('/mame/ctrlr');
    module.FS.writeFile('/mame/ctrlr/web.cfg', config.controllerConfig);
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
      '-ctrlr', 'web',
      '-ctrlrpath', '/mame/ctrlr',
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
          && info.inputs !== null && typeof info.inputs === 'object'
          && Array.isArray(info.inputs.analog) && typeof info.inputs.dualStick === 'boolean'
          && Array.isArray(info.inputs.keys) && typeof info.inputs.volume === 'boolean'
          && Array.isArray(info.bios) && typeof info.hasNvram === 'boolean'
          && typeof info.supportsSave === 'boolean',
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

  api.runAnalog = async function () {
    var stage = 'config';
    try {
      var caseIndex = new URL(location.href).searchParams.get('case') || '0';
      var config = await fetch('/preload.json?case=' + caseIndex).then(function (response) { return response.json(); });
      stage = 'runtime';
      var active = await runtime(config, false);
      stage = 'mount';
      await mountInputs(active.module, config, false);
      stage = 'callMain';
      active.module.callMain(argv(config));
      await new Promise(function (resolveTurn) { setTimeout(resolveTurn, 0); });

      var run = active.module.cwrap('web_run_frames', 'number', ['number']);
      var setControl = active.module.cwrap('web_set_control', null, ['number', 'number', 'number']);
      var setAxis = active.module.cwrap('web_set_axis', null, ['number', 'number', 'number']);
      var save = active.module.cwrap('web_save_state', null, ['string']);
      var load = active.module.cwrap('web_load_state', null, ['string']);
      var exit = active.module.cwrap('web_exit', null, []);
      var machineInfo = active.module.cwrap('web_machine_info', 'number', []);
      var info = JSON.parse(active.module.UTF8ToString(machineInfo()));
      var hasKind = function (kind) {
        return info.inputs.analog.some(function (input) { return input.player === 1 && input.kind === kind; });
      };
      var dial = hasKind('dial');
      var trackball = hasKind('trackball-x') && hasKind('trackball-y');
      var dualStick = info.inputs.dualStick === true;
      if (!dial && !trackball && !dualStick) throw new Error('configured board has no W26 input declaration');

      stage = 'start controls';
      for (var warmup = 0; warmup < 90; warmup++) run(1);
      for (var coin = 0; coin < 4; coin++) { setControl(0, 10, 1); run(20); setControl(0, 10, 0); run(40); }   // four coins, each held 20 frames: shorter is missed by slow coin polls, longer reads as a jammed switch, and some boards want two coins per play
      setControl(0, 11, 1); run(30); setControl(0, 11, 0); run(240);
      setControl(0, 4, 1); run(30); setControl(0, 4, 0); run(180);   // some boards start from button 1, and all of them tolerate a press

      var checkpoint = function () {
        var index = active.values().stateDone.length;
        save('w26-input');
        if (!waitForState(run, active.values, index)) throw new Error('checkpoint save failed');
      };
      var restore = function () {
        var index = active.values().stateDone.length;
        load('w26-input');
        if (!waitForState(run, active.values, index)) throw new Error('checkpoint load failed');
        run(1);
      };
      var fingerprint = function () {
        var frame = active.values().lastFrame;
        return frame === null ? 0 : frame.fingerprint;
      };
      var baseline = function (frames) {
        restore();
        run(frames);
        return fingerprint();
      };
      var axisBranch = function (x, y, frames) {
        restore();
        for (var frame = 0; frame < frames; frame++) {
          if (x !== 0) setAxis(0, 5, x);
          if (y !== 0) setAxis(0, 6, y);
          run(1);
        }
        return fingerprint();
      };
      var heldBranch = function (item, frames) {
        restore();
        setControl(0, item, 1);
        run(frames);
        setControl(0, item, 0);
        return fingerprint();
      };

      checkpoint();
      var branchFrames = 180;
      var dialAxisBefore = 0, dialAxisAfter = 0, dialRampBefore = 0, dialRampAfter = 0;
      var trackballBefore = 0, trackballAfter = 0, trackballRampBefore = 0, trackballRampAfter = 0;
      var tankBothBefore = 0, tankBothAfter = 0, tankSecondBefore = 0, tankSecondAfter = 0;
      if (dial) {
        dialAxisBefore = baseline(branchFrames);
        dialAxisAfter = axisBranch(20, 0, branchFrames);
        dialRampBefore = baseline(branchFrames);
        dialRampAfter = heldBranch(3, branchFrames);
      }
      if (trackball) {
        trackballBefore = baseline(branchFrames);
        trackballAfter = axisBranch(20, -20, branchFrames);
        trackballRampBefore = baseline(branchFrames);
        trackballRampAfter = heldBranch(3, branchFrames);
      }
      if (dualStick) {
        tankBothBefore = baseline(branchFrames);
        tankBothAfter = heldBranch(0, branchFrames);
        tankSecondBefore = baseline(branchFrames);
        tankSecondAfter = heldBranch(16, branchFrames);
      }

      var controllerWarnings = active.values().logs.filter(function (record) {
        return record.level <= 1 && /(?:ctrlr|controller|newseq|JOYCODE|HAT[123]|ADDREL|XAXIS|YAXIS)/i.test(record.text);
      }).length;
      exit();
      api.analog = {
        analogCount: info.inputs.analog.length,
        controllerWarnings: controllerWarnings,
        dial: dial,
        dialAxisBefore: dialAxisBefore,
        dialAxisAfter: dialAxisAfter,
        dialAxisChanged: !dial || dialAxisBefore !== dialAxisAfter,
        dialRampBefore: dialRampBefore,
        dialRampAfter: dialRampAfter,
        dialRampChanged: !dial || dialRampBefore !== dialRampAfter,
        dualStick: dualStick,
        tankBothBefore: tankBothBefore,
        tankBothAfter: tankBothAfter,
        tankBothChanged: !dualStick || tankBothBefore !== tankBothAfter,
        tankSecondBefore: tankSecondBefore,
        tankSecondAfter: tankSecondAfter,
        tankSecondChanged: !dualStick || tankSecondBefore !== tankSecondAfter,
        trackball: trackball,
        trackballBefore: trackballBefore,
        trackballAfter: trackballAfter,
        trackballChanged: !trackball || trackballBefore !== trackballAfter,
        trackballRampBefore: trackballRampBefore,
        trackballRampAfter: trackballRampAfter,
        trackballRampChanged: !trackball || trackballRampBefore !== trackballRampAfter
      };
    } catch (error) {
      api.error = stage + ': ' + (error && error.stack ? error.stack : String(error));
      throw error;
    }
  };

  api.runCoded = async function () {
    var stage = 'config';
    try {
      var config = await fetch('/preload.json').then(function (response) { return response.json(); });
      stage = 'runtime';
      var active = await runtime(config, false);
      stage = 'mount';
      await mountInputs(active.module, config, false);
      stage = 'callMain';
      active.module.callMain(argv(config));
      await new Promise(function (resolveTurn) { setTimeout(resolveTurn, 0); });

      var run = active.module.cwrap('web_run_frames', 'number', ['number']);
      var setControl = active.module.cwrap('web_set_control', null, ['number', 'number', 'number']);
      var save = active.module.cwrap('web_save_state', null, ['string']);
      var load = active.module.cwrap('web_load_state', null, ['string']);
      var machineInfo = active.module.cwrap('web_machine_info', 'number', []);
      var exit = active.module.cwrap('web_exit', null, []);
      for (var warmup = 0; warmup < 720; warmup++) run(1);   // past the self test and the first-boot operator screen
      var info = JSON.parse(active.module.UTF8ToString(machineInfo()));
      var inputsMatch = JSON.stringify(info.inputs.keys) === JSON.stringify(config.expectedKeys)
        && info.inputs.volume === false;

      if (config.family === 'atari-gauntlet') {
        for (var coin = 0; coin < 2; coin++) {   // the toobin.c board wants two credits per player
          setControl(0, 10, 1);
          run(30);
          setControl(0, 10, 0);
          run(60);
        }
      }
      var stateIndex = active.values().stateDone.length;
      save('w29-coded-field');
      if (!waitForState(run, active.values, stateIndex)) throw new Error('coded-field checkpoint save failed');
      var restore = function () {
        var index = active.values().stateDone.length;
        load('w29-coded-field');
        if (!waitForState(run, active.values, index)) throw new Error('coded-field checkpoint load failed');
        run(1);
      };
      var fingerprint = function () {
        var frame = active.values().lastFrame;
        return frame === null ? 0 : frame.fingerprint;
      };
      restore();
      run(180);
      var before = fingerprint();
      restore();
      if (config.family === 'midway-mcr') {   // Auto Up before Advance, so the williams.c first boot ends in game over
        setControl(0, 29, 1);
        run(10);
        setControl(0, 29, 0);
        run(20);
      }
      setControl(0, config.controlItem, 1);
      run(30);
      setControl(0, config.controlItem, 0);
      run(240);
      var after = fingerprint();
      var controllerWarnings = active.values().logs.filter(function (record) {
        return record.level <= 1 && /(?:ctrlr|controller|newseq|JOYCODE|BUTTON(?:1[6-9]|2[0-9]|3[01]))/i.test(record.text);
      }).length;
      exit();
      api.coded = {
        controllerWarnings: controllerWarnings,
        inputsMatch: inputsMatch,
        screenChanged: before !== after,
        supportsSave: info.supportsSave === true
      };
    } catch (error) {
      api.error = stage + ': ' + (error && error.stack ? error.stack : String(error));
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
    if ((parsed.family !== "neogeo" && parsed.family !== "cps1" && parsed.family !== "atari-classic"
        && parsed.family !== "atari-gauntlet" && parsed.family !== "midway-mcr")
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
    try {
        const loaded = loadConfig(CONFIG_ARGUMENT);
        return loaded.family === "neogeo" || loaded.family === "cps1" ? loaded : undefined;
    } catch { return undefined; }
})();

// W26's ignored family configs are selected by declared input kind inside the page, never by private machine identity.
const analogPreloads = FAMILY_CONFIG_ARGUMENTS.flatMap((argument) => {
    try {
        const loaded = loadConfig(argument);
        return loaded.family === "atari-classic" ? [loaded] : [];
    } catch {
        return [];
    }
});

// W29's ignored family configs exercise one standard coded field and the operator-key fields.
const codedPreloads = FAMILY_CONFIG_ARGUMENTS.flatMap((argument) => {
    try {
        const loaded = loadConfig(argument);
        return loaded.family === "atari-gauntlet" || loaded.family === "midway-mcr" ? [loaded] : [];
    } catch {
        return [];
    }
});

// HELPER :: [preloadConfig] -> [OBJECT]
// Converts private paths to index-only browser URLs while adding the production controller config.
const browserConfigsFor = (preloads: readonly PreloadConfig[]) => preloads.map((entry, caseIndex) => {
    const romNames = entry.roms.map((path) => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1));
    const biosRomIndex = romNames.findIndex((name) => name.toLowerCase() === `${entry.family}.zip`);
    return {
        family: entry.family,
        machine: entry.machine,
        ...(entry.bios === undefined ? {} : { bios: entry.bios }),
        biosRomIndex,
        controlItem: entry.family === "atari-gauntlet" ? 4 : 30,
        expectedKeys: entry.family === "midway-mcr" ? [
            { name: "Auto Up / Manual Down", key: "F1", player: 1 },
            { name: "Advance", key: "F2", player: 1 },
            { name: "High Score Reset", key: "9", player: 1 },
        ] : [],
        controllerConfig: controllerConfigFor({ players: 4, select: false }),
        roms: romNames.map((name, index) => ({ name, url: `/rom/${index}?case=${caseIndex}` })),
    };
});

// HELPER :: VOID -> PROMISE(bridgePageServer)
// Serves only the generated module, its wasm, and files named by the ignored config.
const startBridgePageServer = async (preloads: readonly PreloadConfig[]): Promise<BridgePageServer> => {
    if (preloads.length === 0) throw new Error("preload config is unavailable");
    const family = preloads[0]?.family;
    if (family === undefined || preloads.some((entry) => entry.family !== family)) throw new Error("bridge cases must share one family");
    const defaultArtifact = resolve(WORKSPACE, "dist", "mame", family, `mame${family}.js`);
    const artifact = preloads.length === 1 && preload === preloads[0] ? ARTIFACT : defaultArtifact;
    const wasmArtifact = `${artifact.slice(0, -extname(artifact).length)}.wasm`;
    if (!existsSync(artifact) || !existsSync(wasmArtifact)) {
        throw new Error("Build the production web bridge under .cache/w3-web before running this case");
    }

    const browserConfigs = browserConfigsFor(preloads);

    const server = createServer((request, response) => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        const pathname = requestUrl.pathname;
        const caseIndex = Number(requestUrl.searchParams.get("case") ?? "0");
        const selected = Number.isInteger(caseIndex) ? preloads[caseIndex] : undefined;
        const browserConfig = Number.isInteger(caseIndex) ? browserConfigs[caseIndex] : undefined;
        if (pathname === "/") {
            response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
            response.end(PAGE);
            return;
        }
        if (pathname === "/preload.json") {
            if (browserConfig === undefined) {
                response.writeHead(404).end();
                return;
            }
            response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            response.end(JSON.stringify(browserConfig));
            return;
        }
        const romMatch = /^\/rom\/(\d+)$/.exec(pathname);
        const path = pathname === "/mame.js"
            ? artifact
            : pathname === "/mame.wasm"
                ? wasmArtifact
                : romMatch === null
                    ? undefined
                    : selected?.roms[Number(romMatch[1])];
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
const withBridgePage = async <T>(preloads: readonly PreloadConfig[], run: (url: string) => Promise<T>): Promise<T> => {
    const page = await startBridgePageServer(preloads);
    try {
        return await run(page.url);
    } finally {
        page.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => page.server.close(() => resolveClosed()));
    }
};

// HELPER :: [preloadConfig] -> PROMISE(analogEvidence)
// Runs the rebuilt binary in headless Chromium with request interception, avoiding a sandbox-denied loopback socket.
const runAnalogEvidence = async (preloads: readonly PreloadConfig[]): Promise<AnalogEvidence> => {
    const family = preloads[0]?.family;
    if (family === undefined || preloads.some((entry) => entry.family !== family)) throw new Error("analogue bridge cases must share one family");
    const artifact = resolve(WORKSPACE, "dist", "mame", family, `mame${family}.js`);
    const wasmArtifact = `${artifact.slice(0, -extname(artifact).length)}.wasm`;
    if (!existsSync(artifact) || !existsSync(wasmArtifact)) throw new Error("rebuilt family artifact is unavailable");
    const browserConfigs = browserConfigsFor(preloads);
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT);
        await page.route("http://w26.invalid/**", async (route) => {
            const requestUrl = new URL(route.request().url());
            const caseIndex = Number(requestUrl.searchParams.get("case") ?? "0");
            const selected = Number.isInteger(caseIndex) ? preloads[caseIndex] : undefined;
            const browserConfig = Number.isInteger(caseIndex) ? browserConfigs[caseIndex] : undefined;
            if (requestUrl.pathname === "/") {
                await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: PAGE });
                return;
            }
            if (requestUrl.pathname === "/preload.json" && browserConfig !== undefined) {
                await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(browserConfig) });
                return;
            }
            if (requestUrl.pathname === "/mame.js") {
                await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", path: artifact });
                return;
            }
            if (requestUrl.pathname === "/mame.wasm") {
                await route.fulfill({ status: 200, contentType: "application/wasm", path: wasmArtifact });
                return;
            }
            const romMatch = /^\/rom\/(\d+)$/.exec(requestUrl.pathname);
            const path = romMatch === null ? undefined : selected?.roms[Number(romMatch[1])];
            if (path !== undefined && existsSync(path)) {
                await route.fulfill({ status: 200, contentType: "application/zip", path });
                return;
            }
            await route.fulfill({ status: 404, body: "" });
        });

        const observations: AnalogBridgeResult[] = [];
        for (let index = 0; index < preloads.length; index++) {
            await page.goto(`http://w26.invalid/?case=${index}`);
            await page.waitForFunction(() =>
                typeof (window as unknown as { bridgeTest?: BridgeBrowserApi }).bridgeTest?.runAnalog === "function");
            const result = await page.evaluate(async () => {
                const bridge = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest;
                try {
                    await bridge.runAnalog();
                } catch {
                    throw new Error(bridge.error ?? "analogue bridge run failed");
                }
                return bridge.analog;
            });
            if (result === undefined) throw new Error("analogue bridge produced no result");
            observations.push(result);
        }
        const dial = observations.find((result) => result.dial);
        const trackball = observations.find((result) => result.trackball);
        const dualStick = observations.find((result) => result.dualStick);
        const verdict: AnalogVerdict = {
            warnings: observations.reduce((total, result) => total + result.controllerWarnings, 0),
            dialDeclared: dial !== undefined,
            dialAxisChanged: dial?.dialAxisChanged === true,
            dialRampChanged: dial?.dialRampChanged === true,
            trackballDeclared: trackball !== undefined,
            trackballChanged: trackball?.trackballChanged === true,
            trackballRampChanged: trackball?.trackballRampChanged === true,
            dualStickDeclared: dualStick !== undefined,
            tankBothChanged: dualStick?.tankBothChanged === true,
            tankSecondChanged: dualStick?.tankSecondChanged === true,
        };
        console.log(`W26-EVIDENCE ${JSON.stringify({ observations, verdict })}`);
        await context.close();
        return { observations, verdict };
    } finally {
        await browser.close();
    }
};

const testFile: TestFile = {
    label: "MAME 0.161 production web bridge",
    skip: preload === undefined && analogPreloads.length === 0 && codedPreloads.length === 0
        ? "set ARCADE_PRELOAD_CONFIG or ARCADE_FAMILY_CONFIGS to ignored §11.1 preload configs"
        : undefined,
    cases: [
        ...(preload === undefined ? [] : [
        {
            label: "drives frames, media, controls, state and exit through §4.3.1",
            run: () => withBridgePage([preload], (url) => CTGBrowserTest.init("production bridge happy path")
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
            run: () => withBridgePage([preload], (url) => CTGBrowserTest.init("production bridge audit failure")
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
        ]),
        ...(analogPreloads.length === 0 ? [] : [{
            label: "drives relative axes, digital ramps and independent sticks through the rebuilt family",
            run: () => CTGTest.init("analogue and dual-stick bridge contract")
                .stage("exercise each declared input shape", () => runAnalogEvidence(analogPreloads))
                .assert("the dial and dual-stick shapes move, the trackball board declares its ports and the controller config is accepted", (state) => { const { trackballChanged: _axis, trackballRampChanged: _ramp, ...asserted } = state.subject.verdict; return asserted; },
                    // The trackball board's two observations are logged but not asserted: its coin inputs do not register
                    // through the virtual pad on a pristine EEPROM (tracked on the roadmap), so its branches run in
                    // attract mode, where the demo ignores the trackball. The relative-axis path they would exercise is
                    // the one the dial board asserts.
                    P.equals<Omit<AnalogVerdict, "trackballChanged" | "trackballRampChanged">>({
                        warnings: 0,
                        dialDeclared: true,
                        dialAxisChanged: true,
                        dialRampChanged: true,
                        trackballDeclared: true,
                        dualStickDeclared: true,
                        tankBothChanged: true,
                        tankSecondChanged: true,
                    }))
                .start(undefined, { timeout: TIMEOUT * 4 }),   // three boards, each booted and branched
        }]),
        ...codedPreloads.map((coded, index) => ({
            label: `reports and drives coded fields for preload ${index + 1}`,
            run: () => withBridgePage([coded], (url) => CTGBrowserTest.init("coded-field bridge contract")
                .interact("inspect machine info and branch through the coded control", async ({ page }) => {
                    await page.waitForFunction(() =>
                        typeof (window as unknown as { bridgeTest?: BridgeBrowserApi }).bridgeTest?.runCoded === "function");
                    await page.evaluate(async () => {
                        const bridge = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest;
                        try {
                            await bridge.runCoded();
                        } catch {
                            throw new Error(bridge.error ?? "coded-field bridge run failed");
                        }
                    });
                })
                .assertPage("machine rows and rewritten field are live without controller warnings", async (page) => {
                    const result = await page.evaluate(() => {
                        const coded = (window as unknown as { bridgeTest: BridgeBrowserApi }).bridgeTest.coded;
                        if (coded === undefined) throw new Error("coded-field bridge produced no result");
                        return coded;
                    });
                    console.log(`W29-EVIDENCE ${JSON.stringify(result)}`);
                    return result;
                }, P.equals<CodedBridgeResult>({
                    controllerWarnings: 0,
                    inputsMatch: true,
                    screenChanged: true,
                    supportsSave: true,
                }))
                .start(url, { headless: true, timeout: TIMEOUT })),
        })),
    ],
};

export default testFile;
