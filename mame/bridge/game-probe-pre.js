// The local game probe injects MAME_PROBE_MACHINE through an ignored,
// generated pre-JavaScript file before loading this generic bridge.
var JSMESS = { running: false };
if (typeof window !== "undefined") {
    window.JSMESS = JSMESS;
}

// These names are referenced by the stock JavaScript sound shim. The probe
// selects `-sound none`, but no-op definitions keep the link safe if MAME
// initializes volume before applying that selection.
function jsmess_update_audio_stream() {}
function jsmess_set_mastervolume() {}

if (typeof MAME_PROBE_MACHINE !== "string" || MAME_PROBE_MACHINE.length === 0) {
    throw new Error("Missing local MAME probe machine");
}
if (typeof MAME_PROBE_SECOND_MACHINE !== "string") {
    throw new Error("Missing local MAME second probe machine configuration");
}

var selectedProbeMachine = MAME_PROBE_MACHINE;
if (MAME_PROBE_SECOND_MACHINE.length > 0 && typeof window !== "undefined") {
    var probeParams = new URL(window.location.href).searchParams;
    if (probeParams.get("mame_probe_machine") === "second") {
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

Module["onRuntimeInitialized"] = function() {
    JSMESS.running = true;
};

Module["arguments"] = [
    selectedProbeMachine,
    "-rompath", "/roms",
    "-video", "soft",
    "-sound", "none",
    "-window",
    "-nomaximize",
    "-skip_gameinfo",
];
