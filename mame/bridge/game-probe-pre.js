// The local game probe injects MAME_PROBE_MACHINE through an ignored,
// generated pre-JavaScript file before loading this generic bridge.
var JSMESS = { running: false };
if (typeof window !== "undefined") {
    window.JSMESS = JSMESS;
}

var probeParams = typeof window === "undefined"
    ? null
    : new URL(window.location.href).searchParams;
var persistenceProbeToken = probeParams && probeParams.get("mame_probe_persistence");
var persistenceProbeEnabled = typeof persistenceProbeToken === "string"
    && persistenceProbeToken.length > 0;
var persistenceRoot = persistenceProbeEnabled
    ? "/persistence-" + persistenceProbeToken.replace(/[^A-Za-z0-9_-]/g, "")
    : "";

JSMESS.persistenceSnapshot = function() {
    var files = [];
    if (!persistenceProbeEnabled || !JSMESS.persistenceReady) {
        return files;
    }
    var pending = [persistenceRoot];
    while (pending.length > 0) {
        var directory = pending.pop();
        FS.readdir(directory).forEach(function(name) {
            if (name === "." || name === "..") return;
            var path = directory + "/" + name;
            var stat = FS.stat(path);
            if (FS.isDir(stat.mode)) {
                pending.push(path);
                return;
            }
            var bytes = FS.readFile(path);
            var checksum = 2166136261;
            for (var index = 0; index < bytes.length; index++) {
                checksum ^= bytes[index];
                checksum = Math.imul(checksum, 16777619) >>> 0;
            }
            files.push({
                path: path.slice(persistenceRoot.length + 1),
                size: bytes.length,
                checksum: checksum.toString(16).padStart(8, "0"),
            });
        });
    }
    return files.sort(function(left, right) {
        return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
    });
};
JSMESS.syncPersistence = function() {
    return new Promise(function(resolve, reject) {
        FS.syncfs(false, function(error) {
            JSMESS.persistenceSyncError = error ? String(error) : "";
            if (error) reject(error);
            else resolve(JSMESS.persistenceSnapshot());
        });
    });
};

if (persistenceProbeEnabled) {
    Module["preRun"] = Module["preRun"] || [];
    Module["preRun"].push(function() {
        FS.mkdir(persistenceRoot);
        FS.mount(IDBFS, {}, persistenceRoot);
        addRunDependency("p8-persistence-hydration");
        FS.syncfs(true, function(error) {
            JSMESS.persistenceHydrationError = error ? String(error) : "";
            if (!error) {
                FS.mkdirTree(persistenceRoot + "/nvram");
                FS.mkdirTree(persistenceRoot + "/cfg");
                JSMESS.persistenceReady = true;
                JSMESS.persistenceHydratedFiles = JSMESS.persistenceSnapshot();
            }
            removeRunDependency("p8-persistence-hydration");
        });
    });
}
var pacingCadenceHz = Number(probeParams && probeParams.get("mame_probe_hz"));
if (typeof window !== "undefined"
    && Number.isFinite(pacingCadenceHz)
    && pacingCadenceHz >= 30
    && pacingCadenceHz <= 240) {
    var controlledFrameIntervalMs = 1000 / pacingCadenceHz;
    var controlledNextFrameMs = performance.now();
    window.requestAnimationFrame = function(callback) {
        var now = performance.now();
        do {
            controlledNextFrameMs += controlledFrameIntervalMs;
        } while (controlledNextFrameMs <= now);
        return window.setTimeout(function() {
            callback(performance.now());
        }, controlledNextFrameMs - now);
    };
    window.cancelAnimationFrame = function(handle) {
        window.clearTimeout(handle);
    };
    JSMESS.requestedDisplayHz = pacingCadenceHz;
}

