// realizes: docs/arcade-runtime-spec.md > §10.6 ArcadeCabinet

// Dependencies:
import ArcadePlayer from "../ArcadePlayer/ArcadePlayer.js";       // Owned player lifecycle
import AnalogDriver from "../AnalogDriver/AnalogDriver.js";       // Per-session keyboard ramps and gamepad filtering
import ArcadeRomStore from "../ArcadeRomStore/ArcadeRomStore.js";   // Optional browser-local ROM persistence
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Sole public failure type
import ArcadeStorage from "../ArcadeStorage/ArcadeStorage.js";   // Optional overlay persistence
import GamepadSource from "../GamepadSource/GamepadSource.js";   // Per-player physical gamepad source
import KeyboardSource, { DEFAULT_KEYBOARD_MAP } from "../KeyboardSource/KeyboardSource.js";   // Physical keyboard source and default map
import { isAnalogSettings, isRomFile, isRomName } from "../shared.types.js";   // Live settings and ROM-store source classification
import { isArcadeCabinetConfig, isArcadeCabinetInitConfig } from "./types.js";   // Public config guards

// Type dependencies:
import type {
    AnalogSettings,                                                // Restart-persistent analogue tuning
    ArcadeAdapter,                                                 // Resolved init backend
    FetchLike,                                                     // Player transport injection
    FrameScheduler,                                                // Injected gamepad polling clock
    RomFile,                                                       // ROM-store put value
    RomSource,                                                     // Original game source classification
    Unsubscribe,                                                   // Player exit remover
} from "../shared.types.js";
import type {
    ArcadeGameConfig,                                              // Player game copied during init
    ArcadePlayerStatus,                                            // Lifecycle transitions followed for source rebinding
} from "../ArcadePlayer/types.js";
import type { GamepadProviderLike } from "../GamepadSource/types.js";   // Browser Gamepad API wrapper
import type {
    KeyboardEventTargetLike,                                      // Injected key and blur targets
    KeyboardVisibilityTargetLike,                                 // Injected visibility boundary
} from "../KeyboardSource/types.js";
import type { RomSetReport } from "../RomSetAudit/types.js";     // audit() result
import type {
    ArcadeCabinetConfig,                                          // Direct construction config
    ArcadeCabinetInitConfig,                                      // Browser-defaulting init config
    ArcadeControlsConfig,                                         // Retained source declarations
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// TYPE :: {name:STRING, blob:Blob}
// Picked-file source retained by init until one successful audit stores it locally.
type BlobRomSource = Extract<RomSource, { readonly name: string; readonly blob: Blob }>;

// INTERFACE :: init-only values handed into construction without widening the public direct config.
interface PreparedConstruction {
    readonly blobSources: ReadonlyArray<BlobRomSource>;            // Original picked blobs eligible for the ROM store
}

// TYPE :: ArcadeCabinetConfig plus a module-private symbol field
// Keeps original game sources out of the public direct-construction contract.
type PreparedConfig = ArcadeCabinetConfig & { readonly [PREPARED]?: PreparedConstruction };

/**
 *
 * Constants
 *
 */

const PREPARED: unique symbol = Symbol("ArcadeCabinet prepared construction");   // Unexported init-to-constructor handoff
const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;                  // RFC-style scheme prefix distinguishing URLs from store basenames

// HELPER :: analogSettings -> analogSettings
// Retains a deep-frozen snapshot for future sessions.
const analogSettingsCopy = (settings: AnalogSettings = {}): AnalogSettings => Object.freeze(Object.fromEntries(
    Object.entries(settings).map(([key, setting]) => [key, Object.freeze({ ...setting })]),
) as AnalogSettings);

/**
 *
 * Functions
 *
 */

// HELPER :: romSource -> BOOLEAN
// True only for a valid basename string with no scheme or path separator.
const isStoredBasename = (source: RomSource): source is string => typeof source === "string"
    && isRomName(source)
    && !URL_SCHEME.test(source);

// HELPER :: romSource -> BOOLEAN
// True only for the picked-Blob branch of RomSource.
const isBlobSource = (source: RomSource): source is BlobRomSource => typeof source === "object"
    && source !== null
    && !isRomFile(source)
    && "blob" in source;

/**
 *
 * Class
 *
 */

// Composes a resolved player, desktop input sources and optional local persistence into one restartable cabinet.
export default class ArcadeCabinet {

    /* Instance Fields */
    private readonly _player: ArcadePlayer;                       // Player started before sources attach
    private readonly _storage: ArcadeStorage | null;              // Overlay persistence, or null when page-managed
    private readonly _romStore: ArcadeRomStore | null;            // User-local ROM store, or null
    private readonly _controls: ArcadeControlsConfig;             // Source declarations rebuilt on every start
    private readonly _keyboardTarget: KeyboardEventTargetLike | null;   // Keyboard key/blur boundary
    private readonly _eventTarget: KeyboardEventTargetLike | null;   // Gamepad blur boundary
    private readonly _visibilityTarget: KeyboardVisibilityTargetLike | null;   // Source release and autosave boundary
    private readonly _gamepadProvider: GamepadProviderLike | null;   // Gamepad snapshots
    private readonly _frameScheduler: FrameScheduler | null;      // Gamepad polling clock
    private readonly _autosave: boolean;                          // Whether hidden visibility requests a save
    private readonly _audioVolume: number;                        // Volume reapplied to every fresh session
    private readonly _blobSources: ReadonlyArray<BlobRomSource>;  // Picked sources stored only after an ok audit
    private readonly _onVisibilityChange: (event: Event) => void; // Bound autosave listener
    private _unsubscribeExit: Unsubscribe | null = null;          // Persistent player-exit subscription
    private _unsubscribeStatus: Unsubscribe | null = null;        // Persistent player-status subscription (hard-reset rebinding)
    private _keyboardEnabled = true;                              // Restart-persistent keyboard gate
    private _gamepadsEnabled = true;                              // Restart-persistent gamepad gate
    private _keyboard: KeyboardSource | null = null;              // Live keyboard source while started
    private _gamepads: GamepadSource | null = null;               // Live gamepad source while started
    private _analog: AnalogDriver | null = null;                  // Live per-session analogue driver
    private _analogSettings: AnalogSettings;                      // Settings retained across hard resets
    private _isStarted = false;                                   // Whether sources cover a running player
    private _blobsStored = false;                                 // Whether every retained picked blob was stored
    private _blobStorePromise: Promise<void> | null = null;       // Shared in-flight picked-blob write
    private _destroyed = false;                                   // Terminal cabinet state
    private _destroyPromise: Promise<void> | null = null;         // Concurrent/repeated destroy result

    // CONSTRUCTOR :: arcadeCabinetConfig -> this
    // Validates a resolved player and injected source dependencies without consulting browser globals.
    // NOTE: Structurally valid touch fields reject with UNSUPPORTED until M10.
    constructor(config: ArcadeCabinetConfig) {
        if (!isArcadeCabinetConfig(config)) throw ArcadeCabinet.invalidConfig();
        if (config.controls?.buttons !== undefined || config.controls?.dpads !== undefined || config.controls?.sticks !== undefined) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.UNSUPPORTED,
                message: "ArcadeCabinet touch controls are unavailable before M10.",
                data: null,
            });
        }
        const prepared = (config as PreparedConfig)[PREPARED];
        this._player = config.player;
        this._storage = config.storage ?? null;
        this._romStore = config.romStore ?? null;
        this._controls = config.controls ?? {};
        this._keyboardTarget = config.keyboardTarget ?? null;
        this._eventTarget = config.eventTarget ?? null;
        this._visibilityTarget = config.visibilityTarget ?? null;
        this._gamepadProvider = config.gamepadProvider ?? null;
        this._frameScheduler = config.frameScheduler ?? null;
        this._autosave = config.autosave ?? false;
        this._audioVolume = config.audio?.volume ?? 1;
        this._blobSources = prepared?.blobSources ?? [];
        this._keyboardEnabled = this._controls.keyboard?.enabled ?? true;
        this._gamepadsEnabled = this._controls.gamepads?.enabled ?? true;
        this._analogSettings = analogSettingsCopy(this._controls.analog);
        this._onVisibilityChange = () => {
            if (!this._autosave || !this._isStarted || this._player.status !== "running"
                || this._visibilityTarget?.visibilityState !== "hidden") return;
            void this.save().catch(() => undefined);
        };
        this._unsubscribeExit = this._player.on("exit", () => this.teardownControls());
        this._unsubscribeStatus = this._player.on("status", (status) => this.followPlayerStatus(status));
        if (this._autosave) this._visibilityTarget?.addEventListener("visibilitychange", this._onVisibilityChange);
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> arcadePlayer
    // The player owned by this cabinet.
    get player(): ArcadePlayer { return this._player; }

    // GETTER :: VOID -> arcadeStorage?
    // Configured overlay persistence, or null.
    get storage(): ArcadeStorage | null { return this._storage; }

    // GETTER :: VOID -> arcadeRomStore?
    // Configured local ROM store, or null.
    get romStore(): ArcadeRomStore | null { return this._romStore; }

    // GETTER :: VOID -> NULL
    // Touch mapping remains unavailable until M10.
    get mapper(): null { return null; }

    // GETTER :: VOID -> keyboardSource?
    // Live keyboard source while started with keyboard controls, else null.
    get keyboard(): KeyboardSource | null { return this._keyboard; }

    // GETTER :: VOID -> gamepadSource?
    // Live gamepad source while started with gamepad controls, else null.
    get gamepads(): GamepadSource | null { return this._gamepads; }

    // GETTER :: VOID -> analogSettings
    // Immutable settings retained for the next session and applied to the live driver.
    get analogSettings(): AnalogSettings { return this._analogSettings; }

    // GETTER :: VOID -> BOOLEAN
    // Live keyboard gate, or false while no keyboard source exists.
    get keyboardEnabled(): boolean { return this._keyboard?.enabled ?? false; }

    // SETTER :: BOOLEAN -> VOID
    // Records the keyboard gate for future starts and updates a live source.
    set keyboardEnabled(value: boolean) {
        this.requireLive();
        if (typeof value !== "boolean") throw ArcadeCabinet.invalidBoolean("keyboardEnabled", value);
        this._keyboardEnabled = value;
        if (this._keyboard !== null) this._keyboard.enabled = value;
    }

    // GETTER :: VOID -> BOOLEAN
    // Live gamepad gate, or false while no gamepad source exists.
    get gamepadsEnabled(): boolean { return this._gamepads?.enabled ?? false; }

    // SETTER :: BOOLEAN -> VOID
    // Records the gamepad gate for future starts and updates a live source.
    set gamepadsEnabled(value: boolean) {
        this.requireLive();
        if (typeof value !== "boolean") throw ArcadeCabinet.invalidBoolean("gamepadsEnabled", value);
        this._gamepadsEnabled = value;
        if (this._gamepads !== null) this._gamepads.enabled = value;
    }

    // GETTER :: VOID -> BOOLEAN
    // Whether controls are attached over a running or paused player session.
    get isStarted(): boolean { return this._isStarted; }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> PROMISE(romSetReport)
    // Forwards the player's audit and stores picked blobs only after an ok result.
    async audit(): Promise<RomSetReport> {
        this.requireLive();
        const report = await this._player.audit();
        if (report.status === "ok") await this.storeBlobSources();
        return report;
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Audits, starts the player, then creates and attaches each configured desktop source.
    // NOTE: A post-player source failure destroys every partial resource and makes the cabinet terminal.
    async start(): Promise<void> {
        this.requireLive();
        if (this._isStarted) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.ALREADY_STARTED,
            message: "ArcadeCabinet is already started.",
            data: null,
        });
        let playerStarted = false;
        try {
            await this.audit();
            await this._player.start();
            playerStarted = true;
            this.requireLive();
            this.buildControls();
            this._isStarted = true;
        } catch (error) {
            this.teardownControls();
            if (playerStarted) {
                this._destroyed = true;
                this.removeOwnedListeners();
                try { await this._player.destroy(); } catch { /* The source-construction failure remains authoritative. */ }
            }
            if (ArcadeRuntimeError.is(error)) throw error;
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.INTERNAL_ERROR,
                message: "ArcadeCabinet start failed unexpectedly.",
                data: error,
            });
        }
    }

    // INSTANCE :: analogSettings -> VOID
    // Replaces live analogue tuning and retains it for the next fresh session.
    setAnalogSettings(settings: AnalogSettings): void {
        this.requireLive();
        if (!isAnalogSettings(settings)) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadeCabinet analogue settings are invalid.",
            data: settings,
        });
        this._analogSettings = analogSettingsCopy(settings);
        this._analog?.update(this._analogSettings);
    }

    // INSTANCE :: VOID -> PROMISE(BOOLEAN)
    // Persists a non-null player overlay into configured storage; false means nothing changed.
    async save(): Promise<boolean> {
        this.requireLive();
        if (this._storage === null) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "ArcadeCabinet has no storage to save into.",
        });
        const overlay = await this._player.persist();
        if (overlay === null) return false;
        await this._storage.save(overlay);
        return true;
    }

    // INSTANCE :: STRING? -> PROMISE(VOID)
    // Writes a named emulator state, then persists its cumulative overlay.
    async quickSave(slot = "quick"): Promise<void> {
        this.requireLive();
        await this._player.saveState(slot);
        await this.save();
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Requests fullscreen through the running player.
    fullscreen(): Promise<void> {
        this.requireLive();
        return this._player.fullscreen();
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Leaves fullscreen through the player's reusable display.
    exitFullscreen(): Promise<void> {
        this.requireLive();
        return this._player.display.exitFullscreen();
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Clears overlay storage only; the separate ROM store is never modified.
    async clearSaves(): Promise<void> {
        this.requireLive();
        if (this._storage === null) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "ArcadeCabinet has no storage to clear.",
        });
        await this._storage.clear();
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Destroys sources before the player, releases every hold and remains idempotently terminal.
    destroy(): Promise<void> {
        if (this._destroyPromise !== null) return this._destroyPromise;
        if (this._destroyed) return Promise.resolve();
        this._destroyPromise = this.performDestroy();
        return this._destroyPromise;
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Builds configured sources in declaration order over the player's active input.
    private buildControls(): void {
        const input = this._player.input;
        this._player.audio.volume = this._audioVolume;
        if (this._frameScheduler !== null && input.machine.inputs.analog.length > 0) {
            this._analog = new AnalogDriver({
                input,
                inputs: input.machine.inputs.analog,
                settings: this._analogSettings,
                scheduler: this._frameScheduler,
            });
        }
        const keyboard = this._controls.keyboard;
        if (keyboard !== undefined) {
            if (this._keyboardTarget === null) throw ArcadeCabinet.invalidConfig();
            const source = new KeyboardSource({
                input,
                map: keyboard.map ?? DEFAULT_KEYBOARD_MAP,
                target: this._keyboardTarget,
                ...(this._visibilityTarget === null ? {} : { visibilityTarget: this._visibilityTarget }),
                ...(keyboard.preventDefault === undefined ? {} : { preventDefault: keyboard.preventDefault }),
            });
            this._keyboard = source;
            source.enabled = this._keyboardEnabled;
            source.attach();
        }

        const gamepads = this._controls.gamepads;
        if (gamepads !== undefined) {
            if (this._gamepadProvider === null || this._frameScheduler === null || this._eventTarget === null) throw ArcadeCabinet.invalidConfig();
            const source = new GamepadSource({
                input,
                provider: this._gamepadProvider,
                scheduler: this._frameScheduler,
                target: this._eventTarget,
                ...(this._visibilityTarget === null ? {} : { visibilityTarget: this._visibilityTarget }),
                ...(gamepads.deadZone === undefined ? {} : { deadZone: gamepads.deadZone }),
                ...(gamepads.mapping === undefined ? {} : { mapping: gamepads.mapping }),
                ...(this._analog === null ? {} : { axisFilter: (axis, value) => this._analog?.axisFilter(axis, value) ?? value }),
            });
            this._gamepads = source;
            source.enabled = this._gamepadsEnabled;
            source.attach();
        }
    }

    // PRIVATE :: arcadePlayerStatus -> VOID
    // Follows a started player across a hard reset: the old input channel dies with the old session, so sources detach
    // when the player reports starting and are rebuilt over the fresh input once it reports running (M38).
    // NOTE: An idle report while started means a hard reset failed; the cabinet then stands down like a natural exit.
    private followPlayerStatus(status: ArcadePlayerStatus): void {
        if (!this._isStarted) return;
        if (status === "starting") this.detachSources();
        else if (status === "running" && this._keyboard === null && this._gamepads === null && this._analog === null) this.buildControls();
        else if (status === "idle") this.teardownControls();
    }

    // PRIVATE :: VOID -> VOID
    // Destroys live sources in reverse construction order and tolerates channels already retired by natural player exit.
    private detachSources(): void {
        const gamepads = this._gamepads;
        this._gamepads = null;
        try { gamepads?.destroy(); } catch { /* Player natural exit destroys input channels before emitting exit. */ }
        const keyboard = this._keyboard;
        this._keyboard = null;
        try { keyboard?.destroy(); } catch { /* Player natural exit destroys input channels before emitting exit. */ }
        const analog = this._analog;
        this._analog = null;
        try { analog?.destroy(); } catch { /* Player natural exit destroys input channels before emitting exit. */ }
    }

    // PRIVATE :: VOID -> VOID
    // Detaches sources and leaves the started state; natural exit, failed restart and destroy all end here.
    private teardownControls(): void {
        this.detachSources();
        this._isStarted = false;
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Reads and stores each retained picked blob once; failures remain retryable on the next successful audit.
    private async storeBlobSources(): Promise<void> {
        if (this._romStore === null || this._blobSources.length === 0 || this._blobsStored) return;
        if (this._blobStorePromise === null) {
            this._blobStorePromise = this.performStoreBlobSources();
            this._blobStorePromise.catch(() => { this._blobStorePromise = null; });
        }
        await this._blobStorePromise;
        this._blobsStored = true;
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Converts picked blobs to RomFiles and delegates all local persistence to ArcadeRomStore.
    private async performStoreBlobSources(): Promise<void> {
        const store = this._romStore;
        if (store === null) return;
        for (const source of this._blobSources) {
            let file: RomFile;
            try {
                file = { name: source.name, bytes: new Uint8Array(await source.blob.arrayBuffer()) };
            } catch {
                throw new ArcadeRuntimeError({
                    code: ArcadeRuntimeError.CODE.ROM_LOAD_FAILED,
                    message: `The ROM ${source.name} could not be read.`,
                    data: source.name,
                });
            }
            await store.put(file);
        }
    }

    // PRIVATE :: VOID -> PROMISE(VOID)
    // Marks terminal, removes cabinet listeners, tears sources down and finally destroys the player.
    private async performDestroy(): Promise<void> {
        this._destroyed = true;
        this.removeOwnedListeners();
        this.teardownControls();
        await this._player.destroy();
    }

    // PRIVATE :: VOID -> VOID
    // Removes persistent player-exit, player-status and optional autosave subscriptions idempotently.
    private removeOwnedListeners(): void {
        try { this._unsubscribeExit?.(); } catch { /* Continue terminal cleanup across an injected remover failure. */ }
        this._unsubscribeExit = null;
        try { this._unsubscribeStatus?.(); } catch { /* Continue terminal cleanup across an injected remover failure. */ }
        this._unsubscribeStatus = null;
        if (this._autosave) {
            try { this._visibilityTarget?.removeEventListener("visibilitychange", this._onVisibilityChange); }
            catch { /* Continue terminal cleanup across an injected event target failure. */ }
        }
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after terminal cabinet cleanup begins.
    private requireLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "ArcadeCabinet has been destroyed.",
            data: null,
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: arcadeCabinetInitConfig -> PROMISE(arcadeCabinet)
    // Resolves local ROM basenames and storage, builds the player, then supplies browser source dependencies.
    static async init(config: ArcadeCabinetInitConfig): Promise<ArcadeCabinet> {
        if (!isArcadeCabinetInitConfig(config)) throw ArcadeCabinet.invalidInit();
        const controls = ArcadeCabinet.controlsWithDefaults(config.controls);
        const browserWindow = typeof globalThis.window === "undefined" ? undefined : globalThis.window;
        const browserDocument = typeof globalThis.document === "undefined" ? undefined : globalThis.document;
        const browserNavigator = typeof globalThis.navigator === "undefined" ? undefined : globalThis.navigator;

        const keyboardTarget = config.keyboardTarget ?? browserWindow;
        if (controls?.keyboard !== undefined && keyboardTarget === undefined) throw ArcadeCabinet.unsupported("window keyboard events");
        if (controls?.analog !== undefined && (browserWindow === undefined
            || typeof browserWindow.requestAnimationFrame !== "function" || typeof browserWindow.cancelAnimationFrame !== "function")) {
            throw ArcadeCabinet.unsupported("animation frames for analogue settings");
        }
        if (controls?.gamepads !== undefined && (browserWindow === undefined
            || browserNavigator === undefined || typeof browserNavigator.getGamepads !== "function"
            || typeof browserWindow.requestAnimationFrame !== "function" || typeof browserWindow.cancelAnimationFrame !== "function")) {
            throw ArcadeCabinet.unsupported("the Gamepad API and animation frames");
        }
        if ((controls?.keyboard !== undefined || controls?.gamepads !== undefined || config.autosave === true) && browserDocument === undefined) {
            throw ArcadeCabinet.unsupported("document visibility events");
        }

        const [roms, stored] = await Promise.all([
            ArcadeCabinet.resolveStoredRoms(config.game.roms, config.romStore ?? null),
            config.storage !== undefined && config.game.changes === undefined ? config.storage.load() : Promise.resolve(null),
        ]);
        const game: ArcadeGameConfig = {
            ...config.game,
            roms,
            ...(stored === null ? {} : { changes: stored }),
        };
        const playerConfig: {
            canvas: HTMLCanvasElement;
            container: HTMLElement;
            game: ArcadeGameConfig;
            adapter?: ArcadeAdapter;
            adapterConfig?: ArcadeCabinetInitConfig["adapterConfig"];
            fetch?: FetchLike;
        } = { canvas: config.canvas, container: config.container, game };
        if (config.adapter !== undefined) playerConfig.adapter = config.adapter;
        if (config.adapterConfig !== undefined) playerConfig.adapterConfig = config.adapterConfig;
        if (config.fetch !== undefined) playerConfig.fetch = config.fetch;
        const player = await ArcadePlayer.init(playerConfig);

        const direct: { -readonly [K in keyof ArcadeCabinetConfig]: ArcadeCabinetConfig[K] } = {
            player,
            ...(controls === undefined ? {} : { controls }),
            ...(config.storage === undefined ? {} : { storage: config.storage }),
            ...(config.romStore === undefined ? {} : { romStore: config.romStore }),
            ...(config.autosave === undefined ? {} : { autosave: config.autosave }),
            ...(config.audio === undefined ? {} : { audio: config.audio }),
        };
        if (keyboardTarget !== undefined) direct.keyboardTarget = keyboardTarget as unknown as KeyboardEventTargetLike;
        if (browserWindow !== undefined) direct.eventTarget = browserWindow as unknown as KeyboardEventTargetLike;
        if (browserDocument !== undefined) direct.visibilityTarget = browserDocument as unknown as KeyboardVisibilityTargetLike;
        if (browserNavigator !== undefined && typeof browserNavigator.getGamepads === "function") {
            direct.gamepadProvider = { getGamepads: () => browserNavigator.getGamepads() } as GamepadProviderLike;
        }
        if (browserWindow !== undefined && typeof browserWindow.requestAnimationFrame === "function"
            && typeof browserWindow.cancelAnimationFrame === "function") {
            direct.frameScheduler = {
                request: (callback) => browserWindow.requestAnimationFrame(callback),
                cancel: (handle) => browserWindow.cancelAnimationFrame(handle),
            };
        }
        const prepared = Object.assign(direct, {
            [PREPARED]: { blobSources: config.game.roms.filter(isBlobSource) },
        }) as PreparedConfig;
        try {
            return new ArcadeCabinet(prepared);
        } catch (error) {
            try { await player.destroy(); } catch { /* Construction failure remains authoritative. */ }
            throw error;
        }
    }

    // STATIC :: arcadeControlsConfig? -> arcadeControlsConfig?
    // Applies the package default keyboard map only when a keyboard declaration omitted one.
    private static controlsWithDefaults(controls: ArcadeControlsConfig | undefined): ArcadeControlsConfig | undefined {
        if (controls?.keyboard === undefined || controls.keyboard.map !== undefined) return controls;
        return { ...controls, keyboard: { ...controls.keyboard, map: DEFAULT_KEYBOARD_MAP } };
    }

    // STATIC :: [romSource], arcadeRomStore? -> PROMISE([romSource])
    // Replaces only bare basename strings from the local store; URL, byte and Blob sources pass through unchanged.
    private static async resolveStoredRoms(sources: ReadonlyArray<RomSource>, store: ArcadeRomStore | null): Promise<ReadonlyArray<RomSource>> {
        if (store === null) return sources;
        return Promise.all(sources.map(async (source) => {
            if (!isStoredBasename(source)) return source;
            const stored = await store.get(source);
            if (stored !== null) return stored;
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ROM_LOAD_FAILED,
                message: `The ROM ${source} was not found in the local ROM store.`,
                data: source,
            });
        }));
    }

    // STATIC :: VOID -> arcadeRuntimeError
    // Byte-free INVALID_CONFIG for construction values that may indirectly own user ROM bytes.
    private static invalidConfig(): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadeCabinet config requires a resolved player and valid injected dependencies for every configured source.",
            data: null,
        });
    }

    // STATIC :: VOID -> arcadeRuntimeError
    // Byte-free INVALID_CONFIG for init's page-level config.
    private static invalidInit(): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ArcadeCabinet.init requires valid page, game and control values plus exactly one adapter or adapterConfig.",
            data: null,
        });
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds a setter INVALID_CONFIG carrying only the rejected scalar.
    private static invalidBoolean(property: string, value: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: `ArcadeCabinet ${property} must be a boolean.`,
            data: value,
        });
    }

    // STATIC :: STRING -> arcadeRuntimeError
    // Builds an UNSUPPORTED error for an absent browser default required by configured behavior.
    private static unsupported(feature: string): ArcadeRuntimeError {
        return new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: `ArcadeCabinet.init requires ${feature}.`,
            data: null,
        });
    }
}
