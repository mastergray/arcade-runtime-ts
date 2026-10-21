// realizes: docs/arcade-runtime-spec.md > §4.1 Build pipeline (build files, link flags, build.json identity)

// Dependencies:
import { createHash } from "node:crypto";                        // Deterministic build identity

// Type dependencies:
import type { BuildInfo, BuildLicense } from "../../src/shared.types.js";   // Shape written to build.json

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: one mame/builds/<family>.json
// Family id, its committed target pair, fixed memory and the informational source list.
export interface BuildFile {
    readonly family: string;                                       // SUBTARGET and target-pair basename, e.g. "neogeo"
    readonly target: string;                                       // Repository-relative Lua path
    readonly list: string;                                         // Repository-relative .lst path
    readonly memoryPages: number;                                  // Fixed Wasm memory in 64 KiB pages
    readonly sources: ReadonlyArray<string>;                       // Informational driver units; the Lua is authoritative
}

// INTERFACE :: everything that feeds the deterministic build id
// Timestamps and absolute paths are deliberately absent.
export interface BuildIdentity {
    readonly family: string;                                       // Family id
    readonly emulatorVersion: string;                              // mame/VERSION
    readonly emsdkVersion: string;                                 // mame/EMSDK_VERSION
    readonly memoryPages: number;                                  // Fixed memory
    readonly patches: ReadonlyArray<{ readonly name: string; readonly sha256: string }>;   // Applied patches in order
    readonly target: string;                                       // SHA-256 of the Lua
    readonly list: string;                                         // SHA-256 of the .lst
    readonly makeFlags: ReadonlyArray<string>;                     // make variables
    readonly linkFlags: ReadonlyArray<string>;                     // emcc arguments
}

// INTERFACE :: {name:STRING, description:STRING}
// One line of -listfull output.
export interface ListFullEntry {
    readonly name: string;                                         // Machine short name
    readonly description: string;                                  // Full title
}

/**
 *
 * Constants
 *
 */

export const FAMILY_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;        // Lower-case words joined by single hyphens

// Runtime methods the adapter calls through the module (§4.3.1), exactly as mame/bridge/README.md links them.
export const EXPORTED_RUNTIME_METHODS: ReadonlyArray<string> = ["FS", "callMain", "cwrap", "ccall", "UTF8ToString", "HEAPU8", "HEAPF32"];

// C exports the bridge keeps alive (§4.3.1), exactly as mame/bridge/README.md links them.
export const EXPORTED_FUNCTIONS: ReadonlyArray<string> = [
    "_main", "_web_run_frames", "_web_pump", "_web_set_control", "_web_pause", "_web_resume", "_web_reset",
    "_web_save_state", "_web_load_state", "_web_flush_nvram", "_web_exit", "_web_machine_info",
];

// make variables the P2 recipe established for the release's asmjs path; jobs are added by the caller.
export const MAKE_FLAGS: ReadonlyArray<string> = [
    "OSD=sdl", "TARGETOS=asmjs", "PYTHON_EXECUTABLE=python2", "REGENIE=1", "NOWERROR=1",
    "USE_BGFX=0", "NOASM=1", "FORCE_DRC_C_BACKEND=1", "NO_OPENGL=1", "NO_USE_MIDI=1", "DONT_USE_NETWORK=1",
];

// Build-only patches every browser build of the pinned release needs before the production set (§4.1).
export const TOOLCHAIN_PATCHES: ReadonlyArray<string> = [
    "mame/probes/patches/0001-emscripten-1.38.31-compatibility.patch",
    "mame/probes/patches/0005-emscripten-disable-mongoose.patch",
];

// Licence notices copied beside every family's artifacts (P1 inventory), as repository-relative source paths.
export const NOTICE_SOURCES: ReadonlyArray<{ readonly id: string; readonly path: string; readonly from: "source" | "emsdk" }> = [
    { id: "MAME", path: "docs/license.txt", from: "source" },
    { id: "MAME-licenseinfo", path: "docs/licenseinfo.txt", from: "source" },
    { id: "Expat", path: "3rdparty/expat/COPYING", from: "source" },
    { id: "SoftFloat", path: "3rdparty/softfloat/README.txt", from: "source" },
    { id: "IJG-JPEG", path: "3rdparty/libjpeg/README", from: "source" },
    { id: "FLAC", path: "3rdparty/libflac/COPYING.Xiph", from: "source" },
    { id: "LZMA-SDK", path: "3rdparty/lzma/7zC.txt", from: "source" },
    { id: "Lua", path: "3rdparty/lua/src/lua.h", from: "source" },
    { id: "LuaSQLite3", path: "3rdparty/lsqlite3/lsqlite3.c", from: "source" },
    { id: "SQLite3", path: "3rdparty/sqlite3/sqlite3.h", from: "source" },
    { id: "zlib", path: "3rdparty/zlib/zlib.h", from: "source" },
    { id: "JsonCpp", path: "3rdparty/jsoncpp/LICENSE", from: "source" },
    { id: "Emscripten", path: "LICENSE", from: "emsdk" },
];

