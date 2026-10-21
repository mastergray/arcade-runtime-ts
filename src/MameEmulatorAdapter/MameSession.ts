// realizes: docs/arcade-runtime-spec.md > §5 MameEmulatorAdapter session behavior

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed lifecycle, state and argument failures
import OverlayCodec, { type OverlayHeader, type OverlayTree } from "./OverlayCodec.js";   // Cumulative persistence codec and hash
import {
    arcadeControlKey,                                             // Canonical control-to-bridge lookup key
    isArcadeControl,                                              // Guards session input calls
} from "../shared.types.js";

// Type dependencies:
import type {
    ArcadeControl,                                                // Input vocabulary mapped to web-pad items
    ArcadeSession,                                                // Contract this session implements
    FrameEvent,                                                   // Copied video callback payload
    FrameScheduler,                                               // Injected animation-frame boundary
    Listener,                                                     // Event subscriber
    MachineInfo,                                                  // Discovered running-machine metadata
    SoundEvent,                                                   // Copied stereo callback payload
    Unsubscribe,                                                  // Subscription remover
} from "../shared.types.js";
import type { MameClock } from "./types.js";                      // Injected monotonic millisecond clock

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: MEMFS subset used by session persistence.
interface MameFileSystem {
    mkdirTree(path: string): void;                                // Creates a directory and missing parents
    writeFile(path: string, bytes: Uint8Array): void;             // Writes a complete binary file
    readFile(path: string, options?: { readonly encoding?: "binary" }): Uint8Array | string;   // Reads a complete file
    readdir(path: string): string[];                              // Directory names including . and ..
    stat(path: string): { readonly mode: number };                // File mode used with isDir
    isDir(mode: number): boolean;                                 // True when stat mode is a directory
}

// INTERFACE :: private structural subset of the instantiated Emscripten module.
// This type deliberately is not exported from the package.
interface MameModule {
    readonly FS: MameFileSystem;                                  // MEMFS API
    readonly HEAPU8: Uint8Array;                                  // Current byte heap view
    readonly HEAPF32: Float32Array;                               // Current float heap view
    cwrap(name: string, returnType: string | null, argumentTypes: readonly string[]): (...args: Array<number | string>) => number | void;
}

// INTERFACE :: adapter-to-session callback target behind Module.web.
export interface MameWebCallbacks {
    abort?(): void;
    receiveTick(): void;
    receiveFrame(pointer: number, width: number, height: number): void;
    receiveSound(pointer: number, frames: number): void;
    receiveStateDone(ok: number): void;
    receiveExit(): void;
}

// INTERFACE :: internal construction dependencies for one live session.
export interface MameSessionConfig {
    readonly module: object;                                      // Fresh structurally validated module instance
    readonly machine: MachineInfo;                                // Metadata read after callMain
    readonly sampleRate: number;                                  // Configured mixer rate
    readonly scheduler: FrameScheduler;                           // Injected pacing scheduler
    readonly clock: MameClock;                                    // Injected monotonic clock
    readonly overlayHeader: OverlayHeader;                        // Persistence identity
    readonly initialSnapshot: string;                             // Hash captured when the first valid frame establishes the session
    readonly ignoredPaths: ReadonlyArray<string>;                 // Generated files excluded from dirty detection
    readonly dropModule: () => void;                              // Clears Module.web routing on terminal cleanup
}

// INTERFACE :: one pending bridge state operation.
interface PendingState {
    readonly operation: "save" | "load";                         // Operation used in failure text
    readonly resolve: () => void;                                 // Promise completion
    readonly reject: (reason: unknown) => void;                   // Promise rejection
}

/**
 *
 * Constants
 *
 */

const ROOT_PATHS = {
    nvram: "/mame/nvram",
    cfg: "/mame/cfg",
    states: "/mame/sta",
    memcard: "/mame/memcard",
} as const;                                                       // Wire roots to adapter-owned MEMFS locations

