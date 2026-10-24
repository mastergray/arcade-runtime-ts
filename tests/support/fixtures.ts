// Type dependencies:
import type {
    ArcadeRuntimeError,                                            // Narrowed by errorSnapshot()
    BuildInfo,                                                     // Shape of validBuildInfo()
    MachineInfo,                                                   // Shape of validMachineInfo()
} from "../../src/index.ts";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {isRuntimeError:BOOLEAN, code:NUMBER?, label:STRING?}
// Plain-data view of a thrown value for equals comparison.
export interface ErrorSnapshot {
    isRuntimeError: boolean;                                       // Whether ArcadeRuntimeError.is(value) held
    code: number | null;                                           // error.code when it is a runtime error, else null
    label: string | null;                                          // error.label when it is a runtime error, else null
}

/**
 *
 * Functions
 *
 */

// HELPER :: (VOID -> UNKNOWN) -> UNKNOWN
// Calls fn and returns what it threw, or undefined when it did not throw.
export const thrownBy = (fn: () => unknown): unknown => {
    try {
        fn();
        return undefined;
    } catch (error) {
        return error;
    }
};

// HELPER :: PROMISE(UNKNOWN) -> PROMISE(UNKNOWN)
// Awaits promise and resolves with what it rejected with, or undefined when it resolved.
export const rejectedBy = async (promise: Promise<unknown>): Promise<unknown> => {
    try {
        await promise;
        return undefined;
    } catch (error) {
        return error;
    }
};

// HELPER :: UNKNOWN, CONSTRUCTOR(arcadeRuntimeError) & {is:(UNKNOWN -> BOOLEAN)} -> errorSnapshot
// Reduces a thrown value to its runtime-error identity, code and label for equals comparison.
// NOTE: The class is passed in rather than imported so this file has no runtime import of src/.
export const errorSnapshot = (value: unknown, errorClass: { is(value: unknown): value is ArcadeRuntimeError }): ErrorSnapshot =>
    errorClass.is(value)
        ? { isRuntimeError: true, code: value.code, label: value.label }
        : { isRuntimeError: false, code: null, label: null };

// HELPER :: {[STRING]:UNKNOWN}, STRING, UNKNOWN? -> {[STRING]:UNKNOWN}
// Copies object with key replaced by value, or removed when value is not given.
export const withKey = (object: Record<string, unknown>, key: string, ...value: [unknown?]): Record<string, unknown> => {
    const copy = { ...object };
    if (value.length === 0) delete copy[key];
    else copy[key] = value[0];
    return copy;
};

// HELPER :: VOID -> machineInfo
// A MachineInfo meeting every isMachineInfo condition: a horizontal, 4:3, two-player six-button machine with one default BIOS.
export const validMachineInfo = (): MachineInfo => ({
    name: "fake",
    description: "Fake Machine",
    family: "fake-family",
    width: 384,
    height: 224,
    refreshHz: 59.637,
    orientation: "horizontal",
    aspectRatio: 4 / 3,
    players: 2,
    buttons: 6,
    inputs: { analog: [], dualStick: false, keys: [], volume: false },
    bios: [{ name: "default", description: "Default BIOS", isDefault: true }],
    hasNvram: true,
    supportsSave: true,
});

// HELPER :: VOID -> buildInfo
// A BuildInfo meeting every isBuildInfo condition.
export const validBuildInfo = (): BuildInfo => ({
    formatVersion: 1,
    buildId: "0".repeat(64),
    adapter: "mame",
    engine: "fake-family",
    emulatorVersion: "mame0161",
    emsdkVersion: "1.38.31",
    machines: ["fake", "fakeclone"],
    artifacts: ["mamefake.js", "mamefake.wasm"],
    romsetsUrl: "romsets/",
    memoryPages: 4096,
    licenses: [{ id: "MAME", notice: "LICENSE.mame" }],
    pthreads: false,
});

// HELPER :: NUMBER, NUMBER -> {width:NUMBER, height:NUMBER, rgba:Uint8ClampedArray}
// A FrameEvent of the given size filled with opaque black.
export const blankFrame = (width: number, height: number): { width: number; height: number; rgba: Uint8ClampedArray } => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    return { width, height, rgba };
};
