// realizes: docs/mame-game-runtime-spec.md > §13.1 P9 video format and orientation

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

interface VideoProbeFrame {
    byteLength: number;
    checksum: string;
    conversionUs: number;
    height: number;
    nonBlackPixels: number;
    opaqueAlpha: boolean;
    outputFormat: string;
    rasterUs: number;
    rotatedHeight: number;
    rotatedTargetOrientation: number;
    rotatedWidth: number;
    rotationPreservesPixels: boolean;
    sourceFormat: string;
    sourceHeight: number;
    sourceMemoryOrder: string;
    sourceWidth: number;
    systemOrientation: number;
    targetOrientation: number;
    width: number;
}

interface VideoBenchmark {
    conversionP50Us: number;
    conversionP95Us: number;
    pixelCount: number;
    profile: string;
    rasterP50Us: number;
    rasterP95Us: number;
    samples: number;
    totalP50Us: number;
    totalP95Us: number;
}

interface VideoProbeApi {
    machineNotifications?: number[];
    requestHook?: (name: string) => void;
    resetVideoProbe?: () => void;
    running?: boolean;
    videoProbeBenchmark?: VideoBenchmark;
    videoProbeFrameCount?: number;
    videoProbeFrames?: VideoProbeFrame[];
    videoProbeLastFrame?: VideoProbeFrame;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_VIDEO_PROBE_URL;
const FRAME_NOTIFICATION = 0;
const ORIENTATION_SWAP_XY = 0x04;
const MOBILE_CPU_SLOWDOWN = 4;
const WARMUP_SAMPLES = 5;
const MEASURED_SAMPLES = 30;
const FRAME_BUDGET_US = 16_667;

/**
 *
 * Functions
 *
 */

// HELPER :: page -> PROMISE(VOID)
// Waits for stable frame traffic before capturing the hidden native target.
const waitForVideoProbe = async (page: Page): Promise<void> => {
    await page.waitForFunction((frameIndex) => {
        const probe = (window as typeof window & { JSMESS?: VideoProbeApi }).JSMESS;
        return probe?.running === true
            && typeof probe.requestHook === "function"
            && typeof probe.resetVideoProbe === "function"
            && (probe.machineNotifications?.[frameIndex] ?? 0) >= 60;
    }, FRAME_NOTIFICATION, { timeout: 30_000 });
};

// HELPER :: page -> PROMISE(videoProbeFrame)
// Requests one synchronous core raster/conversion observation at a loop boundary.
const captureVideoFrame = async (page: Page): Promise<VideoProbeFrame> => {
    const completed = await page.evaluate(() =>
        (window as typeof window & { JSMESS: VideoProbeApi }).JSMESS.videoProbeFrameCount ?? 0);
    await page.evaluate(() =>
        (window as typeof window & { JSMESS: VideoProbeApi }).JSMESS.requestHook!("captureVideo"));
    await page.waitForFunction((count) => {
        const probe = (window as typeof window & { JSMESS?: VideoProbeApi }).JSMESS;
        return (probe?.videoProbeFrameCount ?? 0) > count
            && probe?.videoProbeLastFrame !== undefined;
    }, completed, { timeout: 10_000 });
    return await page.evaluate(() =>
        (window as typeof window & { JSMESS: VideoProbeApi }).JSMESS.videoProbeLastFrame!);
};

// HELPER :: page -> PROMISE(videoProbeFrame)
// Samples through startup until the native target contains visible pixels.
const captureVisibleVideoFrame = async (page: Page): Promise<VideoProbeFrame> => {
    let frame = await captureVideoFrame(page);
    for (let attempt = 0; attempt < 10 && frame.nonBlackPixels === 0; attempt++) {
        const notifications = await page.evaluate((frameIndex) =>
            (window as typeof window & { JSMESS: VideoProbeApi })
                .JSMESS.machineNotifications?.[frameIndex] ?? 0,
        FRAME_NOTIFICATION);
        await page.waitForFunction(({ frameIndex, minimum }) =>
            ((window as typeof window & { JSMESS?: VideoProbeApi })
                .JSMESS?.machineNotifications?.[frameIndex] ?? 0) >= minimum,
        { frameIndex: FRAME_NOTIFICATION, minimum: notifications + 60 }, { timeout: 10_000 });
        frame = await captureVideoFrame(page);
    }
    return frame;
};

// HELPER :: [NUMBER], NUMBER -> NUMBER
// Returns the nearest-rank percentile for the small deterministic sample set.
const percentile = (values: number[], ratio: number): number => {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)]!;
};