// These names are referenced by the stock JavaScript sound shim. The probe
// records its boundary traffic when `-sound js` is selected and remains safe
// when another probe selects `-sound none`.
function jsmess_update_audio_stream(bufferPointer, frames) {
    JSMESS.audioCallbackCount = (JSMESS.audioCallbackCount || 0) + 1;
    JSMESS.audioFrameCount = (JSMESS.audioFrameCount || 0) + frames;
    JSMESS.lastAudioBufferPointer = bufferPointer;
    JSMESS.lastAudioFrames = frames;
}
function jsmess_set_mastervolume(attenuation) {
    JSMESS.masterAttenuation = attenuation;
}

if (typeof MAME_PROBE_MACHINE !== "string" || MAME_PROBE_MACHINE.length === 0) {
    throw new Error("Missing local MAME probe machine");
}
if (typeof MAME_PROBE_SECOND_MACHINE !== "string") {
    throw new Error("Missing local MAME second probe machine configuration");
}
if (MAME_PROBE_SOUND !== "none" && MAME_PROBE_SOUND !== "js") {
    throw new Error("Invalid local MAME sound probe configuration");
}

var selectedProbeMachine = MAME_PROBE_MACHINE;
if (MAME_PROBE_SECOND_MACHINE.length > 0 && typeof window !== "undefined") {
    if (probeParams && probeParams.get("mame_probe_machine") === "second") {
        selectedProbeMachine = MAME_PROBE_SECOND_MACHINE;
    }
}

JSMESS.initialMachine = MAME_PROBE_MACHINE;
JSMESS.secondMachine = MAME_PROBE_SECOND_MACHINE;
JSMESS.configuredMachine = selectedProbeMachine;
JSMESS.currentMachine = function() {
    return JSMESS.currentMachineName || "";
};
JSMESS.scheduledEventPending = function() {
    return JSMESS.scheduledEvent === true;
};
JSMESS.scheduleMachine = function(machine) {
    JSMESS.scheduleResult = null;
    JSMESS.requestedMachine = machine;
};
JSMESS.pacingSnapshot = function() {
    var pacing = JSMESS.pacing || {};
    return {
        wallTimeMs: performance.now(),
        requestedDisplayHz: JSMESS.requestedDisplayHz,
        callbackCount: pacing.callbackCount,
        callbackIntervalCount: pacing.callbackIntervalCount,
        callbackIntervalTotalMs: pacing.callbackIntervalTotalMs,
        callbackWorkTotalMs: pacing.callbackWorkTotalMs,
        callbackWorkMaxMs: pacing.callbackWorkMaxMs,
        emulatedTimeUs: pacing.emulatedTimeUs,
        screenFrameNumber: pacing.screenFrameNumber,
        refreshMilliHz: pacing.refreshMilliHz,
        speedPermille: pacing.speedPermille,
        lastEmulatedAdvanceUs: pacing.lastEmulatedAdvanceUs,
    };
};
JSMESS.requestHook = function(name) {
    var commands = {
        pause: 1,
        resume: 2,
        softReset: 3,
        save: 4,
        load: 5,
        exit: 6,
        flushPersistence: 7,
    };
    if (name === "save") {
        // Emscripten 1.38.31's libc path crashes when open(O_CREAT) creates
        // the state file. Create only the missing MEMFS node here; MAME still
        // owns truncation, serialization and every subsequent load.
        var statePath = "/sta/" + JSMESS.currentMachine() + "/p7-probe.sta";
        if (!FS.analyzePath(statePath).exists) {
            FS.mkdirTree(statePath.slice(0, statePath.lastIndexOf("/")));
            FS.writeFile(statePath, new Uint8Array(0));
        }
    }
    JSMESS.hookResult = null;
    JSMESS.hookRequest = commands[name] || -1;
};

Module["onRuntimeInitialized"] = function() {
    JSMESS.running = true;
};

Module["arguments"] = [
    selectedProbeMachine,
    "-rompath", "/roms",
    "-video", "soft",
    "-sound", MAME_PROBE_SOUND,
    "-window",
    "-nomaximize",
    "-skip_gameinfo",
];
if (persistenceProbeEnabled) {
    Module["arguments"].push(
        "-nvram_directory", persistenceRoot + "/nvram",
        "-cfg_directory", persistenceRoot + "/cfg"
    );
}
