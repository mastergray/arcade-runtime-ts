// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P7 bridge hooks

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

interface PacingSnapshot {
    emulatedTimeUs?: number;
}

interface HookProbeObservation {
    pausedEmulatedAdvanceUs?: number;
    pausedTickAdvance?: number;
    exitTickAdvance?: number;
    exitNotificationsBefore?: number;
    stateRoundTrip?: {
        beforeLoadTimeUs: number;
        continuedTimeUs: number;
        loadedTimeUs: number;
        loadSucceeded: boolean;
        savedTimeUs: number;
        saveSucceeded: boolean;
    };
}

interface HookProbeApi {
    audioCallbackCount?: number;
    audioFrameCount?: number;
    exitPending?: boolean;
    hookObservation?: HookProbeObservation;
    hookResult?: number | null;
    inputRightPressed?: boolean;
    lastAudioBufferPointer?: number;
    lastAudioFrames?: number;
    lastStateFileError?: number;
    lastStateOperationError?: number;
    lastStateOperationSucceeded?: boolean;
    machineNotifications?: number[];
    machinePaused?: boolean;
    mainLoopTicks?: number;
    pacing?: PacingSnapshot;
    requestHook?: (name: string) => void;
    running?: boolean;
    stateOperationCount?: number;
    stateOperationPending?: boolean;
}

/**
 *
 * Constants
 *
 */

const PROBE_URL = process.env.MAME_HOOKS_PROBE_URL;
const FRAME_NOTIFICATION = 0;
const RESET_NOTIFICATION = 1;
const PAUSE_NOTIFICATION = 2;
const RESUME_NOTIFICATION = 3;
const EXIT_NOTIFICATION = 4;

/**
 *
 * Functions
 *
 */

// HELPER :: page -> PROMISE(VOID)
// Waits for the machine plus the two periodic bridge boundaries needed by P7.
const waitForBoundaryTraffic = async (page: Page): Promise<void> => {
    await page.waitForFunction((frameIndex) => {
        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
        return probe?.running === true
            && typeof probe.requestHook === "function"
            && (probe.machineNotifications?.[frameIndex] ?? 0) >= 30
            && (probe.audioCallbackCount ?? 0) > 0
            && (probe.audioFrameCount ?? 0) > 0;
    }, FRAME_NOTIFICATION, { timeout: 30_000 });
};

