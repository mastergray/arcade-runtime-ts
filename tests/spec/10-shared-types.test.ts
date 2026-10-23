// realizes: docs/arcade-runtime-spec.md > §2 Shared Types (one passing input per predicate, then one input per violated condition)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import {
    arcadeControlKey,                                            // Helper under test
    isArcadeAdapter,                                             // Predicate under test
    isArcadeButtonCount,                                         // Predicate under test
    isArcadeButtonIndex,                                         // Predicate under test
    isArcadeControl,                                             // Predicate under test
    isArcadeDirection,                                           // Predicate under test
    isArcadeOptions,                                             // Predicate under test
    isArcadeSession,                                             // Predicate under test
    isArcadeStartConfig,                                         // Predicate under test
    isBiosOption,                                                // Predicate under test
    isBuildInfo,                                                 // Predicate under test
    isBuildLicense,                                              // Predicate under test
    isFetchResponseLike,                                         // Predicate under test
    isFiniteNumber,                                              // Predicate under test
    isFrameEvent,                                                // Predicate under test
    isFrameScheduler,                                            // Predicate under test
    isInputSurface,                                              // Predicate under test
    isKeyCode,                                                   // Predicate under test
    isMachineHints,                                              // Predicate under test
    isMachineInfo,                                               // Predicate under test
    isNonEmptyString,                                            // Predicate under test
    isOrientation,                                               // Predicate under test
    isPlayerCount,                                               // Predicate under test
    isPlayerIndex,                                               // Predicate under test
    isPointerEventLike,                                          // Predicate under test
    isRect,                                                      // Predicate under test
    isRomFile,                                                   // Predicate under test
    isRomName,                                                   // Predicate under test
    isRomRole,                                                   // Predicate under test
    isRomSource,                                                 // Predicate under test
    isScalingMode,                                               // Predicate under test
    isSoundEvent,                                                // Predicate under test
    isTimerLike,                                                 // Predicate under test
    isVector2,                                                   // Predicate under test
    romNameKey,                                                  // Helper under test
} from "../../src/index.ts";
import {
    isArcadeAxis,
    isArcadeAxisKind,
    isMachineAnalogKind,
    isMachineInputs,
} from "../../src/shared.types.ts";                              // W26 predicates pending integrator root exports
import FakeArcadeAdapter from "../support/FakeArcadeAdapter.ts";   // Accepted input for isArcadeAdapter
import FakeArcadeSession from "../support/FakeArcadeSession.ts";   // Accepted input for isArcadeSession
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts"; // Accepted input for isFrameScheduler
import FakeTimer from "../support/FakeTimer.ts";                   // Accepted input for isTimerLike
import {
    blankFrame,                                                  // Accepted input for isFrameEvent
    validBuildInfo,                                              // Accepted input for isBuildInfo
    validMachineInfo,                                            // Accepted input for isMachineInfo
    withKey,                                                     // Builds one-violation variants
} from "../support/fixtures.ts";

// Type dependencies:
import type { ArcadeControl } from "../../src/index.ts";        // Inputs to arcadeControlKey
import type { TestCase, TestFile } from "../run.ts";             // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {result:BOOLEAN}
// Snapshot of one predicate evaluation.
interface PredicateSnapshot {
    result: boolean;                                             // What the predicate returned
}

/**
 *
 * Constants
 *
 */

const NOOP = (): void => {};                                     // Placeholder function for method-shaped inputs

const SESSION_METHODS = [                                        // Every method isArcadeSession requires
    "setControl", "setAxis", "pause", "resume", "reset", "saveState", "loadState", "persist", "exit", "onTick", "onFrame", "onSound", "onExit",
] as const;

