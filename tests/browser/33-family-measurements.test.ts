// realizes: docs/arcade-runtime-spec.md > §13.1 F4, F5 and F6 (per-family startup, pacing and sustained-speed measurements against real builds)

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
    readonly ticksPerSecond: number;                               // Emulated frames per wall second over the measured window
    readonly speedRatio: number;                                   // ticksPerSecond / refreshHz
}

// INTERFACE :: everything the page measures for one family config
interface FamilyMeasurement {
    readonly family: string;                                       // Family id from the preload config
    readonly startMs: number;                                      // F4: adapter.start() call to resolve (module load, MEMFS writes, callMain, first frame)
    readonly refreshHz: number;                                    // MachineInfo.refreshHz
    readonly width: number;                                        // MachineInfo.width
    readonly height: number;                                       // MachineInfo.height
    readonly orientation: string;                                  // MachineInfo.orientation
    readonly frameGeometryOk: boolean;                             // Every frame matched MachineInfo width × height
    readonly cadences: ReadonlyArray<CadenceResult>;               // F5: 60, 90, 120 and 144 Hz
    readonly sustainedRatio: number;                               // F6: 60-second emulated-time ratio at the 60 Hz cadence
}

// INTERFACE :: booleans the pipeline asserts on
interface MeasurementVerdict {
    readonly started: boolean;                                     // F4 produced a first frame
    readonly geometryOk: boolean;                                  // F5 geometry held
    readonly cadencesOk: boolean;                                  // F5 every cadence within 1 %
    readonly sustainedOk: boolean;                                 // F6 within 2 % over 60 s
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root
const CONFIGS = (process.env.ARCADE_FAMILY_CONFIGS ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");   // Private preload configs, one per measurement
const TIMEOUT = 300_000;                                           // Four cadences plus a 60-second sustained run
const CADENCES = [60, 90, 120, 144];                               // F5 display cadences
const CADENCE_WARMUP_MS = 1500;                                    // Discarded before each cadence window
const CADENCE_MEASURE_MS = 3000;                                   // Measured window per cadence
const SUSTAINED_MS = 60_000;                                       // F6 window
const CADENCE_TOLERANCE = 0.01;                                    // F5 allowed speed error
const SUSTAINED_TOLERANCE = 0.02;                                  // F6 allowed speed error

/**
 *
 * Functions
 *
 */

// HELPER :: NUMBER[], NUMBER, NUMBER, NUMBER -> PROMISE(familyMeasurement)
// Runs inside the page: starts the preloaded machine through the real adapter, measures startup time, then runs
// the machine at each controlled cadence against a real clock, then a sustained window at 60 Hz.
const measureFamily = async (cadences: number[], warmupMs: number, measureMs: number, sustainedMs: number): Promise<FamilyMeasurement> => {
    const modulePath = "/src/index.js";
    const runtime = await import(modulePath) as typeof import("../../src/index.ts");
    const preload = await (await fetch("/preload.json")).json() as { family: string; machine: string; bios?: string; romUrls: string[] };
    const roms = await Promise.all(preload.romUrls.map(async (url) => ({
        name: url.slice(url.lastIndexOf("/") + 1),
        bytes: new Uint8Array(await (await fetch(url)).arrayBuffer()),
    })));
    let period = 1000 / 60;
    const scheduler = {
        request: (callback: (time: number) => void): number => window.setTimeout(() => callback(performance.now()), period),
        cancel: (handle: number): void => window.clearTimeout(handle),
    };
    const adapter = await runtime.MameEmulatorAdapter.init({ buildUrl: `/mame/${preload.family}/`, scheduler, clock: () => performance.now() });
    const startedAt = performance.now();
    const session = await adapter.start({
        machine: preload.machine,
        machineHints: { players: 2, buttons: 6 },
        roms,
        ...(preload.bios === undefined ? {} : { bios: preload.bios }),
    });
    const startMs = performance.now() - startedAt;
    const { machine } = session;
    let frameGeometryOk = true;
    session.onFrame((frame) => { if (frame.width !== machine.width || frame.height !== machine.height) frameGeometryOk = false; });
    const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
    const measure = async (ms: number): Promise<number> => {
        let ticks = 0;
        const stop = session.onTick(() => { ticks++; });
        const from = performance.now();
        await wait(ms);
        const elapsed = performance.now() - from;
        stop();
        return ticks / (elapsed / 1000);
    };
    const results: CadenceResult[] = [];
    for (const cadenceHz of cadences) {
        period = 1000 / cadenceHz;
        await wait(warmupMs);
        const ticksPerSecond = await measure(measureMs);
        results.push({ cadenceHz, ticksPerSecond, speedRatio: ticksPerSecond / machine.refreshHz });
    }
    period = 1000 / 60;
    await wait(warmupMs);
    const sustained = await measure(sustainedMs);
    await session.exit();
    return {
        family: preload.family,
        startMs,
        refreshHz: machine.refreshHz,
        width: machine.width,
        height: machine.height,
        orientation: machine.orientation,
        frameGeometryOk,
        cadences: results,
        sustainedRatio: sustained / machine.refreshHz,
    };
};

// HELPER :: STRING, (STRING -> PROMISE(T)) -> PROMISE(T)
// Serves the real build root and one private preload through the harness server for one measurement.
const withFamilyHarness = async <T>(configPath: string, run: (url: string) => Promise<T>): Promise<T> => {
    const harness = await startHarnessServer({ port: 0, buildRoot: resolve(WORKSPACE, "dist", "mame"), preload: resolve(configPath) });
    try {
        return await run(harness.url);
    } finally {
        harness.server.closeAllConnections();
        await new Promise<void>((closed) => harness.server.close(() => closed()));
    }
};

const testFile: TestFile = {
    label: "family measurements (F4–F6)",
    skip: CONFIGS.length === 0 ? "set ARCADE_FAMILY_CONFIGS to a comma-separated list of ignored §11.1 preload configs, one per built family" : undefined,
    cases: CONFIGS.map((configPath, index) => ({
        label: `config ${index + 1}: startup time, pacing at 60/90/120/144 Hz and a 60-second sustained run on desktop`,
        run: () => withFamilyHarness(configPath, (url) => CTGBrowserTest.init(`family measurement ${index + 1}`)
            .interact("measure", async ({ page }) => {
                const result = await page.evaluate(async ({ source, cadences, warmupMs, measureMs, sustainedMs }) => {
                    (globalThis as unknown as { __name?: unknown }).__name ??= (target: unknown): unknown => target;
                    const measure = new Function("cadences", "warmupMs", "measureMs", "sustainedMs", `return (${source})(cadences, warmupMs, measureMs, sustainedMs);`) as (c: number[], w: number, m: number, s: number) => Promise<FamilyMeasurement>;
                    return measure(cadences, warmupMs, measureMs, sustainedMs);
                }, { source: measureFamily.toString(), cadences: CADENCES, warmupMs: CADENCE_WARMUP_MS, measureMs: CADENCE_MEASURE_MS, sustainedMs: SUSTAINED_MS });
                console.log(`FAMILY-MEASURE ${result.family}: F4 start ${result.startMs.toFixed(0)} ms; ${result.width}x${result.height} ${result.orientation} at ${result.refreshHz.toFixed(3)} Hz, geometry ${result.frameGeometryOk ? "ok" : "MISMATCH"}; F5 ${result.cadences.map((c) => `${c.cadenceHz}Hz→${c.ticksPerSecond.toFixed(2)}fps (${((c.speedRatio - 1) * 100).toFixed(2)}%)`).join(", ")}; F6 60s ratio ${result.sustainedRatio.toFixed(4)}`);
                await page.evaluate((verdict) => { (window as unknown as { verdict: MeasurementVerdict }).verdict = verdict; }, {
                    started: result.startMs > 0,
                    geometryOk: result.frameGeometryOk,
                    cadencesOk: result.cadences.every((c) => Math.abs(c.speedRatio - 1) <= CADENCE_TOLERANCE),
                    sustainedOk: Math.abs(result.sustainedRatio - 1) <= SUSTAINED_TOLERANCE,
                });
            })
            .assertPage("desktop gates hold", (page) => page.evaluate(() => (window as unknown as { verdict: MeasurementVerdict }).verdict),
                P.equals<MeasurementVerdict>({ started: true, geometryOk: true, cadencesOk: true, sustainedOk: true }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    })),
};

export default testFile;
