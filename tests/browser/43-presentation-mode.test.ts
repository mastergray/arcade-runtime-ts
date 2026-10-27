// realizes: docs/ui-spec.md > §1.1 and §9 presentation mode browser acceptance

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";
import { chromium, type Page } from "playwright";
import { zipSync } from "fflate";
import { buildUi } from "../../scripts/build-ui.ts";
import { startHarnessServer } from "../../scripts/serve-harness.ts";
import type { ArcadeCabinet, RomSetMetadata } from "../../src/index.ts";
import type { TestCase, TestFile } from "../run.ts";

interface PresentationTestState {
    down: number[];
    padLength: number;
    starts: number;
    paused: boolean;
    pause: number;
    resume: number;
    saves: string[];
    loads: string[];
    controls: Array<{ control: { kind: string; button?: number }; pressed: boolean }>;
    fullscreenRoots: boolean[];
    logText?: string;
    orientationRequests: string[];
    originalCanvas?: HTMLCanvasElement;
    originalCabinet?: ArcadeCabinet;
}
type TestWindow = Window & {
    __arcadePresentationTest: PresentationTestState;
    __arcadeLocalCabinet: ArcadeCabinet;
};

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
    const state = window.__arcadePresentationTest = {
        down: [], padLength: 16, starts: 0, paused: false, pause: 0, resume: 0,
        saves: [], loads: [], controls: [], fullscreenRoots: [], orientationRequests: []
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [{
        id: "Synthetic standard pad", index: 0, connected: true, mapping: "standard", timestamp: performance.now(),
        axes: [0, 0, 0, 0], buttons: Array.from({ length: state.padLength }, (_, index) => ({
            pressed: state.down.includes(index), touched: state.down.includes(index), value: state.down.includes(index) ? 1 : 0
        }))
    }] });
    HTMLElement.prototype.requestFullscreen = function () {
        state.fullscreenRoots.push(this.matches(".local-page"));
        return Promise.reject(new Error("Synthetic fullscreen refusal"));
    };
    Object.defineProperty(screen.orientation, "lock", { configurable: true, value: (orientation) => {
        state.orientationRequests.push(orientation);
        return Promise.reject(new Error("Synthetic orientation refusal"));
    } });
    window.__arcadeLocalAdapter = {
        type: "scripted-presentation",
        buildUrl: "/mame/synthetic-family/",
        build: {
            formatVersion: 1, buildId: "0".repeat(64), adapter: "mame", engine: "synthetic-family",
            emulatorVersion: "mame0161", emsdkVersion: "1.38.31", machines: ["synthetic_machine"],
            artifacts: ["mamesynthetic-family.js", "mamesynthetic-family.wasm"], romsetsUrl: "romsets/",
            memoryPages: 4096, licenses: [], pthreads: false
        },
        start: async () => {
            state.starts++;
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
                setAxis: () => undefined,
                pause: () => { state.paused = true; state.pause++; }, resume: () => { state.paused = false; state.resume++; }, reset: () => undefined,
                saveState: async (slot) => { state.saves.push(slot); }, loadState: async (slot) => { state.loads.push(slot); },
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

// Let all three readers (runtime, gesture detector, focus provider) observe each scripted edge.
const samplePad = async (page: Page, down: number[]): Promise<void> => {
    await page.evaluate(async (buttons) => {
        (window as unknown as TestWindow).__arcadePresentationTest.down = buttons;
        for (let frame = 0; frame < 3; frame++) await new Promise<void>((done) => requestAnimationFrame(() => done()));
    }, down);
};
const pressPad = async (page: Page, down: number[]): Promise<void> => {
    await samplePad(page, []);
    await samplePad(page, down);
    await samplePad(page, []);
};

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((closed) => server.close(() => closed()));
};

const withSyntheticPage = async <T>(run: (url: string, archive: Uint8Array) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-presentation-browser-"));
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
    const directory = mkdtempSync(join(tmpdir(), "arcade-presentation-production-"));
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
    label: "presentation keeps one cabinet, owns paused input, and supports pad gestures, slots and inline Controls",
    run: () => withSyntheticPage((url, archive) => CTGBrowserTest.init("synthetic presentation flow")
        .interact("store the synthetic archive and enter the idle TV menu", async ({ page }) => {
            await page.addInitScript({ content: SCRIPTED_ADAPTER });
            await page.addInitScript("globalThis.__name = (value) => value");   // tsx wraps nested functions in a __name helper the page lacks
            await page.goto(url);
            await page.waitForSelector("[data-local-loading]", { state: "detached" });
            await page.evaluate(({ name, bytes }) => {
                const transfer = new DataTransfer();
                transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/zip" }));
                document.body.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
            }, { name: ARCHIVE, bytes: Array.from(archive) });
            await page.locator("[data-store-all-check]").click();
            await page.waitForSelector(`[data-import-play="${FAMILY}/${MACHINE}"]`);
            await page.locator('[data-modal="import"] [data-modal-close]').click();
            await page.locator('[data-menu-title="view"]').click();
            await page.locator('[data-menu-item="mode-presentation"]').click();
            await page.waitForSelector('[data-presentation-view="games"]');
        })
        .assertPage("the idle page is a TV window and local chrome is absent", (page) => page.evaluate(() => ({
            mode: document.querySelector('.local-page')?.getAttribute('data-mode') ?? '',
            density: document.querySelector('.local-page')?.getAttribute('data-density') ?? '',
            chromeAbsent: document.querySelector('[data-component="menu-bar"], [data-shortcut], [data-region="games"], [data-controller-strip], [data-component="status-bar"]') === null,
            idle: document.querySelector('[data-presentation-window] .title-secondary')?.textContent?.includes('no game') === true,
        })), P.equals({ mode: "presentation", density: "tv", chromeAbsent: true, idle: true }))
        .interact("Play starts the adapter and shows the first-start hint", async ({ page }) => {
            await page.locator(`[data-presentation-play="${FAMILY}/${MACHINE}"]`).click();
            await page.waitForSelector('[data-presentation-window]', { state: 'detached' });
            await page.waitForSelector('[data-presentation-hint]');
            await page.evaluate(() => {
                const browser = window as unknown as TestWindow;
                browser.__arcadePresentationTest.originalCanvas = document.querySelector<HTMLCanvasElement>('[data-play-canvas]')!;
                browser.__arcadePresentationTest.originalCabinet = browser.__arcadeLocalCabinet;
            });
        })
        .assertPage("the stage fills the page at Fit size and names all menu gestures", (page) => page.evaluate(() => {
            const root = document.querySelector('.local-page')!.getBoundingClientRect();
            const stage = document.querySelector('[data-presentation-stage]')!.getBoundingClientRect();
            const hint = document.querySelector('[data-presentation-hint]')!.textContent ?? '';
            const browser = window as unknown as TestWindow;
            const layout = browser.__arcadeLocalCabinet.player.display.layout;
            return {
                fills: Math.abs(root.width - stage.width) < 2 && Math.abs(root.height - stage.height) < 2
                    && Math.abs(layout.height - root.height) < 2,
                hint: hint.includes('L3 + R3') && hint.includes('Esc') && hint.includes('two-finger tap'),
                running: browser.__arcadePresentationTest.starts === 1 && browser.__arcadeLocalCabinet.player.status === 'running',
            };
        }), P.equals({ fills: true, hint: true, running: true }))
        .interact("the hint fades, and Escape pauses and isolates all machine input", async ({ page }) => {
            await page.waitForSelector('[data-presentation-hint]', { state: 'detached', timeout: 6000 });
            await page.keyboard.press('Escape');
            await page.waitForSelector('[data-presentation-frame]');
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePresentationTest.controls.length = 0; });
            await page.keyboard.press('ControlLeft');
        })
        .assertPage("the adapter is paused and no keyboard press reaches it", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            return browser.__arcadePresentationTest.paused && browser.__arcadeLocalCabinet.player.input.suspended
                && !browser.__arcadePresentationTest.controls.some((item) => item.pressed);
        }), P.equals(true))
        .interact("a partial pad gesture does nothing; full rising edges toggle exactly once", async ({ page }) => {
            await samplePad(page, [10]);
            if (await page.locator('[data-presentation-window]').count() !== 1) throw new Error('A partial gesture closed the window');
            await samplePad(page, [10, 11]);
            await page.waitForSelector('[data-presentation-window]', { state: 'detached' });
            await samplePad(page, [10, 11]);
            if (await page.locator('[data-presentation-window]').count() !== 0) throw new Error('A held gesture repeated');
            await samplePad(page, [10]);
            await samplePad(page, [10, 11]);
            await page.waitForSelector('[data-presentation-window]');
            await samplePad(page, []);
        })
        .assertPage("pad toggles release and reacquire pause and input ownership", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            return browser.__arcadePresentationTest.pause === 2 && browser.__arcadePresentationTest.resume === 1
                && browser.__arcadeLocalCabinet.player.input.suspended;
        }), P.equals(true))
        .interact("slot arrows and A save slot 2, then load that same slot", async ({ page }) => {
            await page.locator('[data-presentation-action="save"]').focus();
            await pressPad(page, [15]);
            await pressPad(page, [0]);
            await page.waitForFunction(() => (window as unknown as TestWindow).__arcadePresentationTest.saves.includes('slot2'));
        })
        .interact("the save slot selector shows the new timestamp", async ({ page }) => {
            await page.waitForFunction(() => document.querySelector('#presentation-save-slot small')?.textContent !== 'empty');
            await page.locator('#presentation-load-slot').focus();
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => (window as unknown as TestWindow).__arcadePresentationTest.loads.includes('slot2'));
        })
        .assertPage("both slot operations use slot 2 and retain the paused machine", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            const slots = JSON.parse(localStorage.getItem('arcade-runtime:ui:game:synthetic-family/synthetic_machine') ?? '{}') as { slots?: { slot2?: { savedAt?: string; thumbnail?: string } } };
            return browser.__arcadePresentationTest.saves.join() === 'slot2' && browser.__arcadePresentationTest.loads.join() === 'slot2'
                && typeof slots.slots?.slot2?.savedAt === 'string' && slots.slots.slot2.thumbnail?.startsWith('data:image/png') === true
                && browser.__arcadePresentationTest.paused && browser.__arcadeLocalCabinet.player.input.suspended;
        }), P.equals(true))
        .interact("Games highlights the running row and B returns to the current game", async ({ page }) => {
            await page.locator('[data-presentation-action="games"]').click();
            const row = page.locator('[data-table-row="synthetic-family/synthetic_machine"]');
            if (!(await row.getAttribute('class'))?.includes('hl') || !(await row.textContent())?.includes('playing')) throw new Error('The active row was not marked playing');
            if ((await page.locator('[data-presentation-play]').textContent()) !== 'Resume') throw new Error('The active row did not offer Resume');
            await row.focus();
            await pressPad(page, [1]);
            await page.waitForSelector('[data-presentation-view="game"]');
            await page.locator('[data-presentation-action="controllers"]').click();
            await page.waitForSelector('[data-controls-inline] [data-controls-tab="player1"]');
            await page.locator('[data-tab="player1"]').focus();
            await pressPad(page, [15]);
            await page.waitForSelector('[data-controls-tab="player2"]');
            await pressPad(page, [14]);
            await page.waitForSelector('[data-controls-tab="player1"]');
        })
        .assertPage("Controllers is inline with selector scope and no modal veil", (page) => page.evaluate(() =>
            document.querySelector('[data-controls-inline] [data-apply-scope] [data-component="selector"]') !== null
            && document.querySelector('[data-controls-inline] [data-component="veil"], [data-controls-inline] [data-component="title-bar"]') === null), P.equals(true))
        .interact("capture a key from Change and apply using the pad", async ({ page }) => {
            await page.locator('[data-binding-change="p1:button:1"]').focus();
            await pressPad(page, [0]);
            await page.waitForSelector('[data-capturing="true"]');
            await page.keyboard.press('t');
            await page.waitForSelector('[data-capturing="true"]', { state: 'detached' });
            await page.locator('[data-controls-ok]').focus();
            await pressPad(page, [0]);
            await page.waitForSelector('[data-presentation-view="game"]');
            await page.locator('[data-presentation-action="controllers"]').click();
            await page.locator('[data-binding-change="p1:button:1"]').click();
            await page.keyboard.press('y');
            await page.waitForSelector('[data-capturing="true"]', { state: 'detached' });
            await pressPad(page, [1]);
            await page.waitForSelector('[data-presentation-view="game"]');
            await page.locator('[data-presentation-action="resume"]').click();
            await page.waitForSelector('[data-presentation-window]', { state: 'detached' });
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePresentationTest.controls.length = 0; });
            await page.keyboard.press('ControlLeft');
            await page.keyboard.press('t');
        })
        .assertPage("the replacement key reaches the existing adapter exactly once", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            return browser.__arcadePresentationTest.controls.filter((item) => item.pressed && item.control.kind === 'button' && item.control.button === 1).length === 1
                && browser.__arcadeLocalCabinet === browser.__arcadePresentationTest.originalCabinet
                && document.querySelector('[data-presentation-hint]') === null;
        }), P.equals(true))
        .interact("two-finger touch opens the window and Play mode restores the local skin", async ({ page }) => {
            await page.evaluate(() => {
                const canvas = document.querySelector('[data-play-canvas]')!;
                const touches = [0, 1].map((identifier) => new Touch({ identifier, target: canvas, clientX: 20 + identifier * 20, clientY: 20 }));
                canvas.dispatchEvent(new TouchEvent('touchstart', { touches, bubbles: true, cancelable: true }));
            });
            await page.waitForSelector('[data-presentation-window]');
            await page.locator('[data-presentation-action="play-mode"]').click();
            await page.waitForSelector('.local-page[data-mode="local"][data-density="desktop"]');
        })
        .assertPage("switching back keeps the canvas and cabinet, keeps the pause and frees the input", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            return browser.__arcadeLocalCabinet === browser.__arcadePresentationTest.originalCabinet
                && document.querySelector('[data-play-canvas]') === browser.__arcadePresentationTest.originalCanvas
                && browser.__arcadeLocalCabinet.player.status === 'paused' && !browser.__arcadeLocalCabinet.player.input.suspended
                && browser.__arcadePresentationTest.starts === 1 && document.querySelector('[data-component="menu-bar"]') !== null;
        }), P.equals(true))
        .interact("a user-owned pause survives another presentation round trip and refusals are logged", async ({ page }) => {
            // Play mode left the game paused, so the pause is now the user's own; the window must not claim it.
            await page.locator('[data-menu-title="configure"]').click();
            await page.locator('[data-menu-item="presentation"]').click();
            await page.keyboard.press('Escape');
            await page.waitForSelector('[data-presentation-window]');
            await page.locator('[data-presentation-action="play-mode"]').click();
            await page.waitForSelector('[data-component="status-bar"][data-state="paused"]');
            await page.locator('[data-menu-title="log"]').click();
            await page.locator('[data-menu-item="technical-log"]').click();
            await page.waitForSelector('[data-modal="technical-log"]');
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePresentationTest.logText = document.querySelector('[data-modal="technical-log"]')?.textContent ?? ''; });
            await page.keyboard.press('Escape');   // the log modal is a dialog and suspends input while open
            await page.waitForSelector('[data-modal="technical-log"]', { state: 'detached' });
        })
        .assertPage("fullscreen targets the page root and browser refusals do not break mode changes", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            const state = browser.__arcadePresentationTest;
            const log = state.logText ?? '';
            return state.fullscreenRoots.length >= 3 && state.fullscreenRoots.every(Boolean)
                && state.orientationRequests.every((value) => value === 'landscape') && state.orientationRequests.length >= 3
                && log.includes('Synthetic fullscreen refusal') && log.includes('Synthetic orientation refusal')
                && browser.__arcadeLocalCabinet.player.status === 'paused' && !browser.__arcadeLocalCabinet.player.input.suspended;
        }), P.equals(true))
        .interact("mode persists across reload and the idle window returns", async ({ page }) => {
            await page.locator('[data-menu-title="view"]').click();
            await page.locator('[data-menu-item="menu-hint"]').click();
            await page.locator('[data-menu-title="view"]').click();
            await page.locator('[data-menu-item="mode-presentation"]').click();
            await page.reload();
            await page.waitForSelector('.local-page[data-mode="presentation"][data-density="tv"] [data-presentation-view="games"]');
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePresentationTest.padLength = 4; });
            await page.waitForFunction(() => document.querySelector('[data-presentation-action="controllers"]')?.textContent?.includes('No menu gesture') === true);
            await page.locator('[data-presentation-play]').click();
            await page.waitForSelector('[data-presentation-window]', { state: 'detached' });
        })
        .assertPage("the hint preference survives reload and suppresses the next first start", (page) => page.evaluate(() =>
            document.querySelector('[data-presentation-hint]') === null
            && (window as unknown as TestWindow).__arcadeLocalCabinet.player.status === 'running'), P.equals(true))
        .start(url, { headless: true, timeout: TIMEOUT })),
}];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "the production presentation window pauses the machine and round-trips slot 1 when supported",
    run: () => withProductionPage((url) => CTGBrowserTest.init("production presentation flow")
        .interact("start the selected preload, then enter presentation", async ({ page }) => {
            await page.addInitScript(() => {
                HTMLElement.prototype.requestFullscreen = async () => { throw new Error('Headless fullscreen refusal'); };
                Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async () => { throw new Error('Headless orientation refusal'); } });
            });
            await page.addInitScript("globalThis.__name = (value) => value");   // tsx wraps nested functions in a __name helper the page lacks
            await page.goto(url);
            await page.waitForFunction(() => document.querySelector('[data-selected="true"] [data-row-action]')?.textContent?.trim() === 'Play');
            await page.locator('[data-selected="true"] [data-row-action]').click();
            await page.waitForSelector('[data-component="status-bar"][data-state="running"]', { timeout: TIMEOUT });
            await page.locator('[data-menu-title="view"]').click();
            await page.locator('[data-menu-item="mode-presentation"]').click();
            await page.waitForSelector('.local-page[data-mode="presentation"]');
            await page.keyboard.press('Escape');
            await page.waitForSelector('[data-presentation-window]');
        })
        .assertPage("the real machine is paused and its input suspended", (page) => page.evaluate(() => {
            const cabinet = (window as unknown as { __arcadeLocalCabinet: ArcadeCabinet }).__arcadeLocalCabinet;
            return cabinet.player.status === 'paused' && cabinet.player.input.suspended;
        }), P.equals(true))
        .interact("save and load slot 1 when supported, then Resume", async ({ page }) => {
            const save = page.locator('[data-presentation-action="save"]');
            if (await save.isEnabled()) {
                await save.click();
                await page.waitForFunction(() => document.querySelector('#presentation-save-slot small')?.textContent !== 'empty'
                    && document.querySelector<HTMLButtonElement>('[data-presentation-action="load"]')?.disabled === false);
                await page.locator('[data-presentation-action="load"]').click();
                await page.waitForFunction(() => document.querySelector('.presentation-message')?.textContent?.includes('Loaded slot 1') === true);
            }
            await page.locator('[data-presentation-action="resume"]').click();
            await page.waitForSelector('[data-presentation-window]', { state: 'detached' });
        })
        .assertPage("Resume restores the production machine and input", (page) => page.evaluate(() => {
            const cabinet = (window as unknown as { __arcadeLocalCabinet: ArcadeCabinet }).__arcadeLocalCabinet;
            return cabinet.player.status === 'running' && !cabinet.player.input.suspended;
        }), P.equals(true))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "presentation mode",
    skip: CHROMIUM_AVAILABLE ? undefined : "Chromium is unavailable in this environment",
    cases,
};
export default testFile;
