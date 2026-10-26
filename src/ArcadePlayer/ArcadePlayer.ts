// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Sole public failure type
import ArcadeDisplay from "../ArcadeDisplay/ArcadeDisplay.js";     // Reusable native-frame display
import ArcadeAudio from "../ArcadeAudio/ArcadeAudio.js";           // Per-session stereo playback
import ArcadeInput from "../ArcadeInput/ArcadeInput.js";           // Per-session control ownership
import MameEmulatorAdapter from "../MameEmulatorAdapter/MameEmulatorAdapter.js";   // Default adapter selection
import RomSetAudit from "../RomSetAudit/RomSetAudit.js";           // Metadata-backed pre-start audit
import { isRomSetMetadata } from "../RomSetAudit/types.js";        // Fetched metadata validation
import { isArcadeAdapterSelection, isArcadePlayerConfig } from "./types.js";   // Selection and constructor guards
import RomSourceResolver from "./RomSourceResolver.js";           // Parallel URL/Blob/byte resolution

// Type dependencies:
import type {
    ArcadeAdapter,                                                 // Resolved backend
    ArcadeSession,                                                 // Active machine
    ArcadeStartConfig,                                             // Adapter call assembled from the game
    BuildInfo,                                                     // Optional audit metadata locator
    FetchLike,                                                     // ROM and metadata transport
    Listener,                                                      // Event listener
    MachineInfo,                                                   // machine getter result
    RomFile,                                                       // Cached resolved archives
    Unsubscribe,                                                   // Session and event removers
} from "../shared.types.js";
import type { ArcadeDisplayConfig } from "../ArcadeDisplay/types.js";   // Display config assembled from game options
import type { RomSetMetadata, RomSetReport } from "../RomSetAudit/types.js";   // Audit transport and result
import type {
    ArcadeAdapterSelection,                                        // init() backend choice
    ArcadeGameConfig,                                              // Retained game config
    ArcadePlayerConfig,                                            // Constructor config
    ArcadePlayerEvents,                                            // on() event map
    ArcadePlayerStatus,                                            // Lifecycle state
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: optional adapter metadata surface used only when a custom adapter exposes both halves.
interface AdapterMetadataSource extends ArcadeAdapter {
    readonly build: BuildInfo;                                     // Supplies romsetsUrl
    readonly buildUrl: string;                                     // Base directory for that relative URL
}

// INTERFACE :: browser-resolved values handed from init() into construction without widening ArcadePlayerConfig.
interface PreparedConstruction {
    readonly display: ArcadeDisplay;                               // Display with browser observer/fullscreen defaults
    readonly buildUrl: string | null;                              // Known adapter-selection base URL
}

// TYPE :: ArcadePlayerConfig plus a module-private symbol field
// Keeps init-only dependencies out of the declared public constructor surface.
type PreparedConfig = ArcadePlayerConfig & { readonly [PREPARED]?: PreparedConstruction };

/**
 *
 * Constants
 *
 */

const PREPARED: unique symbol = Symbol("ArcadePlayer prepared construction");   // Unexported init-to-constructor handoff
const METADATA_UNAVAILABLE = "ROM-set metadata was unavailable.";               // Stable audit fallback reason

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, STRING -> STRING
// Resolves an artifact relative to absolute, root-relative or page-relative build directories without reading globals.
const resolveBuildUrl = (buildUrl: string, relative: string): string => {
    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(relative) || relative.startsWith("//") || relative.startsWith("/")) return relative;
    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(buildUrl) || buildUrl.startsWith("//")) return new URL(relative, buildUrl.endsWith("/") ? buildUrl : `${buildUrl}/`).href;
    return `${buildUrl.endsWith("/") ? buildUrl : `${buildUrl}/`}${relative.replace(/^\.\//, "")}`;
};

// HELPER :: UNKNOWN -> BOOLEAN
// True when a custom adapter exposes validated build metadata and a usable base URL.
const isAdapterMetadataSource = (adapter: ArcadeAdapter): adapter is AdapterMetadataSource => {
    const candidate = adapter as Partial<AdapterMetadataSource>;
    return typeof candidate.buildUrl === "string" && /\S/.test(candidate.buildUrl)
        && typeof candidate.build === "object" && candidate.build !== null
        && typeof candidate.build.romsetsUrl === "string" && /\S/.test(candidate.build.romsetsUrl);
};

