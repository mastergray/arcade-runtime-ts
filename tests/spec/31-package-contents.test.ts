// realizes: docs/arcade-runtime-spec.md > §1.4 Public package surface; §14 build suite; §14.1 Release gates

// Dependencies:
import { spawnSync } from "node:child_process";                   // Builds, packs, extracts and executes the staged package
import { randomBytes } from "node:crypto";                       // Gives the synthetic archive a non-recorded identity
import {
    cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";                                                 // Creates an isolated package tree and synthetic audit input
import { tmpdir } from "node:os";                                // Keeps all generated package output away from shared dist/
import { dirname, join, resolve } from "node:path";              // Resolves staged package paths
import { fileURLToPath } from "node:url";                        // Converts the repository URL for filesystem operations
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import { zipSync } from "fflate";                                // Builds the synthetic ROM-set archive

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: package.json fields used by the isolated release proposal
interface PackageManifest {
    readonly name?: string;
    readonly version?: string;
    readonly private?: boolean;
    readonly bin?: Readonly<Record<string, string>>;
    readonly scripts?: Readonly<Record<string, string>>;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
    readonly files?: ReadonlyArray<string>;
}

// INTERFACE :: npm pack --json entry
interface PackResult {
    readonly filename: string;
    readonly files: ReadonlyArray<{ readonly path: string }>;
}

// INTERFACE :: values asserted after the tarball and its bin have been exercised
interface PackageInspection {
    readonly files: ReadonlyArray<string>;
    readonly manifest: PackageManifest;
    readonly binStatus: number | null;
    readonly binStdout: string;
    readonly binStderr: string;
}

/**
 *
 * Constants
 *
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root
const SOURCE_MANIFEST = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as PackageManifest;
const NPM_PROBE = spawnSync("npm", ["--version"], { encoding: "utf8" });
const NPM_AVAILABLE = NPM_PROBE.status === 0
    && NPM_PROBE.error === undefined
    && typeof NPM_PROBE.stdout === "string"
    && NPM_PROBE.stdout.trim().length > 0;
const BUILD_PACKAGE_AVAILABLE = typeof SOURCE_MANIFEST.scripts?.["build:package"] === "string";
const RELEASE_FILES = ["dist", "!dist/mame", "src", "scripts/audit-roms.ts", "LICENSE", "README.md"] as const;
const REQUIRED_FILES = [
    "LICENSE", "README.md", "package.json", "dist/index.js", "dist/index.d.ts", "scripts/audit-roms.ts", "src/index.ts",
    "src/ArcadeRuntimeError/ArcadeRuntimeError.ts", "src/RomSetAudit/RomSetAudit.ts", "src/RomSetAudit/types.ts", "src/shared.types.ts",
] as const;
const FORBIDDEN_PREFIXES = ["res/", "harness/", "tests/", "docs/probes/", ".cache/", "dist/mame/", "mame/probes/", "manifests/"] as const;
const FORBIDDEN_EXTENSION = /\.(?:wasm|zip|bc|sta)$/i;
const BIN_NAME = "arcade-audit-roms";
const SYNTHETIC_MACHINE = "synthetic-machine";
const SYNTHETIC_ARCHIVE = "synthetic-set.zip";
const SYNTHETIC_ENTRY = "payload.bin";

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, [STRING], STRING, {[STRING]:STRING}? -> STRING
// Runs one release command and throws with its captured output when it fails.
const run = (command: string, args: ReadonlyArray<string>, cwd: string, env: NodeJS.ProcessEnv = process.env): string => {
    const result = spawnSync(command, [...args], { cwd, env, encoding: "utf8", maxBuffer: 1 << 24 });
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? "signal"}):\n${result.stderr}\n${result.stdout}`);
    return result.stdout;
};

// HELPER :: UINT8ARRAY -> STRING
// Computes the expected CRC32 at run time so no archive identity is committed.
const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

// HELPER :: STRING -> VOID
// Adds content that release packaging must reject, including a stand-in family output below dist/mame/.
const addForbiddenSentinels = (directory: string): void => {
    for (const path of ["res", "harness", "tests", "docs/probes", ".cache", "mame/probes", "manifests/shell"]) {
        mkdirSync(join(directory, path), { recursive: true });
        writeFileSync(join(directory, path, "release-sentinel.txt"), "not package content\n");
    }
    const emulatorOutput = join(directory, "dist", "mame", "synthetic-family");
    mkdirSync(emulatorOutput, { recursive: true });
    for (const name of ["emulator.js", "emulator.wasm", "content.zip", "object.bc", "archive.sta"]) {
        writeFileSync(join(emulatorOutput, name), "not package content\n");
    }
};

// HELPER :: STRING -> packageManifest
// Applies the package.json lines reserved for the integrator to the isolated copy under test.
const stageReleaseManifest = (directory: string): PackageManifest => {
    const tsxVersion = SOURCE_MANIFEST.devDependencies?.tsx ?? SOURCE_MANIFEST.dependencies?.tsx;
    if (tsxVersion === undefined) throw new Error("The TypeScript bin decision requires a declared tsx version");
    const dependencies = { ...SOURCE_MANIFEST.dependencies, tsx: tsxVersion };
    const devDependencies = { ...SOURCE_MANIFEST.devDependencies };
    delete devDependencies.tsx;
    const manifest: PackageManifest = {
        ...SOURCE_MANIFEST,
        version: "1.0.0",
        bin: { [BIN_NAME]: "./scripts/audit-roms.ts" },
        files: [...RELEASE_FILES],
        dependencies,
        devDependencies,
    };
    delete (manifest as { private?: boolean }).private;
    writeFileSync(join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
};

// HELPER :: STRING -> {romsets:STRING, archive:STRING}
// Writes one valid, complete synthetic set for the packed CLI.
const writeSyntheticRomset = (directory: string): { readonly romsets: string; readonly archive: string } => {
    const payload = new Uint8Array(randomBytes(32));
    const romsets = join(directory, "synthetic-romsets");
    const archives = join(directory, "synthetic-archives");
    mkdirSync(romsets, { recursive: true });
    mkdirSync(archives, { recursive: true });
    writeFileSync(join(romsets, `${SYNTHETIC_MACHINE}.json`), `${JSON.stringify({
        machine: SYNTHETIC_MACHINE,
        family: "synthetic-family",
        description: "Synthetic package-bin fixture",
        cloneof: null,
        romof: null,
        bios: [],
        sampleof: null,
        archives: [{ name: SYNTHETIC_ARCHIVE, role: "game" }],
        roms: [{ name: SYNTHETIC_ENTRY, size: payload.length, crc: crc32(payload), sha1: null, archive: SYNTHETIC_ARCHIVE, optional: false }],
        samples: [],
    }, null, 2)}\n`);
    const archive = join(archives, SYNTHETIC_ARCHIVE);
    writeFileSync(archive, zipSync({ [SYNTHETIC_ENTRY]: payload }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }));
    return { romsets, archive };
};

// HELPER :: VOID -> PROMISE(packageInspection)
// Builds and packs only inside /tmp, then runs the bin from the unpacked tarball with its declared dependencies available.
const inspectPackage = async (): Promise<PackageInspection> => {
    const temporary = mkdtempSync(join(tmpdir(), "arcade-runtime-package-"));
    try {
        for (const path of ["src", "LICENSE", "README.md", "package.json", "tsconfig.json", "tsconfig.package.json"]) {
            cpSync(join(ROOT, path), join(temporary, path), { recursive: true });
        }
        mkdirSync(join(temporary, "scripts"), { recursive: true });
        cpSync(join(ROOT, "scripts", "audit-roms.ts"), join(temporary, "scripts", "audit-roms.ts"));
        cpSync(join(ROOT, "scripts", "clean-dist.mjs"), join(temporary, "scripts", "clean-dist.mjs"));
        symlinkSync(join(ROOT, "node_modules"), join(temporary, "node_modules"), "dir");
        stageReleaseManifest(temporary);

        const npmEnvironment = { ...process.env, npm_config_cache: join(temporary, "npm-cache") };
        run("npm", ["run", "build:package"], temporary, npmEnvironment);
        addForbiddenSentinels(temporary);

        const packs = join(temporary, "packs");
        mkdirSync(packs);
        const packOutput = run("npm", ["pack", "--json", "--pack-destination", packs], temporary, npmEnvironment);
        let packed: PackResult[];
        try {
            packed = JSON.parse(packOutput) as PackResult[];
        } catch (error) {
            throw new Error(`npm pack did not return JSON: ${JSON.stringify(packOutput)}`, { cause: error });
        }
        const result = packed[0];
        if (result === undefined) throw new Error("npm pack returned no tarball");

        const unpacked = join(temporary, "unpacked");
        mkdirSync(unpacked);
        run("tar", ["-xzf", join(packs, result.filename), "-C", unpacked], temporary);
        const packageRoot = join(unpacked, "package");
        symlinkSync(join(ROOT, "node_modules"), join(packageRoot, "node_modules"), "dir");
        const packedManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as PackageManifest;
        const binTarget = packedManifest.bin?.[BIN_NAME];
        if (binTarget === undefined) throw new Error(`Packed package does not declare ${BIN_NAME}`);
        const binPath = resolve(packageRoot, binTarget);
        if (!binPath.startsWith(`${packageRoot}/`) || !existsSync(binPath)) throw new Error(`Packed bin target is missing or escapes the package: ${binTarget}`);

        const synthetic = writeSyntheticRomset(temporary);
        const bin = spawnSync(binPath, ["--json", synthetic.romsets, SYNTHETIC_MACHINE, synthetic.archive], {
            cwd: packageRoot,
            env: process.env,
            encoding: "utf8",
            maxBuffer: 1 << 20,
        });
        return {
            files: result.files.map((file) => file.path).sort((a, b) => a.localeCompare(b)),
            manifest: packedManifest,
            binStatus: bin.status,
            binStdout: bin.stdout.trim(),
            binStderr: bin.stderr.trim(),
        };
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
};

let inspection: Promise<PackageInspection> | undefined;
const packageInspection = (): Promise<PackageInspection> => inspection ??= inspectPackage();

const testFile: TestFile = {
    label: "release package contents and published bin",
    skip: !NPM_AVAILABLE
        ? "npm is unavailable to the test process, so the isolated build and pack gate cannot run"
        : !BUILD_PACKAGE_AVAILABLE
            ? "package.json has no build:package script; the integrator must add it before this gate can run"
            : undefined,
    cases: [
        {
            label: "the isolated tarball contains the library, declarations, sources and audit bin but no private or emulator output",
            run: () => CTGTest.init("npm package contents")
                .stage("build and pack an isolated release tree", () => packageInspection())
                .assert("required and forbidden paths", (state) => ({
                    required: REQUIRED_FILES.every((path) => state.subject.files.includes(path)),
                    compiledJavaScript: state.subject.files.some((path) => path.startsWith("dist/") && path.endsWith(".js")),
                    declarations: state.subject.files.some((path) => path.startsWith("dist/") && path.endsWith(".d.ts")),
                    forbiddenPrefix: state.subject.files.some((path) => FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))),
                    forbiddenExtension: state.subject.files.some((path) => FORBIDDEN_EXTENSION.test(path)),
                }), P.equals<{ required: boolean; compiledJavaScript: boolean; declarations: boolean; forbiddenPrefix: boolean; forbiddenExtension: boolean }>({
                    required: true,
                    compiledJavaScript: true,
                    declarations: true,
                    forbiddenPrefix: false,
                    forbiddenExtension: false,
                }))
                .start(undefined, { timeout: 30_000 }),
        },
        {
            label: "the TypeScript bin declares tsx as a runtime dependency and audits a synthetic set from the packed artifact",
            run: () => CTGTest.init("packed audit bin")
                .stage("use the packed artifact", () => packageInspection())
                .assert("manifest and process output", (state) => {
                    let report: { status?: unknown } | null = null;
                    try { report = JSON.parse(state.subject.binStdout) as { status?: unknown }; } catch { report = null; }
                    return {
                        version: state.subject.manifest.version,
                        private: state.subject.manifest.private,
                        bin: state.subject.manifest.bin?.[BIN_NAME],
                        tsxRuntime: typeof state.subject.manifest.dependencies?.tsx === "string",
                        status: state.subject.binStatus,
                        stderr: state.subject.binStderr,
                        verdict: report?.status,
                    };
                }, P.equals<{ version: string | undefined; private: boolean | undefined; bin: string | undefined; tsxRuntime: boolean; status: number | null; stderr: string; verdict: unknown }>({
                    version: "1.0.0",
                    private: undefined,
                    bin: "./scripts/audit-roms.ts",
                    tsxRuntime: true,
                    status: 0,
                    stderr: "",
                    verdict: "ok",
                }))
                .start(undefined, { timeout: 30_000 }),
        },
    ],
};

export default testFile;
