// realizes: docs/arcade-runtime-spec.md > §11 Developer harness and §12 M7 ROM supply + ArcadeCabinet acceptance

// Dependencies:
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";   // Builds disposable synthetic family metadata and archives
import { tmpdir } from "node:os";                                  // Parent for disposable browser inputs
import { dirname, join, resolve } from "node:path";                // Locates the worktree and temporary build tree
import { fileURLToPath } from "node:url";                          // Resolves the production build root without recording it
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { zipSync } from "fflate";                                  // Creates non-ROM synthetic zip inputs
import { startHarnessServer } from "../../scripts/serve-harness.ts";   // Production harness page and server under test

// Type dependencies:
import type { Server } from "node:http";                           // Listener cleanup boundary
import type { RomSetMetadata } from "../../src/index.ts";         // Synthetic metadata must match the public format
import type { TestCase, TestFile } from "../run.ts";               // Test manifest shapes

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: privacy-safe observations of the picker, store, audit and scripted-adapter run
interface SyntheticResult {
    readonly pickedVisible: boolean;
    readonly storedVisible: boolean;
    readonly auditRolesVisible: boolean;
    readonly overlayChoiceVisible: boolean;
    readonly explicitRetry: boolean;
    readonly running: boolean;
    readonly firstFrame: boolean;
    readonly resolvedFromStore: boolean;
    readonly removedOne: boolean;
    readonly storeCleared: boolean;
}

// INTERFACE :: privacy-safe observations of save controls against the production family build
interface ProductionResult {
    readonly running: boolean;
    readonly firstFrame: boolean;
    readonly quickSaved: boolean;
    readonly persisted: boolean;
    readonly savesCleared: boolean;
    readonly restarted: boolean;
    readonly romStoreUnchanged: boolean;
}

