// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P12 native/browser parity

// Dependencies:
import { readFileSync } from "node:fs";                          // Reads the one ignored local parity config/result
import { dirname, resolve } from "node:path";                   // Resolves config-relative private paths
import CTGBrowserTest from "ctg-js-browser-test";               // Browser pipeline over Playwright

// Type dependencies:
import type { TestFile } from "../run.ts";                      // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface ParityFrame {
    machine: string;
    frame: number;
    width: number;
    height: number;
    visibleWidth: number;
    visibleHeight: number;
    refreshMilliHz: number;
    checksum: string;
    nonBlackPixels: number;
}

interface ParityInput {
    found: boolean;
    initiallyReleased: boolean;
    pressed: boolean;
    released: boolean;
}

interface NativeParityResult {
    frame: ParityFrame;
    input: ParityInput;
}

interface PacingSnapshot {
    wallTimeMs?: number;
    callbackCount?: number;
    emulatedTimeUs?: number;
    screenFrameNumber?: number;
    refreshMilliHz?: number;
    speedPermille?: number;
}

interface ParitySummary {
    machineMatches: boolean;
    checkpointMatches: boolean;
    geometryMatches: boolean;
    refreshMatches: boolean;
    frameHashMatches: boolean;
    nonBlackFrame: boolean;
    coreInputMatches: boolean;
    browserInputPressed: boolean;
    browserInputReleased: boolean;
    measuredSeconds?: number;
    emulationRatio?: number;
    screenHz?: number;
    refreshHz?: number;
    reportedSpeedRatio?: number;
}

interface ParityProbeApi {
    inputRightPressed?: boolean;
    pacingSnapshot?: () => PacingSnapshot;
    parityFrame?: ParityFrame;
    parityInput?: ParityInput;
    paritySummary?: ParitySummary;
    running?: boolean;
}

interface ParityProbeConfig {
    browserBaseUrl?: unknown;
    desktopSeconds?: unknown;
    nativeResult?: unknown;
    output?: unknown;
}

interface LoadedParityProbe {
    desktopSeconds: number;
    native: NativeParityResult;
    url: string;
}

/**
 *
 * Constants
 *
 */

const CONFIG_PATH = process.env.MAME_PARITY_PROBE_CONFIG;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> loadedParityProbe
// Loads all private fixture details through one ignored JSON file.
const loadParityProbe = (configArgument: string): LoadedParityProbe => {
    const configPath = resolve(configArgument);
    const configDirectory = dirname(configPath);
    const config = JSON.parse(readFileSync(configPath, "utf8")) as ParityProbeConfig;
    const output = config.output;
    const nativeResult = config.nativeResult ?? "../.cache/mame0161-source/mameparity-native.json";
    const browserBaseUrl = config.browserBaseUrl ?? "http://127.0.0.1:8877/";
    const desktopSeconds = config.desktopSeconds ?? 10;

    if (typeof output !== "string" || !/^[a-z0-9_-]+$/.test(output)) {
        throw new Error("Parity config output must be a safe artifact basename");
    }
    if (typeof nativeResult !== "string") {
        throw new Error("Parity config nativeResult must be a path string");
    }
    if (typeof browserBaseUrl !== "string") {
        throw new Error("Parity config browserBaseUrl must be a URL string");
    }
    if (typeof desktopSeconds !== "number"
        || !Number.isFinite(desktopSeconds)
        || desktopSeconds < 5
        || desktopSeconds > 120) {
        throw new Error("Parity config desktopSeconds must be between 5 and 120");
    }

    const base = browserBaseUrl.endsWith("/") ? browserBaseUrl : `${browserBaseUrl}/`;
    return {
        desktopSeconds,
        native: JSON.parse(
            readFileSync(resolve(configDirectory, nativeResult), "utf8"),
        ) as NativeParityResult,
        url: new URL(`${output}.html`, base).href,
    };
};

const probe = CONFIG_PATH === undefined ? undefined : loadParityProbe(CONFIG_PATH);