const CONTROL_ITEMS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
    "p1:direction:up": [0, 0], "p1:direction:down": [0, 1], "p1:direction:left": [0, 2], "p1:direction:right": [0, 3],
    "p2:direction:up": [1, 0], "p2:direction:down": [1, 1], "p2:direction:left": [1, 2], "p2:direction:right": [1, 3],
    "p3:direction:up": [2, 0], "p3:direction:down": [2, 1], "p3:direction:left": [2, 2], "p3:direction:right": [2, 3],
    "p4:direction:up": [3, 0], "p4:direction:down": [3, 1], "p4:direction:left": [3, 2], "p4:direction:right": [3, 3],
    ...Object.fromEntries(Array.from({ length: 4 }, (_, player) => Array.from({ length: 6 }, (_, button) => [
        `p${player + 1}:button:${button + 1}`, [player, button + 4] as const,
    ])).flat()),
    ...Object.fromEntries(Array.from({ length: 4 }, (_, player) => [
        [`p${player + 1}:coin`, [player, 10] as const],
        [`p${player + 1}:start`, [player, 11] as const],
        [`p${player + 1}:select`, [player, 12] as const],
    ]).flat()),
    service: [0, 13],
    test: [0, 14],
    tilt: [0, 15],
});                                                               // §4.3.1 item order, indexed through arcadeControlKey

/**
 *
 * Functions
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// Narrows the private module subset without exporting its type.
const isMameModule = (value: unknown): value is MameModule => {
    if (typeof value !== "object" || value === null) return false;
    const module = value as MameModule;
    const fs = module.FS;
    return typeof fs === "object" && fs !== null
        && typeof fs.mkdirTree === "function"
        && typeof fs.writeFile === "function"
        && typeof fs.readFile === "function"
        && typeof fs.readdir === "function"
        && typeof fs.stat === "function"
        && typeof fs.isDir === "function"
        && module.HEAPU8 instanceof Uint8Array
        && module.HEAPF32 instanceof Float32Array
        && typeof module.cwrap === "function";
};

// HELPER :: STRING -> STRING
// Returns a logical path's parent without importing a Node-only path module.
const parentPath = (path: string): string => path.slice(0, path.lastIndexOf("/"));

// HELPER :: mameModule, overlayTree -> VOID
// Restores a validated logical overlay into its physical MEMFS roots.
export const restoreOverlayTree = (moduleValue: object, tree: OverlayTree): void => {
    if (!isMameModule(moduleValue)) throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
        message: "The MAME module does not expose the required MEMFS and heap surface.",
        data: null,
    });
    for (const [logical, bytes] of Object.entries(tree)) {
        const slash = logical.indexOf("/");
        const root = logical.slice(0, slash) as keyof typeof ROOT_PATHS;
        const relative = logical.slice(slash + 1);
        const physical = `${ROOT_PATHS[root]}/${relative}`;
        moduleValue.FS.mkdirTree(parentPath(physical));
        moduleValue.FS.writeFile(physical, bytes.slice());
    }
};

// HELPER :: mameModule, [STRING] -> overlayTree
// Walks every persisted root recursively and copies bytes, excluding adapter-generated logical paths.
const persistedTreeOf = (module: MameModule, ignoredPaths: ReadonlySet<string>): Record<string, Uint8Array> => {
    const tree: Record<string, Uint8Array> = {};
    const visit = (logicalRoot: string, physicalRoot: string, relative = ""): void => {
        const directory = relative === "" ? physicalRoot : `${physicalRoot}/${relative}`;
        for (const name of module.FS.readdir(directory)) {
            if (name === "." || name === "..") continue;
            const childRelative = relative === "" ? name : `${relative}/${name}`;
            const physical = `${physicalRoot}/${childRelative}`;
            if (module.FS.isDir(module.FS.stat(physical).mode)) visit(logicalRoot, physicalRoot, childRelative);
            else {
                const logical = `${logicalRoot}/${childRelative}`;
                if (ignoredPaths.has(logical)) continue;
                const read = module.FS.readFile(physical, { encoding: "binary" });
                if (!(read instanceof Uint8Array)) throw new Error(`MEMFS returned text for ${logical}`);
                tree[logical] = read.slice();
            }
        }
    };
    for (const [logical, physical] of Object.entries(ROOT_PATHS)) visit(logical, physical);
    return tree;
};

// HELPER :: mameModule, [STRING] -> STRING
// Captures the dirty-detection snapshot without exporting the private module type.
export const snapshotPersistedTree = (moduleValue: object, ignoredPaths: ReadonlyArray<string>): string => {
    if (!isMameModule(moduleValue)) throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
        message: "The MAME module does not expose the required persistence surface.",
        data: null,
    });
    return OverlayCodec.hashTree(persistedTreeOf(moduleValue, new Set(ignoredPaths)));
};

// HELPER :: UNKNOWN -> arcadeRuntimeError
// Standard invalid session-argument rejection.
const invalid = (data: unknown): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
    message: "The MAME session method received an invalid argument.",
    data,
});

/**
 *
 * Class
 *
 */