const testFile: TestFile = {
    label: "MAME 0.161 browser bridge-hook probe",
    skip: PROBE_URL === undefined
        ? "set MAME_HOOKS_PROBE_URL to a local hook-instrumented game probe"
        : undefined,
    cases: [
        {
            label: "reaches frame, sound and input hooks",
            run: () => CTGBrowserTest.init("bridge data boundaries")
                .interact("wait for frame and audio boundary traffic", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("observe stock SDL input through MAME's port state", async ({ page }) => {
                    await page.keyboard.down("ArrowRight");
                    await page.waitForFunction(() =>
                        (window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.inputRightPressed === true);
                    await page.keyboard.up("ArrowRight");
                    await page.waitForFunction(() =>
                        (window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.inputRightPressed === false);
                })
                .assertPage(
                    "frame and signed-PCM shim callbacks carry live data",
                    async (page) => await page.evaluate((frameIndex) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return (probe?.machineNotifications?.[frameIndex] ?? 0) > 0
                            && (probe?.audioCallbackCount ?? 0) > 0
                            && (probe?.audioFrameCount ?? 0) > 0
                            && (probe?.lastAudioBufferPointer ?? 0) > 0
                            && (probe?.lastAudioFrames ?? 0) > 0;
                    }, FRAME_NOTIFICATION),
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
            label: "saves, loads and continues through the scheduled state boundary",
            run: () => CTGBrowserTest.init("scheduled state round trip")
                .interact("wait for the running machine", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("save, advance, load and continue", async ({ page }) => {
                    const completed = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi })
                            .JSMESS.stateOperationCount ?? 0);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("save"));
                    await page.waitForFunction((count) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.stateOperationCount ?? 0) > count, completed, { timeout: 10_000 });

                    const saved = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return {
                            succeeded: probe.lastStateFileError === 0
                                && probe.lastStateOperationError === 0
                                && probe.lastStateOperationSucceeded === true,
                            timeUs: probe.pacing?.emulatedTimeUs ?? 0,
                        };
                    });
                    await page.waitForFunction((savedTimeUs) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.pacing?.emulatedTimeUs ?? 0) >= savedTimeUs + 1_000_000,
                    saved.timeUs, { timeout: 10_000 });

                    const beforeLoad = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return {
                            completed: probe.stateOperationCount ?? 0,
                            timeUs: probe.pacing?.emulatedTimeUs ?? 0,
                        };
                    });
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("load"));
                    await page.waitForFunction((count) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.stateOperationCount ?? 0) > count,
                    beforeLoad.completed, { timeout: 10_000 });

                    const loaded = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return {
                            succeeded: probe.lastStateFileError === 0
                                && probe.lastStateOperationError === 0
                                && probe.lastStateOperationSucceeded === true,
                            ticks: probe.mainLoopTicks ?? 0,
                            timeUs: probe.pacing?.emulatedTimeUs ?? 0,
                        };
                    });
                    await page.waitForFunction((ticks) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.mainLoopTicks ?? 0) >= ticks + 30,
                    loaded.ticks, { timeout: 10_000 });
                    await page.evaluate(({ saved, beforeLoad, loaded }) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        probe.hookObservation = {
                            ...probe.hookObservation,
                            stateRoundTrip: {
                                beforeLoadTimeUs: beforeLoad.timeUs,
                                continuedTimeUs: probe.pacing?.emulatedTimeUs ?? 0,
                                loadedTimeUs: loaded.timeUs,
                                loadSucceeded: loaded.succeeded,
                                savedTimeUs: saved.timeUs,
                                saveSucceeded: saved.succeeded,
                            },
                        };
                    }, { saved, beforeLoad, loaded });
                })
                .assertPage(
                    "state load rewinds machine time and the loop continues",
                    async (page) => await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        const roundTrip = probe?.hookObservation?.stateRoundTrip;
                        return roundTrip?.saveSucceeded === true
                            && roundTrip.loadSucceeded === true
                            && roundTrip.loadedTimeUs < roundTrip.beforeLoadTimeUs
                            && roundTrip.loadedTimeUs <= roundTrip.savedTimeUs
                            && roundTrip.continuedTimeUs > roundTrip.loadedTimeUs;
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
        {
            label: "reports a scheduled load failure without an existing state file",
            run: () => CTGBrowserTest.init("scheduled state-load boundary")
                .interact("wait for the running machine", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("schedule a state load and observe its completion", async ({ page }) => {
                    const completed = await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi })
                            .JSMESS.stateOperationCount ?? 0);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("load"));
                    await page.waitForFunction((count) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.stateOperationCount ?? 0) > count, completed, { timeout: 10_000 });
                })
                .assertPage(
                    "the load completion distinguishes a missing file from a state-format error",
                    async (page) => await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && probe.stateOperationPending === false
                            && (probe.lastStateFileError ?? 0) !== 0
                            && probe.lastStateOperationError === -1
                            && probe.lastStateOperationSucceeded === false;
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
        {
            label: "schedules and completes a soft reset",
            run: () => CTGBrowserTest.init("soft-reset hook")
                .interact("wait for the running machine", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("request and observe a reset notification", async ({ page }) => {
                    const notifications = await page.evaluate((resetIndex) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return probe.machineNotifications?.[resetIndex] ?? 0;
                    }, RESET_NOTIFICATION);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("softReset"));
                    await page.waitForFunction(({ resetIndex, notifications }) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && (probe.machineNotifications?.[resetIndex] ?? 0) > notifications;
                    }, { resetIndex: RESET_NOTIFICATION, notifications }, { timeout: 10_000 });
                })
                .assertPage(
                    "the reset notifier ran after initial startup",
                    async (page) => await page.evaluate((resetIndex) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.machineNotifications?.[resetIndex] ?? 0) >= 2, RESET_NOTIFICATION),
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
            label: "exposes the stock pause-loop gap while pause and resume remain reachable",
            run: () => CTGBrowserTest.init("pause and resume hooks")
                .interact("wait for the running machine", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("pause and measure the stock browser loop", async ({ page }) => {
                    const notifications = await page.evaluate((pauseIndex) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return probe.machineNotifications?.[pauseIndex] ?? 0;
                    }, PAUSE_NOTIFICATION);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("pause"));
                    await page.waitForFunction(({ pauseIndex, notifications }) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && probe.machinePaused === true
                            && (probe.machineNotifications?.[pauseIndex] ?? 0) > notifications;
                    }, { pauseIndex: PAUSE_NOTIFICATION, notifications });

                    const pausedStart = await page.evaluate(() => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return {
                            emulatedTimeUs: probe.pacing?.emulatedTimeUs ?? 0,
                            ticks: probe.mainLoopTicks ?? 0,
                        };
                    });
                    await page.waitForFunction((ticks) =>
                        ((window as typeof window & { JSMESS?: HookProbeApi }).JSMESS?.mainLoopTicks ?? 0)
                            >= ticks + 20, pausedStart.ticks);
                    await page.evaluate((start) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        probe.hookObservation = {
                            pausedEmulatedAdvanceUs:
                                (probe.pacing?.emulatedTimeUs ?? 0) - start.emulatedTimeUs,
                            pausedTickAdvance: (probe.mainLoopTicks ?? 0) - start.ticks,
                        };
                    }, pausedStart);
                })
                .interact("resume the running machine", async ({ page }) => {
                    const notifications = await page.evaluate((resumeIndex) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return probe.machineNotifications?.[resumeIndex] ?? 0;
                    }, RESUME_NOTIFICATION);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("resume"));
                    await page.waitForFunction(({ resumeIndex, notifications }) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && probe.machinePaused === false
                            && (probe.machineNotifications?.[resumeIndex] ?? 0) > notifications;
                    }, { resumeIndex: RESUME_NOTIFICATION, notifications }, { timeout: 10_000 });
                })
                .assertPage(
                    "pause sets the flag but the stock loop still advances machine time",
                    async (page) => await page.evaluate(() => {
                        const observation = (window as typeof window & { JSMESS?: HookProbeApi })
                            .JSMESS?.hookObservation;
                        return (observation?.pausedTickAdvance ?? 0) >= 20
                            && (observation?.pausedEmulatedAdvanceUs ?? 0) >= 250_000;
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
        {
            label: "leaves exit pending in the stock browser loop",
            run: () => CTGBrowserTest.init("exit hook")
                .interact("wait for the running machine", async ({ page }) =>
                    await waitForBoundaryTraffic(page))
                .interact("schedule exit and observe the loop remain active", async ({ page }) => {
                    const baseline = await page.evaluate((exitIndex) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        return {
                            notifications: probe.machineNotifications?.[exitIndex] ?? 0,
                            ticks: probe.mainLoopTicks ?? 0,
                        };
                    }, EXIT_NOTIFICATION);
                    await page.evaluate(() =>
                        (window as typeof window & { JSMESS: HookProbeApi }).JSMESS.requestHook!("exit"));
                    await page.waitForFunction((ticks) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.hookResult === 0
                            && probe.exitPending === true
                            && (probe.mainLoopTicks ?? 0) >= ticks + 20;
                    }, baseline.ticks);
                    await page.evaluate(({ exitIndex, notifications, ticks }) => {
                        const probe = (window as typeof window & { JSMESS: HookProbeApi }).JSMESS;
                        probe.hookObservation = {
                            exitNotificationsBefore: notifications,
                            exitTickAdvance: (probe.mainLoopTicks ?? 0) - ticks,
                        };
                        if ((probe.machineNotifications?.[exitIndex] ?? 0) !== notifications) {
                            throw new Error("Exit cleanup unexpectedly ran inside the stock browser loop");
                        }
                    }, {
                        exitIndex: EXIT_NOTIFICATION,
                        notifications: baseline.notifications,
                        ticks: baseline.ticks,
                    });
                })
                .assertPage(
                    "exit stays pending without cleanup while the stock loop continues",
                    async (page) => await page.evaluate((exitIndex) => {
                        const probe = (window as typeof window & { JSMESS?: HookProbeApi }).JSMESS;
                        return probe?.exitPending === true
                            && (probe.hookObservation?.exitTickAdvance ?? 0) >= 20
                            && (probe.machineNotifications?.[exitIndex] ?? 0)
                                === probe.hookObservation?.exitNotificationsBefore;
                    }, EXIT_NOTIFICATION),
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
