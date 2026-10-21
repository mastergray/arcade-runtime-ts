// realizes: docs/arcade-runtime-spec.md > §10.6 ArcadeCabinet (predicates, lifecycle, persistence and ROM-store composition)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeCabinet from "../../src/ArcadeCabinet/ArcadeCabinet.ts";   // Composition root under test
import {
    isArcadeCabinetConfig,
    isArcadeCabinetInitConfig,
    isArcadeControlsConfig,
} from "../../src/ArcadeCabinet/types.ts";                       // Public structural predicates
import ArcadePlayer from "../../src/ArcadePlayer/ArcadePlayer.ts";   // Resolved player dependency
import ArcadeRomStore from "../../src/ArcadeRomStore/ArcadeRomStore.ts";   // Real local ROM persistence
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed failure identity
import ArcadeStorage from "../../src/ArcadeStorage/ArcadeStorage.ts";   // Real overlay persistence
import FakeArcadeAdapter from "../support/FakeArcadeAdapter.ts"; // Required adapter double
import FakeArcadeSession from "../support/FakeArcadeSession.ts"; // Required session double
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts";   // Required gamepad scheduler double
import FailingIndexedDB from "../support/FailingIndexedDB.ts";   // Scriptable in-memory IDBFactoryLike
import { errorSnapshot, rejectedBy, thrownBy } from "../support/fixtures.ts";   // Stable error captures

// Type dependencies:
import type { ArcadeCabinetConfig, ArcadeControlsConfig } from "../../src/ArcadeCabinet/types.ts";   // Config fixtures
import type { ArcadeGameConfig } from "../../src/ArcadePlayer/types.ts";   // Game fixture
import type { AudioContextLike } from "../../src/ArcadeAudio/types.ts";   // Structural Web Audio double
import type { GamepadLike, GamepadProviderLike } from "../../src/GamepadSource/types.ts";   // Empty provider boundary
import type { KeyboardVisibilityTargetLike } from "../../src/KeyboardSource/types.ts";   // Fake event target contract
import type { ArcadeControlKey, RomFile } from "../../src/shared.types.ts";   // Snapshot and source fixtures
import type { ErrorSnapshot } from "../support/fixtures.ts";      // Typed-error snapshot
import type { TestFile } from "../run.ts";                       // Test manifest shape

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: cabinet test rig over a real player and W0 doubles.
interface CabinetRig {
    readonly adapter: FakeArcadeAdapter;                           // Scripted player backend
    readonly session: FakeArcadeSession;                           // Current running-session double
    readonly target: FakeEventTarget;                              // Shared keyboard/blur/visibility boundary
    readonly provider: EmptyGamepadProvider;                       // Empty but structurally real provider
    readonly scheduler: FakeFrameScheduler;                        // Deterministic poll clock
    readonly player: ArcadePlayer;                                // Resolved player given to the cabinet
    readonly cabinet: ArcadeCabinet;                              // Subject under test
}

// INTERFACE :: mutable global AudioContext slot replaced during start cases.
interface AudioContextGlobal {
    AudioContext?: typeof AudioContext;
}

/**
 *
 * Classes
 *
 */

// Structural canvas/context double used by the real player display.
class CanvasDouble {
    width = 300;
    height = 150;
    readonly style: Record<string, string> = {};
    readonly context = {
        clearRect: (): void => undefined,
        createImageData: (width: number, height: number): ImageData => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData,
        putImageData: (): void => undefined,
    };

    // INSTANCE :: STRING -> canvasRenderingContext2D
    // Returns the structural 2D context for every request.
    getContext(_kind: string): CanvasRenderingContext2D {
        return this.context as unknown as CanvasRenderingContext2D;
    }
}

// Structural container double used for display layout and audio gesture listeners.
class ContainerDouble {
    readonly listeners = new Map<string, Set<(event: Event) => void>>();