// One live direct-MAME session: bridge calls, pacing, copied events and cumulative persistence.
export default class MameSession implements ArcadeSession, MameWebCallbacks {

    /* Instance Fields */
    readonly machine: MachineInfo;                                // Discovered running-machine metadata
    readonly sampleRate: number;                                  // Configured stereo sample rate
    private _module: MameModule | null;                            // Dropped on exit or startup abort
    private readonly _scheduler: FrameScheduler;                  // Browser/test frame scheduler
    private readonly _clock: MameClock;                           // Browser/test monotonic clock
    private readonly _overlayHeader: OverlayHeader;               // Strict persistence identity
    private readonly _ignoredPaths: ReadonlySet<string>;          // Generated files omitted from snapshots
    private readonly _dropModule: () => void;                     // Clears the callback router
    private readonly _runFrames: (count: number) => number;       // Advances complete primary-screen periods
    private readonly _pump: () => void;                           // Redraws OSD while paused
    private readonly _setControl: (pad: number, item: number, pressed: number) => void;
    private readonly _webPause: () => void;
    private readonly _webResume: () => void;
    private readonly _webReset: (hard: number) => void;
    private readonly _webSaveState: (slot: string) => void;
    private readonly _webLoadState: (slot: string) => void;
    private readonly _flushNvram: () => number;
    private readonly _webExit: () => void;
    private readonly _tickListeners = new Set<Listener<void>>();
    private readonly _frameListeners = new Set<Listener<FrameEvent>>();
    private readonly _soundListeners = new Set<Listener<SoundEvent>>();
    private readonly _exitListeners = new Set<Listener<void>>();
    private _frameBuffer = new Uint8ClampedArray(0);               // Reused copy, never a heap view
    private _soundBuffer = new Float32Array(0);                   // Reused copy, never a heap view
    private _snapshot: string;                                    // Dirty-detection hash advanced by persist
    private _schedulerHandle: number | null = null;               // Pending animation-frame callback
    private _lastTime = 0;                                        // Clock sample at the previous scheduler tick
    private _accumulator = 0;                                     // Fractional native periods in milliseconds
    private _paused = false;                                      // Pump-only pacing state
    private _destroyed = false;                                   // Terminal lifecycle state
    private _pendingState: PendingState | null = null;            // At most one save/load operation
    private _exitPromise: Promise<void> | null = null;             // In-flight explicit exit
    private _resolveExit: (() => void) | null = null;              // Completes _exitPromise from onExit

