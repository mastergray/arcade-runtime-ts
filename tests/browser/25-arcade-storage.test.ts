// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeStorage browser persistence and failure cases

// Dependencies:
import { randomUUID } from "node:crypto";                                      // Fresh synthetic key per browser case
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";  // Chromium pipeline and predicates
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Shared in-memory TypeScript server

// Type dependencies:
import type ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Error constructor loaded in the page
import type ArcadeStorage from "../../src/ArcadeStorage/ArcadeStorage.ts";      // Storage constructor loaded in the page
import type FailingIndexedDB from "../support/FailingIndexedDB.ts";             // Failure double loaded in the page
import type { ErrorSnapshot } from "../support/fixtures.ts";                    // Plain typed-error identity
import type { TestFile } from "../run.ts";                                     // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructors loaded by the test-local browser page
// Production source and the W9 IndexedDB double are imported directly.
interface BrowserRuntime {
    ArcadeRuntimeError: typeof ArcadeRuntimeError;
    ArcadeStorage: typeof ArcadeStorage;
    FailingIndexedDB: typeof FailingIndexedDB;
}

/**
 *
 * Constants
 *
 */

const TIMEOUT = 30_000;                                           // Per-case browser pipeline timeout
const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <script type="module">
    import ArcadeRuntimeError from "/src/ArcadeRuntimeError/ArcadeRuntimeError.js";
    import ArcadeStorage from "/src/ArcadeStorage/ArcadeStorage.js";
    import FailingIndexedDB from "/tests/support/FailingIndexedDB.js";
    window.storageRuntime = { ArcadeRuntimeError, ArcadeStorage, FailingIndexedDB };
  </script>
</body>
</html>`;                                                         // Minimal module page; IndexedDB comes from Chromium

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> STRING
// Returns a page-chosen key unique across persistent Chromium runs.
const freshKey = (): string => `synthetic-storage-${randomUUID()}`;

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against this file's test-local page.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

const testFile: TestFile = {
    label: "ArcadeStorage browser behavior",
    cases: [
        {
            label: "save/load/clear round-trips defensive copies and clear is idempotent",
            run: () => withTestPage((url) => CTGBrowserTest.init("overlay round trip")
                .assertPage("saved and loaded buffers cannot mutate the stored overlay", (page) => page.evaluate(async (key) => {
                    const { ArcadeStorage } = (window as unknown as { storageRuntime: BrowserRuntime }).storageRuntime;
                    const storage = ArcadeStorage.init({ key });
                    const supplied = new Uint8Array([1, 2, 3]);
                    await storage.save(supplied);
                    supplied[0] = 9;
                    const first = await storage.load();
                    if (first !== null) first[1] = 8;
                    const second = await ArcadeStorage.init({ key }).load();
                    await storage.clear();
                    await storage.clear();
                    const afterClear = await storage.load();
                    return {
                        first: first === null ? null : Array.from(first),
                        second: second === null ? null : Array.from(second),
                        afterClear: afterClear === null ? null : Array.from(afterClear),
                    };
                }, freshKey()), P.equals<{ first: number[] | null; second: number[] | null; afterClear: number[] | null }>({
                    first: [1, 8, 3],
                    second: [1, 2, 3],
                    afterClear: null,
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "two page-supplied keys never interfere",
            run: () => withTestPage((url) => CTGBrowserTest.init("separate overlay keys")
                .assertPage("each key loads only its own bytes", (page) => page.evaluate(async (keys) => {
                    const { ArcadeStorage } = (window as unknown as { storageRuntime: BrowserRuntime }).storageRuntime;
                    const first = ArcadeStorage.init({ key: keys.first });
                    const second = ArcadeStorage.init({ key: keys.second });
                    await first.save(new Uint8Array([4, 5]));
                    await second.save(new Uint8Array([6, 7, 8]));
                    const firstBytes = await first.load();
                    const secondBytes = await second.load();
                    return {
                        first: firstBytes === null ? null : Array.from(firstBytes),
                        second: secondBytes === null ? null : Array.from(secondBytes),
                    };
                }, { first: freshKey(), second: freshKey() }), P.equals<{ first: number[] | null; second: number[] | null }>({
                    first: [4, 5],
                    second: [6, 7, 8],
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "FailingIndexedDB open and request failures become STORAGE_FAILED",
            run: () => withTestPage((url) => CTGBrowserTest.init("typed IndexedDB failures")
                .assertPage("both failure boundaries retain the runtime error identity", (page) => page.evaluate(async (key) => {
                    const { ArcadeRuntimeError, ArcadeStorage, FailingIndexedDB } = (window as unknown as { storageRuntime: BrowserRuntime }).storageRuntime;
                    const open = new ArcadeStorage({ key, indexedDB: new FailingIndexedDB().failOn("open") });
                    const request = new ArcadeStorage({ key, indexedDB: new FailingIndexedDB().failOn("put") });
                    let openSnapshot: ErrorSnapshot;
                    try {
                        await open.load();
                        openSnapshot = { isRuntimeError: false, code: null, label: null };
                    } catch (error) {
                        openSnapshot = ArcadeRuntimeError.is(error)
                            ? { isRuntimeError: true, code: error.code, label: error.label }
                            : { isRuntimeError: false, code: null, label: null };
                    }
                    let requestSnapshot: ErrorSnapshot;
                    try {
                        await request.save(new Uint8Array([1]));
                        requestSnapshot = { isRuntimeError: false, code: null, label: null };
                    } catch (error) {
                        requestSnapshot = ArcadeRuntimeError.is(error)
                            ? { isRuntimeError: true, code: error.code, label: error.label }
                            : { isRuntimeError: false, code: null, label: null };
                    }
                    return { open: openSnapshot, request: requestSnapshot };
                }, freshKey()), P.equals<{ open: ErrorSnapshot; request: ErrorSnapshot }>({
                    open: { isRuntimeError: true, code: 13, label: "STORAGE_FAILED" },
                    request: { isRuntimeError: true, code: 13, label: "STORAGE_FAILED" },
                }))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