const testFile: TestFile = {
    label: "MAME 0.161 native/browser parity probe",
    skip: probe === undefined
        ? "set MAME_PARITY_PROBE_CONFIG to one ignored local JSON config"
        : undefined,
    cases: [
        {
            label: "matches the native checkpoint and sustains desktop speed",
            run: () => CTGBrowserTest.init("native/browser parity")
                .interact("wait for the deterministic browser checkpoint", async ({ page }) => {
                    await page.waitForFunction(() => {
                        const api = (window as typeof window & { JSMESS?: ParityProbeApi }).JSMESS;
                        return api?.running === true
                            && api.parityFrame !== undefined
                            && api.parityInput !== undefined
                            && typeof api.pacingSnapshot === "function";
                    }, undefined, { timeout: 30_000 });
                })
                .interact("compare native and browser core observations", async ({ page }) => {
                    const summary = await page.evaluate((native) => {
                        const api = (window as typeof window & { JSMESS: ParityProbeApi }).JSMESS;
                        const frame = api.parityFrame!;
                        const input = api.parityInput!;
                        return {
                            machineMatches: frame.machine === native.frame.machine,
                            checkpointMatches: frame.frame === native.frame.frame,
                            geometryMatches: frame.width === native.frame.width
                                && frame.height === native.frame.height
                                && frame.visibleWidth === native.frame.visibleWidth
                                && frame.visibleHeight === native.frame.visibleHeight,
                            refreshMatches: frame.refreshMilliHz === native.frame.refreshMilliHz,
                            frameHashMatches: frame.checksum === native.frame.checksum,
                            nonBlackFrame: frame.nonBlackPixels > 0
                                && native.frame.nonBlackPixels > 0,
                            coreInputMatches: input.found
                                && input.initiallyReleased
                                && input.pressed
                                && input.released
                                && input.found === native.input.found
                                && input.initiallyReleased === native.input.initiallyReleased
                                && input.pressed === native.input.pressed
                                && input.released === native.input.released,
                            browserInputPressed: false,
                            browserInputReleased: false,
                        } satisfies ParitySummary;
                    }, probe!.native);
                    await page.evaluate((value) => {
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.paritySummary = value;
                    }, summary);
                })
                .interact("exercise the browser keyboard boundary", async ({ page }) => {
                    await page.keyboard.down("ArrowRight");
                    await page.waitForFunction(() =>
                        (window as typeof window & { JSMESS?: ParityProbeApi })
                            .JSMESS?.inputRightPressed === true);
                    await page.evaluate(() => {
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.paritySummary!.browserInputPressed = true;
                    });
                    await page.keyboard.up("ArrowRight");
                    await page.waitForFunction(() =>
                        (window as typeof window & { JSMESS?: ParityProbeApi })
                            .JSMESS?.inputRightPressed === false);
                    await page.evaluate(() => {
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.paritySummary!.browserInputReleased = true;
                    });
                })
                .interact("measure sustained desktop pacing", async ({ page }) => {
                    const start = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.pacingSnapshot!());
                    await page.waitForTimeout(probe!.desktopSeconds * 1_000);
                    const end = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.pacingSnapshot!());
                    const wallSeconds = (end.wallTimeMs! - start.wallTimeMs!) / 1_000;
                    const emulatedSeconds = (end.emulatedTimeUs! - start.emulatedTimeUs!) / 1_000_000;
                    const summary = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.paritySummary!);
                    summary.measuredSeconds = wallSeconds;
                    summary.emulationRatio = emulatedSeconds / wallSeconds;
                    summary.screenHz = (end.screenFrameNumber! - start.screenFrameNumber!) / wallSeconds;
                    summary.refreshHz = end.refreshMilliHz! / 1_000;
                    summary.reportedSpeedRatio = end.speedPermille! / 1_000;
                    await page.evaluate((value) => {
                        (window as typeof window & { JSMESS: ParityProbeApi })
                            .JSMESS.paritySummary = value;
                    }, summary);
                    console.log(`PARITY_RESULT ${JSON.stringify(summary)}`);
                })
                .assertPage(
                    "machine identity, geometry, refresh and stable frame agree exactly",
                    async (page) => await page.evaluate(() => {
                        const result = (window as typeof window & { JSMESS?: ParityProbeApi })
                            .JSMESS?.paritySummary;
                        return result?.machineMatches === true
                            && result.checkpointMatches
                            && result.geometryMatches
                            && result.refreshMatches
                            && result.frameHashMatches
                            && result.nonBlackFrame;
                    }),
                    true,
                )
                .assertPage(
                    "core injection and browser keyboard input both press and release",
                    async (page) => await page.evaluate(() => {
                        const result = (window as typeof window & { JSMESS?: ParityProbeApi })
                            .JSMESS?.paritySummary;
                        return result?.coreInputMatches === true
                            && result.browserInputPressed
                            && result.browserInputReleased;
                    }),
                    true,
                )
                .assertPage(
                    "the desktop run sustains full emulation and screen speed",
                    async (page) => await page.evaluate((expectedSeconds) => {
                        const result = (window as typeof window & { JSMESS?: ParityProbeApi })
                            .JSMESS?.paritySummary;
                        return (result?.measuredSeconds ?? 0) >= expectedSeconds * 0.95
                            && (result?.emulationRatio ?? 0) >= 0.9
                            && (result?.emulationRatio ?? 0) <= 1.1
                            && Math.abs((result?.screenHz ?? 0) - (result?.refreshHz ?? 0)) <= 2
                            && (result?.reportedSpeedRatio ?? 0) >= 0.9
                            && (result?.reportedSpeedRatio ?? 0) <= 1.1;
                    }, probe!.desktopSeconds),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(probe!.url, { headless: true }),
        },
    ],
};

export default testFile;
