// realizes: docs/arcade-runtime-spec.md > §8 ArcadeAudio (gesture-unlocked Web Audio scheduling under Chromium)

// Dependencies:
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline and predicates
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Shared page server with runtime-dependency resolution

// Type dependencies:
import type ArcadeAudio from "../../src/ArcadeAudio/ArcadeAudio.ts";   // Instance retained between in-page stages
import type FakeArcadeSession from "../support/FakeArcadeSession.ts";   // W0 session double loaded in-page
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructors loaded by the browser page
// Production ArcadeAudio and the required W0 session double are imported directly.
interface BrowserRuntime {
    ArcadeAudio: typeof ArcadeAudio;
    FakeArcadeSession: typeof FakeArcadeSession;
}

// INTERFACE :: recorded createBuffer arguments
// Proves session-rate stereo allocation even when the device context chooses another rate.
interface BrowserBufferRecord {
    readonly channels: number;
    readonly length: number;
    readonly sampleRate: number;
    readonly leftHasSignal: boolean;
    readonly rightHasSignal: boolean;
}

// INTERFACE :: scratch retained in the page between pipeline stages
// Also owns restoration of the AudioContext prototype instrumentation.
interface BrowserScratch {
    audio: ArcadeAudio;
    session: FakeArcadeSession;
    context: AudioContext | null;
    buffers: BrowserBufferRecord[];
    starts: number[];
    sourceConnections: number;
    gainConnections: number;
    restore(): void;
}

/**
 *
 * Constants
 *
 */

const TIMEOUT = 30_000;                                           // Per-case browser pipeline timeout
const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>ArcadeAudio browser test</title></head>
<body>
  <button id="unlock" type="button">Unlock sound</button>
  <script type="module">
    import ArcadeAudio from "/src/ArcadeAudio/ArcadeAudio.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";
    window.audioRuntime = { ArcadeAudio, FakeArcadeSession };
  </script>
