// Dependencies:
import { arcadeControlKey } from "../../src/index.ts";            // Canonical control key for the held set
import { validMachineInfo } from "./fixtures.ts";                 // Default machine when none is given

// Type dependencies owned by W26 until the integrator adds the root exports:
import type { ArcadeAxis } from "../../src/shared.types.ts";       // Argument of setAxis

// Type dependencies:
import type {
    ArcadeControl,                                                 // Argument of setControl
    ArcadeControlKey,                                              // Key of the held set
    ArcadeSession,                                                 // Contract this double implements
    FrameEvent,                                                    // Frames emitted to onFrame listeners
    Listener,                                                      // Listener shape for the on* subscriptions
    MachineInfo,                                                   // Machine the session reports
    SoundEvent,                                                    // Chunks emitted to onSound listeners
    Unsubscribe,                                                   // Returned by the on* subscriptions
} from "../../src/index.ts";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {method:STRING, args:[UNKNOWN]}
// One recorded call to the session.
export interface FakeSessionCall {
    readonly method: string;                                       // Session method name
    readonly args: ReadonlyArray<unknown>;                         // Arguments as given
}

// TYPE :: "resolve" | "reject" | "throw"
// How a scripted method behaves when called.
export type FakeSessionMode = "resolve" | "reject" | "throw";

/**
 *
 * Class
 *
 */

// Double of the ArcadeSession contract: records every call, tracks held controls, plays back scripted outcomes, and emits ticks, frames, sound and exit on demand.
export default class FakeArcadeSession implements ArcadeSession {

    /* Instance Fields */
    readonly machine: MachineInfo;                                                 // Reported machine
    readonly sampleRate: number = 48000;                                           // Matches the P10 mixer rate
    readonly calls: FakeSessionCall[] = [];                                        // Every call, in order
    private readonly _held = new Set<ArcadeControlKey>();                          // Controls currently pressed, by canonical key
    private readonly _axes = new Map<string, { readonly axis: ArcadeAxis; readonly value: number }>();   // Last axis writes
    private readonly _scripts = new Map<string, { mode: FakeSessionMode; value: unknown }>();   // Scripted outcomes by method
    private readonly _tickListeners = new Set<Listener<void>>();                   // onTick subscribers
    private readonly _frameListeners = new Set<Listener<FrameEvent>>();            // onFrame subscribers
    private readonly _soundListeners = new Set<Listener<SoundEvent>>();            // onSound subscribers
    private readonly _exitListeners = new Set<Listener<void>>();                   // onExit subscribers

