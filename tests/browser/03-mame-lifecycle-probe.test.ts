// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P4 module lifecycle

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface LifecycleProbeApi {
    configuredMachine?: string;
    currentMachine?: () => string;
    initialMachine?: string;
    mainLoopTicks?: number;
    probeStartTick?: number;
    running?: boolean;
    scheduleMachine?: (machine: string) => void;
    scheduleResult?: number | null;
    scheduledEventPending?: () => boolean;
    secondMachine?: string;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_LIFECYCLE_PROBE_URL;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Selects the second private compiled entry without placing its name in the URL.
const freshSecondMachineUrl = (baseUrl: string): string => {
    const url = new URL(baseUrl);
    url.searchParams.set("mame_probe_machine", "second");
    return url.href;
};

const testFile: TestFile = {
    label: "MAME 0.161 browser module lifecycle probe",
    skip: PROBE_URL === undefined
        ? "set MAME_LIFECYCLE_PROBE_URL to a local two-machine game probe"
        : undefined,
    cases: [
        {
            label: "leaves the native second-machine request pending in one module",
            run: () => CTGBrowserTest.init("same-module lifecycle request")
                .interact("wait for the initial machine", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        return probe?.currentMachine?.() === probe?.initialMachine
                            && typeof probe?.secondMachine === "string"
                            && probe.secondMachine.length > 0
                            && probe.secondMachine !== probe.initialMachine;
                    }, undefined, { timeout: 30_000 });
                })
                .interact("request the second compiled machine", async ({ page }) => {
                    await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        probe!.probeStartTick = probe!.mainLoopTicks ?? 0;
                        probe!.scheduleMachine!(probe!.secondMachine!);
                    });
                    await page.waitForFunction(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        return probe?.scheduleResult === 0
                            && (probe.mainLoopTicks ?? 0) >= (probe.probeStartTick ?? 0) + 30;
                    }, undefined, { timeout: 10_000 });
                })
                .assertPage(
                    "the lifecycle event remains pending",
                    async (page) => await page.evaluate(() =>
                        (window as typeof window & { JSMESS?: LifecycleProbeApi })
                            .JSMESS?.scheduledEventPending?.()),
                    true,
                )
                .assertPage(
                    "the active machine remains the initial machine",
                    async (page) => await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        return probe?.currentMachine?.() === probe?.initialMachine;
                    }),
                    true,
                )
                .assertPage(
                    "the browser loop continues instead of returning to the machine manager",
                    async (page) => await page.evaluate(() =>
                        (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS?.running),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(PROBE_URL as string, { headless: true }),
        },
        {
            label: "boots the second compiled machine in a fresh module",
            run: () => CTGBrowserTest.init("fresh-module lifecycle control")
                .interact("wait for the fresh machine", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        return probe?.running === true
                            && probe?.currentMachine?.() === probe?.secondMachine;
                    }, undefined, { timeout: 30_000 });
                })
                .assertPage(
                    "the fresh module selected the second entry",
                    async (page) => await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS?: LifecycleProbeApi }).JSMESS;
                        return probe?.configuredMachine === probe?.secondMachine
                            && probe?.secondMachine !== probe?.initialMachine;
                    }),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(freshSecondMachineUrl(PROBE_URL as string), { headless: true }),
        },
    ],
};

export default testFile;
