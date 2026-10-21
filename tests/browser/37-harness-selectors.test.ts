// realizes: docs/arcade-runtime-spec.md > §11 Developer harness and §12 M8 BIOS and DIP switches

// Dependencies:
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";   // Creates disposable selector metadata and a harmless zip
import { tmpdir } from "node:os";                                  // Parent for synthetic browser inputs
import { dirname, join, resolve } from "node:path";                // Resolves the worktree and temporary build tree
import { fileURLToPath } from "node:url";                          // Finds production artifacts without recording their path
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { zipSync } from "fflate";                                  // Creates the synthetic non-ROM archive
import { startHarnessServer } from "../../scripts/serve-harness.ts";   // Production harness page and server under test

// Type dependencies:
import type { Server } from "node:http";                           // Listener cleanup boundary
import type { RomSetMetadata } from "../../src/index.ts";         // Synthetic selector document shape
import type { TestCase, TestFile } from "../run.ts";               // Test manifest contracts

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: privacy-safe selector and start-boundary observations from the synthetic page
interface SyntheticResult {
    readonly selectorsVisible: boolean;
    readonly preloadSelected: boolean;
    readonly unknownWarned: boolean;
    readonly firstStartExact: boolean;
    readonly restartEnabled: boolean;
    readonly resetStartEmpty: boolean;
}

// INTERFACE :: privacy-safe proof that one generated production selection reached a running session
interface ProductionResult {
    readonly selectorsVisible: boolean;
    readonly nonDefaultChosen: boolean;
    readonly running: boolean;
    readonly reachedSession: boolean;
}

// INTERFACE :: state shared by the scripted adapter and the synthetic assertion
interface SyntheticBrowserState {
    selectorsVisible?: boolean;
    preloadSelected?: boolean;
    unknownWarned?: boolean;
    restartEnabled?: boolean;
    starts: Array<{ readonly bios?: string; readonly dipswitches?: Readonly<Record<string, string>> }>;
}

// INTERFACE :: page-only private production choice compared without returning its names
interface ProductionBrowserState {
    readonly switchName: string;
    readonly settingName: string;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Evaluated only at run time
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;         // Sole route to ignored private inputs
const FAMILY = "selector-family";
const MACHINE = "selector_machine";
const ARCHIVE = "selector_machine.zip";
const ENTRY = "synthetic_program.bin";
const TIMEOUT = 300_000;
const SCRIPTED_ADAPTER = `
(() => {
    const browser = window;
    browser.__arcadeHarnessSelectorTest = { starts: [] };
    browser.__arcadeHarnessAdapter = {
        type: "scripted-selectors",
        buildUrl: "/mame/selector-family/",
        build: {
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: "selector-family",
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: ["selector_machine"],
            artifacts: ["mameselector-family.js", "mameselector-family.wasm"],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false
        },
        start: async (config) => {
            browser.__arcadeHarnessSelectorTest.starts.push({
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
                    name: "selector_machine",
                    description: "Synthetic selector machine",
                    family: "selector-family",
                    width: 2,
                    height: 2,
                    refreshHz: 60,
                    orientation: "horizontal",
                    aspectRatio: 1,
                    players: 2,
                    buttons: 2,
                    bios: [
                        { name: "steady-bios", description: "Steady", isDefault: true },
                        { name: "alternate-bios", description: "Alternate", isDefault: false }
                    ],
                    hasNvram: false
                },
                sampleRate: 48000,
                setControl: () => undefined,
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

// HELPER :: server -> PROMISE(VOID)
// Drops keep-alive connections before awaiting listener close.
const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Serves a synthetic machine with two BIOS options, two DIP fields and one stale preload choice.
const withSyntheticHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-selector-harness-browser-"));
    let server: Server | undefined;
    try {
        const entry = new Uint8Array([8, 5, 3, 0, 9]);
        const archive = zipSync({ [ENTRY]: entry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const buildRoot = join(directory, "builds");
        const buildDirectory = join(buildRoot, FAMILY);
        const inputDirectory = join(directory, "inputs");
        mkdirSync(join(buildDirectory, "romsets"), { recursive: true });
        mkdirSync(inputDirectory);
        writeFileSync(join(inputDirectory, ARCHIVE), archive);
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
            description: "Synthetic selector machine",
            cloneof: null,
            romof: null,
            bios: ["steady-bios", "alternate-bios"],
            defaultBios: "steady-bios",
            sampleof: null,
            archives: [{ name: ARCHIVE, role: "game" }],
            roms: [{ name: ENTRY, size: entry.length, crc: crc32(entry), sha1: null, archive: ARCHIVE, optional: false }],
            dipswitches: [
                {
                    name: "Cabinet Tempo",
                    tag: "TEMPO",
                    mask: 3,
                    values: [
                        { name: "Calm", value: 0, default: true },
                        { name: "Quick", value: 1, default: false },
                    ],
                },
                {
                    name: "Bonus Pattern",
                    tag: "BONUS",
                    mask: 12,
                    values: [
                        { name: "Sparse", value: 0, default: true },
                        { name: "Dense", value: 4, default: false },
                    ],
                },
            ],
            samples: [],
        };
        writeFileSync(join(buildDirectory, "romsets", `${MACHINE}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
        const configPath = join(directory, "preload.json");
        writeFileSync(configPath, `${JSON.stringify({
            family: FAMILY,
            machine: MACHINE,
            bios: "alternate-bios",
            roms: [`inputs/${ARCHIVE}`],
            dipswitches: { "Cabinet Tempo": "Quick", "Retired Dial": "Phantom" },
            autostart: false,
        }, null, 2)}\n`);