    // INSTANCE :: VOID -> domRect
    // Supplies a stable landscape content rectangle.
    getBoundingClientRect(): DOMRect {
        return { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
    }

    // INSTANCE :: STRING, listener -> VOID
    // Adds one listener to the structural event boundary.
    addEventListener(type: string, listener: (event: Event) => void): void {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    // INSTANCE :: STRING, listener -> VOID
    // Removes one listener from the structural event boundary.
    removeEventListener(type: string, listener: (event: Event) => void): void {
        this.listeners.get(type)?.delete(listener);
    }
}

// Minimal AudioContext implementation sufficient for real ArcadeAudio construction and teardown.
class CabinetAudioContext implements AudioContextLike {
    state: AudioContextLike["state"] = "suspended";
    readonly sampleRate: number;
    currentTime = 0;
    readonly destination = {} as AudioNode;

    // CONSTRUCTOR :: audioContextOptions? -> this
    // Honors the requested session sample rate.
    constructor(options?: AudioContextOptions) {
        this.sampleRate = options?.sampleRate ?? 48000;
    }

    async resume(): Promise<void> { this.state = "running"; }
    async close(): Promise<void> { this.state = "closed"; }

    createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
            numberOfChannels: channels,
            length,
            sampleRate,
            duration: length / sampleRate,
            getChannelData: (channel: number): Float32Array => data[channel] ?? new Float32Array(),
        } as unknown as AudioBuffer;
    }

    createBufferSource(): AudioBufferSourceNode {
        return { connect: (node: AudioNode): AudioNode => node, start(): void {}, stop(): void {}, onended: null, buffer: null } as unknown as AudioBufferSourceNode;
    }

    createGain(): GainNode {
        return { gain: { value: 1 }, connect: (node: AudioNode): AudioNode => node } as unknown as GainNode;
    }
}

// Minimal event target with mutable visibility and listener-count inspection.
class FakeEventTarget implements KeyboardVisibilityTargetLike {
    visibilityState = "visible";
    private readonly _listeners = new Map<string, Set<(event: Event) => void>>();

    // INSTANCE :: STRING, listener -> VOID
    // Adds one listener idempotently.
    addEventListener(type: string, listener: (event: Event) => void): void {
        const listeners = this._listeners.get(type) ?? new Set();
        listeners.add(listener);
        this._listeners.set(type, listeners);
    }

    // INSTANCE :: STRING, listener -> VOID
    // Removes one listener when present.
    removeEventListener(type: string, listener: (event: Event) => void): void {
        this._listeners.get(type)?.delete(listener);
    }

    // INSTANCE :: STRING, OBJECT? -> VOID
    // Delivers one structural Event/KeyboardEvent to a stable listener snapshot.
    dispatch(type: string, fields: Record<string, unknown> = {}): void {
        const event = { type, preventDefault: () => undefined, ...fields } as unknown as Event;
        for (const listener of [...(this._listeners.get(type) ?? [])]) listener(event);
    }

