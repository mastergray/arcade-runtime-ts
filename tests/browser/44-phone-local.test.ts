// realizes: docs/ui-spec.md > §8 and §9.3 phone local page browser acceptance

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";
import { chromium, devices, type Page } from "playwright";
import { zipSync } from "fflate";
import { buildUi } from "../../scripts/build-ui.ts";
import { startHarnessServer } from "../../scripts/serve-harness.ts";
import type { ArcadeAdapter, ArcadeCabinet, ArcadeControl, RomSetMetadata } from "../../src/index.ts";
import type { TestCase, TestFile } from "../run.ts";

interface PhoneTestState {
    connected: boolean;
    allowFullscreen: boolean;
    starts: number;
    paused: boolean;
    saves: string[];
    loads: string[];
    controls: Array<{ control: ArcadeControl; pressed: boolean }>;
    fullscreenRoots: boolean[];
    orientationRequests: string[];
    originalCanvas?: HTMLCanvasElement;
    originalCabinet?: ArcadeCabinet;
    gamesWindow?: Element;
}
interface ProductionState {
    ticks: number;
    frames: number;
    controls: Array<{ control: ArcadeControl; pressed: boolean }>;
    rateRatio?: number;
    measuredFrames?: number;
}
type TestWindow = Window & {
    __arcadePhoneTest: PhoneTestState;
    __arcadePhoneProduction: ProductionState;
    __arcadeLocalCabinet: ArcadeCabinet;
    __arcadeLocalAdapter: ArcadeAdapter;
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
    const state = window.__arcadePhoneTest = {
        down: [], connected: false, allowFullscreen: false, fullscreenRoot: null, padLength: 16, starts: 0, paused: false, pause: 0, resume: 0,
        saves: [], loads: [], controls: [], fullscreenRoots: [], orientationRequests: []
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => state.connected ? [{
        id: "Synthetic standard pad", index: 0, connected: true, mapping: "standard", timestamp: performance.now(),
        axes: [0, 0, 0, 0], buttons: Array.from({ length: state.padLength }, (_, index) => ({
            pressed: state.down.includes(index), touched: state.down.includes(index), value: state.down.includes(index) ? 1 : 0
        }))
    }] : [] });
    HTMLElement.prototype.requestFullscreen = function () {
        state.fullscreenRoots.push(this.matches(".local-page"));
        if (state.allowFullscreen) {
            state.fullscreenRoot = this;
            document.dispatchEvent(new Event("fullscreenchange"));
            return Promise.resolve();
        }
        return Promise.reject(new Error("Synthetic fullscreen refusal"));
    };
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => state.fullscreenRoot });
    document.exitFullscreen = () => {
        state.fullscreenRoot = null;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
    };
    Object.defineProperty(screen.orientation, "lock", { configurable: true, value: (orientation) => {
        state.orientationRequests.push(orientation);
        return Promise.reject(new Error("Synthetic orientation refusal"));
    } });
    window.__arcadeLocalAdapter = {
        type: "scripted-phone",
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
            const timer = setInterval(() => { if (!state.paused) for (const listener of tick) listener(); }, 16);
            return {
                machine: {
                    name: "synthetic_machine", description: "Synthetic game", family: "synthetic-family",
                    width: 320, height: 240, refreshHz: 60, orientation: "horizontal", aspectRatio: 4 / 3,
                    players: 2, buttons: 2,
                    inputs: { analog: [{ player: 1, kind: "paddle" }], dualStick: false, keys: [{ name: "Operator", key: "F2", player: 1 }], volume: true },
                    bios: [], hasNvram: true, supportsSave: true
                },
                sampleRate: 48000,
                setControl: (control, pressed) => state.controls.push({ control, pressed }),
                setAxis: () => undefined,
                pause: () => { state.paused = true; state.pause++; }, resume: () => { state.paused = false; state.resume++; }, reset: () => undefined,
                saveState: async (slot) => { state.saves.push(slot); }, loadState: async (slot) => { state.loads.push(slot); },
                persist: async () => new Uint8Array([1]), exit: async () => { clearInterval(timer); },
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

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((closed) => server.close(() => closed()));
};

const withSyntheticPage = async <T>(run: (url: string, archive: Uint8Array) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-phone-browser-"));
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
    const directory = mkdtempSync(join(tmpdir(), "arcade-phone-production-"));
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

// CTGBrowserTest's launch options expose only viewport. Replace its initial context
// with a Playwright device context, retaining the pipeline's normal cleanup.
const phonePipeline = (label: string, scripted: boolean) => CTGBrowserTest.init(label)
    .stage("emulate a touch phone", async (state) => {
        await state.context!.close();
        state.context = await state.browser!.newContext({ ...devices["Pixel 7"]!, hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });
        await state.context.addInitScript("globalThis.__name = (value) => value");
        if (scripted) await state.context.addInitScript({ content: SCRIPTED_ADAPTER });
        state.page = await state.context.newPage();
        return state.subject;
    });

const point = async (page: Page, selector: string, x = .5, y = .5) => {
    const box = await page.locator(selector).boundingBox();
    if (box === null) throw new Error(`Missing touch surface: ${selector}`);
    return { x: box.x + box.width * x, y: box.y + box.height * y };
};
const tap = async (page: Page, selector: string): Promise<void> => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const p = await point(page, selector);
    await page.touchscreen.tap(p.x, p.y);
};
const heldKeys = (page: Page) => page.evaluate(() => (window as unknown as TestWindow).__arcadeLocalCabinet.player.input.snapshot.map((control) =>
    control.kind === "direction" ? control.direction : control.kind === "button" ? `button-${control.button}` : control.kind).sort());
const expectHeld = async (page: Page, expected: string[]): Promise<void> => {
    const actual = await heldKeys(page);
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error(`Held controls: ${actual.join(", ")}; expected ${expected.join(", ")}`);
};
const menu = async (page: Page, tab = "state"): Promise<void> => {
    await tap(page, '[data-phone-action="menu"]');
    await page.waitForSelector('[data-phone-menu]');
    await tap(page, `[data-phone-menu] [data-tab="${tab}"]`);
};
const closeMenu = (page: Page) => tap(page, '[data-phone-menu] [data-modal-close]');
const twoFingerTap = async (page: Page): Promise<void> => {
    const cdp = await page.context().newCDPSession(page);
    try {
        const a = await point(page, '[data-play-canvas]', .35, .5);
        const b = await point(page, '[data-play-canvas]', .65, .5);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...a, id: 1 }, { ...b, id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally { await cdp.detach(); }
};

const cases: TestCase[] = [{
    label: "phone import, rolling multi-touch, Menu, rotation, pads and presentation keep one cabinet",
    run: () => withSyntheticPage((url, archive) => phonePipeline("synthetic phone flow", true)
        .interact("open Games and replace its contents with Import", async ({ page }) => {
            await page.goto(url);
            await page.waitForSelector('[data-layout="phone-portrait"]');
            await tap(page, '[data-phone-action="games"]');
            await page.waitForSelector('[data-phone-games-state="games"]');
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePhoneTest.gamesWindow = document.querySelector('[data-phone-games] [role="dialog"]')!; });
            await tap(page, '[data-import-open]');
            await page.waitForSelector('[data-phone-games-state="import"]');
            await page.evaluate(({ name, bytes }) => {
                const transfer = new DataTransfer();
                transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/zip" }));
                document.querySelector('[data-import-drop-zone]')!.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
            }, { name: ARCHIVE, bytes: Array.from(archive) });
            await page.waitForFunction(() => document.querySelector('[data-store-all-check]')?.hasAttribute('disabled') === false);
            await tap(page, '[data-store-all-check]');
            await page.waitForSelector('[data-import-status="Stored"]');
            await page.waitForSelector('[data-import-play]');
        })
        .assertPage("Import stays inside the same phone Games window", (page) => page.evaluate(() => ({
            sameWindow: (window as unknown as TestWindow).__arcadePhoneTest.gamesWindow === document.querySelector('[data-phone-games] [role="dialog"]'),
            oneWindow: document.querySelectorAll('[role="dialog"]').length === 1,
            phone: document.querySelector('.local-page')?.getAttribute('data-density') === 'phone' && navigator.maxTouchPoints > 0,
            bar: document.querySelector('[data-phone-bar]') !== null && document.querySelector('[data-component="menu-bar"]') === null,
        })), P.equals({ sameWindow: true, oneWindow: true, phone: true, bar: true }))
        .interact("return to Games and Play through the injected adapter", async ({ page }) => {
            await tap(page, '[data-phone-games-back]');
            await page.waitForFunction(() => document.querySelector('[data-row-action="synthetic-family/synthetic_machine"]')?.textContent?.trim() === 'Play');
            await tap(page, '[data-row-action="synthetic-family/synthetic_machine"]');
            await page.waitForSelector('[data-phone-games]', { state: 'detached' });
            await page.waitForFunction(() => (window as unknown as TestWindow).__arcadeLocalCabinet?.player.status === 'running');
            await page.waitForSelector('[data-switches-row] [data-control="service"]');
            await page.waitForSelector('[data-phone-controller]');
            await page.evaluate(() => {
                const browser = window as unknown as TestWindow;
                browser.__arcadePhoneTest.originalCanvas = document.querySelector<HTMLCanvasElement>('[data-play-canvas]')!;
                browser.__arcadePhoneTest.originalCabinet = browser.__arcadeLocalCabinet;
            });
            await tap(page, '[data-phone-controller] [data-control="coin"]');
            await tap(page, '[data-phone-controller] [data-control="start"]');
            await tap(page, '[data-switches-row] [data-control="key:F2"]');
            await page.waitForFunction(() => ['coin', 'start', 'key'].every((kind) => (window as unknown as TestWindow).__arcadePhoneTest.controls.some((edge) => edge.control.kind === kind && !edge.pressed)));
        })
        .assertPage("COIN, START and the declared operator switch are complete frame-timed taps", (page) => page.evaluate(() => {
            const events = (window as unknown as TestWindow).__arcadePhoneTest.controls;
            return ['coin', 'start', 'key'].every((kind) => events.filter((event) => event.control.kind === kind).map((event) => event.pressed).join() === 'true,false')
                && document.querySelector('[data-status-cell="input"]')?.textContent?.includes('touch') === true
                && document.querySelector('[data-control="button-3"]')?.getAttribute('data-off') === 'true';
        }), P.equals(true))
        .interact("roll one thumb, hold a button with a direction, and hold two buttons", async ({ page }) => {
            const cdp = await page.context().newCDPSession(page);
            const pad = '[data-phone-controller] [data-component="d-pad"]';
            try {
                const up = { ...await point(page, pad, .5, 1 / 6), id: 1 };
                const diagonal = { ...await point(page, pad, 5 / 6, 1 / 6), id: 1 };
                const right = { ...await point(page, pad, 5 / 6, .5), id: 1 };
                const button1 = { ...await point(page, '[data-control="button-1"]'), id: 2 };
                const button2 = { ...await point(page, '[data-control="button-2"]'), id: 3 };
                await page.evaluate(() => { (window as unknown as TestWindow).__arcadePhoneTest.controls = []; });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [up] });
                await expectHeld(page, ['up']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [diagonal] });
                await expectHeld(page, ['up', 'right']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [right] });
                await expectHeld(page, ['right']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right, button1] });
                await expectHeld(page, ['right', 'button-1']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right, button1, button2] });
                await expectHeld(page, ['right', 'button-1', 'button-2']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [button1, button2] });
                await expectHeld(page, ['button-1', 'button-2']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [button2] });
                await expectHeld(page, ['button-2']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
                await expectHeld(page, []);
                // Leaving the captured pad releases directions even before the finger lifts.
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [up] });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...await point(page, pad, 1.1, .5), id: 1 }] });
                await expectHeld(page, []);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach(); }
        })
        .assertPage("every effective held control reached the adapter and was released", (page) => page.evaluate(() => {
            const events = (window as unknown as TestWindow).__arcadePhoneTest.controls;
            return ['up', 'right', 'button-1', 'button-2'].every((key) => {
                const edges = events.filter(({ control }) => (control.kind === 'direction' ? control.direction : control.kind === 'button' ? `button-${control.button}` : '') === key);
                return edges.length >= 2 && edges[0]!.pressed && !edges[edges.length - 1]!.pressed;
            });
        }), P.equals(true))
        .interact("keep fullscreen refusals in the log and preserve phone chrome on successful entry", async ({ page }) => {
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="fullscreen"]');
            await menu(page, 'settings');
            await tap(page, '[data-phone-menu-item="technical-log"]');
            await page.waitForFunction(() => document.querySelector('[data-modal="technical-log"]')?.textContent?.includes('Synthetic fullscreen refusal') === true);
            await page.touchscreen.tap(1, 1);
            await page.waitForSelector('[data-modal="technical-log"]', { state: 'detached' });
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePhoneTest.allowFullscreen = true; });
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="fullscreen"]');
            await page.waitForSelector('[data-fullscreen="true"]');
            if (await page.locator('.local-window > [data-component="title-bar"], .local-window > [data-component="status-bar"]').count() !== 0) throw new Error('Fullscreen retained the title or status line');
            if (await page.locator('[data-phone-bar]').count() !== 1) throw new Error('Fullscreen lost the phone bar');
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="fullscreen"]');
            await page.waitForSelector('[data-fullscreen="false"]');
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePhoneTest.allowFullscreen = false; });
        })
        .interact("save slot 1, open Settings and Controls, then dismiss by tapping outside", async ({ page }) => {
            await menu(page);
            await tap(page, '[data-phone-menu-item="save-slot"]');
            await page.waitForFunction(() => (window as unknown as TestWindow).__arcadePhoneTest.saves.includes('slot1') && JSON.parse(localStorage.getItem('arcade-runtime:ui:game:synthetic-family/synthetic_machine') ?? '{}').slots?.slot1?.savedAt !== undefined);
            await tap(page, '[data-phone-menu] [data-tab="settings"]');
            await tap(page, '[data-phone-menu-item="settings"]');
            await page.waitForSelector('[data-modal="settings"]');
            if (await page.locator('[data-phone-menu]').count() !== 0) throw new Error('Menu remained behind Settings');
            const width = await page.locator('[data-modal="settings"] [role="dialog"]').evaluate((element) => element.getBoundingClientRect().width / innerWidth);
            if (Math.abs(width - .92) > .02) throw new Error('Settings did not use the phone window width');
            await tap(page, '[data-modal="settings"] [data-tab="video"]');
            await page.waitForSelector('[data-settings-tab="video"]');
            await page.touchscreen.tap(1, 1);
            await page.waitForSelector('[data-modal="settings"]', { state: 'detached' });
            await menu(page, 'settings');
            await tap(page, '[data-phone-menu-item="controls"]');
            await page.waitForSelector('[data-controls-tab="player1"]');
            const labels = await page.locator('[data-modal="controls"] [role="tab"]').allTextContents();
            if (labels.join() !== 'P1,P2,Cabinet,Analogue,Test') throw new Error('Controls did not use the phone tab labels');
            if (await page.locator('[data-controls-tab="player1"] th').count() !== 3) throw new Error('Phone bindings did not fit three columns');
            await tap(page, '[data-modal="controls"] [data-tab="analogue"]');
            await page.waitForSelector('.phone-table-boxes fieldset');
            await page.touchscreen.tap(1, 1);
            await page.waitForSelector('[data-modal="controls"]', { state: 'detached' });
            await twoFingerTap(page);
            await page.waitForSelector('[data-phone-menu]');
            await closeMenu(page);
        })
        .interact("connect a standard pad, then explicitly turn the controller back on", async ({ page }) => {
            await page.evaluate(() => { (window as unknown as TestWindow).__arcadePhoneTest.connected = true; window.dispatchEvent(new Event('gamepadconnected')); });
            await page.waitForSelector('[data-phone-controller]', { state: 'detached' });
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="controller"]');
            await page.waitForSelector('[data-phone-controller]');
            await closeMenu(page);
            await page.setViewportSize({ width: 851, height: 393 });
            await page.waitForSelector('[data-layout="phone-landscape"]');
        })
        .assertPage("rotation keeps the canvas and cabinet and puts switches above each primary control", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            const panels = [...document.querySelectorAll('[data-side-panel]')];
            const left = document.querySelector('[data-side-panel="directions"]')!.getBoundingClientRect();
            const right = document.querySelector('[data-side-panel="buttons"]')!.getBoundingClientRect();
            return browser.__arcadePhoneTest.starts === 1 && browser.__arcadePhoneTest.originalCanvas === document.querySelector('[data-play-canvas]')
                && browser.__arcadePhoneTest.originalCabinet === browser.__arcadeLocalCabinet && panels.length === 2 && left.x < right.x
                && panels.every((panel) => panel.firstElementChild?.matches('[data-switches-row]'));
        }), P.equals(true))
        .interact("swap panels and hide the controller, then wake the fading strip", async ({ page }) => {
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="swap-sides"]');
            await page.waitForSelector('[data-swap-sides="true"]');
            const left = await point(page, '[data-side-panel="directions"]');
            const right = await point(page, '[data-side-panel="buttons"]');
            if (left.x <= right.x) throw new Error('Swap sides did not mirror the panels');
            await tap(page, '[data-phone-menu-item="controller"]');
            await closeMenu(page);
            await page.waitForSelector('[data-phone-controller]', { state: 'detached' });
            const widths = await page.evaluate(() => [document.querySelector('[data-play-stage]')!.getBoundingClientRect().width, innerWidth]);
            if (Math.abs(widths[0]! - widths[1]!) > 2) throw new Error('The controller-free stage did not fill the width');
            await page.waitForSelector('[data-bar-visible="false"]', { timeout: 6000 });
            await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-phone-bar]')!).opacity === '0');
            await tap(page, '[data-play-canvas]');
            await page.waitForSelector('[data-bar-visible="true"]');
            await menu(page, 'view');
            await tap(page, '[data-phone-menu-item="presentation"]');
            await page.waitForSelector('[data-mode="presentation"]');
            await twoFingerTap(page);
            await page.waitForSelector('[data-presentation-window]');
        })
        .assertPage("phone presentation reduces the card and attempts fullscreen on the page root", (page) => page.evaluate(() => {
            const state = (window as unknown as TestWindow).__arcadePhoneTest;
            const card = document.querySelector('[data-presentation-game]');
            const frame = document.querySelector('.presentation-frame');
            const metadata = document.querySelector('[data-presentation-metadata]');
            const windowBox = document.querySelector('[data-presentation-window]')!.getBoundingClientRect();
            return document.querySelector('.local-page')?.getAttribute('data-density') === 'phone' && card !== null
                && frame !== null && getComputedStyle(frame).display === 'none' && metadata !== null && getComputedStyle(metadata).display === 'none'
                && windowBox.width <= innerWidth && windowBox.height <= innerHeight
                && state.fullscreenRoots.every(Boolean) && state.orientationRequests.includes('landscape');
        }), P.equals(true))
        .interact("portrait retains the same presentation window and Play mode returns without restarting", async ({ page }) => {
            await page.setViewportSize({ width: 393, height: 851 });
            await page.waitForSelector('[data-layout="phone-portrait"] [data-presentation-window]');
            await tap(page, '[data-presentation-action="play-mode"]');
            await page.waitForSelector('[data-mode="local"] [data-phone-bar]');
            // A landscape tablet takes the desktop shell using that same mounted canvas.
            await page.setViewportSize({ width: 1200, height: 800 });
            await page.waitForSelector('[data-layout="desktop"] [data-component="menu-bar"]');
        })
        .assertPage("all skin transitions kept the original runtime objects and saved preferences", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            const preferences = JSON.parse(localStorage.getItem('arcade-runtime:ui:global') ?? '{}');
            return browser.__arcadePhoneTest.starts === 1 && browser.__arcadePhoneTest.originalCanvas === document.querySelector('[data-play-canvas]')
                && browser.__arcadePhoneTest.originalCabinet === browser.__arcadeLocalCabinet && preferences.swapSides === true && preferences.controllerView === false;
        }), P.equals(true))
        .start(url, { headless: true, timeout: TIMEOUT })),
}];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "the private production machine accepts phone taps and holds and sustains its rate for ten seconds",
    run: () => withProductionPage((url) => phonePipeline("phone production preload", false)
        .interact("observe the real adapter and start from the portrait Games window", async ({ page }) => {
            // Keep Play as the only start gesture even if the ignored preload enables autostart.
            await page.route('**/preload.json', async (route) => {
                const response = await route.fetch();
                await route.fulfill({ response, json: { ...await response.json(), autostart: false } });
            });
            await page.goto(url);
            await page.waitForSelector('[data-layout="phone-portrait"]');
            await page.evaluate(async () => {
                const modulePath = '/src/index.js';
                const runtime = await import(modulePath) as typeof import('../../src/index.ts');
                const preload = await (await fetch('/preload.json')).json() as { family: string };
                const adapter = await runtime.MameEmulatorAdapter.init({ buildUrl: `/mame/${preload.family}/` });
                const browser = window as unknown as TestWindow;
                const observed = browser.__arcadePhoneProduction = { ticks: 0, frames: 0, controls: [] } as ProductionState;
                // The production emulator still runs every operation; only its public edges are observed.
                browser.__arcadeLocalAdapter = new Proxy(adapter, { get(target, key) {
                    if (key === 'start') return async (config: Parameters<ArcadeAdapter['start']>[0]) => {
                        const session = await target.start(config);
                        session.onTick(() => { observed.ticks++; });
                        session.onFrame(() => { observed.frames++; });
                        return new Proxy(session, { get(native, member) {
                            if (member === 'setControl') return (control: ArcadeControl, pressed: boolean) => {
                                observed.controls.push({ control, pressed });
                                native.setControl(control, pressed);
                            };
                            const value: unknown = Reflect.get(native, member, native);
                            return typeof value === 'function' ? value.bind(native) : value;
                        } });
                    };
                    const value: unknown = Reflect.get(target, key, target);
                    return typeof value === 'function' ? value.bind(target) : value;
                } });
            });
            await tap(page, '[data-phone-action="games"]');
            await page.waitForFunction(() => document.querySelector('[data-selected="true"] [data-row-action]')?.textContent?.trim() === 'Play');
            await tap(page, '[data-selected="true"] [data-row-action]');
            await page.waitForFunction(() => (window as unknown as TestWindow).__arcadeLocalCabinet?.player.status === 'running', undefined, { timeout: TIMEOUT });
            await page.waitForSelector('[data-phone-games]', { state: 'detached' });
            await tap(page, '[data-phone-controller] [data-control="coin"]');
            await tap(page, '[data-phone-controller] [data-control="start"]');
            await page.waitForFunction(() => ['coin', 'start'].every((kind) => (window as unknown as TestWindow).__arcadePhoneProduction.controls.some((edge) => edge.control.kind === kind && !edge.pressed)));
            const cdp = await page.context().newCDPSession(page);
            try {
                const up = await point(page, '[data-phone-controller] [data-control="up"]');
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...up, id: 1 }] });
                await expectHeld(page, ['up']);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await expectHeld(page, []);
            } finally { await cdp.detach(); }
            await page.evaluate(async () => {
                const browser = window as unknown as TestWindow;
                await new Promise<void>((done) => setTimeout(done, 2000));
                const observed = browser.__arcadePhoneProduction;
                const ticks = observed.ticks, frames = observed.frames, start = performance.now();
                await new Promise<void>((done) => setTimeout(done, 10_000));
                observed.rateRatio = (observed.ticks - ticks) / ((performance.now() - start) / 1000) / browser.__arcadeLocalCabinet.player.machine.refreshHz;
                observed.measuredFrames = observed.frames - frames;
            });
        })
        .assertPage("native control edges, visible frames and measured speed remain live", (page) => page.evaluate(() => {
            const browser = window as unknown as TestWindow;
            const observed = browser.__arcadePhoneProduction;
            const edges = ['coin', 'start', 'direction'].every((kind) => [true, false].every((pressed) => observed.controls.some((edge) => edge.control.kind === kind && edge.pressed === pressed)));
            return edges && (observed.measuredFrames ?? 0) > 0 && Math.abs((observed.rateRatio ?? 0) - 1) <= .1
                && browser.__arcadeLocalCabinet.player.status === 'running';
        }), P.equals(true))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "React phone local page",
    skip: CHROMIUM_AVAILABLE ? undefined : "Chromium is unavailable in this environment",
    cases,
};
export default testFile;
