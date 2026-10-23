// realizes: docs/arcade-runtime-spec.md > §12 M3, M4 and M5 acceptance rows against real family builds (gated on private preload configs)

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

// INTERFACE :: what the page measured for one config
interface AcceptanceResult {
    readonly family: string;                                       // Family id from the preload config
    readonly buttons: number;                                      // MachineInfo.buttons
    readonly audioUnlocked: boolean;                               // M3: context running after one synthetic gesture
    readonly audioQueuedMaxMs: number;                             // M3: highest queuedMs sampled over the window
    readonly audioQueuedSamples: number;                           // M3: samples taken
    readonly audioHadSound: boolean;                               // M3: queuedMs exceeded zero at least once
    readonly keyboardChangedPicture: boolean;                      // M4: coin and start from real key events changed the frame
    readonly keyboardLeftRight: boolean;                           // M4: a held arrow reached the input snapshot and released on key up
    readonly gamepadPlayers: ReadonlyArray<number>;                // M5: slots assigned to two scripted standard pads
    readonly gamepadChangedPicture: boolean;                       // M5: pad-1 coin and start changed the frame
    readonly gamepadReleasedOnUnplug: boolean;                     // M5: a held direction cleared when pad 1 disappeared
}

// INTERFACE :: booleans the pipeline asserts on
interface AcceptanceVerdict {
    readonly m3: boolean;
    readonly m4: boolean;
    readonly m5: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root
const CONFIGS = (process.env.ARCADE_FAMILY_CONFIGS ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");   // Private preload configs
const TIMEOUT = 240_000;                                           // One 60-second audio window plus input flows
const AUDIO_WINDOW_MS = 60_000;                                    // M3 window
const AUDIO_SAMPLE_MS = 500;                                       // queuedMs sampling interval
const AUDIO_CAP_MS = 120;                                          // ArcadeAudio.MAX_QUEUE_MS

/**
 *
 * Functions
 *
 */

// HELPER :: NUMBER, NUMBER, NUMBER -> PROMISE(acceptanceResult)
// Runs inside the page after a real pointer gesture: starts the preloaded machine through ArcadePlayer with a real
// AudioContext, samples the audio queue for the window, drives coin/start/left through KeyboardSource from real
// key events, then drives two scripted standard gamepads through GamepadSource and unplugs one.
const acceptance = async (audioWindowMs: number, audioSampleMs: number, audioCapMs: number): Promise<AcceptanceResult> => {
    const modulePath = "/src/index.js";
    const runtime = await import(modulePath) as typeof import("../../src/index.ts");
    const preload = await (await fetch("/preload.json")).json() as { family: string; machine: string; bios?: string; romUrls: string[] };
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    container.style.width = "640px";
    container.style.height = "480px";
    container.appendChild(canvas);
    document.body.appendChild(container);
    const player = await runtime.ArcadePlayer.init({
        canvas,
        container,
        game: { machine: preload.machine, machineHints: { players: 2, buttons: 6 }, roms: preload.romUrls, ...(preload.bios === undefined ? {} : { bios: preload.bios }) },
        adapterConfig: { buildUrl: `/mame/${preload.family}/` },
    });
    await player.start();
    const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
    const snapshot = (): Uint8ClampedArray => {
        const context = canvas.getContext("2d")!;
        return context.getImageData(0, 0, canvas.width, canvas.height).data.slice();
    };
    const differs = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.length !== b.length || a.some((value, index) => value !== b[index]);

    // M3: audio after the gesture the pipeline already delivered (armGestureUnlock listened to it), sampled for the window.
    player.audio.armGestureUnlock();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await wait(500);
    let audioQueuedMaxMs = 0;
    let audioQueuedSamples = 0;
    let audioHadSound = false;
    const audioEnd = performance.now() + audioWindowMs;
    while (performance.now() < audioEnd) {
        const queued = player.audio.queuedMs;
        audioQueuedSamples++;
        if (queued > 0) audioHadSound = true;
        if (queued > audioQueuedMaxMs) audioQueuedMaxMs = queued;
        await wait(audioSampleMs);
    }
    const audioUnlocked = player.audio.isUnlocked;

    // M4: keyboard through KeyboardSource with the default map, from real key events on window.
    const keyboard = runtime.KeyboardSource.init({ input: player.input, map: runtime.DEFAULT_KEYBOARD_MAP });
    keyboard.attach();
    const beforeKeys = snapshot();
    const key = (code: string, down: boolean): void => { window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true })); };
    for (let coin = 0; coin < 2; coin++) { key("Digit5", true); await wait(250); key("Digit5", false); await wait(400); }   // two coins: some boards default to two coins per play
    key("Digit1", true); await wait(120); key("Digit1", false); await wait(1500);
    const afterKeys = snapshot();
    key("ArrowLeft", true); await wait(100);
    const heldLeft = player.input.snapshot.some((control) => control.kind === "direction" && control.direction === "left");
    key("ArrowLeft", false); await wait(100);
    const releasedLeft = !player.input.snapshot.some((control) => control.kind === "direction");
    keyboard.destroy();

    // M5: two scripted standard pads through GamepadSource.
    const pad = (index: number, buttons: number[], axes: number[] = [0, 0]) => ({
        id: `scripted-pad-${index}`, index, connected: true, mapping: "standard" as const,
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })),
        axes,
    });
    let pads: Array<ReturnType<typeof pad> | null> = [pad(0, []), pad(1, [])];
    const gamepads = runtime.GamepadSource.init({ input: player.input, provider: { getGamepads: () => pads } });
    gamepads.attach();
    await wait(200);
    const gamepadPlayers = gamepads.players.map((entry) => entry.player);
    const beforePad = snapshot();
    for (let coin = 0; coin < 2; coin++) {                      // Select/Back → coin, twice for two-coin boards
        pads = [pad(0, [8]), pad(1, [])]; await wait(250);
        pads = [pad(0, []), pad(1, [])]; await wait(400);
    }
    pads = [pad(0, [9]), pad(1, [])]; await wait(200);          // Start
    pads = [pad(0, []), pad(1, [])]; await wait(1500);
    const afterPad = snapshot();
    pads = [pad(0, [15]), pad(1, [])]; await wait(200);         // D-pad right held on pad 1
    const heldRight = player.input.snapshot.some((control) => control.kind === "direction" && control.direction === "right" && control.player === 1);
    pads = [null, pad(1, [])]; await wait(200);                  // Unplug pad 1
    const releasedRight = !player.input.snapshot.some((control) => control.kind === "direction");
    gamepads.destroy();
    const { buttons } = player.machine;
    await player.destroy();
    return {
        family: preload.family,
        buttons,
        audioUnlocked,
        audioQueuedMaxMs,
        audioQueuedSamples,
        audioHadSound,
        keyboardChangedPicture: differs(beforeKeys, afterKeys),
        keyboardLeftRight: heldLeft && releasedLeft,
        gamepadPlayers,
        gamepadChangedPicture: differs(beforePad, afterPad),
        gamepadReleasedOnUnplug: heldRight && releasedRight,
    };
};

