// realizes: docs/arcade-runtime-spec.md > §10.5 RomSetAudit metadata and report predicates

// Dependencies:
import { readFileSync } from "node:fs";                            // Loads the committed synthetic metadata fixture
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";     // Pipeline API and predicate builders
import {
    isRomSetMetadata,                                               // Metadata predicate under test
    isRomSetReport,                                                 // Report predicate under test
} from "../../src/RomSetAudit/types.ts";

// Type dependencies:
import type {
    RomSetMetadata,                                                 // Typed copies of the accepted fixture
    RomSetReport,                                                   // Accepted report fixture shape
} from "../../src/RomSetAudit/types.ts";
import type { TestCase, TestFile } from "../run.ts";               // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {result:BOOLEAN}
// Snapshot of one predicate result.
interface PredicateSnapshot {
    readonly result: boolean;
}

/**
 *
 * Constants
 *
 */

const FIXTURE_URL = new URL("../support/fixtures/romsets/fakeclone.json", import.meta.url);   // Synthetic metadata only
const FIXTURE = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as RomSetMetadata;

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> romSetMetadata
// Returns a deep mutable copy so each rejection changes exactly one condition.
const metadataLike = (): RomSetMetadata => structuredClone(FIXTURE);

// HELPER :: VOID -> romSetReport
// A complete, clean report meeting every isRomSetReport condition.
const reportLike = (): RomSetReport => ({
    machine: "fakeclone",
    status: "ok",
    strictness: "mame",
    archives: [
        { name: "fakeclone.zip", role: "game", present: true, required: true },
        { name: "fakesamples.zip", role: "samples", present: false, required: false },
    ],
    files: [
        { name: "clone.bin", archive: "fakeclone.zip", status: "wrong-crc" },
        { name: "voice.wav", archive: "fakesamples.zip", status: "optional-missing" },
    ],
    warnings: [{ name: "clone.bin", archive: "fakeclone.zip", status: "wrong-crc" }],
    unexpected: [{ archive: "fakeclone.zip", name: "extra.bin" }],
    problems: [{ archive: "fakeclone.zip", reason: "invalid or corrupt zip central directory" }],
});

// HELPER :: STRING, (UNKNOWN -> BOOLEAN), UNKNOWN, BOOLEAN -> testCase
// Builds one structural-predicate case.
const predicateCase = (label: string, predicate: (value: unknown) => boolean, input: unknown, expected: boolean): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert(expected ? "returns true" : "returns false", () => ({ result: predicate(input) }), P.equals<PredicateSnapshot>({ result: expected }))
        .start(undefined),
});

// HELPER :: romSetMetadata, STRING, UNKNOWN -> UNKNOWN
// Replaces one top-level metadata field without weakening the production type.
const metadataWith = (metadata: RomSetMetadata, key: keyof RomSetMetadata, value: unknown): unknown => ({ ...metadata, [key]: value });

// HELPER :: romSetReport, STRING, UNKNOWN -> UNKNOWN
// Replaces one top-level report field without weakening the production type.
const reportWith = (report: RomSetReport, key: keyof RomSetReport, value: unknown): unknown => ({ ...report, [key]: value });

