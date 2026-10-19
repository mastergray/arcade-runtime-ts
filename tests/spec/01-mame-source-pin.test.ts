// realizes: docs/mame-game-runtime-spec.md > §13.1 P1 source identity

// Dependencies:
import { readFileSync } from "node:fs";                          // Reads the committed source pin
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {repository:STRING, tag:STRING, tagObject:STRING, commit:STRING, releaseDate:STRING, sourcePackages:[STRING]}
// Immutable direct-MAME source identity established by P1.
interface SourcePin {
    repository: string;
    tag: string;
    tagObject: string;
    commit: string;
    releaseDate: string;
    sourcePackages: string[];
}

// INTERFACE :: {version:STRING, source:sourcePin}
// Combined contents of the two source-pin files.
interface PinSnapshot {
    version: string;
    source: SourcePin;
}

/**
 *
 * Constants
 *
 */

const VERSION_URL = new URL("../../mame/VERSION", import.meta.url);       // Human-readable release pin
const SOURCE_URL = new URL("../../mame/SOURCE.json", import.meta.url);   // Immutable repository identity

const EXPECTED_PIN: PinSnapshot = {
    version: "mame0161",
    source: {
        repository: "https://github.com/mamedev/mame.git",
        tag: "mame0161",
        tagObject: "e86fa8bcf4430937777d7a384f8ea7b9a01569ab",
        commit: "76b978d039f922ed84796deb999389ebb1579191",
        releaseDate: "2015-04-29",
        sourcePackages: ["mame0161s.exe", "mame0161s.zip"],
    },
};

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> pinSnapshot
// Reads both pin files as the build tooling will.
const readPin = (): PinSnapshot => ({
    version: readFileSync(VERSION_URL, "utf8").trim(),
    source: JSON.parse(readFileSync(SOURCE_URL, "utf8")) as SourcePin,
});

const testFile: TestFile = {
    label: "direct-MAME source pin",
    cases: [
        {
            label: "MAME 0.161 resolves to the official tagged commit",
            run: () => CTGTest.init("source identity")
                .assert("pin matches the P1 record", readPin, P.equals<PinSnapshot>(EXPECTED_PIN))
                .start(undefined),
        },
    ],
};

export default testFile;