// HELPER :: STRING, (UNKNOWN -> BOOLEAN), UNKNOWN, BOOLEAN -> testCase
// Builds a case that evaluates predicate on input and expects result.
const predicateCase = (label: string, predicate: (value: unknown) => boolean, input: unknown, expected: boolean): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert(expected ? "returns true" : "returns false", () => ({ result: predicate(input) }), P.equals<PredicateSnapshot>({ result: expected }))
        .start(undefined),
});

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// A plain object meeting every isArcadeSession condition.
const sessionLike = (): Record<string, unknown> => {
    const object: Record<string, unknown> = { machine: validMachineInfo(), sampleRate: 48000 };
    for (const method of SESSION_METHODS) object[method] = NOOP;
    return object;
};

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// A plain object meeting every isPointerEventLike condition.
const pointerEventLike = (): Record<string, unknown> => ({
    type: "pointerdown", pointerId: 1, pointerType: "touch", clientX: 10, clientY: 20, button: 0, buttons: 1, timeStamp: 100, preventDefault: NOOP,
});

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// A plain object meeting every isInputSurface condition, with the optional capture methods present.
const inputSurfaceLike = (): Record<string, unknown> => ({
    addEventListener: NOOP, removeEventListener: NOOP, getBoundingClientRect: NOOP, setPointerCapture: NOOP, releasePointerCapture: NOOP,
});

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// A plain object meeting every isArcadeStartConfig condition, with every optional field present.
const startConfigLike = (): Record<string, unknown> => ({
    machine: "fake",
    machineHints: { players: 2, buttons: 6 },
    roms: [{ name: "fake.zip", bytes: new Uint8Array([1]) }, { name: "parent.zip", bytes: new Uint8Array() }],
    changes: new Uint8Array([2]),
    bios: "euro",
    dipswitches: { Lives: "3" },
    options: { frameskip: 0, samplerate: 48000, cheat: false, bios: "euro" },
});

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// validMachineInfo as a mutable record.
const machineLike = (): Record<string, unknown> => ({ ...validMachineInfo() });

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// validBuildInfo as a mutable record.
const buildLike = (): Record<string, unknown> => ({ ...validBuildInfo() });