const testFile: TestFile = {
    label: "RomSetAudit metadata and report predicates",
    cases: [
        // isRomSetMetadata: top-level identity and relationships
        predicateCase("isRomSetMetadata accepts complete synthetic metadata", isRomSetMetadata, metadataLike(), true),
        predicateCase("isRomSetMetadata accepts null relationships and a nodump SHA-1", isRomSetMetadata, {
            ...metadataLike(), cloneof: null, romof: null, sampleof: null,
            roms: metadataLike().roms.map((rom, index) => index === 0 ? { ...rom, sha1: null } : rom),
        }, true),
        predicateCase("isRomSetMetadata rejects a non-object", isRomSetMetadata, null, false),
        predicateCase("isRomSetMetadata rejects an empty machine", isRomSetMetadata, metadataWith(metadataLike(), "machine", ""), false),
        predicateCase("isRomSetMetadata rejects an empty family", isRomSetMetadata, metadataWith(metadataLike(), "family", ""), false),
        predicateCase("isRomSetMetadata rejects an empty description", isRomSetMetadata, metadataWith(metadataLike(), "description", ""), false),
        predicateCase("isRomSetMetadata rejects a non-string cloneof", isRomSetMetadata, metadataWith(metadataLike(), "cloneof", 1), false),
        predicateCase("isRomSetMetadata rejects a non-string romof", isRomSetMetadata, metadataWith(metadataLike(), "romof", false), false),
        predicateCase("isRomSetMetadata rejects a non-array bios", isRomSetMetadata, metadataWith(metadataLike(), "bios", "fakebios"), false),
        predicateCase("isRomSetMetadata rejects an empty BIOS name", isRomSetMetadata, metadataWith(metadataLike(), "bios", [""]), false),
        predicateCase("isRomSetMetadata rejects duplicate case-folded BIOS names", isRomSetMetadata, metadataWith(metadataLike(), "bios", ["FakeBIOS", "fakebios"]), false),
        predicateCase("isRomSetMetadata rejects a non-string sampleof", isRomSetMetadata, metadataWith(metadataLike(), "sampleof", {}), false),

        // isRomSetMetadata: archives and ROM rows
        predicateCase("isRomSetMetadata rejects a non-array archives field", isRomSetMetadata, metadataWith(metadataLike(), "archives", {}), false),
        predicateCase("isRomSetMetadata rejects an archive path", isRomSetMetadata, metadataWith(metadataLike(), "archives", [
            { ...metadataLike().archives[0], name: "sets/fakeclone.zip" }, ...metadataLike().archives.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects an unknown archive role", isRomSetMetadata, metadataWith(metadataLike(), "archives", [
            { ...metadataLike().archives[0], role: "firmware" }, ...metadataLike().archives.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects duplicate case-folded archive names", isRomSetMetadata, metadataWith(metadataLike(), "archives", [
            ...metadataLike().archives, { name: "FAKECLONE.ZIP", role: "parent" },
        ]), false),
        predicateCase("isRomSetMetadata rejects a non-array roms field", isRomSetMetadata, metadataWith(metadataLike(), "roms", {}), false),
        predicateCase("isRomSetMetadata rejects an empty ROM entry name", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], name: "" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a negative ROM size", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], size: -1 }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a fractional ROM size", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], size: 1.5 }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a CRC that is not eight hex digits", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], crc: "abc1234" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects an upper-case CRC", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], crc: "ABC12345" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a non-canonical SHA-1", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], sha1: "a".repeat(39) }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects an archive path on a ROM", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], archive: "sets/fakeclone.zip" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a ROM whose archive is absent", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], archive: "absent.zip" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a ROM assigned to a sample archive", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], archive: "fakesamples.zip" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata rejects a non-boolean optional flag", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], optional: "no" }, ...metadataLike().roms.slice(1),
        ]), false),
        predicateCase("isRomSetMetadata accepts ROM rows with or without region", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], region: "maincpu" }, ...metadataLike().roms.slice(1),
        ]), true),
        predicateCase("isRomSetMetadata rejects a non-string ROM region", isRomSetMetadata, metadataWith(metadataLike(), "roms", [
            { ...metadataLike().roms[0], region: 1 }, ...metadataLike().roms.slice(1),
        ]), false),

        // isRomSetMetadata: sample rows
        predicateCase("isRomSetMetadata rejects a non-array samples field", isRomSetMetadata, metadataWith(metadataLike(), "samples", {}), false),
        predicateCase("isRomSetMetadata rejects an empty sample name", isRomSetMetadata, metadataWith(metadataLike(), "samples", [{ name: "", archive: "fakesamples.zip" }]), false),
        predicateCase("isRomSetMetadata rejects a sample whose archive is absent", isRomSetMetadata, metadataWith(metadataLike(), "samples", [{ name: "voice.wav", archive: "absent.zip" }]), false),
        predicateCase("isRomSetMetadata rejects a sample assigned to a game archive", isRomSetMetadata, metadataWith(metadataLike(), "samples", [{ name: "voice.wav", archive: "fakeclone.zip" }]), false),

        // isRomSetReport
        predicateCase("isRomSetReport accepts a complete byte-free report", isRomSetReport, reportLike(), true),
        predicateCase("isRomSetReport rejects a non-object", isRomSetReport, null, false),
        predicateCase("isRomSetReport rejects an empty machine", isRomSetReport, reportWith(reportLike(), "machine", ""), false),
        predicateCase("isRomSetReport rejects an unknown overall status", isRomSetReport, reportWith(reportLike(), "status", "unknown"), false),
        predicateCase("isRomSetReport rejects an unknown strictness", isRomSetReport, reportWith(reportLike(), "strictness", "loose"), false),
        predicateCase("isRomSetReport rejects a non-array archives field", isRomSetReport, reportWith(reportLike(), "archives", {}), false),
        predicateCase("isRomSetReport rejects an invalid archive row", isRomSetReport, reportWith(reportLike(), "archives", [
            { name: "fakeclone.zip", role: "game", present: "yes", required: true },
        ]), false),
        predicateCase("isRomSetReport rejects duplicate case-folded archives", isRomSetReport, reportWith(reportLike(), "archives", [
            ...reportLike().archives, { name: "FAKECLONE.ZIP", role: "parent", present: true, required: true },
        ]), false),
        predicateCase("isRomSetReport rejects a non-array files field", isRomSetReport, reportWith(reportLike(), "files", {}), false),
        predicateCase("isRomSetReport rejects an unknown file status", isRomSetReport, reportWith(reportLike(), "files", [
            { name: "clone.bin", archive: "fakeclone.zip", status: "corrupt" },
        ]), false),
        predicateCase("isRomSetReport rejects a file referencing an absent archive", isRomSetReport, reportWith(reportLike(), "files", [
            { name: "clone.bin", archive: "absent.zip", status: "missing" },
        ]), false),
        predicateCase("isRomSetReport rejects a non-array warnings field", isRomSetReport, reportWith(reportLike(), "warnings", {}), false),
        predicateCase("isRomSetReport rejects a warning that does not match a file row", isRomSetReport, reportWith(reportLike(), "warnings", [
            { name: "clone.bin", archive: "fakeclone.zip", status: "wrong-size" },
        ]), false),
        predicateCase("isRomSetReport rejects warnings in strict mode", isRomSetReport, reportWith(reportLike(), "strictness", "strict"), false),
        predicateCase("isRomSetReport rejects a non-array unexpected field", isRomSetReport, reportWith(reportLike(), "unexpected", {}), false),
        predicateCase("isRomSetReport rejects an invalid unexpected entry", isRomSetReport, reportWith(reportLike(), "unexpected", [
            { archive: "fakeclone.zip", name: "" },
        ]), false),
        predicateCase("isRomSetReport rejects an unexpected entry referencing an absent archive", isRomSetReport, reportWith(reportLike(), "unexpected", [
            { archive: "absent.zip", name: "extra.bin" },
        ]), false),
        predicateCase("isRomSetReport rejects a non-array problems field", isRomSetReport, reportWith(reportLike(), "problems", {}), false),
        predicateCase("isRomSetReport rejects an empty problem reason", isRomSetReport, reportWith(reportLike(), "problems", [
            { archive: "fakeclone.zip", reason: "" },
        ]), false),
        predicateCase("isRomSetReport rejects a problem referencing an absent archive", isRomSetReport, reportWith(reportLike(), "problems", [
            { archive: "absent.zip", reason: "invalid zip" },
        ]), false),
    ],
};

export default testFile;
