// realizes: docs/arcade-runtime-spec.md > §4.1 step 6; §14 build suite; §14.1 Release gates

// Dependencies:
import { existsSync, readdirSync, readFileSync } from "node:fs";   // Discovers and validates whichever family outputs are present
import { dirname, join, resolve, sep } from "node:path";          // Keeps metadata paths inside each family directory
import { fileURLToPath } from "node:url";                        // Converts repository URLs for the threading inspector
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import { inspectThreading } from "../../scripts/inspect-mame-threading.ts";   // Production artifact threading gate
import { isBuildInfo } from "../../src/shared.types.ts";         // build.json structural predicate
import { isRomSetMetadata } from "../../src/RomSetAudit/types.ts";   // romsets/<machine>.json structural predicate

// Type dependencies:
import type { TestCase, TestFile } from "../run.ts";              // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: all build-output invariants checked for one discovered family
interface FamilyInspection {
    readonly buildValid: boolean;
    readonly engineMatchesDirectory: boolean;
    readonly artifactsExist: boolean;
    readonly noticesExist: boolean;
    readonly romsetsPathContained: boolean;
    readonly romsetNamesMatchMachines: boolean;
    readonly romsetsValid: boolean;
    readonly threadingPasses: boolean;
}

/**
 *
 * Constants
 *
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root
const BUILD_FILES = join(ROOT, "mame", "builds");
const BUILD_OUTPUT = join(ROOT, "dist", "mame");
const CONFIGURED_FAMILIES = readdirSync(BUILD_FILES)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort((a, b) => a.localeCompare(b));

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> familyInspection
// Validates one real family output without encoding any family or machine identity in this test.
const inspectFamily = (family: string): FamilyInspection => {
    const directory = join(BUILD_OUTPUT, family);
    const parsed: unknown = JSON.parse(readFileSync(join(directory, "build.json"), "utf8"));
    if (!isBuildInfo(parsed)) {
        return {
            buildValid: false,
            engineMatchesDirectory: false,
            artifactsExist: false,
            noticesExist: false,
            romsetsPathContained: false,
            romsetNamesMatchMachines: false,
            romsetsValid: false,
            threadingPasses: false,
        };
    }

    const romsets = resolve(directory, parsed.romsetsUrl);
    const romsetsPathContained = romsets.startsWith(`${resolve(directory)}${sep}`);
    const actualRomsets = romsetsPathContained && existsSync(romsets)
        ? readdirSync(romsets).filter((name) => name.endsWith(".json")).sort((a, b) => a.localeCompare(b))
        : [];
    const expectedRomsets = parsed.machines.map((machine) => `${machine}.json`).sort((a, b) => a.localeCompare(b));
    const romsetsValid = actualRomsets.length === expectedRomsets.length && actualRomsets.every((name) => {
        try {
            const metadata: unknown = JSON.parse(readFileSync(join(romsets, name), "utf8"));
            return isRomSetMetadata(metadata)
                && metadata.machine === name.slice(0, -5)
                && metadata.family === parsed.engine;
        } catch {
            return false;
        }
    });
    const wasm = parsed.artifacts.find((artifact) => artifact.endsWith(".wasm"));
    const threading = wasm === undefined ? null : inspectThreading(join(directory, wasm));

    return {
        buildValid: true,
        engineMatchesDirectory: parsed.engine === family,
        artifactsExist: parsed.artifacts.every((artifact) => existsSync(join(directory, artifact))),
        noticesExist: parsed.licenses.every((license) => existsSync(join(directory, license.notice))),
        romsetsPathContained,
        romsetNamesMatchMachines: JSON.stringify(actualRomsets) === JSON.stringify(expectedRomsets),
        romsetsValid,
        threadingPasses: parsed.pthreads === false
            && threading !== null
            && threading.requiresPthreads === false
            && threading.fixedMemory,
    };
};

// HELPER :: STRING -> testCase
// Skips the expensive validation stage when that configured family has not been built locally.
const familyCase = (family: string): TestCase => ({
    label: `configured family ${family} validates when its build output is present`,
    run: () => CTGTest.init(`build output ${family}`)
        .skip("inspect present family", () => !existsSync(join(BUILD_OUTPUT, family, "build.json")))
        .stage("inspect present family", () => inspectFamily(family))
        .skip("all release invariants hold", () => !existsSync(join(BUILD_OUTPUT, family, "build.json")))
        .assert("all release invariants hold", (state) => state.subject, P.equals<FamilyInspection>({
            buildValid: true,
            engineMatchesDirectory: true,
            artifactsExist: true,
            noticesExist: true,
            romsetsPathContained: true,
            romsetNamesMatchMachines: true,
            romsetsValid: true,
            threadingPasses: true,
        }))
        .start(undefined, { timeout: 30_000 }),
});

const testFile: TestFile = {
    label: "built family release output",
    cases: CONFIGURED_FAMILIES.map(familyCase),
};

export default testFile;
