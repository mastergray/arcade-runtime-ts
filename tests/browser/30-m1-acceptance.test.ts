// realizes: docs/arcade-runtime-spec.md > §12 M1 acceptance (upright native-size frames at correct speed on controlled 60 and 120 Hz display cadences)

// Dependencies:
import { dirname, resolve } from "node:path";                     // Workspace and build-root resolution
import { fileURLToPath } from "node:url";                         // Workspace root
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline and predicates
import { startHarnessServer } from "../../scripts/serve-harness.ts";   // Serves the real family build, the private preload files and the root export

// Type dependencies:
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: one cadence measurement reported from the page
interface CadenceResult {
    readonly cadenceHz: number;                                    // Controlled scheduler cadence
    readonly refreshHz: number;                                    // Machine native refresh from MachineInfo
    readonly ticksPerSecond: number;                               // Emulated frames per wall second over the measured window
    readonly speedRatio: number;                                   // ticksPerSecond / refreshHz
    readonly uprightNativeSize: boolean;                           // Every frame matched MachineInfo width × height and the canvas backing store
    readonly orientation: string;                                  // MachineInfo orientation
}

// INTERFACE :: booleans the pipeline asserts on
interface AcceptanceVerdict {
    readonly speedOk60: boolean;                                   // Within 2 % at the 60 Hz cadence
    readonly speedOk120: boolean;                                  // Within 2 % at the 120 Hz cadence
    readonly uprightNative60: boolean;
    readonly uprightNative120: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;         // Sole route to ignored private inputs
const TIMEOUT = 120_000;                                           // Two cadences, each with warm-up and a measured window
const WARMUP_MS = 1500;                                            // Discarded before measuring
const MEASURE_MS = 6000;                                           // Measured window per cadence
const TOLERANCE = 0.02;                                            // Allowed speed error

/**
 *
 * Functions
 *
 */

// HELPER :: NUMBER -> PROMISE(cadenceResult)
// Runs inside the page: starts the preloaded machine through the real adapter with a scheduler ticking at the
// given cadence and a real clock, attaches ArcadeDisplay, and measures emulated frames per wall second.
const measureCadence = async (cadenceHz: number, warmupMs: number, measureMs: number): Promise<CadenceResult> => {
    const modulePath = "/src/index.js";                            // Served by the harness server; kept dynamic so tsc does not resolve it
    const runtime = await import(modulePath) as typeof import("../../src/index.ts");
    const preload = await (await fetch("/preload.json")).json() as { family: string; machine: string; bios?: string; romUrls: string[] };
    const roms = await Promise.all(preload.romUrls.map(async (url) => ({
        name: url.slice(url.lastIndexOf("/") + 1),
        bytes: new Uint8Array(await (await fetch(url)).arrayBuffer()),
    })));
    const period = 1000 / cadenceHz;
    const scheduler = {
        request: (callback: (time: number) => void): number => window.setTimeout(() => callback(performance.now()), period),
        cancel: (handle: number): void => window.clearTimeout(handle),
    };
    const adapter = await runtime.MameEmulatorAdapter.init({
        buildUrl: `/mame/${preload.family}/`,
        scheduler,
        clock: () => performance.now(),
    });
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    container.style.width = "640px";
    container.style.height = "480px";
    container.appendChild(canvas);
    document.body.appendChild(container);
    const display = runtime.ArcadeDisplay.init({ canvas, container });
    const session = await adapter.start({
        machine: preload.machine,
        machineHints: { players: 2, buttons: 4 },
        roms,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
    });
    const { machine } = session;
    display.attach(session);
    let uprightNativeSize = true;
    let frames = 0;
    session.onFrame((frame) => {
        frames++;
        if (frame.width !== machine.width || frame.height !== machine.height || canvas.width !== machine.width || canvas.height !== machine.height) uprightNativeSize = false;
    });
    await new Promise((done) => setTimeout(done, warmupMs));
    let ticks = 0;
    const stopTicks = session.onTick(() => { ticks++; });
    const startedAt = performance.now();
    await new Promise((done) => setTimeout(done, measureMs));
    const elapsed = performance.now() - startedAt;
    stopTicks();
    await session.exit();
    display.destroy();
    container.remove();
    const ticksPerSecond = ticks / (elapsed / 1000);
    return {
        cadenceHz,
        refreshHz: machine.refreshHz,
        ticksPerSecond,
        speedRatio: ticksPerSecond / machine.refreshHz,
        uprightNativeSize: uprightNativeSize && frames > 0,
        orientation: machine.orientation,
    };
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Serves the real build root and the private preload through the harness server for one case.
const withProductionHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    if (CONFIG_ARGUMENT === undefined) throw new Error("ARCADE_PRELOAD_CONFIG is required");
    const harness = await startHarnessServer({ port: 0, buildRoot: resolve(WORKSPACE, "dist", "mame"), preload: resolve(CONFIG_ARGUMENT) });
    try {
        return await run(harness.url);
    } finally {
        harness.server.closeAllConnections();
        await new Promise<void>((closed) => harness.server.close(() => closed()));
    }
};

const testFile: TestFile = {
    label: "M1 acceptance",
    skip: CONFIG_ARGUMENT === undefined ? "set ARCADE_PRELOAD_CONFIG to an ignored §11.1 preload config naming a built family" : undefined,
    cases: [
        {
            label: "the preloaded machine renders upright at native size and runs at its native refresh on controlled 60 and 120 Hz cadences",
            run: () => withProductionHarness((url) => CTGBrowserTest.init("M1 acceptance")
                .interact("measure both cadences", async ({ page }) => {
                    const results = await page.evaluate(async ({ source, warmupMs, measureMs }) => {
                        // The Node-side transpiler decorates serialized functions with a __name helper; give the page a no-op.
                        (globalThis as unknown as { __name?: unknown }).__name ??= (target: unknown): unknown => target;
                        const measure = new Function("cadenceHz", "warmupMs", "measureMs", `return (${source})(cadenceHz, warmupMs, measureMs);`) as (cadenceHz: number, warmupMs: number, measureMs: number) => Promise<CadenceResult>;
                        const at60 = await measure(60, warmupMs, measureMs);
                        const at120 = await measure(120, warmupMs, measureMs);
                        return { at60, at120 };
                    }, { source: measureCadence.toString(), warmupMs: WARMUP_MS, measureMs: MEASURE_MS });
                    for (const result of [results.at60, results.at120]) {
                        console.log(`M1 cadence ${result.cadenceHz} Hz: ${result.ticksPerSecond.toFixed(2)} emulated frames/s against ${result.refreshHz.toFixed(3)} Hz native (ratio ${result.speedRatio.toFixed(4)}), ${result.orientation}, upright native size ${result.uprightNativeSize}`);
                    }
                    await page.evaluate((verdict) => { (window as unknown as { m1Verdict: AcceptanceVerdict }).m1Verdict = verdict; }, {
                        speedOk60: Math.abs(results.at60.speedRatio - 1) <= TOLERANCE,
                        speedOk120: Math.abs(results.at120.speedRatio - 1) <= TOLERANCE,
                        uprightNative60: results.at60.uprightNativeSize,
                        uprightNative120: results.at120.uprightNativeSize,
                    });
                })
                .assertPage("speed and geometry hold at both cadences", (page) => page.evaluate(() => (window as unknown as { m1Verdict: AcceptanceVerdict }).m1Verdict),
                    P.equals<AcceptanceVerdict>({ speedOk60: true, speedOk120: true, uprightNative60: true, uprightNative120: true }))
                .start(url, { headless: true, timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
