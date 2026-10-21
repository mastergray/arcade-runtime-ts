// realizes: docs/arcade-runtime-spec.md > §2.4 Save-overlay wire format

// Dependencies:
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";   // Deterministic zip encoding and bounded decoding
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed overlay/config rejection

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: stable identity stored in overlay.json
export interface OverlayHeader {
    readonly format: "arcade-runtime-overlay";                    // Wire-format identity
    readonly version: 1;                                          // Wire-format version
    readonly adapter: "mame";                                    // Adapter identity
    readonly engine: string;                                      // Family build id
    readonly buildId: string;                                     // Exact build fingerprint
    readonly machine: string;                                     // MAME machine short name
}

// TYPE :: {[logicalPath]:UINT8ARRAY}
// Complete cumulative persisted file tree below the four logical roots.
export type OverlayTree = Readonly<Record<string, Uint8Array>>;

// INTERFACE :: safety ceilings applied before any archive payload is inflated
export interface OverlayLimits {
    readonly compressedBytes: number;                             // Maximum archive byte length
    readonly expandedBytes: number;                               // Maximum sum of declared entry sizes
    readonly files: number;                                       // Maximum persisted files, excluding overlay.json
}

/**
 *
 * Constants
 *
 */

export const OVERLAY_LIMITS: OverlayLimits = Object.freeze({
    compressedBytes: 64 * 1024 * 1024,
    expandedBytes: 256 * 1024 * 1024,
    files: 4_096,
});                                                               // §2.4 default reader/writer limits

const ROOTS = new Set(["nvram", "cfg", "states", "memcard"]);   // Legal logical roots
const HEADER_PATH = "overlay.json";                               // Sole archive-level metadata entry
const FIXED_MTIME = new Date(2000, 0, 1, 0, 0, 0);                // Stable DOS timestamp independent of the current instant
const END_SIGNATURE = 0x0605_4b50;                                // Zip end-of-central-directory signature
const CENTRAL_SIGNATURE = 0x0201_4b50;                            // Zip central-entry signature
const UNIX_SYMLINK = 0xa000;                                      // POSIX mode type bits for a symbolic link

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, UNKNOWN -> arcadeRuntimeError
// Builds an INVALID_CONFIG rejection without leaking archive payload bytes.
const invalid = (message: string, data: unknown = null): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
    message,
    data,
});

// HELPER :: STRING, UNKNOWN -> arcadeRuntimeError
// Builds the strict identity-mismatch rejection.
const incompatible = (message: string, data: unknown = null): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.OVERLAY_INCOMPATIBLE,
    message,
    data,
});

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is the complete v1 MAME overlay identity shape.
export function isOverlayHeader(value: unknown): value is OverlayHeader {
    if (typeof value !== "object" || value === null) return false;
    const header = value as OverlayHeader;
    return header.format === "arcade-runtime-overlay"
        && header.version === 1
        && header.adapter === "mame"
        && typeof header.engine === "string" && /\S/.test(header.engine)
        && typeof header.buildId === "string" && /^[0-9a-f]{64}$/.test(header.buildId)
        && typeof header.machine === "string" && /\S/.test(header.machine);
}

// HELPER :: overlayHeader -> overlayHeader
// Rebuilds the object in canonical JSON property order.
const canonicalHeader = (header: OverlayHeader): OverlayHeader => ({
    format: "arcade-runtime-overlay",
    version: 1,
    adapter: "mame",
    engine: header.engine,
    buildId: header.buildId,
    machine: header.machine,
});

// HELPER :: STRING -> VOID
// Enforces every §2.4 logical-path rejection rule.
const assertLogicalPath = (path: string): void => {
    if (path.length === 0) throw invalid("Overlay paths cannot be empty.");
    if (path.startsWith("/")) throw invalid("Overlay paths cannot be absolute.", path);
    if (path.includes("\\")) throw invalid("Overlay paths cannot contain backslashes.", path);
    if (path.includes("\0")) throw invalid("Overlay paths cannot contain NUL bytes.");
    const segments = path.split("/");
    if (segments.some((segment) => segment.length === 0)) throw invalid("Overlay paths cannot contain empty segments.", path);
    if (segments.some((segment) => segment === "." || segment === "..")) throw invalid("Overlay paths cannot contain dot segments.", path);
    if (segments.length < 2 || !ROOTS.has(segments[0]!)) throw invalid("Overlay entries must be files below a supported logical root.", path);
};