const LISTFULL_LINE = /^(\S+)\s+"(.*)"\s*$/;                        // name "description"

/**
 *
 * Functions
 *
 */

// HELPER :: Uint8Array | STRING -> STRING
// Lower-case hex SHA-256 of bytes or UTF-8 text.
export const sha256 = (input: Uint8Array | string): string => createHash("sha256").update(input).digest("hex");

// HELPER :: NUMBER -> [STRING]
// The emcc arguments for a family link at the given fixed memory: the mame/bridge/README.md link contract, in order.
export const linkFlagsFor = (memoryPages: number): string[] => [
    "-O2",
    "-s", "WASM=1",
    "-s", "USE_SDL=2",
    "-s", "MODULARIZE=1",
    "-s", "EXPORT_NAME=\"createMame\"",
    "-s", `TOTAL_MEMORY=${memoryPages * 65536}`,
    "-s", "ALLOW_MEMORY_GROWTH=0",
    "-s", "NO_EXIT_RUNTIME=1",
    "-s", "DISABLE_EXCEPTION_CATCHING=0",
    "-s", "USE_PTHREADS=0",
    "-s", `EXTRA_EXPORTED_RUNTIME_METHODS=${JSON.stringify(EXPORTED_RUNTIME_METHODS)}`,
    "-s", `EXPORTED_FUNCTIONS=${JSON.stringify(EXPORTED_FUNCTIONS)}`,
];

// HELPER :: buildIdentity -> STRING
// Deterministic SHA-256 over the normalized identity; equal inputs give equal ids regardless of key order.
export const buildIdFor = (identity: BuildIdentity): string => {
    const normalized = {
        family: identity.family,
        emulatorVersion: identity.emulatorVersion,
        emsdkVersion: identity.emsdkVersion,
        memoryPages: identity.memoryPages,
        patches: identity.patches.map(({ name, sha256: hash }) => ({ name, sha256: hash })),
        target: identity.target,
        list: identity.list,
        makeFlags: [...identity.makeFlags],
        linkFlags: [...identity.linkFlags],
    };
    return sha256(JSON.stringify(normalized));
};

// HELPER :: STRING -> [listFullEntry]
// Parses -listfull output; the header line and anything not of the form `name "description"` is ignored.
export const parseListFull = (output: string): ListFullEntry[] => output
    .split(/\r?\n/)
    .map((line) => LISTFULL_LINE.exec(line))
    .filter((match): match is RegExpExecArray => match !== null && match[1] !== "Name:")
    .map((match) => ({ name: match[1]!, description: match[2]! }));

// HELPER :: buildFile, STRING, STRING, [STRING], STRING, [buildLicense] -> buildInfo
// Assembles build.json from the build file, pins, discovered machines, the computed id and the copied notices.
export const buildInfoFor = (
    file: BuildFile,
    emulatorVersion: string,
    emsdkVersion: string,
    machines: ReadonlyArray<string>,
    buildId: string,
    licenses: ReadonlyArray<BuildLicense>,
): BuildInfo => ({
    formatVersion: 1,
    buildId,
    adapter: "mame",
    engine: file.family,
    emulatorVersion,
    emsdkVersion,
    machines: [...machines],
    artifacts: [`mame${file.family}.js`, `mame${file.family}.wasm`],
    romsetsUrl: "romsets/",
    memoryPages: file.memoryPages,
    licenses: [...licenses],
    pthreads: false,
});

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a build file whose target and list paths name the family and whose memoryPages is a positive integer.
export function isBuildFile(value: unknown): value is BuildFile {
    if (typeof value !== "object" || value === null) return false;
    const file = value as BuildFile;
    return typeof file.family === "string" && FAMILY_ID_PATTERN.test(file.family)
        && file.target === `mame/targets/${file.family}.lua`
        && file.list === `mame/targets/${file.family}.lst`
        && Number.isInteger(file.memoryPages) && file.memoryPages > 0
        && Array.isArray(file.sources) && file.sources.every((source) => typeof source === "string" && source.startsWith("src/mame/"));
}