</body>
</html>`;                                                         // Minimal page with a real gesture target

/**
 *
 * Functions
 *
 */

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against a fresh page server for this file's PAGE.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

const testFile: TestFile = {
    label: "ArcadeAudio browser behavior",
    cases: [
        {
            label: "a synthetic pointer gesture unlocks a real AudioContext and schedules session-rate stereo through gain to its destination",
            run: () => withTestPage((url) => CTGBrowserTest.init("real gesture-unlocked scheduling")
                .interact("instrument real Web Audio allocation and arm the unlock button", async ({ page }) => {
                    await page.evaluate(() => {
                        const { ArcadeAudio, FakeArcadeSession } = (window as unknown as { audioRuntime: BrowserRuntime }).audioRuntime;
                        const buffers: BrowserBufferRecord[] = [];
                        const starts: number[] = [];
                        const scratch = {
                            context: null,
                            buffers,
                            starts,
                            sourceConnections: 0,
                            gainConnections: 0,
                        } as unknown as BrowserScratch;

                        const prototype = AudioContext.prototype;
                        const originalCreateBuffer = prototype.createBuffer;
                        const originalCreateBufferSource = prototype.createBufferSource;
                        const originalCreateGain = prototype.createGain;

                        prototype.createBuffer = function(channels, length, sampleRate): AudioBuffer {
                            scratch.context = this;
                            const buffer = originalCreateBuffer.call(this, channels, length, sampleRate);
                            buffers.push({ channels, length, sampleRate, leftHasSignal: false, rightHasSignal: false });
                            const left = buffer.getChannelData(0);
                            const right = buffer.getChannelData(1);
                            queueMicrotask(() => {
                                const record = buffers.at(-1);
                                if (record === undefined) return;
                                (record as { leftHasSignal: boolean }).leftHasSignal = left.some((sample) => sample !== 0);
                                (record as { rightHasSignal: boolean }).rightHasSignal = right.some((sample) => sample !== 0);
                            });
                            return buffer;
                        };
                        prototype.createBufferSource = function(): AudioBufferSourceNode {
                            scratch.context = this;
                            const source = originalCreateBufferSource.call(this);
                            const originalConnect = source.connect.bind(source);
                            const originalStart = source.start.bind(source);
                            source.connect = ((destination: AudioNode): AudioNode => {
                                scratch.sourceConnections++;
                                return originalConnect(destination);
                            }) as AudioBufferSourceNode["connect"];
                            source.start = ((when = 0): void => {
                                starts.push(when);
                                originalStart(when);
                            }) as AudioBufferSourceNode["start"];
                            return source;
                        };
                        prototype.createGain = function(): GainNode {
                            scratch.context = this;
                            const gain = originalCreateGain.call(this);
                            const originalConnect = gain.connect.bind(gain);
                            gain.connect = ((destination: AudioNode): AudioNode => {
                                scratch.gainConnections++;
                                return originalConnect(destination);
                            }) as GainNode["connect"];
                            return gain;
                        };

                        scratch.restore = (): void => {
                            prototype.createBuffer = originalCreateBuffer;
                            prototype.createBufferSource = originalCreateBufferSource;
                            prototype.createGain = originalCreateGain;
                        };
                        scratch.session = new FakeArcadeSession();
                        scratch.audio = ArcadeAudio.init({
                            session: scratch.session,
                            gestureSource: document.querySelector<HTMLButtonElement>("#unlock")!,
                        });
                        scratch.audio.armGestureUnlock();
                        (window as unknown as { audioScratch: BrowserScratch }).audioScratch = scratch;
                    });
                })
                .interact("send a trusted synthetic pointer gesture", async ({ page }) => {
                    await page.locator("#unlock").click();
                    await page.waitForFunction(() => (window as unknown as { audioScratch: BrowserScratch }).audioScratch.audio.isUnlocked, null, { timeout: 5000 });
                })
                .interact("emit one non-silent 960-frame stereo chunk", async ({ page }) => {
                    await page.evaluate(() => {
                        const scratch = (window as unknown as { audioScratch: BrowserScratch }).audioScratch;
                        const frames = 960;
                        const samples = new Float32Array(frames * 2);
                        for (let frame = 0; frame < frames; frame++) {
                            samples[frame * 2] = Math.sin((frame / 48000) * 440 * Math.PI * 2) * 0.1;
                            samples[frame * 2 + 1] = Math.sin((frame / 48000) * 660 * Math.PI * 2) * 0.1;
                        }
                        scratch.session.emitSound({ samples, frames });
                    });
                    await page.waitForFunction(() => (window as unknown as { audioScratch: BrowserScratch }).audioScratch.starts.length === 1);
                    await page.waitForFunction(() => {
                        const record = (window as unknown as { audioScratch: BrowserScratch }).audioScratch.buffers[0];
                        return record?.leftHasSignal === true && record.rightHasSignal === true;
                    });
                })
                .assertPage("one real source starts with a non-silent two-channel 48 kHz buffer connected through gain",
                    (page) => page.evaluate(() => {
                        const scratch = (window as unknown as { audioScratch: BrowserScratch }).audioScratch;
                        return {
                            unlocked: scratch.audio.isUnlocked,
                            buffers: scratch.buffers,
                            starts: scratch.starts.length,
                            validStartTime: Number.isFinite(scratch.starts[0]) && (scratch.starts[0] ?? -1) >= 0,
                            sourceConnections: scratch.sourceConnections,
                            gainConnections: scratch.gainConnections,
                        };
                    }), P.equals<unknown>({
                        unlocked: true,
                        buffers: [{ channels: 2, length: 960, sampleRate: 48000, leftHasSignal: true, rightHasSignal: true }],
                        starts: 1,
                        validStartTime: true,
                        sourceConnections: 1,
                        gainConnections: 2,
                    }))
                .assertPage("destroy closes the real context and remains idempotent", (page) => page.evaluate(async () => {
                    const scratch = (window as unknown as { audioScratch: BrowserScratch }).audioScratch;
                    scratch.audio.destroy();
                    scratch.audio.destroy();
                    await new Promise((resolveDone) => setTimeout(resolveDone, 100));
                    const state = scratch.context?.state ?? null;
                    scratch.restore();
                    return state;
                }), P.equals<string | null>("closed"))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
