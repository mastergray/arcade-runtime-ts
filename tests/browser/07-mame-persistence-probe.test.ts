// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P8 persistence

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { Page } from "playwright";                          // Page used by shared probe interactions
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface PersistenceFile {
    checksum: string;
    path: string;
    size: number;
}

interface PersistenceProbeApi {
    hookResult?: number | null;
    mainLoopTicks?: number;
    persistenceFlushCount?: number;
    persistenceHydratedFiles?: PersistenceFile[];
    persistenceHydrationError?: string;
    persistenceNvramDeviceCount?: number;
    persistenceReady?: boolean;
    persistenceSnapshot?: () => PersistenceFile[];
    persistenceSyncError?: string;
    requestHook?: (name: string) => void;
    running?: boolean;
    syncPersistence?: () => Promise<PersistenceFile[]>;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_PERSISTENCE_PROBE_URL;
const TEST_TOKEN = `p8-${process.pid}-${Date.now()}`;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Selects a fresh IDBFS database while preserving any existing probe query.
const persistenceUrl = (url: string): string => {
    const parsed = new URL(url);
    parsed.searchParams.set("mame_probe_persistence", TEST_TOKEN);
    return parsed.href;
};

// HELPER :: page -> PROMISE(VOID)
// Waits until IDBFS hydration has completed and the machine is running.
const waitForPersistence = async (page: Page): Promise<void> => {
    await page.waitForFunction(() => {
        const probe = (window as typeof window & { JSMESS?: PersistenceProbeApi }).JSMESS;
        return probe?.running === true
            && probe.persistenceReady === true
            && typeof probe.requestHook === "function"
            && typeof probe.syncPersistence === "function";
    }, undefined, { timeout: 30_000 });
};

let flushedFiles: PersistenceFile[] = [];
let ticksBeforeFlush = 0;
let ticksAfterFlush = 0;

const testFile: TestFile = {
    label: "MAME 0.161 browser persistence probe",
    skip: PROBE_URL === undefined
        ? "set MAME_PERSISTENCE_PROBE_URL to a local persistence-instrumented game probe"
        : undefined,
    cases: [
        {
            label: "flushes NVRAM mid-run and hydrates it after reload",
            run: () => CTGBrowserTest.init("mid-run persistence round trip")
                .interact("wait for the running machine and hydrated filesystem", async ({ page }) =>
                    await waitForPersistence(page))
                .interact("flush core persistence and sync it to IndexedDB", async ({ page }) => {
                    const baseline = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: PersistenceProbeApi }).JSMESS;
                        return {
                            flushes: probe.persistenceFlushCount ?? 0,
                            ticks: probe.mainLoopTicks ?? 0,
                        };
                    });
                    ticksBeforeFlush = baseline.ticks;
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: PersistenceProbeApi })
                            .JSMESS.requestHook!("flushPersistence"));
                    await page.waitForFunction((flushes) => {
                        const probe = (window as typeof window & { JSMESS?: PersistenceProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && (probe.persistenceFlushCount ?? 0) > flushes;
                    }, baseline.flushes, { timeout: 10_000 });
                    flushedFiles = await page.evaluate(async () =>
                        await (window as typeof window & { JSMESS: PersistenceProbeApi })
                            .JSMESS.syncPersistence!());
                    await page.waitForFunction((ticks) =>
                        ((window as typeof window & { JSMESS?: PersistenceProbeApi })
                            .JSMESS?.mainLoopTicks ?? 0) >= ticks + 20,
                    baseline.ticks, { timeout: 10_000 });
                    ticksAfterFlush = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: PersistenceProbeApi })
                            .JSMESS.mainLoopTicks ?? 0);
                })
                .assertPage(
                    "the live machine wrote a non-empty NVRAM file",
                    async (page) => await page.evaluate((files) => {
                        const probe = (window as typeof window & { JSMESS?: PersistenceProbeApi }).JSMESS;
                        return (probe?.persistenceNvramDeviceCount ?? 0) > 0
                            && probe?.persistenceHydrationError === ""
                            && probe.persistenceSyncError === ""
                            && files.some((file) => file.path.startsWith("nvram/") && file.size > 0);
                    }, flushedFiles),
                    true,
                )
                .interact("reload the module from the same persistent origin", async ({ page }) => {
                    await page.reload();
                    await waitForPersistence(page);
                })
                .assertPage(
                    "the next module hydrates the exact flushed files before startup",
                    async (page) => await page.evaluate((expected) => {
                        const probe = (window as typeof window & { JSMESS?: PersistenceProbeApi }).JSMESS;
                        return probe?.persistenceHydrationError === ""
                            && JSON.stringify(probe.persistenceHydratedFiles) === JSON.stringify(expected);
                    }, flushedFiles),
                    true,
                )
                .assertPage(
                    "the flush did not terminate or stall the first machine",
                    async (page) => ticksAfterFlush >= ticksBeforeFlush + 20
                        && await page.evaluate(() =>
                            (window as typeof window & { JSMESS?: PersistenceProbeApi })
                                .JSMESS?.running === true),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(persistenceUrl(PROBE_URL as string), { headless: true }),
        },
    ],
};

export default testFile;
