// realizes: docs/arcade-runtime-spec.md > §11 Developer harness drop-first library view (browser acceptance)

// Dependencies:
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";   // Builds two disposable synthetic family trees and the requested screenshot directory
import { tmpdir } from "node:os";                                  // Parent for disposable browser inputs
import { dirname, join, resolve } from "node:path";                // Locates the worktree and synthetic build root
import { fileURLToPath } from "node:url";                          // Locates the ignored screenshot destination at run time
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { zipSync } from "fflate";                                  // Creates harmless synthetic zip inputs
import { startHarnessServer } from "../../scripts/serve-harness.ts";   // Production page and server under test

// Type dependencies:
import type { Server } from "node:http";                           // Listener cleanup boundary
import type { RomSetMetadata } from "../../src/index.ts";         // Synthetic metadata must match the public format
import type { TestFile } from "../run.ts";                        // Test manifest shape

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: complete drop-first, filter, selector and phone-layout observations
interface LibraryResult {
    readonly missingParentNamed: boolean;
    readonly companionAttached: boolean;
    readonly childReady: boolean;
    readonly unknownShown: boolean;
    readonly threeGamesShown: boolean;
    readonly familyFilterUnknown: boolean;
    readonly changedDipReceived: boolean;
    readonly strictRejectedPldDifference: boolean;
    readonly mameWarningReady: boolean;
    readonly warnedFileDetailed: boolean;
    readonly mameChoicePersisted: boolean;
    readonly mameStartConfigured: boolean;
    readonly noHorizontalScroll: boolean;
}

