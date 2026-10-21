// realizes: docs/arcade-runtime-spec.md > §8 ArcadeAudio

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed config, Web Audio and unlock failures
import { isArcadeSession, isSoundEvent } from "../shared.types.js";             // Guards init input and session sound events
import {
    audioQueueCapDecision,                                      // Pure oldest-first cap arithmetic
    deinterleaveStereo,                                         // Immediate interleaved-to-channel copy
    isArcadeAudioConfig,                                        // Guards direct construction
    isGestureSourceLike,                                        // Guards init before reading browser globals
    shouldScheduleAudio,                                        // Pure minimum-chunk decision
} from "./types.js";

// Type dependencies:
import type { FiniteNumber, SoundEvent, Unsubscribe } from "../shared.types.js";   // Numeric constants, input chunks and listener removers
import type { ArcadeAudioConfig, AudioContextLike, GestureSourceLike } from "./types.js";   // Construction and injected browser boundaries

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {left:Float32Array, right:Float32Array}
// One copied stereo segment retained before or after Web Audio scheduling.
interface StereoChunk {
    readonly left: Float32Array;                                  // Left channel frames
    readonly right: Float32Array;                                 // Right channel frames
}

// INTERFACE :: stereoChunk & scheduled source metadata
// One AudioBuffer whose unplayed duration contributes to queuedMs.
interface ScheduledChunk extends StereoChunk {
    readonly source: AudioBufferSourceNode;                       // One-shot node playing the buffer
    readonly frames: number;                                      // Frames in both retained channels
    readonly sampleRate: number;                                  // Rate tagged on this buffer
    readonly startTime: number;                                   // Audio-clock start in seconds
}

/**
 *
 * Class
 *
 */

// Plays copied, de-interleaved session sound through Web Audio with gesture unlock, mute and a bounded latency queue.
export default class ArcadeAudio {

    /* Static Fields */
    static readonly GESTURE_EVENTS: ReadonlyArray<string> = ["pointerdown", "keydown", "touchend"];   // Events that count as a user gesture
    static readonly MAX_QUEUE_MS: FiniteNumber = 120;             // Six normal P10 chunks; older samples drop beyond it
    static readonly MIN_CHUNK_MS: FiniteNumber = 16;              // Smallest pending duration scheduled as one buffer
    static readonly LEAD_SECONDS = 0.02;                          // Lead when the schedule has run dry, retained from DosAudio

    /* Instance Fields */
    private readonly _session: ArcadeAudioConfig["session"];       // Interleaved stereo source
    private readonly _gestureSource: GestureSourceLike;            // Gesture listener target
    private readonly _context: AudioContextLike;                   // Playback clock and node factory
    private readonly _gain: GainNode;                              // Single mute node feeding the destination
    private readonly _unsubscribeSound: Unsubscribe;               // Removes the onSound listener
    private _pending: StereoChunk[] = [];                          // Copied chunks not scheduled yet, oldest first
    private _pendingFrames = 0;                                    // Frames across _pending
    private _scheduled: ScheduledChunk[] = [];                     // Started sources with some audio not yet played
    private _droppedSamples = 0;                                   // Interleaved sample values dropped by the cap
    private _nextStartTime = 0;                                    // Audio-clock time immediately after the last source
    private _armed: Unsubscribe | null = null;                     // Gesture-listener remover, or null
    private _muted = false;                                        // Whether gain is zero
    private _destroyed = false;                                    // Whether destroy() ran

