// realizes: docs/mame-game-runtime-spec.md > §13.1 P10 mixer format and cadence

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { Page } from "playwright";                          // Page used by shared probe interactions
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface AudioProbeCallback {
    atMs: number;
    bufferPointer: number;
    frames: number;
    sampleRate: number;
    throttled: boolean;
}

interface AudioProbeResult {
    callbackCount: number;
    callbackHz: number;
    channelOrder: string;
    channels: number;
    chunkDurationMs: number;
    chunkMaximumFrames: number;
    chunkMinimumFrames: number;
    chunkP50Frames: number;
    chunkP95Frames: number;
    effectiveFramesPerSecond: number;
    format: string;
    intervalP50Ms: number;
    intervalP95Ms: number;
    layout: string;
    leftMaximum: number;
    leftMinimum: number;
    leftNonZeroSamples: number;
    rightMaximum: number;
    rightMinimum: number;
    rightNonZeroSamples: number;
    sampleRate: number;
    throttledCallbacks: number;
}

interface AudioProbeApi {
    audioCallbackCount?: number;
    audioChannelOrder?: string;
    audioChannels?: number;
    audioFormat?: string;
    audioLayout?: string;
    audioLeftMaximum?: number;
    audioLeftMinimum?: number;
    audioLeftNonZeroSamples?: number;
    audioProbeCallbacks?: AudioProbeCallback[];
    audioProbeResult?: AudioProbeResult;
    audioRightMaximum?: number;
    audioRightMinimum?: number;
    audioRightNonZeroSamples?: number;
    audioSampleRate?: number;
    audioThrottledCallbacks?: number;
    resetAudioProbe?: () => void;
    running?: boolean;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_AUDIO_PROBE_URL;
const WARMUP_CALLBACKS = 25;
const MEASURED_CALLBACKS = 150;
const EXPECTED_SAMPLE_RATE = 48_000;
const EXPECTED_UPDATE_HZ = 50;
const EXPECTED_CHUNK_FRAMES = EXPECTED_SAMPLE_RATE / EXPECTED_UPDATE_HZ;

/**
 *
 * Functions
 *
 */

// HELPER :: [NUMBER], NUMBER -> NUMBER
// Returns the nearest-rank percentile for the deterministic callback sample.
const percentile = (values: number[], ratio: number): number => {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)]!;
};

// HELPER :: page -> PROMISE(VOID)
// Waits through startup audio so reset begins on the steady mixer boundary.
const waitForWarmAudio = async (page: Page): Promise<void> => {
    await page.waitForFunction((minimum) => {
        const probe = (window as typeof window & { JSMESS?: AudioProbeApi }).JSMESS;
        return probe?.running === true
            && typeof probe.resetAudioProbe === "function"
            && (probe.audioCallbackCount ?? 0) >= minimum;
    }, WARMUP_CALLBACKS, { timeout: 30_000 });
};

