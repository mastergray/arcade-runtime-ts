// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeStorage and ArcadeRomStore predicates, construction and typed failures

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { createHash } from "node:crypto";                          // Reference digests for the pure SHA-256
import { PURE_SHA256_SUBTLE, sha256 } from "../../src/ArcadeRomStore/sha256.js";   // The fallback outside secure contexts   // Pipeline API and predicate builders
import ArcadeRomStore from "../../src/ArcadeRomStore/ArcadeRomStore.ts";
import {
    isArcadeRomStoreConfig,
    isArcadeRomStoreInitConfig,
    isRomStoreEntry,
    isSubtleCryptoLike,
} from "../../src/ArcadeRomStore/types.ts";
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";
import ArcadeStorage from "../../src/ArcadeStorage/ArcadeStorage.ts";
import {
    isArcadeStorageConfig,
    isArcadeStorageInitConfig,
    isIDBFactoryLike,
} from "../../src/ArcadeStorage/types.ts";
import FailingIndexedDB from "../support/FailingIndexedDB.ts";   // Required failure-boundary double
import { errorSnapshot, rejectedBy, thrownBy } from "../support/fixtures.ts";   // Stable typed-error assertions

// Type dependencies:
import type {
    ArcadeRomStoreConfig,
    ArcadeRomStoreInitConfig,
    RomStoreEntry,
    SubtleCryptoLike,
} from "../../src/ArcadeRomStore/types.ts";
import type { ArcadeStorageConfig, ArcadeStorageInitConfig, IDBFactoryLike } from "../../src/ArcadeStorage/types.ts";
import type { ErrorSnapshot } from "../support/fixtures.ts";
import type { FailingOperation } from "../support/FailingIndexedDB.ts";
import type { TestCase, TestFile } from "../run.ts";              // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: errorSnapshot & {dataMessage:STRING?}
// Typed failure identity plus the underlying injected error carried as data.
interface FailureSnapshot extends ErrorSnapshot {
    readonly dataMessage: string | null;
}

/**
 *
 * Constants
 *
 */

const FACTORY = { open() {} } as unknown as IDBFactoryLike;       // Predicate-only IndexedDB shape
const SUBTLE: SubtleCryptoLike = { digest: async () => new ArrayBuffer(32) };   // Predicate-only digest shape
const NOW = (): number => 1_700_000_000_000;                      // Stable addedAt source
const STORAGE_CONFIG: ArcadeStorageConfig = { key: "page-save", indexedDB: FACTORY };
const STORAGE_INIT_CONFIG: ArcadeStorageInitConfig = { key: "page-save" };
const ROM_STORE_CONFIG: ArcadeRomStoreConfig = { indexedDB: FACTORY, subtle: SUBTLE, now: NOW, name: "test-rom-store" };
const ROM_STORE_INIT_CONFIG: ArcadeRomStoreInitConfig = { indexedDB: FACTORY, subtle: SUBTLE, now: NOW, name: "test-rom-store" };
const ENTRY: RomStoreEntry = { name: "synthetic.zip", size: 4, sha256: "0".repeat(64), addedAt: NOW() };
const INVALID_CONFIG: ErrorSnapshot = { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" };
const UNSUPPORTED: ErrorSnapshot = { isRuntimeError: true, code: 15, label: "UNSUPPORTED" };

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, (UNKNOWN -> BOOLEAN), UNKNOWN, BOOLEAN -> testCase
// Case: a public structural predicate returns the expected verdict.
const predicateCase = (label: string, predicate: (value: unknown) => boolean, value: unknown, expected: boolean): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert(expected ? "accepted" : "rejected", () => predicate(value), P.equals<boolean>(expected))
        .start(undefined),
});

// HELPER :: UNKNOWN -> failureSnapshot
// Adds the underlying error message to the standard runtime-error snapshot.
const failureSnapshot = (value: unknown): FailureSnapshot => ({
    ...errorSnapshot(value, ArcadeRuntimeError),
    dataMessage: ArcadeRuntimeError.is(value) && value.data instanceof Error ? value.data.message : null,
});

// HELPER :: failingOperation -> testCase
// Case: one IndexedDB boundary rejects ArcadeStorage.load() as STORAGE_FAILED with the original Error in data.
const indexedDBFailureCase = (operation: Extract<FailingOperation, "open" | "upgrade" | "transaction" | "get">): TestCase => ({
    label: `ArcadeStorage maps an IndexedDB ${operation} failure to STORAGE_FAILED with its cause`,
    run: () => CTGTest.init(`${operation} failure`)
        .stage("load through the scripted failing factory", async () => {
            const storage = new ArcadeStorage({ key: "page-save", indexedDB: new FailingIndexedDB().failOn(operation) });
            return failureSnapshot(await rejectedBy(storage.load()));
        })
        .assert("typed storage failure retains the underlying error", (state) => state.subject, P.equals<FailureSnapshot>({
            isRuntimeError: true,
            code: 13,
            label: "STORAGE_FAILED",
            dataMessage: `FailingIndexedDB: scripted ${operation} failure`,
        }))
        .start(undefined),
});

