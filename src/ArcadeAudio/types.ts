// realizes: docs/arcade-runtime-spec.md > §8 ArcadeAudio (configuration, injected Web Audio boundary and queue arithmetic)

// Type dependencies:
import {
    isArcadeSession,                                               // Guards the session supplying stereo chunks
    isFiniteNumber,                                                // Guards context clocks and rates
    type ArcadeSession,                                           // Sound source owned outside ArcadeAudio
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {addEventListener:(STRING, (event -> VOID), OBJECT? -> VOID), removeEventListener:(STRING, (event -> VOID), OBJECT? -> VOID)}
// Where gesture unlock listens; a DOM element or document satisfies it structurally.
export interface GestureSourceLike {
    addEventListener(type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void;   // Subscribes to a gesture
    removeEventListener(type: string, listener: (event: Event) => void, options?: EventListenerOptions): void;   // Removes that subscription
}

// INTERFACE :: the subset of AudioContext ArcadeAudio drives
// Injectable so pure spec tests can script the audio clock and scheduled sources.
export interface AudioContextLike {
    readonly state: "suspended" | "running" | "closed" | "interrupted";   // Autoplay and lifecycle state
    readonly sampleRate: number;                                   // Device context rate, which may differ from the session rate
    readonly currentTime: number;                                  // Audio clock in seconds
    readonly destination: AudioNode;                               // Speaker destination
    resume(): Promise<void>;                                       // Attempts gesture unlock
    close(): Promise<void>;                                        // Releases the device context
    createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;   // Allocates a sample-rate-tagged buffer
    createBufferSource(): AudioBufferSourceNode;                    // Allocates a one-shot source
    createGain(): GainNode;                                        // Allocates the mute gain
}

// INTERFACE :: {session:arcadeSession, gestureSource:gestureSourceLike, audioContext:audioContextLike}
// Direct construction dependencies; init() fills audioContext when omitted.
export interface ArcadeAudioConfig {
    readonly session: ArcadeSession;                               // Source of interleaved stereo SoundEvents
    readonly gestureSource: GestureSourceLike;                     // Target whose first gesture unlocks sound
    readonly audioContext: AudioContextLike;                       // Context receiving de-interleaved buffers
    readonly volume?: number;                                     // Initial playback gain in [0, 1]; defaults to 1
}

// INTERFACE :: {dropQueuedFrames:NUMBER, dropIncomingFrames:NUMBER}
// Oldest-first cap decision in stereo frames; ArcadeAudio converts the result to interleaved sample count.
export interface AudioQueueCapDecision {
    readonly dropQueuedFrames: number;                             // Frames removed from the existing queue first
    readonly dropIncomingFrames: number;                           // Leading frames removed from the new chunk after that
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value can add and remove listeners from one gesture target.
export function isGestureSourceLike(value: unknown): value is GestureSourceLike {
    return typeof value === "object" && value !== null
        && typeof (value as GestureSourceLike).addEventListener === "function"
        && typeof (value as GestureSourceLike).removeEventListener === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a known state, positive rate, non-negative clock, destination and every Web Audio method ArcadeAudio calls.
export function isAudioContextLike(value: unknown): value is AudioContextLike {
    if (typeof value !== "object" || value === null) return false;
    const context = value as AudioContextLike;
    return (context.state === "suspended" || context.state === "running" || context.state === "closed" || context.state === "interrupted")
        && isFiniteNumber(context.sampleRate) && context.sampleRate > 0
        && isFiniteNumber(context.currentTime) && context.currentTime >= 0
        && typeof context.destination === "object" && context.destination !== null
        && typeof context.resume === "function"
        && typeof context.close === "function"
        && typeof context.createBuffer === "function"
        && typeof context.createBufferSource === "function"
        && typeof context.createGain === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies one valid session, gesture source and audio context.
export function isArcadeAudioConfig(value: unknown): value is ArcadeAudioConfig {
    return typeof value === "object" && value !== null
        && isArcadeSession((value as ArcadeAudioConfig).session)
        && isGestureSourceLike((value as ArcadeAudioConfig).gestureSource)
        && isAudioContextLike((value as ArcadeAudioConfig).audioContext)
        && ((value as ArcadeAudioConfig).volume === undefined
            || (isFiniteNumber((value as ArcadeAudioConfig).volume)
                && (value as ArcadeAudioConfig).volume! >= 0
                && (value as ArcadeAudioConfig).volume! <= 1));
}

/**
 *
 * Pure Queue Functions
 *
 */

// FUNCTION :: Float32Array -> [Float32Array, Float32Array]
// Copies interleaved left/right values into independent channel arrays.
export function deinterleaveStereo(samples: Float32Array): readonly [Float32Array, Float32Array] {
    const frames = Math.floor(samples.length / 2);
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
        left[frame] = samples[frame * 2] ?? 0;
        right[frame] = samples[frame * 2 + 1] ?? 0;
    }
    return [left, right];
}

// FUNCTION :: finiteNumber, NUMBER, finiteNumber, finiteNumber, finiteNumber? -> audioQueueCapDecision
// Returns the exact oldest-first frame drops needed once existing duration plus an incoming chunk exceeds the cap.
// NOTE: An overflow trims down to trimQueueMs (default: the cap) so one overload cannot leave the queue pinned at the cap.
export function audioQueueCapDecision(queuedMs: number, incomingFrames: number, sampleRate: number, maxQueueMs: number, trimQueueMs: number = maxQueueMs): AudioQueueCapDecision {
    const queuedFrames = Math.max(0, Math.round((queuedMs / 1000) * sampleRate));
    const capacityFrames = Math.max(0, Math.floor((maxQueueMs / 1000) * sampleRate));
    const trimFrames = Math.min(capacityFrames, Math.max(0, Math.floor((trimQueueMs / 1000) * sampleRate)));
    const overflow = queuedFrames + incomingFrames > capacityFrames;
    const excessFrames = overflow ? queuedFrames + incomingFrames - trimFrames : 0;
    const dropQueuedFrames = Math.min(queuedFrames, excessFrames);
    return {
        dropQueuedFrames,
        dropIncomingFrames: excessFrames - dropQueuedFrames,
    };
}

// PREDICATE :: finiteNumber, finiteNumber -> BOOLEAN
// True when pending duration has reached the minimum chunk and should be scheduled now rather than held.
export function shouldScheduleAudio(queuedMs: number, minChunkMs: number): boolean {
    return queuedMs >= minChunkMs;
}
