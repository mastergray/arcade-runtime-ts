// realizes: docs/arcade-runtime-spec.md > §10.5 RomSetAudit

// Dependencies:
import { unzipSync } from "fflate";                                // Synchronous central-directory traversal with extraction filtered out
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // INVALID_CONFIG for invalid caller values
import {
    isRomFile,                                                     // Guards every supplied archive
    romNameKey,                                                    // Case-insensitive archive matching
} from "../shared.types.js";
import { classifyAuditFile, isAuditStrictness, isRomSetMetadata } from "./types.js";   // Guards inputs and classifies true file results

// Type dependencies:
import type { UnzipFileInfo } from "fflate";                       // Metadata exposed to unzipSync's filter
import type { RomFile } from "../shared.types.js";                 // Supplied zip bytes
import type { AuditStrictness, RomSetMetadata, RomSetReport } from "./types.js";   // Audit input, policy and byte-free result

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: central-directory fields needed for one expected-file comparison
// CRC32 is canonical lower-case text so it compares directly with metadata.
interface ArchiveEntry {
    readonly name: string;                                        // Zip entry name as fflate decoded it
    readonly size: number;                                        // Uncompressed byte length
    readonly crc: string;                                         // Eight lower-case CRC32 hex digits
}

// TYPE :: inspected archive or stable problem reason
// Problems deliberately carry no thrown fflate object or archive bytes.
type ArchiveInspection =
    | { readonly entries: ReadonlyArray<ArchiveEntry>; readonly byName: ReadonlyMap<string, ArchiveEntry> }
    | { readonly reason: string };

/**
 *
 * Constants
 *
 */

const MAX_ARCHIVE_ENTRIES = 4_096;                                // Shared archive-entry safety ceiling
const INVALID_ZIP_REASON = "invalid or corrupt zip central directory";
const ENTRY_LIMIT_REASON = "archive exceeds 4,096 entries";
const END_SIGNATURE = 0x06054b50;                                 // End of central directory
const ZIP64_END_SIGNATURE = 0x06064b50;                           // Zip64 end of central directory
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;                       // Zip64 end locator
const CENTRAL_ENTRY_SIGNATURE = 0x02014b50;                       // One central-directory file header

/**
 *
 * Classes
 *
 */

