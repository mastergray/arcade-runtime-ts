// realizes: docs/ui-design-language.md > §3 Components, §4 Focus and input model, and §6 M24 gallery

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";
import { chromium } from "playwright";
import { buildUi } from "../../scripts/build-ui.ts";
import { startHarnessServer } from "../../scripts/serve-harness.ts";

import type { TestFile } from "../run.ts";

interface GalleryResult {
    readonly allComponentsPresent: boolean;
    readonly densityFontsExact: boolean;
    readonly arrowsMoveFocus: boolean;
    readonly tvFocusInverted: boolean;
    readonly selectorChanges: boolean;
    readonly escapeStepsBack: boolean;
    readonly activeReadsResume: boolean;
    readonly vocabularySafe: boolean;
}

interface GalleryBrowserState {
    allComponentsPresent?: boolean;
    densityFontsExact?: boolean;
    arrowsMoveFocus?: boolean;
    tvFocusInverted?: boolean;
    selectorChanges?: boolean;
    escapeStepsBack?: boolean;
    activeReadsResume?: boolean;
    vocabularySafe?: boolean;
}

const REQUIRED_COMPONENTS = [
    "title-bar", "menu-bar", "pinned-shortcuts", "status-bar", "separator",
    "button", "action-button", "selector", "select", "checkbox-radio", "range", "chip", "bar", "dot", "pill", "red-button", "d-pad", "drop-zone",
    "modal", "tabs", "pane", "fieldset", "key-value", "table", "terminal", "confirmation",
    "games-list", "list-head-foot", "stored-files-list", "menu-list",
    "game-card", "controller-strip", "controls-picture", "canvas-frame", "start-hint",
] as const;
const SAMPLE_VOCABULARY = ["Game name", "Play", "Resume", "ready", "playing"] as const;
const DENYLIST = ["private", "artwork", "placeholder-title"].map((word) => word.toLowerCase());
const CHROMIUM_AVAILABLE = existsSync(chromium.executablePath());
const TIMEOUT = 90_000;

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

const withGallery = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-ui-gallery-browser-"));
    let server: Server | undefined;
    try {
        await buildUi(directory);
        const harness = await startHarnessServer({ port: 0, uiRoot: directory });
        server = harness.server;
        return await run(`${harness.url}ui/gallery`);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

const testFile: TestFile = {
    label: "React UI kit gallery",
    skip: CHROMIUM_AVAILABLE ? undefined : "Chromium is unavailable in this environment",
    cases: [{
        label: "shows every component and drives density, keyboard focus, selectors, back navigation and safe sample rows",
        run: () => withGallery((url) => CTGBrowserTest.init("UI kit gallery")
            .interact("inspect component coverage and all density role sizes", async ({ page }) => {
                await page.waitForSelector('[data-section="game-specific"]');
                const allComponentsPresent = await page.evaluate((components) => components.every((component) => document.querySelector(`[data-component="${component}"]`) !== null), REQUIRED_COMPONENTS);
                const densityFonts: string[] = [];
                for (const density of ["desktop", "phone", "tv"]) {
                    await page.locator("#density").selectOption(density);
                    await page.waitForFunction((expected) => document.documentElement.dataset.density === expected, density);
                    densityFonts.push(await page.locator('[data-role="body"]').evaluate((element) => getComputedStyle(element).fontSize));
                }
                await page.evaluate(({ coverage, fonts }) => {
                    const browser = window as unknown as Window & { __uiGalleryTest?: GalleryBrowserState };
                    browser.__uiGalleryTest = { allComponentsPresent: coverage, densityFontsExact: JSON.stringify(fonts) === JSON.stringify(["14px", "15px", "22px"]) };
                }, { coverage: allComponentsPresent, fonts: densityFonts });
            })
            .interact("move the TV action focus, change its selector and step back with Escape", async ({ page }) => {
                await page.locator("#density").selectOption("tv");
                await page.locator('[data-focus-column] [data-component="button"]').first().focus();
                const before = await page.locator('[data-focus-column] [data-focus="true"]').getAttribute("data-focus");
                await page.keyboard.press("ArrowDown");
                const focused = page.locator('[data-focus-column] [data-focus="true"]');
                const focusedLabel = (await focused.textContent())?.trim() ?? "";
                const colours = await focused.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, colour: getComputedStyle(element).color }));
                await page.locator("#tv-slot").focus();
                const selectorBefore = await page.locator("#tv-slot [data-selector-value]").textContent();
                await page.keyboard.press("ArrowRight");
                const selectorAfter = await page.locator("#tv-slot [data-selector-value]").textContent();
                await page.locator('[data-component="presentation-window"] [data-component="action-button"]').filter({ hasText: "Controllers" }).click();
                await page.waitForFunction(() => document.querySelector('[data-section="game-specific"]')?.getAttribute("data-view") === "controls");
                await page.keyboard.press("Escape");
                await page.evaluate(({ moved, inverted, changed }) => {
                    const state = (window as unknown as Window & { __uiGalleryTest: GalleryBrowserState }).__uiGalleryTest;
                    state.arrowsMoveFocus = moved;
                    state.tvFocusInverted = inverted;
                    state.selectorChanges = changed;
                    state.escapeStepsBack = document.querySelector('[data-section="game-specific"]')?.getAttribute("data-view") === "menu";
                }, {
                    moved: before === "true" && focusedLabel.includes("Save state"),
                    inverted: colours.background === "rgb(10, 42, 140)" && colours.colour === "rgb(255, 255, 255)",
                    changed: selectorBefore !== selectorAfter,
                });
            })
            .interact("verify the active list action and sample-only vocabulary", async ({ page }) => {
                await page.evaluate(({ vocabulary, denylist }) => {
                    const state = (window as unknown as Window & { __uiGalleryTest: GalleryBrowserState }).__uiGalleryTest;
                    const active = document.querySelector('[data-component="games-list-row"][data-active="true"]');
                    state.activeReadsResume = active?.querySelector("button")?.textContent?.trim() === "Resume";
                    const rows = [...document.querySelectorAll('[data-component="games-list-row"] .game-name')];
                    const text = document.body.textContent?.toLowerCase() ?? "";
                    state.vocabularySafe = rows.length > 0
                        && rows.every((row) => row.textContent?.trim() === vocabulary[0])
                        && denylist.every((word) => !text.includes(word));
                }, { vocabulary: SAMPLE_VOCABULARY, denylist: DENYLIST });
            })
            .assertPage("the gallery satisfies the M24 acceptance", (page) => page.evaluate((): GalleryResult => {
                const state = (window as unknown as Window & { __uiGalleryTest: GalleryBrowserState }).__uiGalleryTest;
                return {
                    allComponentsPresent: state.allComponentsPresent === true,
                    densityFontsExact: state.densityFontsExact === true,
                    arrowsMoveFocus: state.arrowsMoveFocus === true,
                    tvFocusInverted: state.tvFocusInverted === true,
                    selectorChanges: state.selectorChanges === true,
                    escapeStepsBack: state.escapeStepsBack === true,
                    activeReadsResume: state.activeReadsResume === true,
                    vocabularySafe: state.vocabularySafe === true,
                };
            }), P.equals<GalleryResult>({
                allComponentsPresent: true,
                densityFontsExact: true,
                arrowsMoveFocus: true,
                tvFocusInverted: true,
                selectorChanges: true,
                escapeStepsBack: true,
                activeReadsResume: true,
                vocabularySafe: true,
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    }],
};

export default testFile;
