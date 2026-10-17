// realizes: docs/mame-game-runtime-spec.md > §13.1 P3 family subsets

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_FAMILY_PROBE_URL;
const EXPECTED_MACHINE = process.env.MAME_FAMILY_PROBE_MACHINE;

const testFile: TestFile = {
    label: "MAME 0.161 driver-family WebAssembly probe",
    skip: PROBE_URL === undefined || EXPECTED_MACHINE === undefined
        ? "set MAME_FAMILY_PROBE_URL and MAME_FAMILY_PROBE_MACHINE to a locally built family probe"
        : undefined,
    cases: [
        {
            label: "instantiates and lists the selected private family entry",
            run: () => CTGBrowserTest.init("driver-family browser startup")
                .interact("wait for the family driver list", async ({ page }) => {
                    await page.waitForFunction((machine) => {
                        const output = document.querySelector<HTMLTextAreaElement>("#output");
                        return output?.value.includes(machine) === true;
                    }, EXPECTED_MACHINE as string);
                })
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => await page.textContent("#status"),
                    "",
                )
                .assertPage(
                    "driver list includes the selected local entry",
                    async (page) => (await page.inputValue("#output")).includes(EXPECTED_MACHINE as string),
                    true,
                )
                .start(PROBE_URL as string, {
                    headless: process.env.MAME_FAMILY_PROBE_HEADED !== "1",
                }),
        },
    ],
};

export default testFile;