// HELPER :: overlayTree -> [[STRING,UINT8ARRAY]]
// Validates paths, values, case-folded uniqueness and expanded/file limits, then returns sorted entries.
const checkedTreeEntries = (tree: OverlayTree): Array<[string, Uint8Array]> => {
    if (typeof tree !== "object" || tree === null || Array.isArray(tree)) throw invalid("Overlay tree must be a path-to-bytes object.");
    const entries = Object.entries(tree);
    if (entries.length > OVERLAY_LIMITS.files) throw invalid("Overlay exceeds the 4,096-file limit.", entries.length);
    const folded = new Set<string>();
    let expanded = 0;
    for (const [path, bytes] of entries) {
        assertLogicalPath(path);
        if (!(bytes instanceof Uint8Array)) throw invalid("Every overlay file must be a Uint8Array.", path);
        const key = path.toLowerCase();
        if (folded.has(key)) throw invalid("Overlay paths must be unique after case folding.", path);
        folded.add(key);
        expanded += bytes.byteLength;
        if (!Number.isSafeInteger(expanded) || expanded > OVERLAY_LIMITS.expandedBytes) {
            throw invalid("Overlay exceeds the 256 MiB expanded-size limit.", expanded);
        }
    }
    return entries.sort(([left], [right]) => left.localeCompare(right));
};

// HELPER :: UINT8ARRAY, NUMBER, NUMBER -> VOID
// Guards a central-directory integer read.
const requireBytes = (bytes: Uint8Array, offset: number, length: number): void => {
    if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > bytes.length) throw invalid("Overlay is not a valid zip archive.");
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Reads an unsigned little-endian 16-bit field.
const uint16 = (bytes: Uint8Array, offset: number): number => {
    requireBytes(bytes, offset, 2);
    return bytes[offset]! + bytes[offset + 1]! * 0x100;
};

// HELPER :: UINT8ARRAY, NUMBER -> NUMBER
// Reads an unsigned little-endian 32-bit field without signed bitwise overflow.
const uint32 = (bytes: Uint8Array, offset: number): number => {
    requireBytes(bytes, offset, 4);
    return (bytes[offset]!
        + bytes[offset + 1]! * 0x100
        + bytes[offset + 2]! * 0x1_0000
        + bytes[offset + 3]! * 0x100_0000) >>> 0;
};

// HELPER :: UINT8ARRAY -> NUMBER
// Finds the ordinary end record inside the legal zip-comment window.
const endOffset = (bytes: Uint8Array): number => {
    const first = Math.max(0, bytes.length - 22 - 65_535);
    for (let offset = bytes.length - 22; offset >= first; offset--) {
        if (uint32(bytes, offset) === END_SIGNATURE) return offset;
    }
    throw invalid("Overlay is not a valid zip archive.");
};

// HELPER :: UINT8ARRAY -> [BOOLEAN]
// Reads external POSIX type bits without inflating data; true marks a symlink entry.
const centralSymlinks = (bytes: Uint8Array): boolean[] => {
    const end = endOffset(bytes);
    const count = uint16(bytes, end + 10);
    let offset = uint32(bytes, end + 16);
    const result: boolean[] = [];
    for (let index = 0; index < count; index++) {
        requireBytes(bytes, offset, 46);
        if (uint32(bytes, offset) !== CENTRAL_SIGNATURE) throw invalid("Overlay has a malformed central directory.");
        const madeBy = uint16(bytes, offset + 4);
        const host = madeBy >>> 8;
        const attributes = uint32(bytes, offset + 38);
        const mode = attributes >>> 16;
        result.push(host === 3 && (mode & 0xf000) === UNIX_SYMLINK);
        const recordLength = 46 + uint16(bytes, offset + 28) + uint16(bytes, offset + 30) + uint16(bytes, offset + 32);
        requireBytes(bytes, offset, recordLength);
        offset += recordLength;
    }
    return result;
};

// HELPER :: overlayHeader, overlayHeader -> BOOLEAN
// Strict v1 identity equality.
const sameHeader = (actual: OverlayHeader, expected: OverlayHeader): boolean => actual.format === expected.format
    && actual.version === expected.version
    && actual.adapter === expected.adapter
    && actual.engine === expected.engine
    && actual.buildId === expected.buildId
    && actual.machine === expected.machine;

/**
 *
 * Class
 *
 */

// Deterministic, bounded codec for complete cumulative save overlays.
export default class OverlayCodec {

    // Static-only service; construction would carry no state.
    private constructor() {}

