// realizes: docs/arcade-runtime-spec.md > §10.7 IndexedDB failure coverage for ArcadeStorage and ArcadeRomStore

// Type dependencies:
import type { IDBFactoryLike } from "../../src/ArcadeStorage/types.ts";   // Contract this double implements

/**
 *
 * Type Declarations
 *
 */

// TYPE :: scripted IndexedDB boundary failure
// Open, schema upgrade, transaction creation and every W9 object-store request can be failed independently.
export type FailingOperation = "open" | "upgrade" | "transaction" | "put" | "get" | "getAll" | "delete" | "clear";

// INTERFACE :: mutable event-handler surface of one fake request
// Requests settle on microtasks so production code installs handlers before an event fires.
interface FakeRequest {
    result: unknown;
    error: unknown;
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    onupgradeneeded: (() => void) | null;
    onblocked: (() => void) | null;
    transaction?: { abort(): void };
}

// INTERFACE :: mutable event-handler surface of one fake transaction
// The double performs one request per transaction, matching both W9 implementations.
interface FakeTransaction {
    error: Error | null;
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
    objectStore(name: string): unknown;
    abort(): void;
}

/**
 *
 * Class
 *
 */

// In-memory IDBFactoryLike scripted to fail one open, upgrade, transaction or request operation.
export default class FailingIndexedDB implements IDBFactoryLike {

    /* Instance Fields */
    readonly records = new Map<string, unknown>();                 // Contents of the double's single object store
    private _failing: FailingOperation | null = null;              // Boundary currently scripted to fail

    // CONSTRUCTOR :: VOID -> this
    // Creates an empty factory that fails no operation.
    constructor() {}

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: failingOperation? -> this
    // Selects one operation to fail; null restores normal behavior.
    failOn(operation: FailingOperation | null): this {
        this._failing = operation;
        return this;
    }

    // INSTANCE :: STRING, NUMBER? -> IDBOpenDBRequest
    // Returns an asynchronous open request with a minimal database result.
    open(_name: string, _version?: number): IDBOpenDBRequest {
        const request: FakeRequest = {
            result: undefined,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            onblocked: null,
        };
        let upgradeAborted = false;
        request.transaction = { abort: () => { upgradeAborted = true; } };

        queueMicrotask(() => {
            if (this._failing === "open") {
                request.error = FailingIndexedDB.error("open");
                request.onerror?.();
                return;
            }
            request.result = this.database();
            request.onupgradeneeded?.();
            if (upgradeAborted) {
                request.error = FailingIndexedDB.error("upgrade abort");
                request.onerror?.();
                return;
            }
            request.onsuccess?.();
        });
        return request as unknown as IDBOpenDBRequest;
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> OBJECT
    // Builds the database surface used by openDatabase and requestFromStore.
    private database(): unknown {
        return {
            objectStoreNames: { contains: () => this._failing !== "upgrade" },
            createObjectStore: () => {
                if (this._failing === "upgrade") throw FailingIndexedDB.error("upgrade");
                return {};
            },
            transaction: () => this.transaction(),
            close: () => undefined,
        };
    }

    // PRIVATE :: VOID -> fakeTransaction
    // Builds one transaction and its object store, or throws when transaction creation is scripted to fail.
    private transaction(): FakeTransaction {
        if (this._failing === "transaction") throw FailingIndexedDB.error("transaction");

        const transaction: FakeTransaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: () => store,
            abort: () => {
                transaction.error = FailingIndexedDB.error("transaction abort");
                queueMicrotask(() => transaction.onabort?.());
            },
        };
        const store = {
            put: (value: unknown, key: IDBValidKey) => this.request("put", transaction, () => {
                this.records.set(String(key), structuredClone(value));
                return key;
            }),
            get: (key: IDBValidKey) => this.request("get", transaction, () => structuredClone(this.records.get(String(key)))),
            getAll: () => this.request("getAll", transaction, () => Array.from(this.records.values(), (value) => structuredClone(value))),
            delete: (key: IDBValidKey) => this.request("delete", transaction, () => {
                this.records.delete(String(key));
                return undefined;
            }),
            clear: () => this.request("clear", transaction, () => {
                this.records.clear();
                return undefined;
            }),
        };
        return transaction;
    }

    // PRIVATE :: failingOperation, fakeTransaction, (VOID -> UNKNOWN) -> IDBRequest
    // Settles one request and then settles its transaction on a following microtask.
    private request(operation: Exclude<FailingOperation, "open" | "upgrade" | "transaction">, transaction: FakeTransaction, produce: () => unknown): IDBRequest {
        const request: FakeRequest = {
            result: undefined,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            onblocked: null,
        };
        queueMicrotask(() => {
            if (this._failing === operation) {
                const error = FailingIndexedDB.error(operation);
                request.error = error;
                transaction.error = error;
                request.onerror?.();
                transaction.onerror?.();
                transaction.onabort?.();
                return;
            }
            request.result = produce();
            request.onsuccess?.();
            queueMicrotask(() => transaction.oncomplete?.());
        });
        return request as unknown as IDBRequest;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: VOID -> failingIndexedDB
    // Mirrors the constructor.
    static init(): FailingIndexedDB {
        return new FailingIndexedDB();
    }

    // STATIC :: STRING -> ERROR
    // Stable underlying error carried by the production STORAGE_FAILED wrapper.
    private static error(operation: string): Error {
        return new Error(`FailingIndexedDB: scripted ${operation} failure`);
    }
}
