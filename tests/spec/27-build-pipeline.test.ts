// realizes: docs/arcade-runtime-spec.md > §4.1 Build pipeline (build files, link flags, build identity, -listfull parsing)

// Dependencies:
import { existsSync, readdirSync, readFileSync } from "node:fs";   // Reads committed build files, targets and patches
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import {
    buildIdFor,                                                  // Deterministic identity under test
    buildInfoFor,                                                // build.json assembly under test
    EXPORTED_RUNTIME_METHODS,                                    // Runtime methods §4.3.1 requires
    isBuildFile,                                                 // Build-file predicate under test
    linkFlagsFor,                                                // Link flags under test
    parseListFull,                                               // -listfull parser under test
    TOOLCHAIN_PATCHES,                                           // Build-only patches that must exist
} from "../../scripts/mame-build/buildInfo.ts";
import { isBuildInfo } from "../../src/index.ts";                // The assembled build.json must satisfy the shared predicate
import { withKey } from "../support/fixtures.ts";                // One-violation variants

// Type dependencies:
import type { BuildIdentity } from "../../scripts/mame-build/buildInfo.ts";   // Identity shape
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const ROOT = new URL("../../", import.meta.url);                 // Repository root

const IDENTITY: BuildIdentity = {
    family: "fake-family",
    emulatorVersion: "mame0161",
    emsdkVersion: "1.38.31",
    memoryPages: 4096,
    patches: [{ name: "0001-a.patch", sha256: "a".repeat(64) }, { name: "0002-b.patch", sha256: "b".repeat(64) }],
    target: "c".repeat(64),
    list: "d".repeat(64),
    makeFlags: ["REGENIE=1"],
    linkFlags: ["-O2"],
};

const LISTFULL = `Name:             Description:
fakegame          "Fake Game (World)"
fakeclone         "Fake Game (Japan, with \\"quotes\\")"
`;

