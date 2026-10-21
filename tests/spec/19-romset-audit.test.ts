// realizes: docs/arcade-runtime-spec.md > §10.5 RomSetAudit central-directory audit

// Dependencies:
import { randomBytes } from "node:crypto";                         // Generates synthetic, non-ROM test bytes
import { readFileSync } from "node:fs";                            // Loads synthetic metadata JSON
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";     // Pipeline API and predicate builders
import { zipSync } from "fflate";                                  // Builds synthetic archives in memory
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";
import RomSetAudit from "../../src/RomSetAudit/RomSetAudit.ts";
import { errorSnapshot, thrownBy } from "../support/fixtures.ts";  // Stable typed-error assertions

// Type dependencies:
import type { RomFile } from "../../src/shared.types.ts";          // Audit archive input
import type { RomSetMetadata, RomSetReport } from "../../src/RomSetAudit/types.ts";
import type { TestCase, TestFile } from "../run.ts";               // Manifest contract consumed by the runner
import type { ErrorSnapshot } from "../support/fixtures.ts";       // Typed result of errorSnapshot

/**
 *
 * Type Declarations
 *
 */

// TYPE :: {[STRING]:UINT8ARRAY}
// Entry map accepted by the fflate zip writer.
type ZipEntries = Record<string, Uint8Array>;

/**
 *
 * Constants
 *
 */

const FIXTURE_URL = new URL("../support/fixtures/romsets/fakeclone.json", import.meta.url);   // Synthetic metadata only
const FIXTURE = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as RomSetMetadata;
const ENTRY_BYTES = {                                              // Fresh random bytes on every test process; never committed
    "clone.bin": new Uint8Array(randomBytes(16)),
    "optional.bin": new Uint8Array(randomBytes(8)),
    "parent.bin": new Uint8Array(randomBytes(24)),
    "bios.bin": new Uint8Array(randomBytes(12)),
    "voice.wav": new Uint8Array(randomBytes(20)),
} as const;

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY -> STRING
// Computes canonical CRC32 text for dynamically generated synthetic bytes.
const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

// HELPER :: VOID -> romSetMetadata
// Copies the JSON fixture and replaces placeholder sizes/CRCs with this run's random-byte identities.
const metadata = (): RomSetMetadata => ({
    ...structuredClone(FIXTURE),
    roms: FIXTURE.roms.map((rom) => {
        const bytes = ENTRY_BYTES[rom.name as keyof typeof ENTRY_BYTES];
        if (bytes === undefined) throw new Error(`Synthetic fixture lacks ${rom.name}`);
        return { ...rom, size: bytes.length, crc: crc32(bytes) };
    }),
});

// HELPER :: zipEntries -> UINT8ARRAY
// Builds one deterministic-shape zip; payload identities remain random per process.
const zip = (entries: ZipEntries): Uint8Array => zipSync(entries, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });

// HELPER :: VOID -> [romFile]
// Complete split set: game, parent, BIOS and optional sample archive.
const completeRoms = (): RomFile[] => [
    { name: "fakeclone.zip", bytes: zip({ "clone.bin": ENTRY_BYTES["clone.bin"], "optional.bin": ENTRY_BYTES["optional.bin"] }) },
    { name: "fakegame.zip", bytes: zip({ "parent.bin": ENTRY_BYTES["parent.bin"] }) },
    { name: "fakebios.zip", bytes: zip({ "bios.bin": ENTRY_BYTES["bios.bin"] }) },
    { name: "fakesamples.zip", bytes: zip({ "voice.wav": ENTRY_BYTES["voice.wav"] }) },
];

// HELPER :: partial archive-presence and file-status overrides -> romSetReport
// Produces the exact expected report in metadata order.
const expectedReport = (config: {
    readonly status?: RomSetReport["status"];
    readonly present?: Readonly<Record<string, boolean>>;
    readonly fileStatus?: Readonly<Record<string, RomSetReport["files"][number]["status"]>>;
    readonly unexpected?: RomSetReport["unexpected"];
    readonly problems?: RomSetReport["problems"];
} = {}): RomSetReport => ({
    machine: "fakeclone",
    status: config.status ?? "ok",
    archives: metadata().archives.map((archive) => ({
        name: archive.name,
        role: archive.role,
        present: config.present?.[archive.name] ?? true,
        required: archive.role !== "samples",
    })),
    files: [
        ...metadata().roms.map((rom) => ({
            name: rom.name,
            archive: rom.archive,
            status: config.fileStatus?.[rom.name] ?? "ok" as const,
        })),
        ...metadata().samples.map((sample) => ({
            name: sample.name,
            archive: sample.archive,
            status: config.fileStatus?.[sample.name] ?? "ok" as const,
        })),
    ],
    unexpected: config.unexpected ?? [],
    problems: config.problems ?? [],
});

// HELPER :: STRING, [romFile], romSetReport -> testCase
// Audits supplied archives and compares every report field exactly.
const auditCase = (label: string, roms: RomFile[], expected: RomSetReport): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert("report matches", () => RomSetAudit.audit(metadata(), roms), P.equals<RomSetReport>(expected))
        .start(undefined),
});