// HELPER :: romSetReport -> romSetReport
// Returns a detached byte-free report so callers cannot mutate the cached audit used by start().
const copyReport = (report: RomSetReport): RomSetReport => ({
    machine: report.machine,
    status: report.status,
    strictness: report.strictness,
    archives: report.archives.map((archive) => ({ ...archive })),
    files: report.files.map((file) => ({ ...file })),
    warnings: report.warnings.map((warning) => ({ ...warning })),
    unexpected: report.unexpected.map((file) => ({ ...file })),
    problems: report.problems.map((problem) => ({ ...problem })),
});

/**
 *
 * Class
 *
 */

// Application-facing composition root for one arcade machine, its display, audio, input and restart lifecycle.
export default class ArcadePlayer {

    /* Instance Fields */
    private readonly _canvas: HTMLCanvasElement;                   // Canvas retained for the display's lifetime
    private readonly _container: HTMLElement;                     // Layout, fullscreen and gesture target
    private readonly _game: ArcadeGameConfig;                     // Validated game choices
    private readonly _adapter: ArcadeAdapter;                     // Resolved backend
    private readonly _fetch: FetchLike;                            // ROM and metadata transport
    private readonly _display: ArcadeDisplay;                     // Reused across sessions and natural exits
    private readonly _buildUrl: string | null;                    // Known base URL for romsets metadata
    private readonly _listeners = new Map<keyof ArcadePlayerEvents, Set<Listener<never>>>();   // Event subscribers
    private _status: ArcadePlayerStatus = "idle";                 // Current lifecycle state
    private _resolvedRoms: RomFile[] | null = null;                // Successful source result, cached for life
    private _resolvePromise: Promise<RomFile[]> | null = null;     // Shared in-flight resolution
    private _auditReport: RomSetReport | null = null;              // Successful audit/fallback, cached for life
    private _auditPromise: Promise<RomSetReport> | null = null;    // Shared in-flight audit
    private _changes: Uint8Array | undefined;                     // Latest cumulative overlay used by restarts
    private _session: ArcadeSession | null = null;                 // Running or paused session
    private _input: ArcadeInput | null = null;                    // Per-session controls
    private _audio: ArcadeAudio | null = null;                    // Per-session sound
    private _detachDisplay: Unsubscribe | null = null;            // Frame-subscription remover
    private _unsubscribeExit: Unsubscribe | null = null;          // Natural-exit remover
    private _destroyPromise: Promise<void> | null = null;          // Makes concurrent/repeated destroy idempotent

