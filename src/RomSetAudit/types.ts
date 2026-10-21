// realizes: docs/arcade-runtime-spec.md > §10.5 RomSetAudit and romsets/ metadata

// Dependencies:
import {
    isNonEmptyString,                                                // Guards metadata strings and problem reasons
    isRomName,                                                       // Guards archive basenames
    isRomRole,                                                       // Guards archive roles
    romNameKey,                                                      // Case-folded archive comparison
} from "../shared.types.js";

// Type dependencies:
import type {
    NonEmptyString,                                                  // Metadata labels and entry names
    RomName,                                                        // Archive basenames
    RomRole,                                                        // game, parent, bios or samples
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: resolved per-machine metadata emitted beside a family build
// Every ROM and sample names the archive in which MAME expects to find it.
export interface RomSetMetadata {
    readonly machine: NonEmptyString;                               // MAME machine short name
    readonly family: NonEmptyString;                                // Family build id
    readonly description: NonEmptyString;                           // Human-readable machine description
    readonly cloneof: NonEmptyString | null;                         // Parent machine, or null
    readonly romof: NonEmptyString | null;                           // Machine whose ROM set is inherited, or null
    readonly bios: ReadonlyArray<NonEmptyString>;                    // BIOS option names reported for the machine
    readonly sampleof: NonEmptyString | null;                        // Inherited sample set, or null
    readonly archives: ReadonlyArray<{
        readonly name: RomName;                                     // Expected zip basename
        readonly role: RomRole;                                     // Part played by the archive
    }>;
    readonly roms: ReadonlyArray<{
        readonly name: NonEmptyString;                              // Entry name inside archive
        readonly size: number;                                      // Expected uncompressed byte length
        readonly crc: string;                                       // Eight lower-case CRC32 hex digits
        readonly sha1: string | null;                               // Forty lower-case hex digits; null for nodump
        readonly archive: RomName;                                  // Archive containing this entry
        readonly optional: boolean;                                 // Missing entry does not invalidate the set
        readonly bios?: NonEmptyString | null;                      // BIOS option this entry belongs to; required only when that option is selected
        readonly device?: NonEmptyString | null;                    // Device short name when this is a device ROM; also accepted from the game archive
    }>;
    readonly defaultBios?: NonEmptyString | null;                    // Option selected when a start config names none
    readonly samples: ReadonlyArray<{
        readonly name: NonEmptyString;                              // Sample entry name inside archive
        readonly archive: RomName;                                  // Optional sample archive containing it
    }>;
}

// INTERFACE :: actionable result of auditing supplied archives against metadata
// Contains archive and entry identities only; ROM bytes never enter a report.
export interface RomSetReport {
    readonly machine: NonEmptyString;                               // Audited machine short name
    readonly status: "ok" | "incomplete" | "bad";                  // Overall required-ROM verdict
    readonly archives: ReadonlyArray<{
        readonly name: RomName;                                     // Metadata archive name
        readonly role: RomRole;                                     // Metadata archive role
        readonly present: boolean;                                  // Supplied, even when its zip directory is corrupt
        readonly required: boolean;                                 // Contains at least one required ROM
    }>;
    readonly files: ReadonlyArray<{
        readonly name: NonEmptyString;                              // Expected ROM or sample entry
        readonly archive: RomName;                                  // Archive in which it was sought
        readonly status: "ok" | "missing" | "wrong-size" | "wrong-crc" | "optional-missing";
    }>;
    readonly unexpected: ReadonlyArray<{
        readonly archive: RomName;                                  // Supplied metadata archive
        readonly name: NonEmptyString;                              // Entry no ROM or sample claims
    }>;
    readonly problems: ReadonlyArray<{
        readonly archive: RomName;                                  // Supplied archive that could not be inspected
        readonly reason: NonEmptyString;                            // Stable user-facing reason
    }>;
}

/**
 *
 * Constants
 *
 */

const CRC_PATTERN = /^[0-9a-f]{8}$/;                               // Canonical CRC32 text
const SHA1_PATTERN = /^[0-9a-f]{40}$/;                             // Canonical SHA-1 text
const FILE_STATUSES = ["ok", "missing", "wrong-size", "wrong-crc", "optional-missing"] as const;

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN -> BOOLEAN
// True when value is a non-null object.
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// HELPER :: UNKNOWN, (UNKNOWN -> BOOLEAN) -> BOOLEAN
// True when value is an array and every item passes predicate.
const isArrayOf = (value: unknown, predicate: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(predicate);

// HELPER :: [STRING] -> BOOLEAN
// True when names remain unique after the comparison folding used for ROM names.
const uniqueCaseFolded = (names: ReadonlyArray<string>): boolean => new Set(names.map((name) => name.toLowerCase())).size === names.length;

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one archive declaration from RomSetMetadata.
const isMetadataArchive = (value: unknown): value is RomSetMetadata["archives"][number] => isObject(value)
    && isRomName(value.name)
    && isRomRole(value.role);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one expected ROM declaration with canonical hashes.
const isMetadataRom = (value: unknown): value is RomSetMetadata["roms"][number] => isObject(value)
    && isNonEmptyString(value.name)
    && typeof value.size === "number" && Number.isInteger(value.size) && value.size >= 0
    && typeof value.crc === "string" && CRC_PATTERN.test(value.crc)
    && (value.sha1 === null || (typeof value.sha1 === "string" && SHA1_PATTERN.test(value.sha1)))
    && isRomName(value.archive)
    && typeof value.optional === "boolean"
    && (value.bios === undefined || value.bios === null || isNonEmptyString(value.bios))
    && (value.device === undefined || value.device === null || isNonEmptyString(value.device));

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one expected sample declaration.
const isMetadataSample = (value: unknown): value is RomSetMetadata["samples"][number] => isObject(value)
    && isNonEmptyString(value.name)
    && isRomName(value.archive);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one archive row in a report.
const isReportArchive = (value: unknown): value is RomSetReport["archives"][number] => isObject(value)
    && isRomName(value.name)
    && isRomRole(value.role)
    && typeof value.present === "boolean"
    && typeof value.required === "boolean";

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one expected-file row in a report.
const isReportFile = (value: unknown): value is RomSetReport["files"][number] => isObject(value)
    && isNonEmptyString(value.name)
    && isRomName(value.archive)
    && (FILE_STATUSES as readonly unknown[]).includes(value.status);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one unexpected-entry row in a report.
const isUnexpectedFile = (value: unknown): value is RomSetReport["unexpected"][number] => isObject(value)
    && isRomName(value.archive)
    && isNonEmptyString(value.name);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one archive-problem row in a report.
const isArchiveProblem = (value: unknown): value is RomSetReport["problems"][number] => isObject(value)
    && isRomName(value.archive)
    && isNonEmptyString(value.reason);

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is complete resolved metadata with unique archives and valid archive references.
export function isRomSetMetadata(value: unknown): value is RomSetMetadata {
    if (!isObject(value)) return false;
    if (!isNonEmptyString(value.machine)
        || !isNonEmptyString(value.family)
        || !isNonEmptyString(value.description)
        || !(value.cloneof === null || isNonEmptyString(value.cloneof))
        || !isArrayOf(value.bios, isNonEmptyString)
        || !(value.romof === null || isNonEmptyString(value.romof))
        || !(value.sampleof === null || isNonEmptyString(value.sampleof))
        || !(value.defaultBios === undefined || value.defaultBios === null || isNonEmptyString(value.defaultBios))
        || !isArrayOf(value.archives, isMetadataArchive)
        || !isArrayOf(value.roms, isMetadataRom)
        || !isArrayOf(value.samples, isMetadataSample)) return false;

    const bios = value.bios as string[];
    const archives = value.archives as RomSetMetadata["archives"];
    const roms = value.roms as RomSetMetadata["roms"];
    const samples = value.samples as RomSetMetadata["samples"];
    if (!uniqueCaseFolded(bios) || !uniqueCaseFolded(archives.map((archive) => archive.name))) return false;

    const roles = new Map(archives.map((archive) => [romNameKey(archive.name), archive.role]));
    return roms.every((rom) => {
        const role = roles.get(romNameKey(rom.archive));
        return role !== undefined && role !== "samples";
    }) && samples.every((sample) => roles.get(romNameKey(sample.archive)) === "samples");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a byte-free report whose rows refer to declared archives.
export function isRomSetReport(value: unknown): value is RomSetReport {
    if (!isObject(value)
        || !isNonEmptyString(value.machine)
        || !(value.status === "ok" || value.status === "incomplete" || value.status === "bad")
        || !isArrayOf(value.archives, isReportArchive)
        || !isArrayOf(value.files, isReportFile)
        || !isArrayOf(value.unexpected, isUnexpectedFile)
        || !isArrayOf(value.problems, isArchiveProblem)) return false;

    const archives = value.archives as RomSetReport["archives"];
    if (!uniqueCaseFolded(archives.map((archive) => archive.name))) return false;
    const archiveNames = new Set(archives.map((archive) => romNameKey(archive.name)));
    return (value.files as RomSetReport["files"]).every((file) => archiveNames.has(romNameKey(file.archive)))
        && (value.unexpected as RomSetReport["unexpected"]).every((file) => archiveNames.has(romNameKey(file.archive)))
        && (value.problems as RomSetReport["problems"]).every((problem) => archiveNames.has(romNameKey(problem.archive)));
}