const testFile: TestFile = {
    label: "MAME 0.161 browser video probe",
    skip: PROBE_URL === undefined
        ? "set MAME_VIDEO_PROBE_URL to a local video-instrumented game probe"
        : undefined,
    cases: [
        {
            label: "produces upright RGBA and stays within a throttled mobile frame budget",
            run: () => CTGBrowserTest.init("upright RGBA renderer")
                .interact("wait for stable machine frames", async ({ page }) =>
                    await waitForVideoProbe(page))
                .interact("capture native and forced-rotation geometry", async ({ page }) => {
                    const frame = await captureVisibleVideoFrame(page);
                    console.log(`VIDEO_FRAME ${JSON.stringify(frame)}`);
                })
                .assertPage(
                    "the software renderer exposes an opaque non-empty RGBA frame",
                    async (page) => await page.evaluate(() => {
                        const frame = (window as typeof window & { JSMESS?: VideoProbeApi })
                            .JSMESS?.videoProbeLastFrame;
                        return frame?.sourceFormat === "RGB32"
                            && frame.sourceMemoryOrder === "BGRX"
                            && frame.outputFormat === "RGBA8888"
                            && frame.width > 0
                            && frame.height > 0
                            && frame.byteLength === frame.width * frame.height * 4
                            && frame.nonBlackPixels > 0
                            && frame.opaqueAlpha
                            && /^[0-9a-f]{8}$/.test(frame.checksum);
                    }),
                    true,
                )
                .assertPage(
                    "native and forced-quarter-turn targets have the expected upright geometry",
                    async (page) => await page.evaluate((swapFlag) => {
                        const frame = (window as typeof window & { JSMESS?: VideoProbeApi })
                            .JSMESS?.videoProbeLastFrame;
                        if (frame === undefined) return false;
                        const nativeSwapsAxes = ((frame.systemOrientation ^ frame.targetOrientation)
                            & swapFlag) !== 0;
                        const expectedWidth = nativeSwapsAxes ? frame.sourceHeight : frame.sourceWidth;
                        const expectedHeight = nativeSwapsAxes ? frame.sourceWidth : frame.sourceHeight;
                        return frame.width === expectedWidth
                            && frame.height === expectedHeight
                            && frame.rotatedWidth === frame.height
                            && frame.rotatedHeight === frame.width
                            && ((frame.targetOrientation ^ frame.rotatedTargetOrientation) & swapFlag) !== 0
                            && frame.rotationPreservesPixels;
                    }, ORIENTATION_SWAP_XY),
                    true,
                )
                .interact("measure a four-times CPU-throttled mobile proxy", async ({ page }) => {
                    await page.setViewportSize({ width: 390, height: 844 });
                    const session = await page.context().newCDPSession(page);
                    try {
                        await session.send("Emulation.setCPUThrottlingRate", { rate: MOBILE_CPU_SLOWDOWN });
                        for (let index = 0; index < WARMUP_SAMPLES; index++) {
                            await captureVideoFrame(page);
                        }
                        await page.evaluate(() =>
                            (window as typeof window & { JSMESS: VideoProbeApi }).JSMESS.resetVideoProbe!());
                        for (let index = 0; index < MEASURED_SAMPLES; index++) {
                            await captureVideoFrame(page);
                        }
                    } finally {
                        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
                        await session.detach();
                    }

                    const frames = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: VideoProbeApi }).JSMESS.videoProbeFrames ?? []);
                    const raster = frames.map((frame) => frame.rasterUs);
                    const conversion = frames.map((frame) => frame.conversionUs);
                    const total = frames.map((frame) => frame.rasterUs + frame.conversionUs);
                    const benchmark: VideoBenchmark = {
                        conversionP50Us: percentile(conversion, 0.5),
                        conversionP95Us: percentile(conversion, 0.95),
                        pixelCount: frames[0]!.width * frames[0]!.height,
                        profile: `Chromium ${MOBILE_CPU_SLOWDOWN}x CPU throttle, 390x844 viewport`,
                        rasterP50Us: percentile(raster, 0.5),
                        rasterP95Us: percentile(raster, 0.95),
                        samples: frames.length,
                        totalP50Us: percentile(total, 0.5),
                        totalP95Us: percentile(total, 0.95),
                    };
                    await page.evaluate((value) => {
                        (window as typeof window & { JSMESS: VideoProbeApi })
                            .JSMESS.videoProbeBenchmark = value;
                    }, benchmark);
                    console.log(`VIDEO_RESULT ${JSON.stringify(benchmark)}`);
                })
                .assertPage(
                    "the throttled profile records a complete reusable-buffer sample",
                    async (page) => await page.evaluate((samples) => {
                        const probe = (window as typeof window & { JSMESS?: VideoProbeApi }).JSMESS;
                        const benchmark = probe?.videoProbeBenchmark;
                        return benchmark?.samples === samples
                            && benchmark.pixelCount > 0
                            && benchmark.conversionP50Us > 0
                            && benchmark.rasterP50Us > 0
                            && probe?.videoProbeFrames?.every((frame) =>
                                frame.opaqueAlpha && frame.rotationPreservesPixels) === true;
                    }, MEASURED_SAMPLES),
                    true,
                )
                .assertPage(
                    "rasterization plus RGBA conversion fits one 60 Hz mobile-proxy frame",
                    async (page) => await page.evaluate((budgetUs) => {
                        const benchmark = (window as typeof window & { JSMESS?: VideoProbeApi })
                            .JSMESS?.videoProbeBenchmark;
                        return benchmark !== undefined
                            && benchmark.totalP95Us > 0
                            && benchmark.totalP95Us < budgetUs;
                    }, FRAME_BUDGET_US),
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
