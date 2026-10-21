// realizes: docs/arcade-runtime-spec.md > §5 MameEmulatorAdapter and MameSession

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";    // Pipeline API and predicate builders
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed adapter/session errors
import MameEmulatorAdapter, { MAME_FIXED_ARGUMENTS } from "../../src/MameEmulatorAdapter/MameEmulatorAdapter.ts";
import OverlayCodec, { type OverlayHeader } from "../../src/MameEmulatorAdapter/OverlayCodec.ts";   // Persisted overlay inspection
import { isMameEmulatorAdapterConfig, isMameEmulatorAdapterInitConfig } from "../../src/MameEmulatorAdapter/types.ts";
import controllerConfigFor from "../../src/ControllerConfig/controllerConfigFor.ts";   // Exact expected web.cfg
import dipConfigFor from "../../src/DipConfig/dipConfigFor.ts";   // Exact expected machine cfg
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts"; // Deterministic 60/120 Hz host ticks
import FakeModuleLoader from "../support/FakeModuleLoader.ts";     // Required W0 loader double
import { errorSnapshot, rejectedBy, thrownBy, validBuildInfo, validMachineInfo, type ErrorSnapshot } from "../support/fixtures.ts";

// Type dependencies:
import type { RomSetMetadata } from "../../src/RomSetAudit/types.ts";   // Synthetic role/size metadata
import type { ArcadeSession, ArcadeStartConfig, BuildInfo, FetchLike, MachineInfo } from "../../src/shared.types.ts";
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: Module.web callback surface driven by these tests.
interface FakeWeb {
    onTick(): void;
    onFrame(pointer: number, width: number, height: number): void;
    onSound(pointer: number, frames: number): void;
    onStateDone(ok: number): void;
    onExit(): void;
    onFrontendDone(result: number): void;
    onLog(level: number, pointer: number): void;
}

// INTERFACE :: one fake FS write, retaining the argument identity for copy assertions.
interface FileWrite {
    readonly path: string;
    readonly argument: Uint8Array;
}

/**
 *
 * Test Doubles
 *
 */

// In-memory subset of Emscripten FS used by the adapter and session.
class FakeFS {
    readonly directories = new Set<string>(["/"]);
    readonly files = new Map<string, Uint8Array>();
    readonly writes: FileWrite[] = [];

    mkdirTree(path: string): void {
        const parts = path.split("/").filter(Boolean);
        let current = "";
        for (const part of parts) {
            current += `/${part}`;
            this.directories.add(current);
        }
    }

    writeFile(path: string, bytes: Uint8Array): void {
        this.mkdirTree(path.slice(0, path.lastIndexOf("/")) || "/");
        this.writes.push({ path, argument: bytes });
        this.files.set(path, bytes.slice());
    }

    readFile(path: string): Uint8Array { return this.files.get(path)?.slice() ?? (() => { throw new Error("missing file"); })(); }

    readdir(path: string): string[] {
        if (!this.directories.has(path)) throw new Error(`missing directory ${path}`);
        const prefix = path === "/" ? "/" : `${path}/`;
        const names = new Set<string>();
        for (const directory of this.directories) {
            if (directory.startsWith(prefix) && directory !== path) {
                const rest = directory.slice(prefix.length);
                if (rest !== "") names.add(rest.split("/")[0]!);
            }
        }
        for (const file of this.files.keys()) {
            if (file.startsWith(prefix)) names.add(file.slice(prefix.length).split("/")[0]!);
        }
        return [".", "..", ...names];
    }

    stat(path: string): { mode: number } {
        if (this.directories.has(path)) return { mode: 0x4000 };
        if (this.files.has(path)) return { mode: 0x8000 };
        throw new Error(`missing path ${path}`);
    }

    isDir(mode: number): boolean { return (mode & 0xf000) === 0x4000; }
}

// Scriptable private module shape with recording bridge exports.
class FakeMameModule {
    readonly FS = new FakeFS();
    readonly HEAPU8 = new Uint8Array(1024 * 1024);
    readonly HEAPF32 = new Float32Array(this.HEAPU8.buffer);
    web: FakeWeb | null = null;
    readonly mainCalls: string[][] = [];
    readonly runCalls: number[] = [];
    readonly controlCalls: Array<readonly [number, number, number]> = [];
    readonly stateCalls: Array<readonly ["save" | "load", string]> = [];
    pumpCalls = 0;
    pauseCalls = 0;
    resumeCalls = 0;
    resetCalls = 0;
    flushResult = 0;
    exitCalls = 0;
    autoExit = false;
    onCallMain: (() => void) | null = null;
    private readonly _strings = new Map<number, string>();

