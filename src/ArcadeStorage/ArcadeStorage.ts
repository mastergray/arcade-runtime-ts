// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeStorage

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // INVALID_CONFIG and UNSUPPORTED failures
import { withObjectStore } from "./indexedDB.js";                 // Complete IndexedDB open/transaction/request boundary

// Type dependencies:
import type { NonEmptyString } from "../shared.types.js";        // Page-supplied overlay key
import {
    isArcadeStorageConfig,                                        // Guards direct construction
    isArcadeStorageInitConfig,                                    // Guards init before reading browser globals
    type ArcadeStorageConfig,                                     // Injected construction config
    type ArcadeStorageInitConfig,                                 // Browser-defaulting init config
    type IDBFactoryLike,                                          // Minimal IndexedDB factory
} from "./types.js";

/**
 *
 * Class
 *
 */

// Persists one page-chosen save overlay as bytes in browser-local IndexedDB.
export default class ArcadeStorage {

    /* Static Fields */
    static readonly DB_NAME: NonEmptyString = "arcade-runtime";   // Shared overlay database on an origin
    static readonly STORE_NAME: NonEmptyString = "overlays";      // Key-value store keyed by ArcadeStorageConfig.key
    static readonly DB_VERSION = 1;                               // Initial and current schema

    /* Instance Fields */
    private readonly _key: NonEmptyString;                         // Page-chosen overlay identity
    private readonly _indexedDB: IDBFactoryLike;                   // Injected factory; constructors read no globals

    // CONSTRUCTOR :: arcadeStorageConfig -> this
    // Creates lazy storage; IndexedDB is not opened until an operation runs.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isArcadeStorageConfig().
    constructor(config: ArcadeStorageConfig) {
        if (!isArcadeStorageConfig(config)) throw ArcadeStorage.invalidConfig("ArcadeStorage config must have a non-empty key and an indexedDB with open().", config);
        this._key = config.key;
        this._indexedDB = config.indexedDB;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> nonEmptyString
    // The key under which this instance reads and replaces one overlay.
    get key(): NonEmptyString {
        return this._key;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: Uint8Array -> PROMISE(VOID)
    // Replaces this key's overlay with a defensive byte copy.
    // NOTE: Throws INVALID_CONFIG for a non-Uint8Array; IndexedDB failures reject with STORAGE_FAILED.
    async save(bytes: Uint8Array): Promise<void> {
        if (!(bytes instanceof Uint8Array)) throw ArcadeStorage.invalidConfig("ArcadeStorage.save requires a Uint8Array.", bytes);
        const copy = bytes.slice();
        await withObjectStore(this._indexedDB, ArcadeStorage.DB_NAME, ArcadeStorage.DB_VERSION, ArcadeStorage.STORE_NAME, "readwrite", (store) => store.put(copy, this._key));
    }

    // INSTANCE :: VOID -> PROMISE(Uint8Array?)
    // Returns a defensive copy of this key's overlay, or null when none exists.
    // NOTE: IndexedDB failures reject with STORAGE_FAILED.
    async load(): Promise<Uint8Array | null> {
        const stored = await withObjectStore(this._indexedDB, ArcadeStorage.DB_NAME, ArcadeStorage.DB_VERSION, ArcadeStorage.STORE_NAME, "readonly", (store) => store.get(this._key));
        return stored instanceof Uint8Array ? stored.slice() : null;
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Removes this key's overlay; deleting an absent key succeeds.
    // NOTE: IndexedDB failures reject with STORAGE_FAILED.
    async clear(): Promise<void> {
        await withObjectStore(this._indexedDB, ArcadeStorage.DB_NAME, ArcadeStorage.DB_VERSION, ArcadeStorage.STORE_NAME, "readwrite", (store) => store.delete(this._key));
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: arcadeStorageInitConfig -> arcadeStorage
    // Supplies globalThis.indexedDB only when no explicit factory was injected.
    // NOTE: Throws UNSUPPORTED when the environment has no IndexedDB.
    static init(config: ArcadeStorageInitConfig): ArcadeStorage {
        if (!isArcadeStorageInitConfig(config)) return new ArcadeStorage(config as ArcadeStorageConfig);
        const factory = config.indexedDB ?? (globalThis as { indexedDB?: IDBFactoryLike }).indexedDB;
        if (factory === undefined) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "This environment has no IndexedDB.",
        });
        return new ArcadeStorage({ key: config.key, indexedDB: factory });
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected caller value.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
