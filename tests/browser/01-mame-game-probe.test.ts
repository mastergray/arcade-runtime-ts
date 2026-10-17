// realizes: docs/mame-game-runtime-spec.md > §13.1 P12 real-game browser startup

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { Page } from "playwright";                          // Browser page used for composited canvas captures
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_GAME_PROBE_URL;

/**
 *
 * Functions
 *
 */

// HELPER :: page -> PROMISE(BOOLEAN)
// Compares the composited canvas with the same canvas forced to black. MAME's
// SDL renderer uses WebGL here, so a 2D getImageData call cannot see its frame.
const canvasHasVisiblePixels = async (page: Page): Promise<boolean> => {
    const canvas = page.locator("#canvas");
    const rendered = await canvas.screenshot();
    const previousFilter = await canvas.evaluate((element) => {
        const canvasElement = element as HTMLCanvasElement;
        const filter = canvasElement.style.filter;
        canvasElement.style.filter = "brightness(0)";
        return filter;
    });

    try {
        const black = await canvas.screenshot();
        return !rendered.equals(black);
    } finally {
        await canvas.evaluate((element, filter) => {
            (element as HTMLCanvasElement).style.filter = filter;
        }, previousFilter);
    }
};

const testFile: TestFile = {
    label: "MAME 0.161 private local-game browser probe",
    skip: PROBE_URL === undefined
        ? "set MAME_GAME_PROBE_URL to the served mamegame-probe.html artifact"
        : undefined,
    cases: [
        {
            label: "boots the local ROM set and renders a non-black frame",
            run: () => CTGBrowserTest.init("local game browser startup")
                .interact("wait for a rendered game frame", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
                        const running = (window as typeof window & { JSMESS?: { running?: boolean } }).JSMESS?.running;
                        return canvas !== null && running === true && canvas.width > 0 && canvas.height > 0;
                    }, undefined, { timeout: 30_000 });

                    const deadline = Date.now() + 30_000;
                    while (Date.now() < deadline) {
                        if (await canvasHasVisiblePixels(page)) {
                            return;
                        }
                        await page.waitForTimeout(250);
                    }
                    throw new Error("MAME entered its main loop but did not render a visible frame");
                })
                .interact("exercise stock SDL digital-input events", async ({ page }) => {
                    await page.keyboard.press("5");
                    await page.keyboard.press("1");
                    await page.keyboard.down("ArrowRight");
                    await page.waitForTimeout(250);
                    await page.keyboard.up("ArrowRight");
                    await page.keyboard.press("Control");
                })
                .assertPage(
                    "emulator entered its browser main loop",
                    async (page) => await page.evaluate(() =>
                        (window as typeof window & { JSMESS?: { running?: boolean } }).JSMESS?.running === true),
                    true,
                )
                .assertPage(
                    "canvas contains a non-black game frame",
                    canvasHasVisiblePixels,
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(PROBE_URL as string, {
                    headless: process.env.MAME_GAME_PROBE_HEADED !== "1",
                }),
        },
    ],
};

export default testFile;
