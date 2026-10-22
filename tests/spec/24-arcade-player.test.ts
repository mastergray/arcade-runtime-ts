// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadePlayer from "../../src/ArcadePlayer/ArcadePlayer.ts";   // Composition root under test
import {
    isArcadeAdapterSelection,
    isArcadeGameConfig,
    isArcadePlayerConfig,
    isArcadePlayerEvents,
    isArcadePlayerStatus,
} from "../../src/ArcadePlayer/types.ts";                        // Public structural predicates
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed failure identity
import { isRomSetReport } from "../../src/RomSetAudit/types.ts";  // Audit fallback validation
import FakeArcadeAdapter from "../support/FakeArcadeAdapter.ts"; // Required adapter double
import FakeArcadeSession from "../support/FakeArcadeSession.ts"; // Required session double
import { errorSnapshot, rejectedBy, thrownBy, validBuildInfo } from "../support/fixtures.ts";   // Stable fixtures and captures

// Type dependencies:
import type { ArcadeGameConfig, ArcadePlayerEvents, ArcadePlayerStatus } from "../../src/ArcadePlayer/types.ts";   // Test snapshots/config
import type { AudioContextLike } from "../../src/ArcadeAudio/types.ts";   // Structural Web Audio double
import type { FrameEvent, Listener, RomFile, Unsubscribe } from "../../src/shared.types.ts";   // Failing-session override and ROM inputs
import type { RomSetMetadata } from "../../src/RomSetAudit/types.ts";   // Synthetic metadata response
import type { ErrorSnapshot } from "../support/fixtures.ts";      // Typed-error snapshot
import type { TestFile } from "../run.ts";                       // Test manifest shape

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: player test rig over real display/audio/input and scripted adapter/session boundaries.
interface PlayerRig {
    readonly adapter: FakeArcadeAdapter;
    readonly session: FakeArcadeSession;
    readonly canvas: CanvasDouble;
    readonly container: ContainerDouble;
    readonly player: ArcadePlayer;
}

// INTERFACE :: mutable constructor shape used to replace global AudioContext during one stage.
interface AudioContextGlobal {
    AudioContext?: typeof AudioContext;
}

/**
 *
 * Classes
 *
 */

// Structural 2D canvas/context double used by the real ArcadeDisplay.
class CanvasDouble {
    width = 300;
    height = 150;
    readonly style: Record<string, string> = {};
    clearCalls = 0;
    drawCalls = 0;
    readonly context = {
        clearRect: (): void => { this.clearCalls++; },
        createImageData: (width: number, height: number): ImageData => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData,
        putImageData: (): void => { this.drawCalls++; },
    };

    // INSTANCE :: STRING -> canvasRenderingContext2D
    // Returns the structural 2D context for every request.
    getContext(_kind: string): CanvasRenderingContext2D {
        return this.context as unknown as CanvasRenderingContext2D;
    }
}

// Structural HTMLElement double used for display layout and audio gesture listeners.
class ContainerDouble {
    readonly listeners = new Map<string, Set<(event: Event) => void>>();

