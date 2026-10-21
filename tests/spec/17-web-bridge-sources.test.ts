// realizes: docs/arcade-runtime-spec.md > §4.2–§4.5 production web bridge

// Dependencies:
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from "node:fs";                                                // Reads patches and creates an ignored pristine work tree
import { dirname, join, resolve } from "node:path";              // Resolves repository and extracted source paths
import { spawnSync } from "node:child_process";                  // Applies patches with the system patch tool
import { fileURLToPath } from "node:url";                        // Converts tracked resource URLs to paths
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {sourceRoot:STRING, touched:[STRING]}
// Result of applying all production patches to a pristine source unpack.
interface AppliedPatchSet {
    readonly sourceRoot: string;
    readonly touched: readonly string[];
}

/**
 *
 * Constants
 *
 */

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PATCH_ROOT = join(REPOSITORY_ROOT, "mame", "patches");
const BRIDGE_ROOT = join(REPOSITORY_ROOT, "mame", "bridge");
const CACHE_ROOT = join(REPOSITORY_ROOT, ".cache");
const DEFAULT_ARCHIVE = join(REPOSITORY_ROOT, "res", "mame0161s.zip");
const SOURCE_ARCHIVE = process.env.MAME0161_SOURCE_ARCHIVE === undefined
    ? (existsSync(DEFAULT_ARCHIVE) ? DEFAULT_ARCHIVE : undefined)
    : resolve(process.env.MAME0161_SOURCE_ARCHIVE);

const PATCH_NAMES = [
    "0001-web-osd-modules.patch",
    "0002-web-bridge-exports.patch",
    "0003-nvram-flush.patch",
] as const;

const BRIDGE_NAMES = [
    "web_video.cpp",
    "web_sound.cpp",
    "web_input.cpp",
    "web_bridge.cpp",
    "web_bridge.h",
] as const;

const EXPECTED_TOUCHED_FILES = [
    "scripts/src/osd/modules.lua",
    "src/emu/clifront.c",
    "src/emu/machine.c",
    "src/emu/machine.h",
    "src/emu/mame.c",
    "src/emu/schedule.c",
    "src/osd/modules/lib/osdobj_common.c",
    "src/osd/modules/web/web_bridge.cpp",
    "src/osd/modules/web/web_bridge.h",
    "src/osd/modules/web/web_input.cpp",
    "src/osd/modules/web/web_sound.cpp",
    "src/osd/modules/web/web_video.cpp",
    "src/osd/sdl/input.c",
    "src/osd/sdl/sdlmain.c",
    "src/osd/sdl/video.c",
] as const;

const EXPECTED_INPUT_ITEMS = [
    "ITEM_ID_HAT1UP",
    "ITEM_ID_HAT1DOWN",
    "ITEM_ID_HAT1LEFT",
    "ITEM_ID_HAT1RIGHT",
    "ITEM_ID_BUTTON1",
    "ITEM_ID_BUTTON2",
    "ITEM_ID_BUTTON3",
    "ITEM_ID_BUTTON4",
    "ITEM_ID_BUTTON5",
    "ITEM_ID_BUTTON6",
    "ITEM_ID_BUTTON7",
    "ITEM_ID_BUTTON8",
    "ITEM_ID_BUTTON9",
    "ITEM_ID_BUTTON10",
    "ITEM_ID_BUTTON11",
    "ITEM_ID_BUTTON12",
] as const;

const EXPECTED_EXPORTS = [
    "web_exit",
    "web_flush_nvram",
    "web_load_state",
    "web_machine_info",
    "web_pause",
    "web_pump",
    "web_reset",
    "web_resume",
    "web_run_frames",
    "web_save_state",
    "web_set_control",
] as const;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Reads a production patch by basename.
const readPatch = (name: string): string => readFileSync(join(PATCH_ROOT, name), "utf8");

// HELPER :: STRING, [STRING], STRING -> VOID
// Runs a required local command and preserves its diagnostic on failure.
const command = (executable: string, args: readonly string[], cwd: string): void => {
    const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`${executable} failed: ${result.stderr || result.stdout}`);
    }
};

// HELPER :: STRING, (STRING -> BOOLEAN) -> STRING?
// Finds the first matching file below a trusted extracted source archive.
const findFile = (root: string, predicate: (path: string) => boolean): string | undefined => {
    for (const name of readdirSync(root)) {
        const path = join(root, name);
        if (statSync(path).isDirectory()) {
            const nested = findFile(path, predicate);
            if (nested !== undefined) return nested;
        } else if (predicate(path)) {
            return path;
        }
    }
    return undefined;
};

let appliedPatchSet: AppliedPatchSet | undefined;
let extractedRoot: string | undefined;