    // CONSTRUCTOR :: arcadePlayerConfig -> this
    // Validates deterministic dependencies and constructs a display without consulting browser globals.
    // NOTE: Throws INVALID_CONFIG without carrying config, because it may contain user ROM bytes.
    constructor(config: ArcadePlayerConfig) {
        if (!isArcadePlayerConfig(config)) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadePlayer config must hold a canvas, container, game, resolved adapter and fetch function.",
            data: null,
        });
        const prepared = (config as PreparedConfig)[PREPARED];
        this._canvas = config.canvas;
        this._container = config.container;
        this._game = config.game;
        this._adapter = config.adapter;
        this._fetch = config.fetch;
        this._changes = config.game.changes?.slice();
        this._display = prepared?.display ?? new ArcadeDisplay(ArcadePlayer.displayConfig(config.canvas, config.container, config.game));
        this._buildUrl = prepared?.buildUrl ?? (isAdapterMetadataSource(config.adapter) ? config.adapter.buildUrl : null);
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> arcadePlayerStatus
    // Current lifecycle state.
    get status(): ArcadePlayerStatus { return this._status; }

    // GETTER :: VOID -> machineInfo
    // Active machine description.
    // NOTE: Throws NOT_STARTED without a session and DESTROYED after destroy().
    get machine(): MachineInfo { return this.requireSession("machine").machine; }

    // GETTER :: VOID -> arcadeInput
    // Active per-session input API.
    // NOTE: Throws NOT_STARTED without a session and DESTROYED after destroy().
    get input(): ArcadeInput {
        this.requireLive();
        if (this._input === null) throw this.notStarted("input");
        return this._input;
    }

    // GETTER :: VOID -> arcadeDisplay
    // Reusable display, available before start and after natural exit.
    get display(): ArcadeDisplay {
        this.requireLive();
        return this._display;
    }

    // GETTER :: VOID -> arcadeAudio
    // Active per-session audio API.
    // NOTE: Throws NOT_STARTED without a session and DESTROYED after destroy().
    get audio(): ArcadeAudio {
        this.requireLive();
        if (this._audio === null) throw this.notStarted("audio");
        return this._audio;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> PROMISE(romSetReport)
    // Resolves sources once, fetches metadata when locatable, and returns a defensive byte-free report without starting.
    async audit(): Promise<RomSetReport> {
        this.requireLive();
        if (this._auditReport !== null) return copyReport(this._auditReport);
        if (this._auditPromise === null) {
            this._auditPromise = this.performAudit();
            this._auditPromise.catch(() => { this._auditPromise = null; });
        }
        const report = await this._auditPromise;
        this._auditReport = report;
        return copyReport(report);
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Audits, starts and wires a new session; any failure fully tears down and returns to idle.
    async start(): Promise<void> {
        this.requireLive();
        if (this._status !== "idle") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.ALREADY_STARTED,
            message: `ArcadePlayer cannot start while ${this._status}.`,
            data: this._status,
        });
        this.beginStarting();
        try {
            await this.startSession();
            this._display.showPlaceholder(null);
            this.setStatus("running");
        } catch (error) {
            await this.cleanupFailedSession();
            if (!this.isDestroyed()) this.setStatus("idle");
            const runtimeError = ArcadeRuntimeError.is(error) ? error : new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.INTERNAL_ERROR,
                message: "ArcadePlayer start failed unexpectedly.",
                data: error,
            });
            this.emit("error", runtimeError);
            throw runtimeError;
        }
    }

    // INSTANCE :: VOID -> VOID
    // Releases held controls and pauses; repeated calls while paused are no-ops.
    pause(): void {
        const session = this.requireSession("pause");
        if (this._status === "paused") return;
        this._input?.releaseAll();
        session.pause();
        this.setStatus("paused");
    }

    // INSTANCE :: VOID -> VOID
    // Resumes; repeated calls while running are no-ops.
    resume(): void {
        const session = this.requireSession("resume");
        if (this._status === "running") return;
        session.resume();
        this.setStatus("running");
    }

    // INSTANCE :: "soft" | "hard"? -> VOID
    // Soft reset forwards synchronously; hard reset starts an asynchronous persist/exit/fresh-start lifecycle.
    // NOTE: Hard-reset failures are reported through the error event because §9 fixes this method's return type to void.
    reset(kind: "soft" | "hard" = "soft"): void {
        const session = this.requireSession("reset");
        if (kind !== "soft" && kind !== "hard") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadePlayer.reset kind must be soft or hard.",
            data: kind,
        });
        this._input?.releaseAll();
        if (kind === "soft") {
            session.reset("soft");
            return;
        }
        this.beginStarting();
        void this.hardReset(session);
    }

    // INSTANCE :: STRING? -> PROMISE(VOID)
    // Forwards a named save-state write, defaulting to quick.
    saveState(slot = "quick"): Promise<void> {
        const session = this.requireSession("saveState");
        if (!session.machine.supportsSave) return Promise.reject(new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "This MAME 0.161 driver does not set GAME_SUPPORTS_SAVE.",
            data: "GAME_SUPPORTS_SAVE",
        }));
        return session.saveState(slot);
    }

    // INSTANCE :: STRING? -> PROMISE(VOID)
    // Releases controls before forwarding a named state restore, defaulting to quick.
    loadState(slot = "quick"): Promise<void> {
        const session = this.requireSession("loadState");
        if (!session.machine.supportsSave) return Promise.reject(new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "This MAME 0.161 driver does not set GAME_SUPPORTS_SAVE.",
            data: "GAME_SUPPORTS_SAVE",
        }));
        this._input?.releaseAll();
        return session.loadState(slot);
    }

    // INSTANCE :: VOID -> PROMISE(UINT8ARRAY?)
    // Forwards persistence and retains a defensive copy of every new cumulative overlay for hard restarts.
    async persist(): Promise<Uint8Array | null> {
        const overlay = await this.requireSession("persist").persist();
        if (overlay === null) return null;
        this._changes = overlay.slice();
        return overlay.slice();
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Forwards to the display only while a session exists.
    fullscreen(): Promise<void> {
        this.requireSession("fullscreen");
        return this._display.fullscreen();
    }

    // INSTANCE :: eventName, (payload -> VOID) -> unsubscribe
    // Registers one listener; exceptions do not stop later listeners and become one non-recursive INTERNAL_ERROR.
    on<K extends keyof ArcadePlayerEvents>(event: K, listener: Listener<ArcadePlayerEvents[K]>): Unsubscribe {
        this.requireLive();
        if ((event !== "status" && event !== "exit" && event !== "error") || typeof listener !== "function") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadePlayer.on requires a known event and a listener function.",
            data: event,
        });
        let listeners = this._listeners.get(event);
        if (listeners === undefined) {
            listeners = new Set();
            this._listeners.set(event, listeners);
        }
        listeners.add(listener as Listener<never>);
        return () => { listeners.delete(listener as Listener<never>); };
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Releases and detaches session resources, exits once, destroys the display and becomes terminal even if exit rejects.
    destroy(): Promise<void> {
        if (this._destroyPromise !== null) return this._destroyPromise;
        if (this._status === "destroyed") return Promise.resolve();
        this._destroyPromise = this.performDestroy();
        return this._destroyPromise;
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Enters starting, emits status and clears the reusable canvas as the blank placeholder.
    private beginStarting(): void {
        this.setStatus("starting");
        this._display.showPlaceholder(null);
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Performs the audit, adapter start and display/audio/input wiring while status is starting.
    private async startSession(): Promise<void> {
        const report = await this.auditWhileStarting();
        if (this.isDestroyed()) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "ArcadePlayer was destroyed while starting.",
        });
        if (report.status !== "ok") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.ROM_SET_INVALID,
            message: "The supplied ROM set did not pass its pre-start audit.",
            data: copyReport(report),
        });
        const roms = await this.resolveRoms();
        const config: { -readonly [K in keyof ArcadeStartConfig]: ArcadeStartConfig[K] } = {
            machine: this._game.machine,
            machineHints: this._game.machineHints,
            roms: roms.map((rom) => ({ name: rom.name, bytes: rom.bytes.slice() })),
        };
        if (this._changes !== undefined) config.changes = this._changes.slice();
        if (this._game.bios !== undefined) config.bios = this._game.bios;
        if (this._game.dipswitches !== undefined) config.dipswitches = this._game.dipswitches;
        if (this._game.options !== undefined) config.options = this._game.options;

        let session: ArcadeSession;
        try {
            session = await this._adapter.start(config);
        } catch (error) {
            if (ArcadeRuntimeError.is(error)) throw error;
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "The arcade adapter failed to start a session.",
                data: error,
            });
        }
        if (this._status === "destroyed") {
            try { await session.exit(); } catch { /* destroy remains authoritative */ }
            throw new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.DESTROYED, message: "ArcadePlayer was destroyed while starting." });
        }
        this._session = session;
        this._detachDisplay = this._display.attach(session);
        this._audio = ArcadeAudio.init({ session, gestureSource: this._container });
        this._audio.armGestureUnlock();
        this._input = new ArcadeInput({ session });
        this._unsubscribeExit = session.onExit(() => this.onSessionExit(session));
    }

    // PRIVATE :: VOID -> PROMISE(romSetReport)
    // Audit variant usable while status is starting; public audit() deliberately rejects only after destroy.
    private async auditWhileStarting(): Promise<RomSetReport> {
        if (this._auditReport !== null) return this._auditReport;
        if (this._auditPromise === null) {
            this._auditPromise = this.performAudit();
            this._auditPromise.catch(() => { this._auditPromise = null; });
        }
        const report = await this._auditPromise;
        this._auditReport = report;
        return report;
    }

    // PRIVATE :: VOID -> PROMISE(romSetReport)
    // Fetches and validates reachable metadata, otherwise returns the documented permissive fallback report.
    private async performAudit(): Promise<RomSetReport> {
        const roms = await this.resolveRoms();
        const location = this.metadataLocation();
        if (location === null) return this.metadataUnavailableReport(roms);
        let metadata: RomSetMetadata;
        try {
            const response = await this._fetch(location);
            if (!response.ok) return this.metadataUnavailableReport(roms);
            const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await response.arrayBuffer()));
            if (!isRomSetMetadata(parsed) || parsed.machine !== this._game.machine) return this.metadataUnavailableReport(roms);
            metadata = parsed;
        } catch {
            return this.metadataUnavailableReport(roms);
        }
        return RomSetAudit.audit(metadata, roms, {
            ...(this._game.bios === undefined ? {} : { bios: this._game.bios }),
            ...(this._game.auditStrictness === undefined ? {} : { strictness: this._game.auditStrictness }),
        });
    }

    // PRIVATE :: VOID -> PROMISE([romFile])
    // Shares one resolution, caches only success, and returns the stable cached array internally.
    private async resolveRoms(): Promise<RomFile[]> {
        if (this._resolvedRoms !== null) return this._resolvedRoms;
        if (this._resolvePromise === null) {
            this._resolvePromise = RomSourceResolver.resolve(this._game.roms, this._fetch);
            this._resolvePromise.catch(() => { this._resolvePromise = null; });
        }
        const roms = await this._resolvePromise;
        this._resolvedRoms = roms;
        return roms;
    }

    // PRIVATE :: VOID -> STRING?
    // Resolves romsets/<machine>.json when init knew the build URL or a custom adapter exposes one.
    private metadataLocation(): string | null {
        const adapter = this._adapter as Partial<AdapterMetadataSource>;
        const build = adapter.build;
        if (this._buildUrl === null || build === undefined || typeof build.romsetsUrl !== "string") return null;
        const metadataBase = resolveBuildUrl(this._buildUrl, build.romsetsUrl);
        return resolveBuildUrl(metadataBase, `${encodeURIComponent(this._game.machine)}.json`);
    }

    // PRIVATE :: [romFile] -> romSetReport
    // Builds a predicate-valid permissive report whose sole problem explains that pre-audit metadata was unavailable.
    private metadataUnavailableReport(roms: ReadonlyArray<RomFile>): RomSetReport {
        const archives = roms.length > 0
            ? roms.map((rom) => ({ name: rom.name, role: "game" as const, present: true, required: false }))
            : [{ name: "metadata.json", role: "game" as const, present: false, required: false }];
        return {
            machine: this._game.machine,
            status: "ok",
            strictness: this._game.auditStrictness ?? "strict",
            archives,
            files: [],
            warnings: [],
            unexpected: [],
            problems: [{ archive: archives[0]!.name, reason: METADATA_UNAVAILABLE }],
        };
    }

    // PRIVATE :: arcadeSession -> PROMISE(VOID)
    // Persists, intentionally tears down/exits the old session, then starts a fresh module from cached ROMs and overlay.
    private async hardReset(session: ArcadeSession): Promise<void> {
        try {
            const overlay = await session.persist();
            if (overlay !== null) this._changes = overlay.slice();
            if (this._session !== session || this.isDestroyed()) return;
            this.detachSession();
            await session.exit();
            if (this.isDestroyed()) return;
            await this.startSession();
            this._display.showPlaceholder(null);
            this.setStatus("running");
        } catch (error) {
            await this.cleanupFailedSession();
            if (this.isDestroyed()) return;
            this.setStatus("idle");
            const runtimeError = ArcadeRuntimeError.is(error) ? error : new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.INTERNAL_ERROR,
                message: "ArcadePlayer hard reset failed unexpectedly.",
                data: error,
            });
            this.emit("error", runtimeError);
        }
    }

    // PRIVATE :: arcadeSession -> VOID
    // Handles one natural session exit, releasing controls before emitting exit and returning to idle.
    private onSessionExit(session: ArcadeSession): void {
        if (this._status === "destroyed" || this._session !== session) return;
        this.detachSession();
        this.emit("exit", undefined);
        this.setStatus("idle");
    }

    // PRIVATE :: VOID -> arcadeSession?
    // Releases input and removes every session subscription/resource while retaining the reusable display object.
    private detachSession(): ArcadeSession | null {
        const session = this._session;
        try { this._unsubscribeExit?.(); } catch { /* Continue terminal teardown across a broken remover. */ }
        this._unsubscribeExit = null;
        try { this._input?.destroy(); } catch { /* A naturally exited session may already reject releases as DESTROYED. */ }
        this._input = null;
        try { this._detachDisplay?.(); } catch { /* Continue removing the remaining owned resources. */ }
        this._detachDisplay = null;
        try { this._audio?.destroy(); } catch { /* Continue terminal teardown across an injected boundary failure. */ }
        this._audio = null;
        this._session = null;
        return session;
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Tears down a partially wired session and asks it to exit, suppressing cleanup failures in favor of the initiating error.
    private async cleanupFailedSession(): Promise<void> {
        const session = this.detachSession();
        if (session === null) return;
        try { await session.exit(); } catch { /* The startup/reset failure remains authoritative. */ }
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Terminal destroy implementation shared by every caller.
    private async performDestroy(): Promise<void> {
        const session = this.detachSession();
        let failure: unknown;
        if (session !== null) {
            try { await session.exit(); }
            catch (error) {
                if (!(ArcadeRuntimeError.is(error) && error.code === ArcadeRuntimeError.CODE.DESTROYED)) failure = error;
            }
        }
        this._display.destroy();
        if (this._status !== "destroyed") this.setStatus("destroyed");
        this._listeners.clear();
        if (failure !== undefined) throw failure;
    }

    // PRIVATE :: arcadePlayerStatus -> VOID
    // Stores and emits one lifecycle transition.
    private setStatus(status: ArcadePlayerStatus): void {
        this._status = status;
        this.emit("status", status);
    }

    // PRIVATE :: eventName, payload -> VOID
    // Delivers a stable listener snapshot; one throwing listener becomes one INTERNAL_ERROR and never recurses.
    private emit<K extends keyof ArcadePlayerEvents>(event: K, payload: ArcadePlayerEvents[K]): void {
        const listeners = this._listeners.get(event);
        if (listeners === undefined) return;
        for (const listener of [...listeners]) {
            try {
                (listener as Listener<ArcadePlayerEvents[K]>)(payload);
            } catch (error) {
                if (event === "error") continue;
                this.emit("error", new ArcadeRuntimeError({
                    code: ArcadeRuntimeError.CODE.INTERNAL_ERROR,
                    message: `An ArcadePlayer ${event} listener threw.`,
                    data: error,
                }));
            }
        }
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after terminal cleanup.
    private requireLive(): void {
        if (this._status === "destroyed") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "ArcadePlayer has been destroyed.",
            data: null,
        });
    }

    // PRIVATE :: VOID -> BOOLEAN
    // Reads terminal state without retaining TypeScript's pre-await control-flow narrowing.
    private isDestroyed(): boolean {
        return this._status === "destroyed";
    }

    // PRIVATE :: STRING -> arcadeSession
    // Returns the active session or throws NOT_STARTED / DESTROYED.
    private requireSession(operation: string): ArcadeSession {
        this.requireLive();
        if (this._session === null) throw this.notStarted(operation);
        return this._session;
    }

    // PRIVATE :: STRING -> arcadeRuntimeError
    // Builds the common NOT_STARTED operation error.
    private notStarted(operation: string): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.NOT_STARTED,
            message: `ArcadePlayer.${operation} needs a started session.`,
            data: operation,
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: canvas, container, game, exactly one adapter/adapterConfig, fetch? -> PROMISE(arcadePlayer)
    // Validates before reading globals, supplies fetch/display browser defaults, and resolves the default MAME adapter selection.
    static async init(config: {
        readonly canvas: HTMLCanvasElement;
        readonly container: HTMLElement;
        readonly game: ArcadeGameConfig;
        readonly adapter?: ArcadeAdapter;
        readonly adapterConfig?: ArcadeAdapterSelection;
        readonly fetch?: FetchLike;
    }): Promise<ArcadePlayer> {
        if (typeof config !== "object" || config === null) throw ArcadePlayer.invalidInit();
        const hasAdapter = config.adapter !== undefined;
        const hasSelection = config.adapterConfig !== undefined;
        if (hasAdapter === hasSelection) throw ArcadePlayer.invalidInit();
        if (config.adapter !== undefined && (typeof config.adapter !== "object" || config.adapter === null
            || typeof config.adapter.type !== "string" || !/\S/.test(config.adapter.type) || typeof config.adapter.start !== "function")) throw ArcadePlayer.invalidInit();
        if (config.adapterConfig !== undefined && !isArcadeAdapterSelection(config.adapterConfig)) throw ArcadePlayer.invalidInit();
        if (config.fetch !== undefined && typeof config.fetch !== "function") throw ArcadePlayer.invalidInit();
        const shapeAdapter: ArcadeAdapter = config.adapter ?? { type: "pending", start: async () => { throw new Error("unreachable"); } };
        const shapeFetch: FetchLike = config.fetch ?? (async () => { throw new Error("unreachable"); });
        if (!isArcadePlayerConfig({ canvas: config.canvas, container: config.container, game: config.game, adapter: shapeAdapter, fetch: shapeFetch })) throw ArcadePlayer.invalidInit();
        const fetcher = config.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) as FetchLike : undefined);
        if (fetcher === undefined) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "ArcadePlayer.init requires fetch.",
            data: null,
        });

        let adapter: ArcadeAdapter;
        let buildUrl: string | null = null;
        if (config.adapter !== undefined) {
            adapter = config.adapter;
        } else {
            const selection = config.adapterConfig;
            if (selection === undefined) throw ArcadePlayer.invalidInit();
            if (selection.type === "libretro") throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.UNSUPPORTED,
                message: "The libretro adapter is not available before M15.",
                data: "libretro",
            });
            if (selection.type !== undefined && selection.type !== "mame") throw ArcadePlayer.invalidInit();
            buildUrl = selection.buildUrl;
            adapter = await MameEmulatorAdapter.init({ buildUrl, fetch: fetcher });
        }

        const direct: ArcadePlayerConfig = {
            canvas: config.canvas,
            container: config.container,
            game: config.game,
            adapter,
            fetch: fetcher,
        };
        if (!isArcadePlayerConfig(direct)) throw ArcadePlayer.invalidInit();
        const display = ArcadeDisplay.init(ArcadePlayer.displayConfig(config.canvas, config.container, config.game));
        const prepared: PreparedConfig = Object.assign(direct, { [PREPARED]: { display, buildUrl } });
        return new ArcadePlayer(prepared);
    }

    // STATIC :: canvas, container, arcadeGameConfig -> arcadeDisplayConfig
    // Copies only the display options ArcadeDisplay owns.
    private static displayConfig(canvas: HTMLCanvasElement, container: HTMLElement, game: ArcadeGameConfig): ArcadeDisplayConfig {
        const display: { -readonly [K in keyof ArcadeDisplayConfig]: ArcadeDisplayConfig[K] } = { canvas, container };
        if (game.display?.scaling !== undefined) display.scaling = game.display.scaling;
        if (game.display?.imageRendering !== undefined) display.imageRendering = game.display.imageRendering;
        if (game.display?.crop !== undefined) display.crop = game.display.crop;
        return display;
    }

    // STATIC :: VOID -> arcadeRuntimeError
    // Byte-free INVALID_CONFIG for init's anonymous public config.
    private static invalidInit(): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadePlayer.init requires valid canvas, container and game values plus exactly one adapter or adapterConfig.",
            data: null,
        });
    }
}
