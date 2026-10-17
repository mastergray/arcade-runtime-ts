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

Module["onRuntimeInitialized"] = function() {
    JSMESS.running = true;
};

Module["arguments"] = [
    MAME_PROBE_MACHINE,
    "-rompath", "/roms",
    "-video", "soft",
    "-sound", "none",
    "-window",
    "-nomaximize",
    "-skip_gameinfo",
];