    // CONSTRUCTOR :: arcadeAudioConfig -> this
    // Creates the gain and subscribes without reading browser globals, preserving every valid pre-unlock chunk.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG for bad config and AUDIO_FAILED when the gain cannot be created.
    constructor(config: ArcadeAudioConfig) {
        if (!isArcadeAudioConfig(config)) throw ArcadeAudio.invalidConfig(config);
        this._session = config.session;
        this._gestureSource = config.gestureSource;
        this._context = config.audioContext;
        try {
            this._gain = this._context.createGain();
            this._gain.connect(this._context.destination);
        } catch (error) {
            throw ArcadeAudio.audioFailed("The audio gain could not be created.", error);
        }
        this._unsubscribeSound = this._session.onSound((sound) => this.enqueue(sound));
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> BOOLEAN
    // Whether the context is running.
    get isUnlocked(): boolean {
        return this._context.state === "running";
    }

    // GETTER :: VOID -> BOOLEAN
    // Whether the mute gain is zero by request.
    get isMuted(): boolean {
        return this._muted;
    }

    // GETTER :: VOID -> NUMBER
    // Device context sample rate, which may differ from the session rate requested by init().
    get sampleRate(): number {
        return this._context.sampleRate;
    }

    // GETTER :: VOID -> finiteNumber
    // Sum of pending duration and each scheduled buffer's unplayed duration, using each buffer's own frame count and rate.
    get queuedMs(): FiniteNumber {
        const now = this._context.currentTime;
        let milliseconds = (this._pendingFrames / this._session.sampleRate) * 1000;
        for (const chunk of this._scheduled) milliseconds += (ArcadeAudio.remainingFrames(chunk, now) / chunk.sampleRate) * 1000;
        return milliseconds;
    }

    // GETTER :: VOID -> NUMBER
    // Interleaved Float32 sample values dropped by the queue cap since construction.
    get droppedSamples(): number {
        return this._droppedSamples;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Resumes the context unless already running, then schedules a ready pending chunk.
    // NOTE: Throws ArcadeRuntimeError AUDIO_FAILED when resume rejects.
    async unlock(): Promise<void> {
        if (this._context.state !== "running") {
            try {
                await this._context.resume();
            } catch (error) {
                throw ArcadeAudio.audioFailed("The audio context could not be resumed.", error);
            }
        }
        this.flush();
    }

    // INSTANCE :: VOID -> unsubscribe
    // Arms one listener for each supported gesture; listeners remain armed after a failed unlock.
    // NOTE: A second arm returns the existing remover without adding duplicate listeners.
    armGestureUnlock(): Unsubscribe {
        if (this._armed !== null) return this._armed;
        const listener = (): void => {
            this.unlock().then(() => remove(), () => undefined);
        };
        const remove = (): void => {
            for (const type of ArcadeAudio.GESTURE_EVENTS) this._gestureSource.removeEventListener(type, listener);
            this._armed = null;
        };
        for (const type of ArcadeAudio.GESTURE_EVENTS) this._gestureSource.addEventListener(type, listener, { passive: true });
        this._armed = remove;
        return remove;
    }

    // INSTANCE :: VOID -> VOID
    // Sets gain to zero while samples continue to flow.
    mute(): void {
        this._muted = true;
        this._gain.gain.value = 0;
    }

    // INSTANCE :: VOID -> VOID
    // Restores gain to one.
    unmute(): void {
        this._muted = false;
        this._gain.gain.value = 1;
    }

    // INSTANCE :: VOID -> VOID
    // Unsubscribes, removes gestures, stops scheduled sources, clears pending samples and closes the context once.
    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this._unsubscribeSound();
        if (this._armed !== null) this._armed();
        this.cancelScheduled();
        this._pending = [];
        this._pendingFrames = 0;
        try {
            this._context.close().catch(() => undefined);
        } catch {
            // A synchronous close failure is ignored just like a rejected close promise.
        }
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: soundEvent -> VOID
    // Copies one reused SoundEvent immediately, enforces the cap oldest-first, and schedules only on a running context.
    private enqueue(sound: SoundEvent): void {
        if (this._destroyed || !isSoundEvent(sound) || sound.frames === 0) return;
        const [left, right] = deinterleaveStereo(sound.samples);
        const decision = audioQueueCapDecision(this.queuedMs, sound.frames, this._session.sampleRate, ArcadeAudio.MAX_QUEUE_MS);
        if (decision.dropQueuedFrames > 0) this.dropQueuedFrames(decision.dropQueuedFrames);
        const droppedFrames = decision.dropQueuedFrames + decision.dropIncomingFrames;
        this._droppedSamples += droppedFrames * 2;
        if (decision.dropIncomingFrames < sound.frames) {
            const offset = decision.dropIncomingFrames;
            const chunk = offset === 0
                ? { left, right }
                : { left: left.subarray(offset), right: right.subarray(offset) };
            this._pending.push(chunk);
            this._pendingFrames += chunk.left.length;
        }
        this.flush();
    }

    // PRIVATE :: VOID -> VOID
    // Schedules all pending frames as one stereo buffer once MIN_CHUNK_MS is ready and the context is running.
    private flush(): void {
        if (this._destroyed || this._context.state !== "running") return;
        const rate = this._session.sampleRate;
        if (!shouldScheduleAudio((this._pendingFrames / rate) * 1000, ArcadeAudio.MIN_CHUNK_MS)) return;

        const left = new Float32Array(this._pendingFrames);
        const right = new Float32Array(this._pendingFrames);
        let offset = 0;
        for (const chunk of this._pending) {
            left.set(chunk.left, offset);
            right.set(chunk.right, offset);
            offset += chunk.left.length;
        }

        let source: AudioBufferSourceNode | null = null;
        let scheduled: ScheduledChunk | null = null;
        try {
            const buffer = this._context.createBuffer(2, this._pendingFrames, rate);
            buffer.getChannelData(0).set(left);
            buffer.getChannelData(1).set(right);
            source = this._context.createBufferSource();
            source.buffer = buffer;
            source.connect(this._gain);
            const now = this._context.currentTime;
            const startTime = this._nextStartTime > now ? this._nextStartTime : now + ArcadeAudio.LEAD_SECONDS;
            scheduled = { left, right, source, frames: buffer.length, sampleRate: buffer.sampleRate, startTime };
            source.onended = () => { if (scheduled !== null) this.removeScheduled(scheduled); };
            this._scheduled.push(scheduled);
            source.start(startTime);
            this._nextStartTime = startTime + (buffer.length / buffer.sampleRate);
        } catch (error) {
            if (scheduled !== null) this.removeScheduled(scheduled);
            if (source !== null) {
                source.onended = null;
                try { source.stop(); } catch { /* source never started or already ended */ }
            }
            throw ArcadeAudio.audioFailed("An audio buffer could not be scheduled.", error);
        }

        this._pending = [];
        this._pendingFrames = 0;
    }

    // PRIVATE :: NUMBER -> VOID
    // Rebuilds all unplayed scheduled and pending data after removing exactly count oldest stereo frames.
    private dropQueuedFrames(count: number): void {
        const now = this._context.currentTime;
        const chunks: StereoChunk[] = [];
        for (const scheduled of this._scheduled) {
            const remaining = ArcadeAudio.remainingFrames(scheduled, now);
            if (remaining === 0) continue;
            const consumed = scheduled.frames - remaining;
            chunks.push({ left: scheduled.left.subarray(consumed), right: scheduled.right.subarray(consumed) });
        }
        chunks.push(...this._pending);
        this.cancelScheduled();
        this._pending = [];
        this._pendingFrames = 0;

        let remainingDrop = count;
        for (const chunk of chunks) {
            if (remainingDrop >= chunk.left.length) {
                remainingDrop -= chunk.left.length;
                continue;
            }
            const retained = remainingDrop === 0
                ? chunk
                : { left: chunk.left.subarray(remainingDrop), right: chunk.right.subarray(remainingDrop) };
            remainingDrop = 0;
            this._pending.push(retained);
            this._pendingFrames += retained.left.length;
        }
    }

    // PRIVATE :: VOID -> VOID
    // Stops and forgets every scheduled source without allowing its onended callback to race the rebuild.
    private cancelScheduled(): void {
        const scheduled = this._scheduled;
        this._scheduled = [];
        this._nextStartTime = 0;
        for (const chunk of scheduled) {
            chunk.source.onended = null;
            try { chunk.source.stop(); } catch { /* already ended */ }
        }
    }

    // PRIVATE :: scheduledChunk -> VOID
    // Removes one naturally ended source and keeps the next start boundary consistent with what remains.
    private removeScheduled(chunk: ScheduledChunk): void {
        const index = this._scheduled.indexOf(chunk);
        if (index >= 0) this._scheduled.splice(index, 1);
        this._nextStartTime = this._scheduled.reduce((latest, item) => Math.max(latest, item.startTime + item.frames / item.sampleRate), 0);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: {session:arcadeSession, gestureSource:gestureSourceLike, audioContext:audioContextLike?} -> arcadeAudio
    // Constructs a browser AudioContext requesting the session rate when none is injected, then delegates to the constructor.
    // NOTE: Throws INVALID_CONFIG before reading globals and AUDIO_FAILED when AudioContext is absent or construction fails.
    static init(config: Omit<ArcadeAudioConfig, "audioContext"> & { readonly audioContext?: AudioContextLike }): ArcadeAudio {
        if (config.audioContext !== undefined) return new ArcadeAudio({ ...config, audioContext: config.audioContext });
        if (!isArcadeSession(config.session) || !isGestureSourceLike(config.gestureSource)) throw ArcadeAudio.invalidConfig(config);
        const AudioContextImplementation = globalThis.AudioContext;
        if (typeof AudioContextImplementation !== "function") throw ArcadeAudio.audioFailed("AudioContext is not available in this environment.");
        try {
            return new ArcadeAudio({
                ...config,
                audioContext: new AudioContextImplementation({ sampleRate: config.session.sampleRate }),
            });
        } catch (error) {
            if (ArcadeRuntimeError.is(error)) throw error;
            throw ArcadeAudio.audioFailed("The audio context could not be created.", error);
        }
    }

    // STATIC :: scheduledChunk, finiteNumber -> NUMBER
    // Converts audio-clock progress into the exact whole frames in one scheduled buffer that have not played yet.
    private static remainingFrames(chunk: ScheduledChunk, now: number): number {
        if (now <= chunk.startTime) return chunk.frames;
        const played = Math.floor(((now - chunk.startTime) * chunk.sampleRate) + 1e-7);
        return Math.max(0, chunk.frames - played);
    }

    // STATIC :: UNKNOWN -> arcadeRuntimeError
    // Standard INVALID_CONFIG error for constructor and init validation.
    private static invalidConfig(data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadeAudio config must hold a session, a gesture source and an audio context.",
            data,
        });
    }

    // STATIC :: STRING, UNKNOWN? -> arcadeRuntimeError
    // Standard AUDIO_FAILED wrapper for Web Audio construction, node and resume failures.
    private static audioFailed(message: string, data?: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.AUDIO_FAILED, message, data });
    }
}