    // STATIC :: overlayTree, overlayHeader -> UINT8ARRAY
    // Encodes sorted paths with a fixed timestamp and no directory entries.
    static encode(tree: OverlayTree, header: OverlayHeader): Uint8Array {
        if (!isOverlayHeader(header)) throw invalid("Overlay header is invalid.");
        const entries = checkedTreeEntries(tree);
        const archive: Record<string, Uint8Array | [Uint8Array, { mtime: Date }]> = {
            [HEADER_PATH]: [strToU8(JSON.stringify(canonicalHeader(header))), { mtime: FIXED_MTIME }],
        };
        for (const [path, bytes] of entries) archive[path] = [bytes.slice(), { mtime: FIXED_MTIME }];
        let encoded: Uint8Array;
        try {
            encoded = zipSync(archive, { level: 6, mtime: FIXED_MTIME });
        } catch (error) {
            throw invalid("Overlay could not be encoded.", error);
        }
        if (encoded.byteLength > OVERLAY_LIMITS.compressedBytes) throw invalid("Overlay exceeds the 64 MiB compressed-size limit.", encoded.byteLength);
        return encoded;
    }

    // STATIC :: UINT8ARRAY, overlayHeader -> overlayTree
    // Validates central-directory metadata and identity before inflating any file.
    static decode(bytes: Uint8Array, expectedHeader: OverlayHeader): Record<string, Uint8Array> {
        if (!(bytes instanceof Uint8Array)) throw invalid("Overlay bytes must be a Uint8Array.");
        if (!isOverlayHeader(expectedHeader)) throw invalid("Expected overlay header is invalid.");
        if (bytes.byteLength > OVERLAY_LIMITS.compressedBytes) throw invalid("Overlay exceeds the 64 MiB compressed-size limit.", bytes.byteLength);

        const metadata: Array<{ readonly name: string; readonly originalSize: number }> = [];
        try {
            unzipSync(bytes, {
                filter: (entry) => {
                    metadata.push({ name: entry.name, originalSize: entry.originalSize });
                    if (metadata.length > OVERLAY_LIMITS.files + 1) throw invalid("Overlay exceeds the 4,096-file limit.");
                    return false;
                },
            });
        } catch (error) {
            if (ArcadeRuntimeError.is(error)) throw error;
            throw invalid("Overlay is not a valid zip archive.", error);
        }

        const symlinks = centralSymlinks(bytes);
        if (symlinks.length !== metadata.length) throw invalid("Overlay central-directory entry count is inconsistent.");
        const folded = new Set<string>();
        let expanded = 0;
        let headerCount = 0;
        let fileCount = 0;
        metadata.forEach((entry, index) => {
            const key = entry.name.toLowerCase();
            if (folded.has(key)) throw invalid("Overlay paths must be unique after case folding.", entry.name);
            folded.add(key);
            if (symlinks[index]) throw invalid("Overlay cannot contain symbolic links.", entry.name);
            if (entry.name === HEADER_PATH) headerCount++;
            else {
                assertLogicalPath(entry.name);
                fileCount++;
            }
            expanded += entry.originalSize;
            if (!Number.isSafeInteger(expanded) || expanded > OVERLAY_LIMITS.expandedBytes) {
                throw invalid("Overlay exceeds the 256 MiB expanded-size limit.", expanded);
            }
        });
        if (fileCount > OVERLAY_LIMITS.files) throw invalid("Overlay exceeds the 4,096-file limit.", fileCount);
        if (headerCount !== 1) throw incompatible("Overlay does not contain exactly one overlay.json header.");

        let unzipped: Record<string, Uint8Array>;
        try {
            unzipped = unzipSync(bytes);
        } catch (error) {
            throw invalid("Overlay payload could not be inflated.", error);
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(strFromU8(unzipped[HEADER_PATH]!, true));
        } catch (error) {
            throw incompatible("Overlay header is not valid JSON.", error);
        }
        if (!isOverlayHeader(parsed) || !sameHeader(parsed, expectedHeader)) {
            throw incompatible("Overlay belongs to a different adapter, engine, build or machine.", parsed);
        }
        const tree: Record<string, Uint8Array> = {};
        for (const entry of metadata) {
            if (entry.name !== HEADER_PATH) tree[entry.name] = unzipped[entry.name]!.slice();
        }
        return tree;
    }

    // STATIC :: overlayTree -> STRING
    // Stable two-lane FNV-1a digest used only for dirty detection.
    static hashTree(tree: OverlayTree): string {
        const entries = checkedTreeEntries(tree);
        let left = 0x811c_9dc5;
        let right = 0x9e37_79b9;
        const add = (byte: number): void => {
            left = Math.imul(left ^ byte, 0x0100_0193) >>> 0;
            right = Math.imul(right ^ byte, 0x85eb_ca6b) >>> 0;
        };
        for (const [path, bytes] of entries) {
            for (const byte of strToU8(path)) add(byte);
            add(0);
            for (const byte of bytes) add(byte);
            add(0xff);
        }
        return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
    }
}