// HELPER :: STRING, (STRING -> PROMISE(T)) -> PROMISE(T)
// Serves the real build root and one private preload through the harness server for one case.
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
    label: "M3, M4 and M5 acceptance",
    skip: CONFIGS.length === 0 ? "set ARCADE_FAMILY_CONFIGS to a comma-separated list of ignored §11.1 preload configs naming built families" : undefined,
    cases: CONFIGS.map((configPath, index) => ({
        label: `config ${index + 1}: audio under the cap for 60 s after one gesture, keyboard coin/start/play, two gamepads with unplug release`,
        run: () => withFamilyHarness(configPath, (url) => CTGBrowserTest.init(`M3–M5 acceptance ${index + 1}`)
            .interact("gesture, start and measure", async ({ page }) => {
                await page.mouse.click(10, 10);
                const result = await page.evaluate(async ({ source, audioWindowMs, audioSampleMs, audioCapMs }) => {
                    (globalThis as unknown as { __name?: unknown }).__name ??= (target: unknown): unknown => target;
                    const run = new Function("audioWindowMs", "audioSampleMs", "audioCapMs", `return (${source})(audioWindowMs, audioSampleMs, audioCapMs);`) as (a: number, b: number, c: number) => Promise<AcceptanceResult>;
                    return run(audioWindowMs, audioSampleMs, audioCapMs);
                }, { source: acceptance.toString(), audioWindowMs: AUDIO_WINDOW_MS, audioSampleMs: AUDIO_SAMPLE_MS, audioCapMs: AUDIO_CAP_MS });
                console.log(`ACCEPTANCE ${result.family} (${result.buttons} buttons): M3 unlocked ${result.audioUnlocked}, sound ${result.audioHadSound}, queued max ${result.audioQueuedMaxMs.toFixed(1)} ms over ${result.audioQueuedSamples} samples; M4 picture changed ${result.keyboardChangedPicture}, left held/released ${result.keyboardLeftRight}; M5 players ${JSON.stringify(result.gamepadPlayers)}, picture changed ${result.gamepadChangedPicture}, unplug released ${result.gamepadReleasedOnUnplug}`);
                await page.evaluate((verdict) => { (window as unknown as { verdict: AcceptanceVerdict }).verdict = verdict; }, {
                    m3: result.audioUnlocked && result.audioHadSound && result.audioQueuedMaxMs <= AUDIO_CAP_MS + 1,
                    m4: result.keyboardChangedPicture && result.keyboardLeftRight,
                    m5: result.gamepadPlayers.join(",") === "1,2" && result.gamepadChangedPicture && result.gamepadReleasedOnUnplug,
                });
            })
            .assertPage("M3, M4 and M5 hold", (page) => page.evaluate(() => (window as unknown as { verdict: AcceptanceVerdict }).verdict),
                P.equals<AcceptanceVerdict>({ m3: true, m4: true, m5: true }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    })),
};

export default testFile;
