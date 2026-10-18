// realizes: docs/mame-game-runtime-spec.md > §13.1 P6 static hosting

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_THREADING_PROBE_URL ?? process.env.MAME_TINY_PROBE_URL;

const testFile: TestFile = {
    label: "MAME 0.161 non-isolated static-hosting probe",
    skip: PROBE_URL === undefined
        ? "set MAME_THREADING_PROBE_URL to a served ROM-free tiny probe"
        : undefined,
    cases: [
        {
            label: "instantiates without shared memory or isolation headers",
            run: () => CTGBrowserTest.init("ordinary static hosting")
                .interact("wait for the ROM-free command to complete", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const output = document.querySelector<HTMLTextAreaElement>("#output");
                        return output !== null && output.value.length > 0;
                    });
                })
                .assertPage(
                    "the document is not cross-origin isolated",
                    async (page) => await page.evaluate(() => globalThis.crossOriginIsolated),
                    false,
                )
                .assertPage(
                    "SharedArrayBuffer is unavailable to the document",
                    async (page) => await page.evaluate(() => typeof globalThis.SharedArrayBuffer),
                    "undefined",
                )
                .assertPage(
                    "the static server sends no opener or embedder isolation policy",
                    async (page) => await page.evaluate(async () => {
                        const response = await fetch(window.location.href, { cache: "no-store" });
                        return response.headers.get("Cross-Origin-Opener-Policy") === null
                            && response.headers.get("Cross-Origin-Embedder-Policy") === null;
                    }),
                    true,
                )
                .assertPage(
                    "the static server supplies the WebAssembly media type",
                    async (page) => await page.evaluate(async () => {
                        const wasmUrl = new URL(window.location.href);
                        wasmUrl.pathname = wasmUrl.pathname.replace(/\.html$/, ".wasm");
                        const response = await fetch(wasmUrl, { cache: "no-store" });
                        return response.ok
                            && response.headers.get("Content-Type") === "application/wasm";
                    }),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => await page.textContent("#status"),
                    "",
                )
                .start(PROBE_URL as string, { headless: true }),
        },
    ],
};

export default testFile;
