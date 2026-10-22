// realizes: docs/arcade-runtime-spec.md > §8 ArcadeAudio (pure queue, de-interleave, predicates and scripted scheduling)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeAudio from "../../src/ArcadeAudio/ArcadeAudio.ts";   // Class under test
import {
    audioQueueCapDecision,                                      // Pure cap arithmetic under test
    deinterleaveStereo,                                         // Pure stereo copy under test
    isArcadeAudioConfig,                                        // Construction config guard under test
    isAudioContextLike,                                         // Injected context guard under test
    isGestureSourceLike,                                        // Gesture target guard under test
    shouldScheduleAudio,                                        // Pure minimum-chunk decision under test
} from "../../src/ArcadeAudio/types.ts";
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed error identity
import FakeArcadeSession from "../support/FakeArcadeSession.ts";   // Required W0 session double
import { errorSnapshot, rejectedBy, thrownBy, type ErrorSnapshot } from "../support/fixtures.ts";   // Error capture helpers

// Type dependencies:
import type { ArcadeAudioConfig, AudioContextLike, GestureSourceLike } from "../../src/ArcadeAudio/types.ts";   // Fake boundaries and rejected config casts
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: one createBuffer call captured by FakeAudioContext
// Preserves the exact channel count, frame count, rate and channel arrays ArcadeAudio requested.
interface BufferRecord {
    readonly channels: number;
    readonly length: number;
    readonly sampleRate: number;
    readonly data: Float32Array[];
    readonly buffer: AudioBuffer;
}

/**
 *
 * Classes
 *
 */

// Scripted AudioBufferSourceNode subset that records starts and can be completed by its context's audio clock.
class FakeBufferSource {
    buffer: AudioBuffer | null = null;                            // Buffer assigned before start
    onended: ((this: AudioBufferSourceNode, event: Event) => unknown) | null = null;   // Natural-completion callback
    startTime: number | null = null;                              // Recorded scheduled start
    stopped = false;                                              // Whether stop() cancelled it
    ended = false;                                                // Whether the scripted clock completed it

    // CONSTRUCTOR :: fakeAudioContext -> this
    // Retains the owning clock for records and completion.
    constructor(private readonly _context: FakeAudioContext) {}

    // INSTANCE :: audioNode -> audioNode
    // Records no graph detail; returning the destination matches AudioNode.connect's useful shape.
    connect(destination: AudioNode): AudioNode {
        return destination;
    }

    // INSTANCE :: NUMBER? -> VOID
    // Records one start time.
    start(when = 0): void {
        this.startTime = when;
        this._context.startCalls.push(when);
    }

    // INSTANCE :: VOID -> VOID
    // Marks this source cancelled and counts only the first stop.
    stop(): void {
        if (this.stopped || this.ended) throw new Error("source already stopped");
        this.stopped = true;
        this._context.stopCalls++;
    }

    // INSTANCE :: VOID -> VOID
    // Fires onended once when the scripted currentTime reaches the buffer end.
    finishIfDue(): void {
        if (this.stopped || this.ended || this.startTime === null || this.buffer === null) return;
        if (this._context.currentTime + 1e-9 < this.startTime + this.buffer.duration) return;
        this.ended = true;
        this.onended?.call(this as unknown as AudioBufferSourceNode, {} as Event);
    }
}

// Controllable AudioContextLike: records buffers and starts, advances natural endings, and can reject resume.
class FakeAudioContext implements AudioContextLike {
    state: AudioContextLike["state"];                              // Mutable autoplay state
    readonly sampleRate: number;                                  // Deliberately may differ from session rate
    currentTime = 0;                                              // Scripted audio clock
    readonly destination = {} as AudioNode;                       // Structural output node
    readonly buffers: BufferRecord[] = [];                        // Every created AudioBuffer
    readonly sources: FakeBufferSource[] = [];                    // Every created source, including cancelled ones
    readonly gains: GainNode[] = [];                              // Every created gain
    readonly startCalls: number[] = [];                           // Scheduled start times
    resumeCalls = 0;                                              // resume() calls
    closeCalls = 0;                                               // close() calls
    stopCalls = 0;                                                // Successful source stops
    rejectResume = false;                                         // Resume script
    failGain = false;                                             // Gain-construction script