const testFile: TestFile = {
    label: "build pipeline",
    cases: [
        {
            label: "every committed build file is valid, names an existing target pair and matches its own family",
            run: () => CTGTest.init("build files")
                .stage("read mame/builds", () => readdirSync(new URL("mame/builds/", ROOT)).filter((name) => name.endsWith(".json")).sort())
                .assert("at least the two required M1 families exist", (state) => state.subject.includes("neogeo.json") && state.subject.includes("cps1.json"), P.equals(true))
                .assert("each parses, validates and points at committed targets", (state) => state.subject.every((name) => {
                    const parsed: unknown = JSON.parse(readFileSync(new URL(`mame/builds/${name}`, ROOT), "utf8"));
                    return isBuildFile(parsed) && parsed.family === name.slice(0, -5)
                        && existsSync(new URL(parsed.target, ROOT)) && existsSync(new URL(parsed.list, ROOT));
                }), P.equals(true))
                .start(undefined),
        },
        {
            label: "isBuildFile rejects a mismatched target path, a non-integer memoryPages and a source outside src/mame",
            run: () => CTGTest.init("build file predicate")
                .assert("verdicts", () => {
                    const valid = { family: "cps2", target: "mame/targets/cps2.lua", list: "mame/targets/cps2.lst", memoryPages: 4096, sources: ["src/mame/drivers/cps2.c"] };
                    return [
                        isBuildFile(valid),
                        isBuildFile(withKey(valid, "target", "mame/targets/cps1.lua")),
                        isBuildFile(withKey(valid, "memoryPages", 4096.5)),
                        isBuildFile(withKey(valid, "sources", ["src/emu/machine.c"])),
                        isBuildFile(withKey(valid, "family", "CPS2")),
                    ];
                }, P.equals<boolean[]>([true, false, false, false, false]))
                .start(undefined),
        },
        {
            label: "the toolchain patches named for every browser build exist under mame/probes/patches",
            run: () => CTGTest.init("toolchain patches")
                .assert("both files exist", () => TOOLCHAIN_PATCHES.every((path) => existsSync(new URL(path, ROOT))), P.equals(true))
                .start(undefined),
        },
        {
            label: "link flags modularize as createMame, fix memory from memoryPages and export every §4.3.1 runtime method",
            run: () => CTGTest.init("link flags")
                .stage("flags for 4096 pages", () => linkFlagsFor(4096))
                .assert("expected switches present", (state) => ({
                    modularize: state.subject.includes("MODULARIZE=1"),
                    name: state.subject.includes("EXPORT_NAME=createMame"),
                    memory: state.subject.includes("TOTAL_MEMORY=268435456"),
                    methods: ["FS", "callMain", "cwrap", "ccall", "UTF8ToString"].every((method) => EXPORTED_RUNTIME_METHODS.includes(method)
                        && state.subject.some((flag) => flag.includes(`"${method}"`))),
                    noPthreads: !state.subject.some((flag) => flag.includes("USE_PTHREADS")),
                }), P.equals<{ modularize: boolean; name: boolean; memory: boolean; methods: boolean; noPthreads: boolean }>({ modularize: true, name: true, memory: true, methods: true, noPthreads: true }))
                .start(undefined),
        },
        {
            label: "buildIdFor is a 64-hex SHA-256 that is stable across key order and changes with any input",
            run: () => CTGTest.init("build id")
                .stage("compute ids", () => ({
                    base: buildIdFor(IDENTITY),
                    reordered: buildIdFor({ linkFlags: IDENTITY.linkFlags, makeFlags: IDENTITY.makeFlags, list: IDENTITY.list, target: IDENTITY.target, patches: IDENTITY.patches, memoryPages: IDENTITY.memoryPages, emsdkVersion: IDENTITY.emsdkVersion, emulatorVersion: IDENTITY.emulatorVersion, family: IDENTITY.family }),
                    patch: buildIdFor({ ...IDENTITY, patches: [IDENTITY.patches[0]!, { name: "0002-b.patch", sha256: "e".repeat(64) }] }),
                    memory: buildIdFor({ ...IDENTITY, memoryPages: 8192 }),
                    flags: buildIdFor({ ...IDENTITY, linkFlags: ["-O3"] }),
                }))
                .assert("shape, stability and sensitivity", (state) => ({
                    hex: /^[0-9a-f]{64}$/.test(state.subject.base),
                    stable: state.subject.base === state.subject.reordered,
                    patchDiffers: state.subject.patch !== state.subject.base,
                    memoryDiffers: state.subject.memory !== state.subject.base,
                    flagsDiffer: state.subject.flags !== state.subject.base,
                }), P.equals<{ hex: boolean; stable: boolean; patchDiffers: boolean; memoryDiffers: boolean; flagsDiffer: boolean }>({ hex: true, stable: true, patchDiffers: true, memoryDiffers: true, flagsDiffer: true }))
                .start(undefined),
        },
        {
            label: "parseListFull reads name and description per line and skips the header",
            run: () => CTGTest.init("listfull")
                .assert("entries", () => parseListFull(LISTFULL), P.equals<{ name: string; description: string }[]>([
                    { name: "fakegame", description: "Fake Game (World)" },
                    { name: "fakeclone", description: "Fake Game (Japan, with \\\"quotes\\\")" },
                ]))
                .start(undefined),
        },
        {
            label: "buildInfoFor assembles a build.json that satisfies isBuildInfo with the family's artifact names",
            run: () => CTGTest.init("build info")
                .stage("assemble", () => buildInfoFor(
                    { family: "fake-family", target: "mame/targets/fake-family.lua", list: "mame/targets/fake-family.lst", memoryPages: 4096, sources: [] },
                    "mame0161", "1.38.31", ["fakegame", "fakeclone"], "0".repeat(64), [{ id: "MAME", notice: "notices/MAME-license.txt" }],
                ))
                .assert("valid and correctly named", (state) => ({
                    valid: isBuildInfo(state.subject),
                    artifacts: [...state.subject.artifacts],
                    engine: state.subject.engine,
                    romsets: state.subject.romsetsUrl,
                    pthreads: state.subject.pthreads,
                }), P.equals<{ valid: boolean; artifacts: string[]; engine: string; romsets: string; pthreads: boolean }>({
                    valid: true, artifacts: ["mamefake-family.js", "mamefake-family.wasm"], engine: "fake-family", romsets: "romsets/", pthreads: false,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
