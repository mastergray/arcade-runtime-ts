// realizes: docs/arcade-runtime-spec.md > §10.7 ArcadeRomStore browser persistence, hashing and replacement cases

// Dependencies:
import { randomUUID } from "node:crypto";                                      // Fresh synthetic database name per browser case
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";  // Chromium pipeline and predicates
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Shared in-memory TypeScript server

// Type dependencies:
import type ArcadeRomStore from "../../src/ArcadeRomStore/ArcadeRomStore.ts";  // ROM-store constructor loaded in the page
import type { RomStoreEntry } from "../../src/ArcadeRomStore/types.ts";         // Byte-free list row
import type { TestFile } from "../run.ts";                                     // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructor loaded by the test-local browser page
interface BrowserRuntime {
    ArcadeRomStore: typeof ArcadeRomStore;
    fixedNow(): number;
    nextNow(): number;
    resetNow(value: number): void;
}

// INTERFACE :: full lifecycle snapshot for one synthetic archive
interface LifecycleSnapshot {
    readonly list: ReadonlyArray<RomStoreEntry>;
    readonly firstGet: { readonly name: string; readonly bytes: number[] } | null;
    readonly secondGet: { readonly name: string; readonly bytes: number[] } | null;
    readonly afterRemove: { readonly name: string; readonly bytes: number[] } | null;
    readonly afterClear: ReadonlyArray<RomStoreEntry>;
}

/**
 *
 * Constants
 *
 */

const TIMEOUT = 30_000;                                           // Per-case browser pipeline timeout
const ADDED_AT = 1_700_000_000_000;                               // Injected wall-clock value
const KNOWN_BYTES = [0, 1, 2, 3, 254, 255];                      // Synthetic input with a precomputed SHA-256
const KNOWN_SHA256 = "7ea646958715ed687aa9ac2f5d785feb1a93411f4f25fdd6c7fcc6ab07fdf0e3";
const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <script type="module">
    import ArcadeRomStore from "/src/ArcadeRomStore/ArcadeRomStore.js";
    let timestamp = 0;
    window.romStoreRuntime = {
      ArcadeRomStore,
      fixedNow: () => ${ADDED_AT},
      nextNow: () => timestamp++,
      resetNow: (value) => { timestamp = value; },
    };
  </script>
</body>
</html>`;                                                         // Minimal module page; IndexedDB and Web Crypto come from Chromium

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> STRING
// Returns an isolated synthetic database name unique across persistent Chromium runs.
const freshDatabase = (): string => `synthetic-rom-store-${randomUUID()}`;

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against this file's test-local page.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

const testFile: TestFile = {
    label: "ArcadeRomStore browser behavior",
    cases: [
        {
            label: "put/list/get/remove hashes known bytes, hides list bytes, returns defensive copies and removes idempotently",
            run: () => withTestPage((url) => CTGBrowserTest.init("ROM-store lifecycle")
                .assertPage("the complete local lifecycle matches", (page) => page.evaluate(async (args) => {
                    const runtime = (window as unknown as { romStoreRuntime: BrowserRuntime }).romStoreRuntime;
                    const store = await runtime.ArcadeRomStore.init({ name: args.database, now: runtime.fixedNow });
                    const supplied = new Uint8Array(args.bytes);
                    await store.put({ name: "synthetic.zip", bytes: supplied });
                    supplied[0] = 99;
                    const list = await store.list();
                    const first = await store.get("SYNTHETIC.ZIP");
                    if (first !== null) first.bytes[1] = 88;
                    const second = await store.get("synthetic.zip");
                    await store.remove("Synthetic.zip");
                    await store.remove("synthetic.zip");
                    const afterRemove = await store.get("synthetic.zip");
                    await store.put({ name: "temporary.zip", bytes: new Uint8Array([9]) });
                    await store.clear();
                    await store.clear();
                    return {
                        list,
                        firstGet: first === null ? null : { name: first.name, bytes: Array.from(first.bytes) },
                        secondGet: second === null ? null : { name: second.name, bytes: Array.from(second.bytes) },
                        afterRemove: afterRemove === null ? null : { name: afterRemove.name, bytes: Array.from(afterRemove.bytes) },
                        afterClear: await store.list(),
                    };
                }, { database: freshDatabase(), bytes: KNOWN_BYTES, addedAt: ADDED_AT }), P.equals<LifecycleSnapshot>({
                    list: [{ name: "synthetic.zip", size: 6, sha256: KNOWN_SHA256, addedAt: ADDED_AT }],
                    firstGet: { name: "synthetic.zip", bytes: [0, 88, 2, 3, 254, 255] },
                    secondGet: { name: "synthetic.zip", bytes: KNOWN_BYTES },
                    afterRemove: null,
                    afterClear: [],
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "put replaces a case-folded name with one record and list sorts by name",
            run: () => withTestPage((url) => CTGBrowserTest.init("ROM-store replacement and sorting")
                .assertPage("replacement changes bytes and metadata without duplicating the entry", (page) => page.evaluate(async (database) => {
                    const runtime = (window as unknown as { romStoreRuntime: BrowserRuntime }).romStoreRuntime;
                    runtime.resetNow(10);
                    const store = await runtime.ArcadeRomStore.init({ name: database, now: runtime.nextNow });
                    await store.put({ name: "zeta.zip", bytes: new Uint8Array([9]) });
                    await store.put({ name: "Replace.zip", bytes: new Uint8Array([1]) });
                    await store.put({ name: "replace.zip", bytes: new Uint8Array([2, 3]) });
                    await store.put({ name: "alpha.zip", bytes: new Uint8Array([4]) });
                    const replaced = await store.get("REPLACE.ZIP");
                    return {
                        entries: (await store.list()).map(({ name, size, addedAt }) => ({ name, size, addedAt })),
                        replaced: replaced === null ? null : { name: replaced.name, bytes: Array.from(replaced.bytes) },
                    };
                }, freshDatabase()), P.equals<{
                    entries: ReadonlyArray<{ name: string; size: number; addedAt: number }>;
                    replaced: { name: string; bytes: number[] } | null;
                }>({
                    entries: [
                        { name: "alpha.zip", size: 1, addedAt: 13 },
                        { name: "replace.zip", size: 2, addedAt: 12 },
                        { name: "zeta.zip", size: 1, addedAt: 10 },
                    ],
                    replaced: { name: "replace.zip", bytes: [2, 3] },
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "the optional database name isolates stores",
            run: () => withTestPage((url) => CTGBrowserTest.init("named ROM stores")
                .assertPage("an archive put in one named database is absent from another", (page) => page.evaluate(async (databases) => {
                    const { ArcadeRomStore } = (window as unknown as { romStoreRuntime: BrowserRuntime }).romStoreRuntime;
                    const first = await ArcadeRomStore.init({ name: databases.first });
                    const second = await ArcadeRomStore.init({ name: databases.second });
                    await first.put({ name: "isolated.zip", bytes: new Uint8Array([1, 2]) });
                    return {
                        first: (await first.list()).map((entry) => entry.name),
                        second: (await second.list()).map((entry) => entry.name),
                    };
                }, { first: freshDatabase(), second: freshDatabase() }), P.equals<{ first: string[]; second: string[] }>({
                    first: ["isolated.zip"],
                    second: [],
                }))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
