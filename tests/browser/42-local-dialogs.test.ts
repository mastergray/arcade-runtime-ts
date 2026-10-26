// realizes: docs/ui-spec.md > §3.4, §3.5 and §7 local dialog browser acceptance

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

interface DialogResult {
    settingsLive: boolean;
    rebound: boolean;
    analog: boolean;
    testInput: boolean;
    transfer: boolean;
}

interface ProductionResult {
    readonly volume: boolean;
    readonly rebound: boolean;
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
    const state = window.__arcadeDialogTest = { controls: [], axes: [] };
    window.__arcadeLocalAdapter = {
        type: "scripted-dialogs",
        buildUrl: "/mame/synthetic-family/",
        build: {
            formatVersion: 1, buildId: "0".repeat(64), adapter: "mame", engine: "synthetic-family",
            emulatorVersion: "mame0161", emsdkVersion: "1.38.31", machines: ["synthetic_machine"],
            artifacts: ["mamesynthetic-family.js", "mamesynthetic-family.wasm"], romsetsUrl: "romsets/",
            memoryPages: 4096, licenses: [], pthreads: false
        },
        start: async () => {
            const tick = new Set(), frame = new Set(), sound = new Set(), exit = new Set();
            const on = (listeners, listener) => { listeners.add(listener); return () => listeners.delete(listener); };
            return {
                machine: {
                    name: "synthetic_machine", description: "Synthetic game", family: "synthetic-family",
                    width: 320, height: 240, refreshHz: 60, orientation: "horizontal", aspectRatio: 4 / 3,
                    players: 2, buttons: 2,
                    inputs: { analog: [{ player: 1, kind: "paddle" }], dualStick: false, keys: [], volume: false },
                    bios: [], hasNvram: true, supportsSave: true
                },
                sampleRate: 48000,
                setControl: (control, pressed) => state.controls.push({ control, pressed }),
                setAxis: (axis, value) => state.axes.push({ axis, value }),
                pause: () => undefined, resume: () => undefined, reset: () => undefined,
                saveState: async () => undefined, loadState: async () => undefined,
                persist: async () => new Uint8Array([1]), exit: async () => undefined,
                onTick: (listener) => on(tick, listener), onFrame: (listener) => on(frame, listener),
                onSound: (listener) => on(sound, listener), onExit: (listener) => on(exit, listener)
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

// HELPER :: page, STRING, STRING -> PROMISE(VOID)
// Sets a React-controlled range or number input through the prototype setter so React's value tracker sees the change.
const setInputValue = async (page: { evaluate: (fn: (args: { selector: string; value: string }) => void, args: { selector: string; value: string }) => Promise<void> }, selector: string, value: string): Promise<void> => {
    await page.evaluate(({ selector, value }) => {
        const input = document.querySelector<HTMLInputElement>(selector);
        if (input === null) throw new Error(`missing ${selector}`);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, { selector, value });
};

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((closed) => server.close(() => closed()));
};

const withSyntheticPage = async <T>(run: (url: string, archive: Uint8Array) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-local-dialogs-browser-"));
    let server: Server | undefined;
    try {
        const entry = new Uint8Array([2, 7, 1, 8]);
        const archive = zipSync({ [ENTRY]: entry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const buildRoot = join(directory, "builds");
        const familyRoot = join(buildRoot, FAMILY);
        const uiRoot = join(directory, "ui");
        mkdirSync(join(familyRoot, "romsets"), { recursive: true });
        writeFileSync(join(familyRoot, "build.json"), JSON.stringify({
            formatVersion: 1, buildId: "0".repeat(64), adapter: "mame", engine: FAMILY,
            emulatorVersion: "mame0161", emsdkVersion: "1.38.31", machines: [MACHINE],
            artifacts: [`mame${FAMILY}.js`, `mame${FAMILY}.wasm`], romsetsUrl: "romsets/",
            memoryPages: 4096, licenses: [], pthreads: false,
        }));
        const metadata: RomSetMetadata = {
            machine: MACHINE, family: FAMILY, description: "Synthetic game", cloneof: null, romof: null,
            bios: [], sampleof: null, archives: [{ name: ARCHIVE, role: "game" }],
            roms: [{ name: ENTRY, size: entry.length, crc: crc32(entry), sha1: null, archive: ARCHIVE, optional: false }], samples: [],
        };
        writeFileSync(join(familyRoot, "romsets", `${MACHINE}.json`), JSON.stringify(metadata));
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
    const directory = mkdtempSync(join(tmpdir(), "arcade-local-dialogs-production-"));
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
    } finally { rmSync(directory, { recursive: true, force: true }); }
};

const cases: TestCase[] = [{
    label: "synthetic settings and controls apply live, capture input and transfer preferences",
    run: () => withSyntheticPage((url, archive) => CTGBrowserTest.init("local settings and controls dialogs")
        .interact("import and start the synthetic machine", async ({ page }) => {
            await page.goto(url);
            await page.waitForSelector("[data-local-loading]", { state: "detached" });
            await page.addScriptTag({ content: SCRIPTED_ADAPTER });
            await page.evaluate(({ name, bytes }) => {
                const transfer = new DataTransfer();
                transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/zip" }));
                document.body.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
            }, { name: ARCHIVE, bytes: Array.from(archive) });
            await page.locator("[data-store-all-check]").click();
            await page.waitForSelector(`[data-import-play="${FAMILY}/${MACHINE}"]`);
            await page.locator(`[data-import-play="${FAMILY}/${MACHINE}"]`).click();
            await page.waitForFunction(() => document.querySelector('[data-component="status-bar"]')?.getAttribute("data-state") === "running");
        })
        .interact("change volume, crop and filter in Settings", async ({ page }) => {
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="settings"]').click();
            await page.locator('[data-tab="audio"]').click();
            await setInputValue(page, '[data-setting="volume"]', "35");
            await page.locator('[data-tab="video"]').click();
            await setInputValue(page, '[data-setting="crop-left"]', "7");
            await page.locator('[data-setting="filter"]').selectOption("smooth");
            await page.locator('[data-settings-ok]').click();
            await page.evaluate(() => {
                const cabinet = (window as unknown as { __arcadeLocalCabinet: { player: { audio: { volume: number }; display: { crop: { left: number }; imageRendering: string } } } }).__arcadeLocalCabinet;
                (window as unknown as { __arcadeDialogVerdict?: Partial<DialogResult> }).__arcadeDialogVerdict = {
                    settingsLive: cabinet.player.audio.volume === 0.35 && cabinet.player.display.crop.left === 7 && cabinet.player.display.imageRendering === "smooth",
                };
            });
        })
        .interact("capture a replacement key, tune analogue travel and test the held row", async ({ page }) => {
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="controls"]').click();
            await page.locator('[data-binding-change="p1:button:1"]').click();
            await page.keyboard.press("t");
            await page.locator('[data-tab="analogue"]').click();
            await setInputValue(page, 'input[aria-label="P1 Steering / paddle gamepad travel"]', "180");
            await page.locator('[data-controls-ok]').click();
            await page.evaluate(() => {
                const state = (window as unknown as { __arcadeDialogTest: { controls: unknown[] } }).__arcadeDialogTest;
                state.controls.length = 0;
                window.dispatchEvent(new KeyboardEvent("keydown", { code: "ControlLeft", bubbles: true }));
                window.dispatchEvent(new KeyboardEvent("keyup", { code: "ControlLeft", bubbles: true }));
                window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyT", bubbles: true }));
                window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyT", bubbles: true }));
            });
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="controls"]').click();
            await page.locator('[data-tab="test"]').click();
            await page.keyboard.down("t");
            await page.waitForSelector('[data-controls-tab="test"] [data-component="chip"][data-on="true"]');
            const testInput = await page.locator('[data-controls-tab="test"] [data-component="chip"][data-on="true"]').count() > 0;
            await page.keyboard.up("t");
            await page.locator('[data-controls-cancel]').click();
            await page.evaluate((lit) => {
                const state = (window as unknown as { __arcadeDialogTest: { controls: Array<{ control: { kind: string; button?: number }; pressed: boolean }> } }).__arcadeDialogTest;
                const cabinet = (window as unknown as { __arcadeLocalCabinet: { analogSettings: Record<string, { travel?: number }> } }).__arcadeLocalCabinet;
                const verdict = (window as unknown as { __arcadeDialogVerdict: Partial<DialogResult> }).__arcadeDialogVerdict;
                verdict.rebound = state.controls.some((item) => item.control.kind === "button" && item.control.button === 1 && item.pressed)
                    && state.controls.filter((item) => item.control.kind === "button" && item.control.button === 1 && item.pressed).length === 1;
                verdict.analog = cabinet.analogSettings["p1:paddle"]?.travel === 1.8;
                verdict.testInput = lit;
            }, testInput);
        })
        .interact("export a version 2 document and import its changed global key", async ({ page }) => {
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="settings"]').click();
            await page.locator('[data-tab="storage"]').click();
            const downloadPromise = page.waitForEvent("download");
            await page.locator('[data-settings-export]').click();
            const stream = await (await downloadPromise).createReadStream();
            const chunks: Buffer[] = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk));
            const exportedDocument = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { version: number; global: { audio: { volume: number } } };
            exportedDocument.global.audio.volume = 0.6;
            await page.locator('[data-settings-import-picker]').setInputFiles({ name: "settings.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exportedDocument)) });
            await page.waitForSelector('[data-modal="import-settings"]');
            await page.locator('[data-modal="import-settings"] [data-confirm]').click();
            await page.waitForFunction(() => document.querySelector('[data-settings-message]')?.textContent?.includes("Imported") === true);
            await page.locator('[data-settings-cancel]').click();
            await page.evaluate((validVersion) => {
                const cabinet = (window as unknown as { __arcadeLocalCabinet: { player: { audio: { volume: number } } } }).__arcadeLocalCabinet;
                (window as unknown as { __arcadeDialogVerdict: Partial<DialogResult> }).__arcadeDialogVerdict.transfer = validVersion && cabinet.player.audio.volume === 0.6;
            }, exportedDocument.version === 2);
        })
        .assertPage("all dialog boundaries were reached", (page) => page.evaluate(() =>
            (window as unknown as { __arcadeDialogVerdict: DialogResult }).__arcadeDialogVerdict), P.equals<DialogResult>({
                settingsLive: true,
                rebound: true,
                analog: true,
                testInput: true,
                transfer: true,
            }))
        .start(url, { headless: true, timeout: TIMEOUT })),
}];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "production settings volume and a captured keyboard binding reach the running machine",
    run: () => withProductionPage((url) => CTGBrowserTest.init("production local dialogs")
        .interact("start the preload and change volume", async ({ page }) => {
            await page.goto(url);
            await page.waitForFunction(() => document.querySelector('[data-selected="true"] [data-row-action]')?.textContent?.trim() === "Play");
            await page.locator('[data-selected="true"] [data-row-action]').click();
            await page.waitForFunction(() => document.querySelector('[data-component="status-bar"]')?.getAttribute("data-state") === "running", undefined, { timeout: TIMEOUT });
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="settings"]').click();
            await page.locator('[data-tab="audio"]').click();
            await setInputValue(page, '[data-setting="volume"]', "40");
            await page.locator('[data-settings-ok]').click();
        })
        .interact("capture and hold the replacement button binding", async ({ page }) => {
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="controls"]').click();
            await page.locator('[data-binding-change="p1:button:1"]').click();
            await page.keyboard.press("t");
            await page.locator('[data-controls-ok]').click();
            await page.keyboard.down("t");
            await page.waitForFunction(() => {
                const cabinet = (window as unknown as { __arcadeLocalCabinet?: { player: { input: { snapshot: Array<{ kind: string; button?: number }> } } } }).__arcadeLocalCabinet;
                return cabinet?.player.input.snapshot.some((control) => control.kind === "button" && control.button === 1) === true;
            });
            await page.keyboard.up("t");
        })
        .assertPage("the live gain and binding are applied", (page) => page.evaluate((): ProductionResult => {
            const cabinet = (window as unknown as { __arcadeLocalCabinet?: { player: { audio: { volume: number } }; keyboard: { isAttached: boolean } | null } }).__arcadeLocalCabinet;
            return { volume: cabinet?.player.audio.volume === 0.4, rebound: cabinet?.keyboard?.isAttached === true };
        }), P.equals<ProductionResult>({ volume: true, rebound: true }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "local Settings and Controls dialogs",
    skip: CHROMIUM_AVAILABLE ? undefined : "Chromium is unavailable in this environment",
    cases,
};

export default testFile;
