// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeStorage (configuration and IndexedDB injection)

// Type dependencies:
import { isNonEmptyString, type NonEmptyString } from "../shared.types.js";   // Storage key type and its guard

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {open:(STRING, NUMBER? -> IDBOpenDBRequest)}
// The one IDBFactory operation storage classes use; the browser factory and test doubles satisfy it structurally.
export interface IDBFactoryLike {
    open(name: string, version?: number): IDBOpenDBRequest;        // Opens, creates or upgrades one database
}

// INTERFACE :: {key:nonEmptyString, indexedDB:idbFactoryLike}
// Direct-construction config: constructors read no browser globals.
export interface ArcadeStorageConfig {
    readonly key: NonEmptyString;                                  // Page-chosen overlay identity
    readonly indexedDB: IDBFactoryLike;                            // Injected IndexedDB factory
}

// INTERFACE :: {key:nonEmptyString, indexedDB:idbFactoryLike?}
// init() config: the browser factory is supplied when indexedDB is omitted.
export interface ArcadeStorageInitConfig {
    readonly key: NonEmptyString;                                  // Page-chosen overlay identity
    readonly indexedDB?: IDBFactoryLike;                           // Explicit factory, or globalThis.indexedDB
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies the IndexedDB open operation.
export function isIDBFactoryLike(value: unknown): value is IDBFactoryLike {
    return typeof value === "object" && value !== null
        && typeof (value as IDBFactoryLike).open === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a non-empty key and an injected IndexedDB factory.
export function isArcadeStorageConfig(value: unknown): value is ArcadeStorageConfig {
    return typeof value === "object" && value !== null
        && isNonEmptyString((value as ArcadeStorageConfig).key)
        && isIDBFactoryLike((value as ArcadeStorageConfig).indexedDB);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a non-empty key and, when present, an IndexedDB factory.
export function isArcadeStorageInitConfig(value: unknown): value is ArcadeStorageInitConfig {
    return typeof value === "object" && value !== null
        && isNonEmptyString((value as ArcadeStorageInitConfig).key)
        && ((value as ArcadeStorageInitConfig).indexedDB === undefined
            || isIDBFactoryLike((value as ArcadeStorageInitConfig).indexedDB));
}