// INTERFACE :: browser-only observations shared across interactions
interface BrowserState {
    missingParentNamed?: boolean;
    companionAttached?: boolean;
    childReady?: boolean;
    unknownShown?: boolean;
    threeGamesShown?: boolean;
    familyFilterUnknown?: boolean;
    strictRejectedPldDifference?: boolean;
    mameWarningReady?: boolean;
    warnedFileDetailed?: boolean;
    mameChoicePersisted?: boolean;
    noHorizontalScroll?: boolean;
    starts: Array<{ readonly bios?: string; readonly dipswitches?: Readonly<Record<string, string>> }>;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCREENSHOT = resolve(WORKSPACE, "res", "w18-library.png");
const FAMILY_ONE = "paper-family";
const FAMILY_TWO = "switch-family";
const CHILD = "paper_runner";
const STANDALONE = "solo_lamp";
const SELECTOR = "switch_quest";
const CHILD_ARCHIVE = `${CHILD}.zip`;
const PARENT_ARCHIVE = "paper_base.zip";
const STANDALONE_ARCHIVE = `${STANDALONE}.zip`;
const SELECTOR_ARCHIVE = `${SELECTOR}.zip`;
const UNKNOWN_ARCHIVE = "mystery_box.zip";
const TIMEOUT = 90_000;
const SCRIPTED_ADAPTER = `
(() => {
    const browser = window;
    browser.__arcadeHarnessLibraryTest = { starts: [] };
    browser.__arcadeHarnessAdapter = {
        type: "scripted-library",
        buildUrl: "/mame/switch-family/",
        build: {
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: "switch-family",
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: ["switch_quest"],
            artifacts: ["mameswitch-family.js", "mameswitch-family.wasm"],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false
        },
        start: async (config) => {
            browser.__arcadeHarnessLibraryTest.starts.push({
                ...(config.bios === undefined ? {} : { bios: config.bios }),
                dipswitches: { ...(config.dipswitches || {}) }
            });
            const tick = new Set();
            const frame = new Set();
            const sound = new Set();
            const exit = new Set();
            const subscribe = (listeners, listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            };
            return {
                machine: {
                    name: "switch_quest",
                    description: "Switch Quest",
                    family: "switch-family",
                    width: 2,
                    height: 2,
                    refreshHz: 60,
                    orientation: "horizontal",
                    aspectRatio: 1,
                    players: 2,
                    buttons: 2,
                    bios: [
                        { name: "home", description: "Home", isDefault: true },
                        { name: "travel", description: "Travel", isDefault: false }
                    ],
                    inputs: { analog: [], dualStick: false, keys: [], volume: false },
                    hasNvram: false,
                    supportsSave: true
                },
                sampleRate: 48000,
                setControl: () => undefined,
                setAxis: () => undefined,
                pause: () => undefined,
                resume: () => undefined,
                reset: () => undefined,
                saveState: async () => undefined,
                loadState: async () => undefined,
                persist: async () => null,
                exit: async () => undefined,
                onTick: (listener) => subscribe(tick, listener),
                onFrame: (listener) => subscribe(frame, listener),
                onSound: (listener) => subscribe(sound, listener),
                onExit: (listener) => subscribe(exit, listener)
            };
        }
    };
    browser.__arcadeHarnessAdapterReady = true;
})();
`;                                                                  // Plain script executes inside the browser without runner transforms

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY -> STRING
// Computes the canonical CRC32 text required by synthetic metadata.
const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

// HELPER :: STRING, STRING, [STRING] -> buildInfo JSON
// Produces one valid synthetic build index without emulator artifacts.
const buildInfo = (family: string, artifactStem: string, machines: ReadonlyArray<string>): object => ({
    formatVersion: 1,
    buildId: "0".repeat(64),
    adapter: "mame",
    engine: family,
    emulatorVersion: "mame0161",
    emsdkVersion: "1.38.31",
    machines,
    artifacts: [`${artifactStem}.js`, `${artifactStem}.wasm`],
    romsetsUrl: "romsets/",
    memoryPages: 4096,
    licenses: [],
    pthreads: false,
});

// HELPER :: server -> PROMISE(VOID)
// Drops browser keep-alive connections before awaiting listener close.
const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

// HELPER :: (STRING, archives -> PROMISE(T)) -> PROMISE(T)
// Serves two families and three indexed machines, then removes the disposable tree.
const withSyntheticHarness = async <T>(run: (url: string, archives: Readonly<Record<string, Uint8Array>>) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-library-harness-browser-"));
    let server: Server | undefined;
    try {
        const entries = {
            child: new Uint8Array([1, 4, 1, 4]),
            parent: new Uint8Array([2, 7, 1, 8]),
            standalone: new Uint8Array([3, 1, 6, 1]),
            selector: new Uint8Array([5, 9, 2, 6]),
            pldExpected: new Uint8Array([5, 3, 5]),
            pldActual: new Uint8Array([5, 3]),
        };
        const archives = {
            child: zipSync({ "runner_program.bin": entries.child }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }),
            parent: zipSync({ "base_program.bin": entries.parent }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }),
            standalone: zipSync({ "lamp_program.bin": entries.standalone }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }),
            selector: zipSync({ "switch_program.bin": entries.selector, "logic.bin": entries.pldActual }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }),
            unknown: zipSync({ "unknown.bin": new Uint8Array([8, 9]) }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }),
        };
        const buildRoot = join(directory, "builds");
        const first = join(buildRoot, FAMILY_ONE);
        const second = join(buildRoot, FAMILY_TWO);
        mkdirSync(join(first, "romsets"), { recursive: true });
        mkdirSync(join(second, "romsets"), { recursive: true });
        writeFileSync(join(first, "build.json"), `${JSON.stringify(buildInfo(FAMILY_ONE, "mamepaper-family", [CHILD, STANDALONE]), null, 2)}\n`);
        writeFileSync(join(second, "build.json"), `${JSON.stringify(buildInfo(FAMILY_TWO, "mameswitch-family", [SELECTOR]), null, 2)}\n`);

        const child: RomSetMetadata = {
            machine: CHILD,
            family: FAMILY_ONE,
            description: "Paper Runner",
            cloneof: "paper_base",
            romof: "paper_base",
            bios: [],
            sampleof: null,
            archives: [
                { name: CHILD_ARCHIVE, role: "game" },
                { name: PARENT_ARCHIVE, role: "parent" },
            ],
            roms: [
                { name: "runner_program.bin", size: entries.child.length, crc: crc32(entries.child), sha1: null, archive: CHILD_ARCHIVE, optional: false },
                { name: "base_program.bin", size: entries.parent.length, crc: crc32(entries.parent), sha1: null, archive: PARENT_ARCHIVE, optional: false },
            ],
            samples: [],
        };
        const standalone: RomSetMetadata = {
            machine: STANDALONE,
            family: FAMILY_ONE,
            description: "Solo Lamp",
            cloneof: null,
            romof: null,
            bios: [],
            sampleof: null,
            archives: [{ name: STANDALONE_ARCHIVE, role: "game" }],
            roms: [{ name: "lamp_program.bin", size: entries.standalone.length, crc: crc32(entries.standalone), sha1: null, archive: STANDALONE_ARCHIVE, optional: false }],
            samples: [],
        };
        const selector: RomSetMetadata = {
            machine: SELECTOR,
            family: FAMILY_TWO,
            description: "Switch Quest",
            cloneof: null,
            romof: null,
            bios: ["home", "travel"],
            defaultBios: "home",
            sampleof: null,
            archives: [{ name: SELECTOR_ARCHIVE, role: "game" }],
            roms: [
                { name: "switch_program.bin", size: entries.selector.length, crc: crc32(entries.selector), sha1: null, archive: SELECTOR_ARCHIVE, optional: false, region: "maincpu" },
                { name: "logic.bin", size: entries.pldExpected.length, crc: crc32(entries.pldExpected), sha1: null, archive: SELECTOR_ARCHIVE, optional: false, region: "plds" },
            ],
            dipswitches: [{
                name: "Game Speed",
                tag: "SPEED",
                mask: 3,
                values: [
                    { name: "Normal", value: 0, default: true },
                    { name: "Fast", value: 1, default: false },
                ],
            }],
            samples: [],
        };
        writeFileSync(join(first, "romsets", `${CHILD}.json`), `${JSON.stringify(child, null, 2)}\n`);
        writeFileSync(join(first, "romsets", `${STANDALONE}.json`), `${JSON.stringify(standalone, null, 2)}\n`);
        writeFileSync(join(second, "romsets", `${SELECTOR}.json`), `${JSON.stringify(selector, null, 2)}\n`);

        const harness = await startHarnessServer({ port: 0, buildRoot });
        server = harness.server;
        return await run(harness.url, archives);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