    constructor(info: Omit<MachineInfo, "family"> = machineInfoWithoutFamily()) {
        this._strings.set(100, JSON.stringify(info));
    }

    setString(pointer: number, value: string): void { this._strings.set(pointer, value); }

    UTF8ToString(pointer: number): string { return this._strings.get(pointer) ?? ""; }

    callMain(arguments_: readonly string[]): void {
        this.mainCalls.push([...arguments_]);
        this.onCallMain?.();
    }

    cwrap(name: string): (...args: Array<number | string>) => number | void {
        const functions: Record<string, (...args: Array<number | string>) => number | void> = {
            web_run_frames: (count) => { this.runCalls.push(Number(count)); return Number(count); },
            web_pump: () => { this.pumpCalls++; },
            web_set_control: (pad, item, pressed) => { this.controlCalls.push([Number(pad), Number(item), Number(pressed)]); },
            web_pause: () => { this.pauseCalls++; },
            web_resume: () => { this.resumeCalls++; },
            web_reset: () => { this.resetCalls++; },
            web_save_state: (slot) => { this.stateCalls.push(["save", String(slot)]); },
            web_load_state: (slot) => { this.stateCalls.push(["load", String(slot)]); },
            web_flush_nvram: () => this.flushResult,
            web_exit: () => { this.exitCalls++; if (this.autoExit) this.web?.onExit(); },
            web_machine_info: () => 100,
        };
        const found = functions[name];
        if (found === undefined) throw new Error(`unknown cwrap ${name}`);
        return found;
    }
}

/**
 *
 * Constants and Helpers
 *
 */

const BUILD_URL = "/mame/synthetic/";

const adapterBuild = (): BuildInfo => ({
    ...validBuildInfo(),
    artifacts: ["mamefake-family.js", "mamefake-family.wasm"],
});                                                               // Fixture adjusted to the strict mame<engine> artifact convention

const machineInfoWithoutFamily = (overrides: Partial<MachineInfo> = {}): Omit<MachineInfo, "family"> => {
    const { family: _family, ...base } = validMachineInfo();
    return { ...base, ...overrides };
};

const startConfig = (overrides: Partial<ArcadeStartConfig> = {}): ArcadeStartConfig => ({
    machine: "fake",
    machineHints: { players: 2, buttons: 6 },
    roms: [{ name: "fake.zip", bytes: new Uint8Array([1, 2, 3]) }],
    ...overrides,
});

const metadata = (): RomSetMetadata => ({
    machine: "fake",
    family: "fake-family",
    description: "Synthetic Machine",
    cloneof: null,
    romof: null,
    bios: ["default"],
    sampleof: null,
    archives: [
        { name: "fake.zip", role: "game" },
        { name: "audio.zip", role: "samples" },
    ],
    roms: [{ name: "program.bin", size: 1_024, crc: "00000000", sha1: null, archive: "fake.zip", optional: true }],
    dipswitches: [{
        name: "Difficulty",
        tag: "DSWA",
        mask: 3,
        values: [
            { name: "Easy", value: 3, default: true },
            { name: "Medium", value: 0, default: false },
        ],
    }],
    samples: [{ name: "voice.wav", archive: "audio.zip" }],
});

const jsonResponse = (value: unknown): { ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> } => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(value)).buffer,
});

const metadataFetch = (value: RomSetMetadata = metadata()): FetchLike => async () => jsonResponse(value);

const adapterWith = (module: FakeMameModule, config: {
    readonly scheduler?: FakeFrameScheduler;
    readonly build?: BuildInfo;
    readonly fetch?: FetchLike;
} = {}): { adapter: MameEmulatorAdapter; loader: FakeModuleLoader; scheduler: FakeFrameScheduler } => {
    const loader = new FakeModuleLoader().resolveWith(module);
    const scheduler = config.scheduler ?? new FakeFrameScheduler();
    return {
        adapter: new MameEmulatorAdapter({
            buildUrl: BUILD_URL,
            build: config.build ?? adapterBuild(),
            loadModule: loader.load,
            scheduler,
            clock: () => scheduler.now,
            fetch: config.fetch,
        }),
        loader,
        scheduler,
    };
};

