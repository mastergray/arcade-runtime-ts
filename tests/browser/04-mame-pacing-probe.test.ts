// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P5 frame pacing

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { TestCase, TestFile } from "../run.ts";             // Manifest contracts consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface PacingSnapshot {
    wallTimeMs?: number;
    requestedDisplayHz?: number;
    callbackCount?: number;
    callbackIntervalCount?: number;
    callbackIntervalTotalMs?: number;
    callbackWorkTotalMs?: number;
    callbackWorkMaxMs?: number;
    emulatedTimeUs?: number;
    screenFrameNumber?: number;
    refreshMilliHz?: number;
    speedPermille?: number;
    lastEmulatedAdvanceUs?: number;
}

interface PacingMeasurement {
    requestedDisplayHz: number;
    refreshHz: number;
    wallSeconds: number;
    emulatedSeconds: number;
    screenFrames: number;
    callbacks: number;
    callbackHz: number;
    screenHz: number;
    emulationRatio: number;
    averageCallbackIntervalMs: number;
    averageCallbackWorkMs: number;
    maximumCallbackWorkMs: number;
    reportedSpeedRatio: number;
    lastEmulatedAdvanceUs: number;
}

interface PacingProbeApi {
    pacing?: PacingSnapshot;
    pacingMeasurement?: PacingMeasurement;
    pacingSnapshot?: () => PacingSnapshot;
    running?: boolean;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_PACING_PROBE_URL;
const DISPLAY_CADENCES = [60, 90, 120, 144] as const;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, NUMBER -> STRING
// Selects a controlled browser cadence without exposing the private fixture.
const pacingUrl = (baseUrl: string, displayHz: number): string => {
    const url = new URL(baseUrl);
    url.searchParams.set("mame_probe_hz", String(displayHz));
    return url.href;
};

// HELPER :: NUMBER -> testCase
// Measures an already-warmed fresh module for three wall-clock seconds.
const pacingCase = (displayHz: number): TestCase => ({
    label: `keeps machine time and screen frames paced at ${displayHz} Hz display cadence`,
    run: () => CTGBrowserTest.init(`frame pacing at ${displayHz} Hz`)
        .interact("warm the machine and collect a pacing interval", async ({ page }) => {
            await page.waitForFunction(() => {
                const probe = (window as typeof window & { JSMESS?: PacingProbeApi }).JSMESS;
                const pacing = probe?.pacing;
                return probe?.running === true
                    && typeof probe.pacingSnapshot === "function"
                    && (pacing?.callbackCount ?? 0) >= 30
                    && (pacing?.refreshMilliHz ?? 0) > 0;
            }, undefined, { timeout: 30_000 });
            await page.waitForTimeout(2_000);

            const start = await page.evaluate(() =>
                (window as typeof window & { JSMESS: PacingProbeApi }).JSMESS.pacingSnapshot!());
            await page.waitForTimeout(3_000);
            const end = await page.evaluate(() =>
                (window as typeof window & { JSMESS: PacingProbeApi }).JSMESS.pacingSnapshot!());

            const wallSeconds = (end.wallTimeMs! - start.wallTimeMs!) / 1_000;
            const emulatedSeconds = (end.emulatedTimeUs! - start.emulatedTimeUs!) / 1_000_000;
            const callbacks = end.callbackCount! - start.callbackCount!;
            const intervalCount = end.callbackIntervalCount! - start.callbackIntervalCount!;
            const measurement: PacingMeasurement = {
                requestedDisplayHz: end.requestedDisplayHz!,
                refreshHz: end.refreshMilliHz! / 1_000,
                wallSeconds,
                emulatedSeconds,
                screenFrames: end.screenFrameNumber! - start.screenFrameNumber!,
                callbacks,
                callbackHz: callbacks / wallSeconds,
                screenHz: (end.screenFrameNumber! - start.screenFrameNumber!) / wallSeconds,
                emulationRatio: emulatedSeconds / wallSeconds,
                averageCallbackIntervalMs:
                    (end.callbackIntervalTotalMs! - start.callbackIntervalTotalMs!) / intervalCount,
                averageCallbackWorkMs:
                    (end.callbackWorkTotalMs! - start.callbackWorkTotalMs!) / callbacks,
                maximumCallbackWorkMs: end.callbackWorkMaxMs!,
                reportedSpeedRatio: end.speedPermille! / 1_000,
                lastEmulatedAdvanceUs: end.lastEmulatedAdvanceUs!,
            };

            await page.evaluate((value) => {
                (window as typeof window & { JSMESS: PacingProbeApi }).JSMESS.pacingMeasurement = value;
            }, measurement);
            console.log(`PACING_RESULT ${JSON.stringify(measurement)}`);
        })
        .assertPage(
            "the controlled cadence and native timing telemetry are complete",
            async (page) => await page.evaluate((expectedHz) => {
                const measurement = (window as typeof window & { JSMESS?: PacingProbeApi })
                    .JSMESS?.pacingMeasurement;
                return measurement?.requestedDisplayHz === expectedHz
                    && measurement.refreshHz >= 50
                    && measurement.refreshHz <= 65
                    && measurement.callbacks > 0
                    && measurement.screenFrames > 0
                    && Number.isFinite(measurement.averageCallbackIntervalMs)
                    && Number.isFinite(measurement.averageCallbackWorkMs)
                    && measurement.lastEmulatedAdvanceUs >= 16_000
                    && measurement.lastEmulatedAdvanceUs <= 17_500;
            }, displayHz),
            true,
        )
        .assertPage(
            "emulated time and screen frames remain synchronized with wall time",
            async (page) => await page.evaluate(() => {
                const measurement = (window as typeof window & { JSMESS?: PacingProbeApi })
                    .JSMESS?.pacingMeasurement;
                return measurement !== undefined
                    && Math.abs(measurement.emulationRatio - 1) <= 0.03
                    && Math.abs(measurement.screenHz - measurement.refreshHz) <= 1.5
                    && measurement.reportedSpeedRatio >= 0.9
                    && measurement.reportedSpeedRatio <= 1.1;
            }),
            true,
        )
        .assertPage(
            "stock throttling holds callbacks near 60 Hz instead of the faster display cadence",
            async (page) => await page.evaluate((expectedHz) => {
                const measurement = (window as typeof window & { JSMESS?: PacingProbeApi })
                    .JSMESS?.pacingMeasurement;
                return measurement !== undefined
                    && measurement.callbackHz >= 55
                    && measurement.callbackHz <= 65
                    && (expectedHz === 60 || measurement.callbackHz < expectedHz * 0.8);
            }, displayHz),
            true,
        )
        .assertPage(
            "stock throttling occupies material main-thread callback time",
            async (page) => await page.evaluate(() => {
                const measurement = (window as typeof window & { JSMESS?: PacingProbeApi })
                    .JSMESS?.pacingMeasurement;
                return measurement !== undefined
                    && measurement.averageCallbackWorkMs >= 5
                    && measurement.maximumCallbackWorkMs >= 10;
            }),
            true,
        )
        .assertPage(
            "generated shell reports no exception",
            async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
            false,
        )
        .start(pacingUrl(PROBE_URL as string, displayHz), { headless: true }),
});

const testFile: TestFile = {
    label: "MAME 0.161 stock browser frame-pacing probe",
    skip: PROBE_URL === undefined
        ? "set MAME_PACING_PROBE_URL to a local pacing-instrumented game probe"
        : undefined,
    cases: DISPLAY_CADENCES.map(pacingCase),
};

export default testFile;