    // CONSTRUCTOR :: contextState?, NUMBER? -> this
    // Starts at time zero with a selectable state and device rate.
    constructor(state: AudioContextLike["state"] = "suspended", sampleRate = 44100) {
        this.state = state;
        this.sampleRate = sampleRate;
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Runs unless scripted to reject.
    async resume(): Promise<void> {
        this.resumeCalls++;
        if (this.rejectResume) throw new Error("resume refused");
        this.state = "running";
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Closes and counts calls.
    async close(): Promise<void> {
        this.closeCalls++;
        this.state = "closed";
    }

    // INSTANCE :: NUMBER, NUMBER, NUMBER -> audioBuffer
    // Builds a structural AudioBuffer with mutable per-channel arrays.
    createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        const buffer = {
            numberOfChannels: channels,
            length,
            sampleRate,
            duration: length / sampleRate,
            getChannelData: (channel: number): Float32Array => {
                const values = data[channel];
                if (values === undefined) throw new Error("bad channel");
                return values;
            },
        } as unknown as AudioBuffer;
        this.buffers.push({ channels, length, sampleRate, data, buffer });
        return buffer;
    }

    // INSTANCE :: VOID -> audioBufferSourceNode
    // Allocates and records one scripted source.
    createBufferSource(): AudioBufferSourceNode {
        const source = new FakeBufferSource(this);
        this.sources.push(source);
        return source as unknown as AudioBufferSourceNode;
    }

    // INSTANCE :: VOID -> gainNode
    // Allocates a gain with observable value or throws when scripted.
    createGain(): GainNode {
        if (this.failGain) throw new Error("gain refused");
        const gain = {
            gain: { value: 1 },
            connect: (destination: AudioNode): AudioNode => destination,
        } as unknown as GainNode;
        this.gains.push(gain);
        return gain;
    }

    // INSTANCE :: finiteNumber -> VOID
    // Moves the audio clock forward and completes every source whose buffer has ended.
    advanceTo(time: number): void {
        this.currentTime = time;
        for (const source of this.sources) source.finishIfDue();
    }
}

// Listener target double used to exercise gesture arming without DOM globals.
class FakeGestureSource implements GestureSourceLike {
    readonly added: string[] = [];                                // Listener types attached
    readonly removed: string[] = [];                              // Listener types removed
    private readonly _listeners = new Map<string, Set<(event: Event) => void>>();   // Active listeners by type

    // INSTANCE :: STRING, (event -> VOID) -> VOID
    // Adds one listener and records the type.
    addEventListener(type: string, listener: (event: Event) => void): void {
        this.added.push(type);
        const listeners = this._listeners.get(type) ?? new Set();
        listeners.add(listener);
        this._listeners.set(type, listeners);
    }

    // INSTANCE :: STRING, (event -> VOID) -> VOID
    // Removes one listener and records the type.
    removeEventListener(type: string, listener: (event: Event) => void): void {
        this.removed.push(type);
        this._listeners.get(type)?.delete(listener);
    }