// Internal sentinel distinguishing the documented archive limit from malformed zip data.
class ArchiveEntryLimitError extends Error {}

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY, NUMBER, NUMBER -> VOID
// Rejects a read that would leave the supplied archive buffer.
const requireBytes = (bytes: Uint8Array, offset: number, length: number): void => {
    if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > bytes.length) throw new Error(INVALID_ZIP_REASON);
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Reads an unsigned little-endian 16-bit zip field.
const uint16 = (bytes: Uint8Array, offset: number): number => {
    requireBytes(bytes, offset, 2);
    return bytes[offset]! | bytes[offset + 1]! << 8;
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Reads an unsigned little-endian 32-bit zip field without signed bitwise overflow.
const uint32 = (bytes: Uint8Array, offset: number): number => {
    requireBytes(bytes, offset, 4);
    return (bytes[offset]!
        + bytes[offset + 1]! * 0x100
        + bytes[offset + 2]! * 0x1_0000
        + bytes[offset + 3]! * 0x100_0000) >>> 0;
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Reads a Zip64 integer only when JavaScript can represent it exactly.
const uint64 = (bytes: Uint8Array, offset: number): number => {
    const value = uint32(bytes, offset) + uint32(bytes, offset + 4) * 0x1_0000_0000;
    if (!Number.isSafeInteger(value)) throw new Error(INVALID_ZIP_REASON);
    return value;
};

// HELPER :: UINT8ARRAY -> NUMBER
// Locates the final end record within the maximum legal zip-comment window.
const endRecordOffset = (bytes: Uint8Array): number => {
    const first = Math.max(0, bytes.length - 22 - 65_535);
    for (let offset = bytes.length - 22; offset >= first; offset--) {
        if (uint32(bytes, offset) === END_SIGNATURE) return offset;
    }
    throw new Error(INVALID_ZIP_REASON);
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Resolves the central-directory start from a standard or Zip64 end record.
const centralDirectoryOffset = (bytes: Uint8Array, endOffset: number): number => {
    const ordinaryOffset = uint32(bytes, endOffset + 16);
    if (ordinaryOffset !== 0xffff_ffff) return ordinaryOffset;

    const locatorOffset = endOffset - 20;
    if (uint32(bytes, locatorOffset) !== ZIP64_LOCATOR_SIGNATURE) throw new Error(INVALID_ZIP_REASON);
    const zip64Offset = uint64(bytes, locatorOffset + 8);
    if (uint32(bytes, zip64Offset) !== ZIP64_END_SIGNATURE) throw new Error(INVALID_ZIP_REASON);
    return uint64(bytes, zip64Offset + 48);
};

// HELPER :: UINT8ARRAY, NUMBER -> [STRING]
// Reads CRC32 values in central-directory order and validates each header boundary.
const centralDirectoryCrcs = (bytes: Uint8Array, count: number): string[] => {
    let offset = centralDirectoryOffset(bytes, endRecordOffset(bytes));
    const crcs: string[] = [];
    for (let index = 0; index < count; index++) {
        requireBytes(bytes, offset, 46);
        if (uint32(bytes, offset) !== CENTRAL_ENTRY_SIGNATURE) throw new Error(INVALID_ZIP_REASON);
        crcs.push(uint32(bytes, offset + 16).toString(16).padStart(8, "0"));
        const nameLength = uint16(bytes, offset + 28);
        const extraLength = uint16(bytes, offset + 30);
        const commentLength = uint16(bytes, offset + 32);
        const recordLength = 46 + nameLength + extraLength + commentLength;
        requireBytes(bytes, offset, recordLength);
        offset += recordLength;
    }
    return crcs;
};

// HELPER :: UINT8ARRAY -> archiveInspection
// Uses unzipSync's filter as a synchronous metadata path. Returning false for every
// entry prevents fflate from slicing or inflating entry data; only central-directory
// names and sizes are visited. fflate does not expose CRC32 in UnzipFileInfo, so the
// adjacent parser above reads that one field from the same central-directory records.
const inspectArchive = (bytes: Uint8Array): ArchiveInspection => {
    try {
        const metadata: UnzipFileInfo[] = [];
        unzipSync(bytes, {
            filter: (entry) => {
                if (metadata.length === MAX_ARCHIVE_ENTRIES) throw new ArchiveEntryLimitError();
                metadata.push(entry);
                return false;
            },
        });
        const crcs = centralDirectoryCrcs(bytes, metadata.length);
        const entries = metadata.map((entry, index): ArchiveEntry => ({
            name: entry.name,
            size: entry.originalSize,
            crc: crcs[index]!,
        }));
        const byName = new Map<string, ArchiveEntry>();
        for (const entry of entries) {
            const key = entry.name.toLowerCase();
            if (!byName.has(key)) byName.set(key, entry);
        }
        return { entries, byName };
    } catch (error) {
        return { reason: error instanceof ArchiveEntryLimitError ? ENTRY_LIMIT_REASON : INVALID_ZIP_REASON };
    }
};

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an array of valid RomFiles with unique case-folded names.
const isRomFileList = (value: unknown): value is RomFile[] => Array.isArray(value)
    && value.every(isRomFile)
    && new Set(value.map((rom) => romNameKey(rom.name))).size === value.length;

// HELPER :: archiveInspection? -> archiveEntry?
// Finds an entry case-insensitively only when the archive was present and valid.
const entryIn = (inspection: ArchiveInspection | undefined, name: string): ArchiveEntry | undefined =>
    inspection !== undefined && "entries" in inspection ? inspection.byName.get(name.toLowerCase()) : undefined;

// HELPER :: archiveInspection?, STRING, STRING, NUMBER -> archiveEntry?
// Finds the expected entry by name, or by exact CRC32 and size when the name is absent. MAME's own loader
// falls back to a CRC match inside the archive, so a set from another naming generation still loads.
const locateEntry = (inspection: ArchiveInspection | undefined, name: string, crc: string, size: number): ArchiveEntry | undefined => {
    const byName = entryIn(inspection, name);
    if (byName !== undefined || inspection === undefined || !("entries" in inspection)) return byName;
    return inspection.entries.find((entry) => entry.crc === crc && entry.size === size);
};

/**
 *
 * Class
 *
 */

// Audits user-supplied zip central directories against resolved per-machine metadata.
export default class RomSetAudit {

    // Static-only service; construction would carry no useful state.
    private constructor() {}

    /**
     *
     * Static Methods
     *
     */

    // STATIC :: romSetMetadata, [romFile] -> romSetReport
    // Inspects only expected archives and returns an actionable, byte-free report.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG only when metadata or roms fail their predicates.
    // NOTE: Invalid, corrupt and over-limit zip bytes become problems and missing file rows; they never throw.
    // NOTE: A ROM tagged with a BIOS option is required only when that option is the selected one (options.bios,
    // else the metadata default); MAME audits the same way, so other options' ROMs report optional-missing.
    static audit(metadata: RomSetMetadata, roms: RomFile[], options: { readonly bios?: string; readonly strictness?: AuditStrictness } = {}): RomSetReport {
        if (!isRomSetMetadata(metadata)) throw RomSetAudit.invalidConfig("RomSetAudit metadata is invalid.", "metadata");
        if (!isRomFileList(roms)) throw RomSetAudit.invalidConfig("RomSetAudit ROM files are invalid.", "roms");
        if (options.bios !== undefined && typeof options.bios !== "string") throw RomSetAudit.invalidConfig("RomSetAudit bios must be a string.", "bios");
        if (options.strictness !== undefined && !isAuditStrictness(options.strictness)) throw RomSetAudit.invalidConfig("RomSetAudit strictness must be strict or mame.", "strictness");
        const strictness = options.strictness ?? "strict";
        const selectedBios = options.bios ?? metadata.defaultBios ?? null;
        const isRequired = (rom: RomSetMetadata["roms"][number]): boolean => !rom.optional && (rom.bios === undefined || rom.bios === null || rom.bios === selectedBios);

        const supplied = new Map(roms.map((rom) => [romNameKey(rom.name), rom]));
        const inspections = new Map<string, ArchiveInspection>();
        for (const archive of metadata.archives) {
            const key = romNameKey(archive.name);
            const rom = supplied.get(key);
            if (rom !== undefined) inspections.set(key, inspectArchive(rom.bytes));
        }

        const requiredArchives = new Set(metadata.roms
            .filter((rom) => isRequired(rom) && (rom.device === undefined || rom.device === null))
            .map((rom) => romNameKey(rom.archive)));
        const archives: RomSetReport["archives"] = metadata.archives.map((archive) => ({
            name: archive.name,
            role: archive.role,
            present: supplied.has(romNameKey(archive.name)),
            required: requiredArchives.has(romNameKey(archive.name)),
        }));

        const matched = new Map<string, Set<string>>();           // archive key → entry names claimed by name or CRC
        const claim = (archive: string, entry: ArchiveEntry | undefined): void => {
            if (entry === undefined) return;
            const key = romNameKey(archive);
            const names = matched.get(key) ?? new Set<string>();
            names.add(entry.name.toLowerCase());
            matched.set(key, names);
        };
        const setArchives = metadata.archives.filter((archive) => archive.role === "game" || archive.role === "parent" || archive.role === "bios").map((archive) => archive.name);
        const files: Array<RomSetReport["files"][number]> = metadata.roms.map((rom) => {
            // A device ROM is looked up in its device archive first, then in the game, parent and BIOS archives in that
            // order, which is where MAME's loader also searches when <device>.zip is absent.
            let entry = locateEntry(inspections.get(romNameKey(rom.archive)), rom.name, rom.crc, rom.size);
            let foundIn = rom.archive;
            if (entry === undefined && rom.device !== undefined && rom.device !== null) {
                for (const archive of setArchives) {
                    entry = locateEntry(inspections.get(romNameKey(archive)), rom.name, rom.crc, rom.size);
                    if (entry !== undefined) { foundIn = archive; break; }
                }
            }
            claim(foundIn, entry);
            let status: RomSetReport["files"][number]["status"];
            if (entry === undefined) status = isRequired(rom) ? "missing" : "optional-missing";
            else if (entry.size !== rom.size) status = "wrong-size";
            else if (entry.crc !== rom.crc) status = "wrong-crc";
            else status = "ok";
            return { name: rom.name, archive: rom.archive, status };
        });
        for (const sample of metadata.samples) {
            const entry = entryIn(inspections.get(romNameKey(sample.archive)), sample.name);
            claim(sample.archive, entry);
            files.push({
                name: sample.name,
                archive: sample.archive,
                status: entry === undefined ? "optional-missing" : "ok",
            });
        }

        const unexpected: Array<RomSetReport["unexpected"][number]> = [];
        for (const archive of metadata.archives) {
            const key = romNameKey(archive.name);
            const inspection = inspections.get(key);
            if (inspection === undefined || !("entries" in inspection)) continue;
            const archiveClaims = matched.get(key) ?? new Set<string>();
            for (const entry of inspection.entries) {
                if (!archiveClaims.has(entry.name.toLowerCase())) unexpected.push({ archive: archive.name, name: entry.name });
            }
        }

        const problems: Array<RomSetReport["problems"][number]> = [];
        for (const archive of metadata.archives) {
            const inspection = inspections.get(romNameKey(archive.name));
            if (inspection !== undefined && "reason" in inspection) problems.push({ archive: archive.name, reason: inspection.reason });
        }

        const requiredFiles = files.slice(0, metadata.roms.length).flatMap((file, index) => {
            const rom = metadata.roms[index]!;
            return isRequired(rom) ? [{ file, rom }] : [];
        });
        const failures = requiredFiles.filter(({ file, rom }) => classifyAuditFile(rom.region, file.status, strictness) === "failure");
        const warnings: RomSetReport["warnings"] = files.slice(0, metadata.roms.length).flatMap((file, index) => {
            const rom = metadata.roms[index]!;
            return isRequired(rom) && classifyAuditFile(rom.region, file.status, strictness) === "warning"
                ? [{ name: file.name, archive: file.archive, status: file.status as "missing" | "wrong-size" | "wrong-crc" }]
                : [];
        });
        const status = failures.some(({ file }) => file.status === "wrong-size" || file.status === "wrong-crc")
            ? "bad"
            : failures.some(({ file }) => file.status === "missing") ? "incomplete" : "ok";
        return { machine: metadata.machine, status, strictness, archives, files, warnings, unexpected, problems };
    }

    // HELPER :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds the package's sole error type for invalid audit arguments.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }

}