    // CONSTRUCTOR :: mameSessionConfig -> this
    // Wraps a mounted, started module and snapshots restored persistence before pacing begins.
    constructor(config: MameSessionConfig) {
        if (!isMameModule(config.module)) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
            message: "The MAME module does not expose the required runtime methods.",
            data: null,
        });
        this.machine = config.machine;
        this.sampleRate = config.sampleRate;
        this._module = config.module;
        this._scheduler = config.scheduler;
        this._clock = config.clock;
        this._overlayHeader = config.overlayHeader;
        this._ignoredPaths = new Set(config.ignoredPaths);
        this._dropModule = config.dropModule;
        const wrapped = config.module.cwrap.bind(config.module);
        this._runFrames = wrapped("web_run_frames", "number", ["number"]) as (count: number) => number;
        this._pump = wrapped("web_pump", null, []) as () => void;
        this._setControl = wrapped("web_set_control", null, ["number", "number", "number"]) as (pad: number, item: number, pressed: number) => void;
        this._webPause = wrapped("web_pause", null, []) as () => void;
        this._webResume = wrapped("web_resume", null, []) as () => void;
        this._webReset = wrapped("web_reset", null, ["number"]) as (hard: number) => void;
        this._webSaveState = wrapped("web_save_state", null, ["string"]) as (slot: string) => void;
        this._webLoadState = wrapped("web_load_state", null, ["string"]) as (slot: string) => void;
        this._flushNvram = wrapped("web_flush_nvram", "number", []) as () => number;
        this._webExit = wrapped("web_exit", null, []) as () => void;
        this._snapshot = config.initialSnapshot;
    }

    /**
     *
     * Instance Methods: lifecycle and control
     *
     */

    // INSTANCE :: VOID -> VOID
    // Starts the animation-frame request chain once startup has installed callback routing.
    begin(): void {
        this.assertLive();
        if (this._schedulerHandle !== null) return;
        this._lastTime = this._clock();
        this._schedulerHandle = this._scheduler.request(() => this.schedulerTick());
    }

    // INSTANCE :: arcadeControl, BOOLEAN -> VOID
    // Maps the canonical control key to bridge pad/item indices, ignoring unavailable machine ports.
    setControl(control: ArcadeControl, pressed: boolean): void {
        this.assertLive();
        if (!isArcadeControl(control) || typeof pressed !== "boolean") throw invalid({ control, pressed });
        if ("player" in control && control.player > this.machine.players) return;
        if (control.kind === "button" && control.button > this.machine.buttons) return;
        if (control.kind === "select") return;                    // M1 MachineInfo has no select-port field; enabled by W16
        const mapped = CONTROL_ITEMS[arcadeControlKey(control)];
        if (mapped !== undefined) this._setControl(mapped[0], mapped[1], pressed ? 1 : 0);
    }

    // INSTANCE :: VOID -> VOID
    // Pauses MAME and switches scheduler ticks to web_pump.
    pause(): void {
        this.assertLive();
        if (this._paused) return;
        this._paused = true;
        this._accumulator = 0;
        this._lastTime = this._clock();
        this._webPause();
    }

    // INSTANCE :: VOID -> VOID
    // Resumes MAME with an empty accumulator so paused wall time never catches up.
    resume(): void {
        this.assertLive();
        if (!this._paused) return;
        this._webResume();
        this._paused = false;
        this._accumulator = 0;
        this._lastTime = this._clock();
    }

    // INSTANCE :: "soft"|"hard" -> VOID
    // Schedules soft reset; hard reset belongs to ArcadePlayer as exit plus a fresh start.
    reset(kind: "soft" | "hard"): void {
        this.assertLive();
        if (kind !== "soft" && kind !== "hard") throw invalid(kind);
        if (kind === "hard") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "Hard reset requires exiting and starting a fresh MAME module.",
            data: kind,
        });
        this._webReset(0);
    }

    // INSTANCE :: STRING -> PROMISE(VOID)
    // Schedules one state write and resolves from onStateDone.
    saveState(slot: string): Promise<void> {
        return this.scheduleState("save", slot);
    }

    // INSTANCE :: STRING -> PROMISE(VOID)
    // Schedules one state read and resolves from onStateDone.
    loadState(slot: string): Promise<void> {
        return this.scheduleState("load", slot);
    }

    // INSTANCE :: VOID -> PROMISE(UINT8ARRAY?)
    // Flushes NVRAM and returns a standalone cumulative overlay only when the tree changed.
    async persist(): Promise<Uint8Array | null> {
        this.assertLive();
        try {
            if (this._flushNvram() !== 0) throw new Error("web_flush_nvram returned failure");
            const tree = this.persistedTree();
            const hash = OverlayCodec.hashTree(tree);
            if (hash === this._snapshot) return null;
            const encoded = OverlayCodec.encode(tree, this._overlayHeader);
            this._snapshot = hash;
            return encoded;
        } catch (error) {
            if (ArcadeRuntimeError.is(error)) throw error;
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "MAME persistence failed.",
                data: error,
            });
        }
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Schedules bridge exit and completes only after onExit has flushed and stopped the machine.
    exit(): Promise<void> {
        this.assertLive();
        if (this._exitPromise !== null) return this._exitPromise;
        this._exitPromise = new Promise<void>((resolve) => { this._resolveExit = resolve; });
        try {
            this._webExit();
        } catch (error) {
            this._exitPromise = null;
            this._resolveExit = null;
            return Promise.reject(new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "MAME exit could not be scheduled.",
                data: error,
            }));
        }
        return this._exitPromise;
    }

    // INSTANCE :: VOID -> VOID
    // Drops a partially started session without reporting a public onExit event.
    abort(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this.cancelScheduler();
        this.rejectPendingState("The MAME session was destroyed during a state operation.");
        this.clearListeners();
        this._module = null;
        this._dropModule();
    }

    /**
     *
     * Instance Methods: subscriptions
     *
     */

    // INSTANCE :: listener(VOID) -> unsubscribe
    onTick(listener: Listener<void>): Unsubscribe { return this.subscribe(this._tickListeners, listener); }

    // INSTANCE :: listener(frameEvent) -> unsubscribe
    onFrame(listener: Listener<FrameEvent>): Unsubscribe { return this.subscribe(this._frameListeners, listener); }

    // INSTANCE :: listener(soundEvent) -> unsubscribe
    onSound(listener: Listener<SoundEvent>): Unsubscribe { return this.subscribe(this._soundListeners, listener); }

    // INSTANCE :: listener(VOID) -> unsubscribe
    onExit(listener: Listener<void>): Unsubscribe { return this.subscribe(this._exitListeners, listener); }

    /**
     *
     * Instance Methods: Module.web callbacks
     *
     */

    // INSTANCE :: VOID -> VOID
    // Fans one emulated-frame tick out to current subscribers.
    receiveTick(): void {
        if (this._destroyed) return;
        for (const listener of this._tickListeners) listener(undefined);
    }

    // INSTANCE :: NUMBER, NUMBER, NUMBER -> VOID
    // Copies the transient byte heap view into a reused RGBA buffer before notifying listeners.
    receiveFrame(pointer: number, width: number, height: number): void {
        const module = this._module;
        if (this._destroyed || module === null) return;
        const length = width * height * 4;
        if (!Number.isSafeInteger(length) || width <= 0 || height <= 0 || pointer < 0 || pointer + length > module.HEAPU8.length) return;
        if (this._frameBuffer.length !== length) this._frameBuffer = new Uint8ClampedArray(length);
        this._frameBuffer.set(module.HEAPU8.subarray(pointer, pointer + length));
        const event: FrameEvent = { width, height, rgba: this._frameBuffer };
        for (const listener of this._frameListeners) listener(event);
    }

    // INSTANCE :: NUMBER, NUMBER -> VOID
    // Copies the transient float heap view into a reused stereo buffer before notifying listeners.
    receiveSound(pointer: number, frames: number): void {
        const module = this._module;
        if (this._destroyed || module === null) return;
        const start = pointer / 4;
        const length = frames * 2;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || frames < 0 || start + length > module.HEAPF32.length) return;
        if (this._soundBuffer.length !== length) this._soundBuffer = new Float32Array(length);
        this._soundBuffer.set(module.HEAPF32.subarray(start, start + length));
        const event: SoundEvent = { samples: this._soundBuffer, frames };
        for (const listener of this._soundListeners) listener(event);
    }

    // INSTANCE :: NUMBER -> VOID
    // Completes the sole scheduled state operation.
    receiveStateDone(ok: number): void {
        const pending = this._pendingState;
        if (pending === null) return;
        this._pendingState = null;
        if (ok !== 0) pending.resolve();
        else pending.reject(new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.STATE_FAILED,
            message: `MAME ${pending.operation} state operation failed.`,
            data: pending.operation,
        }));
    }

    // INSTANCE :: VOID -> VOID
    // Performs terminal cleanup, notifies exit subscribers once and resolves explicit exit().
    receiveExit(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this.cancelScheduler();
        this.rejectPendingState("The MAME session exited during a state operation.");
        const listeners = [...this._exitListeners];
        this.clearListeners();
        this._module = null;
        this._dropModule();
        for (const listener of listeners) listener(undefined);
        const resolve = this._resolveExit;
        this._resolveExit = null;
        resolve?.();
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Advances native periods with a four-period cap, or pumps once while paused.
    private schedulerTick(): void {
        this._schedulerHandle = null;
        if (this._destroyed) return;
        const now = this._clock();
        const elapsed = Math.max(0, now - this._lastTime);
        this._lastTime = now;
        if (this._paused) {
            this._pump();
        } else {
            const period = 1000 / this.machine.refreshHz;
            this._accumulator += elapsed;
            const periods = Math.floor(this._accumulator / period + 1e-9);   // Stabilize exact host/native boundaries against binary rounding
            if (periods > 0) {
                this._runFrames(Math.min(periods, 4));
                this._accumulator -= periods * period;             // Fraction stays; whole periods beyond four are discarded
                if (Math.abs(this._accumulator) < 1e-9) this._accumulator = 0;
            }
        }
        if (!this._destroyed) this._schedulerHandle = this._scheduler.request(() => this.schedulerTick());
    }

    // PRIVATE :: "save"|"load", STRING -> PROMISE(VOID)
    // Validates the logical slot and enforces one pending operation.
    private scheduleState(operation: "save" | "load", slot: string): Promise<void> {
        this.assertLive();
        if (typeof slot !== "string" || !/^[A-Za-z0-9_-]+$/.test(slot)) return Promise.reject(invalid(slot));
        if (this._pendingState !== null) return Promise.reject(new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.STATE_FAILED,
            message: "Only one MAME state operation may be pending.",
            data: operation,
        }));
        const promise = new Promise<void>((resolve, reject) => { this._pendingState = { operation, resolve, reject }; });
        try {
            if (operation === "save") this._webSaveState(slot);
            else this._webLoadState(slot);
        } catch (error) {
            this._pendingState = null;
            return Promise.reject(new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.STATE_FAILED,
                message: `MAME ${operation} state operation could not be scheduled.`,
                data: error,
            }));
        }
        return promise;
    }

    // PRIVATE :: Set<listener(T)>, listener(T) -> unsubscribe
    // Validates, registers and returns an idempotent removal closure.
    private subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>): Unsubscribe {
        this.assertLive();
        if (typeof listener !== "function") throw invalid(listener);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }

    // PRIVATE :: VOID -> overlayTree
    // Walks every persisted root recursively and copies bytes, excluding adapter-generated files.
    private persistedTree(): Record<string, Uint8Array> {
        const module = this._module;
        if (module === null) return {};
        return persistedTreeOf(module, this._ignoredPaths);
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after terminal exit or startup abort.
    private assertLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "The MAME session has exited.",
            data: null,
        });
    }

    // PRIVATE :: VOID -> VOID
    // Cancels the sole outstanding scheduler request.
    private cancelScheduler(): void {
        if (this._schedulerHandle !== null) this._scheduler.cancel(this._schedulerHandle);
        this._schedulerHandle = null;
    }

    // PRIVATE :: STRING -> VOID
    // Rejects and clears an in-flight state promise during teardown.
    private rejectPendingState(message: string): void {
        const pending = this._pendingState;
        this._pendingState = null;
        pending?.reject(new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.STATE_FAILED, message, data: pending.operation }));
    }

    // PRIVATE :: VOID -> VOID
    // Drops all public subscriptions.
    private clearListeners(): void {
        this._tickListeners.clear();
        this._frameListeners.clear();
        this._soundListeners.clear();
        this._exitListeners.clear();
    }
}