const testFile: TestFile = {
    label: "developer harness drop-first game library",
    cases: [{
        label: "identifies games, attaches companions, filters families, starts one changed card and fits a phone viewport",
        run: () => withSyntheticHarness((url, archives) => CTGBrowserTest.init("harness synthetic game library")
            .interact("drop a child without its parent, then attach and store the parent", async ({ page }) => {
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready-for-files");
                await page.addScriptTag({ content: SCRIPTED_ADAPTER });
                await page.waitForFunction(() => (window as unknown as { __arcadeHarnessAdapterReady?: boolean }).__arcadeHarnessAdapterReady === true);
                await page.locator("#rom-picker").setInputFiles({ name: CHILD_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(archives.child!) });
                await page.waitForFunction(() => document.querySelector('[data-machine="paper_runner"]')?.textContent?.includes("Needs paper_base.zip") === true);
                await page.evaluate(() => {
                    const state = (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest;
                    state.missingParentNamed = document.querySelector('[data-machine="paper_runner"]')?.textContent?.includes("Needs paper_base.zip") === true;
                });
                await page.locator("#rom-picker").setInputFiles({ name: PARENT_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(archives.parent!) });
                await page.waitForFunction(() => document.querySelector('[data-machine="paper_runner"]')?.textContent?.includes("paper_base.zip is ready to store") === true);
                await page.evaluate(() => {
                    const browser = window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState };
                    browser.__arcadeHarnessLibraryTest.companionAttached = document.querySelector('[data-unknown="paper_base"]') === null;
                });
                await page.locator('[data-machine="paper_runner"] .store-card').click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-machine="paper_runner"]')?.dataset.auditStatus === "ok");
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.childReady = true;
                });
            })
            .interact("show an unknown file and all three synthetic game cards", async ({ page }) => {
                await page.locator("#rom-picker").setInputFiles({ name: UNKNOWN_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(archives.unknown!) });
                await page.waitForFunction(() => document.querySelector('[data-unknown="mystery_box"]') !== null);
                await page.locator("#rom-picker").setInputFiles([
                    { name: SELECTOR_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(archives.selector!) },
                    { name: STANDALONE_ARCHIVE, mimeType: "application/zip", buffer: Buffer.from(archives.standalone!) },
                ]);
                await page.waitForFunction(() => document.querySelectorAll(".game-card").length === 3);
                await page.evaluate(() => {
                    const state = (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest;
                    state.unknownShown = document.querySelector('[data-unknown="mystery_box"]') !== null;
                    state.threeGamesShown = document.querySelectorAll(".game-card").length === 3;
                });
                await page.locator('[data-machine="switch_quest"] .store-card').click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-machine="switch_quest"]')?.dataset.auditStatus === "bad");
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.strictRejectedPldDifference
                        = document.querySelector<HTMLButtonElement>('[data-machine="switch_quest"] .game-start')?.disabled === true;
                });
                await page.locator(".library-settings > summary").click();
                await page.locator("#file-check").selectOption("mame");
                await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-machine="switch_quest"]')?.dataset.auditStatus === "ok"
                    && document.querySelector('[data-machine="switch_quest"] .game-verdict')?.textContent?.includes("1 files differ from 0.161; MAME ignores them") === true);
                await page.evaluate(() => {
                    const state = (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest;
                    state.mameWarningReady = document.querySelector<HTMLButtonElement>('[data-machine="switch_quest"] .game-start')?.disabled === false;
                    const detail = document.querySelector("#audit")?.textContent ?? "";
                    state.warnedFileDetailed = detail.includes("WARNINGS") && detail.includes("wrong-size  switch_quest.zip/logic.bin");
                });
            })
            .interact("change one game setting, capture the phone view and start that card", async ({ page }) => {
                await page.locator('[data-machine="switch_quest"] .machine-selectors > summary').click();
                await page.locator('[data-machine="switch_quest"] .dip-select').selectOption("Fast");
                await page.setViewportSize({ width: 390, height: 844 });
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.noHorizontalScroll = document.documentElement.scrollWidth <= window.innerWidth;
                });
                mkdirSync(dirname(SCREENSHOT), { recursive: true });
                await page.screenshot({ path: SCREENSHOT, fullPage: true });
                await page.locator('[data-machine="switch_quest"] .game-start').click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                    && (window as unknown as { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.starts.length === 1);
            })
            .interact("limit the index to one family and observe the other family's stored zip as unknown", async ({ page }) => {
                const restricted = await page.context().newPage();
                try {
                    await restricted.goto(`${url}?family=${FAMILY_ONE}`);
                    await restricted.waitForFunction(() => document.querySelector('[data-unknown="switch_quest"]') !== null);
                    await restricted.waitForFunction(() => (document.querySelector("#file-check") as HTMLSelectElement | null)?.value === "mame");
                    await page.evaluate(() => {
                        (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.familyFilterUnknown = true;
                    });
                    await page.evaluate(() => {
                        (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest.mameChoicePersisted = true;
                    });
                } finally {
                    await restricted.close();
                }
            })
            .assertPage("the complete library flow remains card-local and phone-safe", (page) => page.evaluate((): LibraryResult => {
                const state = (window as unknown as Window & { __arcadeHarnessLibraryTest: BrowserState }).__arcadeHarnessLibraryTest;
                const started = state.starts[0];
                const lastStart = (window as unknown as { __arcadeHarnessLastStartConfig?: { readonly auditStrictness?: string } }).__arcadeHarnessLastStartConfig;
                return {
                    missingParentNamed: state.missingParentNamed === true,
                    companionAttached: state.companionAttached === true,
                    childReady: state.childReady === true,
                    unknownShown: state.unknownShown === true,
                    threeGamesShown: state.threeGamesShown === true,
                    familyFilterUnknown: state.familyFilterUnknown === true,
                    changedDipReceived: started?.bios === "home"
                        && JSON.stringify(started.dipswitches) === JSON.stringify({ "Game Speed": "Fast" }),
                    strictRejectedPldDifference: state.strictRejectedPldDifference === true,
                    mameWarningReady: state.mameWarningReady === true,
                    warnedFileDetailed: state.warnedFileDetailed === true,
                    mameChoicePersisted: state.mameChoicePersisted === true,
                    mameStartConfigured: lastStart?.auditStrictness === "mame",
                    noHorizontalScroll: state.noHorizontalScroll === true,
                };
            }), P.equals<LibraryResult>({
                missingParentNamed: true,
                companionAttached: true,
                childReady: true,
                unknownShown: true,
                threeGamesShown: true,
                familyFilterUnknown: true,
                changedDipReceived: true,
                strictRejectedPldDifference: true,
                mameWarningReady: true,
                warnedFileDetailed: true,
                mameChoicePersisted: true,
                mameStartConfigured: true,
                noHorizontalScroll: true,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    }],
};

export default testFile;