    // INSTANCE :: VOID -> domRect
    // Supplies a stable landscape content rectangle.
    getBoundingClientRect(): DOMRect {
        return { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
    }

    // INSTANCE :: STRING, listener -> VOID
    // Records gesture listeners armed by ArcadeAudio.
    addEventListener(type: string, listener: (event: Event) => void): void {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    // INSTANCE :: STRING, listener -> VOID
    // Removes a previously recorded gesture listener.
    removeEventListener(type: string, listener: (event: Event) => void): void {
        this.listeners.get(type)?.delete(listener);
    }
}

// Minimal AudioContext implementation sufficient for real ArcadeAudio construction and teardown.
class PlayerAudioContext implements AudioContextLike {
    static failConstruction = false;
    state: AudioContextLike["state"] = "suspended";
    readonly sampleRate: number;
    currentTime = 0;
    readonly destination = {} as AudioNode;

    // CONSTRUCTOR :: audioContextOptions? -> this
    // Honors the requested session rate and can fail at the construction boundary.
    constructor(options?: AudioContextOptions) {
        if (PlayerAudioContext.failConstruction) throw new Error("audio construction failed");
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

// Session whose display subscription fails after adapter start resolves.
class DisplayAttachFailureSession extends FakeArcadeSession {
    override onFrame(_listener: Listener<FrameEvent>): Unsubscribe {
        throw new Error("display attach failed");
    }
}

/**
 *
 * Constants
 *
 */

const GAME_BYTES = new Uint8Array([1, 2, 3]);                    // Synthetic non-ROM bytes used only with metadata-unavailable fallback

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> arcadeGameConfig
// Complete valid game config used as a replacement base for predicate and forwarding cases.
const gameConfig = (): ArcadeGameConfig => ({
    machine: "fake",
    machineHints: { players: 2, buttons: 6 },
    roms: [{ name: "game.zip", bytes: GAME_BYTES }],
    changes: new Uint8Array([4, 5]),
    bios: "default",
    dipswitches: { Difficulty: "Normal" },
    options: { frameskip: 1, samplerate: 48000, enabled: true },
    display: { scaling: "integer", imageRendering: "smooth" },
});

// HELPER :: fakeArcadeSession?, arcadeGameConfig?, fetchLike? -> playerRig
// Constructs the real player/display/audio/input stack over structural browser doubles.
const rig = (session: FakeArcadeSession = new FakeArcadeSession(), game: ArcadeGameConfig = gameConfig(), fetcher: (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> = async () => {
    throw new Error("unexpected fetch");
}): PlayerRig => {
    const adapter = new FakeArcadeAdapter().script("resolve", session);
    const canvas = new CanvasDouble();
    const container = new ContainerDouble();
    const player = new ArcadePlayer({
        canvas: canvas as unknown as HTMLCanvasElement,
        container: container as unknown as HTMLElement,
        game,
        adapter,
        fetch: fetcher,
    });
    return { adapter, session, canvas, container, player };
};

// HELPER :: (VOID -> PROMISE(T)) -> PROMISE(T)
// Installs the structural AudioContext only for one async test stage and restores the prior global exactly.
const withAudioContext = async <T>(run: () => Promise<T>): Promise<T> => {
    const target = globalThis as unknown as AudioContextGlobal;
    const descriptor = Object.getOwnPropertyDescriptor(target, "AudioContext");
    Object.defineProperty(target, "AudioContext", { configurable: true, writable: true, value: PlayerAudioContext as unknown as typeof AudioContext });
    try {
        return await run();
    } finally {
        PlayerAudioContext.failConstruction = false;
        if (descriptor === undefined) delete target.AudioContext;
        else Object.defineProperty(target, "AudioContext", descriptor);
    }
};

// HELPER :: UNKNOWN -> errorSnapshot
// Captures the package error identity.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

// HELPER :: UNKNOWN -> arrayBuffer
// Encodes synthetic metadata as a fetch body.
const jsonBody = (value: unknown): ArrayBuffer => new TextEncoder().encode(JSON.stringify(value)).buffer;

// HELPER :: VOID -> romSetMetadata
// Metadata that requires one file absent from the deliberately invalid synthetic archive.
const incompleteMetadata = (): RomSetMetadata => ({
    machine: "fake",
    family: "fake-family",
    description: "Synthetic Machine",
    cloneof: null,
    romof: null,
    bios: ["default"],
    sampleof: null,
    archives: [{ name: "game.zip", role: "game" }],
    roms: [{ name: "required.bin", size: 1, crc: "00000000", sha1: null, archive: "game.zip", optional: false, region: "plds" }],
    samples: [],
});

// HELPER :: VOID -> PROMISE(VOID)
// Lets immediate promise continuations behind reset("hard") finish without wall-clock sleeps.
const settlePromises = async (): Promise<void> => {
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
};

// HELPER :: {[STRING]:UNKNOWN}, STRING, UNKNOWN -> {[STRING]:UNKNOWN}
// Copies one predicate fixture with a field replaced.
const replacing = (value: Record<string, unknown>, key: string, replacement: unknown): Record<string, unknown> => ({ ...value, [key]: replacement });

const testFile: TestFile = {
    label: "ArcadePlayer lifecycle, failure handling and predicates",
    cases: [
        {
            label: "public predicates accept complete values and reject every lifecycle/config discriminator",
            run: () => CTGTest.init("ArcadePlayer predicates")
                .assert("status, selection, game, constructor and event shapes are structural", () => {
                    const session = new FakeArcadeSession();
                    const adapter = new FakeArcadeAdapter().script("resolve", session);
                    const canvas = new CanvasDouble();
                    const container = new ContainerDouble();
                    const game = gameConfig();
                    const config = { canvas, container, game, adapter, fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) };
                    const error = new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INTERNAL_ERROR, message: "synthetic" });
                    const events: ArcadePlayerEvents = { status: "running", exit: undefined, error };
                    return {
                        statuses: ["idle", "starting", "running", "paused", "destroyed"].map(isArcadePlayerStatus),
                        badStatus: isArcadePlayerStatus("stopped"),
                        selections: [isArcadeAdapterSelection({ buildUrl: "/mame/" }), isArcadeAdapterSelection({ type: "mame", buildUrl: "/mame/" }), isArcadeAdapterSelection({ type: "libretro", core: {}, buildUrl: "/core/" })],
                        badSelections: [isArcadeAdapterSelection(null), isArcadeAdapterSelection({ type: "other", buildUrl: "/" }), isArcadeAdapterSelection({ type: "libretro", buildUrl: "/" }), isArcadeAdapterSelection({ buildUrl: "" })],
                        validGame: isArcadeGameConfig(game),
                        validMameGame: isArcadeGameConfig({ ...game, auditStrictness: "mame" }),
                        badGame: [
                            isArcadeGameConfig(null),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "machine", "")),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "machineHints", { players: 0, buttons: 6 })),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "roms", [{}])),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "changes", [])),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "bios", "")),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "dipswitches", { Difficulty: 1 })),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "auditStrictness", "loose")),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "options", { bad: {} })),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "display", { scaling: "stretch" })),
                            isArcadeGameConfig(replacing(game as unknown as Record<string, unknown>, "display", { imageRendering: "crisp" })),
                        ],
                        validConfig: isArcadePlayerConfig(config),
                        badConfig: [
                            isArcadePlayerConfig(null),
                            isArcadePlayerConfig(replacing(config, "canvas", {})),
                            isArcadePlayerConfig(replacing(config, "container", {})),
                            isArcadePlayerConfig(replacing(config, "game", {})),
                            isArcadePlayerConfig(replacing(config, "adapter", {})),
                            isArcadePlayerConfig(replacing(config, "fetch", null)),
                        ],
                        validEvents: isArcadePlayerEvents(events),
                        badEvents: [isArcadePlayerEvents(null), isArcadePlayerEvents({ ...events, status: "stopped" }), isArcadePlayerEvents({ ...events, exit: true }), isArcadePlayerEvents({ ...events, error: new Error("plain") })],
                    };
                }, P.equals<unknown>({
                    statuses: [true, true, true, true, true], badStatus: false,
                    selections: [true, true, true], badSelections: [false, false, false, false],
                    validGame: true, validMameGame: true, badGame: [false, false, false, false, false, false, false, false, false, false, false],
                    validConfig: true, badConfig: [false, false, false, false, false, false],
                    validEvents: true, badEvents: [false, false, false, false],
                }))
                .start(undefined),
        },
        {
            label: "init requires exactly one resolved adapter or adapter selection and rejects libretro until M15",
            run: () => CTGTest.init("ArcadePlayer init selection")
                .stage("exercise both invalid cardinalities, the reserved backend and a resolved adapter", async () => {
                    const canvas = new CanvasDouble() as unknown as HTMLCanvasElement;
                    const container = new ContainerDouble() as unknown as HTMLElement;
                    const game = gameConfig();
                    const adapter = new FakeArcadeAdapter().script("resolve", new FakeArcadeSession());
                    const fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
                    const neither = errorOf(await rejectedBy(ArcadePlayer.init({ canvas, container, game, fetch })));
                    const both = errorOf(await rejectedBy(ArcadePlayer.init({ canvas, container, game, adapter, adapterConfig: { buildUrl: "/build/" }, fetch })));
                    const libretro = errorOf(await rejectedBy(ArcadePlayer.init({ canvas, container, game, adapterConfig: { type: "libretro", core: {}, buildUrl: "/core/" }, fetch })));
                    const player = await ArcadePlayer.init({ canvas, container, game, adapter, fetch });
                    const resolved = { status: player.status, sameCanvasWidth: canvas.width === 300 };
                    await player.destroy();
                    return { neither, both, libretro, resolved };
                })
                .assert("invalid cardinalities are config failures, libretro is unsupported, and a resolved adapter constructs", (state) => state.subject, P.equals<unknown>({
                    neither: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    both: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    libretro: { isRuntimeError: true, code: 15, label: "UNSUPPORTED" },
                    resolved: { status: "idle", sameCanvasWidth: true },
                }))
                .start(undefined),
        },
        {
            label: "start, pause and resume emit every transition while matching-state repeats are idempotent and pause releases first",
            run: () => CTGTest.init("status lifecycle")
                .stage("start, hold a control, pause twice and resume twice", () => withAudioContext(async () => {
                    const { player, session, adapter } = rig();
                    const statuses: ArcadePlayerStatus[] = [];
                    player.on("status", (status) => { statuses.push(status); });
                    await player.start();
                    player.input.press({ kind: "button", player: 1, button: 1 });
                    player.pause();
                    player.pause();
                    player.resume();
                    player.resume();
                    const calls = session.calls.map((call) => [call.method, ...call.args]);
                    const snapshot = { statuses: statuses.slice(), status: player.status, startCalls: adapter.startCalls.length, calls };
                    await player.destroy();
                    return snapshot;
                }))
                .assert("only real transitions emit and the release precedes pause", (state) => state.subject, P.equals<unknown>({
                    statuses: ["starting", "running", "paused", "running"],
                    status: "running",
                    startCalls: 1,
                    calls: [
                        ["setControl", { kind: "button", player: 1, button: 1 }, true],
                        ["setControl", { kind: "button", player: 1, button: 1 }, false],
                        ["pause"],
                        ["resume"],
                    ],
                }))
                .start(undefined),
        },
        {
            label: "start forwards every game field with copied ROM and overlay bytes, and session methods use defaults and release before load/reset",
            run: () => CTGTest.init("forwarding")
                .stage("start and exercise state, reset and persistence methods", () => withAudioContext(async () => {
                    const sourceBytes = new Uint8Array([10, 11]);
                    const changes = new Uint8Array([12, 13]);
                    const game = { ...gameConfig(), roms: [{ name: "game.zip", bytes: sourceBytes } as RomFile], changes };
                    const { player, adapter, session } = rig(new FakeArcadeSession(), game);
                    session.script("persist", "resolve", new Uint8Array([20, 21]));
                    await player.start();
                    sourceBytes.fill(0);
                    changes.fill(0);
                    await player.saveState();
                    player.input.press({ kind: "direction", player: 1, direction: "up" });
                    await player.loadState();
                    player.input.press({ kind: "button", player: 1, button: 2 });
                    player.reset();
                    const overlay = await player.persist();
                    const start = adapter.startCalls[0]!;
                    const result = {
                        machine: player.machine.name,
                        start: {
                            machine: start.machine,
                            hints: start.machineHints,
                            roms: start.roms.map((rom) => ({ name: rom.name, bytes: Array.from(rom.bytes) })),
                            changes: Array.from(start.changes ?? []),
                            bios: start.bios,
                            dipswitches: start.dipswitches,
                            options: start.options,
                        },
                        overlay: Array.from(overlay ?? []),
                        calls: session.calls.map((call) => [call.method, ...call.args]),
                    };
                    await player.destroy();
                    return result;
                }))
                .assert("adapter and session receive the declared surface in order", (state) => state.subject, P.equals<unknown>({
                    machine: "fake",
                    start: {
                        machine: "fake",
                        hints: { players: 2, buttons: 6 },
                        roms: [{ name: "game.zip", bytes: [10, 11] }],
                        changes: [12, 13],
                        bios: "default",
                        dipswitches: { Difficulty: "Normal" },
                        options: { frameskip: 1, samplerate: 48000, enabled: true },
                    },
                    overlay: [20, 21],
                    calls: [
                        ["saveState", "quick"],
                        ["setControl", { kind: "direction", player: 1, direction: "up" }, true],
                        ["setControl", { kind: "direction", player: 1, direction: "up" }, false],
                        ["loadState", "quick"],
                        ["setControl", { kind: "button", player: 1, button: 2 }, true],
                        ["setControl", { kind: "button", player: 1, button: 2 }, false],
                        ["reset", "soft"],
                        ["persist"],
                    ],
                }))
                .start(undefined),
        },
        {
            label: "resolve failure emits one error and returns idle without calling the adapter",
            run: () => CTGTest.init("resolve failure")
                .stage("start from a rejecting URL transport", async () => {
                    const game = { ...gameConfig(), roms: ["/missing.zip"] };
                    const { player, adapter } = rig(new FakeArcadeSession(), game, async () => { throw new Error("network down"); });
                    const errors: ErrorSnapshot[] = [];
                    player.on("error", (error) => { errors.push(errorOf(error)); });
                    const rejected = errorOf(await rejectedBy(player.start()));
                    return { rejected, errors, status: player.status, startCalls: adapter.startCalls.length };
                })
                .assert("the failed player is cleanly retryable", (state) => state.subject, P.equals<unknown>({
                    rejected: { isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED" },
                    errors: [{ isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED" }],
                    status: "idle",
                    startCalls: 0,
                }))
                .start(undefined),
        },
        {
            label: "an incomplete audit rejects before adapter start with the report and returns idle",
            run: () => CTGTest.init("audit rejection")
                .stage("expose build metadata requiring an absent file", async () => {
                    const { player, adapter } = rig();
                    Object.assign(adapter, { build: validBuildInfo(), buildUrl: "/build/" });
                    const fetcher = async () => ({ ok: true, status: 200, arrayBuffer: async () => jsonBody(incompleteMetadata()) });
                    const auditedPlayer = new ArcadePlayer({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: gameConfig(), adapter, fetch: fetcher,
                    });
                    const error = await rejectedBy(auditedPlayer.start());
                    return {
                        snapshot: errorOf(error),
                        reportStatus: ArcadeRuntimeError.is(error) && isRomSetReport(error.data) ? error.data.status : null,
                        status: auditedPlayer.status,
                        startCalls: adapter.startCalls.length,
                    };
                })
                .assert("ROM_SET_INVALID carries the byte-free incomplete report", (state) => state.subject, P.equals<unknown>({
                    snapshot: { isRuntimeError: true, code: 6, label: "ROM_SET_INVALID" },
                    reportStatus: "incomplete",
                    status: "idle",
                    startCalls: 0,
                }))
                .start(undefined),
        },
        {
            label: "mame audit strictness starts with a missing PLD warning and exposes that warning from audit",
            run: () => CTGTest.init("mame audit warning")
                .stage("audit and start against metadata requiring one absent PLD dump", () => withAudioContext(async () => {
                    const session = new FakeArcadeSession();
                    const adapter = new FakeArcadeAdapter().script("resolve", session);
                    Object.assign(adapter, { build: validBuildInfo(), buildUrl: "/build/" });
                    const player = new ArcadePlayer({
                        canvas: new CanvasDouble() as unknown as HTMLCanvasElement,
                        container: new ContainerDouble() as unknown as HTMLElement,
                        game: { ...gameConfig(), auditStrictness: "mame" },
                        adapter,
                        fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => jsonBody(incompleteMetadata()) }),
                    });
                    const report = await player.audit();
                    await player.start();
                    const result = {
                        report: {
                            status: report.status,
                            strictness: report.strictness,
                            warnings: report.warnings,
                            fileStatus: report.files[0]?.status,
                        },
                        playerStatus: player.status,
                        startCalls: adapter.startCalls.length,
                    };
                    await player.destroy();
                    return result;
                }))
                .assert("the true missing status remains visible while the session runs", (state) => state.subject, P.equals<unknown>({
                    report: {
                        status: "ok",
                        strictness: "mame",
                        warnings: [{ name: "required.bin", archive: "game.zip", status: "missing" }],
                        fileStatus: "missing",
                    },
                    playerStatus: "running",
                    startCalls: 1,
                }))
                .start(undefined),
        },
        {
            label: "adapter rejection tears down, emits once, and a retry reuses the resolved URL bytes",
            run: () => CTGTest.init("adapter retry cache")
                .stage("reject the first start and resolve the second", () => withAudioContext(async () => {
                    let fetchCalls = 0;
                    const game = { ...gameConfig(), roms: ["/input/game.zip"] };
                    const session = new FakeArcadeSession();
                    const { player, adapter } = rig(session, game, async () => {
                        fetchCalls++;
                        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([30, 31]).buffer };
                    });
                    const errors: ErrorSnapshot[] = [];
                    player.on("error", (error) => { errors.push(errorOf(error)); });
                    adapter.script("reject", new Error("adapter exploded"));
                    const first = errorOf(await rejectedBy(player.start()));
                    adapter.script("resolve", session);
                    await player.start();
                    const result = { first, errors, fetchCalls, status: player.status, startCalls: adapter.startCalls.length };
                    await player.destroy();
                    return result;
                }))
                .assert("only the first attempt errors and no ROM refetch occurs", (state) => state.subject, P.equals<unknown>({
                    first: { isRuntimeError: true, code: 4, label: "ADAPTER_FAILED" },
                    errors: [{ isRuntimeError: true, code: 4, label: "ADAPTER_FAILED" }],
                    fetchCalls: 1,
                    status: "running",
                    startCalls: 2,
                }))
                .start(undefined),
        },
        {
            label: "display attach and audio construction failures exit partial sessions, remove frame subscriptions and return idle",
            run: () => CTGTest.init("partial start teardown")
                .stage("fail each post-adapter construction boundary", () => withAudioContext(async () => {
                    const displaySession = new DisplayAttachFailureSession();
                    const displayRig = rig(displaySession);
                    const displayError = errorOf(await rejectedBy(displayRig.player.start()));

                    const audioSession = new FakeArcadeSession();
                    const audioRig = rig(audioSession);
                    PlayerAudioContext.failConstruction = true;
                    const audioError = errorOf(await rejectedBy(audioRig.player.start()));
                    PlayerAudioContext.failConstruction = false;
                    audioSession.emitFrame({ width: 1, height: 1, rgba: new Uint8ClampedArray(4) });
                    return {
                        display: { error: displayError, status: displayRig.player.status, exits: displaySession.calls.filter((call) => call.method === "exit").length },
                        audio: { error: audioError, status: audioRig.player.status, exits: audioSession.calls.filter((call) => call.method === "exit").length, postFailureDraws: audioRig.canvas.drawCalls },
                    };
                }))
                .assert("each partial session exits exactly once and leaves no drawing subscription", (state) => state.subject, P.equals<unknown>({
                    display: { error: { isRuntimeError: true, code: 3, label: "INTERNAL_ERROR" }, status: "idle", exits: 1 },
                    audio: { error: { isRuntimeError: true, code: 12, label: "AUDIO_FAILED" }, status: "idle", exits: 1, postFailureDraws: 0 },
                }))
                .start(undefined),
        },
        {
            label: "natural exit emits once, releases held controls, returns idle and retains the display and ROM cache",
            run: () => CTGTest.init("natural exit")
                .stage("exit twice then restart", () => withAudioContext(async () => {
                    let fetchCalls = 0;
                    const firstSession = new FakeArcadeSession();
                    const game = { ...gameConfig(), roms: ["/input/game.zip"] };
                    const { player, adapter } = rig(firstSession, game, async () => {
                        fetchCalls++;
                        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([40]).buffer };
                    });
                    const display = player.display;
                    let exits = 0;
                    player.on("exit", () => { exits++; });
                    await player.start();
                    player.input.press({ kind: "coin", player: 1 });
                    firstSession.emitExit();
                    firstSession.emitExit();
                    const afterExit = {
                        exits,
                        status: player.status,
                        released: firstSession.calls.some((call) => call.method === "setControl" && call.args[1] === false),
                        sameDisplay: player.display === display,
                    };
                    const secondSession = new FakeArcadeSession();
                    adapter.script("resolve", secondSession);
                    await player.start();
                    const result = { afterExit, fetchCalls, status: player.status };
                    await player.destroy();
                    return result;
                }))
                .assert("only one exit event occurs and restart reads no source again", (state) => state.subject, P.equals<unknown>({
                    afterExit: { exits: 1, status: "idle", released: true, sameDisplay: true },
                    fetchCalls: 1,
                    status: "running",
                }))
                .start(undefined),
        },
        {
            label: "throwing listeners are isolated, later listeners run, and error-listener failures never recurse",
            run: () => CTGTest.init("listener isolation")
                .stage("install throwing listeners before a normal recorder and start", () => withAudioContext(async () => {
                    const { player } = rig();
                    const seen: ArcadePlayerStatus[] = [];
                    const errors: ErrorSnapshot[] = [];
                    player.on("status", () => { throw new Error("status listener failed"); });
                    player.on("status", (status) => { seen.push(status); });
                    player.on("error", () => { throw new Error("error listener failed"); });
                    player.on("error", (error) => { errors.push(errorOf(error)); });
                    await player.start();
                    const result = { seen: seen.slice(), errors: errors.slice() };
                    await player.destroy();
                    return result;
                }))
                .assert("one INTERNAL_ERROR per thrown status delivery reaches the later error listener", (state) => state.subject, P.equals<unknown>({
                    seen: ["starting", "running"],
                    errors: [
                        { isRuntimeError: true, code: 3, label: "INTERNAL_ERROR" },
                        { isRuntimeError: true, code: 3, label: "INTERNAL_ERROR" },
                    ],
                }))
                .start(undefined),
        },
        {
            label: "hard reset releases, persists, exits and starts fresh from cached ROM bytes and the returned overlay",
            run: () => CTGTest.init("hard reset")
                .stage("start once, script a new session, and request hard reset", () => withAudioContext(async () => {
                    let fetchCalls = 0;
                    const firstSession = new FakeArcadeSession();
                    firstSession.script("persist", "resolve", new Uint8Array([50, 51]));
                    const game = { ...gameConfig(), roms: ["/input/game.zip"], changes: undefined };
                    const { player, adapter } = rig(firstSession, game, async () => {
                        fetchCalls++;
                        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([52]).buffer };
                    });
                    const statuses: ArcadePlayerStatus[] = [];
                    player.on("status", (status) => { statuses.push(status); });
                    await player.start();
                    player.input.press({ kind: "start", player: 1 });
                    const secondSession = new FakeArcadeSession();
                    adapter.script("resolve", secondSession);
                    player.reset("hard");
                    const immediate = player.status;
                    await settlePromises();
                    const result = {
                        immediate,
                        final: player.status,
                        statuses: statuses.slice(),
                        fetchCalls,
                        firstCalls: firstSession.calls.map((call) => call.method),
                        startCalls: adapter.startCalls.length,
                        restartChanges: Array.from(adapter.startCalls[1]?.changes ?? []),
                    };
                    await player.destroy();
                    return result;
                }))
                .assert("restart is starting immediately and forwards the persisted overlay after an intentional exit", (state) => state.subject, P.equals<unknown>({
                    immediate: "starting",
                    final: "running",
                    statuses: ["starting", "running", "starting", "running"],
                    fetchCalls: 1,
                    firstCalls: ["setControl", "setControl", "persist", "exit"],
                    startCalls: 2,
                    restartChanges: [50, 51],
                }))
                .start(undefined),
        },
        {
            label: "destroy is terminal and idempotent, exits one running session and guards every session-facing property/operation",
            run: () => CTGTest.init("destroy and guards")
                .stage("probe before start, then start and destroy twice", () => withAudioContext(async () => {
                    const { player, session } = rig();
                    const before = {
                        machine: errorOf(thrownBy(() => player.machine)),
                        input: errorOf(thrownBy(() => player.input)),
                        audio: errorOf(thrownBy(() => player.audio)),
                        pause: errorOf(thrownBy(() => player.pause())),
                        fullscreen: errorOf(thrownBy(() => player.fullscreen())),
                    };
                    const statuses: ArcadePlayerStatus[] = [];
                    player.on("status", (status) => { statuses.push(status); });
                    await player.start();
                    await player.destroy();
                    await player.destroy();
                    return {
                        before,
                        statuses,
                        status: player.status,
                        exitCalls: session.calls.filter((call) => call.method === "exit").length,
                        after: errorOf(thrownBy(() => player.pause())),
                    };
                }))
                .assert("pre-start guards are NOT_STARTED and post-destroy is DESTROYED", (state) => state.subject, P.equals<unknown>({
                    before: {
                        machine: { isRuntimeError: true, code: 8, label: "NOT_STARTED" },
                        input: { isRuntimeError: true, code: 8, label: "NOT_STARTED" },
                        audio: { isRuntimeError: true, code: 8, label: "NOT_STARTED" },
                        pause: { isRuntimeError: true, code: 8, label: "NOT_STARTED" },
                        fullscreen: { isRuntimeError: true, code: 8, label: "NOT_STARTED" },
                    },
                    statuses: ["starting", "running", "destroyed"],
                    status: "destroyed",
                    exitCalls: 1,
                    after: { isRuntimeError: true, code: 10, label: "DESTROYED" },
                }))
                .start(undefined),
        },
        {
            label: "audit resolves without starting and returns a predicate-valid permissive report when metadata is unreachable",
            run: () => CTGTest.init("audit fallback")
                .stage("audit twice against an adapter with no metadata locator", async () => {
                    const { player, adapter } = rig();
                    const first = await player.audit();
                    (first.problems as unknown[]).splice(0);       // Runtime mutation attempt against the defensive copy
                    const second = await player.audit();
                    return {
                        valid: isRomSetReport(second),
                        status: second.status,
                        strictness: second.strictness,
                        warnings: second.warnings,
                        problems: second.problems.map((problem) => problem.reason),
                        startCalls: adapter.startCalls.length,
                    };
                })
                .assert("the fallback stays cached internally and explains metadata absence", (state) => state.subject, P.equals<unknown>({
                    valid: true,
                    status: "ok",
                    strictness: "strict",
                    warnings: [],
                    problems: ["ROM-set metadata was unavailable."],
                    startCalls: 0,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