const testFile: TestFile = {
    label: "MAME 0.161 browser audio probe",
    skip: PROBE_URL === undefined
        ? "set MAME_AUDIO_PROBE_URL to a local audio-instrumented game probe"
        : undefined,
    cases: [
        {
            label: "delivers 48 kHz signed stereo in stable mixer chunks",
            run: () => CTGBrowserTest.init("48 kHz stereo mixer boundary")
                .interact("warm and reset audio observations", async ({ page }) => {
                    await waitForWarmAudio(page);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: AudioProbeApi }).JSMESS.resetAudioProbe!());
                })
                .interact("collect steady callback traffic", async ({ page }) => {
                    await page.waitForFunction((minimum) =>
                        ((window as typeof window & { JSMESS?: AudioProbeApi })
                            .JSMESS?.audioCallbackCount ?? 0) >= minimum,
                    MEASURED_CALLBACKS, { timeout: 30_000 });

                    const observation = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: AudioProbeApi }).JSMESS;
                        return {
                            callbackCount: probe.audioCallbackCount ?? 0,
                            callbacks: probe.audioProbeCallbacks ?? [],
                            channelOrder: probe.audioChannelOrder ?? "",
                            channels: probe.audioChannels ?? 0,
                            format: probe.audioFormat ?? "",
                            layout: probe.audioLayout ?? "",
                            leftMaximum: probe.audioLeftMaximum ?? 0,
                            leftMinimum: probe.audioLeftMinimum ?? 0,
                            leftNonZeroSamples: probe.audioLeftNonZeroSamples ?? 0,
                            rightMaximum: probe.audioRightMaximum ?? 0,
                            rightMinimum: probe.audioRightMinimum ?? 0,
                            rightNonZeroSamples: probe.audioRightNonZeroSamples ?? 0,
                            sampleRate: probe.audioSampleRate ?? 0,
                            throttledCallbacks: probe.audioThrottledCallbacks ?? 0,
                        };
                    });
                    const callbacks = observation.callbacks;
                    const intervals = callbacks.slice(1).map((callback, index) =>
                        callback.atMs - callbacks[index]!.atMs);
                    const elapsedMs = callbacks.at(-1)!.atMs - callbacks[0]!.atMs;
                    const timedFrames = callbacks.slice(1).reduce((total, callback) =>
                        total + callback.frames, 0);
                    const chunks = callbacks.map((callback) => callback.frames);
                    const result: AudioProbeResult = {
                        callbackCount: observation.callbackCount,
                        callbackHz: intervals.length * 1000 / elapsedMs,
                        channelOrder: observation.channelOrder,
                        channels: observation.channels,
                        chunkDurationMs: percentile(chunks, 0.5) * 1000 / observation.sampleRate,
                        chunkMaximumFrames: Math.max(...chunks),
                        chunkMinimumFrames: Math.min(...chunks),
                        chunkP50Frames: percentile(chunks, 0.5),
                        chunkP95Frames: percentile(chunks, 0.95),
                        effectiveFramesPerSecond: timedFrames * 1000 / elapsedMs,
                        format: observation.format,
                        intervalP50Ms: percentile(intervals, 0.5),
                        intervalP95Ms: percentile(intervals, 0.95),
                        layout: observation.layout,
                        leftMaximum: observation.leftMaximum,
                        leftMinimum: observation.leftMinimum,
                        leftNonZeroSamples: observation.leftNonZeroSamples,
                        rightMaximum: observation.rightMaximum,
                        rightMinimum: observation.rightMinimum,
                        rightNonZeroSamples: observation.rightNonZeroSamples,
                        sampleRate: observation.sampleRate,
                        throttledCallbacks: observation.throttledCallbacks,
                    };
                    await page.evaluate((value) => {
                        (window as typeof window & { JSMESS: AudioProbeApi })
                            .JSMESS.audioProbeResult = value;
                    }, result);
                    console.log(`AUDIO_RESULT ${JSON.stringify(result)}`);
                })
                .assertPage(
                    "the native boundary reports signed interleaved left-right stereo",
                    async (page) => await page.evaluate(() => {
                        const result = (window as typeof window & { JSMESS?: AudioProbeApi })
                            .JSMESS?.audioProbeResult;
                        return result?.format === "S16LE"
                            && result.channels === 2
                            && result.layout === "interleaved"
                            && result.channelOrder === "left-right"
                            && result.sampleRate === 48_000;
                    }),
                    true,
                )
                .assertPage(
                    "the 50 Hz mixer update produces exact 20 ms chunks",
                    async (page) => await page.evaluate((expectedFrames) => {
                        const probe = (window as typeof window & { JSMESS?: AudioProbeApi }).JSMESS;
                        const result = probe?.audioProbeResult;
                        return result !== undefined
                            && result.callbackCount >= 150
                            && result.chunkMinimumFrames === expectedFrames
                            && result.chunkMaximumFrames === expectedFrames
                            && result.chunkP50Frames === expectedFrames
                            && result.chunkP95Frames === expectedFrames
                            && result.chunkDurationMs === 20
                            && result.throttledCallbacks === result.callbackCount
                            && probe?.audioProbeCallbacks?.every((callback) =>
                                callback.bufferPointer > 0
                                && callback.bufferPointer % 2 === 0
                                && callback.sampleRate === 48_000) === true;
                    }, EXPECTED_CHUNK_FRAMES),
                    true,
                )
                .assertPage(
                    "browser delivery averages the configured mixer rate",
                    async (page) => await page.evaluate(() => {
                        const result = (window as typeof window & { JSMESS?: AudioProbeApi })
                            .JSMESS?.audioProbeResult;
                        return result !== undefined
                            && result.callbackHz >= 45
                            && result.callbackHz <= 55
                            && result.effectiveFramesPerSecond >= 43_200
                            && result.effectiveFramesPerSecond <= 52_800;
                    }),
                    true,
                )
                .assertPage(
                    "both channel slots contain valid signed 16-bit samples",
                    async (page) => await page.evaluate(() => {
                        const result = (window as typeof window & { JSMESS?: AudioProbeApi })
                            .JSMESS?.audioProbeResult;
                        return result !== undefined
                            && result.leftMinimum >= -32_768
                            && result.leftMaximum <= 32_767
                            && result.leftMinimum <= result.leftMaximum
                            && result.leftNonZeroSamples > 0
                            && result.rightMinimum >= -32_768
                            && result.rightMaximum <= 32_767
                            && result.rightMinimum <= result.rightMaximum
                            && result.rightNonZeroSamples > 0;
                    }),
                    true,
                )
                .assertPage(
                    "generated shell reports no exception",
                    async (page) => (await page.textContent("#status"))?.includes("Exception") ?? false,
                    false,
                )
                .start(PROBE_URL as string, { headless: true }),
        },
    ],
};

export default testFile;
