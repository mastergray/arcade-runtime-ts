// realizes: docs/mame-game-runtime-spec.md > §13.1 P2 browser startup

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_TINY_PROBE_URL;

const testFile: TestFile = {
    label: "MAME 0.161 tiny WebAssembly probe",
    skip: PROBE_URL === undefined
        ? "set MAME_TINY_PROBE_URL to the served mametiny-probe.html artifact"
        : undefined,
    cases: [
        {
            label: "instantiates and completes the ROM-free driver-list smoke path",
            run: () => CTGBrowserTest.init("tiny browser startup")
                .interact("wait for MAME output", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const output = document.querySelector<HTMLTextAreaElement>("#output");
                        return output?.value.includes("wrally") === true;
                    });
                })
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => await page.textContent("#status"),
                    "",
                )
                .assertPage(
                    "driver list includes both ends of the tiny subset",
                    async (page) => {
                        const output = await page.inputValue("#output");
                        return output.includes("carpolo") && output.includes("wrally");
                    },
                    true,
                )
                .start(PROBE_URL as string, {
                    headless: process.env.MAME_TINY_PROBE_HEADED !== "1",
                }),
        },
    ],
};

export default testFile;