const testFile: TestFile = {
    label: "shared types",
    cases: [
        // isNonEmptyString
        predicateCase("isNonEmptyString accepts a string with a non-whitespace character", isNonEmptyString, "a", true),
        predicateCase("isNonEmptyString rejects a non-string", isNonEmptyString, 1, false),
        predicateCase("isNonEmptyString rejects the empty string", isNonEmptyString, "", false),
        predicateCase("isNonEmptyString rejects a whitespace-only string", isNonEmptyString, "  ", false),

        // isFiniteNumber
        predicateCase("isFiniteNumber accepts -1.5", isFiniteNumber, -1.5, true),
        predicateCase("isFiniteNumber rejects NaN", isFiniteNumber, NaN, false),
        predicateCase("isFiniteNumber rejects Infinity", isFiniteNumber, Infinity, false),
        predicateCase("isFiniteNumber rejects the string \"1\"", isFiniteNumber, "1", false),

        // isKeyCode
        predicateCase("isKeyCode accepts \"ArrowUp\"", isKeyCode, "ArrowUp", true),
        predicateCase("isKeyCode rejects \"\"", isKeyCode, "", false),
        predicateCase("isKeyCode rejects \"Arrow-Up\"", isKeyCode, "Arrow-Up", false),

        // isVector2 and isRect
        predicateCase("isVector2 accepts finite x and y", isVector2, { x: 1, y: -2.5 }, true),
        predicateCase("isVector2 rejects a non-finite x", isVector2, { x: NaN, y: 0 }, false),
        predicateCase("isRect accepts finite left, top, width, height", isRect, { left: 0, top: 0, width: 10, height: 20 }, true),
        predicateCase("isRect rejects a string height", isRect, { left: 0, top: 0, width: 10, height: "20" }, false),

        // isPointerEventLike
        predicateCase("isPointerEventLike accepts the full shape", isPointerEventLike, pointerEventLike(), true),
        predicateCase("isPointerEventLike rejects a type outside the set", isPointerEventLike, withKey(pointerEventLike(), "type", "click"), false),
        predicateCase("isPointerEventLike rejects a pointerType outside the set", isPointerEventLike, withKey(pointerEventLike(), "pointerType", "stylus"), false),
        predicateCase("isPointerEventLike rejects a missing preventDefault", isPointerEventLike, withKey(pointerEventLike(), "preventDefault"), false),

        // isInputSurface
        predicateCase("isInputSurface accepts the full shape", isInputSurface, inputSurfaceLike(), true),
        predicateCase("isInputSurface accepts absent capture methods", isInputSurface, withKey(withKey(inputSurfaceLike(), "setPointerCapture"), "releasePointerCapture"), true),
        predicateCase("isInputSurface rejects a non-function setPointerCapture", isInputSurface, withKey(inputSurfaceLike(), "setPointerCapture", 1), false),
        predicateCase("isInputSurface rejects a missing getBoundingClientRect", isInputSurface, withKey(inputSurfaceLike(), "getBoundingClientRect"), false),

        // isFrameScheduler, isTimerLike, isFetchResponseLike
        predicateCase("isFrameScheduler accepts a FakeFrameScheduler", isFrameScheduler, new FakeFrameScheduler(), true),
        predicateCase("isFrameScheduler rejects a missing cancel", isFrameScheduler, { request: NOOP }, false),
        predicateCase("isTimerLike accepts a FakeTimer", isTimerLike, new FakeTimer(), true),
        predicateCase("isTimerLike rejects a missing clearTimeout", isTimerLike, { setTimeout: NOOP }, false),
        predicateCase("isFetchResponseLike accepts ok, status and arrayBuffer", isFetchResponseLike, { ok: true, status: 200, arrayBuffer: NOOP }, true),
        predicateCase("isFetchResponseLike rejects a string status", isFetchResponseLike, { ok: true, status: "200", arrayBuffer: NOOP }, false),

        // isScalingMode
        predicateCase("isScalingMode accepts \"fill-height\"", isScalingMode, "fill-height", true),
        predicateCase("isScalingMode rejects \"stretch\"", isScalingMode, "stretch", false),

        // Player and button literals
        predicateCase("isPlayerIndex accepts 4", isPlayerIndex, 4, true),
        predicateCase("isPlayerIndex rejects 0", isPlayerIndex, 0, false),
        predicateCase("isPlayerIndex rejects 5", isPlayerIndex, 5, false),
        predicateCase("isPlayerCount accepts 1", isPlayerCount, 1, true),
        predicateCase("isPlayerCount rejects the string \"1\"", isPlayerCount, "1", false),
        predicateCase("isArcadeDirection accepts \"left\"", isArcadeDirection, "left", true),
        predicateCase("isArcadeDirection rejects \"upleft\"", isArcadeDirection, "upleft", false),
        predicateCase("isArcadeAxisKind accepts a relative axis", isArcadeAxisKind, "spin-x", true),
        predicateCase("isArcadeAxisKind rejects an unbound machine kind", isArcadeAxisKind, "paddle", false),
        predicateCase("isArcadeAxis accepts a player and axis kind", isArcadeAxis, { player: 4, kind: "pedal-2" }, true),
        predicateCase("isArcadeAxis rejects an invalid player", isArcadeAxis, { player: 0, kind: "stick-x" }, false),
        predicateCase("isArcadeAxis rejects an extra field", isArcadeAxis, { player: 1, kind: "stick-x", value: 0 }, false),
        predicateCase("isArcadeButtonIndex accepts 6", isArcadeButtonIndex, 6, true),
        predicateCase("isArcadeButtonIndex rejects 0", isArcadeButtonIndex, 0, false),
        predicateCase("isArcadeButtonIndex rejects 7", isArcadeButtonIndex, 7, false),
        predicateCase("isArcadeButtonIndex rejects 1.5", isArcadeButtonIndex, 1.5, false),
        predicateCase("isArcadeButtonCount accepts 0", isArcadeButtonCount, 0, true),
        predicateCase("isArcadeButtonCount accepts 6", isArcadeButtonCount, 6, true),
        predicateCase("isArcadeButtonCount rejects 7", isArcadeButtonCount, 7, false),
        predicateCase("isArcadeButtonCount rejects -1", isArcadeButtonCount, -1, false),

        // isArcadeControl: every kind with exactly its fields
        predicateCase("isArcadeControl accepts a direction", isArcadeControl, { kind: "direction", player: 1, direction: "up" }, true),
        predicateCase("isArcadeControl accepts a button", isArcadeControl, { kind: "button", player: 4, button: 6 }, true),
        predicateCase("isArcadeControl accepts one stick of a dual-stick board", isArcadeControl, { kind: "stick", player: 2, stick: 1, direction: "left" }, true),
        predicateCase("isArcadeControl accepts a digital pedal", isArcadeControl, { kind: "pedal", player: 1, pedal: 3 }, true),
        predicateCase("isArcadeControl accepts coin", isArcadeControl, { kind: "coin", player: 2 }, true),
        predicateCase("isArcadeControl accepts start", isArcadeControl, { kind: "start", player: 1 }, true),
        predicateCase("isArcadeControl accepts select", isArcadeControl, { kind: "select", player: 1 }, true),
        predicateCase("isArcadeControl accepts service", isArcadeControl, { kind: "service" }, true),
        predicateCase("isArcadeControl accepts test", isArcadeControl, { kind: "test" }, true),
        predicateCase("isArcadeControl accepts tilt", isArcadeControl, { kind: "tilt" }, true),
        predicateCase("isArcadeControl rejects an unknown kind", isArcadeControl, { kind: "jump", player: 1 }, false),
        predicateCase("isArcadeControl rejects a direction with player 0", isArcadeControl, { kind: "direction", player: 0, direction: "up" }, false),
        predicateCase("isArcadeControl rejects a direction outside the set", isArcadeControl, { kind: "direction", player: 1, direction: "north" }, false),
        predicateCase("isArcadeControl rejects a button 7", isArcadeControl, { kind: "button", player: 1, button: 7 }, false),
        predicateCase("isArcadeControl rejects stick 3", isArcadeControl, { kind: "stick", player: 1, stick: 3, direction: "up" }, false),
        predicateCase("isArcadeControl rejects pedal 4", isArcadeControl, { kind: "pedal", player: 1, pedal: 4 }, false),
        predicateCase("isArcadeControl rejects a button with an extra field", isArcadeControl, { kind: "button", player: 1, button: 1, direction: "up" }, false),
        predicateCase("isArcadeControl rejects coin without a player", isArcadeControl, { kind: "coin" }, false),
        predicateCase("isArcadeControl rejects service with a player", isArcadeControl, { kind: "service", player: 1 }, false),
        predicateCase("isArcadeControl rejects null", isArcadeControl, null, false),

        // arcadeControlKey
        {
            label: "arcadeControlKey yields a distinct canonical string per control",
            run: () => CTGTest.init("control keys")
                .assert("keys match the documented forms", () => ([
                    { kind: "direction", player: 1, direction: "up" },
                    { kind: "button", player: 2, button: 3 },
                    { kind: "stick", player: 3, stick: 2, direction: "right" },
                    { kind: "pedal", player: 1, pedal: 2 },
                    { kind: "coin", player: 1 },
                    { kind: "start", player: 4 },
                    { kind: "select", player: 2 },
                    { kind: "service" },
                    { kind: "test" },
                    { kind: "tilt" },
                ] as ArcadeControl[]).map(arcadeControlKey), P.equals<string[]>([
                    "p1:direction:up", "p2:button:3", "p3:stick:2:right", "p1:pedal:2", "p1:coin", "p4:start", "p2:select", "service", "test", "tilt",
                ]))
                .start(undefined),
        },

        // isOrientation, isBiosOption
        predicateCase("isOrientation accepts \"vertical\"", isOrientation, "vertical", true),
        predicateCase("isOrientation rejects \"portrait\"", isOrientation, "portrait", false),
        predicateCase("isBiosOption accepts name, description and isDefault", isBiosOption, { name: "euro", description: "Europe MVS", isDefault: true }, true),
        predicateCase("isBiosOption rejects a non-boolean isDefault", isBiosOption, { name: "euro", description: "Europe MVS", isDefault: "yes" }, false),

        // Machine input discovery
        predicateCase("isMachineAnalogKind accepts every bound family kind", isMachineAnalogKind, "trackball-y", true),
        predicateCase("isMachineAnalogKind accepts a reported unbound kind", isMachineAnalogKind, "lightgun-x", true),
        predicateCase("isMachineAnalogKind rejects an axis-only name", isMachineAnalogKind, "spin-x", false),
        predicateCase("isMachineInputs accepts distinct analog rows", isMachineInputs, { analog: [{ player: 1, kind: "dial" }, { player: 2, kind: "pedal-1" }], dualStick: true }, true),
        predicateCase("isMachineInputs rejects duplicate player-kind rows", isMachineInputs, { analog: [{ player: 1, kind: "dial" }, { player: 1, kind: "dial" }], dualStick: false }, false),
        predicateCase("isMachineInputs rejects an invalid analog kind", isMachineInputs, { analog: [{ player: 1, kind: "spin-x" }], dualStick: false }, false),
        predicateCase("isMachineInputs rejects a non-boolean dual-stick flag", isMachineInputs, { analog: [], dualStick: 0 }, false),

        // isMachineInfo
        predicateCase("isMachineInfo accepts the fixture machine", isMachineInfo, validMachineInfo(), true),
        predicateCase("isMachineInfo accepts a zero-button vertical machine with no BIOS", isMachineInfo, { ...machineLike(), orientation: "vertical", width: 224, height: 288, aspectRatio: 3 / 4, buttons: 0, bios: [] }, true),
        predicateCase("isMachineInfo rejects an empty name", isMachineInfo, withKey(machineLike(), "name", ""), false),
        predicateCase("isMachineInfo rejects a missing family", isMachineInfo, withKey(machineLike(), "family"), false),
        predicateCase("isMachineInfo rejects a non-integer width", isMachineInfo, withKey(machineLike(), "width", 384.5), false),
        predicateCase("isMachineInfo rejects a zero height", isMachineInfo, withKey(machineLike(), "height", 0), false),
        predicateCase("isMachineInfo rejects a zero refreshHz", isMachineInfo, withKey(machineLike(), "refreshHz", 0), false),
        predicateCase("isMachineInfo rejects an orientation outside the set", isMachineInfo, withKey(machineLike(), "orientation", "rotated"), false),
        predicateCase("isMachineInfo rejects a negative aspectRatio", isMachineInfo, withKey(machineLike(), "aspectRatio", -1), false),
        predicateCase("isMachineInfo rejects players 5", isMachineInfo, withKey(machineLike(), "players", 5), false),
        predicateCase("isMachineInfo rejects buttons 7", isMachineInfo, withKey(machineLike(), "buttons", 7), false),
        predicateCase("isMachineInfo rejects missing input discovery", isMachineInfo, withKey(machineLike(), "inputs"), false),
        predicateCase("isMachineInfo rejects a non-array bios", isMachineInfo, withKey(machineLike(), "bios", {}), false),
        predicateCase("isMachineInfo rejects two default BIOS options", isMachineInfo, withKey(machineLike(), "bios", [{ name: "a", description: "A", isDefault: true }, { name: "b", description: "B", isDefault: true }]), false),
        predicateCase("isMachineInfo rejects BIOS names equal after case folding", isMachineInfo, withKey(machineLike(), "bios", [{ name: "Euro", description: "A", isDefault: true }, { name: "euro", description: "B", isDefault: false }]), false),
        predicateCase("isMachineInfo rejects a missing hasNvram", isMachineInfo, withKey(machineLike(), "hasNvram"), false),

        // isFrameEvent, isSoundEvent
        predicateCase("isFrameEvent accepts a 2×2 frame with 16 bytes", isFrameEvent, blankFrame(2, 2), true),
        predicateCase("isFrameEvent rejects a buffer of the wrong length", isFrameEvent, { width: 2, height: 2, rgba: new Uint8ClampedArray(15) }, false),
        predicateCase("isFrameEvent rejects a Uint8Array buffer", isFrameEvent, { width: 1, height: 1, rgba: new Uint8Array(4) }, false),
        predicateCase("isFrameEvent rejects a zero width", isFrameEvent, { width: 0, height: 1, rgba: new Uint8ClampedArray(0) }, false),
        predicateCase("isSoundEvent accepts 4 samples and 2 frames", isSoundEvent, { samples: new Float32Array(4), frames: 2 }, true),
        predicateCase("isSoundEvent rejects an odd sample count", isSoundEvent, { samples: new Float32Array(3), frames: 1 }, false),
        predicateCase("isSoundEvent rejects frames not equal to half the samples", isSoundEvent, { samples: new Float32Array(4), frames: 4 }, false),

        // ROM names, files, roles and sources
        predicateCase("isRomRole accepts \"samples\"", isRomRole, "samples", true),
        predicateCase("isRomRole rejects \"clone\"", isRomRole, "clone", false),
        predicateCase("isRomName accepts \"sf2.zip\"", isRomName, "sf2.zip", true),
        predicateCase("isRomName accepts a name with no extension", isRomName, "neogeo", true),
        predicateCase("isRomName rejects \"\"", isRomName, "", false),
        predicateCase("isRomName rejects a forward-slash path", isRomName, "roms/sf2.zip", false),
        predicateCase("isRomName rejects a backslash path", isRomName, "roms\\sf2.zip", false),
        predicateCase("isRomName rejects \".\"", isRomName, ".", false),
        predicateCase("isRomName rejects \"..\"", isRomName, "..", false),
        predicateCase("isRomName rejects a NUL byte", isRomName, "sf2\0.zip", false),
        predicateCase("isRomFile accepts a name and bytes", isRomFile, { name: "sf2.zip", bytes: new Uint8Array(1) }, true),
        predicateCase("isRomFile rejects an ArrayBuffer for bytes", isRomFile, { name: "sf2.zip", bytes: new ArrayBuffer(1) }, false),
        predicateCase("isRomFile rejects a path name", isRomFile, { name: "../sf2.zip", bytes: new Uint8Array(1) }, false),
        predicateCase("isRomSource accepts a URL string", isRomSource, "roms/sf2.zip", true),
        predicateCase("isRomSource accepts a RomFile", isRomSource, { name: "sf2.zip", bytes: new Uint8Array(1) }, true),
        predicateCase("isRomSource accepts a name and a Blob", isRomSource, { name: "sf2.zip", blob: new Blob([new Uint8Array(1)]) }, true),
        predicateCase("isRomSource rejects an empty string", isRomSource, "", false),
        predicateCase("isRomSource rejects a Blob with a path name", isRomSource, { name: "a/b.zip", blob: new Blob() }, false),
        predicateCase("isRomSource rejects an object with neither bytes nor blob", isRomSource, { name: "sf2.zip" }, false),
        {
            label: "romNameKey folds case so \"SF2.ZIP\" and \"sf2.zip\" compare equal",
            run: () => CTGTest.init("rom name key")
                .assert("keys are equal", () => ({ result: romNameKey("SF2.ZIP") === romNameKey("sf2.zip") }), P.equals<PredicateSnapshot>({ result: true }))
                .start(undefined),
        },

        // isMachineHints, isArcadeOptions
        predicateCase("isMachineHints accepts players 1 and buttons 0", isMachineHints, { players: 1, buttons: 0 }, true),
        predicateCase("isMachineHints rejects players 0", isMachineHints, { players: 0, buttons: 1 }, false),
        predicateCase("isArcadeOptions accepts string, number and boolean values", isArcadeOptions, { a: "x", b: 1, c: true }, true),
        predicateCase("isArcadeOptions rejects an object value", isArcadeOptions, { a: {} }, false),
        predicateCase("isArcadeOptions rejects a NaN value", isArcadeOptions, { a: NaN }, false),

        // isArcadeStartConfig
        predicateCase("isArcadeStartConfig accepts the full shape", isArcadeStartConfig, startConfigLike(), true),
        predicateCase("isArcadeStartConfig accepts the minimal shape", isArcadeStartConfig, { machine: "fake", machineHints: { players: 1, buttons: 0 }, roms: [] }, true),
        predicateCase("isArcadeStartConfig rejects an empty machine", isArcadeStartConfig, withKey(startConfigLike(), "machine", " "), false),
        predicateCase("isArcadeStartConfig rejects missing machineHints", isArcadeStartConfig, withKey(startConfigLike(), "machineHints"), false),
        predicateCase("isArcadeStartConfig rejects a non-array roms", isArcadeStartConfig, withKey(startConfigLike(), "roms", {}), false),
        predicateCase("isArcadeStartConfig rejects a rom that is not a RomFile", isArcadeStartConfig, withKey(startConfigLike(), "roms", [{ name: "a.zip" }]), false),
        predicateCase("isArcadeStartConfig rejects ROM names equal after case folding", isArcadeStartConfig, withKey(startConfigLike(), "roms", [{ name: "A.zip", bytes: new Uint8Array() }, { name: "a.ZIP", bytes: new Uint8Array() }]), false),
        predicateCase("isArcadeStartConfig rejects a non-Uint8Array changes", isArcadeStartConfig, withKey(startConfigLike(), "changes", [1, 2]), false),
        predicateCase("isArcadeStartConfig rejects an empty bios", isArcadeStartConfig, withKey(startConfigLike(), "bios", ""), false),
        predicateCase("isArcadeStartConfig rejects a non-string dipswitch setting", isArcadeStartConfig, withKey(startConfigLike(), "dipswitches", { Lives: 3 }), false),
        predicateCase("isArcadeStartConfig rejects an object option value", isArcadeStartConfig, withKey(startConfigLike(), "options", { a: [] }), false),

        // isArcadeSession, isArcadeAdapter
        predicateCase("isArcadeSession accepts a FakeArcadeSession", isArcadeSession, new FakeArcadeSession(), true),
        predicateCase("isArcadeSession accepts a plain object with every member", isArcadeSession, sessionLike(), true),
        predicateCase("isArcadeSession rejects an invalid machine", isArcadeSession, withKey(sessionLike(), "machine", {}), false),
        predicateCase("isArcadeSession rejects a zero sampleRate", isArcadeSession, withKey(sessionLike(), "sampleRate", 0), false),
        ...SESSION_METHODS.map((method) => predicateCase(`isArcadeSession rejects a missing ${method}`, isArcadeSession, withKey(sessionLike(), method), false)),
        predicateCase("isArcadeAdapter accepts a FakeArcadeAdapter", isArcadeAdapter, new FakeArcadeAdapter(), true),
        predicateCase("isArcadeAdapter rejects an empty type", isArcadeAdapter, { type: "", start: NOOP }, false),
        predicateCase("isArcadeAdapter rejects a missing start", isArcadeAdapter, { type: "mame" }, false),

        // isBuildLicense, isBuildInfo
        predicateCase("isBuildLicense accepts id and notice", isBuildLicense, { id: "MAME", notice: "LICENSE" }, true),
        predicateCase("isBuildLicense rejects an empty notice", isBuildLicense, { id: "MAME", notice: "" }, false),
        predicateCase("isBuildInfo accepts the fixture build", isBuildInfo, validBuildInfo(), true),
        predicateCase("isBuildInfo accepts an empty licence list", isBuildInfo, withKey(buildLike(), "licenses", []), true),
        predicateCase("isBuildInfo rejects formatVersion 2", isBuildInfo, withKey(buildLike(), "formatVersion", 2), false),
        predicateCase("isBuildInfo rejects a short buildId", isBuildInfo, withKey(buildLike(), "buildId", "abc"), false),
        predicateCase("isBuildInfo rejects an upper-case buildId", isBuildInfo, withKey(buildLike(), "buildId", "A".repeat(64)), false),
        predicateCase("isBuildInfo rejects an unknown adapter", isBuildInfo, withKey(buildLike(), "adapter", "fbneo"), false),
        predicateCase("isBuildInfo rejects an empty engine", isBuildInfo, withKey(buildLike(), "engine", ""), false),
        predicateCase("isBuildInfo rejects a missing emulatorVersion", isBuildInfo, withKey(buildLike(), "emulatorVersion"), false),
        predicateCase("isBuildInfo rejects a missing emsdkVersion", isBuildInfo, withKey(buildLike(), "emsdkVersion"), false),
        predicateCase("isBuildInfo rejects an empty machines list", isBuildInfo, withKey(buildLike(), "machines", []), false),
        predicateCase("isBuildInfo rejects duplicate machines", isBuildInfo, withKey(buildLike(), "machines", ["a", "a"]), false),
        predicateCase("isBuildInfo rejects an empty artifacts list", isBuildInfo, withKey(buildLike(), "artifacts", []), false),
        predicateCase("isBuildInfo rejects an empty romsetsUrl", isBuildInfo, withKey(buildLike(), "romsetsUrl", ""), false),
        predicateCase("isBuildInfo rejects memoryPages 0", isBuildInfo, withKey(buildLike(), "memoryPages", 0), false),
        predicateCase("isBuildInfo rejects a licence with no id", isBuildInfo, withKey(buildLike(), "licenses", [{ notice: "x" }]), false),
        predicateCase("isBuildInfo rejects a string pthreads", isBuildInfo, withKey(buildLike(), "pthreads", "false"), false),
    ],
};

export default testFile;