    // CONSTRUCTOR :: machineInfo? -> this
    // Creates a session reporting the given machine, or the fixture machine, with no scripts and no listeners
    constructor(machine: MachineInfo = validMachineInfo()) {
        this.machine = machine;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> [arcadeControlKey]
    // Canonical keys of every control currently pressed, in insertion order
    get held(): ReadonlyArray<ArcadeControlKey> {
        return [...this._held];
    }

    // GETTER :: VOID -> [{axis:arcadeAxis,value:NUMBER}]
    // Last value recorded for each player/kind pair, in insertion order.
    get axes(): ReadonlyArray<{ readonly axis: ArcadeAxis; readonly value: number }> {
        return [...this._axes.values()];
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: STRING, fakeSessionMode, UNKNOWN? -> this
    // Scripts what a method does when called: resolve (return value), reject (return a rejected promise) or throw
    script(method: string, mode: FakeSessionMode, value?: unknown): this {
        this._scripts.set(method, { mode, value });
        return this;
    }

    // INSTANCE :: NUMBER? -> VOID
    // Fires every onTick listener count times (default 1), as emulated frames would
    emitTick(count = 1): void {
        for (let i = 0; i < count; i++) for (const listener of this._tickListeners) listener(undefined);
    }

    // INSTANCE :: frameEvent -> VOID
    // Delivers a frame to every onFrame listener
    emitFrame(frame: FrameEvent): void {
        for (const listener of this._frameListeners) listener(frame);
    }

    // INSTANCE :: soundEvent -> VOID
    // Delivers a chunk to every onSound listener
    emitSound(sound: SoundEvent): void {
        for (const listener of this._soundListeners) listener(sound);
    }

    // INSTANCE :: VOID -> VOID
    // Fires every onExit listener
    emitExit(): void {
        for (const listener of this._exitListeners) listener(undefined);
    }

    // INSTANCE :: arcadeControl, BOOLEAN -> VOID
    // Records the call and updates the held set
    setControl(control: ArcadeControl, pressed: boolean): void {
        this.apply("setControl", [control, pressed]);
        const key = arcadeControlKey(control);
        if (pressed) this._held.add(key);
        else this._held.delete(key);
    }

    // INSTANCE :: arcadeAxis, NUMBER -> VOID
    // Records the call and latest player/kind value.
    setAxis(axis: ArcadeAxis, value: number): void {
        this.apply("setAxis", [axis, value]);
        this._axes.set(`p${axis.player}:${axis.kind}`, { axis, value });
    }

    // INSTANCE :: VOID -> VOID
    // Records the call
    pause(): void {
        this.apply("pause", []);
    }

    // INSTANCE :: VOID -> VOID
    // Records the call
    resume(): void {
        this.apply("resume", []);
    }

    // INSTANCE :: "soft" | "hard" -> VOID
    // Records the call
    reset(kind: "soft" | "hard"): void {
        this.apply("reset", [kind]);
    }

    // INSTANCE :: STRING -> PROMISE(VOID)
    // Records the call; resolves unless scripted otherwise
    saveState(slot: string): Promise<void> {
        return this.applyAsync("saveState", [slot], undefined) as Promise<void>;
    }

    // INSTANCE :: STRING -> PROMISE(VOID)
    // Records the call; resolves unless scripted otherwise
    loadState(slot: string): Promise<void> {
        return this.applyAsync("loadState", [slot], undefined) as Promise<void>;
    }

    // INSTANCE :: VOID -> PROMISE(Uint8Array?)
    // Records the call; resolves with the scripted value, or null when unscripted
    persist(): Promise<Uint8Array | null> {
        return this.applyAsync("persist", [], null) as Promise<Uint8Array | null>;
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Records the call; resolves unless scripted otherwise
    exit(): Promise<void> {
        return this.applyAsync("exit", [], undefined) as Promise<void>;
    }

    // INSTANCE :: (VOID -> VOID) -> unsubscribe
    // Subscribes to emitTick
    onTick(listener: Listener<void>): Unsubscribe {
        this._tickListeners.add(listener);
        return () => { this._tickListeners.delete(listener); };
    }

    // INSTANCE :: (frameEvent -> VOID) -> unsubscribe
    // Subscribes to emitFrame
    onFrame(listener: Listener<FrameEvent>): Unsubscribe {
        this._frameListeners.add(listener);
        return () => { this._frameListeners.delete(listener); };
    }

    // INSTANCE :: (soundEvent -> VOID) -> unsubscribe
    // Subscribes to emitSound
    onSound(listener: Listener<SoundEvent>): Unsubscribe {
        this._soundListeners.add(listener);
        return () => { this._soundListeners.delete(listener); };
    }

    // INSTANCE :: (VOID -> VOID) -> unsubscribe
    // Subscribes to emitExit
    onExit(listener: Listener<void>): Unsubscribe {
        this._exitListeners.add(listener);
        return () => { this._exitListeners.delete(listener); };
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: STRING, [UNKNOWN] -> VOID
    // Records a synchronous call and throws when the method is scripted to throw
    private apply(method: string, args: ReadonlyArray<unknown>): void {
        this.calls.push({ method, args });
        const script = this._scripts.get(method);
        if (script !== undefined && script.mode === "throw") throw script.value;
    }

    // PRIVATE :: STRING, [UNKNOWN], UNKNOWN -> PROMISE(UNKNOWN)
    // Records an asynchronous call and settles per its script, defaulting to resolve with fallback
    private applyAsync(method: string, args: ReadonlyArray<unknown>, fallback: unknown): Promise<unknown> {
        this.calls.push({ method, args });
        const script = this._scripts.get(method);
        if (script === undefined) return Promise.resolve(fallback);
        if (script.mode === "throw") throw script.value;
        if (script.mode === "reject") return Promise.reject(script.value);
        return Promise.resolve(script.value ?? fallback);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: machineInfo? -> fakeArcadeSession
    // Mirrors the constructor
    static init(machine?: MachineInfo): FakeArcadeSession {
        return new FakeArcadeSession(machine);
    }
}