// HELPER :: UINT8ARRAY -> UINT8ARRAY
// Copies a zip and damages its first central-directory signature.
const corruptCentralDirectory = (zipBytes: Uint8Array): Uint8Array => {
    const copy = zipBytes.slice();
    for (let index = 0; index <= copy.length - 4; index++) {
        if (copy[index] === 0x50 && copy[index + 1] === 0x4b && copy[index + 2] === 0x01 && copy[index + 3] === 0x02) {
            copy[index] = 0;
            return copy;
        }
    }
    throw new Error("Synthetic zip has no central-directory entry");
};

const complete = completeRoms();
const wrongCrcBytes = ENTRY_BYTES["clone.bin"].slice();
wrongCrcBytes[0] = wrongCrcBytes[0]! ^ 0xff;
const overLimitEntries: ZipEntries = {};
for (let index = 0; index <= 4_096; index++) overLimitEntries[`entry-${index}.bin`] = new Uint8Array();

const testFile: TestFile = {
    label: "RomSetAudit",
    cases: [
        auditCase("complete split game, parent and BIOS archives are ok", completeRoms(), expectedReport()),
        auditCase("a missing parent archive is incomplete and names its file", complete.filter((rom) => rom.name !== "fakegame.zip"), expectedReport({
            status: "incomplete",
            present: { "fakegame.zip": false },
            fileStatus: { "parent.bin": "missing" },
        })),
        auditCase("a present file with the wrong CRC makes the set bad", [
            { name: "fakeclone.zip", bytes: zip({ "clone.bin": wrongCrcBytes, "optional.bin": ENTRY_BYTES["optional.bin"] }) },
            ...complete.slice(1),
        ], expectedReport({ status: "bad", fileStatus: { "clone.bin": "wrong-crc" } })),
        auditCase("a present file with the wrong size makes the set bad", [
            { name: "fakeclone.zip", bytes: zip({ "clone.bin": ENTRY_BYTES["clone.bin"].subarray(1), "optional.bin": ENTRY_BYTES["optional.bin"] }) },
            ...complete.slice(1),
        ], expectedReport({ status: "bad", fileStatus: { "clone.bin": "wrong-size" } })),
        auditCase("a missing optional ROM stays ok and reports optional-missing", [
            { name: "fakeclone.zip", bytes: zip({ "clone.bin": ENTRY_BYTES["clone.bin"] }) },
            ...complete.slice(1),
        ], expectedReport({ fileStatus: { "optional.bin": "optional-missing" } })),
        auditCase("a missing sample archive stays ok and reports optional-missing", complete.filter((rom) => rom.name !== "fakesamples.zip"), expectedReport({
            present: { "fakesamples.zip": false },
            fileStatus: { "voice.wav": "optional-missing" },
        })),
        auditCase("an unclaimed zip entry is informationally unexpected", [
            { name: "fakeclone.zip", bytes: zip({
                "clone.bin": ENTRY_BYTES["clone.bin"],
                "optional.bin": ENTRY_BYTES["optional.bin"],
                "extra.bin": new Uint8Array(randomBytes(5)),
            }) },
            ...complete.slice(1),
        ], expectedReport({ unexpected: [{ archive: "fakeclone.zip", name: "extra.bin" }] })),
        auditCase("archive names match case-insensitively", complete.map((rom) => ({ ...rom, name: rom.name.toUpperCase() })), expectedReport()),
        auditCase("a non-zip archive is present but incomplete with a problem", [
            { name: "fakeclone.zip", bytes: new Uint8Array(randomBytes(32)) },
            ...complete.slice(1),
        ], expectedReport({
            status: "incomplete",
            fileStatus: { "clone.bin": "missing", "optional.bin": "optional-missing" },
            problems: [{ archive: "fakeclone.zip", reason: "invalid or corrupt zip central directory" }],
        })),
        auditCase("a corrupt central directory is present but incomplete with a problem", [
            { name: "fakeclone.zip", bytes: corruptCentralDirectory(complete[0]!.bytes) },
            ...complete.slice(1),
        ], expectedReport({
            status: "incomplete",
            fileStatus: { "clone.bin": "missing", "optional.bin": "optional-missing" },
            problems: [{ archive: "fakeclone.zip", reason: "invalid or corrupt zip central directory" }],
        })),
        auditCase("an archive over 4,096 entries is present but incomplete with a problem", [
            { name: "fakeclone.zip", bytes: zip(overLimitEntries) },
            ...complete.slice(1),
        ], expectedReport({
            status: "incomplete",
            fileStatus: { "clone.bin": "missing", "optional.bin": "optional-missing" },
            problems: [{ archive: "fakeclone.zip", reason: "archive exceeds 4,096 entries" }],
        })),
        {
            label: "invalid metadata and RomFile values throw only INVALID_CONFIG",
            run: () => CTGTest.init("invalid audit values")
                .assert("invalid metadata", () => errorSnapshot(
                    thrownBy(() => RomSetAudit.audit({} as RomSetMetadata, [])), ArcadeRuntimeError,
                ), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .assert("invalid RomFile", () => errorSnapshot(
                    thrownBy(() => RomSetAudit.audit(metadata(), [{ name: "fakeclone.zip", bytes: new ArrayBuffer(0) } as unknown as RomFile])), ArcadeRuntimeError,
                ), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .assert("duplicate case-folded RomFile names", () => errorSnapshot(
                    thrownBy(() => RomSetAudit.audit(metadata(), [complete[0]!, { ...complete[0]!, name: "FAKECLONE.ZIP" }])), ArcadeRuntimeError,
                ), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .start(undefined),
        },
    ],
};

export default testFile;
