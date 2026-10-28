// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeRomStore

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // INVALID_CONFIG and UNSUPPORTED failures
import { PURE_SHA256_SUBTLE } from "./sha256.js";           // Digest fallback outside secure contexts
import { storageFailed, withObjectStore } from "../ArcadeStorage/indexedDB.js";   // Complete IndexedDB failure boundary
import { isRomFile, isRomName, romNameKey } from "../shared.types.js";   // Public ROM validation and key folding

// Type dependencies:
import type { NonEmptyString, RomFile, RomName } from "../shared.types.js";   // Stored archive shapes and names
import type { IDBFactoryLike } from "../ArcadeStorage/types.js";   // Browser-local factory dependency
import {
    isArcadeRomStoreConfig,                                     // Guards direct construction
    isArcadeRomStoreInitConfig,                                 // Guards init before reading browser globals
    isRomStoreEntry,                                            // Guards stored byte-free metadata
    type ArcadeRomStoreConfig,                                  // Fully injected constructor config
    type ArcadeRomStoreInitConfig,                              // Browser-defaulting init config
    type RomStoreEntry,                                         // Byte-free list result
    type SubtleCryptoLike,                                      // SHA-256 dependency
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: romStoreEntry & {bytes:Uint8Array}
// Private IndexedDB record; the object-store key is romNameKey(name).
interface RomStoreRecord extends RomStoreEntry {
    readonly bytes: Uint8Array;                                   // Defensive archive copy, never returned by list()
}

/**
 *
 * Functions
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a complete internally stored record whose size agrees with its bytes.
const isRomStoreRecord = (value: unknown): value is RomStoreRecord => isRomStoreEntry(value)
    && (value as RomStoreRecord).bytes instanceof Uint8Array
    && (value as RomStoreRecord).size === (value as RomStoreRecord).bytes.length;

// HELPER :: ArrayBuffer -> STRING
// Encodes a digest as canonical lower-case hexadecimal text.
const hex = (digest: ArrayBuffer): string => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 *
 * Class
 *
 */

// Keeps user-supplied ROM archives in browser-local IndexedDB and exposes only byte-free list metadata.
export default class ArcadeRomStore {

    /* Static Fields */
    static readonly DB_NAME: NonEmptyString = "arcade-runtime-roms";   // Default origin-local ROM database
    static readonly STORE_NAME: NonEmptyString = "archives";          // Records keyed by romNameKey(name)
    static readonly DB_VERSION = 1;                                   // Initial and current schema

    /* Instance Fields */
    private readonly _indexedDB: IDBFactoryLike;                       // Injected factory; constructors read no globals
    private readonly _subtle: SubtleCryptoLike;                        // Injected SHA-256 implementation
    private readonly _now: () => number;                               // Injected timestamp source
    private readonly _databaseName: NonEmptyString;                    // Default or page-selected isolated database

    // CONSTRUCTOR :: arcadeRomStoreConfig -> this
    // Creates a lazy local store; IndexedDB is not opened until an operation runs.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isArcadeRomStoreConfig().
    constructor(config: ArcadeRomStoreConfig) {
        if (!isArcadeRomStoreConfig(config)) throw ArcadeRomStore.invalidConfig("ArcadeRomStore config is invalid.", config);
        this._indexedDB = config.indexedDB;
        this._subtle = config.subtle;
        this._now = config.now;
        this._databaseName = config.name ?? ArcadeRomStore.DB_NAME;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> PROMISE([romStoreEntry])
    // Returns byte-free metadata sorted by case-folded archive name.
    // NOTE: Operational failures reject with STORAGE_FAILED.
    async list(): Promise<ReadonlyArray<RomStoreEntry>> {
        const stored = await withObjectStore<unknown[]>(this._indexedDB, this._databaseName, ArcadeRomStore.DB_VERSION, ArcadeRomStore.STORE_NAME, "readonly", (store) => store.getAll());
        if (!Array.isArray(stored) || !stored.every(isRomStoreRecord)) throw storageFailed("IndexedDB returned an invalid ROM-store record.", stored);
        return stored
            .map(({ name, size, sha256, addedAt }) => ({ name, size, sha256, addedAt }))
            .sort((left, right) => {
                const leftKey = romNameKey(left.name);
                const rightKey = romNameKey(right.name);
                return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
            });
    }

    // INSTANCE :: romFile -> PROMISE(VOID)
    // Hashes and stores a defensive archive copy, replacing the case-folded name key.
    // NOTE: Throws INVALID_CONFIG for a non-RomFile; operational failures reject with STORAGE_FAILED.
    async put(file: RomFile): Promise<void> {
        if (!isRomFile(file)) throw ArcadeRomStore.invalidConfig("ArcadeRomStore.put requires a RomFile.", file);
        const bytes = file.bytes.slice();
        let sha256: string;
        try {
            sha256 = hex(await this._subtle.digest("SHA-256", bytes));
        } catch (error) {
            throw storageFailed("SHA-256 digest failed.", error);
        }

        let addedAt: number;
        try {
            addedAt = this._now();
        } catch (error) {
            throw storageFailed("ROM-store timestamp failed.", error);
        }
        if (!Number.isFinite(addedAt) || addedAt < 0) throw storageFailed("ROM-store timestamp was invalid.", addedAt);

        const record: RomStoreRecord = { name: file.name, bytes, size: bytes.length, sha256, addedAt };
        await withObjectStore(this._indexedDB, this._databaseName, ArcadeRomStore.DB_VERSION, ArcadeRomStore.STORE_NAME, "readwrite", (store) => store.put(record, romNameKey(file.name)));
    }

    // INSTANCE :: STRING -> PROMISE(romFile?)
    // Returns a defensive archive copy for a case-insensitive basename, or null when absent.
    // NOTE: Throws INVALID_CONFIG for an invalid ROM name; operational failures reject with STORAGE_FAILED.
    async get(name: string): Promise<RomFile | null> {
        const romName = ArcadeRomStore.validName(name, "ArcadeRomStore.get");
        const stored = await withObjectStore<unknown>(this._indexedDB, this._databaseName, ArcadeRomStore.DB_VERSION, ArcadeRomStore.STORE_NAME, "readonly", (store) => store.get(romNameKey(romName)));
        if (stored === undefined) return null;
        if (!isRomStoreRecord(stored)) throw storageFailed("IndexedDB returned an invalid ROM-store record.", stored);
        return { name: stored.name, bytes: stored.bytes.slice() };
    }

    // INSTANCE :: STRING -> PROMISE(VOID)
    // Removes a case-insensitive basename; deleting an absent archive succeeds.
    // NOTE: Throws INVALID_CONFIG for an invalid ROM name; operational failures reject with STORAGE_FAILED.
    async remove(name: string): Promise<void> {
        const romName = ArcadeRomStore.validName(name, "ArcadeRomStore.remove");
        await withObjectStore(this._indexedDB, this._databaseName, ArcadeRomStore.DB_VERSION, ArcadeRomStore.STORE_NAME, "readwrite", (store) => store.delete(romNameKey(romName)));
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Removes every archive in this database; clearing an empty store succeeds.
    // NOTE: Operational failures reject with STORAGE_FAILED.
    async clear(): Promise<void> {
        await withObjectStore(this._indexedDB, this._databaseName, ArcadeRomStore.DB_VERSION, ArcadeRomStore.STORE_NAME, "readwrite", (store) => store.clear());
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: arcadeRomStoreInitConfig? -> PROMISE(arcadeRomStore)
    // Supplies global IndexedDB, Web Crypto SHA-256 and Date.now only when their injections are omitted.
    // NOTE: Rejects with UNSUPPORTED when IndexedDB or Web Crypto is absent.
    static async init(config: ArcadeRomStoreInitConfig = {}): Promise<ArcadeRomStore> {
        if (!isArcadeRomStoreInitConfig(config)) return new ArcadeRomStore(config as ArcadeRomStoreConfig);
        const factory = config.indexedDB ?? (globalThis as { indexedDB?: IDBFactoryLike }).indexedDB;
        if (factory === undefined) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "This environment has no IndexedDB.",
        });
        // Web Crypto exists only in a secure context; a page served over plain http on a LAN address (a phone against
        // the development server) has none, so the pure SHA-256 stands in. Same digests, slower, which archives tolerate.
        const subtle = config.subtle ?? (globalThis as { crypto?: { subtle?: SubtleCryptoLike } }).crypto?.subtle ?? PURE_SHA256_SUBTLE;
        return new ArcadeRomStore({
            indexedDB: factory,
            subtle,
            now: config.now ?? (() => Date.now()),
            ...(config.name === undefined ? {} : { name: config.name }),
        });
    }

    // STATIC :: UNKNOWN, STRING -> romName
    // Validates a method basename argument and returns its narrowed value.
    private static validName(value: unknown, method: string): RomName {
        if (!isRomName(value)) throw ArcadeRomStore.invalidConfig(`${method} requires a ROM basename.`, value);
        return value;
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected caller value.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