const webFrom = async (loader: FakeModuleLoader): Promise<FakeWeb> => {
    for (let turn = 0; turn < 20 && loader.factoryCalls.length === 0; turn++) await Promise.resolve();
    const web = loader.factoryCalls[0]?.["web"];
    if (typeof web !== "object" || web === null) throw new Error("factory was not called with Module.web");
    // The adapter installs its first-frame handler a few microtasks after instantiation; wait for it rather than
    // assuming a hop count, so a frame emitted by the test is never dropped as "before start".
    for (let turn = 0; turn < 200 && (web as { firstFrame?: unknown }).firstFrame == null; turn++) await Promise.resolve();
    return web as FakeWeb;
};

const startAndFrame = async (module: FakeMameModule, config: {
    readonly adapter?: MameEmulatorAdapter;
    readonly loader?: FakeModuleLoader;
    readonly start?: ArcadeStartConfig;
    readonly scheduler?: FakeFrameScheduler;
} = {}): Promise<{ session: ArcadeSession; web: FakeWeb; scheduler: FakeFrameScheduler }> => {
    const setup = config.adapter === undefined || config.loader === undefined
        ? adapterWith(module, { scheduler: config.scheduler })
        : { adapter: config.adapter, loader: config.loader, scheduler: config.scheduler ?? new FakeFrameScheduler() };
    const promise = setup.adapter.start(config.start ?? startConfig());
    const web = await webFrom(setup.loader);
    web.onFrame(0, 384, 224);
    return { session: await promise, web, scheduler: setup.scheduler };
};

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const testFile: TestFile = {
    label: "MameEmulatorAdapter",
    cases: [
        {
            label: "constructor and init configs have structural predicates and build/artifact agreement is enforced",
            run: () => CTGTest.init("MAME adapter config")
                .assert("predicate snapshot", () => {
                    const module = new FakeMameModule();
                    const loader = new FakeModuleLoader().resolveWith(module);
                    const scheduler = new FakeFrameScheduler();
                    const valid = { buildUrl: BUILD_URL, build: adapterBuild(), loadModule: loader.load, scheduler, clock: () => scheduler.now };
                    return {
                        config: isMameEmulatorAdapterConfig(valid),
                        missingLoader: isMameEmulatorAdapterConfig({ buildUrl: BUILD_URL, build: validBuildInfo() }),
                        init: isMameEmulatorAdapterInitConfig({ buildUrl: BUILD_URL }),
                        badInitFetch: isMameEmulatorAdapterInitConfig({ buildUrl: BUILD_URL, fetch: 1 }),
                        wrongAdapter: errorSnapshot(thrownBy(() => new MameEmulatorAdapter({ ...valid, build: { ...adapterBuild(), adapter: "libretro" } })), ArcadeRuntimeError),
                        missingArtifact: errorSnapshot(thrownBy(() => new MameEmulatorAdapter({ ...valid, build: { ...adapterBuild(), artifacts: ["other.js"] } })), ArcadeRuntimeError),
                    };
                }, P.equals<unknown>({
                    config: true,
                    missingLoader: false,
                    init: true,
                    badInitFetch: false,
                    wrongAdapter: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    missingArtifact: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                }))
                .start(undefined),
        },
        {
            label: "init fetches build.json, validates it and resolves the family artifact relative to buildUrl",
            run: () => CTGTest.init("MAME adapter init")
                .stage("initialize", async () => {
                    const module = new FakeMameModule();
                    const loader = new FakeModuleLoader().resolveWith(module);
                    const scheduler = new FakeFrameScheduler();
                    const urls: string[] = [];
                    const fetch: FetchLike = async (url) => { urls.push(url); return jsonResponse(adapterBuild()); };
                    const adapter = await MameEmulatorAdapter.init({ buildUrl: BUILD_URL, fetch, loadModule: loader.load, scheduler, clock: () => scheduler.now });
                    const start = adapter.start(startConfig());
                    const web = await webFrom(loader);
                    web.onFrame(0, 384, 224);
                    await start;
                    return { urls, moduleUrl: loader.loadCalls[0]?.url, family: adapter.family, type: adapter.type };
                })
                .assert("URLs and identity", (state) => state.subject, P.equals<unknown>({
                    urls: [`${BUILD_URL}build.json`, `${BUILD_URL}romsets/fake.json`],
                    moduleUrl: `${BUILD_URL}mamefake-family.js`,
                    family: "fake-family",
                    type: "mame",
                }))
                .start(undefined),
        },
        {
            label: "start mounts the complete MEMFS layout, copies role-classified ROMs, writes web.cfg and passes exact argv",
            run: () => CTGTest.init("MAME startup layout")
                .stage("start through first frame", async () => {
                    const module = new FakeMameModule();
                    const setup = adapterWith(module, { fetch: metadataFetch() });
                    const gameBytes = new Uint8Array([1, 2]);
                    const sampleBytes = new Uint8Array([3, 4]);
                    const config = startConfig({
                        roms: [{ name: "fake.zip", bytes: gameBytes }, { name: "audio.zip", bytes: sampleBytes }],
                        bios: "default",
                        options: { samplerate: 44_100, frameskip: 2 },
                    });
                    let resolved = false;
                    const start = setup.adapter.start(config).then((session) => { resolved = true; return session; });
                    const web = await webFrom(setup.loader);
                    await Promise.resolve();
                    const beforeFrame = resolved;
                    web.onFrame(0, 384, 224);
                    const session = await start;
                    gameBytes[0] = 9;
                    sampleBytes[0] = 9;
                    return {
                        beforeFrame,
                        sampleRate: session.sampleRate,
                        directories: [...module.FS.directories].filter((path) => path.startsWith("/mame/")).sort(),
                        game: Array.from(module.FS.files.get("/mame/roms/fake.zip") ?? []),
                        sample: Array.from(module.FS.files.get("/mame/samples/audio.zip") ?? []),
                        copied: module.FS.writes.find((write) => write.path.endsWith("fake.zip"))?.argument !== gameBytes
                            && module.FS.writes.find((write) => write.path.endsWith("audio.zip"))?.argument !== sampleBytes,
                        controller: new TextDecoder().decode(module.FS.files.get("/mame/ctrlr/web.cfg")),
                        argv: module.mainCalls[0],
                    };
                })
                .assert("layout and argv", (state) => state.subject, P.equals<unknown>({
                    beforeFrame: false,
                    sampleRate: 44_100,
                    directories: ["/mame/cfg", "/mame/ctrlr", "/mame/memcard", "/mame/nvram", "/mame/roms", "/mame/samples", "/mame/sta"],
                    game: [1, 2],
                    sample: [3, 4],
                    copied: true,
                    controller: controllerConfigFor({ players: 2, select: false }),
                    argv: ["fake", ...MAME_FIXED_ARGUMENTS.map((value, index, all) => all[index - 1] === "-samplerate" ? "44100" : value), "-bios", "default", "-frameskip", "2"],
                }))
                .start(undefined),
        },
        {
            label: "DIP selections overwrite restored machine cfg before callMain and remain excluded from persistence snapshots",
            run: () => CTGTest.init("MAME DIP cfg")
                .stage("start with a restored cfg and selected DIP", async () => {
                    const module = new FakeMameModule();
                    const setup = adapterWith(module, { fetch: metadataFetch() });
                    const header: OverlayHeader = {
                        format: "arcade-runtime-overlay", version: 1, adapter: "mame",
                        engine: "fake-family", buildId: setup.adapter.build.buildId, machine: "fake",
                    };
                    const changes = OverlayCodec.encode({ "cfg/fake.cfg": new TextEncoder().encode("restored") }, header);
                    const { session } = await startAndFrame(module, {
                        adapter: setup.adapter,
                        loader: setup.loader,
                        scheduler: setup.scheduler,
                        start: startConfig({ changes, dipswitches: { Difficulty: "Medium" } }),
                    });
                    const generated = new TextDecoder().decode(module.FS.files.get("/mame/cfg/fake.cfg"));
                    const bootPersist = await session.persist();
                    module.FS.writeFile("/mame/cfg/fake.cfg", new TextEncoder().encode("changed by MAME"));
                    const generatedOnlyPersist = await session.persist();
                    module.FS.writeFile("/mame/cfg/operator.cfg", new Uint8Array([7]));
                    const withOperator = await session.persist();
                    const tree = withOperator === null ? {} : OverlayCodec.decode(withOperator, header);
                    return {
                        generated,
                        expected: dipConfigFor("fake", metadata().dipswitches, { Difficulty: "Medium" }),
                        bootPersist,
                        generatedOnlyPersist,
                        persistedPaths: Object.keys(tree),
                    };
                })
                .assert("generated cfg and dirty exclusions", (state) => state.subject, P.equals<unknown>({
                    generated: dipConfigFor("fake", metadata().dipswitches, { Difficulty: "Medium" }),
                    expected: dipConfigFor("fake", metadata().dipswitches, { Difficulty: "Medium" }),
                    bootPersist: null,
                    generatedOnlyPersist: null,
                    persistedPaths: ["cfg/operator.cfg"],
                }))
                .start(undefined),
        },
        {
            label: "unknown DIP names reject before module load and unreachable metadata rejects as UNSUPPORTED",
            run: () => CTGTest.init("MAME DIP validation")
                .stage("collect validation failures", async () => {
                    const unknownSwitch = adapterWith(new FakeMameModule(), { fetch: metadataFetch() });
                    const unknownSetting = adapterWith(new FakeMameModule(), { fetch: metadataFetch() });
                    const unreachable = adapterWith(new FakeMameModule(), {
                        fetch: async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }),
                    });
                    const errors = await Promise.all([
                        rejectedBy(unknownSwitch.adapter.start(startConfig({ dipswitches: { Cabinet: "Upright" } }))),
                        rejectedBy(unknownSetting.adapter.start(startConfig({ dipswitches: { Difficulty: "Impossible" } }))),
                        rejectedBy(unreachable.adapter.start(startConfig({ dipswitches: { Difficulty: "Medium" } }))),
                    ]);
                    return {
                        errors: errors.map((error) => ({
                            ...errorSnapshot(error, ArcadeRuntimeError),
                            message: error instanceof Error ? error.message : "",
                        })),
                        loads: unknownSwitch.loader.loadCalls.length + unknownSetting.loader.loadCalls.length + unreachable.loader.loadCalls.length,
                    };
                })
                .assert("typed pre-load failures", (state) => state.subject, P.equals<unknown>({
                    errors: [
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG", message: "Unknown DIP switch \"Cabinet\"." },
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG", message: "Unknown setting \"Impossible\" for DIP switch \"Difficulty\"." },
                        { isRuntimeError: true, code: 15, label: "UNSUPPORTED", message: "DIP switch names cannot be validated because the machine's romset metadata is unavailable." },
                    ],
                    loads: 0,
                }))
                .start(undefined),
        },
        {
            label: "Neo Geo start restores or creates an exact-size memory card and mounts it through the memcard image option",
            run: () => CTGTest.init("MAME memory-card mount")
                .stage("start fresh and restored cards", async () => {
                    const build: BuildInfo = {
                        ...adapterBuild(),
                        engine: "neogeo",
                        artifacts: ["mameneogeo.js", "mameneogeo.wasm"],
                    };
                    const header: OverlayHeader = {
                        format: "arcade-runtime-overlay", version: 1, adapter: "mame",
                        engine: "neogeo", buildId: build.buildId, machine: "fake",
                    };
                    const restoredCard = new Uint8Array(0x800).fill(0x5a);
                    const changes = OverlayCodec.encode({ "memcard/fake.bin": restoredCard }, header);

                    const freshModule = new FakeMameModule();
                    const freshSetup = adapterWith(freshModule, { build });
                    await startAndFrame(freshModule, { adapter: freshSetup.adapter, loader: freshSetup.loader });

                    const restoredModule = new FakeMameModule();
                    const restoredSetup = adapterWith(restoredModule, { build });
                    await startAndFrame(restoredModule, {
                        adapter: restoredSetup.adapter,
                        loader: restoredSetup.loader,
                        start: startConfig({ changes }),
                    });

                    return {
                        freshBytes: Array.from(freshModule.FS.files.get("/mame/memcard/fake.bin") ?? []),
                        freshArgv: freshModule.mainCalls[0],
                        restoredBytes: Array.from(restoredModule.FS.files.get("/mame/memcard/fake.bin") ?? []),
                        restoredWrites: restoredModule.FS.writes.filter((write) => write.path === "/mame/memcard/fake.bin").length,
                        restoredArgv: restoredModule.mainCalls[0],
                    };
                })
                .assert("card bytes and image arguments", (state) => ({
                    freshLength: state.subject.freshBytes.length,
                    freshZeroed: state.subject.freshBytes.every((byte) => byte === 0),
                    freshTail: state.subject.freshArgv?.slice(-2),
                    restoredLength: state.subject.restoredBytes.length,
                    restoredPattern: state.subject.restoredBytes.every((byte) => byte === 0x5a),
                    restoredWrites: state.subject.restoredWrites,
                    restoredTail: state.subject.restoredArgv?.slice(-2),
                }), P.equals<unknown>({
                    freshLength: 0x800,
                    freshZeroed: true,
                    freshTail: ["-memcard", "/mame/memcard/fake.bin"],
                    restoredLength: 0x800,
                    restoredPattern: true,
                    restoredWrites: 1,
                    restoredTail: ["-memcard", "/mame/memcard/fake.bin"],
                }))
                .start(undefined),
        },
        {
            label: "memory rejection uses metadata sizes or the 2x-ROM fallback and happens before module loading",
            run: () => CTGTest.init("MAME memory budget")
                .stage("reject both estimates", async () => {
                    const build = { ...adapterBuild(), memoryPages: 1 };
                    const fallback = adapterWith(new FakeMameModule(), { build });
                    const reachable = adapterWith(new FakeMameModule(), {
                        build,
                        fetch: metadataFetch({ ...metadata(), roms: [{ ...metadata().roms[0]!, size: 50_000 }] }),
                    });
                    const bytes = new Uint8Array(20_000);
                    const fallbackError = await rejectedBy(fallback.adapter.start(startConfig({ roms: [{ name: "fake.zip", bytes }] })));
                    const metadataError = await rejectedBy(reachable.adapter.start(startConfig({ roms: [{ name: "fake.zip", bytes: new Uint8Array(1) }] })));
                    return {
                        fallback: errorSnapshot(fallbackError, ArcadeRuntimeError),
                        metadata: errorSnapshot(metadataError, ArcadeRuntimeError),
                        loads: fallback.loader.loadCalls.length + reachable.loader.loadCalls.length,
                    };
                })
                .assert("both are MEMORY_EXCEEDED before load", (state) => state.subject, P.equals<unknown>({
                    fallback: { isRuntimeError: true, code: 17, label: "MEMORY_EXCEEDED" },
                    metadata: { isRuntimeError: true, code: 17, label: "MEMORY_EXCEEDED" },
                    loads: 0,
                }))
                .start(undefined),
        },
        {
            label: "missing-file frontend completion preserves ordered logs as ROM_SET_INVALID and drops callbacks",
            run: () => CTGTest.init("MAME missing ROM classification")
                .stage("fail callMain", async () => {
                    const module = new FakeMameModule();
                    module.setString(201, "first error");
                    module.setString(202, "second warning");
                    module.onCallMain = () => {
                        module.web?.onLog(0, 201);
                        module.web?.onLog(1, 202);
                        module.web?.onFrontendDone(2);
                    };
                    const setup = adapterWith(module);
                    const error = await rejectedBy(setup.adapter.start(startConfig()));
                    const originalWeb = (setup.loader.factoryCalls[0]?.["web"] as FakeWeb);
                    originalWeb.onLog(0, 201);
                    return {
                        identity: errorSnapshot(error, ArcadeRuntimeError),
                        data: ArcadeRuntimeError.is(error) ? error.data : null,
                        callbacksDropped: module.web !== originalWeb,
                    };
                })
                .assert("classification", (state) => state.subject, P.equals<unknown>({
                    identity: { isRuntimeError: true, code: 6, label: "ROM_SET_INVALID" },
                    data: [{ level: 0, text: "first error" }, { level: 1, text: "second warning" }],
                    callbacksDropped: true,
                }))
                .start(undefined),
        },
        {
            label: "other frontend results plus load, factory and machine-info failures become ADAPTER_FAILED",
            run: () => CTGTest.init("MAME adapter failure normalization")
                .stage("collect failures", async () => {
                    const frontendModule = new FakeMameModule();
                    frontendModule.onCallMain = () => frontendModule.web?.onFrontendDone(1);
                    const frontend = adapterWith(frontendModule);
                    const load = new FakeModuleLoader().rejectLoadWith(new Error("load"));
                    const factory = new FakeModuleLoader().rejectFactoryWith(new Error("factory"));
                    const scheduler = new FakeFrameScheduler();
                    const fromLoader = (loader: FakeModuleLoader): MameEmulatorAdapter => new MameEmulatorAdapter({
                        buildUrl: BUILD_URL, build: adapterBuild(), loadModule: loader.load, scheduler, clock: () => scheduler.now,
                    });
                    const badInfoModule = new FakeMameModule();
                    badInfoModule.setString(100, "{}");
                    const badInfo = adapterWith(badInfoModule);
                    const badInfoStart = badInfo.adapter.start(startConfig());
                    const badInfoWeb = await webFrom(badInfo.loader);
                    badInfoWeb.onFrame(0, 384, 224);
                    return Promise.all([
                        rejectedBy(frontend.adapter.start(startConfig())),
                        rejectedBy(fromLoader(load).start(startConfig())),
                        rejectedBy(fromLoader(factory).start(startConfig())),
                        rejectedBy(badInfoStart),
                    ]).then((errors) => errors.map((error) => errorSnapshot(error, ArcadeRuntimeError)));
                })
                .assert("every failure is typed", (state) => state.subject, P.equals<ErrorSnapshot[]>(Array.from({ length: 4 }, () => ({
                    isRuntimeError: true, code: 4, label: "ADAPTER_FAILED",
                }))))
                .start(undefined),
        },
        {
            label: "native-period pacing stays within one frame at 59.637 and 60.606 Hz on 60 and 120 Hz hosts",
            run: () => CTGTest.init("MAME pacing accumulator")
                .stage("simulate four ten-second combinations", async () => {
                    const results: Array<{ refresh: number; host: number; frames: number }> = [];
                    for (const refresh of [59.637, 60.606]) {
                        for (const host of [60, 120]) {
                            const scheduler = new FakeFrameScheduler();
                            const module = new FakeMameModule(machineInfoWithoutFamily({ refreshHz: refresh }));
                            const setup = adapterWith(module, { scheduler });
                            const started = await startAndFrame(module, { adapter: setup.adapter, loader: setup.loader, scheduler });
                            for (let tick = 0; tick < host * 10; tick++) scheduler.tick(1000 / host);
                            results.push({ refresh, host, frames: sum(module.runCalls) });
                            module.autoExit = true;
                            await started.session.exit();
                        }
                    }
                    return results.map((result) => ({ ...result, withinOne: Math.abs(result.frames - result.refresh * 10) <= 1 }));
                })
                .assert("all combinations", (state) => state.subject, P.equals<unknown>([
                    { refresh: 59.637, host: 60, frames: 596, withinOne: true },
                    { refresh: 59.637, host: 120, frames: 596, withinOne: true },
                    { refresh: 60.606, host: 60, frames: 606, withinOne: true },
                    { refresh: 60.606, host: 120, frames: 606, withinOne: true },
                ]))
                .start(undefined),
        },
        {
            label: "pacing caps one tick at four periods, discards excess, pumps while paused and resets on resume",
            run: () => CTGTest.init("MAME pacing edge behavior")
                .stage("drive pacing states", async () => {
                    const scheduler = new FakeFrameScheduler();
                    const module = new FakeMameModule(machineInfoWithoutFamily({ refreshHz: 60 }));
                    const setup = adapterWith(module, { scheduler });
                    const { session } = await startAndFrame(module, { adapter: setup.adapter, loader: setup.loader, scheduler });
                    scheduler.tick(1000);
                    scheduler.tick(1);
                    session.pause();
                    scheduler.tick(500);
                    scheduler.tick(500);
                    session.resume();
                    scheduler.tick(1);
                    scheduler.tick(1000 / 60);
                    return { runs: module.runCalls, pumps: module.pumpCalls, pause: module.pauseCalls, resume: module.resumeCalls };
                })
                .assert("cap, discard and pause behavior", (state) => state.subject, P.equals<unknown>({
                    runs: [4, 1], pumps: 2, pause: 1, resume: 1,
                }))
                .start(undefined),
        },
        {
            label: "heap callbacks copy into reused buffers and control mapping ignores unavailable ports",
            run: () => CTGTest.init("MAME callbacks and controls")
                .stage("emit heap callbacks", async () => {
                    const module = new FakeMameModule(machineInfoWithoutFamily({ players: 2, buttons: 2 }));
                    const { session, web } = await startAndFrame(module);
                    let tickCount = 0;
                    let frame: number[] = [];
                    let sound: number[] = [];
                    session.onTick(() => { tickCount++; });
                    session.onFrame((event) => { frame = Array.from(event.rgba); });
                    session.onSound((event) => { sound = Array.from(event.samples); });
                    module.HEAPU8.set([1, 2, 3, 4], 16);
                    module.HEAPF32.set([0.25, -0.5], 8);
                    web.onTick();
                    web.onFrame(16, 1, 1);
                    web.onSound(8 * 4, 1);
                    module.HEAPU8.fill(9, 16, 20);
                    module.HEAPF32.fill(9, 8, 10);
                    session.setControl({ kind: "direction", player: 1, direction: "right" }, true);
                    session.setControl({ kind: "button", player: 2, button: 2 }, false);
                    session.setControl({ kind: "button", player: 2, button: 3 }, true);
                    session.setControl({ kind: "coin", player: 3 }, true);
                    session.setControl({ kind: "select", player: 1 }, true);
                    session.setControl({ kind: "service" }, true);
                    return { tickCount, frame, sound, controls: module.controlCalls };
                })
                .assert("copies and mappings", (state) => state.subject, P.equals<unknown>({
                    tickCount: 1,
                    frame: [1, 2, 3, 4],
                    sound: [0.25, -0.5],
                    controls: [[0, 3, 1], [1, 5, 0], [0, 13, 1]],
                }))
                .start(undefined),
        },
        {
            label: "state operations serialize, report failures, and hard reset is explicitly unsupported",
            run: () => CTGTest.init("MAME state lifecycle")
                .stage("drive state callbacks", async () => {
                    const module = new FakeMameModule();
                    const { session, web } = await startAndFrame(module);
                    const save = session.saveState("slot-1");
                    const overlap = await rejectedBy(session.loadState("slot-2"));
                    web.onStateDone(1);
                    await save;
                    const load = session.loadState("slot-1");
                    web.onStateDone(0);
                    const loadError = await rejectedBy(load);
                    return {
                        calls: module.stateCalls,
                        overlap: errorSnapshot(overlap, ArcadeRuntimeError),
                        load: errorSnapshot(loadError, ArcadeRuntimeError),
                        hard: errorSnapshot(thrownBy(() => session.reset("hard")), ArcadeRuntimeError),
                    };
                })
                .assert("state results", (state) => state.subject, P.equals<unknown>({
                    calls: [["save", "slot-1"], ["load", "slot-1"]],
                    overlap: { isRuntimeError: true, code: 14, label: "STATE_FAILED" },
                    load: { isRuntimeError: true, code: 14, label: "STATE_FAILED" },
                    hard: { isRuntimeError: true, code: 15, label: "UNSUPPORTED" },
                }))
                .start(undefined),
        },
        {
            label: "persist is null when unchanged, then returns a complete cumulative overlay and advances its snapshot",
            run: () => CTGTest.init("MAME cumulative persistence")
                .stage("persist three times", async () => {
                    const module = new FakeMameModule();
                    const { session } = await startAndFrame(module);
                    const first = await session.persist();
                    module.FS.writeFile("/mame/nvram/device.nv", new Uint8Array([1, 2, 3]));
                    module.FS.writeFile("/mame/sta/slot.sta", new Uint8Array([4, 5]));
                    module.FS.writeFile("/mame/memcard/fake.bin", new Uint8Array([6, 7]));
                    const second = await session.persist();
                    const third = await session.persist();
                    const header: OverlayHeader = {
                        format: "arcade-runtime-overlay", version: 1, adapter: "mame",
                        engine: "fake-family", buildId: "0".repeat(64), machine: "fake",
                    };
                    const tree = second === null ? {} : OverlayCodec.decode(second, header);
                    return {
                        first,
                        second: Object.fromEntries(Object.entries(tree).map(([path, bytes]) => [path, Array.from(bytes)])),
                        third,
                    };
                })
                .assert("dirty detection and cumulative roots", (state) => state.subject, P.equals<unknown>({
                    first: null,
                    second: { "memcard/fake.bin": [6, 7], "nvram/device.nv": [1, 2, 3], "states/slot.sta": [4, 5] },
                    third: null,
                }))
                .start(undefined),
        },
        {
            label: "exit waits for onExit, stops scheduling, drops the module and every later method is DESTROYED",
            run: () => CTGTest.init("MAME terminal exit")
                .stage("exit and probe methods", async () => {
                    const module = new FakeMameModule();
                    module.autoExit = true;
                    const { session, scheduler } = await startAndFrame(module);
                    let exits = 0;
                    session.onExit(() => { exits++; });
                    await session.exit();
                    const sync = [
                        () => session.setControl({ kind: "service" }, true),
                        () => session.pause(), () => session.resume(), () => session.reset("soft"),
                        () => session.saveState("slot"), () => session.loadState("slot"),
                        () => session.onTick(() => {}), () => session.onFrame(() => {}), () => session.onSound(() => {}), () => session.onExit(() => {}),
                        () => session.exit(),
                    ].map((call) => errorSnapshot(thrownBy(call), ArcadeRuntimeError));
                    const persist = errorSnapshot(await rejectedBy(session.persist()), ArcadeRuntimeError);
                    return { exits, pending: scheduler.pending, exitCalls: module.exitCalls, sync, persist };
                })
                .assert("terminal behavior", (state) => state.subject, P.equals<unknown>({
                    exits: 1,
                    pending: 0,
                    exitCalls: 1,
                    sync: Array.from({ length: 11 }, () => ({ isRuntimeError: true, code: 10, label: "DESTROYED" })),
                    persist: { isRuntimeError: true, code: 10, label: "DESTROYED" },
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