    // INSTANCE :: VOID -> NUMBER
    // Returns the total number of active listeners across all event types.
    get listenerCount(): number {
        return [...this._listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
    }
}

// Provider returning no connected pads; assignment behavior belongs to GamepadSource's own suite.
class EmptyGamepadProvider implements GamepadProviderLike {
    getGamepads(): ReadonlyArray<GamepadLike | null> { return []; }
}

// Scheduler whose first attachment fails after the keyboard source has already attached.
class ThrowingFrameScheduler extends FakeFrameScheduler {
    override request(_callback: (time: number) => void): number {
        throw new Error("scheduler failed");
    }
}

/**
 *
 * Constants
 *
 */

const GAME_BYTES = new Uint8Array([1, 2, 3]);                    // Synthetic non-ROM archive bytes for metadata-unavailable audit
const INVALID_CONFIG: ErrorSnapshot = { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" };
const ROM_LOAD_FAILED: ErrorSnapshot = { isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED" };
const UNSUPPORTED: ErrorSnapshot = { isRuntimeError: true, code: 15, label: "UNSUPPORTED" };
const OVERLAY_INCOMPATIBLE: ErrorSnapshot = { isRuntimeError: true, code: 16, label: "OVERLAY_INCOMPATIBLE" };

/**
 *
 * Functions
 *
 */

// HELPER :: [romSource]? -> arcadeGameConfig
// Complete valid game config used by direct and init cases.
const gameConfig = (roms: ArcadeGameConfig["roms"] = [{ name: "fixture.zip", bytes: GAME_BYTES }]): ArcadeGameConfig => ({
    machine: "fake",
    machineHints: { players: 2, buttons: 6 },
    roms,
});

// HELPER :: arcadeControlsConfig?, options? -> cabinetRig
// Constructs the real player and cabinet over injected doubles only.
const rig = (controls?: ArcadeControlsConfig, options: {
    readonly session?: FakeArcadeSession;
    readonly storage?: ArcadeStorage;
    readonly romStore?: ArcadeRomStore;
    readonly autosave?: boolean;
    readonly scheduler?: FakeFrameScheduler;
} = {}): CabinetRig => {
    const session = options.session ?? new FakeArcadeSession();
    const adapter = new FakeArcadeAdapter().script("resolve", session);
    const player = new ArcadePlayer({
        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
        container: new ContainerDouble() as unknown as HTMLElement,
        game: gameConfig(),
        adapter,
        fetch: async () => { throw new Error("unexpected fetch"); },
    });
    const target = new FakeEventTarget();
    const provider = new EmptyGamepadProvider();
    const scheduler = options.scheduler ?? new FakeFrameScheduler();
    const cabinet = new ArcadeCabinet({
        player,
        ...(controls === undefined ? {} : { controls }),
        keyboardTarget: target,
        eventTarget: target,
        visibilityTarget: target,
        gamepadProvider: provider,
        frameScheduler: scheduler,
        ...(options.storage === undefined ? {} : { storage: options.storage }),
        ...(options.romStore === undefined ? {} : { romStore: options.romStore }),
        ...(options.autosave === undefined ? {} : { autosave: options.autosave }),
    });
    return { adapter, session, target, provider, scheduler, player, cabinet };
};

// HELPER :: (VOID -> PROMISE(T)) -> PROMISE(T)
// Installs the structural AudioContext for one async stage and restores the prior global exactly.
const withAudioContext = async <T>(run: () => Promise<T>): Promise<T> => {
    const target = globalThis as unknown as AudioContextGlobal;
    const descriptor = Object.getOwnPropertyDescriptor(target, "AudioContext");
    Object.defineProperty(target, "AudioContext", { configurable: true, writable: true, value: CabinetAudioContext as unknown as typeof AudioContext });
    try {
        return await run();
    } finally {
        if (descriptor === undefined) delete target.AudioContext;
        else Object.defineProperty(target, "AudioContext", descriptor);
    }
};

// HELPER :: UNKNOWN -> errorSnapshot
// Captures the package error identity.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

// HELPER :: STRING -> arcadeStorage
// Builds real overlay storage over the scripted in-memory IndexedDB double.
const storage = (key: string): ArcadeStorage => new ArcadeStorage({ key, indexedDB: new FailingIndexedDB() });

// HELPER :: VOID -> arcadeRomStore
// Builds a real ROM store over the in-memory IDB double and deterministic injected SHA-256/time dependencies.
const romStore = (): ArcadeRomStore => new ArcadeRomStore({
    indexedDB: new FailingIndexedDB(),
    subtle: { digest: async () => new Uint8Array(32).buffer },
    now: () => 100,
});

// HELPER :: VOID -> PROMISE(VOID)
// Lets immediate async autosave continuations complete without wall-clock sleeps.
const settlePromises = async (): Promise<void> => {
    for (let turn = 0; turn < 12; turn++) await Promise.resolve();
};

const testFile: TestFile = {
    label: "ArcadeCabinet",
    cases: [
        {
            label: "config predicates accept desktop and structural touch declarations while construction rejects touch until M10",
            run: () => CTGTest.init("ArcadeCabinet predicates and touch gate")
                .stage("build complete configs and attempt touch construction", async () => {
                    const player = new ArcadePlayer({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: gameConfig(),
                        adapter: new FakeArcadeAdapter().script("resolve", new FakeArcadeSession()),
                        fetch: async () => { throw new Error("unexpected fetch"); },
                    });
                    const target = new FakeEventTarget();
                    const scheduler = new FakeFrameScheduler();
                    const provider = new EmptyGamepadProvider();
                    const surface = {
                        addEventListener: () => undefined,
                        removeEventListener: () => undefined,
                        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
                    };
                    const controls: ArcadeControlsConfig = {
                        keyboard: { enabled: true, map: {}, preventDefault: false },
                        gamepads: { enabled: false, deadZone: 0.4 },
                        buttons: [{ surface, control: { kind: "button", player: 1, button: 1 } }],
                        dpads: [{ surface, player: 1, deadZone: 0.2, diagonals: true }],
                        sticks: [{ surface, player: 2, deadZone: 0.1, radius: 40, threshold: 0.5 }],
                    };
                    const direct: ArcadeCabinetConfig = { player, controls, keyboardTarget: target, eventTarget: target, visibilityTarget: target, gamepadProvider: provider, frameScheduler: scheduler, autosave: true };
                    const init = {
                        canvas: new CanvasDouble(), container: new ContainerDouble(), game: gameConfig(), controls,
                        adapter: new FakeArcadeAdapter().script("resolve", new FakeArcadeSession()), fetch: async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }),
                    };
                    const result = {
                        controls: isArcadeControlsConfig(controls),
                        badKeyboard: isArcadeControlsConfig({ keyboard: { enabled: "yes" } }),
                        badGamepads: isArcadeControlsConfig({ gamepads: { deadZone: 1 } }),
                        badTouch: isArcadeControlsConfig({ buttons: [{ surface: {}, control: { kind: "test" } }] }),
                        direct: isArcadeCabinetConfig(direct),
                        missingKeyboardTarget: isArcadeCabinetConfig({ ...direct, keyboardTarget: undefined }),
                        init: isArcadeCabinetInitConfig(init),
                        bothAdapters: isArcadeCabinetInitConfig({ ...init, adapterConfig: { buildUrl: "/build/" } }),
                        touchError: errorOf(thrownBy(() => new ArcadeCabinet(direct))),
                    };
                    await player.destroy();
                    return result;
                })
                .assert("all public config predicates and the v1 touch rejection agree", (state) => state.subject, P.equals<unknown>({
                    controls: true,
                    badKeyboard: false,
                    badGamepads: false,
                    badTouch: false,
                    direct: true,
                    missingKeyboardTarget: false,
                    init: true,
                    bothAdapters: false,
                    touchError: UNSUPPORTED,
                }))
                .start(undefined),
        },
        {
            label: "start attaches both sources after the player, source gates persist across exit/restart, and natural exit removes listeners",
            run: () => CTGTest.init("ArcadeCabinet source lifecycle")
                .stage("disable before start, enable live, exit naturally and restart", () => withAudioContext(async () => {
                    const first = new FakeArcadeSession();
                    const setup = rig({ keyboard: {}, gamepads: {} }, { session: first });
                    setup.cabinet.keyboardEnabled = false;
                    setup.cabinet.gamepadsEnabled = false;
                    await setup.cabinet.start();
                    const disabled = {
                        started: setup.cabinet.isStarted,
                        keyboard: setup.cabinet.keyboard?.enabled,
                        gamepads: setup.cabinet.gamepads?.enabled,
                        playerStatus: setup.player.status,
                    };
                    setup.cabinet.keyboardEnabled = true;
                    setup.cabinet.gamepadsEnabled = true;
                    setup.target.dispatch("keydown", { code: "ArrowUp", repeat: false });
                    const defaultMapHeld = first.held.slice();
                    first.emitExit();
                    const afterExit = {
                        started: setup.cabinet.isStarted,
                        keyboardNull: setup.cabinet.keyboard === null,
                        gamepadsNull: setup.cabinet.gamepads === null,
                        listeners: setup.target.listenerCount,
                        pendingFrames: setup.scheduler.pending,
                        held: first.held.slice(),
                    };
                    const second = new FakeArcadeSession();
                    setup.adapter.script("resolve", second);
                    await setup.cabinet.start();
                    const restarted = {
                        keyboard: setup.cabinet.keyboard?.enabled,
                        gamepads: setup.cabinet.gamepads?.enabled,
                    };
                    setup.target.dispatch("keydown", { code: "ArrowRight", repeat: false });
                    await setup.cabinet.destroy();
                    await setup.cabinet.destroy();
                    const calls = second.calls.map((call) => call.method);
                    return { disabled, defaultMapHeld, afterExit, restarted, calls, listenersAfterDestroy: setup.target.listenerCount };
                }))
                .assert("the default map, teardown, remembered gates and idempotent destroy all hold", (state) => state.subject, P.equals<unknown>({
                    disabled: { started: true, keyboard: false, gamepads: false, playerStatus: "running" },
                    defaultMapHeld: ["p1:direction:up" as ArcadeControlKey],
                    afterExit: { started: false, keyboardNull: true, gamepadsNull: true, listeners: 0, pendingFrames: 0, held: [] },
                    restarted: { keyboard: true, gamepads: true },
                    calls: ["setControl", "setControl", "exit"],
                    listenersAfterDestroy: 0,
                }))
                .start(undefined),
        },
        {
            label: "a failure after one source attaches tears every source down, exits the started player and rejects with the typed error",
            run: () => CTGTest.init("ArcadeCabinet partial source cleanup")
                .stage("make the gamepad scheduler throw after keyboard attachment", () => withAudioContext(async () => {
                    const session = new FakeArcadeSession();
                    const setup = rig({ keyboard: {}, gamepads: {} }, { session, scheduler: new ThrowingFrameScheduler() });
                    const error = errorOf(await rejectedBy(setup.cabinet.start()));
                    await setup.cabinet.destroy();
                    return {
                        error,
                        playerStatus: setup.player.status,
                        started: setup.cabinet.isStarted,
                        keyboardNull: setup.cabinet.keyboard === null,
                        gamepadsNull: setup.cabinet.gamepads === null,
                        listeners: setup.target.listenerCount,
                        exits: session.calls.filter((call) => call.method === "exit").length,
                    };
                }))
                .assert("no partial source, listener or player session survives", (state) => state.subject, P.equals<unknown>({
                    error: { isRuntimeError: true, code: 3, label: "INTERNAL_ERROR" },
                    playerStatus: "destroyed",
                    started: false,
                    keyboardNull: true,
                    gamepadsNull: true,
                    listeners: 0,
                    exits: 1,
                }))
                .start(undefined),
        },
        {
            label: "save, quickSave, autosave and clearSaves use overlay storage while null persistence and absent storage follow their contracts",
            run: () => CTGTest.init("ArcadeCabinet overlay persistence")
                .stage("exercise explicit, quick, hidden and unsupported persistence paths", () => withAudioContext(async () => {
                    const saves = storage("cabinet-saves");
                    const session = new FakeArcadeSession().script("persist", "resolve", new Uint8Array([7, 8]));
                    const setup = rig(undefined, { session, storage: saves, autosave: true });
                    await setup.cabinet.start();
                    const saved = await setup.cabinet.save();
                    const first = Array.from((await saves.load()) ?? []);
                    session.script("persist", "resolve", null);
                    const unchanged = await setup.cabinet.save();
                    const stillFirst = Array.from((await saves.load()) ?? []);
                    session.script("persist", "resolve", new Uint8Array([9]));
                    await setup.cabinet.quickSave("slot-a");
                    const quick = Array.from((await saves.load()) ?? []);
                    session.script("persist", "resolve", new Uint8Array([4, 5]));
                    setup.target.visibilityState = "hidden";
                    setup.target.dispatch("visibilitychange");
                    await settlePromises();
                    const automatic = Array.from((await saves.load()) ?? []);
                    await setup.cabinet.clearSaves();
                    const cleared = await saves.load();
                    const calls = session.calls.map((call) => [call.method, ...call.args]);
                    await setup.cabinet.destroy();

                    const without = rig(undefined);
                    await without.cabinet.start();
                    const noSave = errorOf(await rejectedBy(without.cabinet.save()));
                    const noClear = errorOf(await rejectedBy(without.cabinet.clearSaves()));
                    await without.cabinet.destroy();
                    return { saved, first, unchanged, stillFirst, quick, automatic, cleared, calls, noSave, noClear };
                }))
                .assert("only non-null overlays replace storage and unsupported paths are typed", (state) => state.subject, P.equals<unknown>({
                    saved: true,
                    first: [7, 8],
                    unchanged: false,
                    stillFirst: [7, 8],
                    quick: [9],
                    automatic: [4, 5],
                    cleared: null,
                    calls: [
                        ["persist"], ["persist"], ["saveState", "slot-a"], ["persist"], ["persist"],
                    ],
                    noSave: UNSUPPORTED,
                    noClear: UNSUPPORTED,
                }))
                .start(undefined),
        },
        {
            label: "init restores storage unless changes are explicit, resolves bare ROM basenames and stores picked blobs only after an ok audit",
            run: () => CTGTest.init("ArcadeCabinet init storage and ROM store")
                .stage("prepare real stores, initialize two cabinets and inspect adapter inputs", () => withAudioContext(async () => {
                    const saves = storage("restore");
                    await saves.save(new Uint8Array([4, 5]));
                    const localRoms = romStore();
                    await localRoms.put({ name: "cached-fixture.zip", bytes: new Uint8Array([10]) });
                    const picked = new Blob([new Uint8Array([20, 21])]);
                    const memory: RomFile = { name: "memory-fixture.zip", bytes: new Uint8Array([30]) };
                    const adapter = new FakeArcadeAdapter().script("resolve", new FakeArcadeSession());
                    const cabinet = await ArcadeCabinet.init({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: gameConfig(["cached-fixture.zip", { name: "picked-fixture.zip", blob: picked }, memory]),
                        adapter,
                        fetch: async () => { throw new Error("unexpected fetch"); },
                        storage: saves,
                        romStore: localRoms,
                    });
                    const beforeAudit = (await localRoms.list()).map((entry) => entry.name);
                    const report = await cabinet.audit();
                    const afterAudit = (await localRoms.list()).map((entry) => entry.name);
                    await cabinet.start();
                    const firstStart = adapter.startCalls[0]!;
                    const restored = Array.from(firstStart.changes ?? []);
                    const roms = firstStart.roms.map((rom) => ({ name: rom.name, bytes: Array.from(rom.bytes) }));
                    await cabinet.destroy();

                    const explicitAdapter = new FakeArcadeAdapter().script("resolve", new FakeArcadeSession());
                    const explicit = await ArcadeCabinet.init({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: { ...gameConfig(), changes: new Uint8Array([9]) },
                        adapter: explicitAdapter,
                        fetch: async () => { throw new Error("unexpected fetch"); },
                        storage: saves,
                    });
                    await explicit.start();
                    const explicitChanges = Array.from(explicitAdapter.startCalls[0]?.changes ?? []);
                    await explicit.destroy();

                    const missing = errorOf(await rejectedBy(ArcadeCabinet.init({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: gameConfig(["absent-fixture.zip"]),
                        adapter: new FakeArcadeAdapter().script("resolve", new FakeArcadeSession()),
                        fetch: async () => { throw new Error("unexpected fetch"); },
                        romStore: localRoms,
                    })));
                    return { beforeAudit, report: report.status, afterAudit, restored, roms, explicitChanges, missing };
                }))
                .assert("the stores affect only the documented sources and overlay precedence", (state) => state.subject, P.equals<unknown>({
                    beforeAudit: ["cached-fixture.zip"],
                    report: "ok",
                    afterAudit: ["cached-fixture.zip", "picked-fixture.zip"],
                    restored: [4, 5],
                    roms: [
                        { name: "cached-fixture.zip", bytes: [10] },
                        { name: "picked-fixture.zip", bytes: [20, 21] },
                        { name: "memory-fixture.zip", bytes: [30] },
                    ],
                    explicitChanges: [9],
                    missing: ROM_LOAD_FAILED,
                }))
                .start(undefined),
        },
        {
            label: "OVERLAY_INCOMPATIBLE is surfaced without clearing storage and the cabinet remains retryable",
            run: () => CTGTest.init("ArcadeCabinet incompatible overlay")
                .stage("reject one start with the typed adapter failure, inspect storage, then retry", () => withAudioContext(async () => {
                    const saves = storage("incompatible");
                    await saves.save(new Uint8Array([1, 2]));
                    const session = new FakeArcadeSession();
                    const setup = rig(undefined, { session, storage: saves });
                    setup.adapter.script("reject", new ArcadeRuntimeError({
                        code: ArcadeRuntimeError.CODE.OVERLAY_INCOMPATIBLE,
                        message: "synthetic incompatible overlay",
                    }));
                    const rejected = errorOf(await rejectedBy(setup.cabinet.start()));
                    const stillStored = Array.from((await saves.load()) ?? []);
                    setup.adapter.script("resolve", session);
                    await setup.cabinet.start();
                    const retryStarted = setup.cabinet.isStarted;
                    await setup.cabinet.destroy();
                    return { rejected, stillStored, retryStarted };
                }))
                .assert("the typed error propagates, storage is untouched and retry succeeds", (state) => state.subject, P.equals<unknown>({
                    rejected: OVERLAY_INCOMPATIBLE,
                    stillStored: [1, 2],
                    retryStarted: true,
                }))
                .start(undefined),
        },
        {
            label: "invalid setters reject with INVALID_CONFIG and destroy makes later operations terminal",
            run: () => CTGTest.init("ArcadeCabinet terminal guards")
                .stage("exercise setter validation and a post-destroy audit", async () => {
                    const setup = rig();
                    const keyboard = errorOf(thrownBy(() => { setup.cabinet.keyboardEnabled = "yes" as unknown as boolean; }));
                    const gamepads = errorOf(thrownBy(() => { setup.cabinet.gamepadsEnabled = 1 as unknown as boolean; }));
                    await setup.cabinet.destroy();
                    const destroyed = errorOf(await rejectedBy(setup.cabinet.audit()));
                    return { keyboard, gamepads, destroyed };
                })
                .assert("setter values and terminal use are typed", (state) => state.subject, P.equals<unknown>({
                    keyboard: INVALID_CONFIG,
                    gamepads: INVALID_CONFIG,
                    destroyed: { isRuntimeError: true, code: 10, label: "DESTROYED" },
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
