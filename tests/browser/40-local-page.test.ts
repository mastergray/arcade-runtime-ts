// realizes: docs/ui-spec.md > §6 decision 6 and §7 local desktop page browser acceptance

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";
import { chromium } from "playwright";
import { zipSync } from "fflate";
import { buildUi } from "../../scripts/build-ui.ts";
import { startHarnessServer } from "../../scripts/serve-harness.ts";
import type { RomSetMetadata } from "../../src/index.ts";
import type { TestCase, TestFile } from "../run.ts";

interface SyntheticResult {
    readonly missingListed: boolean;
    readonly checkThenPlay: boolean;
    readonly runningChrome: boolean;
    readonly runtimeActions: boolean;
    readonly slotRoundTrip: boolean;
    readonly controllerAndSize: boolean;
    readonly dialogsAndClear: boolean;
    readonly storedRemoved: boolean;
    readonly keyboardFocus: boolean;
}

interface SyntheticState {
    missingListed?: boolean;
    checkThenPlay?: boolean;
    runningChrome?: boolean;
    slotRoundTrip?: boolean;
    controllerAndSize?: boolean;
    dialogsAndClear?: boolean;
    storedRemoved?: boolean;
    keyboardFocus?: boolean;
    pause: number;
    resume: number;
    reset: string[];
    saves: string[];
    loads: string[];
    controls: string[];
}

interface ProductionResult {
    readonly running: boolean;
    readonly videoStatus: boolean;
    readonly slotRoundTripWhenSupported: boolean;
}

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const FAMILY = "synthetic-family";
const MACHINE = "synthetic_machine";
const ARCHIVE = `${MACHINE}.zip`;
const ENTRY = "synthetic_program.bin";
const TIMEOUT = 120_000;
const CHROMIUM_AVAILABLE = existsSync(chromium.executablePath());
const SCRIPTED_ADAPTER = `
(() => {
    const browser = window;
    const state = browser.__arcadeLocalTest = {
        pause: 0, resume: 0, reset: [], saves: [], loads: [], controls: []
    };
    browser.__arcadeLocalAdapter = {
        type: "scripted-local",
        buildUrl: "/mame/synthetic-family/",
        build: {
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: "synthetic-family",
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: ["synthetic_machine"],
            artifacts: ["mamesynthetic-family.js", "mamesynthetic-family.wasm"],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false
        },
        start: async () => {
            const tick = new Set();
            const frame = new Set();
            const sound = new Set();
            const exit = new Set();
            const subscribe = (listeners, listener) => { listeners.add(listener); return () => listeners.delete(listener); };
            return {
                machine: {
                    name: "synthetic_machine",
                    description: "Synthetic game",
                    family: "synthetic-family",
                    width: 4,
                    height: 3,
                    refreshHz: 60,
                    orientation: "horizontal",
                    aspectRatio: 4 / 3,
                    players: 2,
                    buttons: 2,
                    inputs: { analog: [], dualStick: false, keys: [{ name: "Advance", key: "F2", player: 1 }], volume: true },
                    bios: [],
                    hasNvram: true,
                    supportsSave: true
                },
                sampleRate: 48000,
                setControl: (control, pressed) => state.controls.push(control.kind + ":" + String(pressed)),
                setAxis: () => undefined,
                pause: () => { state.pause++; },
                resume: () => { state.resume++; },
                reset: (kind) => state.reset.push(kind),
                saveState: async (slot) => { state.saves.push(slot); },
                loadState: async (slot) => { state.loads.push(slot); },
                persist: async () => new Uint8Array([1, 2, 3]),
                exit: async () => undefined,
                onTick: (listener) => subscribe(tick, listener),
                onFrame: (listener) => subscribe(frame, listener),
                onSound: (listener) => subscribe(sound, listener),
                onExit: (listener) => subscribe(exit, listener)
            };
        }
    };
})();
`;

const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