// INTERFACE :: browser-only state retained between pipeline interactions
interface SyntheticBrowserState {
    pickedVisible?: boolean;
    storedVisible?: boolean;
    auditRolesVisible?: boolean;
    overlayChoiceVisible?: boolean;
    startChanges?: boolean[];
    running?: boolean;
    removedOne?: boolean;
    startedRoms?: ReadonlyArray<{ readonly name: string; readonly byteLength: number }>;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Resolved only at run time
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;         // Sole route to ignored private inputs
const FAMILY = "example-family";
const MACHINE = "example_machine";
const GAME_ARCHIVE = "example_machine.zip";
const PARENT_ARCHIVE = "example_parent.zip";
const GAME_ENTRY = "example_game_program.bin";
const PARENT_ENTRY = "example_parent_program.bin";
const TIMEOUT = 90_000;
const SCRIPTED_ADAPTER = `
(() => {
    const browser = window;
    browser.__arcadeHarnessSynthetic = { startChanges: [] };
    let RuntimeError;
    import("/src/index.js").then(async (runtime) => {
        RuntimeError = runtime.ArcadeRuntimeError;
        const storage = runtime.ArcadeStorage.init({ key: "example-family/example_machine" });
        await storage.save(new Uint8Array([9, 8, 7]));
        browser.__arcadeHarnessAdapterReady = true;
    });
    browser.__arcadeHarnessAdapter = {
        type: "scripted-harness",
        buildUrl: "/mame/example-family/",
        build: {
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: "example-family",
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: ["example_machine"],
            artifacts: ["mameexample-family.js", "mameexample-family.wasm"],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false
        },
        start: async (config) => {
            browser.__arcadeHarnessSynthetic.startChanges.push(config.changes !== undefined);
            if (config.changes !== undefined) {
                throw new RuntimeError({
                    code: RuntimeError.CODE.OVERLAY_INCOMPATIBLE,
                    message: "Synthetic overlay is incompatible.",
                    data: null
                });
            }
            browser.__arcadeHarnessSynthetic.startedRoms = config.roms.map((rom) => ({ name: rom.name, byteLength: rom.bytes.length }));
            const tick = new Set();
            const frame = new Set();
            const sound = new Set();
            const exit = new Set();
            const subscribe = (listeners, listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            };
            const session = {
                machine: {
                    name: "example_machine",
                    description: "Synthetic scripted machine",
                    family: "example-family",
                    width: 2,
                    height: 2,
                    refreshHz: 60,
                    orientation: "horizontal",
                    aspectRatio: 1,
                    players: 2,
                    buttons: 2,
                    bios: [],
                    hasNvram: true
                },
                sampleRate: 48000,
                setControl: () => undefined,
                pause: () => undefined,
                resume: () => undefined,
                reset: () => undefined,
                saveState: async () => undefined,
                loadState: async () => undefined,
                persist: async () => new Uint8Array([1, 2, 3]),
                exit: async () => undefined,
                onTick: (listener) => subscribe(tick, listener),
                onFrame: (listener) => subscribe(frame, listener),
                onSound: (listener) => subscribe(sound, listener),
                onExit: (listener) => subscribe(exit, listener)
            };
            setTimeout(() => {
                const rgba = new Uint8ClampedArray([
                    255, 0, 0, 255, 0, 255, 0, 255,
                    0, 0, 255, 255, 255, 255, 255, 255
                ]);
                for (const listener of frame) listener({ width: 2, height: 2, rgba });
            }, 40);
            return session;
        }
    };
})();
`;                                                                  // Plain script avoids test-runner transforms inside the browser realm

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY -> STRING
// Computes the canonical CRC32 text required by synthetic romsets metadata.
const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

// HELPER :: server -> PROMISE(VOID)
// Drops browser keep-alive connections before awaiting listener close.
const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

// HELPER :: (STRING, UINT8ARRAY, UINT8ARRAY -> PROMISE(T)) -> PROMISE(T)
// Builds a synthetic family with game and parent metadata, then serves the real harness page.
const withSyntheticHarness = async <T>(run: (url: string, game: Uint8Array, parent: Uint8Array) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-cabinet-harness-browser-"));
    let server: Server | undefined;
    try {
        const gameEntry = new Uint8Array([3, 1, 4, 1, 5, 9]);
        const parentEntry = new Uint8Array([2, 6, 5, 3, 5, 8]);
        const gameArchive = zipSync({ [GAME_ENTRY]: gameEntry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const parentArchive = zipSync({ [PARENT_ENTRY]: parentEntry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const buildRoot = join(directory, "builds");
        const buildDirectory = join(buildRoot, FAMILY);
        mkdirSync(join(buildDirectory, "romsets"), { recursive: true });
        writeFileSync(join(buildDirectory, "build.json"), `${JSON.stringify({
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: FAMILY,
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: [MACHINE],
            artifacts: [`mame${FAMILY}.js`, `mame${FAMILY}.wasm`],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false,
        }, null, 2)}\n`);
        const metadata: RomSetMetadata = {
            machine: MACHINE,
            family: FAMILY,
            description: "Synthetic parent-backed machine",
            cloneof: "example_parent",
            romof: "example_parent",
            bios: [],
            sampleof: null,
            archives: [
                { name: GAME_ARCHIVE, role: "game" },
                { name: PARENT_ARCHIVE, role: "parent" },
            ],
            roms: [
                { name: GAME_ENTRY, size: gameEntry.length, crc: crc32(gameEntry), sha1: null, archive: GAME_ARCHIVE, optional: false },
                { name: PARENT_ENTRY, size: parentEntry.length, crc: crc32(parentEntry), sha1: null, archive: PARENT_ARCHIVE, optional: false },
            ],
            samples: [],
        };
        writeFileSync(join(buildDirectory, "romsets", `${MACHINE}.json`), `${JSON.stringify(metadata, null, 2)}\n`);

        const harness = await startHarnessServer({ port: 0, buildRoot });
        server = harness.server;
        return await run(harness.url, gameArchive, parentArchive);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs the same cabinet page against the documented private preload and production build.
const withProductionHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    if (CONFIG_ARGUMENT === undefined) throw new Error("production preload config is unavailable");
    const harness = await startHarnessServer({
        port: 0,
        buildRoot: resolve(WORKSPACE, "dist", "mame"),
        preload: CONFIG_ARGUMENT,
    });
    try {
        return await run(harness.url);
    } finally {
        await closeServer(harness.server);
    }
};

const cases: TestCase[] = [
    {
        label: "confirms two picked zips into the local store, audits and starts a scripted real cabinet, then removes and clears",
        run: () => withSyntheticHarness((url, gameArchive, parentArchive) => CTGBrowserTest.init("harness cabinet picker and store")
            .interact("install a scripted public adapter and pick two generated zips", async ({ page }) => {
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready-for-files");
                await page.addScriptTag({ content: SCRIPTED_ADAPTER });
                await page.waitForFunction(() => (window as unknown as { __arcadeHarnessAdapterReady?: boolean }).__arcadeHarnessAdapterReady === true);
                await page.locator("#rom-picker").setInputFiles([
                    { name: GAME_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(gameArchive) },
                    { name: PARENT_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(parentArchive) },
                ]);
                await page.waitForFunction(() => document.querySelectorAll('[data-machine="example_machine"] .archive-list li').length === 2);
                await page.evaluate(() => {
                    const browser = window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState };
                    const text = document.querySelector('[data-machine="example_machine"]')?.textContent ?? "";
                    browser.__arcadeHarnessSynthetic.pickedVisible = text.includes("example_machine.zip")
                        && text.includes("example_parent.zip") && text.includes("ready to store");
                });
                await page.locator('[data-machine="example_machine"] .store-card').click();
                await page.waitForFunction(() => document.querySelectorAll(".store-remove").length === 2
                    && document.querySelector<HTMLElement>('[data-machine="example_machine"]')?.dataset.auditStatus === "ok"
                    && document.querySelector<HTMLButtonElement>('[data-machine="example_machine"] .game-start')?.disabled === false);
                await page.evaluate(() => {
                    const browser = window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState };
                    const store = document.querySelector("#stored-files")?.textContent ?? "";
                    const card = document.querySelector('[data-machine="example_machine"]')?.textContent ?? "";
                    browser.__arcadeHarnessSynthetic.storedVisible = store.includes("example_machine.zip") && store.includes("example_parent.zip");
                    browser.__arcadeHarnessSynthetic.auditRolesVisible = card.includes("example_machine.zip is ready")
                        && card.includes("example_parent.zip is ready");
                });
            })
            .interact("choose incompatible-save recovery, start, observe a frame, remove one archive and clear the store", async ({ page }) => {
                await page.locator('[data-machine="example_machine"] .game-start').click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "overlay-incompatible"
                    && document.querySelector<HTMLButtonElement>("#clear-saves-retry")?.hidden === false);
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState }).__arcadeHarnessSynthetic.overlayChoiceVisible = true;
                });
                await page.locator("#clear-saves-retry").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                    && (document.querySelector<HTMLCanvasElement>("#canvas")?.width ?? 0) > 0);
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState }).__arcadeHarnessSynthetic.running = true;
                });
                await page.locator(".store-remove").first().click();
                await page.waitForFunction(() => document.querySelectorAll(".store-remove").length === 1);
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState }).__arcadeHarnessSynthetic.removedOne = true;
                });
                await page.locator("#clear-files").click();
                await page.waitForFunction(() => document.querySelectorAll(".store-remove").length === 0
                    && document.querySelector<HTMLButtonElement>("#clear-files")?.disabled === true);
            })
            .assertPage("picker, store, audit, frame and destructive store controls all complete", (page) => page.evaluate((): SyntheticResult => {
                const browser = window as unknown as Window & { __arcadeHarnessSynthetic: SyntheticBrowserState };
                const state = browser.__arcadeHarnessSynthetic;
                const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
                return {
                    pickedVisible: state.pickedVisible === true,
                    storedVisible: state.storedVisible === true,
                    auditRolesVisible: state.auditRolesVisible === true,
                    overlayChoiceVisible: state.overlayChoiceVisible === true,
                    explicitRetry: state.startChanges?.length === 2 && state.startChanges[0] === true && state.startChanges[1] === false,
                    running: state.running === true,
                    firstFrame: canvas?.width === 2 && canvas.height === 2,
                    resolvedFromStore: state.startedRoms?.length === 2 && state.startedRoms.every((rom) => rom.byteLength > 0),
                    removedOne: state.removedOne === true,
                    storeCleared: document.querySelector("#stored-files")?.textContent?.includes("No files are saved") === true,
                };
            }), P.equals<SyntheticResult>({
                pickedVisible: true,
                storedVisible: true,
                auditRolesVisible: true,
                overlayChoiceVisible: true,
                explicitRetry: true,
                running: true,
                firstFrame: true,
                resolvedFromStore: true,
                removedOne: true,
                storeCleared: true,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    },
];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "starts the production preload, saves quick state, persists, clears saves and hard-restarts",
    run: () => withProductionHarness((url) => CTGBrowserTest.init("harness cabinet production saves")
        .interact("start the preloaded production cabinet and wait for its first frame", async ({ page }) => {
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready");
            await page.locator('[data-selected="true"] .game-start').click();
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                && (document.querySelector<HTMLCanvasElement>("#canvas")?.width ?? 0) > 0
                && (document.querySelector<HTMLCanvasElement>("#canvas")?.height ?? 0) > 0);
            await page.evaluate(() => {
                const browser = window as unknown as Window & { __arcadeHarnessProduction?: Record<string, unknown> };
                browser.__arcadeHarnessProduction = {
                    running: true,
                    firstFrame: true,
                    storeCount: document.querySelectorAll(".store-remove").length,
                };
            });
        })
        .interact("save quick state, persist it and clear only save storage", async ({ page }) => {
            await page.evaluate(() => { document.querySelector<HTMLDetailsElement>("#corner-menu")!.open = true; });
            await page.locator("#save-state").click();
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "state-saved");
            await page.evaluate(() => {
                (window as unknown as Window & { __arcadeHarnessProduction: Record<string, unknown> }).__arcadeHarnessProduction.quickSaved = true;
            });
            await page.locator("#persist").click();
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "persisted");
            await page.evaluate(() => {
                (window as unknown as Window & { __arcadeHarnessProduction: Record<string, unknown> }).__arcadeHarnessProduction.persisted = true;
            });
            await page.locator("#clear-saves").click();
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "saves-cleared");
            await page.evaluate(() => {
                (window as unknown as Window & { __arcadeHarnessProduction: Record<string, unknown> }).__arcadeHarnessProduction.savesCleared = true;
            });
        })
        .interact("hard-reset and return to a running production session", async ({ page }) => {
            await page.locator("#hard-reset").click();
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "resetting");
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running", undefined, { timeout: TIMEOUT });
        })
        .assertPage("save controls complete and the ROM store is independent", (page) => page.evaluate((): ProductionResult => {
            const browser = window as unknown as Window & { __arcadeHarnessProduction: Record<string, unknown> };
            const state = browser.__arcadeHarnessProduction;
            return {
                running: state.running === true,
                firstFrame: state.firstFrame === true,
                quickSaved: state.quickSaved === true,
                persisted: state.persisted === true,
                savesCleared: state.savesCleared === true,
                restarted: document.querySelector<HTMLElement>("#status")?.dataset.state === "running",
                romStoreUnchanged: state.storeCount === document.querySelectorAll(".store-remove").length,
            };
        }), P.equals<ProductionResult>({
            running: true,
            firstFrame: true,
            quickSaved: true,
            persisted: true,
            savesCleared: true,
            restarted: true,
            romStoreUnchanged: true,
        }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "developer harness cabinet, ROM store and save controls",
    cases,
};

export default testFile;
