// realizes: docs/arcade-runtime-spec.md > §5 MameEmulatorAdapter

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Sole typed failure class
import controllerConfigFor from "../ControllerConfig/controllerConfigFor.js";   // Deterministic MAME 0.161 web.cfg
import dipConfigFor from "../DipConfig/dipConfigFor.js";          // Validated per-machine DIP cfg text
import { isRomSetMetadata, type RomSetMetadata } from "../RomSetAudit/types.js";   // Optional roles, BIOS and size metadata
import {
    isArcadeStartConfig,                                          // Guards every start request
    isBuildInfo,                                                  // Guards fetched build.json
    isMachineInfo,                                                // Guards bridge-discovered machine metadata
} from "../shared.types.js";
import MameSession, { restoreOverlayTree, snapshotPersistedTree, type MameWebCallbacks } from "./MameSession.js";   // Live session and overlay helpers
import OverlayCodec, { type OverlayHeader } from "./OverlayCodec.js";   // Incoming/outgoing overlay identity
import {
    isMameEmulatorAdapterConfig,                                  // Guards deterministic construction
    isMameEmulatorAdapterInitConfig,                              // Guards browser-default initialization
} from "./types.js";

// Type dependencies:
import type {
    ArcadeAdapter,                                                // Contract this adapter implements
    ArcadeSession,                                                // start() result contract
    ArcadeStartConfig,                                            // Start request
    BuildInfo,                                                    // Validated family-build metadata
    FetchLike,                                                    // Metadata fetch boundary
    FrameScheduler,                                               // Pacing scheduler boundary
    MachineInfo,                                                  // Bridge-discovered machine description
    ModuleLoader,                                                 // Modular build loading boundary
} from "../shared.types.js";
import type {
    MameClock,                                                    // Pacing clock boundary
    MameEmulatorAdapterConfig,                                    // Constructor config
    MameEmulatorAdapterInitConfig,                                // Async factory config
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: MEMFS subset required during startup.
interface StartupFileSystem {
    mkdirTree(path: string): void;
    writeFile(path: string, bytes: Uint8Array): void;
    readFile(path: string, options?: { readonly encoding?: "binary" }): Uint8Array | string;
    readdir(path: string): string[];
    stat(path: string): { readonly mode: number };
    isDir(mode: number): boolean;
}

// INTERFACE :: private Emscripten surface required by startup and MameSession.
// It remains deliberately unexported.
interface StartupModule {
    readonly FS: StartupFileSystem;
    readonly HEAPU8: Uint8Array;
    readonly HEAPF32: Float32Array;
    web?: unknown;
    callMain(arguments_: readonly string[]): void;
    cwrap(name: string, returnType: string | null, argumentTypes: readonly string[]): (...args: Array<number | string>) => number | void;
    UTF8ToString(pointer: number): string;
}

// INTERFACE :: one ordered native log record attached to ROM_SET_INVALID.
interface MameLogRecord {
    readonly level: number;
    readonly text: string;
}

// INTERFACE :: callback router object installed as Module.web.
interface WebRouter {
    target: MameWebCallbacks | null;
    active: boolean;
    frontendResult: number | null;
    readonly logs: MameLogRecord[];
    firstFrame: ((pointer: number, width: number, height: number) => void) | null;
    frontendFailure: ((result: number) => void) | null;
    onTick(): void;
    onFrame(pointer: number, width: number, height: number): void;
    onSound(pointer: number, frames: number): void;
    onStateDone(ok: number): void;
    onExit(): void;
    onFrontendDone(result: number): void;
    onLog(level: number, pointer: number): void;
}

/**
 *
 * Constants
 *
 */

export const MAME_FIXED_ARGUMENTS: readonly string[] = Object.freeze([
    "-rompath", "/mame/roms",
    "-samplepath", "/mame/samples",
    "-video", "web",
    "-sound", "web",
    "-samplerate", "48000",
    "-nothrottle",
    "-noautoframeskip",
    "-joystick",
    "-ctrlr", "web",
    "-ctrlrpath", "/mame/ctrlr",
    "-cfg_directory", "/mame/cfg",
    "-nvram_directory", "/mame/nvram",
    "-state_directory", "/mame/sta",
    "-skip_gameinfo",
    "-noautosave",
    "-nomouse",
    "-rotate",
]);                                                               // Exact fixed 0.161 argv following the machine name

const MEMFS_DIRECTORIES = [
    "/mame/roms", "/mame/samples", "/mame/nvram", "/mame/cfg", "/mame/sta", "/mame/ctrlr", "/mame/memcard",
] as const;                                                       // Mounted before any input file is written
const NEOGEO_FAMILY = "neogeo";                                  // The 0.161 family exposing the memcard image device
const MEMORY_CARD_BYTES = 0x800;                                 // ng_memcard_device::call_load exact image size
const MISSING_FILES_RESULT = 2;                                   // MAMERR_MISSING_FILES in MAME 0.161
const DEFAULT_SAMPLE_RATE = 48_000;                               // §4.5 mixer default

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN -> arcadeRuntimeError
// Standard constructor/start invalid-config rejection.
const invalid = (data: unknown, message = "MameEmulatorAdapter configuration is invalid."): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
    message,
    data,
});

