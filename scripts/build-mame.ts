#!/usr/bin/env -S node --import tsx

// realizes: docs/arcade-runtime-spec.md > §4.1 Build pipeline (build-mame.ts)

// Dependencies:
import { spawnSync } from "node:child_process";                  // Runs unzip, patch, make and emcc
import {
    copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from "node:fs";                                                  // Source tree, patches, artifacts and build.json
import { basename, dirname, join, resolve } from "node:path";    // Repository-relative paths
import { fileURLToPath, pathToFileURL } from "node:url";         // Repository root and direct-execution detection
import { inspectThreading } from "./inspect-mame-threading.js";  // Inherited P6 gate over the linked pair
import {
    buildIdFor,                                                    // Deterministic build identity
    buildInfoFor,                                                  // build.json assembly
    isBuildFile,                                                   // Guards mame/builds/<family>.json
    linkFlagsFor,                                                  // emcc arguments for a family
    MAKE_FLAGS,                                                    // P2 make recipe
    NOTICE_SOURCES,                                                // P1 licence inventory
    parseListFull,                                                 // -listfull parsing
    sha256,                                                        // Patch and target hashing
    TOOLCHAIN_PATCHES,                                             // Build-only patches applied before the production set
    type BuildFile,                                                // Build file shape
} from "./mame-build/buildInfo.js";
import { runMameUnderNode } from "./mame-build/nodeRunner.js";   // -listfull under Node
import { extractRomsets } from "./extract-romsets.js";           // romsets/ generation
import { isBuildInfo } from "../src/shared.types.js";            // Validates what is written

// Type dependencies:
import type { BuildLicense } from "../src/shared.types.js";      // Notice entries in build.json

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: parsed command line
interface Options {
    readonly families: ReadonlyArray<string>;                      // Families to build; empty with all=true means every build file
    readonly all: boolean;                                         // --all
    readonly source: string;                                       // Unpacked source tree
    readonly archive: string;                                      // Source archive used when the tree is absent
    readonly emsdk: string;                                        // emsdk root
    readonly out: string;                                          // dist/mame
    readonly jobs: number;                                         // make -j
    readonly skipBuild: boolean;                                   // Reuse existing artifacts; regenerate metadata only
    readonly skipRomsets: boolean;                                 // Do not run -listxml
}

/**
 *
 * Constants
 *
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");   // Repository root
const USAGE = "Usage: build-mame (--all | <family>...) [--source <dir>] [--archive <zip>] [--emsdk <dir>] [--out <dir>] [--jobs <n>] [--skip-build] [--skip-romsets]";

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Reads a one-line pin file.
const pin = (name: string): string => readFileSync(join(ROOT, "mame", name), "utf8").trim();

// HELPER :: STRING, [STRING], {[STRING]:STRING}?, STRING? -> STRING
// Runs a command, failing loudly with its output on a non-zero exit; returns stdout.
const run = (command: string, args: ReadonlyArray<string>, cwd = ROOT, env: NodeJS.ProcessEnv = process.env): string => {
    const result = spawnSync(command, [...args], { cwd, env, encoding: "utf8", maxBuffer: 1 << 28 });
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? "signal"}):\n${result.stderr}\n${result.stdout}`);
    return result.stdout;
};

// HELPER :: options -> [buildFile]
// Loads and validates the requested build files.
const buildFilesFor = (options: Options): BuildFile[] => {
    const directory = join(ROOT, "mame", "builds");
    const names = options.all
        ? readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).sort()
        : [...options.families];
    return names.map((family) => {
        const path = join(directory, `${family}.json`);
        if (!existsSync(path)) throw new Error(`No build file for family "${family}" at ${path}`);
        const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
        if (!isBuildFile(parsed) || parsed.family !== family) throw new Error(`Invalid build file ${path}`);
        if (!existsSync(join(ROOT, parsed.target)) || !existsSync(join(ROOT, parsed.list))) throw new Error(`Build file ${path} names a missing target pair`);
        return parsed;
    });
};

// HELPER :: options, STRING -> VOID
// Ensures the pinned source tree exists: unpacks the archive (and a nested mame.zip if present) when absent, then checks the version.
const ensureSource = (options: Options, version: string): void => {
    if (!existsSync(join(options.source, "makefile"))) {
        if (!existsSync(options.archive)) throw new Error(`Source tree ${options.source} is absent and archive ${options.archive} does not exist`);
        mkdirSync(options.source, { recursive: true });
        run("unzip", ["-q", "-o", options.archive, "-d", options.source]);
        const nested = join(options.source, "mame.zip");
        if (existsSync(nested)) {
            run("unzip", ["-q", "-o", nested, "-d", options.source]);
            rmSync(nested);
        }
    }
    const versionSource = readFileSync(join(options.source, "src", "version.c"), "utf8");
    const release = version.replace(/^mame0?/, "0.");
    if (!versionSource.includes(release)) throw new Error(`Source tree ${options.source} does not report ${release}`);
};

// HELPER :: STRING, STRING -> VOID
// Applies a patch forward if it is not already applied; a reject is fatal.
const applyPatch = (source: string, patchPath: string): void => {
    const dryForward = spawnSync("patch", ["--dry-run", "--silent", "--forward", "--batch", "-p1", "-d", source, "-i", patchPath]);
    if (dryForward.status === 0) {
        run("patch", ["--silent", "--forward", "--batch", "-p1", "-d", source, "-i", patchPath]);
        return;
    }
    const dryReverse = spawnSync("patch", ["--dry-run", "--silent", "--reverse", "--forward", "--batch", "-p1", "-d", source, "-i", patchPath]);
    if (dryReverse.status !== 0) throw new Error(`Source does not accept ${basename(patchPath)}`);
};

// HELPER :: STRING -> [STRING]
// Toolchain patches followed by every production patch in name order, as repository-relative paths.
const patchListFor = (): string[] => {
    const production = readdirSync(join(ROOT, "mame", "patches")).filter((name) => name.endsWith(".patch")).sort().map((name) => `mame/patches/${name}`);
    return [...TOOLCHAIN_PATCHES, ...production];
};

// HELPER :: options -> {[STRING]:STRING}
// Environment with emsdk activated the way the probe scripts do: emsdk_env.sh sourced, the Python 2 shim first on PATH.
const emscriptenEnvironment = (options: Options, emsdkVersion: string): NodeJS.ProcessEnv => {
    const script = `source "${options.emsdk}/emsdk_env.sh" >/dev/null && export PATH="${join(ROOT, "scripts", "toolchain-shims")}:$PATH" && export EMSCRIPTEN="${options.emsdk}/emscripten/${emsdkVersion}" && env -0`;
    const output = spawnSync("bash", ["-c", script], { encoding: "utf8", maxBuffer: 1 << 24 });
    if (output.status !== 0) throw new Error(`Could not activate emsdk at ${options.emsdk}:\n${output.stderr}`);
    const env: NodeJS.ProcessEnv = {};
    for (const entry of output.stdout.split("\0")) {
        const index = entry.indexOf("=");
        if (index > 0) env[entry.slice(0, index)] = entry.slice(index + 1);
    }
    const version = spawnSync("emcc", ["--version"], { env, encoding: "utf8" });
    if (!(version.stdout + version.stderr).includes(emsdkVersion)) throw new Error(`Expected Emscripten ${emsdkVersion}, got:\n${version.stdout}${version.stderr}`);
    return env;
};

// HELPER :: options, buildFile, {[STRING]:STRING} -> VOID
// Installs the target pair, clears archives that could retain stale members, runs make and links the modularized pair.
const compileFamily = (options: Options, file: BuildFile, env: NodeJS.ProcessEnv): void => {
    const family = file.family;
    copyFileSync(join(ROOT, file.target), join(options.source, "scripts", "target", "mame", `${family}.lua`));
    copyFileSync(join(ROOT, file.list), join(options.source, "src", "mame", `${family}.lst`));
    const project = `mame_${family.replace(/-/g, "_")}`;
    for (const stale of [
        join(options.source, "build", "asmjs", "bin", "libemu.a"),
        join(options.source, "build", "asmjs", "bin", `mame_${family}`, "libbus.a"),
        join(options.source, "build", "asmjs", "bin", `mame_${family}`, "libdasm.a"),
        join(options.source, "build", "asmjs", "bin", `mame_${family}`, `lib${project}.a`),
        join(options.source, "build", "asmjs", "bin", `mame_${family}`, "liboptional.a"),
        join(options.source, `mame${family}.bc`),
    ]) rmSync(stale, { force: true });
    run("make", [`-j${options.jobs}`, `SUBTARGET=${family}`, ...MAKE_FLAGS, "asmjs"], options.source, env);
    const outDirectory = join(options.out, family);
    mkdirSync(outDirectory, { recursive: true });
    run("emcc", [...linkFlagsFor(file.memoryPages), join(options.source, `mame${family}.bc`), "-o", join(outDirectory, `mame${family}.js`)], options.source, env);
};

// HELPER :: options, STRING -> [buildLicense]
// Copies every notice in the P1 inventory beside the artifacts and returns the build.json entries.
const copyNotices = (options: Options, outDirectory: string): BuildLicense[] => {
    const notices = join(outDirectory, "notices");
    mkdirSync(notices, { recursive: true });
    const entries: BuildLicense[] = [];
    for (const notice of NOTICE_SOURCES) {
        const from = notice.from === "source" ? join(options.source, notice.path) : join(options.emsdk, "emscripten", pin("EMSDK_VERSION"), notice.path);
        if (!existsSync(from)) throw new Error(`Licence notice ${notice.id} missing at ${from}`);
        const target = `${notice.id}-${basename(notice.path)}`;
        copyFileSync(from, join(notices, target));
        entries.push({ id: notice.id, notice: `notices/${target}` });
    }
    return entries;
};

// HELPER :: options, buildFile, [STRING] -> PROMISE(VOID)
// Writes build.json for a compiled family: threading gate, machine list from -listfull, deterministic id, notices, romsets.
const describeFamily = async (options: Options, file: BuildFile, patches: ReadonlyArray<string>, versions: { emulator: string; emsdk: string }): Promise<void> => {
    const family = file.family;
    const outDirectory = join(options.out, family);
    const stem = join(outDirectory, `mame${family}`);
    if (!existsSync(`${stem}.js`) || !existsSync(`${stem}.wasm`)) throw new Error(`Missing artifacts for ${family} under ${outDirectory}`);
    const threading = inspectThreading(stem);
    if (threading.requiresPthreads) throw new Error(`${family} artifact requires pthreads; see docs/probes/mame0161/threading-and-hosting.md`);
    const listing = await runMameUnderNode(`${stem}.js`, ["-listfull"]);
    const machines = parseListFull(listing.stdout).map((entry) => entry.name);
    if (machines.length === 0) throw new Error(`-listfull reported no machines for ${family}:\n${listing.stderr.slice(0, 500)}`);
    const licenses = copyNotices(options, outDirectory);
    const buildId = buildIdFor({
        family,
        emulatorVersion: versions.emulator,
        emsdkVersion: versions.emsdk,
        memoryPages: file.memoryPages,
        patches: patches.map((path) => ({ name: basename(path), sha256: sha256(readFileSync(join(ROOT, path))) })),
        target: sha256(readFileSync(join(ROOT, file.target))),
        list: sha256(readFileSync(join(ROOT, file.list))),
        makeFlags: MAKE_FLAGS,
        linkFlags: linkFlagsFor(file.memoryPages),
    });
    const info = buildInfoFor(file, versions.emulator, versions.emsdk, machines, buildId, licenses);
    if (!isBuildInfo(info)) throw new Error(`Assembled build.json for ${family} fails isBuildInfo`);
    writeFileSync(join(outDirectory, "build.json"), `${JSON.stringify(info, null, 2)}\n`);
    const romsets = options.skipRomsets ? 0 : await extractRomsets(family, options.out);
    const wasmBytes = statSync(`${stem}.wasm`).size;
    console.log(`${family}: ${machines.length} machines, ${wasmBytes} wasm bytes, ${romsets} romsets, build ${buildId.slice(0, 12)}`);
};

// HELPER :: [STRING] -> options
// Parses the command line with the defaults §4.1 and mame/README.md document.
const parseOptions = (argv: ReadonlyArray<string>): Options => {
    const args = [...argv];
    const families: string[] = [];
    let all = false;
    let source = join(ROOT, ".cache", "mame", pin("VERSION"));
    let archive = join(ROOT, "res", "mame0161s.zip");
    let emsdk = process.env.EMSDK_DIR ?? join(ROOT, "res", "emsdk");
    let out = join(ROOT, "dist", "mame");
    let jobs = 2;
    let skipBuild = false;
    let skipRomsets = false;
    while (args.length > 0) {
        const arg = args.shift()!;
        const next = (): string => { const value = args.shift(); if (value === undefined) throw new Error(USAGE); return value; };
        if (arg === "--all") all = true;
        else if (arg === "--source") source = resolve(next());
        else if (arg === "--archive") archive = resolve(next());
        else if (arg === "--emsdk") emsdk = resolve(next());
        else if (arg === "--out") out = resolve(next());
        else if (arg === "--jobs") jobs = Number.parseInt(next(), 10);
        else if (arg === "--skip-build") skipBuild = true;
        else if (arg === "--skip-romsets") skipRomsets = true;
        else if (arg.startsWith("--")) throw new Error(USAGE);
        else families.push(arg);
    }
    if ((families.length === 0 && !all) || !Number.isInteger(jobs) || jobs < 1) throw new Error(USAGE);
    return { families, all, source, archive, emsdk, out, jobs, skipBuild, skipRomsets };
};

// HELPER :: [STRING] -> PROMISE(NUMBER)
// Builds every requested family end to end.
export const buildMame = async (argv: ReadonlyArray<string>): Promise<number> => {
    const options = parseOptions(argv);
    const versions = { emulator: pin("VERSION"), emsdk: pin("EMSDK_VERSION") };
    const files = buildFilesFor(options);
    const patches = patchListFor();
    if (!options.skipBuild) {
        ensureSource(options, versions.emulator);
        for (const patch of patches) applyPatch(options.source, join(ROOT, patch));
        const env = emscriptenEnvironment(options, versions.emsdk);
        for (const file of files) compileFamily(options, file, env);
    }
    for (const file of files) await describeFamily(options, file, patches, versions);
    return 0;
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    buildMame(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
