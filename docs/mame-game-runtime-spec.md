# Headless Browser MAME Runtime — Implementation Spec

**Status:** draft implementation contract. Companion project to
[`dos-game-runtime-ts`](https://github.com/mastergray/dos-game-runtime-ts),
and built on the same model: a headless runtime that owns *how the
emulator runs* and how video, audio and input cross the browser
boundary, while a game's page owns layout, controls and their meaning.
A manifest describes a game once; a shared shell and build turn it into
a standalone folder.

The difference from the DOS runtime is where the emulator comes from.
js-dos shipped a prebuilt WASM engine and a command interface, so the
DOS runtime only had to wrap it. Here the project **builds MAME source
with Emscripten** and owns the browser bridge:

- **Direct MAME path (built first).** Compile a pinned MAME source tree
  with a small C++ web OSD/bridge. The initial compatibility target is
  the official `mame0161` tag. The bridge hands frames and samples to
  JavaScript instead of opening native devices and takes input from
  JavaScript instead of SDL events.
- **Optional libretro path (later).** After direct MAME reaches feature
  parity, FBNeo, MAME 2003-Plus or a libretro MAME core may implement the
  same adapter boundary as performance/coverage alternatives. Their ROM
  sets and behavior are labeled separately; they never stand in for or
  prove direct-MAME compatibility.

The WebAssembly artifact and native comparison baseline are both built from
the authenticated source tag. Prebuilt platform executables are not inputs to
the runtime or its acceptance evidence.

Target content is early-'90s arcade hardware: Capcom CPS-1, SNK Neo
Geo, Sega System 16/18/32, Irem M72/M92, Konami boards of the period,
Data East and Taito F2. Full-speed desktop and phone play is an
acceptance target, not an assumption; the probes in §13 record which
cores and board families actually meet it.

The sibling checkout at `/home/mastergray/dev/dos-game-runtime-js` is
the behavioral reference. Its package name is `dos-game-runtime-ts`.
The same conventions apply here: `ctg-js-test` for the `spec` suite,
`ctg-js-browser-test` for the `browser` suite, and the
injected-environment rule (constructors never read globals; `init`
supplies browser defaults). Where this document says "as in the DOS
runtime", the named DOS behavior applies unless this document replaces
it explicitly. This document wins if the two conflict.

---

## 0. Product contract

The product is both a TypeScript library and a static-game builder. It
is successful when an arcade deployment can be authored, played and
hosted through the same workflow as a DOS deployment:

1. A page can compose `ArcadePlayer`, input sources, touch primitives,
   storage and its own HTML/CSS directly through the public API.
2. A manifest can describe the same deployment without game-specific
   runtime code.
3. `build-manifests` can emit a relocatable folder containing the page,
   runtime, emulator build and the deployment's ROM inputs.
4. That folder supports desktop keyboard/gamepad play and phone/tablet
   touch play, including sound unlock, fullscreen, pause, reset and
   persistent saves.
5. Emulator details do not escape the adapter boundary. Switching a
   manifest between compatible adapter builds does not change the
   player, controls, shell or storage APIs.

### 0.1 DOS parity baseline

"The same as the DOS runtime" means feature parity at the deployment
boundary, not identical emulator internals:

| DOS runtime capability | Arcade runtime counterpart |
| ---------------------- | -------------------------- |
| `EmulatorAdapter` / `EmulatorSession` | `ArcadeAdapter` / `ArcadeSession` |
| `DosPlayer` | `ArcadePlayer` |
| `DosInput` | `ArcadeInput`, using player/button/coin/start controls instead of PC devices |
| `DosDisplay` / `DosAudio` | `ArcadeDisplay` / `ArcadeAudio` |
| `KeyboardSource`, pointer primitives, mapper | `KeyboardSource`, the shared pointer primitives, `ArcadeMapper` |
| `DosStorage` | `ArcadeStorage` |
| `DosDeployment` | `ArcadeDeployment` |
| manifest, shared shell, static build | arcade manifest, shared shell, static build |

Parity requires equivalent lifecycle and failure semantics: validated
construction, asynchronous `start`, explicit pause/resume, idempotent
input holds, cleanup after partial startup failure, one terminal
`destroy`, typed runtime errors, injectable browser dependencies and
tests at the same public boundary.

Arcade-specific additions are ROM-set auditing, parent/BIOS handling,
machine metadata, coin/start/service/test controls, upright rotation,
save states and emulator-build selection. DOS-specific keyboard/mouse
semantics are not copied when an arcade machine does not have those
devices.

### 0.2 Definition of the first usable release

The first usable release is M0 through M8 in §12. It needs a pinned
direct-MAME source build and at least one legally authorized automated
test ROM acquired separately from its approved source. The initial pin is
MAME 0.161 so the browser build can be compared against a source-built native
baseline from the same ROM-set generation. If the M0 probe proves 0.161
technically infeasible, work stops at a written decision gate: the project
chooses another explicit MAME source release or accepts a ROM migration. It
does not silently substitute FBNeo. Every manifest labels its adapter and
ROM-set lineage so arbitrary ROM zips are never implied to be interchangeable.

### 0.3 ROM ownership and local fixtures

The runtime, npm package, source repository and automated build outputs
do not ship third-party commercial ROM data. A user-supplied deployment
may copy ROMs into its private output only when the user asks it to.
Commercial and user-supplied files under this checkout's `res/` directory are
local manual probe inputs, not package fixtures: do not import, publish, hash
them into source, or copy them into a default build. The selected M0 fixture,
its identity, ROM hashes and driver-specific target definition remain local
rather than becoming repository metadata. In particular, clone sets and BIOS-
based machines often need parent or BIOS zips that are not inferable from a
filename alone; `pack-roms` must report those dependencies from the selected
build's DAT/audit data.

### 0.4 Emulator licensing

ROM rights and emulator-source rights are separate gates. M0 records
the exact licence files and redistribution/commercial-use conditions of
the pinned 0.161 source; every `build.json` names those licences and the
static builder copies required notices beside the WASM. The npm package
does not publish a prebuilt MAME binary by default. No tagged release or
hosted demo distributes an emulator artifact until its pinned source,
patches and distribution method have passed that licence review.

---

## 1. Package

### 1.1 Identity

| Field               | Value |
| ------------------- | ----- |
| Package name        | `mame-game-runtime-ts` |
| Consumer            | A game deployment: a page that owns its HTML, layout, ROM files and control mappings |
| Runtime environment | Evergreen browsers with WebAssembly, Pointer Events, `AudioContext`, Gamepad API, `requestAnimationFrame` |
| Test environment    | Node ≥ 22.13 (`spec`); Chromium through `ctg-js-browser-test` (`browser`) |
| Primary emulator    | MAME 0.161 source, subject to the M0 feasibility gate, built with a pinned emsdk and the in-repo web bridge |
| Upgrade path        | Later pinned MAME source releases reuse the direct bridge after their own compatibility/performance probes |
| Runtime JS deps     | `fflate` (zip read/write for the save overlay), confined to the internal overlay codec |
| Shared mechanics    | `Button`, `DPad`, `AnalogStick`, `Trackpad` ported unchanged from the DOS runtime and re-exported here; they emit mechanical events only |
| Optional cores      | FBNeo, MAME 2003-Plus and libretro MAME, built **after** direct-MAME parity and driven without RetroArch (§5b) |

### 1.2 Layout

```
mame-game-runtime-ts/
    mame/
        VERSION                 # initial pinned MAME tag: mame0161
        EMSDK_VERSION           # pinned emsdk version for that tag
        patches/                # bridge patch set, applied in order
            0001-web-osd-modules.patch
            0002-web-bridge-exports.patch
            0003-nvram-flush.patch
        bridge/                 # C++ sources the patches add (kept here for review)
            web_video.cpp
            web_sound.cpp
            web_input.cpp
            web_bridge.cpp
            web_bridge.h
        builds/                 # build matrix: one JSON per board family
            cps1.json
            neogeo.json
            system16.json
    libretro/
        cores/                  # one JSON per core: repo, pinned commit, make invocation
            fbneo.json
            mame2003_plus.json
        shim/                   # the C frontend linked with each core
            libretro_web.c
            libretro_web.h
            libretro.h          # vendored from libretro-common at a pinned commit
        maps/                   # per-core ArcadeControl → RETRO_DEVICE_ID_JOYPAD tables
            fbneo.json
            mame2003_plus.json
    src/
        index.ts
        shared.types.ts
        ArcadeRuntimeError/
        MameEmulatorAdapter/
        ArcadeInput/
        ArcadeDisplay/
        ArcadeAudio/
        ArcadePlayer/
        KeyboardSource/
        GamepadSource/
        Button/
        DPad/
        AnalogStick/
        Trackpad/
        ArcadeMapper/
        ArcadeStorage/
        ArcadeDeployment/
        LibretroAdapter/        # optional, after direct-MAME release
    manifests/
        shell/
            shell.ts
            manifest.schema.json
    scripts/
        build-mame.ts           # checkout, patch, emmake, copy artifacts
        build-libretro.ts       # checkout, build and link a core with the shim
        probe-mame0161-tiny.sh  # builds ROM-free and private local-game probes
        pack-roms.ts            # validates a manifest's ROM set
        build-manifests.ts
        serve-harness.ts
    tests/
        run.ts
        support/
        spec/
        browser/
    docs/
        mame-game-runtime-spec.md
        probes/
    package.json
    tsconfig.json
    tsconfig.package.json
    tsconfig.tests.json
```

Class folders are in implementation order; later classes import from
earlier ones, never the reverse.

### 1.3 The replacement boundary

As in the DOS runtime, everything above the adapter talks only to two
interfaces, `ArcadeAdapter` and `ArcadeSession` (§2). Two classes may
implement them:

- **`MameEmulatorAdapter`** (§5) drives the pinned MAME source build
  through the web bridge (§4). This is the required, first-built path.
- **`LibretroAdapter`** (§5b) drives an optional libretro core through a
  C shim. It is built only after the direct MAME path reaches the first
  usable release and never changes the public runtime above the adapter.

Only those two folders load an Emscripten module. A grep for the module
loader across `src/` must return exactly those two. Nothing above the
adapters knows which one is running; a manifest picks one with
`load.adapter` (§11.1). Omitting the adapter type in programmatic config
means direct MAME, never libretro.

### 1.4 Public package surface

The root export mirrors the DOS package's organization. The first
usable release exports `ArcadeRuntimeError`, `MameEmulatorAdapter`,
`ArcadeInput`, `ArcadeDisplay`,
`ArcadeAudio`, `ArcadePlayer`, `KeyboardSource`, `GamepadSource`,
`ArcadeMapper`, `ArcadeStorage`, `ArcadeDeployment`, and the four shared
pointer primitives. It also exports every public config/event type and
its structural predicate. Internal Emscripten module types, DAT parsers
and overlay helpers are not public.

`LibretroAdapter` and its core-specific types enter the root export only
if M12 is implemented and shipped; the first direct-MAME release does
not expose a placeholder adapter.

The package exposes these subpaths:

| Export | Resolves to |
| ------ | ----------- |
| `mame-game-runtime-ts` | compiled library and declarations in `dist/` |
| `mame-game-runtime-ts/shell` | manifest `mount()` entry point |
| `mame-game-runtime-ts/manifest` | manifest types, predicates and schema |
| `mame-game-runtime-ts/package.json` | package metadata |

Node scripts expose `mame-build-manifests`, `mame-pack-roms` and
`mame-serve-dir` bins. Package tarballs include compiled library files,
the shell, manifest schema/types and those bins, but exclude ROMs,
test fixtures, emulator source caches and locally built emulator
artifacts. Emulator artifacts are deployment inputs, not npm package
payload, unless a future release explicitly chooses and documents a
redistributable prebuilt-core package.

---

## 2. Shared Types (`src/shared.types.ts`)

### 2.1 Arcade input vocabulary

The DOS runtime speaks DOM `KeyboardEvent.code`. An arcade machine has
no keyboard; it has players, sticks, buttons, coin slots and start
buttons. The runtime speaks that vocabulary directly, and the bridge
maps it onto MAME's input ports through generated controller config
(§4.4), so no MAME default key mapping is involved.

```ts
type PlayerIndex = 1 | 2 | 3 | 4;
type PlayerCount = 1 | 2 | 3 | 4;
type ArcadeDirection = "up" | "down" | "left" | "right";
type ArcadeButtonIndex = 1 | 2 | 3 | 4 | 5 | 6;
type ArcadeButtonCount = 1 | 2 | 3 | 4 | 5 | 6;

type ArcadeControl =
    | { readonly kind: "direction"; readonly player: PlayerIndex; readonly direction: ArcadeDirection }
    | { readonly kind: "button";    readonly player: PlayerIndex; readonly button: ArcadeButtonIndex }
    | { readonly kind: "coin";      readonly player: PlayerIndex }
    | { readonly kind: "start";     readonly player: PlayerIndex }
    | { readonly kind: "service" }
    | { readonly kind: "test" };

type Unsubscribe = () => void;
type Listener<T> = (event: T) => void;

interface Rect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

interface InputSurface {
    addEventListener(type: string, listener: (event: Event) => void,
        options?: AddEventListenerOptions): void;
    removeEventListener(type: string, listener: (event: Event) => void,
        options?: EventListenerOptions): void;
    getBoundingClientRect(): Rect;
    setPointerCapture?(pointerId: number): void;
    releasePointerCapture?(pointerId: number): void;
}

interface FrameScheduler {
    request(callback: (time: number) => void): number;
    cancel(handle: number): void;
}

interface FetchResponseLike {
    readonly ok: boolean;
    readonly status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}
type FetchLike = (url: string) => Promise<FetchResponseLike>;
```

The pointer primitives retain the DOS runtime's complete
`PointerEventLike`, `InputSurface`, geometry, scheduler and timer types;
the abbreviated declarations above show the seams used elsewhere in
this spec. Those types and predicates are part of the root export.

### 2.2 Machine description

Read from the active adapter at boot, so deployments never hand-enter
resolution, timing or orientation. Width and height describe the
upright RGBA frames delivered by `onFrame`; rotation has already been
applied by the adapter.

```ts
type Orientation = "horizontal" | "vertical";

interface MachineInfo {
    readonly name: string;           // short name, e.g. "sf2"
    readonly description: string;    // e.g. "Example Fighter (World)"
    readonly width: number;          // upright output width in pixels
    readonly height: number;         // upright output height in pixels
    readonly refreshHz: number;      // e.g. 59.637 for CPS-1
    readonly orientation: Orientation;
    readonly aspectRatio: number;    // display aspect after rotation: 4/3 or 3/4
    readonly players: number;
    readonly buttons: number;
}
```

### 2.3 Session and adapter

```ts
interface FrameEvent {
    readonly width: number;
    readonly height: number;
    readonly rgba: Uint8ClampedArray;   // reused buffer; copy if kept
}

interface SoundEvent {
    readonly samples: Float32Array;     // interleaved stereo
    readonly frames: number;            // samples.length / 2
}

interface RomFile {
    readonly name: string;              // unique basename, e.g. "sf2.zip", "neogeo.zip"
    readonly bytes: Uint8Array;
}

interface ArcadeStartConfig {
    readonly machine: string;           // MAME short name
    readonly machineHints: {
        readonly players: PlayerCount;
        readonly buttons: ArcadeButtonCount;
    };
    readonly roms: ReadonlyArray<RomFile>;
    readonly changes?: Uint8Array;      // overlay from a previous persist()
    readonly options?: Readonly<Record<string, string | number | boolean>>;
}

interface ArcadeSession {
    readonly machine: MachineInfo;
    readonly sampleRate: number;        // 48000 unless options override
    setControl(control: ArcadeControl, pressed: boolean): void;
    pause(): void;
    resume(): void;
    reset(kind: "soft" | "hard"): void;
    saveState(slot: string): Promise<void>;
    loadState(slot: string): Promise<void>;
    persist(): Promise<Uint8Array | null>;
    exit(): Promise<void>;
    onTick(listener: Listener<void>): Unsubscribe;  // once per emulated frame, even when video is duplicated/skipped
    onFrame(listener: Listener<FrameEvent>): Unsubscribe;
    onSound(listener: Listener<SoundEvent>): Unsubscribe;
    onExit(listener: Listener<void>): Unsubscribe;
}

interface ArcadeAdapter {
    readonly type: string;
    start(config: ArcadeStartConfig): Promise<ArcadeSession>;
}

interface BuildInfo {
    readonly formatVersion: 1;
    readonly buildId: string;           // deterministic SHA-256 fingerprint
    readonly adapter: "libretro" | "mame";
    readonly engine: string;            // core id or MAME family id
    readonly emulatorVersion: string;   // pinned commit or release
    readonly emsdkVersion: string;
    readonly machines: ReadonlyArray<string>;
    readonly artifacts: ReadonlyArray<string>;
    readonly licenses: ReadonlyArray<{ readonly id: string; readonly notice: string }>;
    readonly pthreads: boolean;
}

type EmscriptenModuleFactory =
    (options: Readonly<Record<string, unknown>>) => Promise<EmscriptenModuleLike>;
type ModuleLoader = (moduleUrl: string) => Promise<EmscriptenModuleFactory>;
```

`EmscriptenModuleLike` is a private structural type owned by each
adapter; it is not exported. A build's `buildId` hashes its normalized
build metadata, emulator source identity, shim/patch hashes and compiler
flags—not timestamps or absolute paths. `build.json` itself is checked
by a structural predicate before an adapter trusts it.

ROM names are non-empty basenames with no `/`, `\\`, `.` or `..`
segments; names compare case-insensitively and duplicates reject with
`INVALID_CONFIG`. Bytes are copied before the caller can mutate them.

Each type has a structural predicate (`isArcadeControl`,
`isMachineInfo`, `isArcadeSession`, …) tested in
`spec/01-shared-types.test.ts`: one passing input, then one input per
violated condition.

### 2.4 Save-overlay wire format

`changes` and `persist()` use a versioned zip understood by both
adapters. The archive contains `overlay.json` plus files under the
logical roots `nvram/`, `cfg/` and `states/`. Adapters map those roots
to their own MEMFS directories; physical MEMFS paths never enter the
wire format.

```json
{
    "format": "mame-game-runtime-overlay",
    "version": 1,
    "adapter": "mame",
    "engine": "cps1",
    "buildId": "<build fingerprint>",
    "machine": "sf2"
}
```

The adapter rejects an overlay for a different adapter, engine,
build, machine or format version with `OVERLAY_INCOMPATIBLE`. Exact
build matching is intentionally strict in v1 because serialized states
are not stable across emulator builds. A later format may separate
portable NVRAM from build-bound states.

Archive readers reject absolute paths, backslashes, NULs, empty path
segments, `.`/`..`, symlinks, duplicate case-folded names and entries
outside the three roots. Default limits are 64 MiB compressed, 256 MiB
expanded and 4,096 files; adapter construction may lower but not remove
them. Writers sort paths, use fixed timestamps and omit empty
directories so equal persisted trees produce equal bytes. Overlay codec
tests include traversal, duplicate-name and zip-bomb metadata cases.

---

## 3. `ArcadeRuntimeError`

One error class, matching the DOS runtime's `DosRuntimeError` contract:
immutable `code`, `name`, `message` and `data`, a frozen numeric `CODE`
registry, a validating config predicate and `ArcadeRuntimeError.is()`.
Codes:

| Code | Name | Raised when |
| ---- | ---- | ----------- |
| -1 | `INVALID_CODE` | Construction sentinel |
| 1 | `INVALID_CONFIG` | A config, argument or setter value fails its predicate |
| 2 | `INVALID_MESSAGE` | Construction sentinel |
| 3 | `INTERNAL_ERROR` | A state believed impossible |
| 4 | `ADAPTER_FAILED` | The Emscripten module failed to load, instantiate or start |
| 5 | `ROM_LOAD_FAILED` | A ROM URL could not be fetched |
| 6 | `ROM_SET_INVALID` | The emulator rejected the ROM set (MAME's audit failed, or a core's `retro_load_game` returned false); `data` holds whatever report is available |
| 7 | `MACHINE_NOT_IN_BUILD` | The requested machine is not in the loaded MAME build, or not in the core's DAT |
| 8 | `NOT_STARTED` | A session operation before `start()` resolved |
| 9 | `ALREADY_STARTED` | `start()` while starting or running |
| 10 | `DESTROYED` | Any operation after `destroy()` or session exit |
| 11 | `FULLSCREEN_FAILED` | `requestFullscreen` rejected |
| 12 | `AUDIO_FAILED` | `AudioContext` could not be resumed or a node created |
| 13 | `STORAGE_FAILED` | IndexedDB open, read or write failed |
| 14 | `STATE_FAILED` | A save state could not be written or loaded |
| 15 | `UNSUPPORTED` | The browser lacks a required API |
| 16 | `OVERLAY_INCOMPATIBLE` | A save overlay belongs to another format, adapter, engine, build or machine |

---

## 4. The MAME source build and bridge (primary path)

### 4.1 Build pipeline (`scripts/build-mame.ts`)

1. Read `mame/VERSION` and `mame/EMSDK_VERSION`. The initial
   `VERSION` is `mame0161`; M0 records the exact source identity and
   selects the emsdk version.
2. Ensure emsdk is installed and activated at that version.
3. Fetch the official source tag/archive and verify the identity recorded
   by P1, then unpack it into `.cache/mame/<version>/` (reused across
   builds). A Git clone is an implementation detail, not the identity.
4. Apply `mame/patches/*.patch` in order; fail on any reject.
5. For each `mame/builds/<family>.json`, run the version-pinned build
   recipe recorded by M0. The intended modern-MAME shape is:
   ```sh
   emmake make SUBTARGET=<family> SOURCES=<sources> REGENIE=1 -j<n> \
       ARCHOPTS="-s MODULARIZE=1 -s EXPORT_NAME=createMame -s ALLOW_MEMORY_GROWTH=1"
   ```
   MAME 0.161 may require different make variables or a small build-only
   patch; the probe record replaces this provisional invocation rather
   than pretending a newer-release command works unchanged.
6. Copy `mame<family>.js` and `mame<family>.wasm` to `dist/mame/<family>/`,
   with a `build.json` recording format version, deterministic build id,
   tag, emsdk version, compiler flags, patch hashes, pthread requirement,
   artifact names, licence/notice metadata and the machine list
   (`-listfull` run once against the fresh build under Node).

P6 confirms that the direct MAME 0.161 outputs use non-shared memory and no
thread worker or loader, so their `build.json` files record `pthreads: false`.
The build runs the tracked threading inspector over every generated
JavaScript/WebAssembly pair and fails if that measured result changes; a
future shared-memory build requires a new probe and matching deployment
headers rather than silently retaining this value.

A build file:

```json
{
    "family": "cps1",
    "sources": ["src/mame/drivers/cps1.c"],
    "machines": ["sf2", "ffight", "strider", "ghouls", "1941", "mercs"]
}
```

The source path above reflects the expected 0.161-era tree; P1/P2
replace it with the exact audited path if the matching source differs.

`sources` comes from the pinned source-built binary's `-listsource <machine>`
output or the equivalent source-tree data for that release.
`machines` is informational; the authoritative list is what the pinned
build reports into `build.json`, which is what
`MACHINE_NOT_IN_BUILD` checks against.

`MODULARIZE` matters: MAME keeps global state that may not reset cleanly
after a machine exits, so the adapter instantiates a **fresh module per
`start()`** and discards it on exit. Probe P4 confirmed that the stock browser
loop cannot return to `machine_manager` to construct a second machine in the
same instance.

### 4.2 Web OSD modules (`0001-web-osd-modules.patch`)

MAME's OSD layer selects its video, sound and input implementations by
option (`-video`, `-sound`, `-keyboardprovider`, `-joystickprovider`).
The patch registers a `web` implementation of each alongside the SDL
ones, and the adapter starts MAME with all of them set to `web`.

Those option names describe the desired adapter contract. P7 records
the exact 0.161 OSD interfaces and flags; if that release predates one
of the provider abstractions, patch 0001 implements the equivalent hook
at the older OSD boundary while preserving the JavaScript-facing API.

- **`web` video.** Uses MAME's software renderer to rasterize the
  render primitive list into a 32-bit buffer at the machine's native
  size, with orientation applied (vertical games come out vertical).
  It converts to RGBA in C++ and calls the JS frame callback with a
  pointer, width and height once per emulated frame.
- **`web` sound.** Receives the mixed stereo stream from MAME's sound
  manager, converts `s16` to `float`, and calls the JS sound callback
  with a pointer and frame count.
- **`web` input.** Registers one virtual joystick device per player
  ("Web Pad 1"…"Web Pad 4"), each with four digital directions and ten
  buttons (six action, coin, start, and on pad 1 service and test). Its
  state lives in a static array the bridge writes into; MAME polls it
  like any other device.

### 4.3 Bridge exports (`0002-web-bridge-exports.patch`)

C functions marked `EMSCRIPTEN_KEEPALIVE`, called from the adapter
through `cwrap`:

| Export | Does |
| ------ | ---- |
| `web_set_control(pad, control, pressed)` | Writes the virtual device state |
| `web_pause()` / `web_resume()` | `machine().pause()` / `resume()` |
| `web_reset(hard)` | Schedules a soft or hard reset |
| `web_save_state(name)` / `web_load_state(name)` | `schedule_save` / `schedule_load`, completion reported through a callback |
| `web_flush_nvram()` | Writes NVRAM to the filesystem without exiting (patch 0003 exposes the save path) |
| `web_exit()` | Schedules exit |
| `web_machine_info(out)` | Fills a struct for `MachineInfo` |

Callbacks into JS (`EM_JS`): `onTick`, `onFrame`, `onSound`,
`onStateDone(ok)`, `onExit`, `onLog(level, text)`. `onTick` fires once
per emulated frame even when frameskip suppresses video.

P7 confirmed that scheduled state work can be serviced at an explicit
between-timeslice boundary: save, continued execution, load, time rewind and
continued execution all passed. The pinned toolchain additionally requires
the missing MEMFS state node to be created before MAME opens it and requires
the scheduler's diagnostic-only timer dumps to be suppressed. The bridge
never calls `immediate_save` or `immediate_load`.

### 4.4 Generated controller config

At start, the adapter writes `/mame/ctrlr/web.cfg` mapping each MAME
port to the web devices: `P1_JOYSTICK_UP` → Web Pad 1 up,
`P1_BUTTON1` → Web Pad 1 button 1, `COIN1` → Web Pad 1 coin,
`START1` → Web Pad 1 start, `SERVICE`, `TEST`, and so on for each
player. MAME starts with `-ctrlr web`. Keyboard defaults and the MAME
UI are never in the input path.

### 4.5 Start options

The adapter fixes the logical settings below (not overridable). These
are shown in newer-MAME syntax; M0 records the exact 0.161 argv/config
equivalents in `build.json`, and the adapter uses those rather than
assuming flag names across releases:
`-video web -sound web -keyboardprovider web -joystickprovider web
-ctrlr web -rompath /mame/roms -nvram_directory /mame/nvram
-cfg_directory /mame/cfg -state_directory /mame/sta
-skip_gameinfo -nomouse -noautosave -nothrottle`.

Overridable through `ArcadeStartConfig.options`: `samplerate`,
`frameskip`, `bios` (e.g. Neo Geo MVS vs AES), `dipswitch`
values via a generated cfg (later milestone).

---

## 5. `MameEmulatorAdapter`

```ts
interface MameEmulatorAdapterConfig {
    readonly buildUrl: string;          // e.g. "/mame/cps1/"; serves mamecps1.js, .wasm, build.json
    readonly build: BuildInfo;          // already fetched and validated
    readonly loadModule: ModuleLoader;  // injected; init defaults to dynamic import of the build's JS
}

class MameEmulatorAdapter implements ArcadeAdapter {
    readonly type: "mame";
    constructor(config: MameEmulatorAdapterConfig);
    get build(): BuildInfo;
    start(config: ArcadeStartConfig): Promise<ArcadeSession>;
    static init(config: {
        buildUrl: string;
        fetch?: FetchLike;
        loadModule?: ModuleLoader;
    }): Promise<MameEmulatorAdapter>;
}
```

The constructor is deterministic and reads no globals. `init` fetches
and validates `build.json`, supplies global `fetch` and dynamic import
when omitted, resolves artifact URLs relative to `buildUrl`, and then
constructs. Metadata selection, requested adapter and artifact filenames
must agree before module JavaScript is imported.

`start`:

1. Validates config; checks `machine` against `build.machines`
   (`MACHINE_NOT_IN_BUILD`).
2. Instantiates a fresh module with `noInitialRun: true`.
3. Creates `/mame/{roms,nvram,cfg,sta,ctrlr}` in MEMFS, writes each
   ROM zip (copied with `slice()`), writes `web.cfg`, validates
   `changes` and maps its logical roots to the corresponding writable
   directories.
4. Snapshots a hash of every persisted file under `nvram`, `cfg` and
   `sta` *after* the incoming overlay is restored. This snapshot is for
   dirty detection; generated controller config and other adapter-owned
   files are excluded.
5. Calls `callMain([machine, ...options])`.
6. Resolves once the first `onFrame` arrives and `web_machine_info`
   succeeds. If MAME exits before the first frame, parses the `onLog`
   output for the ROM audit and rejects with `ROM_SET_INVALID`
   (`data`: the missing/bad file list), otherwise `ADAPTER_FAILED`.

Session behavior:

- **`setControl`** maps `ArcadeControl` to `(pad, control index)` and
  calls `web_set_control`. Idempotent at this layer is not required;
  `ArcadeInput` dedupes.
- **`onFrame`** wraps the RGBA pointer in a view on the heap and copies
  into a reused `Uint8ClampedArray` (heap views are invalidated by
  memory growth, so nothing keeps a view across callbacks).
- **`onSound`** copies into a reused `Float32Array` the same way.
- **Frame pacing.** The web bridge replaces MAME 0.161's fixed
  1/60-second-per-`requestAnimationFrame` outer loop and runs with the native
  blocking throttle disabled. Each browser scheduler tick adds elapsed
  monotonic time to an accumulator and advances MAME's device scheduler by
  one primary-screen period for every complete period accumulated, capped at
  four periods per tick. Excess time is discarded after the cap so a resumed
  background tab does not fast-forward. `onTick` still comes from each
  emulated screen frame, independently of a 60, 90, 120 or 144 Hz display.
- **Pause and terminal control.** A paused tick pumps the video/OSD boundary
  without advancing the device scheduler. Exit and hard reset stop browser
  callbacks explicitly; hard reset creates a fresh module, while exit flushes
  persistence and reports completion before the old module is discarded.
- **`saveState` / `loadState`** resolve or reject with `STATE_FAILED`
  on `onStateDone`. The loop services one pending scheduled operation only at
  its between-timeslice boundary and yields before scheduling more emulation.
- **`persist`** calls `web_flush_nvram()` and rehashes `nvram`, `cfg`
  and `sta`. It returns `null` when those hashes have not changed since
  start or the previous successful `persist`. Otherwise it writes a
  complete cumulative overlay of the current persisted tree, including
  unchanged files restored from the incoming overlay, then advances the
  dirty-detection snapshot. This is deliberately not a zip containing
  only the most recent delta: `ArcadeStorage` replaces its prior value,
  so every non-null result must stand alone.
- **`exit`** calls `web_exit()`, waits for `onExit`, then drops the
  module. Every method throws `DESTROYED` afterwards.

---

## 5b. `LibretroAdapter`

A libretro backend is optional and begins only after M0–M8 are complete.
It exists for measured performance or hardware-coverage advantages, not
as a shortcut around the direct MAME deliverable.

A libretro core is a library with a fixed C interface: the frontend
calls `retro_run()` once per frame, and the core calls back with a
frame buffer, a batch of audio samples, and questions about input state
and configuration. That is the same split this runtime is built on, so
a libretro core can sit behind `ArcadeAdapter` with no emulator source
changes. RetroArch is not used; the shim below is the whole frontend.

### 5b.1 Cores

| Core | Romsets | Covers well | Notes |
| ---- | ------- | ----------- | ----- |
| `fbneo` | FinalBurn Neo sets matching the pinned commit's DAT | CPS-1, CPS-2, CPS-3, Neo Geo, Sega System 16/18, Toaplan, Cave, Irem, Data East, Taito, Konami 2D | First optional core to probe after direct-MAME parity; non-commercial licence |
| `mame2003_plus` | MAME 0.78-based sets plus the project's additions | Broad 1980s–early-'90s coverage, light on CPU | Optional low-end alternative with a distinct ROM generation; MAME non-commercial licence |
| `mame` (candidate) | The MAME release tracked by the selected core commit | Broad MAME coverage | Experimental alternate frontend for a later MAME release; it does not replace the direct source build |

A core file (`libretro/cores/fbneo.json`):

```json
{
    "core": "fbneo",
    "repo": "https://github.com/libretro/FBNeo",
    "commit": "<pinned>",
    "make": ["make", "-C", "src/burner/libretro", "platform=emscripten"],
    "artifact": "src/burner/libretro/fbneo_libretro_emscripten.a",
    "dat": "dats/FinalBurn Neo (ClrMame Pro XML, Arcade only).dat",
    "map": "libretro/maps/fbneo.json"
}
```

### 5b.2 Build (`scripts/build-libretro.ts`)

1. Clone the core at `commit` into `.cache/libretro/<core>/<commit>/`.
2. Run `make` under `emmake` to produce the core's static library.
3. Link it with the shim:
   ```
   emcc libretro_web.c <artifact> -O3 -o dist/libretro/<core>/<core>.js \
       -s MODULARIZE=1 -s EXPORT_NAME=createCore -s ALLOW_MEMORY_GROWTH=1 \
       -s EXPORTED_RUNTIME_METHODS=['FS','cwrap','HEAPU8','HEAPF32']
   ```
4. Copy the DAT next to the build and write `build.json` (format version,
   deterministic build id, core, commit, emsdk version, flags, shim
   hash, pthread requirement, artifact names, licence/notice metadata
   and machine list parsed from the DAT).

The unit of build is the core, not a board family: FBNeo builds as one
library containing all its drivers. Whether a driver subset is possible
is probe L2.

### 5b.3 The shim (`libretro/shim/libretro_web.c`)

The shim implements the frontend side of `libretro.h` and exposes a
small C API to JavaScript. It owns no main loop; JavaScript calls
`lw_run()` once per emulated frame (§5b.5).

Callbacks it registers with the core:

| Callback | Shim behavior |
| -------- | ------------- |
| `retro_environment` | Answers `GET_SYSTEM_DIRECTORY` and `GET_SAVE_DIRECTORY` (`/sys`, `/saves`), `SET_PIXEL_FORMAT` (accepts RGB565 and XRGB8888, records which), `GET_VARIABLE` (from the options map JS supplied), `GET_VARIABLE_UPDATE` (true once after `lw_set_option`), `SET_ROTATION` (records rotation), `SET_GEOMETRY` / `SET_SYSTEM_AV_INFO` (records new size and timing, flags a change), `GET_LOG_INTERFACE` (forwards to `onLog`), `SET_INPUT_DESCRIPTORS` (stored for diagnostics). Everything else returns false. |
| `retro_video_refresh` | Converts the frame to RGBA into a shim-owned buffer, **applying the recorded rotation** so frames always arrive upright, then calls `onFrame(ptr, w, h)`. A `NULL` data pointer (duplicate frame) re-emits nothing. |
| `retro_audio_sample_batch` | Converts `int16` stereo to `float` into a shim-owned buffer and calls `onSound(ptr, frames)`. `retro_audio_sample` (single) appends to the same buffer, flushed at the end of `lw_run`. |
| `retro_input_poll` | No-op; state is already current. |
| `retro_input_state` | Returns the bit from a static `uint16_t pads[4]` for `RETRO_DEVICE_JOYPAD`; zero for anything else in the first optional libretro milestone. |

Exports (`EMSCRIPTEN_KEEPALIVE`):

| Export | Does |
| ------ | ---- |
| `lw_set_option(key, value)` | Stores a core option before or after load |
| `lw_load(path)` | `retro_init`, `retro_load_game` with `need_fullpath` honored, fills `retro_system_av_info`; returns 0 or an error code |
| `lw_av_info(out)` | Base width and height, aspect ratio, fps, sample rate, rotation |
| `lw_run()` | One `retro_run()` |
| `lw_set_pad(port, mask)` | Writes the 16-bit joypad mask for a port |
| `lw_reset()` | `retro_reset()` |
| `lw_serialize(out_len)` / `lw_unserialize(ptr, len)` | Save states through `retro_serialize` |
| `lw_unload()` | `retro_unload_game`, `retro_deinit` |

### 5b.4 Declarations

```ts
interface LibretroAdapterConfig {
    readonly core: LibretroCore;            // "fbneo" | "mame2003_plus" | "mame"
    readonly buildUrl: string;              // serves <core>.js, <core>.wasm, build.json, the map
    readonly build: BuildInfo;              // already fetched and validated
    readonly loadModule: ModuleLoader;      // injected; init defaults to dynamic import
    readonly scheduler: FrameScheduler;     // injected; init defaults to rAF
    readonly clock: () => number;           // injected; init defaults to performance.now
}

class LibretroAdapter implements ArcadeAdapter {
    readonly type: "libretro";
    constructor(config: LibretroAdapterConfig);
    get core(): string;
    get build(): BuildInfo;
    start(config: ArcadeStartConfig): Promise<ArcadeSession>;
    static init(config: {
        core: LibretroCore;
        buildUrl: string;
        fetch?: FetchLike;
        loadModule?: ModuleLoader;
        scheduler?: FrameScheduler;
        clock?: () => number;
    }): Promise<LibretroAdapter>;
}

type LibretroCore = "fbneo" | "mame2003_plus" | "mame";
```

For the `mame` core the unit of build may be a driver subset rather
than the whole core, mirroring the MAME path's board families
(`libretro/cores/mame-cps1.json`, …), if that optional core's probe
shows its makefile accepts `SUBTARGET`/`SOURCES`. `buildUrl` then points at that
subset build, and `MACHINE_NOT_IN_BUILD` checks against its machine
list from `-listfull` instead of a DAT.

`LibretroAdapter` uses the common `ArcadeStartConfig`. `options` are passed as core options
(`fbneo-cpu-speed-adjust`, core-specific sample-rate options, …).
`machineHints.players` and `machineHints.buttons` supply metadata the
libretro API does not report (§5b.6); they are runtime fields and never
leak into the core-option namespace.

### 5b.5 Behavior

- **`start`.** Validates, checks `machine` against the DAT's machine
  list (`MACHINE_NOT_IN_BUILD`), instantiates a fresh module, creates
  `/roms`, `/sys`, `/saves`, `/sta` in MEMFS, writes every ROM zip into
  `/roms` (FBNeo resolves parents and BIOS from the same directory),
  validates `changes`, maps `nvram/` to `/saves` and `states/` to
  `/sta` (`cfg/` entries are invalid for a v1 libretro overlay), then
  snapshots file hashes for dirty detection,
  sets options, calls `lw_load("/roms/<machine>.zip")`. A non-zero
  result rejects with `ROM_SET_INVALID`, with `onLog` lines collected
  during load as `data`. Then it reads `lw_av_info`, builds
  `MachineInfo`, starts the frame loop, and resolves on the first frame.
- **Frame pacing.** The adapter owns the loop, which makes refresh rate
  independent of the display. Each `scheduler` tick adds elapsed
  `clock()` time to an accumulator and calls `lw_run()` once per
  `1000 / fps` ms accumulated, capped at 4 runs per tick (dropped time
  beyond that is discarded rather than fast-forwarded). A 59.637 Hz
  CPS-1 game therefore runs at 59.637 Hz on 60, 90, 120 and 144 Hz
  screens. V1 uses this monotonic-clock pacing with no hidden feedback
  from `ArcadeAudio`; probe L6 decides whether the session contract needs
  an explicit bounded rate-correction mechanism in a later revision.
  The adapter emits one session `onTick` immediately after every
  `lw_run`, including runs whose video callback supplied a duplicate
  `NULL` frame.
- **`setControl`.** Looks the control up in the core's map (§5b.6),
  updates the port's mask, calls `lw_set_pad`.
- **`pause` / `resume`.** Stop and restart the frame loop; the core is
  untouched. Accumulator reset on resume so no catch-up burst occurs.
- **`reset("soft")`** calls `lw_reset`. **`reset("hard")`** unloads and
  reloads the game in the same module while preserving the current
  writable tree. It does not advance the dirty-detection snapshot, so
  unsaved NVRAM remains eligible for the next `persist()`.
- **`saveState(slot)`** calls `lw_serialize`, writes the bytes to
  `/sta/<slot>.state`, resolves. **`loadState(slot)`** reads that file
  and calls `lw_unserialize`; a missing file or a false return rejects
  with `STATE_FAILED`. Both are synchronous inside the core, so they
  resolve within one frame.
- **`persist`.** Rehashes `/saves` and `/sta`; it returns `null` when
  the tree has not changed since start or the previous successful
  persist. When dirty, it zips the complete current tree, including
  unchanged files restored from the incoming overlay, and advances the
  snapshot. FBNeo writes NVRAM, EEPROM and high-score files into the
  save directory itself, so no flush call is needed unless probe L5
  proves otherwise.
- **`exit`.** Stops the loop, `lw_unload`, fires `onExit`, drops the
  module. Every method throws `DESTROYED` afterwards.

### 5b.6 Input maps

libretro presents every core as a RetroPad: d-pad, B, A, Y, X, L, R,
L2, R2, L3, R3, Select, Start. Each core decides which arcade input each
RetroPad button means. `libretro/maps/<core>.json` records that per
core, and a manifest may override it per game:

```json
{
    "core": "fbneo",
    "default": {
        "direction": { "up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT" },
        "button":    { "1": "B", "2": "A", "3": "Y", "4": "X", "5": "L", "6": "R" },
        "coin": "SELECT",
        "start": "START",
        "service": "L3",
        "test": "R3"
    }
}
```

Service and test depend on core options (FBNeo's diagnostic input
setting); the adapter sets the option the map requires. Exact defaults
per core are recorded from probe L4.

Because libretro reports neither player count nor button count, the
adapter takes them from required `machineHints` (written by the shell
from the manifest's `controls`). `MachineInfo.name` is the short name;
`description` comes from the DAT. The MAME bridge compares the hints
with its discovered port metadata, logs a warning if they differ, and
uses the discovered values in `MachineInfo`.

### 5b.7 ROM validation

`npm run pack-roms -- <slug>` for a libretro manifest reads the core's
DAT and checks every listed zip: each required file present with the
right CRC, parent and BIOS zips included. The report has the same shape
as the MAME path's, so the shell and build treat both alike.

### 5b.8 Tests

**`spec`:** joypad mask construction from `ArcadeControl` against both
maps; the frame-pacing accumulator against a fake clock and scheduler
(59.637 Hz on 60 and 120 Hz ticks over 10 simulated seconds lands
within one frame of 596); DAT parsing and ROM-set validation over a
small fixture DAT.

**`browser`:** when the optional backend is implemented, the adapter
against the real FBNeo build with a free test ROM: start resolves,
frames upright and at the DAT's resolution,
sound arrives at the reported rate, coin and start change the picture,
`saveState`/`loadState` round-trip restores an identical next frame,
`persist` returns `null` at boot, `exit` then any call throws
`DESTROYED`.

---

## 6. `ArcadeInput`

Equivalent of `DosInput`, over `ArcadeControl`.

```ts
interface ArcadeInputChannel {
    press(control: ArcadeControl): void;
    release(control: ArcadeControl): void;
    tap(control: ArcadeControl, holdFrames?: number): void;
    releaseAll(): void;
    destroy(): void;
}

class ArcadeInput {
    constructor(config: { session: ArcadeSession });
    get snapshot(): ReadonlyArray<ArcadeControl>;   // held controls, canonical order
    createChannel(): ArcadeInputChannel;
    press(control: ArcadeControl): void;
    release(control: ArcadeControl): void;
    tap(control: ArcadeControl, holdFrames?: number): void;  // default 3 frames
    releaseAll(): void;
    destroy(): void;
}
```

- The methods on `ArcadeInput` use a default channel for callers driving
  input directly. Every source and mapper binding creates its own
  channel. A control reaches the session as pressed on the first
  channel's press and as released only after the last channel releases
  it. This prevents a keyboard key-up from cancelling the same control
  still held by a gamepad or touch button.
- Holds are idempotent within a channel: pressing a control that channel
  already holds or releasing one it does not hold does not reach the
  session. Destroying a channel releases all of its holds.
- **`tap`** exists for coin and start: arcade boards sample inputs once
  per frame, and a press/release inside one frame can be missed. `tap`
  holds for `holdFrames` emulated frames counted from the session's
  `onTick`, then releases. It therefore works through video frameskip
  and libretro duplicate-frame callbacks.
- **Opposing directions.** Pressing `left` while `right` is held for the
  same player releases `right` from every channel first (SOCD
  last-input-wins). A later physical release from the old owner is a
  no-op. Many boards misbehave with both directions held, and mixed
  keyboard/touch/gamepad input can otherwise produce it.
- `releaseAll` on blur, visibility loss, pause and destroy, as in the
  DOS runtime.

Tests (`spec/03-arcade-input.test.ts`) against `FakeArcadeSession`:
per-channel idempotency and reference counting, channel destruction,
`tap` timing driven by fake frames, cross-channel SOCD resolution,
`releaseAll` order, `DESTROYED`.

---

## 7. `ArcadeDisplay`

Port of `DosDisplay` with arcade-specific layout:

- `attach(session)` draws frames with `putImageData` into a canvas whose
  backing size is the native frame size.
- `aspectRatio` defaults to `session.machine.aspectRatio`, so vertical
  games lay out portrait with no deployment config.
- Scaling modes `fit`, `integer` (as in `DosDisplay.layoutFor`), and
  `fill-height`, which matters for vertical games on landscape screens.
- `imageRendering`: `"pixelated"` (default) or `"smooth"`, applied as
  CSS on the canvas.
- Fullscreen, resize observation and `onLayout` as in the DOS runtime.

The pure `layoutFor` static is tested in `spec`; drawing, resize and
fullscreen errors in `browser`.

---

## 8. `ArcadeAudio`

Port of `DosAudio`: owns the `AudioContext`, the gesture unlock, the
scheduled-buffer playback, the latency cap and mute. Differences:

- Stereo: buffers are created with 2 channels and de-interleaved on copy.
- Context construction requests `session.sampleRate` (48000 by default),
  but browsers may choose another device rate. Each `AudioBuffer` is
  tagged with the session rate and Web Audio performs conversion; queue
  accounting uses buffer duration rather than assuming the requested
  context rate was honored.
- `MAX_QUEUE_MS` 120, `MIN_CHUNK_MS` 16: arcade audio is tied to a fixed
  refresh rate and games are timing-sensitive, so the cap is tighter.

---

## 9. `ArcadePlayer`

Composition root, as `DosPlayer`.

```ts
type ArcadeAdapterSelection = {
    readonly type?: "mame";           // default
    readonly buildUrl: string;
} | {
    readonly type: "libretro";         // added to the exported union with M12
    readonly core: LibretroCore;
    readonly buildUrl: string;
};

interface ArcadeGameConfig {
    readonly machine: string;
    readonly machineHints: {
        readonly players: PlayerCount;
        readonly buttons: ArcadeButtonCount;
    };
    readonly roms: ReadonlyArray<string | RomFile>;   // URLs or bytes
    readonly changes?: Uint8Array;
    readonly options?: Readonly<Record<string, string | number | boolean>>;
    readonly display?: { readonly scaling?: ScalingMode; readonly imageRendering?: "pixelated" | "smooth" };
}

class ArcadePlayer {
    get status(): "idle" | "starting" | "running" | "paused" | "destroyed";
    get machine(): MachineInfo;          // NOT_STARTED before start
    get input(): ArcadeInput;
    get display(): ArcadeDisplay;
    get audio(): ArcadeAudio;
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    reset(kind?: "soft" | "hard"): void;
    saveState(slot?: string): Promise<void>;   // default slot "quick"
    loadState(slot?: string): Promise<void>;
    persist(): Promise<Uint8Array | null>;
    fullscreen(): Promise<void>;
    on(event, listener): Unsubscribe;          // status, exit, error
    destroy(): Promise<void>;
    static init(config: {
        canvas: HTMLCanvasElement;
        container: HTMLElement;
        game: ArcadeGameConfig;
        adapter?: ArcadeAdapter;
        adapterConfig?: ArcadeAdapterSelection;
        fetch?: FetchLike;
    }): Promise<ArcadePlayer>;
}
```

ROM URLs are fetched in parallel; the fetched bytes are kept so a
restart after exit does not refetch. A non-OK response or network error
becomes `ROM_LOAD_FAILED` and identifies the URL without embedding ROM
bytes in error data. URL basenames become `RomFile.name`; duplicate
basenames reject. The constructor requires a resolved adapter;
`init()` resolves `adapterConfig` exactly as `ArcadeDeployment.init`
does. Exactly one must be present, and no implicit build URL exists.
Lifecycle, failure handling and event semantics follow `DosPlayer` in
`headless-browser-dos-runtime-spec.md` §8.2.

More explicitly, a failed `start()` tears down any partial session,
display/audio subscriptions and input, emits one typed `error`, returns
to `idle`, and may be retried. `pause`, reset, state load, natural exit
and destroy release all held controls first. Pause/resume are
idempotent in their matching states; `destroy()` is terminal and
idempotent. A natural emulator exit emits `exit` once and returns the
player to `idle`; it does not destroy the reusable display or cached ROM
bytes. Listener exceptions do not prevent later listeners from running
and are surfaced as `INTERNAL_ERROR` without recursive error emission.

---

## 10. Sources, mapping and storage

### 10.1 Touch primitives

`Button`, `DPad`, `AnalogStick` and `Trackpad` are ported from the
sibling DOS runtime without behavioral changes. They emit mechanical
events and have no dependency on `DosInput`. The first release keeps
the small sources in this package and runs the same contract tests so
installing the arcade runtime does not also install js-dos and its
assets. If both projects later extract a dependency-free controls
package, these folders may become re-exports from that package without
changing this public surface.

### 10.2 `ArcadeMapper`

Equivalent of `InputMapper`, with `ArcadeControl` as the target type:

- `bindButton(button, control)`; a button bound to `coin` or `start`
  uses `input.tap` on press.
- `bindDPad(dpad, { player })`: the four directions map to that
  player's directions, diagonals included.
- `bindAnalogStick(stick, { player, threshold })`: quantized to
  directions with hysteresis (arcade sticks are digital).
- `bindTrackpad` is not provided; no target hardware uses it. Trackball
  and dial games are a later milestone (§12, M11).

Each binding owns an `ArcadeInputChannel`, and unbinding/destroying it
destroys that channel. A page may therefore bind several physical or
touch controls to one arcade control without premature releases.

### 10.3 `KeyboardSource`

Physical keyboard → `ArcadeInput`, through a map the deployment
supplies (`Record<KeyCode, ArcadeControl>`). The runtime contains no
default map; the shell (§11) ships MAME's familiar layout (arrows,
`ControlLeft`/`AltLeft`/`Space`/`ShiftLeft`/`KeyZ`/`KeyX`, `Digit5`
coin, `Digit1` start) as a manifest default. Repeat ignored, blur and
visibility release, `enabled` gate, as in the DOS runtime.

### 10.4 `GamepadSource`

Polled Gamepad API → `ArcadeInput`. Standard-mapping gamepads get a
default per-player layout in the shell: d-pad and left stick to
directions, face and shoulder buttons to buttons 1–6, Select to coin,
Start to start. Pad *n* drives player *n*.

The source receives an injectable gamepad provider and frame scheduler.
It assigns connected standard pads to the lowest free player slot in
connection order and keeps that assignment until disconnect; a
disconnect releases every control held by that pad before freeing the
slot. D-pad buttons take precedence over stick axes, axis values inside
the configured dead zone are zero, and transitions are deduplicated
before reaching `ArcadeInput`. Blur, visibility loss, disable, pause
and destroy release all gamepad-held controls. Non-standard mappings
are ignored in v1 unless a deployment supplies an explicit mapping.

### 10.5 `ArcadeStorage`

As `DosStorage`: one IndexedDB store keyed by the deployment's key,
holding the `persist()` overlay. Because save states live under `sta/`,
they persist through the same overlay with no extra mechanism.

`ArcadeStorage` uses database `mame-game-runtime`, object store
`overlays`, schema version 1. `save(bytes)` replaces the value under
the configured key, `load()` returns a defensive `Uint8Array` copy or
`null`, and `clear()` is idempotent. All IndexedDB failures become
`STORAGE_FAILED`.

### 10.6 `ArcadeDeployment`

This is the direct counterpart to `DosDeployment` and the composition
root used by the shell.

```ts
interface ArcadeControlsConfig {
    readonly keyboard?: {
        readonly enabled?: boolean;
        readonly map: Readonly<Record<string, ArcadeControl>>;
        readonly preventDefault?: boolean;
    };
    readonly gamepads?: {
        readonly enabled?: boolean;
        readonly deadZone?: number;
    };
    readonly buttons?: ReadonlyArray<{
        readonly surface: InputSurface;
        readonly control: ArcadeControl;
    }>;
    readonly dpads?: ReadonlyArray<{
        readonly surface: InputSurface;
        readonly player: PlayerIndex;
        readonly deadZone?: number;
        readonly diagonals?: boolean;
    }>;
    readonly sticks?: ReadonlyArray<{
        readonly surface: InputSurface;
        readonly player: PlayerIndex;
        readonly deadZone?: number;
        readonly radius?: number;
        readonly threshold?: number;
    }>;
}

interface ArcadeDeploymentConfig {
    readonly canvas: HTMLCanvasElement;
    readonly container: HTMLElement;
    readonly game: ArcadeGameConfig;
    readonly controls?: ArcadeControlsConfig;
    readonly keyboardTarget?: EventTarget;
    readonly adapter?: ArcadeAdapter;
    readonly adapterConfig?: ArcadeAdapterSelection;
    readonly fetch?: FetchLike;
    readonly storage?: ArcadeStorage;
}

class ArcadeDeployment {
    get player(): ArcadePlayer;
    get storage(): ArcadeStorage | null;
    get mapper(): ArcadeMapper | null;
    get keyboard(): KeyboardSource | null;
    get gamepads(): GamepadSource | null;
    get keyboardEnabled(): boolean;
    set keyboardEnabled(value: boolean);
    get gamepadsEnabled(): boolean;
    set gamepadsEnabled(value: boolean);
    get isStarted(): boolean;
    start(): Promise<void>;
    save(): Promise<boolean>;
    fullscreen(): Promise<void>;
    exitFullscreen(): Promise<void>;
    destroy(): Promise<void>;
    static init(config: ArcadeDeploymentConfig): Promise<ArcadeDeployment>;
}
```

Exactly one of `adapter` and `adapterConfig` is required by the
constructor. `init` resolves `adapterConfig` into the matching adapter,
defaults its type to direct MAME, supplies global browser
dependencies, and restores `storage` only when `game.changes` was not
given explicitly. There is no hidden default build URL: callers must
name the emulator artifacts they deployed.

`start()` starts the player before attaching any source or primitive.
If any control fails to construct or attach, it tears down everything
created in that call and rejects. Player exit tears controls down too.
`save()` calls `player.persist()` and stores a non-null overlay; it
returns `false` when the adapter reports no changes and rejects with
`UNSUPPORTED` when no storage was configured. To make a quick-save
durable, the shell first calls `player.saveState(slot)` and then
`deployment.save()`.

`destroy()` is idempotent, destroys sources/primitives/mapper before
the player, and releases every held control. Setters validate booleans,
remember their value across session restarts, and immediately update a
live source. Tests mirror the DOS deployment tests: restored overlay,
source gates, partial-construction cleanup, exit cleanup, save/no-save,
double destroy and explicit game changes winning over storage.

---

## 11. Manifests, shell and build

### 11.1 Manifest

```json
{
    "$schema": "../shell/manifest.schema.json",
    "metadata": {
        "slug": "sf2",
        "name": "Example Fighter (World)",
        "year": 1991,
        "manufacturer": "Capcom",
        "status": { "verified": [] }
    },
    "load": {
        "adapter": "mame",
        "build": "cps1",
        "machine": "sf2",
        "roms": ["roms/sf2.zip"]
    },
    "display": { "scaling": "fit", "imageRendering": "pixelated" },
    "saves": { "key": "sf2", "states": true },
    "controls": {
        "players": 2,
        "buttons": 6,
        "touch": {
            "landscape": [
                { "component": "dpad", "region": "left", "player": 1 },
                { "component": "buttons", "region": "right", "player": 1, "layout": "2x3" },
                { "component": "coin", "region": "top-left" },
                { "component": "start", "region": "top-right" }
            ],
            "portrait": [
                { "component": "dpad", "region": "bottom-left", "player": 1 },
                { "component": "buttons", "region": "bottom-right", "player": 1, "layout": "2x3" }
            ]
        }
    }
}
```

`load.adapter` is `"mame"` for the primary direct-source path, with
`build` naming a board family from `mame/builds/`. Optional libretro
manifests use `"libretro"` with `core`: `"fbneo"`,
`"mame2003_plus"` or `"mame"`, plus `build` when that core is split by
family. The ROM set must match the exact selected engine build: the
initial direct path expects MAME 0.161 sets; FBNeo and MAME 2003-Plus
expect their own DAT generations; a libretro MAME core expects the
release tracked by its pinned commit. Optional `load.inputMap` applies
only to libretro (§5b.6).

Before M12 ships, the runtime predicate and generated schema accept
only `"mame"`; the libretro branch documented here is activated with
that optional adapter rather than exposing a configuration the installed
package cannot run.

`load.roms` lists every zip the emulator needs: the game, its parent when it is
a clone (`sf2ce` needs `sf2`), and any BIOS (`neogeo.zip`). Paths are
absolute or relative to the project root; ROM folders are git-ignored.

The manifest shape is closed: unknown fields reject in both the runtime
predicate and JSON Schema. Its normative fields are:

| Object | Required | Optional / rules |
| ------ | -------- | ---------------- |
| `metadata` | `slug`, `name`, `status.verified` | `title`, integer `year`, `manufacturer`, `genre`, non-empty `hints[]`; slug is lower-case `[a-z0-9-]+` and equals its manifest folder |
| `load` | `adapter`, `machine`, non-empty `roms[]` | `build` is required for direct MAME; `core` is required only for libretro and `build` there only for subset builds; `options`; libretro-only `inputMap` |
| `display` | none | `scaling`: `fit`, `integer` or `fill-height`; `imageRendering`: `pixelated` or `smooth` |
| `saves` | unique non-empty `key` | `states` and `autosave`, both boolean and default false |
| `controls` | integer `players` 1–4, integer `buttons` 1–6 | keyboard/gamepad policies and touch layouts for `landscape` and `portrait` |

`status.verified` contains only `boot`, `input`, `sound`, `save` and
`state`; duplicates reject. `options` values are strings, finite numbers
or booleans. Every touch component has a known `component`, region and
the fields for its kind; player indices and action-button indices may
not exceed `controls.players` and `controls.buttons`. At least one
usable input policy must exist, but a touch layout may omit player 2+
controls. The manifest schema is generated from the same declarations
used by the predicates, and a spec test holds the checked-in schema
equal to generated output.

For libretro only, `load.inputMap` is an inline override with the same
`direction`, `button`, `coin`, `start`, `service` and `test` fields as
the `default` object in §5b.6; it overlays the selected core map and
must still leave every declared player control resolvable. Bridge-MAME
manifests reject `inputMap` because that adapter consumes
`ArcadeControl` directly. `controls.keyboard.map`, when present, maps a
DOM `KeyboardEvent.code` to a literal `ArcadeControl`; it overlays the
shell default rather than replacing it. `controls.gamepads` supports
`enabled` and a `deadZone` in `[0, 1)` in v1. Touch component kinds are
`dpad`, `stick`, `buttons`, `button`, `coin`, `start`, `service` and
`test`; service and test are omitted from ordinary player layouts
unless a manifest asks for them. Regions are `left`, `right`,
`top-left`, `top-right`, `bottom-left` and `bottom-right`. A coin or
start component defaults to player 1 when `player` is omitted.

The build reads source paths but emits a sanitized manifest: ROM paths
become relative output URLs such as `roms/sf2.zip`; absolute paths and
the original project-relative source locations never appear in built
HTML, JavaScript, source maps or JSON. Two source paths with the same
case-folded basename reject.

### 11.2 Shell

`mount(manifestUrl)` as in the DOS runtime: title screen, corner menu
(fullscreen, sound, touch controls, reset, save state, load state,
clear saves), touch layout per orientation, keyboard and gamepad
defaults, and—when `saves.autosave` is true—autosave of the overlay on
`visibilitychange`. Save-state controls appear only when
`saves.states` is true. Vertical games get a portrait-first layout with
controls below the picture.

An `OVERLAY_INCOMPATIBLE` startup failure is shown as an old-save/build
mismatch with choices to clear the stored overlay and retry or cancel;
the shell never deletes it automatically. ROM audit failures show the
machine plus missing/bad parent, BIOS and file names, but never dump ROM
bytes.

### 11.3 Build

- `npm run pack-roms -- <slug>` validates exactly the listed zips. For
  libretro builds it parses the pinned core DAT; for direct MAME builds it
  runs that build under Node with `-verifyroms <machine> -rompath
  <tmp>`. Both paths emit the same structured report and fail for a
  missing/wrong file, parent or BIOS before a browser loads anything.
- `npm run build-manifests -- <slug>|--all [--out <dir>]` writes
  `dist/<slug>/`: page, bundled script, validated manifest, the ROM
  zips, and the selected engine's `.js`, `.wasm`, `build.json` and
  runtime input map, plus every licence/notice named by `build.json`.
  DAT files are build-time inputs and are omitted
  unless an adapter needs one at runtime. The default
  output for both one slug and `--all` keeps each `<slug>/` independently
  deployable. An explicit `--shared-emulators` mode may write engines to
  sibling `_libretro/` or `_mame/` folders; in that mode the whole output
  root, not an individual slug directory, is the deployment unit.
- Isolation headers are needed only when the selected `build.json` says
  `pthreads: true` (established by the relevant L/LM/P probe); otherwise
  the folder runs on an ordinary static host, including plain HTTP on a
  LAN for touch/keyboard play. Browser secure-context rules may still
  limit APIs such as gamepads on plain LAN HTTP.

`build-manifests` refuses an emulator artifact whose `build.json` does
not match the manifest's adapter/core/build selection. It uses relative
URLs only, does not inline ROM bytes into JavaScript, and leaves source
maps off by default so private source paths cannot leak. The host must
serve `.wasm` as `application/wasm`; the shell reports an actionable
startup error when a fetch returns HTML or the wrong artifact.

---

## 12. Milestones

The direct MAME path comes first. Everything above its adapter remains
reusable by optional later backends, but no libretro work is on the
critical path to the first usable release.

| # | Milestone | Acceptance |
| - | --------- | ---------- |
| M0 | **Probe direct MAME 0.161.** Authenticate the official source, build one small driver family natively and with Emscripten, compare those builds and answer P1–P12 (§13.1). | Probe record plus an explicit go/no-go decision for 0.161; no backend substitution |
| M1 | **MAME bridge + `MameEmulatorAdapter` + `ArcadeDisplay`.** Implement the pinned build recipe, web OSD modules, bridge exports and fresh-module lifecycle. | A MAME 0.161 game renders upright at native size and correct speed on 60 and 120 Hz displays |
| M2 | **`ArcadeAudio`.** | Audible after one gesture; `queuedMs` stays under the cap for 60 s |
| M3 | **`ArcadeInput` + `KeyboardSource` + generated MAME controller config.** | Coin, start and play from the keyboard without MAME default-key handling |
| M4 | **Touch controls + `ArcadeMapper`.** | Playable on a phone with d-pad, buttons, coin, start |
| M5 | **Saves.** NVRAM flush, `persist`, `ArcadeStorage`, save states. | High-score table and a save state survive a reload |
| M6 | **`ArcadeDeployment`.** One config composes the whole page. | Harness page is itself a deployment |
| M7 | **Manifests, shell, `build-manifests`, `pack-roms`.** | A manifest game builds to a standalone folder that runs from a static host |
| M8 | **Gamepads.** | Two standard pads drive players 1 and 2 |
| M9 | **Analog inputs.** Add MAME web-device axes for trackball, dial and paddle controls. | One analog-stick/dial title and one trackball title are playable |
| M10 | **Local MAME 0.161 compatibility matrix.** Audit and manually verify user-supplied local sets with every required parent/BIOS set supplied separately by the user. | Each set either boots and has verified metadata or has a precise audit/driver blocker recorded; no local ROM enters source or CI |
| M11 | **Optional FBNeo probe.** Answer L1–L8 (§13.2) only after M0–M8 pass. | Written evidence that the optional backend adds a measured benefit worth its separate ROM lineage and licence constraints |
| M12 | **Optional `LibretroAdapter`.** Build only the approved optional core(s) through the common adapter contract. | One optional-core manifest runs through the unchanged shell, controls and storage APIs and is clearly labeled non-MAME where applicable |
| M13 | **Pinned MAME upgrade probe.** Evaluate a newer MAME source tag through the direct bridge without changing the 0.161 build. | Side-by-side build plus documented ROM, save-state, size and performance migration costs |
| M14 | **Broader verification matrix.** Expand direct-MAME coverage across CPS-1/2, Neo Geo, System 16/18/32, Irem, Konami, Data East and Taito. | `metadata.status.verified` filled for every tested deployment |

---

## 13. Probe plans

Each answer either confirms a design choice above or changes it.

### 13.1 Direct MAME 0.161 source (M0)

Run the stock or minimally patched source before the full bridge is
written. Record source identity, commands, patches, logs and artifact
measurements under `docs/probes/mame0161/`.

| ID | Question | Decides |
| -- | -------- | ------- |
| P1 | What official source tag/archive defines MAME 0.161, what licence/notices govern its built artifacts, and do source-built `-help`, `-listfull`, `-listsource` and `-listxml` outputs agree on the version and machine data? | Immutable source identity, distribution gate and native comparison baseline |
| P2 | Which emsdk version can compile that source, what build-system changes are required, and how long does a clean single-family build take? | `EMSDK_VERSION`, build-only patch set and CI feasibility |
| P3 | Can 0.161 produce driver-family subsets, and what are raw/gzip/brotli sizes for a small family, CPS-1, Irem M72 and Neo Geo? | Family layout and download budget |
| P4 | Can one module instance run a second machine after exit, or must every start instantiate a fresh module? | Fresh-module lifecycle in §5 |
| P5 | How does its main loop schedule emulated frames, and does a near-60 Hz game run correctly on 60, 90, 120 and 144 Hz displays? | Whether the bridge replaces or wraps MAME pacing |
| P6 | Does any viable build require pthreads? | COOP/COEP requirements and static-host compatibility |
| P7 | Which video, sound, input, pause, reset, save/load and exit hooks exist in 0.161's OSD/running-machine APIs? | Exact scope of bridge patches 0001 and 0002 |
| P8 | Can NVRAM/config be flushed mid-run without exiting? | Whether patch 0003 is required |
| P9 | What renderer buffer format/orientation is available, and what does upright RGBA conversion cost on a mid-range phone? | Video bridge and rotation design |
| P10 | What mixer format/chunk cadence is available at 48 kHz? | Sound bridge and `ArcadeAudio` constants |
| P11 | Does ROM audit output reach the bridge before exit in a stable parseable form, including missing parent and BIOS dependencies? | `pack-roms` and `ROM_SET_INVALID` reporting |
| P12 | For one legally authorized, separately acquired test ROM, do native 0.161 and browser 0.161 agree on machine identity, visible geometry, refresh rate, first stable-frame hash and basic input behavior, and does the browser sustain full speed on desktop and a mid-range phone? | M0 go/no-go and parity baseline |

M0 passes only when P1–P12 have evidence and a direct 0.161 browser
build is technically viable. If it fails, the decision record names the
blocking facts and candidate MAME source versions; no FBNeo milestone
starts as an implicit workaround.

### 13.2 Optional FBNeo (M11)

Run with a logging-only libretro shim after the direct-MAME release.

| ID | Question | Decides |
| -- | -------- | ------- |
| L1 | Which emsdk version builds the pinned FBNeo commit, and does `platform=emscripten` produce a linkable static library without changes? | Optional build recipe and patches |
| L2 | `.wasm` size raw and brotli; can a driver subset be built? | Whether FBNeo offers a material size benefit over direct MAME |
| L3 | Pixel format and per-frame conversion cost on a mid-range phone? | Shim conversion path |
| L4 | Default RetroPad mapping for target boards; how are service/test reached? | `libretro/maps/fbneo.json` |
| L5 | When are NVRAM, EEPROM and high scores written? | Optional adapter persistence behavior |
| L6 | Does timing-based pacing drift against audio over ten minutes? | Whether the common session contract needs explicit rate correction |
| L7 | Which legally redistributable ROM supports automated comparison with the direct MAME path? | Optional browser fixture |
| L8 | How are vertical rotation and dynamic geometry reported? | Shim rotation behavior |

### 13.3 Other optional libretro cores (M12+)

Each additional core gets a record equivalent to L1–L8. For libretro
MAME, also record the exact MAME release it tracks, whole-core versus
family-subset size, pthread requirements, save-state behavior and why it
offers value beyond the already-working direct build. MAME 2003-Plus
must likewise justify its distinct 0.78-derived ROM lineage. Neither is
a compatibility fallback for MAME 0.161.

---

## 14. Tests

Same two-suite rule as the DOS runtime: a test that touches the DOM is
in `browser`.

**`spec`:** shared-type predicates, `ArcadeRuntimeError`, `ArcadeInput`
over `FakeArcadeSession` (including `tap` and SOCD), `ArcadeDisplay.layoutFor`,
`ArcadeMapper` target logic, `GamepadSource` with injected provider and
scheduler, controller-config generation (`web.cfg` text for 1–4
players), the overlay codec and cumulative-diff logic over an in-memory
file tree, manifest predicates/schema parity, DAT parsing, ROM dependency
reports and sanitized output-path derivation.

**`browser`:** the adapter against the real WASM build, display,
audio, player lifecycle (doubles and real build), keyboard and touch
sources through the mapper, storage with a real IndexedDB, and one
end-to-end case per milestone acceptance row that can be automated.

**`build`:** a fixture manifest produces a folder that runs when moved
under a different URL prefix; neither output text nor source maps contain
the source checkout's absolute path; a single-game build contains all
required emulator artifacts; and a corrupt/mismatched `build.json`
fails before any ROM is copied. Packaging tests assert that `npm pack`
contains no ROM, emulator cache, `res/` file or locally compiled WASM.

**Test ROMs.** Required browser cases use a legally obtained, user-supplied ROM
supported by the pinned MAME 0.161 build. The machine identity, parent identity,
driver-specific target definition and archive paths are private local probe
inputs and are not committed. The suite skips locally when its separately built
artifact is absent. Optional
libretro cases add a separate fixture only after L7 identifies one.
Commercial sets, including files under `res/`, are local manual
verification material only and never enter source, packages or CI.

### 14.1 Release gates

A milestone is complete only when its acceptance row and the relevant
automated suites pass from a clean checkout. M0 and later optional-core
probe work may use network access to fetch pinned emulator source and
explicitly free test ROMs; ordinary `check`, `test:spec` and package
tests do not require the network. Real direct-MAME browser tests may
skip in an ordinary local run when their separately built artifacts are
absent, but CI for a tagged release must build and run them. Optional
backend suites are required only for releases that ship those backends.

The first usable release demonstrates all of these flows:

1. Build one manifest into a standalone folder and serve it at a nested
   URL without editing generated files; its runtime identity reports
   the pinned direct MAME source version.
2. Insert coin, start and play from a physical keyboard on desktop.
3. Play the same deployment with touch controls in phone portrait and
   landscape layouts; rotate while running without restarting.
4. Hear synchronized stereo after one user gesture and remain below the
   audio queue cap for a 60-second run.
5. Save NVRAM and a named state, reload the page, restore both, then
   clear storage without affecting ROM assets.
6. Connect two standard gamepads and independently drive players 1 and
   2; disconnecting one releases all of its held controls.
7. Give the builder a wrong-version, incomplete, clone-only or wrong-core ROM
   set and receive an actionable audit failure before browser startup.
8. Trigger startup failure at every async boundary and observe an idle,
   reusable player with no attached listeners, animation frame, audio
   context or partial session left behind.

---

## 15. Out of scope

- The MAME UI (menus, OSD, cheat engine). Reset, save states and
  settings are reached through the runtime instead.
- Netplay.
- Software lists and home systems; arcade drivers only.
- Shipping ROMs. Deployments supply their own.