// HELPER :: STRING, STRING -> STRING
// Resolves an artifact relative to absolute or root-relative build directories without consulting globals.
const resolveBuildUrl = (buildUrl: string, relative: string): string => {
    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(relative) || relative.startsWith("//") || relative.startsWith("/")) return relative;
    if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(buildUrl) || buildUrl.startsWith("//")) return new URL(relative, buildUrl.endsWith("/") ? buildUrl : `${buildUrl}/`).href;
    return `${buildUrl.endsWith("/") ? buildUrl : `${buildUrl}/`}${relative.replace(/^\.\//, "")}`;
};

// HELPER :: buildInfo -> STRING
// Artifact filename required by the direct-MAME family convention.
const expectedJavaScript = (build: BuildInfo): string => `mame${build.engine}.js`;

// PREDICATE :: UNKNOWN -> BOOLEAN
// Narrows the private module contract shared with MameSession.
const isStartupModule = (value: unknown): value is StartupModule => {
    if (typeof value !== "object" || value === null) return false;
    const module = value as StartupModule;
    const fs = module.FS;
    return typeof fs === "object" && fs !== null
        && typeof fs.mkdirTree === "function"
        && typeof fs.writeFile === "function"
        && typeof fs.readFile === "function"
        && typeof fs.readdir === "function"
        && typeof fs.stat === "function"
        && typeof fs.isDir === "function"
        && typeof module.callMain === "function"
        && typeof module.cwrap === "function"
        && typeof module.UTF8ToString === "function"
        && module.HEAPU8 instanceof Uint8Array
        && module.HEAPF32 instanceof Float32Array;
};

// HELPER :: VOID -> frameScheduler
// Builds the real browser animation-frame dependency for init().
const browserScheduler = (): FrameScheduler => {
    if (typeof globalThis.requestAnimationFrame !== "function" || typeof globalThis.cancelAnimationFrame !== "function") {
        throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "MAME pacing requires requestAnimationFrame.",
            data: null,
        });
    }
    return {
        request: globalThis.requestAnimationFrame.bind(globalThis),
        cancel: globalThis.cancelAnimationFrame.bind(globalThis),
    };
};

// HELPER :: VOID -> mameClock
// Builds the real monotonic browser clock for init().
const browserClock = (): MameClock => {
    if (typeof globalThis.performance?.now !== "function") throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.UNSUPPORTED,
        message: "MAME pacing requires performance.now().",
        data: null,
    });
    return globalThis.performance.now.bind(globalThis.performance);
};