        const harness = await startHarnessServer({ port: 0, buildRoot, preload: configPath });
        server = harness.server;
        return await run(harness.url);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs the production harness against only the ignored config named by the documented environment variable.
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
        label: "metadata selectors pass one BIOS and one changed DIP, warn on a stale preload name and restart at defaults",
        run: () => withSyntheticHarness((url) => CTGBrowserTest.init("harness synthetic BIOS and DIP selectors")
            .interact("observe preload selections and install the scripted cabinet boundary", async ({ page }) => {
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#audit")?.dataset.status === "ok"
                    && document.querySelector<HTMLElement>("#machine-selectors")?.hidden === false);
                await page.addScriptTag({ content: SCRIPTED_ADAPTER });
                await page.waitForFunction(() => (window as unknown as { __arcadeHarnessAdapterReady?: boolean }).__arcadeHarnessAdapterReady === true);
                await page.evaluate(() => {
                    const browser = window as unknown as Window & { __arcadeHarnessSelectorTest: SyntheticBrowserState };
                    const bios = document.querySelector<HTMLSelectElement>("#bios-select");
                    const dips = Array.from(document.querySelectorAll<HTMLSelectElement>(".dip-select"));
                    const tempo = dips.find((control) => control.dataset.switchName === "Cabinet Tempo");
                    const bonus = dips.find((control) => control.dataset.switchName === "Bonus Pattern");
                    browser.__arcadeHarnessSelectorTest.selectorsVisible = bios?.hidden === false && dips.length === 2;
                    browser.__arcadeHarnessSelectorTest.preloadSelected = bios?.value === "alternate-bios"
                        && tempo?.value === "Quick" && bonus?.value === "Sparse";
                    browser.__arcadeHarnessSelectorTest.unknownWarned = document.querySelector<HTMLElement>("#selector-warning")?.hidden === false;
                    bios?.dispatchEvent(new Event("change", { bubbles: true }));
                });
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "selection-changed");
                await page.locator("#audit-roms").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready"
                    && document.querySelector<HTMLButtonElement>("#start")?.disabled === false);
            })
            .interact("start once, reset the DIP fields and use the explicit selector restart", async ({ page }) => {
                await page.locator("#start").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                    && (window as unknown as { __arcadeHarnessSelectorTest: SyntheticBrowserState }).__arcadeHarnessSelectorTest.starts.length === 1);
                await page.locator("#reset-dips").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "restart-required"
                    && document.querySelector<HTMLButtonElement>("#restart-switches")?.disabled === false);
                await page.evaluate(() => {
                    (window as unknown as Window & { __arcadeHarnessSelectorTest: SyntheticBrowserState })
                        .__arcadeHarnessSelectorTest.restartEnabled = true;
                });
                await page.locator("#restart-switches").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                    && (window as unknown as { __arcadeHarnessSelectorTest: SyntheticBrowserState }).__arcadeHarnessSelectorTest.starts.length === 2);
            })
            .assertPage("both starts carry exactly the visible non-default page state", (page) => page.evaluate((): SyntheticResult => {
                const state = (window as unknown as Window & { __arcadeHarnessSelectorTest: SyntheticBrowserState }).__arcadeHarnessSelectorTest;
                const first = state.starts[0];
                const second = state.starts[1];
                return {
                    selectorsVisible: state.selectorsVisible === true,
                    preloadSelected: state.preloadSelected === true,
                    unknownWarned: state.unknownWarned === true,
                    firstStartExact: first?.bios === "alternate-bios"
                        && JSON.stringify(first.dipswitches) === JSON.stringify({ "Cabinet Tempo": "Quick" }),
                    restartEnabled: state.restartEnabled === true,
                    resetStartEmpty: second?.bios === "alternate-bios"
                        && second.dipswitches !== undefined && Object.keys(second.dipswitches).length === 0,
                };
            }), P.equals<SyntheticResult>({
                selectorsVisible: true,
                preloadSelected: true,
                unknownWarned: true,
                firstStartExact: true,
                restartEnabled: true,
                resetStartEmpty: true,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    },
];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "a generated non-default DIP selection reaches the environment-gated production session",
    run: () => withProductionHarness((url) => CTGBrowserTest.init("harness production DIP selector")
        .interact("select one generated non-default value and start the preloaded cabinet", async ({ page }) => {
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready"
                && document.querySelectorAll(".dip-select").length > 0);
            await page.evaluate(() => {
                const controls = Array.from(document.querySelectorAll<HTMLSelectElement>(".dip-select"));
                for (const control of controls) {
                    const setting = Array.from(control.options).find((option) => option.value !== control.dataset.defaultValue);
                    if (setting === undefined) continue;
                    control.value = setting.value;
                    (window as unknown as Window & { __arcadeHarnessProductionSelector?: ProductionBrowserState }).__arcadeHarnessProductionSelector = {
                        switchName: control.dataset.switchName!,
                        settingName: setting.value,
                    };
                    control.dispatchEvent(new Event("change", { bubbles: true }));
                    return;
                }
                throw new Error("the served metadata has no non-default DIP setting");
            });
            const autostart = await page.evaluate(async () => (await fetch("/preload.json").then((response) => response.json()) as { autostart?: boolean }).autostart === true);
            if (autostart) {
                await page.locator("#status").click();
            } else {
                await page.locator("#audit-roms").click();
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready");
                await page.locator("#start").click();
            }
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "running"
                && (window as unknown as { __arcadeHarnessLastStartConfig?: unknown }).__arcadeHarnessLastStartConfig !== undefined,
            undefined, { timeout: TIMEOUT });
        })
        .assertPage("the running session was started with that generated selection", (page) => page.evaluate((): ProductionResult => {
            const browser = window as unknown as Window & {
                __arcadeHarnessProductionSelector?: ProductionBrowserState;
                __arcadeHarnessLastStartConfig?: { readonly dipswitches: Readonly<Record<string, string>> };
            };
            const selected = browser.__arcadeHarnessProductionSelector;
            const sent = browser.__arcadeHarnessLastStartConfig?.dipswitches;
            return {
                selectorsVisible: document.querySelector<HTMLElement>("#machine-selectors")?.hidden === false,
                nonDefaultChosen: selected !== undefined,
                running: document.querySelector<HTMLElement>("#status")?.dataset.state === "running",
                reachedSession: selected !== undefined && sent?.[selected.switchName] === selected.settingName,
            };
        }), P.equals<ProductionResult>({
            selectorsVisible: true,
            nonDefaultChosen: true,
            running: true,
            reachedSession: true,
        }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "developer harness BIOS and DIP selectors",
    cases,
};

export default testFile;