    // INSTANCE :: STRING -> VOID
    // Fires a stable copy of the active listeners for one gesture type.
    dispatch(type: string): void {
        for (const listener of [...(this._listeners.get(type) ?? [])]) listener({} as Event);
    }
}

/**
 *
 * Functions
 *
 */

// HELPER :: NUMBER, NUMBER, NUMBER -> soundEvent
// Builds one stereo chunk whose channels identify it exactly.
const stereo = (frames: number, leftValue = 1, rightValue = -1): { samples: Float32Array; frames: number } => {
    const samples = new Float32Array(frames * 2);
    for (let frame = 0; frame < frames; frame++) {
        samples[frame * 2] = leftValue;
        samples[frame * 2 + 1] = rightValue;
    }
    return { samples, frames };
};

// HELPER :: contextState?, NUMBER? -> test rig
// Constructs ArcadeAudio entirely over W0's FakeArcadeSession and local scripted browser boundaries.
const rig = (state: AudioContextLike["state"] = "suspended", contextRate = 44100): {
    session: FakeArcadeSession;
    context: FakeAudioContext;
    gesture: FakeGestureSource;
    audio: ArcadeAudio;
} => {
    const session = new FakeArcadeSession();
    const context = new FakeAudioContext(state, contextRate);
    const gesture = new FakeGestureSource();
    return { session, context, gesture, audio: new ArcadeAudio({ session, gestureSource: gesture, audioContext: context }) };
};

// HELPER :: UNKNOWN -> errorSnapshot
// Runtime-error identity for a thrown or rejected value.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

// HELPER :: VOID -> structurally valid audioContextLike
// Plain object used to replace one predicate field at a time.
const contextLike = (): Record<string, unknown> => ({
    state: "suspended",
    sampleRate: 48000,
    currentTime: 0,
    destination: {},
    resume: async () => {},
    close: async () => {},
    createBuffer: (): object => ({}),
    createBufferSource: (): object => ({}),
    createGain: (): object => ({}),
});

// HELPER :: {[STRING]:UNKNOWN}, STRING, UNKNOWN -> {[STRING]:UNKNOWN}
// Copies an object with one field replaced for predicate isolation.
const replacing = (value: Record<string, unknown>, key: string, replacement: unknown): Record<string, unknown> => ({ ...value, [key]: replacement });

const testFile: TestFile = {
    label: "ArcadeAudio queue and scheduling",
    cases: [
        {
            label: "deinterleaveStereo copies alternating left/right values into independent channel arrays",
            run: () => CTGTest.init("stereo de-interleave")
                .stage("split then mutate the reusable source", () => {
                    const samples = new Float32Array([1, 10, 2, 20, 3, 30]);
                    const [left, right] = deinterleaveStereo(samples);
                    samples.fill(99);
                    return { left: Array.from(left), right: Array.from(right) };
                })
                .assert("both copied channels retain their original order", (state) => state.subject,
                    P.equals<unknown>({ left: [1, 2, 3], right: [10, 20, 30] }))
                .start(undefined),
        },
        {
            label: "pure cap and minimum-chunk decisions use duration and drop queued frames before incoming frames",
            run: () => CTGTest.init("pure queue decisions")
                .assert("decisions match the 120 ms cap, the 60 ms trim and the 16 ms threshold", () => ({
                    queuedFirst: audioQueueCapDecision(100, 1920, 48000, 120),
                    incomingAfterQueue: audioQueueCapDecision(20, 7000, 48000, 120),
                    exactlyFull: audioQueueCapDecision(100, 960, 48000, 120, 60),
                    trimmedQueuedFirst: audioQueueCapDecision(100, 1920, 48000, 120, 60),
                    trimmedIncomingAfterQueue: audioQueueCapDecision(20, 7000, 48000, 120, 60),
                    belowMinimum: shouldScheduleAudio(15.999, 16),
                    atMinimum: shouldScheduleAudio(16, 16),
                }), P.equals<unknown>({
                    queuedFirst: { dropQueuedFrames: 960, dropIncomingFrames: 0 },
                    incomingAfterQueue: { dropQueuedFrames: 960, dropIncomingFrames: 1240 },
                    exactlyFull: { dropQueuedFrames: 0, dropIncomingFrames: 0 },
                    trimmedQueuedFirst: { dropQueuedFrames: 3840, dropIncomingFrames: 0 },
                    trimmedIncomingAfterQueue: { dropQueuedFrames: 960, dropIncomingFrames: 4120 },
                    belowMinimum: false,
                    atMinimum: true,
                }))
                .start(undefined),
        },
        {
            label: "gesture, context and ArcadeAudio config predicates reject each required structural field independently",
            run: () => CTGTest.init("ArcadeAudio predicates")
                .assert("all valid structures pass and every isolated violation fails", () => {
                    const validContext = contextLike();
                    const gesture = new FakeGestureSource();
                    const session = new FakeArcadeSession();
                    const contextFields: Record<string, unknown> = {
                        state: "paused",
                        sampleRate: 0,
                        currentTime: -1,
                        destination: null,
                        resume: null,
                        close: null,
                        createBuffer: null,
                        createBufferSource: null,
                        createGain: null,
                    };
                    return {
                        validGesture: isGestureSourceLike(gesture),
                        badGestureObject: isGestureSourceLike(null),
                        badGestureAdd: isGestureSourceLike({ removeEventListener(): void {} }),
                        badGestureRemove: isGestureSourceLike({ addEventListener(): void {} }),
                        validContext: isAudioContextLike(validContext),
                        badContextObject: isAudioContextLike(null),
                        badContextFields: Object.entries(contextFields).map(([key, value]) => isAudioContextLike(replacing(validContext, key, value))),
                        validConfig: isArcadeAudioConfig({ session, gestureSource: gesture, audioContext: validContext }),
                        badSession: isArcadeAudioConfig({ session: {}, gestureSource: gesture, audioContext: validContext }),
                        badGesture: isArcadeAudioConfig({ session, gestureSource: {}, audioContext: validContext }),
                        badContext: isArcadeAudioConfig({ session, gestureSource: gesture, audioContext: {} }),
                    };
                }, P.equals<unknown>({
                    validGesture: true,
                    badGestureObject: false,
                    badGestureAdd: false,
                    badGestureRemove: false,
                    validContext: true,
                    badContextObject: false,
                    badContextFields: [false, false, false, false, false, false, false, false, false],
                    validConfig: true,
                    badSession: false,
                    badGesture: false,
                    badContext: false,
                }))
                .start(undefined),
        },
        {
            label: "constructor rejects invalid config and wraps gain creation with AUDIO_FAILED",
            run: () => CTGTest.init("construction failures")
                .assert("failures use the one runtime error class", () => {
                    const invalid = thrownBy(() => new ArcadeAudio({} as ArcadeAudioConfig));
                    const session = new FakeArcadeSession();
                    const gestureSource = new FakeGestureSource();
                    const audioContext = new FakeAudioContext();
                    audioContext.failGain = true;
                    const gain = thrownBy(() => new ArcadeAudio({ session, gestureSource, audioContext }));
                    return { invalid: errorOf(invalid), gain: errorOf(gain) };
                }, P.equals<unknown>({
                    invalid: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    gain: { isRuntimeError: true, code: 12, label: "AUDIO_FAILED" },
                }))
                .start(undefined),
        },
        {
            label: "a 960-frame 48 kHz chunk adds exactly 20 ms while suspended, is copied immediately, and schedules at session rate after unlock",
            run: () => CTGTest.init("P10 chunk duration and copy")
                .stage("emit one reusable stereo chunk while suspended, mutate it, then unlock", async () => {
                    const { session, context, audio } = rig("suspended", 44100);
                    const sound = stereo(960, 3, -4);
                    session.emitSound(sound);
                    const suspended = { queuedMs: audio.queuedMs, starts: context.startCalls.length };
                    sound.samples.fill(99);
                    await audio.unlock();
                    const record = context.buffers[0];
                    return {
                        suspended,
                        requested: record === undefined ? null : { channels: record.channels, length: record.length, sampleRate: record.sampleRate },
                        copied: record === undefined ? null : [record.data[0]?.[0], record.data[1]?.[0]],
                        deviceRate: audio.sampleRate,
                        queuedMs: audio.queuedMs,
                    };
                })
                .assert("duration, scheduling rate and copied channels are exact", (state) => state.subject, P.equals<unknown>({
                    suspended: { queuedMs: 20, starts: 0 },
                    requested: { channels: 2, length: 960, sampleRate: 48000 },
                    copied: [3, -4],
                    deviceRate: 44100,
                    queuedMs: 20,
                }))
                .start(undefined),
        },
        {
            label: "running audio waits below 16 ms then schedules the accumulated stereo frames at the threshold",
            run: () => CTGTest.init("minimum scheduling chunk")
                .stage("emit two 8 ms chunks", () => {
                    const { session, context, audio } = rig("running");
                    session.emitSound(stereo(384, 1, 2));
                    const first = { queuedMs: audio.queuedMs, starts: context.startCalls.length };
                    session.emitSound(stereo(384, 3, 4));
                    const record = context.buffers[0];
                    return { first, second: { queuedMs: audio.queuedMs, starts: context.startCalls.length, frames: record?.length ?? 0 } };
                })
                .assert("only the accumulated 16 ms buffer is scheduled", (state) => state.subject, P.equals<unknown>({
                    first: { queuedMs: 8, starts: 0 },
                    second: { queuedMs: 16, starts: 1, frames: 768 },
                }))
                .start(undefined),
        },
        {
            label: "300 chunks arriving at 50 Hz across a 60 Hz consumer clock never exceed the 120 ms cap",
            run: () => CTGTest.init("cross-cadence queue accounting")
                .stage("advance the playback clock only on 60 Hz ticks while emitting at 50 Hz", () => {
                    const { session, context, audio } = rig("running", 48000);
                    let consumerTick = 0;
                    let maximum = 0;
                    for (let chunk = 0; chunk < 300; chunk++) {
                        const arrivalTime = chunk / 50;
                        while ((consumerTick + 1) / 60 <= arrivalTime + 1e-9) {
                            consumerTick++;
                            context.advanceTo(consumerTick / 60);
                        }
                        session.emitSound(stereo(960));
                        maximum = Math.max(maximum, audio.queuedMs);
                    }
                    return { withinCap: maximum <= ArcadeAudio.MAX_QUEUE_MS, droppedSamples: audio.droppedSamples, scheduled: context.startCalls.length };
                })
                .assert("duration accounting stays bounded without cadence-based drops", (state) => state.subject,
                    P.equals<unknown>({ withinCap: true, droppedSamples: 0, scheduled: 300 }))
                .start(undefined),
        },
        {
            label: "a running seven-chunk burst drops the oldest 80 ms, counts both channel samples, rebuilds the newest 60 ms and restarts it at the clock",
            run: () => CTGTest.init("oldest-first running cap")
                .stage("emit seven distinguishable P10 chunks without advancing playback", () => {
                    const { session, context, audio } = rig("running", 48000);
                    for (let value = 1; value <= 7; value++) session.emitSound(stereo(960, value, -value));
                    const newestBuffer = context.buffers.at(-1);
                    return {
                        queuedMs: audio.queuedMs,
                        droppedSamples: audio.droppedSamples,
                        stoppedOldSources: context.stopCalls,
                        rebuiltFrames: newestBuffer?.length ?? 0,
                        rebuiltStart: context.startCalls.at(-1),
                        firstRetained: newestBuffer === undefined ? null : [newestBuffer.data[0]?.[0], newestBuffer.data[1]?.[0]],
                        lastRetained: newestBuffer === undefined ? null : [newestBuffer.data[0]?.at(-1), newestBuffer.data[1]?.at(-1)],
                    };
                })
                .assert("chunks one to four are gone and chunks five to seven restart at the clock with no lead", (state) => state.subject, P.equals<unknown>({
                    queuedMs: 60,
                    droppedSamples: 7680,
                    stoppedOldSources: 6,
                    rebuiltFrames: 2880,
                    rebuiltStart: 0,
                    firstRetained: [5, -5],
                    lastRetained: [7, -7],
                }))
                .start(undefined),
        },
        {
            label: "a stalled clock that fills the queue does not pin it: once the clock runs, later chunks append without further stops or leads",
            run: () => CTGTest.init("cap recovery")
                .stage("fill the queue on a frozen clock, then advance 20 ms per 50 Hz chunk for a second", () => {
                    const { session, context, audio } = rig("running", 48000);
                    for (let value = 1; value <= 7; value++) session.emitSound(stereo(960, value, -value));
                    const stopsAfterFill = context.stopCalls;
                    const startsAfterFill = context.startCalls.length;
                    let maximum = 0;
                    let contiguous = true;
                    for (let chunk = 0; chunk < 50; chunk++) {
                        context.advanceTo((chunk + 1) / 50);
                        const expectedStart = context.startCalls.at(-1)! + (context.buffers.at(-1)!.length / 48000);
                        session.emitSound(stereo(960));
                        if (Math.abs(context.startCalls.at(-1)! - expectedStart) > 1e-9) contiguous = false;
                        maximum = Math.max(maximum, audio.queuedMs);
                    }
                    return {
                        stopsAfterFill,
                        laterStops: context.stopCalls - stopsAfterFill,
                        laterStarts: context.startCalls.length - startsAfterFill,
                        contiguous,
                        maximum,
                        droppedSamples: audio.droppedSamples,
                    };
                })
                .assert("one trim at the fill, then fifty contiguous appends under the cap", (state) => state.subject, P.equals<unknown>({
                    stopsAfterFill: 6,
                    laterStops: 0,
                    laterStarts: 50,
                    contiguous: true,
                    maximum: 60,
                    droppedSamples: 7680,
                }))
                .start(undefined),
        },
        {
            label: "queuedMs falls with the audio clock from each scheduled buffer's frame count and rate, not callback arrival time",
            run: () => CTGTest.init("scheduled duration accounting")
                .stage("schedule 20 ms, advance 10 ms into playback, then past its end", () => {
                    const { session, context, audio } = rig("running", 44100);
                    session.emitSound(stereo(960));
                    const before = audio.queuedMs;
                    context.advanceTo(0.03);
                    const halfway = audio.queuedMs;
                    context.advanceTo(0.04);
                    return { before, halfway, ended: audio.queuedMs };
                })
                .assert("the session-rate buffer contributes 20, then 10, then 0 ms", (state) => state.subject,
                    P.equals<unknown>({ before: 20, halfway: 10, ended: 0 }))
                .start(undefined),
        },
        {
            label: "mute and unmute change only gain while queued duration continues unchanged",
            run: () => CTGTest.init("gain mute")
                .stage("queue while suspended and toggle mute", () => {
                    const { session, context, audio } = rig();
                    session.emitSound(stereo(960));
                    audio.mute();
                    const muted = { isMuted: audio.isMuted, gain: context.gains[0]?.gain.value, queuedMs: audio.queuedMs };
                    audio.unmute();
                    return { muted, unmuted: { isMuted: audio.isMuted, gain: context.gains[0]?.gain.value, queuedMs: audio.queuedMs } };
                })
                .assert("gain toggles zero to one without consuming audio", (state) => state.subject, P.equals<unknown>({
                    muted: { isMuted: true, gain: 0, queuedMs: 20 },
                    unmuted: { isMuted: false, gain: 1, queuedMs: 20 },
                }))
                .start(undefined),
        },
        {
            label: "gesture arming is idempotent, successful unlock removes all listeners, and failed unlock stays armed with AUDIO_FAILED",
            run: () => CTGTest.init("gesture unlock lifecycle")
                .stage("exercise successful and rejecting gesture sources", async () => {
                    const successful = rig();
                    const firstRemove = successful.audio.armGestureUnlock();
                    const secondRemove = successful.audio.armGestureUnlock();
                    successful.gesture.dispatch("pointerdown");
                    await Promise.resolve();
                    await Promise.resolve();

                    const rejecting = rig();
                    rejecting.context.rejectResume = true;
                    rejecting.audio.armGestureUnlock();
                    const rejection = await rejectedBy(rejecting.audio.unlock());
                    rejecting.gesture.dispatch("keydown");
                    await Promise.resolve();
                    await Promise.resolve();
                    return {
                        successful: {
                            sameRemove: firstRemove === secondRemove,
                            added: successful.gesture.added,
                            removed: successful.gesture.removed,
                            resumeCalls: successful.context.resumeCalls,
                            unlocked: successful.audio.isUnlocked,
                        },
                        rejecting: { error: errorOf(rejection), resumeCalls: rejecting.context.resumeCalls, removed: rejecting.gesture.removed },
                    };
                })
                .assert("successful listeners disarm once while rejecting listeners retry", (state) => state.subject, P.equals<unknown>({
                    successful: {
                        sameRemove: true,
                        added: ["pointerdown", "keydown", "touchend"],
                        removed: ["pointerdown", "keydown", "touchend"],
                        resumeCalls: 1,
                        unlocked: true,
                    },
                    rejecting: {
                        error: { isRuntimeError: true, code: 12, label: "AUDIO_FAILED" },
                        resumeCalls: 2,
                        removed: [],
                    },
                }))
                .start(undefined),
        },
        {
            label: "destroy is idempotent, closes once, stops scheduled sources, removes gestures and unsubscribes from sound",
            run: () => CTGTest.init("terminal destroy")
                .stage("schedule, arm, destroy twice, then emit and gesture again", () => {
                    const { session, context, gesture, audio } = rig("running");
                    session.emitSound(stereo(960));
                    audio.armGestureUnlock();
                    const buffersBefore = context.buffers.length;
                    audio.destroy();
                    audio.destroy();
                    session.emitSound(stereo(960));
                    gesture.dispatch("pointerdown");
                    return {
                        closeCalls: context.closeCalls,
                        stopCalls: context.stopCalls,
                        buffersBefore,
                        buffersAfter: context.buffers.length,
                        removed: gesture.removed,
                        queuedMs: audio.queuedMs,
                    };
                })
                .assert("every owned resource is released exactly once", (state) => state.subject, P.equals<unknown>({
                    closeCalls: 1,
                    stopCalls: 1,
                    buffersBefore: 1,
                    buffersAfter: 1,
                    removed: ["pointerdown", "keydown", "touchend"],
                    queuedMs: 0,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