// HELPER :: STRING -> PROMISE(emscriptenModuleFactory)
// Default init loader. The family build is classic modularized output that installs a global createMame, so
// init injects it as a classic script once per URL and reads the global; a page may inject its own ModuleLoader instead.
const scriptLoaders = new Map<string, Promise<Awaited<ReturnType<ModuleLoader>>>>();
const loadClassicScript: ModuleLoader = (url) => {
    const existing = scriptLoaders.get(url);
    if (existing !== undefined) return existing;
    const pending = new Promise<Awaited<ReturnType<ModuleLoader>>>((resolve, reject) => {
        const documentValue = (globalThis as { document?: Document }).document;
        if (documentValue === undefined) {
            reject(new Error("The default MAME module loader needs a document; inject loadModule instead."));
            return;
        }
        const script = documentValue.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = () => {
            const candidate = (globalThis as { createMame?: unknown }).createMame;
            if (typeof candidate === "function") resolve(candidate as Awaited<ReturnType<ModuleLoader>>);
            else reject(new Error("The build script did not install createMame."));
        };
        script.onerror = () => reject(new Error(`The build script at ${url} failed to load.`));
        documentValue.head.appendChild(script);
    });
    scriptLoaders.set(url, pending);
    pending.catch(() => { scriptLoaders.delete(url); });
    return pending;
};

// HELPER :: emscriptenModuleFactory, {[STRING]:UNKNOWN} -> PROMISE(OBJECT)
// Instantiates a build and resolves once its runtime is initialized. The 1.38.31 MODULARIZE factory returns the
// Module object itself, which carries a `then` method; awaiting it directly resolves to a thenable that resolves to
// itself and spins the microtask queue forever. The module is therefore awaited through onRuntimeInitialized and
// its `then` is removed before anything else can await it. A loader that already returns a real Promise still works.
const instantiateModule = (factory: Awaited<ReturnType<ModuleLoader>>, options: Readonly<Record<string, unknown>>): Promise<object> =>
    new Promise<object>((resolve, reject) => {
        let instance: Record<string, unknown> | null = null;
        let settled = false;
        const finish = (value: object): void => {
            if (settled) return;
            settled = true;
            if (Object.prototype.hasOwnProperty.call(value, "then")) delete (value as Record<string, unknown>)["then"];
            resolve(value);
        };
        const fail = (reason: unknown): void => {
            if (settled) return;
            settled = true;
            reject(reason instanceof Error ? reason : new Error(String(reason)));
        };
        let produced: unknown;
        try {
            produced = factory({
                ...options,
                onRuntimeInitialized: () => { if (instance !== null) finish(instance); },
                onAbort: (reason: unknown) => fail(reason),
            });
        } catch (error) {
            fail(error);
            return;
        }
        if (produced instanceof Promise) {
            produced.then((value) => finish(value as object), fail);
            return;
        }
        if (typeof produced !== "object" || produced === null) {
            fail(new Error("The build factory did not return a module."));
            return;
        }
        instance = produced as Record<string, unknown>;
        if (instance["calledRun"] === true) finish(instance);
    });

// HELPER :: UNKNOWN -> STRING
// Serializes a fetched byte body as UTF-8 text.
const utf8 = (bytes: ArrayBuffer): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when a module failure is Emscripten's fixed-heap exhaustion: abort("OOM") from the 1.38 runtime or the
// "Cannot enlarge memory arrays" message of a fixed, non-growing heap. Any other abort stays ADAPTER_FAILED.
const isOutOfMemoryAbort = (error: unknown): boolean => {
    const text = error instanceof Error ? error.message : String(error);
    return /abort\("?OOM"?\)|Cannot enlarge memory arrays|out of memory/i.test(text);
};

/**
 *
 * Class
 *
 */

// Direct MAME family adapter over the production web bridge.
export default class MameEmulatorAdapter implements ArcadeAdapter {

    /* Instance Fields */
    readonly type = "mame" as const;                              // Adapter identity
    private readonly _buildUrl: string;                           // Artifact directory
    private readonly _build: BuildInfo;                           // Validated build metadata
    private readonly _loadModule: ModuleLoader;                   // Injected module loader
    private readonly _scheduler?: FrameScheduler;                 // Injected by tests or init()
    private readonly _clock?: MameClock;                           // Injected by tests or init()
    private readonly _fetch?: FetchLike;                           // Optional romsets metadata transport