const withSyntheticPage = async <T>(run: (url: string, archive: Uint8Array) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-local-page-browser-"));
    let server: Server | undefined;
    try {
        const entry = new Uint8Array([3, 1, 4, 1, 5]);
        const archive = zipSync({ [ENTRY]: entry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const buildRoot = join(directory, "builds");
        const familyRoot = join(buildRoot, FAMILY);
        const uiRoot = join(directory, "ui");
        mkdirSync(join(familyRoot, "romsets"), { recursive: true });
        writeFileSync(join(familyRoot, "build.json"), `${JSON.stringify({
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
            description: "Synthetic game",
            cloneof: null,
            romof: null,
            bios: [],
            sampleof: null,
            archives: [{ name: ARCHIVE, role: "game" }],
            roms: [{ name: ENTRY, size: entry.length, crc: crc32(entry), sha1: null, archive: ARCHIVE, optional: false }],
            samples: [],
        };
        writeFileSync(join(familyRoot, "romsets", `${MACHINE}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
        await buildUi(uiRoot);
        const harness = await startHarnessServer({ port: 0, buildRoot, uiRoot });
        server = harness.server;
        return await run(`${harness.url}ui/local`, archive);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

const withProductionPage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    if (CONFIG_ARGUMENT === undefined) throw new Error("production preload config is unavailable");
    const directory = mkdtempSync(join(tmpdir(), "arcade-local-production-browser-"));
    try {
        await buildUi(directory);
        const harness = await startHarnessServer({
            port: 0,
            buildRoot: resolve(WORKSPACE, "dist", "mame"),
            uiRoot: directory,
            preload: CONFIG_ARGUMENT,
        });
        try { return await run(`${harness.url}ui/local`); }
        finally { await closeServer(harness.server); }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
};

const cases: TestCase[] = [{
    label: "the synthetic local library imports, plays, controls, saves, checks and removes through stable selectors",
    run: () => withSyntheticPage((url, archive) => CTGBrowserTest.init("local page synthetic flow")
        .interact("drop a synthetic archive and observe Check before Play", async ({ page }) => {
            await page.goto(url);
            await page.waitForSelector("[data-local-loading]", { state: "detached" });
            await page.addScriptTag({ content: SCRIPTED_ADAPTER });
            await page.evaluate(({ name, bytes }) => {
                const transfer = new DataTransfer();
                transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/zip" }));
                document.body.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
            }, { name: ARCHIVE, bytes: Array.from(archive) });
            await page.waitForFunction(() => document.querySelector('[data-row="synthetic-family/synthetic_machine"]')?.textContent?.includes("Not stored") === true
                && document.querySelector('[data-row-action="synthetic-family/synthetic_machine"]')?.textContent?.trim() === "Check");
            await page.evaluate(() => {
                const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
                state.missingListed = document.querySelector('[data-row="synthetic-family/synthetic_machine"]') !== null;
            });
            await page.locator("[data-store-all-check]").click();
            await page.waitForFunction(() => document.querySelector('[data-row-action="synthetic-family/synthetic_machine"]')?.textContent?.trim() === "Play");
            await page.evaluate(() => { (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest.checkThenPlay = true; });
            await page.locator("[data-close-import]").click();
        })
        .interact("start and drive the fixed runtime shortcuts and slot group", async ({ page }) => {
            await page.locator('[data-row-action="synthetic-family/synthetic_machine"]').click();
            await page.waitForFunction(() => document.querySelector('[data-component="status-bar"]')?.getAttribute("data-state") === "running"
                && document.querySelector(".title-text")?.textContent?.includes("Synthetic game") === true);
            await page.evaluate(() => {
                const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
                state.runningChrome = document.querySelector('[data-status-cell="video"]')?.textContent?.includes("4 × 3") === true;
            });
            await page.locator('[data-shortcut="pause"] button').click();
            await page.waitForFunction(() => document.querySelector('[data-shortcut="pause"] button')?.textContent?.includes("Resume") === true);
            await page.locator('[data-shortcut="pause"] button').click();
            await page.locator('[data-shortcut="mute"] button').click();
            await page.locator('[data-shortcut="reset"] button').click();
            await page.locator('[data-shortcut="slots"] button').filter({ hasText: "Save" }).click();
            await page.waitForFunction(() => document.querySelector<HTMLSelectElement>("[data-slot-picker]")?.selectedOptions[0]?.textContent?.includes("empty") === false);
            await page.locator('[data-shortcut="slots"] button').filter({ hasText: "Load" }).click();
            await page.evaluate(() => {
                const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
                state.slotRoundTrip = state.saves.includes("slot1") && state.loads.includes("slot1");
            });
        })
        .interact("toggle the controller, change size and open both diagnostic dialogs", async ({ page }) => {
            await page.locator('[data-shortcut="controller"] button').click();
            await page.waitForSelector("[data-controller-strip]");
            await page.locator('[data-menu-title="view"]').click();
            await page.locator('[data-menu-item="size-integer"]').click();
            await page.locator('[data-menu-title="log"]').click();
            await page.locator('[data-menu-item="technical-log"]').click();
            await page.waitForSelector('[data-modal="technical-log"]');
            await page.locator('[data-modal="technical-log"] [data-modal-close]').click();
            await page.locator('[data-menu-title="log"]').click();
            await page.locator('[data-menu-item="file-check"]').click();
            await page.waitForSelector('[data-modal="file-check"]');
            await page.locator('[data-modal="file-check"] [data-modal-close]').click();
            await page.evaluate(() => {
                const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
                const cabinet = (window as unknown as { __arcadeLocalCabinet?: { player: { display: { scaling: string } } } }).__arcadeLocalCabinet;
                state.controllerAndSize = document.querySelector('[data-controller-strip] [aria-label="Button 3"]')?.getAttribute("data-off") === "true"
                    && cabinet?.player.display.scaling === "integer";
                state.dialogsAndClear = true;
            });
        })
        .interact("confirm saved-play clearing, remove the stored archive and walk focus from menus to rows", async ({ page }) => {
            await page.locator('[data-menu-title="state"]').click();
            await page.locator('[data-menu-item="clear-saved-play"]').click();
            await page.waitForSelector('[data-modal="clear-saved-play"]');
            await page.locator('[data-modal="clear-saved-play"] button').filter({ hasText: "Clear saved play" }).click();
            await page.waitForFunction(() => document.querySelector<HTMLSelectElement>("[data-slot-picker]")?.selectedOptions[0]?.textContent?.includes("empty") === true);
            await page.locator('[data-menu-title="configure"]').focus();
            await page.keyboard.press("ArrowRight");
            const menuFocused = await page.locator('[data-menu-title="state"]').getAttribute("data-focus") === "true";
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");
            const rowFocused = await page.evaluate(() => document.activeElement?.closest('[data-row="synthetic-family/synthetic_machine"]') !== null);
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="stored-files"]').click();
            await page.waitForSelector('[data-modal="import"] [data-stored-files-tab]');
            await page.locator(`[data-remove-stored="${ARCHIVE}"]`).click();
            await page.waitForFunction(() => document.querySelector("[data-stored-file]") === null);
            await page.locator("[data-close-import]").click();
            await page.evaluate(({ menu, row }) => {
                const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
                state.storedRemoved = document.querySelector('[data-library-count="files"]')?.textContent?.startsWith("0") === true;
                state.keyboardFocus = menu && row;
            }, { menu: menuFocused, row: rowFocused });
        })
        .assertPage("the complete synthetic local-page flow reached the model and runtime boundaries", (page) => page.evaluate((): SyntheticResult => {
            const state = (window as unknown as Window & { __arcadeLocalTest: SyntheticState }).__arcadeLocalTest;
            return {
                missingListed: state.missingListed === true,
                checkThenPlay: state.checkThenPlay === true,
                runningChrome: state.runningChrome === true,
                runtimeActions: state.pause === 1 && state.resume === 1 && state.reset.includes("soft"),
                slotRoundTrip: state.slotRoundTrip === true,
                controllerAndSize: state.controllerAndSize === true,
                dialogsAndClear: state.dialogsAndClear === true,
                storedRemoved: state.storedRemoved === true,
                keyboardFocus: state.keyboardFocus === true,
            };
        }), P.equals<SyntheticResult>({
            missingListed: true,
            checkThenPlay: true,
            runningChrome: true,
            runtimeActions: true,
            slotRoundTrip: true,
            controllerAndSize: true,
            dialogsAndClear: true,
            storedRemoved: true,
            keyboardFocus: true,
        }))
        .start(url, { headless: true, timeout: TIMEOUT })),
}];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "the private production preload starts and round-trips slot 1 when the driver supports save states",
    run: () => withProductionPage((url) => CTGBrowserTest.init("local page production preload")
        .interact("start the selected preloaded game from its Play action", async ({ page }) => {
            await page.goto(url);
            await page.waitForFunction(() => document.querySelector('[data-selected="true"] [data-row-action]')?.textContent?.trim() === "Play");
            await page.locator('[data-selected="true"] [data-row-action]').click();
            await page.waitForFunction(() => document.querySelector('[data-component="status-bar"]')?.getAttribute("data-state") === "running"
                && document.querySelector('[data-status-cell="video"]')?.textContent?.includes("×") === true, undefined, { timeout: TIMEOUT });
            const save = page.locator('[data-shortcut="slots"] button').filter({ hasText: "Save" });
            if (await save.isEnabled()) {
                await save.click();
                await page.waitForFunction(() => document.querySelector<HTMLSelectElement>("[data-slot-picker]")?.selectedOptions[0]?.textContent?.includes("empty") === false);
                await page.locator('[data-shortcut="slots"] button').filter({ hasText: "Load" }).click();
            }
        })
        .assertPage("production status and the supported slot path are live", (page) => page.evaluate((): ProductionResult => {
            const save = document.querySelector<HTMLButtonElement>('[data-shortcut="slots"] button:nth-of-type(1)');
            const load = document.querySelector<HTMLButtonElement>('[data-shortcut="slots"] button:nth-of-type(2)');
            const supported = save?.disabled === false;
            return {
                running: document.querySelector('[data-component="status-bar"]')?.getAttribute("data-state") === "running",
                videoStatus: document.querySelector('[data-status-cell="video"]')?.textContent?.includes("×") === true,
                slotRoundTripWhenSupported: !supported || (load?.disabled === false && document.querySelector<HTMLSelectElement>("[data-slot-picker]")?.selectedOptions[0]?.textContent?.includes("empty") === false),
            };
        }), P.equals<ProductionResult>({ running: true, videoStatus: true, slotRoundTripWhenSupported: true }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "React local desktop page",
    skip: CHROMIUM_AVAILABLE ? undefined : "Chromium is unavailable in this environment",
    cases,
};

export default testFile;
