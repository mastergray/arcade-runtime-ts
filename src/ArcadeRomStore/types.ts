// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeRomStore (configuration, metadata and injected hashing)

// Dependencies:
import { isFiniteNumber, isNonEmptyString, isRomName, type NonEmptyString, type RomName } from "../shared.types.js";   // Public value guards
import { isIDBFactoryLike, type IDBFactoryLike } from "../ArcadeStorage/types.js";   // Shared IndexedDB injection boundary

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {digest:(AlgorithmIdentifier, BufferSource -> PROMISE(ArrayBuffer))}
// The Web Crypto operation needed to fingerprint bytes; crypto.subtle satisfies it structurally.
export interface SubtleCryptoLike {
    digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer>;   // Computes one digest
}

// INTERFACE :: direct-construction dependencies and optional database name
// Constructors read no globals: IndexedDB, SHA-256 and time are all injected here.
export interface ArcadeRomStoreConfig {
    readonly indexedDB: IDBFactoryLike;                            // Browser-local record storage
    readonly subtle: SubtleCryptoLike;                             // SHA-256 implementation
    readonly now: () => number;                                    // addedAt timestamp source
    readonly name?: NonEmptyString;                                // Database override; defaults to arcade-runtime-roms
}

// INTERFACE :: arcadeRomStoreConfig with optional browser defaults
// init() accepts this shape and supplies omitted IndexedDB, Web Crypto and wall-clock dependencies.
export interface ArcadeRomStoreInitConfig {
    readonly indexedDB?: IDBFactoryLike;                           // Defaults to globalThis.indexedDB
    readonly subtle?: SubtleCryptoLike;                            // Defaults to globalThis.crypto.subtle
    readonly now?: () => number;                                  // Defaults to Date.now
    readonly name?: NonEmptyString;                                // Database override
}

// INTERFACE :: {name:romName, size:NUMBER, sha256:STRING, addedAt:NUMBER}
// Byte-free metadata returned by list().
export interface RomStoreEntry {
    readonly name: RomName;                                       // Original archive basename
    readonly size: number;                                        // Archive bytes in storage
    readonly sha256: string;                                      // Lower-case SHA-256 hex
    readonly addedAt: number;                                     // Timestamp supplied when put() ran
}

/**
 *
 * Constants
 *
 */

const SHA256_PATTERN = /^[0-9a-f]{64}$/;                          // Canonical SHA-256 text

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies the SubtleCrypto digest operation.
export function isSubtleCryptoLike(value: unknown): value is SubtleCryptoLike {
    return typeof value === "object" && value !== null
        && typeof (value as SubtleCryptoLike).digest === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every direct-construction dependency and optional database name is valid.
export function isArcadeRomStoreConfig(value: unknown): value is ArcadeRomStoreConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as ArcadeRomStoreConfig;
    return isIDBFactoryLike(config.indexedDB)
        && isSubtleCryptoLike(config.subtle)
        && typeof config.now === "function"
        && (config.name === undefined || isNonEmptyString(config.name));
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every supplied init dependency and optional database name is valid.
export function isArcadeRomStoreInitConfig(value: unknown): value is ArcadeRomStoreInitConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as ArcadeRomStoreInitConfig;
    return (config.indexedDB === undefined || isIDBFactoryLike(config.indexedDB))
        && (config.subtle === undefined || isSubtleCryptoLike(config.subtle))
        && (config.now === undefined || typeof config.now === "function")
        && (config.name === undefined || isNonEmptyString(config.name));
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is byte-free ROM metadata with canonical hash and timestamp fields.
export function isRomStoreEntry(value: unknown): value is RomStoreEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as RomStoreEntry;
    return isRomName(entry.name)
        && Number.isSafeInteger(entry.size) && entry.size >= 0
        && typeof entry.sha256 === "string" && SHA256_PATTERN.test(entry.sha256)
        && isFiniteNumber(entry.addedAt) && entry.addedAt >= 0;
}