    // CONSTRUCTOR :: mameEmulatorAdapterConfig -> this
    // Stores only injected values and validates adapter/artifact agreement without reading globals.
    constructor(config: MameEmulatorAdapterConfig) {
        if (!isMameEmulatorAdapterConfig(config)) throw invalid(config);
        const expected = expectedJavaScript(config.build);
        if (config.build.adapter !== "mame" || !config.build.artifacts.includes(expected)) throw invalid(config.build, `build.json must describe a MAME build containing ${expected}.`);
        this._buildUrl = config.buildUrl;
        this._build = config.build;
        this._loadModule = config.loadModule;
        this._scheduler = config.scheduler;
        this._clock = config.clock;
        this._fetch = config.fetch;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> buildInfo
    get build(): BuildInfo { return this._build; }

    // GETTER :: VOID -> STRING
    get family(): string { return this._build.engine; }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: arcadeStartConfig -> PROMISE(arcadeSession)
    // Budgets, mounts and starts a fresh module, resolving only on its first valid frame.
    async start(config: ArcadeStartConfig): Promise<ArcadeSession> {
        if (!isArcadeStartConfig(config)) throw invalid(config, "MAME start configuration is invalid.");
        if (!this._build.machines.includes(config.machine)) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.MACHINE_NOT_IN_BUILD,
            message: "The requested machine is not present in this family build.",
            data: config.machine,
        });
        const { sampleRate, optionArguments, fixedArguments } = this.argumentsFor(config);
        const metadata = await this.metadataFor(config.machine);
        if (config.bios !== undefined && metadata !== null && (metadata.bios.length === 0 || !metadata.bios.includes(config.bios))) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.UNSUPPORTED,
                message: "The requested BIOS is not offered by this machine.",
                data: config.bios,
            });
        }
        const dipSelections = config.dipswitches ?? {};
        const dipNames = Object.keys(dipSelections);
        let dipConfig: string | null = null;
        if (dipNames.length > 0) {
            if (metadata === null) throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.UNSUPPORTED,
                message: "DIP switch names cannot be validated because the machine's romset metadata is unavailable.",
                data: dipNames,
            });
            dipConfig = dipConfigFor(config.machine, metadata.dipswitches, dipSelections);
        }
        this.assertMemoryBudget(config, metadata);

        const scheduler = this._scheduler ?? browserScheduler();
        const clock = this._clock ?? browserClock();
        const moduleUrl = resolveBuildUrl(this._buildUrl, expectedJavaScript(this._build));
        let module: StartupModule | null = null;
        let startupHandle: number | null = null;
        let rejectFirstFrame: ((reason: unknown) => void) | null = null;
        const router = this.router(() => module);
        const dropModule = (): void => {
            if (startupHandle !== null) scheduler.cancel(startupHandle);
            startupHandle = null;
            router.active = false;
            router.target = null;
            router.firstFrame = null;
            router.frontendFailure = null;
            rejectFirstFrame = null;
            if (module !== null) module.web = {};
            module = null;
        };

        try {
            const factory = await this._loadModule(moduleUrl);
            const created = await instantiateModule(factory, {
                noInitialRun: true,
                print: (): void => {},
                printErr: (): void => {},
                locateFile: (name: unknown): string => resolveBuildUrl(this._buildUrl, String(name)),
                web: router,
            });
            if (!isStartupModule(created)) throw new Error("The loaded object does not match the MAME module contract.");
            module = created;
            module.web = router;
            for (const directory of MEMFS_DIRECTORIES) module.FS.mkdirTree(directory);
            this.writeRoms(module, config, metadata);
            module.FS.writeFile("/mame/ctrlr/web.cfg", new TextEncoder().encode(controllerConfigFor({ players: config.machineHints.players, select: false })));

            const overlayHeader: OverlayHeader = {
                format: "arcade-runtime-overlay",
                version: 1,
                adapter: "mame",
                engine: this._build.engine,
                buildId: this._build.buildId,
                machine: config.machine,
            };
            if (config.changes !== undefined) restoreOverlayTree(module, OverlayCodec.decode(config.changes.slice(), overlayHeader));
            const dipConfigPath = `/mame/cfg/${config.machine}.cfg`;
            if (dipConfig !== null) module.FS.writeFile(dipConfigPath, new TextEncoder().encode(dipConfig));
            const memoryCardPath = this.prepareMemoryCard(module, config.machine);
            const ignoredPaths = ["cfg/web.cfg", ...(dipConfig === null ? [] : [`cfg/${config.machine}.cfg`])];

            let mainError: unknown = undefined;
            try {
                module.callMain([
                    config.machine,
                    ...fixedArguments,
                    ...(memoryCardPath === null ? [] : ["-memcard", memoryCardPath]),
                    ...(config.bios === undefined ? [] : ["-bios", config.bios]),
                    ...optionArguments,
                ]);
            } catch (error) {
                mainError = error;
            }
            if (router.frontendResult !== null) throw this.frontendError(router.frontendResult, router.logs);
            if (mainError !== undefined) throw mainError;

            const firstFrame = new Promise<MameSession>((resolve, reject) => {
                rejectFirstFrame = reject;
                router.firstFrame = (pointer, width, height) => {
                    if (startupHandle !== null) scheduler.cancel(startupHandle);
                    startupHandle = null;
                    try {
                        const machine = this.readMachineInfo(module!);
                        const flushNvram = module!.cwrap("web_flush_nvram", "number", []) as () => number;
                        if (flushNvram() !== 0) throw new Error("web_flush_nvram failed while establishing the boot snapshot");
                        const initialSnapshot = snapshotPersistedTree(module!, ignoredPaths);
                        const session = new MameSession({
                            module: module!,
                            machine,
                            sampleRate,
                            scheduler,
                            clock,
                            overlayHeader,
                            initialSnapshot,
                            ignoredPaths,
                            dropModule,
                        });
                        router.target = session;
                        session.receiveFrame(pointer, width, height);
                        session.begin();
                        resolve(session);
                    } catch (error) {
                        reject(error);
                    }
                };
                router.frontendFailure = (result) => { reject(this.frontendError(result, router.logs)); };
            });
            const runFirstFrame = module.cwrap("web_run_frames", "number", ["number"]) as (count: number) => number;
            startupHandle = scheduler.request(() => {
                startupHandle = null;
                try {
                    runFirstFrame(1);
                } catch (error) {
                    router.firstFrame = null;
                    router.frontendFailure = null;
                    const failure = new ArcadeRuntimeError({
                        code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                        message: "MAME failed while advancing to its first frame.",
                        data: error,
                    });
                    rejectFirstFrame?.(failure);
                }
            });
            const started = await firstFrame;
            router.firstFrame = null;
            router.frontendFailure = null;
            rejectFirstFrame = null;
            return started;
        } catch (error) {
            router.target?.abort?.();
            dropModule();
            if (ArcadeRuntimeError.is(error)) throw error;
            if (isOutOfMemoryAbort(error)) throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.MEMORY_EXCEEDED,
                message: `The machine needs more memory than this family build provides (${Math.round((this._build.memoryPages * 65_536) / 1_048_576)} MiB fixed heap).`,
                data: { memoryPages: this._build.memoryPages, cause: error },
            });
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "The MAME module failed to load, instantiate or start.",
                data: error,
            });
        }
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: mameEmulatorAdapterInitConfig -> PROMISE(mameEmulatorAdapter)
    // Fetches and validates build.json and supplies browser defaults for omitted dependencies.
    static async init(config: MameEmulatorAdapterInitConfig): Promise<MameEmulatorAdapter> {
        if (!isMameEmulatorAdapterInitConfig(config)) throw invalid(config);
        const fetcher = config.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) as FetchLike : undefined);
        if (fetcher === undefined) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "MameEmulatorAdapter.init requires fetch.",
            data: null,
        });
        let build: unknown;
        try {
            const response = await fetcher(resolveBuildUrl(config.buildUrl, "build.json"));
            if (!response.ok) throw new Error(`build.json request failed with status ${response.status}`);
            build = JSON.parse(utf8(await response.arrayBuffer()));
        } catch (error) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "The MAME build metadata could not be fetched or parsed.",
                data: error,
            });
        }
        if (!isBuildInfo(build)) throw invalid(build, "The fetched build.json is invalid.");
        const expected = expectedJavaScript(build);
        if (build.adapter !== "mame" || !build.artifacts.includes(expected)) throw invalid(build, `build.json must describe a MAME build containing ${expected}.`);
        return new MameEmulatorAdapter({
            buildUrl: config.buildUrl,
            build,
            loadModule: config.loadModule ?? loadClassicScript,
            scheduler: config.scheduler ?? browserScheduler(),
            clock: config.clock ?? browserClock(),
            fetch: fetcher,
        });
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: arcadeStartConfig -> normalized sample rate and argv sections
    // Accepts only the §4.5 frameskip/samplerate pass-through keys.
    private argumentsFor(config: ArcadeStartConfig): { sampleRate: number; fixedArguments: string[]; optionArguments: string[] } {
        const options = config.options ?? {};
        const unsupported = Object.keys(options).filter((key) => key !== "frameskip" && key !== "samplerate");
        if (unsupported.length > 0) throw invalid(unsupported, "MAME options support only frameskip and samplerate.");
        const samplerate = options["samplerate"] ?? DEFAULT_SAMPLE_RATE;
        if (typeof samplerate !== "number" || !Number.isInteger(samplerate) || samplerate <= 0) throw invalid(samplerate, "samplerate must be a positive integer.");
        const fixedArguments = [...MAME_FIXED_ARGUMENTS];
        fixedArguments[fixedArguments.indexOf("-samplerate") + 1] = String(samplerate);
        const optionArguments: string[] = [];
        if (options["frameskip"] !== undefined) {
            const frameskip = options["frameskip"];
            if (typeof frameskip !== "number" || !Number.isInteger(frameskip) || frameskip < 0 || frameskip > 10) throw invalid(frameskip, "frameskip must be an integer from 0 through 10.");
            optionArguments.push("-frameskip", String(frameskip));
        }
        return { sampleRate: samplerate, fixedArguments, optionArguments };
    }

    // PRIVATE :: startupModule, STRING -> STRING?
    // Restores an incoming Neo Geo card first, or materializes the exact-size blank image required by call_load().
    private prepareMemoryCard(module: StartupModule, machine: string): string | null {
        if (this._build.engine !== NEOGEO_FAMILY) return null;
        const path = `/mame/memcard/${machine}.bin`;
        try {
            module.FS.stat(path);
        } catch {
            module.FS.writeFile(path, new Uint8Array(MEMORY_CARD_BYTES));
        }
        return path;
    }

    // PRIVATE :: STRING -> PROMISE(romSetMetadata?)
    // Returns null on an unreachable or invalid optional metadata document so startup can use its documented fallback.
    private async metadataFor(machine: string): Promise<RomSetMetadata | null> {
        if (this._fetch === undefined) return null;
        try {
            const metadataBase = resolveBuildUrl(this._buildUrl, this._build.romsetsUrl);
            const response = await this._fetch(resolveBuildUrl(metadataBase, `${encodeURIComponent(machine)}.json`));
            if (!response.ok) return null;
            const parsed: unknown = JSON.parse(utf8(await response.arrayBuffer()));
            return isRomSetMetadata(parsed) && parsed.machine === machine && parsed.family === this._build.engine ? parsed : null;
        } catch {
            return null;
        }
    }

    // PRIVATE :: arcadeStartConfig, romSetMetadata? -> VOID
    // Rejects before module loading when supplied zip bytes plus the region estimate reach 75% of fixed memory.
    private assertMemoryBudget(config: ArcadeStartConfig, metadata: RomSetMetadata | null): void {
        const romBytes = config.roms.reduce((sum, rom) => sum + rom.bytes.byteLength, 0);
        const regionBytes = metadata === null
            ? romBytes * 2
            : metadata.roms.reduce((sum, rom) => sum + rom.size, 0);
        const estimate = romBytes + regionBytes;
        const budget = this._build.memoryPages * 65_536 * 0.75;
        if (!Number.isSafeInteger(estimate) || estimate >= budget) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.MEMORY_EXCEEDED,
            message: "The supplied ROMs and machine regions exceed the safe fixed-memory budget.",
            data: { estimatedBytes: estimate, budgetBytes: budget },
        });
    }

    // PRIVATE :: startupModule, arcadeStartConfig, romSetMetadata? -> VOID
    // Copies every ROM into the metadata-selected ROM or sample directory.
    private writeRoms(module: StartupModule, config: ArcadeStartConfig, metadata: RomSetMetadata | null): void {
        const roles = new Map(metadata?.archives.map((archive) => [archive.name.toLowerCase(), archive.role]) ?? []);
        for (const rom of config.roms) {
            const directory = roles.get(rom.name.toLowerCase()) === "samples" ? "/mame/samples" : "/mame/roms";
            module.FS.writeFile(`${directory}/${rom.name}`, rom.bytes.slice());
        }
    }

    // PRIVATE :: startupModule -> machineInfo
    // Parses web_machine_info JSON and adds the immutable family from build.json.
    private readMachineInfo(module: StartupModule): MachineInfo {
        try {
            const machineInfo = module.cwrap("web_machine_info", "number", []) as () => number;
            const pointer = machineInfo();
            const parsed: unknown = JSON.parse(module.UTF8ToString(pointer));
            const withFamily = typeof parsed === "object" && parsed !== null ? { ...parsed, family: this._build.engine } : parsed;
            if (!isMachineInfo(withFamily)) throw new Error("web_machine_info returned invalid metadata");
            return withFamily;
        } catch (error) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "MAME did not report valid machine metadata.",
                data: error,
            });
        }
    }

    // PRIVATE :: (() -> startupModule?), -> webRouter
    // Creates callbacks that dynamically fan out and become inert together on cleanup.
    private router(moduleValue: () => StartupModule | null): WebRouter {
        const router: WebRouter = {
            target: null,
            active: true,
            frontendResult: null,
            logs: [],
            firstFrame: null,
            frontendFailure: null,
            onTick: () => { if (router.active) router.target?.receiveTick(); },
            onFrame: (pointer, width, height) => {
                if (!router.active) return;
                if (router.target !== null) router.target.receiveFrame(pointer, width, height);
                else router.firstFrame?.(pointer, width, height);
            },
            onSound: (pointer, frames) => { if (router.active) router.target?.receiveSound(pointer, frames); },
            onStateDone: (ok) => { if (router.active) router.target?.receiveStateDone(ok); },
            onExit: () => { if (router.active) router.target?.receiveExit(); },
            onFrontendDone: (result) => {
                if (!router.active || router.firstFrame === null && router.target !== null) return;
                router.frontendResult = result;
                router.frontendFailure?.(result);
            },
            onLog: (level, pointer) => {
                if (!router.active) return;
                const module = moduleValue();
                router.logs.push({ level, text: module === null ? "" : module.UTF8ToString(pointer) });
            },
        };
        return router;
    }

    // PRIVATE :: NUMBER, [mameLogRecord] -> arcadeRuntimeError
    // Classifies pre-frame frontend completion with ordered log records.
    private frontendError(result: number, logs: ReadonlyArray<MameLogRecord>): ArcadeRuntimeError {
        return result === MISSING_FILES_RESULT
            ? new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ROM_SET_INVALID,
                message: "MAME rejected the supplied ROM set.",
                data: logs.map((record) => ({ ...record })),
            })
            : new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ADAPTER_FAILED,
                message: "MAME frontend returned before the first frame.",
                data: { result, logs: logs.map((record) => ({ ...record })) },
            });
    }
}
