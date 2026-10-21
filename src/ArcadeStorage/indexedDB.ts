// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeStorage and ArcadeRomStore IndexedDB failure semantics

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // One typed failure boundary for IndexedDB

// Type dependencies:
import type { IDBFactoryLike } from "./types.js";                 // Injectable factory shared by both W9 stores

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, UNKNOWN -> arcadeRuntimeError
// Wraps an IndexedDB failure without discarding its underlying error.
export const storageFailed = (message: string, data: unknown): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.STORAGE_FAILED,
    message,
    data: data ?? null,
});

// HELPER :: idbFactoryLike, STRING, NUMBER, STRING -> PROMISE(IDBDatabase)
// Opens a database and creates its one object store when schema version 1 is first installed.
export const openDatabase = (factory: IDBFactoryLike, databaseName: string, version: number, storeName: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
        request = factory.open(databaseName, version);
    } catch (error) {
        reject(storageFailed("IndexedDB open threw.", error));
        return;
    }

    let settled = false;
    const fail = (message: string, data: unknown): void => {
        if (settled) return;
        settled = true;
        reject(storageFailed(message, data));
    };

    request.onupgradeneeded = () => {
        try {
            const database = request.result;
            if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
        } catch (error) {
            fail("IndexedDB upgrade failed.", error);
            try { request.transaction?.abort(); } catch { /* The original upgrade error is the useful cause. */ }
        }
    };
    request.onsuccess = () => {
        if (settled) {
            request.result.close();
            return;
        }
        settled = true;
        resolve(request.result);
    };
    request.onerror = () => fail("IndexedDB open failed.", request.error);
    request.onblocked = () => fail("IndexedDB open was blocked by another connection.", null);
});

// HELPER :: IDBDatabase, STRING, idbTransactionMode, (IDBObjectStore -> IDBRequest(T)) -> PROMISE(T)
// Runs exactly one request and resolves only after its transaction commits.
export const requestFromStore = async <T>(
    database: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => new Promise<T>((resolve, reject) => {
    let settled = false;
    const fail = (message: string, data: unknown): void => {
        if (settled) return;
        settled = true;
        reject(storageFailed(message, data));
    };

    let transaction: IDBTransaction;
    try {
        transaction = database.transaction(storeName, mode);
    } catch (error) {
        fail("IndexedDB transaction failed.", error);
        return;
    }

    let request: IDBRequest<T>;
    try {
        request = operation(transaction.objectStore(storeName));
    } catch (error) {
        fail("IndexedDB request threw.", error);
        try { transaction.abort(); } catch { /* The request error remains the useful cause. */ }
        return;
    }

    let requestSucceeded = false;
    let result: T;
    request.onsuccess = () => {
        requestSucceeded = true;
        result = request.result;
    };
    request.onerror = () => fail("IndexedDB request failed.", request.error);
    transaction.onerror = () => fail("IndexedDB transaction failed.", transaction.error);
    transaction.onabort = () => fail("IndexedDB transaction was aborted.", transaction.error);
    transaction.oncomplete = () => {
        if (!requestSucceeded) {
            fail("IndexedDB transaction completed before its request.", transaction.error);
            return;
        }
        if (settled) return;
        settled = true;
        resolve(result!);
    };
});

// HELPER :: idbFactoryLike, STRING, NUMBER, STRING, idbTransactionMode, (IDBObjectStore -> IDBRequest(T)) -> PROMISE(T)
// Opens, performs one committed request, and always closes the database connection.
export const withObjectStore = async <T>(
    factory: IDBFactoryLike,
    databaseName: string,
    version: number,
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
    const database = await openDatabase(factory, databaseName, version, storeName);
    try {
        return await requestFromStore(database, storeName, mode, operation);
    } finally {
        database.close();
    }
};