// HELPER :: STRING, (VOID -> PROMISE(UNKNOWN)) -> testCase
// Case: an init call with one browser global hidden rejects with UNSUPPORTED.
const unsupportedCase = (label: string, run: () => Promise<unknown>): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .stage("run init without the required global", run)
        .assert("throws or rejects with UNSUPPORTED", (state) => errorSnapshot(state.subject, ArcadeRuntimeError), P.equals<ErrorSnapshot>(UNSUPPORTED))
        .start(undefined),
});

// HELPER :: STRING, (VOID -> PROMISE(T)) -> PROMISE(T)
// Temporarily hides one configurable browser global and restores its exact descriptor afterward.
const withoutGlobal = async <T>(name: "indexedDB" | "crypto", run: () => Promise<T>): Promise<T> => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: undefined, configurable: true });
    try {
        return await run();
    } finally {
        if (descriptor === undefined) delete (globalThis as unknown as Record<string, unknown>)[name];
        else Object.defineProperty(globalThis, name, descriptor);
    }
};

const testFile: TestFile = {
    label: "Arcade storage configuration and failures",
    cases: [
        {
            label: "the pure SHA-256 matches Node's digest for empty, short, block-boundary and multi-block inputs",
            run: () => CTGTest.init("pure sha256")
                .stage("digest reference inputs", async () => {
                    const inputs = [new Uint8Array(0), new TextEncoder().encode("abc"), new Uint8Array(55).fill(7), new Uint8Array(56).fill(9), new Uint8Array(64).fill(1), new Uint8Array(1000).map((_, i) => i & 0xff)];
                    const hex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
                    const matches = inputs.map((bytes) => hex(sha256(bytes)) === createHash("sha256").update(bytes).digest("hex"));
                    const viaSubtle = hex(await PURE_SHA256_SUBTLE.digest("SHA-256", inputs[1]!));
                    const rejected = await PURE_SHA256_SUBTLE.digest("SHA-1", inputs[1]!).then(() => false, () => true);
                    return { matches, viaSubtle, rejected };
                })
                .assert("every digest matches and other algorithms are refused", (state) => state.subject, P.equals<unknown>({
                    matches: [true, true, true, true, true, true],
                    viaSubtle: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                    rejected: true,
                }))
                .start(undefined),
        },


        // IDBFactoryLike and ArcadeStorage configs
        predicateCase("isIDBFactoryLike accepts an object with open()", isIDBFactoryLike, FACTORY, true),
        predicateCase("isIDBFactoryLike rejects a non-object", isIDBFactoryLike, null, false),
        predicateCase("isIDBFactoryLike rejects a non-function open field", isIDBFactoryLike, { open: "database" }, false),
        predicateCase("isArcadeStorageConfig accepts a non-empty key and factory", isArcadeStorageConfig, STORAGE_CONFIG, true),
        predicateCase("isArcadeStorageConfig rejects a non-object", isArcadeStorageConfig, null, false),
        predicateCase("isArcadeStorageConfig rejects an empty key", isArcadeStorageConfig, { ...STORAGE_CONFIG, key: "" }, false),
        predicateCase("isArcadeStorageConfig rejects an invalid factory", isArcadeStorageConfig, { ...STORAGE_CONFIG, indexedDB: {} }, false),
        predicateCase("isArcadeStorageInitConfig accepts an omitted factory", isArcadeStorageInitConfig, STORAGE_INIT_CONFIG, true),
        predicateCase("isArcadeStorageInitConfig rejects a non-object", isArcadeStorageInitConfig, null, false),
        predicateCase("isArcadeStorageInitConfig rejects an empty key", isArcadeStorageInitConfig, { key: "" }, false),
        predicateCase("isArcadeStorageInitConfig rejects an invalid explicit factory", isArcadeStorageInitConfig, { key: "page-save", indexedDB: {} }, false),

        // SubtleCryptoLike and ArcadeRomStore configs
        predicateCase("isSubtleCryptoLike accepts an object with digest()", isSubtleCryptoLike, SUBTLE, true),
        predicateCase("isSubtleCryptoLike rejects a non-object", isSubtleCryptoLike, null, false),
        predicateCase("isSubtleCryptoLike rejects a non-function digest field", isSubtleCryptoLike, { digest: "sha256" }, false),
        predicateCase("isArcadeRomStoreConfig accepts injected dependencies and a name", isArcadeRomStoreConfig, ROM_STORE_CONFIG, true),
        predicateCase("isArcadeRomStoreConfig rejects a non-object", isArcadeRomStoreConfig, null, false),
        predicateCase("isArcadeRomStoreConfig rejects an invalid factory", isArcadeRomStoreConfig, { ...ROM_STORE_CONFIG, indexedDB: {} }, false),
        predicateCase("isArcadeRomStoreConfig rejects an invalid subtle implementation", isArcadeRomStoreConfig, { ...ROM_STORE_CONFIG, subtle: {} }, false),
        predicateCase("isArcadeRomStoreConfig rejects a non-function now", isArcadeRomStoreConfig, { ...ROM_STORE_CONFIG, now: 1 }, false),
        predicateCase("isArcadeRomStoreConfig rejects an empty database name", isArcadeRomStoreConfig, { ...ROM_STORE_CONFIG, name: "" }, false),
        predicateCase("isArcadeRomStoreInitConfig accepts all browser dependencies omitted", isArcadeRomStoreInitConfig, {}, true),
        predicateCase("isArcadeRomStoreInitConfig rejects a non-object", isArcadeRomStoreInitConfig, null, false),
        predicateCase("isArcadeRomStoreInitConfig rejects an invalid explicit factory", isArcadeRomStoreInitConfig, { ...ROM_STORE_INIT_CONFIG, indexedDB: {} }, false),
        predicateCase("isArcadeRomStoreInitConfig rejects an invalid explicit subtle implementation", isArcadeRomStoreInitConfig, { ...ROM_STORE_INIT_CONFIG, subtle: {} }, false),
        predicateCase("isArcadeRomStoreInitConfig rejects a non-function explicit now", isArcadeRomStoreInitConfig, { ...ROM_STORE_INIT_CONFIG, now: 1 }, false),
        predicateCase("isArcadeRomStoreInitConfig rejects an empty database name", isArcadeRomStoreInitConfig, { ...ROM_STORE_INIT_CONFIG, name: "" }, false),

        // RomStoreEntry
        predicateCase("isRomStoreEntry accepts complete byte-free metadata", isRomStoreEntry, ENTRY, true),
        predicateCase("isRomStoreEntry rejects a non-object", isRomStoreEntry, null, false),
        predicateCase("isRomStoreEntry rejects an invalid ROM basename", isRomStoreEntry, { ...ENTRY, name: "path/file.zip" }, false),
        predicateCase("isRomStoreEntry rejects a negative size", isRomStoreEntry, { ...ENTRY, size: -1 }, false),
        predicateCase("isRomStoreEntry rejects a non-integer size", isRomStoreEntry, { ...ENTRY, size: 1.5 }, false),
        predicateCase("isRomStoreEntry rejects a non-canonical SHA-256", isRomStoreEntry, { ...ENTRY, sha256: "ABC" }, false),
        predicateCase("isRomStoreEntry rejects a negative timestamp", isRomStoreEntry, { ...ENTRY, addedAt: -1 }, false),
        predicateCase("isRomStoreEntry rejects a non-finite timestamp", isRomStoreEntry, { ...ENTRY, addedAt: Infinity }, false),

        // Construction and caller validation
        {
            label: "ArcadeStorage.init with an explicit factory returns an instance whose key reads back",
            run: () => CTGTest.init("ArcadeStorage explicit init")
                .stage("initialize without reading a global", () => ArcadeStorage.init(STORAGE_CONFIG))
                .assert("instance and key match", (state) => ({ instance: state.subject instanceof ArcadeStorage, key: state.subject.key }), P.equals({ instance: true, key: "page-save" }))
                .start(undefined),
        },
        {
            label: "ArcadeRomStore.init with explicit dependencies resolves an instance",
            run: () => CTGTest.init("ArcadeRomStore explicit init")
                .stage("initialize without reading globals", () => ArcadeRomStore.init(ROM_STORE_INIT_CONFIG))
                .assert("resolved value is an ArcadeRomStore", (state) => state.subject instanceof ArcadeRomStore, P.equals(true))
                .start(undefined),
        },
        {
            label: "both constructors reject configs that fail their predicates with INVALID_CONFIG",
            run: () => CTGTest.init("constructor validation")
                .stage("construct with an empty key and missing ROM-store dependencies", () => ({
                    storage: errorSnapshot(thrownBy(() => new ArcadeStorage({ ...STORAGE_CONFIG, key: "" })), ArcadeRuntimeError),
                    romStore: errorSnapshot(thrownBy(() => new ArcadeRomStore({} as ArcadeRomStoreConfig)), ArcadeRuntimeError),
                }))
                .assert("both are INVALID_CONFIG", (state) => state.subject, P.equals({ storage: INVALID_CONFIG, romStore: INVALID_CONFIG }))
                .start(undefined),
        },
        {
            label: "invalid save, put, get and remove arguments reject with INVALID_CONFIG",
            run: () => CTGTest.init("method validation")
                .stage("call methods with values outside their public contracts", async () => {
                    const storage = new ArcadeStorage({ key: "page-save", indexedDB: new FailingIndexedDB() });
                    const romStore = new ArcadeRomStore({ indexedDB: new FailingIndexedDB(), subtle: SUBTLE, now: NOW });
                    return {
                        save: errorSnapshot(await rejectedBy(storage.save(null as unknown as Uint8Array)), ArcadeRuntimeError),
                        put: errorSnapshot(await rejectedBy(romStore.put({ name: "", bytes: new Uint8Array() })), ArcadeRuntimeError),
                        get: errorSnapshot(await rejectedBy(romStore.get("../file.zip")), ArcadeRuntimeError),
                        remove: errorSnapshot(await rejectedBy(romStore.remove("")), ArcadeRuntimeError),
                    };
                })
                .assert("every invalid argument is INVALID_CONFIG", (state) => state.subject, P.equals({
                    save: INVALID_CONFIG,
                    put: INVALID_CONFIG,
                    get: INVALID_CONFIG,
                    remove: INVALID_CONFIG,
                }))
                .start(undefined),
        },

        // Unsupported browser defaults
        unsupportedCase("ArcadeStorage.init throws UNSUPPORTED when globalThis.indexedDB is absent", () => withoutGlobal("indexedDB", async () => thrownBy(() => ArcadeStorage.init(STORAGE_INIT_CONFIG)))),
        unsupportedCase("ArcadeRomStore.init rejects UNSUPPORTED when globalThis.indexedDB is absent", () => withoutGlobal("indexedDB", () => rejectedBy(ArcadeRomStore.init({ subtle: SUBTLE, now: NOW })))),
        {
            label: "ArcadeRomStore.init falls back to the pure SHA-256 when globalThis.crypto.subtle is absent",
            run: () => CTGTest.init("ROM-store digest fallback")
                .stage("init without Web Crypto", () => withoutGlobal("crypto", async () => {
                    const store = await ArcadeRomStore.init({ indexedDB: FACTORY, now: NOW, name: "test-rom-store" });
                    return store instanceof ArcadeRomStore;
                }))
                .assert("the store constructs outside a secure context", (state) => state.subject, P.equals(true))
                .start(undefined),
        },

        // Complete IndexedDB failure boundary
        indexedDBFailureCase("open"),
        indexedDBFailureCase("upgrade"),
        indexedDBFailureCase("transaction"),
        indexedDBFailureCase("get"),
        {
            label: "ArcadeRomStore maps a request failure to STORAGE_FAILED with its cause",
            run: () => CTGTest.init("ROM-store request failure")
                .stage("list through a getAll failure", async () => {
                    const store = new ArcadeRomStore({ indexedDB: new FailingIndexedDB().failOn("getAll"), subtle: SUBTLE, now: NOW });
                    return failureSnapshot(await rejectedBy(store.list()));
                })
                .assert("typed storage failure retains the getAll error", (state) => state.subject, P.equals<FailureSnapshot>({
                    isRuntimeError: true,
                    code: 13,
                    label: "STORAGE_FAILED",
                    dataMessage: "FailingIndexedDB: scripted getAll failure",
                }))
                .start(undefined),
        },
        {
            label: "ArcadeRomStore maps a digest rejection to STORAGE_FAILED with its cause",
            run: () => CTGTest.init("digest failure")
                .stage("put through a rejecting subtle implementation", async () => {
                    const subtle: SubtleCryptoLike = { digest: async () => { throw new Error("digest unavailable"); } };
                    const store = new ArcadeRomStore({ indexedDB: new FailingIndexedDB(), subtle, now: NOW });
                    return failureSnapshot(await rejectedBy(store.put({ name: "synthetic.zip", bytes: new Uint8Array([1]) })));
                })
                .assert("typed storage failure retains the digest error", (state) => state.subject, P.equals<FailureSnapshot>({
                    isRuntimeError: true,
                    code: 13,
                    label: "STORAGE_FAILED",
                    dataMessage: "digest unavailable",
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