// HELPER :: VOID -> appliedPatchSet
// Unpacks the official source archive and applies the three patches in order.
const applyPatchSet = (): AppliedPatchSet => {
    if (appliedPatchSet !== undefined) return appliedPatchSet;
    if (SOURCE_ARCHIVE === undefined) throw new Error("MAME 0.161 source archive is unavailable");

    extractedRoot = mkdtempSync(join(CACHE_ROOT, "w3-patch-test-"));
    command("unzip", ["-q", SOURCE_ARCHIVE, "-d", extractedRoot], REPOSITORY_ROOT);

    const isMameRootMakefile = (path: string): boolean => path.endsWith("/makefile")
        && existsSync(join(dirname(path), "src", "emu", "machine.c"));
    let sourceRoot = dirname(findFile(extractedRoot, isMameRootMakefile) ?? "");
    if (!existsSync(join(sourceRoot, "makefile"))) {
        const nestedArchive = findFile(extractedRoot, (path) => path.endsWith(".zip"));
        if (nestedArchive === undefined) throw new Error("Source archive contains neither makefile nor nested zip");
        sourceRoot = join(extractedRoot, "source");
        command("unzip", ["-q", nestedArchive, "-d", sourceRoot], REPOSITORY_ROOT);
        const makefile = findFile(sourceRoot, isMameRootMakefile);
        if (makefile === undefined) throw new Error("Nested source archive contains no MAME makefile");
        sourceRoot = dirname(makefile);
    }

    for (const patchName of PATCH_NAMES) {
        command("patch", ["--batch", "--forward", "-p1", "-i", join(PATCH_ROOT, patchName)], sourceRoot);
    }

    const touched = [...new Set(PATCH_NAMES.flatMap((name) =>
        [...readPatch(name).matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1]!)))].sort();
    appliedPatchSet = { sourceRoot, touched };
    return appliedPatchSet;
};

process.once("exit", () => {
    if (extractedRoot !== undefined) rmSync(extractedRoot, { recursive: true, force: true });
});

// HELPER :: VOID -> [STRING]
// Reads the exact item-id sequence from the reviewable input source.
const inputItems = (): string[] => {
    const source = readFileSync(join(BRIDGE_ROOT, "web_input.cpp"), "utf8");
    const initializer = /static const input_item_id item_ids\[WEB_CONTROL_COUNT\]\s*=\s*\{([\s\S]*?)\};/.exec(source)?.[1] ?? "";
    return [...initializer.matchAll(/ITEM_ID_[A-Z0-9]+/g)].map((match) => match[0]);
};

// HELPER :: VOID -> [STRING]
// Reads every JavaScript-facing keepalive export from the final bridge copy.
const bridgeExports = (): string[] => {
    const source = readFileSync(join(BRIDGE_ROOT, "web_bridge.cpp"), "utf8");
    return [...source.matchAll(/EMSCRIPTEN_KEEPALIVE\s+(?:(?:const char \*\s*)|(?:int\s+)|(?:void\s+))(web_[a-z_]+)\s*\(/g)]
        .map((match) => match[1]!)
        .sort();
};

const testFile: TestFile = {
    label: "MAME 0.161 production web bridge sources",
    skip: SOURCE_ARCHIVE === undefined
        ? "set MAME0161_SOURCE_ARCHIVE or place mame0161s.zip under res/ to run the pristine patch test"
        : undefined,
    cases: [
        {
            label: "applies all three patches to a pristine source unpack",
            run: () => CTGTest.init("production patch application")
                .assert(
                    "patches touch only the reviewed source list",
                    () => applyPatchSet().touched,
                    P.equals<readonly string[]>([...EXPECTED_TOUCHED_FILES]),
                )
                .assert(
                    "the applied bridge files equal their review copies",
                    () => BRIDGE_NAMES.every((name) =>
                        readFileSync(join(applyPatchSet().sourceRoot, "src", "osd", "modules", "web", name), "utf8")
                        === readFileSync(join(BRIDGE_ROOT, name), "utf8")),
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "carries the exact export, callback and virtual-pad contracts",
            run: () => CTGTest.init("bridge source contract")
                .assert(
                    "production sources contain no diagnostic probe markers",
                    () => [...PATCH_NAMES.map(readPatch), ...BRIDGE_NAMES.map((name) =>
                        readFileSync(join(BRIDGE_ROOT, name), "utf8"))]
                        .every((source) => !source.includes("MAME_PROBE_")),
                    P.equals(true),
                )
                .assert("keepalive exports match §4.3.1", bridgeExports, P.equals<readonly string[]>(EXPECTED_EXPORTS))
                .assert("input items match the §4.4 row order", inputItems, P.equals<readonly string[]>(EXPECTED_INPUT_ITEMS))
                .assert(
                    "four pads use the stable Web Pad names",
                    () => {
                        const source = readFileSync(join(BRIDGE_ROOT, "web_input.cpp"), "utf8");
                        return source.includes("pad < 4") && source.includes("\"Web Pad %d\", pad + 1");
                    },
                    P.equals(true),
                )
                .assert(
                    "all callbacks are read from Module.web and no M11 axis export leaks into M1",
                    () => {
                        const source = readFileSync(join(BRIDGE_ROOT, "web_bridge.cpp"), "utf8");
                        return ["onTick", "onFrame", "onSound", "onStateDone", "onExit", "onFrontendDone", "onLog"]
                            .every((name) => source.includes(`web['${name}']`))
                            && !source.includes("web_set_axis");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
