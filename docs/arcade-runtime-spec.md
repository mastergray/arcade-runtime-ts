# Headless Browser Arcade Runtime — Implementation Spec

**Status:** draft implementation contract for `arcade-runtime-ts`, a fork of
`mame-game-runtime-ts` (kept for reference at `docs/parent/mame-game-runtime-spec.md`) that picks up at milestone M1. The M0 feasibility
probe, its evidence under `docs/probes/mame0161/`, the pinned MAME 0.161
source identity, the pinned Emscripten 1.38.31 toolchain and the diagnostic
patch archive are inherited unchanged from the parent project and are not
re-run here. Where this document says "P1–P12 established", the parent
project's probe record is the evidence.

This runtime follows the headless model of
[`dos-game-runtime-ts`](https://github.com/mastergray/dos-game-runtime-ts): a
runtime owns *how the emulator runs* and how video, audio and input cross
the browser boundary, while a page owns its layout, controls and their
meaning. It differs from the DOS runtime, and from the parent MAME spec, in
two deliberate ways:

1. **No deployments.** The DOS runtime turns a manifest plus game content
   into a standalone static folder. Arcade ROMs are commercial copyrighted
   data that this project has no right to copy, package or host, so there is
   no manifest, no shared shell, no `build-manifests`, no `pack-roms` and no
   build output that ever contains a ROM. The product is a **library**. A
   page that uses it obtains ROMs from its own user at run time (§10) and is
   solely responsible for the legality of what it loads.
2. **A wider hardware scope, built as a family matrix.** The parent spec
   targeted early-'90s 16-bit boards. This runtime must also run SNK Neo Geo,
   Capcom CPS-1 and CPS-2, and the older 8-bit and early 16-bit Namco and
   Taito architectures (`pacman.c` and `galaga.c` hardware through Namco System 1
   and 2, Taito's Z80/MCU boards through the Taito F2 generation). Each
   family is a separate pinned WebAssembly build with its own evidence (§4.6,
   §13).

The emulator remains **direct MAME source built with Emscripten** at the
authenticated `mame0161` tag, with the in-repo web bridge. The optional
libretro path from the parent spec is retained as a late, optional milestone
and is never a substitute for the direct build.

The sibling checkout at `/home/mastergray/dev/dos-game-runtime-js` remains
the behavioral reference for lifecycle, failure and test conventions
(`ctg-js-test` for the `spec` suite, `ctg-js-browser-test` for the `browser`
suite, constructors never read globals, `init` supplies browser defaults).
Where this document says "as in the DOS runtime", the named DOS behavior
applies unless this document replaces it. This document wins over the parent
MAME spec and the DOS spec if they conflict.

---

## 0. Product contract

The product is a TypeScript library. It is successful when a page author who
already has lawful ROM files can play an arcade game in a browser by composing
the library's classes and their own HTML:

1. A page composes `ArcadePlayer`, input sources, touch primitives, storage
   and its own HTML/CSS directly through the public API, or composes all of
   them at once through `ArcadeCabinet` (§10.6).
2. The page obtains ROM zips from its user through a file picker, drag and
   drop, a user-entered URL or the browser-local `ArcadeRomStore` (§10.7),
   and the runtime can tell the user *before* the emulator starts which
   files, parents, BIOS sets or sample sets are missing or wrong (§10.5).
3. The page supports desktop keyboard and gamepad play, including sound
   unlock, fullscreen, pause, reset and persistent saves, with no
   game-specific runtime code. Phone/tablet touch play is a post-1.0 goal
   (§0.2); nothing in v1.0.0 may preclude it, but nothing is gated on it.
4. Emulator details do not escape the adapter boundary. Switching between
   compatible family builds, or later between adapters, does not change the
   player, controls, cabinet or storage APIs.
5. Every supported board family in §4.6 boots, renders upright at native
   size and correct speed, and has its coverage, size and performance
   recorded.

### 0.1 DOS parity baseline

"The same as the DOS runtime" means feature parity at the page boundary, not
identical emulator internals:

| DOS runtime capability | Arcade runtime counterpart |
| ---------------------- | -------------------------- |
| `EmulatorAdapter` / `EmulatorSession` | `ArcadeAdapter` / `ArcadeSession` |
| `DosPlayer` | `ArcadePlayer` |
| `DosInput` | `ArcadeInput`, using player/button/coin/start controls instead of PC devices |
| `DosDisplay` / `DosAudio` | `ArcadeDisplay` / `ArcadeAudio` |
| `KeyboardSource`, pointer primitives, mapper | `KeyboardSource`, the shared pointer primitives, `ArcadeMapper` |
| `DosStorage` | `ArcadeStorage` |
| `DosDeployment` | `ArcadeCabinet` (composition root; no manifest behind it) |
| manifest, shared shell, static build | **not provided** (§0.3) |

Parity requires equivalent lifecycle and failure semantics: validated
construction, asynchronous `start`, explicit pause/resume, idempotent input
holds, cleanup after partial startup failure, one terminal `destroy`, typed
runtime errors, injectable browser dependencies and tests at the same public
boundary.

Arcade-specific additions are ROM-set auditing, parent/BIOS/sample-set
handling, machine metadata, coin/start/service/test controls, upright
rotation, save states, BIOS and DIP-switch selection and family-build
selection. DOS keyboard/mouse semantics are not copied when an arcade
machine does not have those devices.

### 0.2 Definition of v1.0.0

The first release, `v1.0.0`, is M1 through M9 in §12. It needs the pinned
direct MAME 0.161 build for every family listed as *required* in §4.6 and at
least one legally obtained, user-supplied test set per family, kept private
as in §14. The 0.161 pin is inherited from M0; a change of MAME release or
toolchain reopens M0 in the parent probe record rather than being carried
silently.

v1.0.0 is a **desktop release**: keyboard and gamepad input are required,
and gamepads are a first-class input from the start (the DOS runtime treated
them as an add-on). Mobile is explicitly not prioritized: touch primitives,
`ArcadeMapper`, portrait layouts and the physical-phone performance gate are
post-1.0 (M10). The mobile-proxy measurements in F6 are still recorded
during M2 because they are cheap and inform family labels, but no v1.0.0
acceptance row depends on them.

v1.0.0 also ships a **preload** mechanism (§11.1) so a developer can test one
machine with one BIOS from locally configured files without a file picker. It
is a harness and test convenience, lives outside the package, and is not a
deployment.

### 0.3 ROMs, legality and the no-deployment rule

The runtime, npm package, source repository, automated build outputs and
hosted documentation never contain, embed, hash-to-content, link to or
default to third-party commercial ROM data. Concretely:

- There is no build step that copies ROMs anywhere. `scripts/` contains no
  ROM packer, and the family build pipeline (§4.1) takes no ROM input.
- The library has no default ROM URL and no example that points at one.
  `ArcadePlayer` accepts URLs only because a page author may serve their own
  lawful files from their own origin; that choice and its legality are the
  page's.
- `ArcadeRomStore` (§10.7) keeps user-picked files in that user's own
  browser only. Nothing it stores leaves the device or is readable by the
  library's author.
- Commercial and user-supplied files under this checkout's git-ignored
  `res/` directory are local manual probe inputs, not fixtures. Their
  identities, hashes and driver-specific build configs stay in ignored
  local JSON, as in the parent project.
- Repository evidence (probe records, test logs, sizes) may name a board
  *family* and a MAME *driver source file*, and the spec may use short names
  such as `sf2` to describe hardware scope, but committed test evidence
  never records which private set was used.
- The repository may hold ROM **metadata** derived from the pinned MAME
  source itself (names, sizes, CRC32/SHA-1 of expected files, parent and
  BIOS relationships) because MAME's source carries that data and it is
  required to audit a user's files. Metadata is not content.

### 0.4 Emulator licensing

ROM rights and emulator-source rights are separate gates. P1 recorded the
licence files and redistribution/commercial-use conditions of the pinned
0.161 source; every family `build.json` names those licences, and consumers
who host a family build must serve the notices beside the WASM (§4.1 step 6
emits them). The npm package does not publish a prebuilt MAME binary by
default. No tagged release or hosted demo distributes an emulator artifact
until its pinned source, patches and distribution method have passed that
licence review (M9).

---

## 1. Package

### 1.1 Identity

| Field               | Value |
| ------------------- | ----- |
| Package name        | `arcade-runtime-ts` |
| Consumer            | A page that owns its HTML, layout, control mappings and the lawful acquisition of ROM files at run time |
| Runtime environment | Evergreen browsers with WebAssembly, Pointer Events, `AudioContext`, Gamepad API, `requestAnimationFrame`, File API, IndexedDB |
| Test environment    | Node ≥ 22.13 (`spec`); Chromium through `ctg-js-browser-test` (`browser`) |
| Primary emulator    | MAME 0.161 source (tag `mame0161`, commit `76b978d0…`, inherited `mame/SOURCE.json`), built with pinned emsdk 1.38.31 and the in-repo web bridge |
| Upgrade path        | Later pinned MAME source releases reuse the direct bridge after their own compatibility/performance probes (M16) |
| Runtime JS deps     | `fflate` (zip read/write for the save overlay and zip central-directory reading for the ROM audit), confined to internal codecs |
| Shared mechanics    | `Button`, `DPad`, `AnalogStick`, `Trackpad` ported unchanged from the DOS runtime and re-exported here; they emit mechanical events only |
| Optional cores      | FBNeo and libretro MAME, built **after** the direct-MAME release and driven without RetroArch (§5b of the parent spec, carried as M14/M15) |

### 1.2 Layout

```
arcade-runtime-ts/
    mame/
        VERSION                 # mame0161 (inherited)
        EMSDK_VERSION           # 1.38.31 (inherited)
        SOURCE.json             # authenticated tag/commit identity (inherited)
        patches/                # production bridge patch set, applied in order
            0001-web-osd-modules.patch
            0002-web-bridge-exports.patch
            0003-nvram-flush.patch
            0004-qsound-rom-optional.patch
        probes/
            patches/            # the inherited M0 diagnostic patches 0001–0010; never applied to production builds
        bridge/                 # C++ sources the production patches add
            web_video.cpp
            web_sound.cpp
            web_input.cpp
            web_bridge.cpp
            web_bridge.h
        targets/                # one 0.161 target pair per family: <family>.lua + <family>.lst
            neogeo.lua          neogeo.lst
            cps1.lua            cps1.lst
            cps2.lua            cps2.lst
            namco-classic.lua   namco-classic.lst
            namco-s1.lua        namco-s1.lst
            namco-s2.lua        namco-s2.lst
            taito-classic.lua   taito-classic.lst
            taito-16.lua        taito-16.lst
        builds/                 # build matrix: one JSON per family (§4.1)
            neogeo.json  cps1.json  cps2.json  namco-classic.json  namco-s1.json
            namco-s2.json  taito-classic.json  taito-16.json
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
        RomSetAudit/
        ArcadeRomStore/
        ArcadeCabinet/
        LibretroAdapter/        # optional, after the direct-MAME release
    harness/
        index.html              # developer page: file picker + ArcadeCabinet; not a deployment
        harness.ts
    scripts/
        build-mame.ts           # checkout, patch, build one or all families, copy artifacts
        extract-romsets.ts      # -listxml of a family build → romsets/<machine>.json metadata
        mame-build/             # pure helpers behind the two scripts: build identity, romsets conversion, Node runner
        audit-roms.ts           # Node-side audit of local zips against a family's romsets (local use only)
        serve-harness.ts        # serves harness/ and dist/mame/; --preload <config> adds the private files it names (§11.1)
        inspect-mame-threading.ts   # inherited build gate
        probe-mame0161-tiny.sh      # inherited probe driver
        probe-mame0161-native-parity.sh
    tests/
        run.ts
        support/
        spec/
        browser/
    docs/
        arcade-runtime-spec.md
        probes/
            mame0161/           # inherited M0 record (P1–P12)
            families/           # F1–F11 records, one file per family (§13.1)
    package.json
    tsconfig.json
    tsconfig.package.json
    tsconfig.tests.json
```

Class folders are in implementation order; later classes import from
earlier ones, never the reverse. `harness/` is a page that *uses* the
library the way a consumer would; it is excluded from the package and never
ships ROMs.

### 1.3 The replacement boundary

Everything above the adapter talks only to `ArcadeAdapter` and
`ArcadeSession` (§2). Two classes may implement them:

- **`MameEmulatorAdapter`** (§5) drives a pinned MAME family build through
  the web bridge (§4). This is the required, first-built path.
- **`LibretroAdapter`** (parent spec §5b) drives an optional libretro core
  through a C shim. It is built only after the direct MAME path reaches the
  first usable release and never changes the public runtime above the
  adapter.

Only those two folders load an Emscripten module. A grep for the module
loader across `src/` must return exactly those two. Omitting the adapter
type in programmatic config means direct MAME, never libretro.

### 1.4 Public package surface

v1.0.0 exports `ArcadeRuntimeError`, `MameEmulatorAdapter`, `ArcadeInput`,
`ArcadeDisplay`, `ArcadeAudio`, `ArcadePlayer`, `KeyboardSource`,
`GamepadSource`, `ArcadeStorage`, `RomSetAudit`, `ArcadeRomStore`,
`ArcadeCabinet`, `DEFAULT_KEYBOARD_MAP`, and every public config/event type
with its structural predicate. `ArcadeMapper` and the four shared pointer
primitives join the root export with M10. Internal Emscripten module types, overlay helpers and
`-listxml` parsers are not public.

| Export | Resolves to |
| ------ | ----------- |
| `arcade-runtime-ts` | compiled library and declarations in `dist/` |
| `arcade-runtime-ts/package.json` | package metadata |

There are no `/shell` or `/manifest` subpaths and no `build-manifests` or
`pack-roms` bins. The only bin is `arcade-audit-roms`, a local Node tool
that reads a family's `romsets/` metadata and reports on zips the user names
on the command line; it copies nothing. Package tarballs include compiled
library files and that bin, and exclude ROMs, test fixtures, emulator source
caches, `harness/`, `res/` and locally built emulator artifacts. Emulator
artifacts are consumer-hosted inputs, not npm payload, unless a future
release explicitly chooses and documents a redistributable prebuilt-build
package (M9).

---

## 2. Shared Types (`src/shared.types.ts`)

### 2.1 Arcade input vocabulary

An arcade machine has players, sticks, buttons, coin slots and start
buttons. The runtime speaks that vocabulary directly, and the bridge maps it
onto MAME's input ports through generated controller config (§4.4), so no
MAME default key mapping is involved.

```ts
type PlayerIndex = 1 | 2 | 3 | 4;
type PlayerCount = 1 | 2 | 3 | 4;
type ArcadeDirection = "up" | "down" | "left" | "right";
type ArcadeButtonIndex = 1 | 2 | 3 | 4 | 5 | 6;
type ArcadeButtonCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;     // 0: boards with no action buttons

type ArcadeControl =
    | { readonly kind: "direction"; readonly player: PlayerIndex; readonly direction: ArcadeDirection }
    | { readonly kind: "button";    readonly player: PlayerIndex; readonly button: ArcadeButtonIndex }
    | { readonly kind: "coin";      readonly player: PlayerIndex }
    | { readonly kind: "start";     readonly player: PlayerIndex }
    | { readonly kind: "select";    readonly player: PlayerIndex }   // Neo Geo AES; ignored elsewhere
    | { readonly kind: "service" }
    | { readonly kind: "test" }
    | { readonly kind: "tilt" };

type Unsubscribe = () => void;
type Listener<T> = (event: T) => void;

interface Rect { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }

interface InputSurface {
    addEventListener(type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void;
    removeEventListener(type: string, listener: (event: Event) => void, options?: EventListenerOptions): void;
    getBoundingClientRect(): Rect;
    setPointerCapture?(pointerId: number): void;
    releasePointerCapture?(pointerId: number): void;
}

interface FrameScheduler {
    request(callback: (time: number) => void): number;
    cancel(handle: number): void;
}

interface FetchResponseLike { readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer>; }
type FetchLike = (url: string) => Promise<FetchResponseLike>;
```

`ArcadeButtonCount` admits `0` because `pacman.c`, `rallyx.c` and `galaga.c`-class
boards have no action buttons. `select` and `tilt` exist so the vocabulary
covers Neo Geo AES mode and the older boards' tilt switch; a session whose
machine has no such port accepts the control and does nothing (§5).
Analogue controls (M11, W26) are a separate `ArcadeAxis` vocabulary, not
part of `ArcadeControl`, with two digital additions:

```ts
type ArcadeControl = … the variants above …
    | { readonly kind: "stick"; readonly player: PlayerIndex; readonly stick: 1 | 2; readonly direction: ArcadeDirection }   // one physical stick of a dual-stick board
    | { readonly kind: "pedal"; readonly player: PlayerIndex; readonly pedal: 1 | 2 | 3 };                                    // digital pedal press

type ArcadeAxisKind = "stick-x" | "stick-y" | "stick-z" | "pedal-1" | "pedal-2" | "spin-x" | "spin-y";
interface ArcadeAxis { readonly player: PlayerIndex; readonly kind: ArcadeAxisKind; }

type MachineAnalogKind = "stick-x" | "stick-y" | "stick-z" | "paddle" | "paddle-v" | "pedal-1" | "pedal-2" | "pedal-3"
    | "dial" | "dial-v" | "trackball-x" | "trackball-y" | "lightgun-x" | "lightgun-y" | "mouse-x" | "mouse-y" | "positional" | "positional-v";
interface MachineInputs { readonly analog: ReadonlyArray<{ readonly player: PlayerIndex; readonly kind: MachineAnalogKind }>; readonly dualStick: boolean; }
```

`arcadeControlKey` assigns the `stick` and `pedal` variants distinct
canonical keys. Absolute axis values use [−1, 1], with sticks centred at 0
and pedals ranging from −1 released to +1 floored; `spin-*` values are
signed pixel deltas per call. `MachineInfo.inputs` reports one analogue row
per distinct player and kind plus `dualStick`, and
`ArcadeSession.setAxis(axis, value)` writes an absolute normalized value or
a relative pixel delta: out-of-range absolute values are clamped and a
non-finite value throws `INVALID_CONFIG`.

The pointer primitives retain the DOS runtime's complete `PointerEventLike`,
`InputSurface`, geometry, scheduler and timer types. Those types and
predicates are part of the root export.

### 2.2 Machine description

Read from the active adapter at boot. Width and height describe the upright
RGBA frames delivered by `onFrame`; rotation has already been applied.

```ts
type Orientation = "horizontal" | "vertical";

interface MachineInfo {
    readonly name: string;           // short name, e.g. "sf2"
    readonly description: string;    // e.g. "Example Fighter (World)"
    readonly family: string;         // family id of the build that produced it, e.g. "cps1"
    readonly width: number;          // upright output width in pixels
    readonly height: number;         // upright output height in pixels
    readonly refreshHz: number;      // e.g. 59.637 (CPS), 59.185 (Neo Geo), 60.606 (Namco classics)
    readonly orientation: Orientation;
    readonly aspectRatio: number;    // display aspect after rotation; NOT width/height (CPS 384×224 is 4/3)
    readonly players: number;
    readonly buttons: ArcadeButtonCount;
    readonly bios: ReadonlyArray<{ readonly name: string; readonly description: string; readonly isDefault: boolean }>;
    readonly hasNvram: boolean;      // false for most pre-1986 boards: high scores do not survive exit
}
```

`bios` is empty for machines without a BIOS selection. `hasNvram` lets a page
avoid promising persistence a board never had: `pacman.c` and `galaga.c` boards keep high
scores in RAM only, and MAME 0.161 core has no high-score plugin. Losing
those scores is not a defect in v1.0.0; M12 specifies the bridge that can
later persist them (§12.2).

### 2.3 Session and adapter

```ts
interface FrameEvent { readonly width: number; readonly height: number; readonly rgba: Uint8ClampedArray; }  // reused buffer; copy if kept
interface SoundEvent { readonly samples: Float32Array; readonly frames: number; }                            // interleaved stereo

type RomRole = "game" | "parent" | "bios" | "samples" | "device";   // device: a MAME device's own ROM set, e.g. a Namco MCU program

interface RomFile {
    readonly name: string;              // unique basename, e.g. "sf2.zip", "neogeo.zip"
    readonly bytes: Uint8Array;
}

interface ArcadeStartConfig {
    readonly machine: string;           // MAME short name
    readonly machineHints: { readonly players: PlayerCount; readonly buttons: ArcadeButtonCount };
    readonly roms: ReadonlyArray<RomFile>;
    readonly changes?: Uint8Array;      // overlay from a previous persist()
    readonly bios?: string;             // MAME -bios value, e.g. "euro", "japan", "asia", "us"
    readonly dipswitches?: Readonly<Record<string, string>>;   // port name → setting name (M8)
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
    onTick(listener: Listener<void>): Unsubscribe;   // once per emulated frame, even when video is skipped
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
    readonly engine: string;            // family id
    readonly emulatorVersion: string;   // "mame0161"
    readonly emsdkVersion: string;
    readonly machines: ReadonlyArray<string>;
    readonly artifacts: ReadonlyArray<string>;
    readonly romsetsUrl: string;        // relative directory holding romsets/<machine>.json (§10.5)
    readonly memoryPages: number;       // fixed Wasm memory, 64 KiB pages; 4096 unless a family probe raises it
    readonly licenses: ReadonlyArray<{ readonly id: string; readonly notice: string }>;
    readonly pthreads: boolean;
}

type EmscriptenModuleFactory = (options: Readonly<Record<string, unknown>>) => Promise<EmscriptenModuleLike>;
type ModuleLoader = (moduleUrl: string) => Promise<EmscriptenModuleFactory>;
```

`EmscriptenModuleLike` is a private structural type owned by each adapter.
A build's `buildId` hashes its normalized build metadata, emulator source
identity, target/patch hashes and compiler flags, not timestamps or paths.
`build.json` is checked by a structural predicate before an adapter trusts it.

ROM names are non-empty basenames with no `/`, `\\`, `.` or `..` segments;
names compare case-insensitively and duplicates reject with
`INVALID_CONFIG`. Bytes are copied before the caller can mutate them.
Sample-set zips (§4.6, Namco classics) are ordinary `RomFile`s; the adapter
places them under the sample path by their role in the audit metadata.

Each type has a structural predicate (`isArcadeControl`, `isMachineInfo`,
`isArcadeSession`, …) tested in `spec/10-shared-types.test.ts`: one passing
input, then one input per violated condition.

### 2.4 Save-overlay wire format

`changes` and `persist()` use a versioned zip. The archive contains
`overlay.json` plus files under the logical roots `nvram/`, `cfg/`,
`states/` and `memcard/`. Adapters map those roots to their own MEMFS
directories; physical paths never enter the wire format.

```json
{
    "format": "arcade-runtime-overlay",
    "version": 1,
    "adapter": "mame",
    "engine": "neogeo",
    "buildId": "<build fingerprint>",
    "machine": "mslug"
}
```

The adapter rejects an overlay for a different adapter, engine, build,
machine or format version with `OVERLAY_INCOMPATIBLE`. Exact build matching
is strict in v1 because serialized states are not stable across builds.
`memcard/` exists for Neo Geo memory cards; probe F8 decides whether 0.161
writes them under its NVRAM directory (in which case the root stays empty
and reserved) or elsewhere.

Archive readers reject absolute paths, backslashes, NULs, empty segments,
`.`/`..`, symlinks, duplicate case-folded names and entries outside the four
roots. Default limits are 64 MiB compressed, 256 MiB expanded and 4,096
files. Writers sort paths, use fixed timestamps and omit empty directories so
equal persisted trees produce equal bytes.

---

## 3. `ArcadeRuntimeError`

One error class matching `DosRuntimeError`: immutable `code`, `name`,
`message`, `data`, a frozen numeric `CODE` registry, a validating config
predicate and `ArcadeRuntimeError.is()`.

| Code | Name | Raised when |
| ---- | ---- | ----------- |
| -1 | `INVALID_CODE` | Construction sentinel |
| 1 | `INVALID_CONFIG` | A config, argument or setter value fails its predicate |
| 2 | `INVALID_MESSAGE` | Construction sentinel |
| 3 | `INTERNAL_ERROR` | A state believed impossible |
| 4 | `ADAPTER_FAILED` | The Emscripten module failed to load, instantiate or start |
| 5 | `ROM_LOAD_FAILED` | A ROM URL could not be fetched or a `File`/`Blob` could not be read |
| 6 | `ROM_SET_INVALID` | MAME's audit rejected the set; `data` holds the audit report (§10.5 shape when available, else ordered log records) |
| 7 | `MACHINE_NOT_IN_BUILD` | The requested machine is not in the loaded family build |
| 8 | `NOT_STARTED` | A session operation before `start()` resolved |
| 9 | `ALREADY_STARTED` | `start()` while starting or running |
| 10 | `DESTROYED` | Any operation after `destroy()` or session exit |
| 11 | `FULLSCREEN_FAILED` | `requestFullscreen` rejected |
| 12 | `AUDIO_FAILED` | `AudioContext` could not be resumed or a node created |
| 13 | `STORAGE_FAILED` | IndexedDB open, read or write failed (overlay or ROM store) |
| 14 | `STATE_FAILED` | A save state could not be written or loaded |
| 15 | `UNSUPPORTED` | The browser lacks a required API, or the machine lacks the requested feature (e.g. `bios` on a machine with none) |
| 16 | `OVERLAY_INCOMPATIBLE` | A save overlay belongs to another format, adapter, engine, build or machine |
| 17 | `MEMORY_EXCEEDED` | The module's fixed memory cannot hold the ROM set plus the machine's regions (§4.6, F3) |

---

## 4. The MAME source build and bridge

### 4.1 Build pipeline (`scripts/build-mame.ts`)

1. Read `mame/VERSION`, `mame/EMSDK_VERSION` and `mame/SOURCE.json`.
2. Ensure emsdk 1.38.31 is installed and activated (the inherited
   `res/emsdk` convention or `EMSDK_DIR`).
3. Fetch the official source archive, verify the identity recorded by P1,
   and unpack it into `.cache/mame/<version>/` (reused across builds).
4. Apply the two **toolchain patches** the pinned release needs for any
   browser build (`0001-emscripten-1.38.31-compatibility` and
   `0005-emscripten-disable-mongoose`, named by `TOOLCHAIN_PATCHES` in
   `scripts/mame-build/buildInfo.ts` and kept with the M0 evidence under
   `mame/probes/patches/`), then `mame/patches/*.patch` in name order; fail
   on any reject. No other probe patch is ever applied to a production
   build.
5. For each requested `mame/builds/<family>.json`, copy that family's
   `mame/targets/<family>.lua` and `<family>.lst` into the source tree's
   `scripts/target/mame/` and `src/mame/`, then run the recipe P2 recorded:
   `REGENIE=1 SUBTARGET=<family>` through the release's `asmjs`/Emscripten
   path, followed by the modularized link the probe scripts use today
   (`-s MODULARIZE=1 -s EXPORT_NAME=createMame`, fixed `TOTAL_MEMORY` of
   `memoryPages × 64 KiB`, no pthreads). This is the 0.161 subset mechanism:
   a target Lua selects CPU/sound/machine/bus cores and compilation units
   and a `.lst` exposes driver names. The modern `SOURCES=` form does not
   apply to this release.
6. Link `mame<family>.js` and `mame<family>.wasm` into `dist/mame/<family>/`
   with `build.json`, the licence notices named in P1 under `notices/`, and
   the `romsets/` metadata directory produced by `extract-romsets.ts`
   (§10.5). `machines` is what the fresh build reports to `-listfull`
   under Node, and `romsets/` is converted from the same build's
   `-listxml`; both run the modularized factory under Node through
   `scripts/mame-build/nodeRunner.ts`.
7. Run `inspect-mame-threading.ts` over every generated pair; fail if any
   artifact requires shared memory or a worker (inherited P6 gate).

A build file:

```json
{
    "family": "cps2",
    "target": "mame/targets/cps2.lua",
    "list": "mame/targets/cps2.lst",
    "memoryPages": 4096,
    "sources": ["src/mame/drivers/cps2.c", "src/mame/machine/cps2crpt.c", "src/mame/drivers/cps1.c", "src/mame/video/cps1.c", "src/mame/machine/kabuki.c"]
}
```

`sources` is informational and must agree with the Lua; the authoritative
machine list is what the pinned build reports into `build.json`, which is
what `MACHINE_NOT_IN_BUILD` checks against. `memoryPages` defaults to 4096
(256 MiB, the inherited fixed-memory link) and may be raised per family only
on F3 evidence.

`MODULARIZE` matters: P4 showed one module cannot run a second machine, so
the adapter instantiates a **fresh module per `start()`** and discards it on
exit.

### 4.2 Web OSD modules (`0001-web-osd-modules.patch`)

MAME's OSD layer selects video, sound and input implementations by option.
The patch registers a `web` implementation of each, at whatever OSD boundary
0.161 exposes (P7 recorded it), and the adapter starts MAME with all of them
set to `web`.

- **`web` video.** Uses MAME's software renderer to rasterize the render
  primitive list into a 32-bit buffer at the machine's native size with
  orientation applied, converts `RGB32`/BGRX to opaque RGBA8888 in a reused
  C++ buffer (P9), and calls the JS frame callback with pointer, width and
  height once per emulated frame.
- **`web` sound.** Receives the mixed stereo stream from the sound manager
  as interleaved signed 16-bit left/right at 48 kHz in 960-frame chunks
  (P10), converts to float, and calls the JS sound callback.
- **`web` input.** Registers one virtual joystick device per player ("Web
  Pad 1"…"Web Pad 4"), each with four digital directions and twelve buttons
  (six action, coin, start, select, and on pad 1 service, test and tilt).
  Its state lives in a static array the bridge writes into; MAME polls it
  like any other device. Since M11 (W26) items 0–15 keep their meanings,
  items 16–19 are `HAT2UP/DOWN/LEFT/RIGHT` (stick 2), items 20–23 are
  `HAT3UP/DOWN/LEFT/RIGHT` (stick 1) and items 24–26 are
  `BUTTON13/14/15` (digital pedal presses); each pad also registers
  `XAXIS`, `YAXIS`, `ZAXIS`, `RXAXIS`, `RYAXIS`, `ADD_RELATIVE1` and
  `ADD_RELATIVE2` at axis indices 0–6, the first five absolute and the last
  two relative read-and-clear accumulators.

### 4.3 Bridge exports (`0002-web-bridge-exports.patch`)

C functions marked `EMSCRIPTEN_KEEPALIVE`, called through `cwrap`:

| Export | Does |
| ------ | ---- |
| `web_set_control(pad, control, pressed)` | Writes the virtual device state |
| `web_set_axis(pad, axis, value)` | Writes a virtual-pad axis (M11): ignores an out-of-range pad or axis; an absolute axis clamps `value` to [−1, 1] and stores `value × INPUT_ABSOLUTE_MAX`; a relative axis treats `value` as pixels and adds `value × INPUT_RELATIVE_PER_PIXEL` to an accumulator the item callback returns and clears |
| `web_pause()` / `web_resume()` | `machine().pause()` / `resume()` |
| `web_reset(hard)` | Schedules a soft or hard reset |
| `web_save_state(name)` / `web_load_state(name)` | `schedule_save` / `schedule_load`; completion through a callback |
| `web_flush_nvram()` | Writes NVRAM (and memory card, per F8) to the filesystem without exiting (patch 0003) |
| `web_exit()` | Schedules exit |
| `web_machine_info(out)` | Fills a struct for `MachineInfo`, including BIOS options and NVRAM presence |

Callbacks into JS (`EM_JS`): `onTick`, `onFrame`, `onSound`,
`onStateDone(ok)`, `onExit`, `onFrontendDone(result)`, `onLog(level, text)`.
`onTick` fires once per emulated frame even when frameskip suppresses video.

P7 and P8 constraints carry over: scheduled state work is serviced only at
an explicit between-timeslice boundary; the missing MEMFS state node is
created before MAME opens it; `immediate_save`/`immediate_load` are never
called; stock `config_save_settings()` is never called mid-run; and the
bridge reports `cli_frontend::execute()` completion directly because the
pinned runtime does not call `Module.onExit` after an early frontend return
(P11).

#### 4.3.1 JavaScript-facing module shape

This is the **cross-package contract** between the bridge (W3) and the
adapter (W4). The adapter is tested against a `FakeModuleLoader` module of
this shape; the bridge is tested by driving a real build through it.

**Instantiation.** The build's JavaScript is a 1.38.31 `MODULARIZE` factory
named `createMame`, installed as a global by a classic (non-ESM) script;
the adapter's default loader injects it with a `<script>` tag and a page
may inject any other `ModuleLoader`. The adapter calls it with
`{ noInitialRun: true, print, printErr, locateFile, web }`, where `web` is
the callback object below, then writes MEMFS inputs, then calls
`Module.callMain(argv)`. `callMain` returns after `cli_frontend::execute()`
has either (a) failed before the machine ran, in which case
`web.onFrontendDone(result)` has already fired with the numeric `MAMERR_*`
result, or (b) handed the running machine to the bridge, in which case the
native stack has been unwound in the way the probe patches established and
the machine is advanced only by `web_run_frames`.

**Runtime methods** the build must export (`EXTRA_EXPORTED_RUNTIME_METHODS`):
`FS`, `callMain`, `cwrap`, `ccall`, `UTF8ToString`, `HEAPU8`, `HEAPF32`.

**Exports** (`EMSCRIPTEN_KEEPALIVE`, called through `cwrap`):

| Export | Signature | Does |
| ------ | --------- | ---- |
| `web_run_frames` | `(count: i32) → i32` | Advances the device scheduler until `count` emulated screen frames have elapsed, or fewer if exit became pending; services at most one pending scheduled state operation at the between-timeslice boundary before the first frame. Returns frames actually run. A no-op returning 0 while paused. |
| `web_pump` | `() → void` | Runs the video/OSD boundary once without advancing the scheduler (used while paused so the last frame can be redrawn). |
| `web_set_control` | `(pad: i32, item: i32, pressed: i32) → void` | Writes virtual device state. `pad` is 0–3; `item` is the §4.4 row order: 0–3 hat up/down/left/right, 4–9 buttons 1–6, 10 coin, 11 start, 12 select, 13 service, 14 test, 15 tilt. |
| `web_set_axis` | `(pad: i32, axis: i32, value: f32) → void` | Writes a virtual-pad axis (M11); `axis` is the §4.2 axis index 0–6, absolute values are clamped to [−1, 1], relative values are pixel deltas accumulated until the next sample. |
| `web_pause` / `web_resume` | `() → void` | `machine().pause()` / `resume()`. |
| `web_reset` | `(hard: i32) → void` | Schedules a soft reset; `hard` is accepted and ignored because a hard reset is a fresh module (§5). |
| `web_save_state` / `web_load_state` | `(name: char*) → void` | Schedules save/load of `/mame/sta/<name>.sta`; completion arrives on `onStateDone`. |
| `web_flush_nvram` | `() → i32` | Flushes NVRAM (and memory card, F8) to MEMFS without exiting; returns 0 on success. |
| `web_exit` | `() → void` | Schedules exit; `onExit` fires once the bridge has stopped and flushed. |
| `web_machine_info` | `() → char*` | Returns a NUL-terminated JSON string owned by the bridge, valid until the next call: `{ name, description, width, height, refreshHz, orientation, aspectRatio, players, buttons, inputs: { analog: [{player, kind}], dualStick }, bios: [{name, description, isDefault}], hasNvram }`. The adapter adds `family` from `build.json`. `width` and `height` are valid from the first `onFrame` onward (the 0.161 render target has no size before it first rasterizes), so the adapter reads this inside its first-frame callback. |

**Callbacks** read from `Module.web` at the moment each fires:

| Callback | Arguments | Fires |
| -------- | --------- | ----- |
| `onTick` | `()` | Once per emulated screen frame, including skipped video. |
| `onFrame` | `(ptr: i32, width: i32, height: i32)` | Once per rendered frame; `HEAPU8` at `ptr` holds `width × height × 4` RGBA bytes, valid only during the callback. |
| `onSound` | `(ptr: i32, frames: i32)` | Per mixer chunk; `HEAPF32` at `ptr / 4` holds `frames × 2` interleaved floats, valid only during the callback. |
| `onStateDone` | `(ok: i32)` | After a scheduled save or load completes or fails. |
| `onExit` | `()` | After `web_exit` has stopped the machine and flushed persistence. |
| `onFrontendDone` | `(result: i32)` | When `cli_frontend::execute()` returns before the machine ran. |
| `onLog` | `(level: i32, ptr: i32)` | For every OSD output line; `level` is 0 error, 1 warning, 2 info, 3 debug/verbose; `UTF8ToString(ptr)` is the text. |

A missing callback is a no-op, not an error. The accumulator that turns
elapsed wall time into a frame count lives in the adapter (§5), which is
why `web_run_frames` takes a count: pacing is then testable in `spec`
with `FakeFrameScheduler` and a fake clock, and the bridge stays free of
timing policy.

### 4.4 Generated controller config

At start, the adapter writes `/mame/ctrlr/web.cfg` mapping each MAME port to
the web devices and starts MAME with `-ctrlr web`. Keyboard defaults and
the MAME UI are never in the input path. Probe F10 records how each family
names its ports (for example two-player alternating boards that share one
physical stick, and Neo Geo AES `SELECT`) so the generator covers every
family without per-machine code.

The file is the 0.161 controller-config shape (`config.c`, `ioport.c`):

```xml
<?xml version="1.0"?>
<mameconfig version="10">
    <system name="default">
        <input>
            <port type="P1_JOYSTICK_UP"><newseq type="standard">JOYCODE_1_HAT1UP</newseq></port>
            <port type="COIN1"><newseq type="standard">JOYCODE_1_BUTTON7</newseq></port>
            …
        </input>
    </system>
</mameconfig>
```

The token vocabulary below is a **cross-lane contract**: the web input
module (W3) registers exactly these items on each pad, and the generator
(W7) emits exactly these tokens. Web Pad *n* is joystick device index
*n − 1*, so its codes print as `JOYCODE_n_…` (`code_to_token` adds one).
Every item is digital; directions use the hat-switch item ids so no axis
emulation is needed.

| `ArcadeControl` | MAME port token (player *n*) | Web Pad *n* item | Joystick code |
| --------------- | ---------------------------- | ---------------- | ------------- |
| direction up/down/left/right | `Pn_JOYSTICK_UP` / `_DOWN` / `_LEFT` / `_RIGHT` | `ITEM_ID_HAT1UP` / `HAT1DOWN` / `HAT1LEFT` / `HAT1RIGHT` | `JOYCODE_n_HAT1UP` … |
| button 1–6 | `Pn_BUTTON1` … `Pn_BUTTON6` | `ITEM_ID_BUTTON1` … `BUTTON6` | `JOYCODE_n_BUTTON1` … |
| coin | `COINn` | `ITEM_ID_BUTTON7` | `JOYCODE_n_BUTTON7` |
| start | `STARTn` | `ITEM_ID_BUTTON8` | `JOYCODE_n_BUTTON8` |
| select | `Pn_SELECT` | `ITEM_ID_BUTTON9` | `JOYCODE_n_BUTTON9` |
| service (pad 1 only) | `SERVICE1` (the service button, default key 9) | `ITEM_ID_BUTTON10` | `JOYCODE_1_BUTTON10` |
| test (pad 1 only) | `SERVICE` (the service-mode toggle, default key F2) | `ITEM_ID_BUTTON11` | `JOYCODE_1_BUTTON11` |
| tilt (pad 1 only) | `TILT` and `TILT1` | `ITEM_ID_BUTTON12` | `JOYCODE_1_BUTTON12` |

In 0.161 `SERVICE` is the test-mode toggle and `SERVICE1` the service button, so the two are distinct ports, not aliases. Where the table lists two port tokens, the generator emits both lines;
0.161 ignores a `port type` it cannot resolve for the running machine, so
the extra line is harmless and covers drivers that declare either form.
The generator emits ports for players 1 through the requested count only,
and omits `Pn_SELECT` lines unless the machine reports a select port
(F10). Since M11 (W26) the file also binds, unconditionally for each
player, the X/Y/Z, RX/RY and two relative Web Pad axes to their analogue
port types (`AD_STICK_X` and `PADDLE` → `XAXIS`; `AD_STICK_Y` and `PADDLE_V`
→ `YAXIS`; `AD_STICK_Z` → `ZAXIS`; `PEDAL` → `RXAXIS`; `PEDAL2` → `RYAXIS`;
`DIAL` and `TRACKBALL_X` → `ADDREL1`; `DIAL_V` and `TRACKBALL_Y` →
`ADDREL2`), and supplies `increment` and `decrement` sequences from `HAT1`
(X-like ports on left/right, Y-like ports on up/down) and from
`BUTTON13`–`BUTTON15` (`AD_STICK_Z` and the three pedals), so MAME's own
driver key delta and centre delta provide the digital ramps. A standard
`HAT1` synthesizes dual-stick forward, reverse and tank turns
(`Pn_JOYSTICKLEFT_UP` is `HAT1UP OR HAT1RIGHT OR HAT3UP`, and so on), while
`HAT3` independently drives the left stick and `HAT2` the right stick.
MAME 0.161 ignores a configured port type absent from the running machine.

### 4.5 Start options

The adapter fixes the logical settings below using the 0.161 option names
recorded in `src/emu/emuopts.c` (`rompath`, `samplepath`, `ctrlrpath`,
`cfg_directory`, `nvram_directory`, `state_directory`, `skip_gameinfo`,
`nothrottle`, `noautosave`, `nomouse`, `samplerate 48000`, `rotate`, plus the
`web` OSD selections), and these are not overridable:
ROMs under `/mame/roms`, samples under `/mame/samples`, persistence under
`/mame/{nvram,cfg,sta}`.

Overridable through `ArcadeStartConfig`: `bios` (passed as `-bios`),
`dipswitches` (written into a generated `cfg/<machine>.cfg` before start,
M8), and `options` for `frameskip` and `samplerate`.

### 4.6 Board-family build matrix

Each family is one WebAssembly build. The list below defines scope; the
exact Lua core selections and compilation units are copied from the
corresponding blocks of the pinned source's `scripts/target/mame/mame.lua`
and verified by F1. Device names are those the pinned drivers configure.

| Family id | Required | Driver sources (0.161) | CPU cores | Sound / machine cores | Notes |
| --------- | :------: | ---------------------- | --------- | --------------------- | ----- |
| `neogeo` | yes | `drivers/neogeo.c`, `drivers/neogeo_noslot.c`, `video/neogeo.c`, `video/neogeo_spr.c`, `machine/neoboot.c`, `neocrypt.c`, `neoprot.c`, `ng_memcard.c` | M68000, Z80 | YM2610, UPD1990A, `BUSES["NEOGEO"]` | Requires `neogeo.zip` BIOS; `-bios` selects MVS/AES and region; 4 buttons; 320×224 at 59.185 Hz; later titles decrypt large graphics ROMs at startup; sets up to ~90 MB |
| `cps1` | yes | `drivers/cps1.c`, `video/cps1.c`, `machine/kabuki.c` | M68000, Z80, PIC16C5X | YM2151, MSM5205, OKIM6295, QSound, EEPROM, Timekeeper | 384×224 at 59.637 Hz with 4:3 non-square pixels; QSound titles use Kabuki Z80 decryption |
| `cps2` | yes | `drivers/cps2.c`, `machine/cps2crpt.c`, plus the CPS-1 unit it links against: `drivers/cps1.c`, `video/cps1.c`, `machine/kabuki.c` | M68000, Z80, PIC16C5X | QSound, OKIM6295, 93C46 EEPROM, YM2151, MSM5205, Timekeeper | Program ROMs are decrypted in full at startup by `cps2crpt` using the key region in the 0.161-generation set; startup cost in Wasm is F4; EEPROM persists settings and some high scores. The CPS-2 QSound address map and shared-RAM handlers live in `drivers/cps1.c`, so a standalone CPS-2 subtarget must compile that unit (W14a) |
| `namco-classic` | yes | `drivers/pacman.c`, `galaga.c`, `galaxian.c`, `rallyx.c`, `mappy.c`, `toypop.c`, `gaplus.c`, `skykid.c`, `baraduke.c`, `pacland.c`, `polepos.c` | Z80, S2650, M6809, HD63701, Z8002, MB88xx (Namco 5xxx MCUs) | Namco WSG, Namco 15XX, CUS30, 06XX/50XX–54XX, AY8910, SN76496, DAC, Discrete, Samples, TMS5220 | Mostly **vertical** 224×288 at 60.606 Hz; 0–2 buttons; cocktail DIP forced upright; some titles take an optional sample-set zip; `polepos.c` needs analog steering (M11) and is the family's heaviest member |
| `namco-s1` | no (built and gated; deferred from v1.0.0 on 2026-10-21 for lack of a lawful local set to measure) | `drivers/namcos1.c`, `drivers/namcos86.c` with their `machine/` and `video/` units | M6809 ×3, HD63701 | YM2151, CUS30, Namco 63701X, DAC, C116/C117 | Key-chip protection per title is in the driver; 288×224 horizontal; 1–3 buttons |
| `namco-s2` | no (built and gated; deferred from v1.0.0 on 2026-10-21 for lack of a lawful local set to measure) | `drivers/namcos2.c`, `machine/namcos2.c`, `machine/namcoic.c`, `video/namcos2.c`, `video/c45.c` | M68000 ×2, M6809, HD63705, M37450 | YM2151, C140, C45 road | Heaviest required family; sustained-speed evidence on desktop and the throttled mobile proxy is F6; Final Lap-class titles need analog (M11) |
| `taito-classic` | no (built and gated; deferred from v1.0.0 on 2026-10-21 for lack of a lawful local set to measure) | `drivers/taitosj.c`, `bublbobl.c`, `arkanoid.c`, `tnzs.c`, `slapfght.c`, `flstory.c`, `lkage.c`, `retofinv.c`, `nycaptor.c`, `buggychl.c`, `gladiatr.c`, `mexico86.c`, `superqix.c`, plus `machine/tait8741.c` and `video/seta001.c` | Z80, M6801, M68705, M6809, I8742, I8751 (MCS51) | YM2203, YM3526, YM2151, AY8910, MSM5205, MSM5232, SN76496, DAC, Samples, SETA001 sprites, buffered sprite RAM | 256×224 at ~60 Hz; MCU-protected titles depend on dumped MCU ROMs in the set; `arkanoid.c` needs a spinner (M11); mostly no NVRAM (W14e: 151 machines) |
| `taito-16` | yes | `drivers/rastan.c`, `opwolf.c`, `rainbow.c`, `volfied.c`, `asuka.c`, `taito_l.c`, `taito_x.c`, `taito_b.c`, `taito_f2.c`, `taito_h.c`, and from W19f `taito_z.c` | M68000, Z80, Z180, HD63484 | YM2151, YM2203, YM2610/B, MSM5205, OKIM6295, PC080SN, PC090OJ, TC0100SCN, TC0140SYT, TC0220IOC, TC0180VCU, TC0480SCP, … | Taito's 68000 generation; EEPROM on B-system; `opwolf.c` needs a light gun (out of scope until an analog pointer exists) |
| `taito-multi` | no | `darius.c`, `ninjaw.c`, `warriorb.c`, `topspeed.c` | as `taito-16` plus duplicates | | Multi-screen and cockpit boards; deferred until `ArcadeDisplay` can present a 3-screen render target. `taito_z.c` (single-screen Z System) moved to `taito-16` by W19f |
| `taito-f3` | yes (W19g) | `drivers/taito_f3.c`, `video/taito_f3.c`, `audio/taito_en.c` | M68EC020, ES5510 | ES5505 Ensoniq sound board, EEPROM | 320×232 at 58.97 Hz; the heaviest per-frame cost in the matrix |
| `irem-m72` | yes (W19f) | `drivers/m72.c`, `audio/m72.c`, `video/m72.c`, `machine/irem_cpu.c`, and from W19f `drivers/m92.c`, `video/m92.c` | V30, V33, V35, Z80, I8751 | YM2151, DAC, Irem GA20 | Inherited from the parent project's P3/P6 probes as `mame/targets/irem-m72.lua`; M92 added as the same family build |
| `sega-16` | yes (W19a) | `drivers/segahang.c`, `segaorun.c`, `segaxbd.c` with their `video/` units, `machine/segaic16.c`, `video/segaic16.c`, `video/segaic16_road.c`, `video/sega16sp.c`, `machine/fd1089.c`, `machine/fd1094.c` | M68000 ×2, Z80, I8751, MCS51 | YM2151, YM2203, SegaPCM, 315-5195 memory mapper | `segahang.c`, `segaorun.c` and X Board; FD1089/FD1094 decryption at startup; analog steering and throttle fall back to digital increments (M11) |
| `midway-mcr` | yes (W19b) | `drivers/mcr.c`, `mcr3.c`, `mcr68.c`, `machine/mcr.c`, `machine/mcr68.c`, `video/mcr.c`, `video/mcr3.c`, `video/mcr68.c`, `audio/midway.c` | Z80, M6809, M68000 | SSIO, Turbo Cheap Squeak, Sounds Good, AY8910, DAC | MCR-1/2/3 and MCR-68k; 49-way and spinner titles take the digital fallback |
| `konami-16` | yes (W19c) | `drivers/tmnt.c`, `simpsons.c`, `xmen.c`, `gijoe.c`, `mystwarr.c`, `spy.c` with their `video/` units and the Konami video IC units | M68000, Z80, KONAMI, HD6309 | K007232, K053260, K054539, uPD7759, YM2151, EEPROM | Konami's 68000 generation; four-player cabinets exist (players 3–4 out of scope); `mystwarr` class boards are the heaviest |
| `atari-classic` | yes (W19d) | `drivers/bzone.c`, `tempest.c`, `rampart.c`, `video/avgdvg.c`, `machine/mathbox.c`, `audio/redbaron.c`, `machine/atarigen.c`, `video/atarimo.c`, `machine/slapstic.c` | M6502, M68000 | POKEY, Discrete, OKIM6295, YM2413 | Vector titles draw line primitives through the bridge's software renderer; spinner and trackball titles take the digital fallback (M11) |
| `misc-16` | yes (W19e) | `drivers/dec0.c`, `karnov.c`, `raiden.c`, `raiden2.c`, `r2dx_v33.c`, `snowbros.c`, `shadfrce.c`, `btoads.c` with their `machine/` and `video/` units, `audio/seibu.c`, `video/kan_pand.c` | M68000, H6280, HD6309, M6502, Z80, V30, V33, I8751, TMS34020 | YM2203, YM3812, YM3526, YM2151, OKIM6295, Seibu sound, BSMT2000 | Data East, Seibu, Toaplan, Technos and Rare boards grouped only to keep the download count down |
| `galaxian-misc` | no | the non-Namco portion of `galaxian.c` | Z80 | | Licensee hardware; folded into `namco-classic` only if F2 shows no size penalty |

A family's `.lst` exposes every parent and clone the listed driver sources
define in `src/mame/mame.lst`; a family build is not trimmed to a private
title list. Families are kept separate rather than merged because a page
downloads only the family its machine needs (F2 records raw/gzip/Brotli per
family; the inherited P3 baseline is 5.2–6.5 MB raw and 1.1–1.3 MB Brotli
for single-driver subsets).

Hardware characteristics the runtime must handle as a result of this matrix:

- **Vertical-first layouts.** Most `namco-classic` titles are vertical;
  `ArcadeDisplay` must lay them out portrait by default and `fill-height`
  on landscape screens (§7).
- **Non-60 Hz timing.** 59.185, 59.637, 60.606 and 57.5 Hz boards all
  exist in the matrix. The screen-period accumulator (§5) drives each at its
  own rate on 60/90/120/144 Hz displays; F5 verifies the three outliers.
- **Zero-button machines.** `ArcadeButtonCount` includes `0`; touch layouts
  and keyboard maps with no action buttons are valid.
- **BIOS selection.** Neo Geo requires `neogeo.zip` and offers region and
  MVS/AES options; `MachineInfo.bios` reports them and `ArcadeStartConfig.bios`
  selects one. AES mode changes coin to free play and enables `select`.
- **Startup decryption.** CPS-2 and later Neo Geo titles decrypt whole ROM
  regions at startup; F4 measures the time-to-first-frame in Wasm and the
  page is given a `starting` status for the duration rather than a frozen
  canvas.
- **Memory budget.** The fixed 256 MiB module must hold the zip bytes
  written into MEMFS, MAME's loaded regions and any decrypted copies. F3
  measures the largest set per family; a family whose largest set does not
  fit raises `memoryPages` in its build file, and the adapter reports
  `MEMORY_EXCEEDED` instead of letting the module abort.
- **Sample sets.** Several Namco and Taito classics play PCM sample zips
  (`samples` role). They are optional inputs: the audit reports them as
  "optional, missing" and the game runs without them.
- **No persistence.** Many 8-bit boards have no NVRAM; `hasNvram` is false
  and `persist()` returns `null` forever unless cfg or states changed. High
  scores on those boards are lost at exit in v1.0.0 by design; M12 adds a
  RAM-range bridge for them.

---

## 5. `MameEmulatorAdapter`

```ts
interface MameEmulatorAdapterConfig {
    readonly buildUrl: string;          // e.g. "/mame/cps2/"; serves mamecps2.js, .wasm, build.json, romsets/
    readonly build: BuildInfo;          // already fetched and validated
    readonly loadModule: ModuleLoader;  // injected; init defaults to classic-script injection of the build's JS
}

class MameEmulatorAdapter implements ArcadeAdapter {
    readonly type: "mame";
    constructor(config: MameEmulatorAdapterConfig);
    get build(): BuildInfo;
    get family(): string;
    start(config: ArcadeStartConfig): Promise<ArcadeSession>;
    static init(config: { buildUrl: string; fetch?: FetchLike; loadModule?: ModuleLoader }): Promise<MameEmulatorAdapter>;
}
```

The constructor is deterministic and reads no globals. `init` fetches and
validates `build.json`, supplies global `fetch` and a classic-script loader when
omitted, resolves artifact URLs relative to `buildUrl`, and constructs.
Metadata selection, requested adapter and artifact filenames must agree
before module JavaScript is imported.

`start`:

1. Validates config; checks `machine` against `build.machines`
   (`MACHINE_NOT_IN_BUILD`); rejects `bios` with `UNSUPPORTED` when the
   machine's audit metadata lists no BIOS options.
2. Checks the total ROM bytes against the budget implied by `memoryPages`
   and the machine's region sizes from `romsets/<machine>.json`; rejects
   with `MEMORY_EXCEEDED` before instantiating anything.
3. Instantiates a fresh module with `noInitialRun: true`.
4. Creates `/mame/{roms,samples,nvram,cfg,sta,ctrlr}` in MEMFS, writes each
   ROM zip (copied with `slice()`) under `roms` or `samples` by its audited
   role, writes `web.cfg`, writes the generated DIP cfg when `dipswitches`
   is present, validates `changes` and maps its logical roots to the
   writable directories.
5. Snapshots a hash of every persisted file under `nvram`, `cfg`, `sta` and
   the memory-card location *after* the incoming overlay is restored and
   after the first valid frame, following one `web_flush_nvram()`, so
   files MAME itself materializes at boot do not read as user changes.
   Adapter-generated files (`web.cfg`, the DIP cfg) are excluded from
   dirty detection.
6. Calls `callMain([machine, ...argv])`.
7. Resolves once the first `onFrame` arrives and `web_machine_info`
   succeeds. If the frontend returns `MAMERR_MISSING_FILES` before the first
   frame, rejects with `ROM_SET_INVALID` and attaches the ordered
   error-channel records plus, when `romsets/` metadata was available, the
   structured `RomSetAudit` report; any other pre-frame result is
   `ADAPTER_FAILED`.

Session behavior:

- **`setControl`** maps `ArcadeControl` to `(pad, control index)` and calls
  `web_set_control`. Controls the machine has no port for are accepted and
  ignored, so one page layout can serve both a 6-button and a 1-button
  title. Idempotency is `ArcadeInput`'s job.
- **`onFrame` / `onSound`** copy from the heap into reused typed arrays;
  nothing keeps a heap view across callbacks because memory growth would
  invalidate it.
- **Frame pacing.** The bridge replaces the stock fixed 1/60-second outer
  loop (P5) and runs with the native throttle disabled. Each browser
  scheduler tick adds elapsed monotonic time to an accumulator and advances
  MAME's device scheduler by one primary-screen period for every complete
  period accumulated, capped at four periods per tick; excess time is
  discarded. The period is the machine's own (`1 / refreshHz`), so a
  60.606 Hz Namco classic and a 59.185 Hz Neo Geo both run true on any display.
- **Pause and terminal control.** A paused tick pumps the video/OSD boundary
  without advancing the scheduler. Exit and hard reset stop browser
  callbacks explicitly; hard reset creates a fresh module; exit flushes
  persistence and reports completion before the old module is discarded.
- **`saveState` / `loadState`** resolve or reject with `STATE_FAILED` on
  `onStateDone`. One scheduled operation is serviced per between-timeslice
  boundary.
- **`persist`** calls `web_flush_nvram()` and rehashes the persisted tree.
  It returns `null` when nothing changed since start or the previous
  successful `persist`; otherwise it writes a complete cumulative overlay
  and advances the snapshot. Every non-null result stands alone because
  `ArcadeStorage` replaces its prior value.
- **`exit`** calls `web_exit()`, waits for `onExit`, then drops the module.
  Every method throws `DESTROYED` afterwards.

---

## 5b. `LibretroAdapter` (optional, M15)

The optional libretro backend, its shim, core files, input maps and probe
questions are specified in §5b and §13.2–13.3 of the parent
`docs/parent/mame-game-runtime-spec.md` and are adopted here by reference with two
changes: the DAT-driven `pack-roms` step is replaced by `RomSetAudit` over
a DAT-derived `romsets/` directory (§10.5), and no manifest `inputMap`
exists; a page passes the core input-map override programmatically through
`LibretroAdapterConfig`. It begins only after M1–M9 are complete and exists
for measured performance or coverage advantages, never as a shortcut.

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

- Every source and mapper binding creates its own channel. A control
  reaches the session as pressed on the first channel's press and as
  released only after the last channel releases it, so a keyboard key-up
  cannot cancel the same control still held by a gamepad or touch button.
- Holds are idempotent within a channel. Destroying a channel releases all
  of its holds.
- **`tap`** exists for coin, start and select: boards sample inputs once per
  frame, and a press/release inside one frame can be missed. It holds for
  `holdFrames` emulated frames counted from `onTick`, then releases.
  Older boards may need more than three frames to register a coin; F10
  records the per-family minimum and `ArcadeCabinet` applies it.
- **Opposing directions.** Pressing `left` while `right` is held for the
  same player releases `right` from every channel first (SOCD
  last-input-wins); the later physical release from the old owner is a
  no-op.
- `releaseAll` on blur, visibility loss, pause and destroy, as in the DOS
  runtime.
- **Axes (M11).** `ArcadeInput` and every channel expose
  `setAxis(axis, value)`. Axis writes are last-writer-wins rather than
  reference-counted; releasing or destroying the owning channel writes 0
  for stick axes, −1 for pedal axes and nothing for spin axes.
  `ArcadeInput.axes` returns the effective last values and
  `ArcadeInput.machine` exposes the session's `MachineInfo` so sources can
  see which analogue kinds the board declares.

Tests (`spec/13-arcade-input.test.ts`) against `FakeArcadeSession`:
per-channel idempotency and reference counting, channel destruction, `tap`
timing driven by fake frames, cross-channel SOCD, `releaseAll` order,
`DESTROYED`.

---

## 7. `ArcadeDisplay`

Port of `DosDisplay` with arcade layout:

- `attach(session)` draws frames with `putImageData` into a canvas whose
  backing size is the native frame size.
- `aspectRatio` defaults to `session.machine.aspectRatio`, so vertical
  games lay out portrait and CPS's 384-wide frames display at 4:3 with no
  page config.
- Scaling modes `fit`, `integer` and `fill-height`. `fill-height` is the
  default when the machine is vertical and the container is landscape.
- `imageRendering`: `"pixelated"` (default) or `"smooth"`.
- Fullscreen, resize observation and `onLayout` as in the DOS runtime.
- A `starting` placeholder: while `ArcadePlayer.status` is `starting` the
  display shows a page-supplied element or a blank canvas, so CPS-2 and Neo
  Geo startup decryption does not look like a hang.

The pure `layoutFor` static is tested in `spec` (including a 224×288
vertical frame in a 844×390 landscape container and a 384×224 4:3 frame);
drawing, resize and fullscreen errors in `browser`.

---

## 8. `ArcadeAudio`

Port of `DosAudio`: owns the `AudioContext`, the gesture unlock, scheduled
buffer playback, the latency cap and mute. Differences:

- Stereo buffers, de-interleaved on copy; mono boards still arrive as
  duplicated stereo from MAME's mixer.
- Context construction requests `session.sampleRate` (48000), but browsers
  may choose another device rate. Each `AudioBuffer` is tagged with the
  session rate and Web Audio converts; queue accounting uses buffer
  duration, never callback arrival time (P10: the 50 Hz mixer cadence
  crosses the screen cadence).
- `MAX_QUEUE_MS` 120, `MIN_CHUNK_MS` 16, `TRIM_QUEUE_MS` 60. An overflow drops
  the oldest frames down to the trim depth, not merely to the cap, and the
  rebuilt audio restarts at the audio clock with no lead. `DosAudio` trimmed
  only to the cap and restarted with the lead: with a lead equal to the frame
  period nothing played before the next chunk trimmed again, so one stall (a
  freshly created context whose clock has not started yet) pinned the queue at
  the cap for the rest of the session.

---

## 9. `ArcadePlayer`

Composition root for one running machine, as `DosPlayer`.

```ts
type ArcadeAdapterSelection =
    | { readonly type?: "mame"; readonly buildUrl: string }
    | { readonly type: "libretro"; readonly core: LibretroCore; readonly buildUrl: string };   // M15

type RomSource =
    | string                                   // URL on the page's own origin or chosen by its user
    | RomFile                                  // bytes already in memory
    | { readonly name: string; readonly blob: Blob };   // a File from a picker or drop

interface ArcadeGameConfig {
    readonly machine: string;
    readonly machineHints: { readonly players: PlayerCount; readonly buttons: ArcadeButtonCount };
    readonly roms: ReadonlyArray<RomSource>;
    readonly changes?: Uint8Array;
    readonly bios?: string;
    readonly dipswitches?: Readonly<Record<string, string>>;
    readonly options?: Readonly<Record<string, string | number | boolean>>;
    readonly display?: { readonly scaling?: ScalingMode; readonly imageRendering?: "pixelated" | "smooth" };
}

class ArcadePlayer {
    get status(): "idle" | "starting" | "running" | "paused" | "destroyed";
    get machine(): MachineInfo;          // NOT_STARTED before start
    get input(): ArcadeInput;
    get display(): ArcadeDisplay;
    get audio(): ArcadeAudio;
    audit(): Promise<RomSetReport>;      // §10.5, without starting
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

ROM sources are resolved in parallel: URLs are fetched, blobs are read with
`arrayBuffer()`, bytes are copied. The resolved bytes are kept so a restart
after exit does not refetch or re-read. A non-OK response, network error or
unreadable blob becomes `ROM_LOAD_FAILED` identifying the URL or name without
embedding ROM bytes in error data. URL basenames and blob names become
`RomFile.name`; duplicate basenames reject. Exactly one of `adapter` and
`adapterConfig` is required; there is no implicit build URL.

`audit()` runs `RomSetAudit` over the resolved sources and the build's
`romsets/` metadata and resolves with the report without starting the
emulator; `start()` runs the same audit first and rejects with
`ROM_SET_INVALID` carrying the report when a required file is missing or
wrong, so the user sees a precise message before any WASM work begins.
`ArcadeGameConfig` accepts `auditStrictness?: "strict" | "mame"`, defaulting
to `"strict"`; `audit()` and the pre-start audit use that mode, and `start()`
accepts an `ok` report even when its `warnings` array is non-empty (§10.5).

Lifecycle, failure handling and event semantics follow `DosPlayer`: a
failed `start()` tears down any partial session, display/audio
subscriptions and input, emits one typed `error`, returns to `idle`, and
may be retried. `pause`, reset, state load, natural exit and destroy release
all held controls first. Pause/resume are idempotent in their matching
states; `destroy()` is terminal and idempotent. A natural emulator exit
emits `exit` once and returns the player to `idle` without destroying the
reusable display or cached ROM bytes. Listener exceptions do not prevent
later listeners from running and surface as `INTERNAL_ERROR` without
recursive error emission.

---

## 10. Sources, mapping, storage and ROM supply

### 10.1 Touch primitives (post-1.0, M10)

`Button`, `DPad`, `AnalogStick` and `Trackpad` are ported from the DOS
runtime without behavioral changes and run the same contract tests. They
emit mechanical events and have no dependency on `ArcadeInput`. They are
not part of the v1.0.0 export; the folders are created by M10.

### 10.2 `ArcadeMapper` (post-1.0, M10)

Equivalent of `InputMapper`, with `ArcadeControl` as the target. In v1.0.0
keyboard and gamepad sources feed `ArcadeInput` directly and no mapper
exists; the mapper arrives with the touch primitives it binds.

- `bindButton(button, control)`; a button bound to `coin`, `start` or
  `select` uses `input.tap` on press.
- `bindDPad(dpad, { player })`: four directions, diagonals included.
- `bindAnalogStick(stick, { player, threshold })`: quantized to directions
  with hysteresis (arcade sticks are digital). M11 adds `bindAxis` for
  analog machines.
- `bindTrackpad` arrives with M11 for spinner and trackball titles.

Each binding owns an `ArcadeInputChannel`; unbinding destroys that channel.

### 10.3 `KeyboardSource`

Physical keyboard → `ArcadeInput` through a page-supplied map
(`Record<KeyCode, ArcadeControl>`). The runtime ships one **default map
constant**, `DEFAULT_KEYBOARD_MAP`, with MAME's familiar layout (arrows,
`ControlLeft`/`AltLeft`/`Space`/`ShiftLeft`/`KeyZ`/`KeyX`, `Digit5` coin,
`Digit1` start, `F2` test, `Digit9` service) that `ArcadeCabinet` applies
when a page gives none. Repeat ignored, blur and visibility release,
`enabled` gate, as in the DOS runtime. Since M11 the default map also binds
player-one `KeyC` to pedal 1 and `KeyV` to pedal 2; analogue arrow-key
ramps and the second stick come from the generated controller
configuration (§4.4), not from `KeyboardSource`.

### 10.4 `GamepadSource`

Polled Gamepad API → `ArcadeInput`. Standard-mapping pads get a default
per-player layout: d-pad and left stick to directions, face and shoulder
buttons to buttons 1–6, Select to coin, Start to start. Pad *n* drives
player *n*. Injectable gamepad provider and scheduler; lowest-free-slot
assignment held until disconnect; disconnect releases every held control;
d-pad precedence over axes; dead zone; deduplicated transitions; release on
blur, visibility loss, disable, pause and destroy. Non-standard mappings are
ignored unless a page supplies an explicit mapping.

Since M11, on a standard-layout pad only the analogue kinds the machine
declares for the assigned player are written: the dead-zone-rescaled left
stick supplies `stick-x`/`stick-y` (also for paddles) or `spin-x`/`spin-y`
deltas for dials and trackballs (20 pixels per poll at full deflection,
the order of the key delta the pinned dial and trackball drivers declare),
the right stick's vertical axis supplies `stick-z`, and trigger buttons 7
and 6 map their [0, 1] values to pedal values in [−1, 1]. When `dualStick`
is true the left and right physical sticks are quantized independently
into logical sticks 1 and 2 while the d-pad keeps emitting ordinary
directions. `GamepadMapping.rightAxes` and `GamepadMapping.pedals`
override the standard indices. A board that declares nothing behaves
exactly as before.

### 10.5 `RomSetAudit` and `romsets/` metadata

This replaces the parent spec's `pack-roms`. It is pure logic over metadata
the pinned MAME source already contains, and it never copies, hosts or
transforms ROM content.

**Metadata.** `scripts/extract-romsets.ts` runs each family build under
Node with `-listxml` and writes one JSON file per machine into
`dist/mame/<family>/romsets/<machine>.json`:

```json
{
    "machine": "sf2ce",
    "family": "cps1",
    "description": "Example Fighter (World 920313)",
    "cloneof": "sf2",
    "romof": "sf2",
    "bios": [],
    "sampleof": null,
    "archives": [
        { "name": "sf2ce.zip", "role": "game" },
        { "name": "sf2.zip",   "role": "parent" }
    ],
    "roms": [
        { "name": "s92e_23b.8f", "size": 524288, "crc": "0aaa1a3a", "sha1": "…", "archive": "sf2ce.zip", "optional": false }
    ],
    "samples": []
}
```

Archive membership for each ROM is derived from `cloneof`/`romof`/`bios`
merge rules the same way MAME's auditor resolves them, so the page learns
*which zip* must contain each file. A family's `romsets/` directory is a
build artifact served beside the WASM and fetched lazily per machine.

**Audit.** `RomSetAudit` takes the resolved `RomFile`s and a machine's
metadata, reads each zip's central directory with `fflate` (CRC32 and size
come from the directory, so nothing is inflated), and produces:

```ts
interface RomSetReport {
    readonly machine: string;
    readonly status: "ok" | "incomplete" | "bad";
    readonly archives: ReadonlyArray<{ readonly name: string; readonly role: RomRole; readonly present: boolean; readonly required: boolean }>;
    readonly files: ReadonlyArray<{
        readonly name: string; readonly archive: string;
        readonly status: "ok" | "missing" | "wrong-size" | "wrong-crc" | "optional-missing";
    }>;
    readonly unexpected: ReadonlyArray<{ readonly archive: string; readonly name: string }>;   // informational
    readonly problems: ReadonlyArray<{ readonly archive: string; readonly reason: string }>;    // archives that could not be inspected
}
```

A sample set whose zip name equals the game, parent or BIOS archive (MAME
keeps samples on a separate path, so this is common) is omitted from the
metadata, because the flat archive model is keyed by basename and samples
are optional. Devices with their own ROMs (the Namco 50xx–54xx MCU programs, the QSound
DSP program) are listed by `-listxml` as `isdevice="yes"` elements and
referenced from machines by `<device_ref>`; the extractor adds each such
device as an archive of role `device` named `<device>.zip` and tags its
ROMs with `device`. MAME loads a device ROM from that archive or from the
game, parent or BIOS archives, and the audit accepts any of them. Each ROM may carry `bios`, the BIOS option it belongs to, and the metadata
may carry `defaultBios`. A BIOS-tagged ROM is required only when its option
is the one selected (`ArcadeStartConfig.bios`, else `defaultBios`), which is
how MAME's own audit treats BIOS options; the other options' ROMs report
`optional-missing`. A supplied archive that is not a zip, has a corrupt central directory or
exceeds 4,096 entries is reported under `problems` with every ROM it was
expected to hold marked `missing`; bad user input never throws.

**Strictness (M23).** Each `roms[]` row may additionally carry `region`, the
string emitted by `-listxml`; metadata generated before this field existed
remains valid. `RomSetAudit.audit(metadata, roms, { bios?, strictness? })`
accepts `strictness: "strict" | "mame"` and defaults to `"strict"`. Every
report carries the selected `strictness` and a `warnings` array of
`{ name, archive, status }` rows. In `"mame"` mode, a required file whose
region tag ends in `plds` and whose true status is `missing`, `wrong-size` or
`wrong-crc` is reported as a warning and does not lower the overall status;
all other required-file defects remain failures. Strict mode produces no
warnings and retains the previous verdict rules. This is the runtime's
compatibility policy, narrower than the pinned loader's own rule (which
warns on any wrong length or checksum but treats every missing required dump
as fatal): programmable-logic dumps are documentation the emulation never
reads, so a set differing from 0.161 only there is accepted.
`INVALID_CONFIG` is reserved for metadata or `RomFile` values that fail
their predicates. In the metadata, `bios` is an array of BIOS option
names, and `cloneof`, `romof` and `sampleof` are names or `null`.

An expected file is located by name, or, when the name is absent, by an
entry with the same CRC32 and size, because MAME's loader falls back to a
CRC match inside the archive and sets from another naming generation load
unchanged. `status` is `ok` only when every required file is present with the right
size and CRC in a present archive; `incomplete` when only missing archives
or files remain; `bad` when a present file has the wrong CRC or size. The
report names files and archives but never carries bytes. MAME's own startup
audit remains authoritative; this pre-check exists so users get an
actionable message in milliseconds, and its results are compared with
MAME's verdict in the browser suite.

The Node bin `arcade-audit-roms [--json] <romsets-dir> <machine> <zip>…` runs
the same code over local files and prints the report. It is a developer
convenience for the private compatibility matrix (M13) and is the only
ROM-touching script in the repository.

### 10.6 `ArcadeCabinet`

The composition root a page uses when it wants the whole thing at once. It
is the counterpart of `DosDeployment` but is constructed in code: there is
no manifest and nothing is built from it.

```ts
interface ArcadeControlsConfig {
    readonly keyboard?: { readonly enabled?: boolean; readonly map?: Readonly<Record<string, ArcadeControl>>; readonly preventDefault?: boolean };
    readonly gamepads?: { readonly enabled?: boolean; readonly deadZone?: number };
    // The three touch fields below are accepted from M10; v1.0.0 rejects them with UNSUPPORTED.
    readonly buttons?: ReadonlyArray<{ readonly surface: InputSurface; readonly control: ArcadeControl }>;
    readonly dpads?: ReadonlyArray<{ readonly surface: InputSurface; readonly player: PlayerIndex; readonly deadZone?: number; readonly diagonals?: boolean }>;
    readonly sticks?: ReadonlyArray<{ readonly surface: InputSurface; readonly player: PlayerIndex; readonly deadZone?: number; readonly radius?: number; readonly threshold?: number }>;
}

interface ArcadeCabinetConfig {
    readonly canvas: HTMLCanvasElement;
    readonly container: HTMLElement;
    readonly game: ArcadeGameConfig;
    readonly controls?: ArcadeControlsConfig;
    readonly keyboardTarget?: EventTarget;
    readonly adapter?: ArcadeAdapter;
    readonly adapterConfig?: ArcadeAdapterSelection;
    readonly fetch?: FetchLike;
    readonly storage?: ArcadeStorage;      // overlay persistence, keyed by the page
    readonly romStore?: ArcadeRomStore;    // fills missing game.roms from the user's local store; saves picked files back
    readonly autosave?: boolean;           // persist on visibilitychange; default false
}

class ArcadeCabinet {
    get player(): ArcadePlayer;
    get storage(): ArcadeStorage | null;
    get romStore(): ArcadeRomStore | null;
    get mapper(): ArcadeMapper | null;
    get keyboard(): KeyboardSource | null;
    get gamepads(): GamepadSource | null;
    get keyboardEnabled(): boolean;  set keyboardEnabled(value: boolean);
    get gamepadsEnabled(): boolean;  set gamepadsEnabled(value: boolean);
    get isStarted(): boolean;
    audit(): Promise<RomSetReport>;              // forwards game.auditStrictness; picked blobs are stored only after an ok report, warnings included (§10.5)
    start(): Promise<void>;
    save(): Promise<boolean>;
    quickSave(slot?: string): Promise<void>;     // saveState then save()
    fullscreen(): Promise<void>;
    exitFullscreen(): Promise<void>;
    clearSaves(): Promise<void>;
    destroy(): Promise<void>;
    static init(config: ArcadeCabinetConfig): Promise<ArcadeCabinet>;
}
```

Exactly one of `adapter` and `adapterConfig` is required. `init` resolves
`adapterConfig`, defaults the type to direct MAME, supplies browser
dependencies, applies `DEFAULT_KEYBOARD_MAP` when `controls.keyboard.map` is
absent, restores `storage` only when `game.changes` was not given, and when
`romStore` is present resolves any `game.roms` entry given as a bare
basename string without a URL scheme from the store (`ROM_LOAD_FAILED` with
the basename if absent) and stores any blob source after a successful
audit.

`start()` audits, then starts the player, then attaches sources and
primitives; any failure tears down what that call created and rejects.
Player exit tears controls down too. `save()` stores a non-null overlay and
returns `false` when nothing changed; it rejects with `UNSUPPORTED` without
storage. `destroy()` is idempotent, destroys sources/primitives/mapper
before the player, and releases every held control. Setters validate
booleans, persist across session restarts and update a live source.

An `OVERLAY_INCOMPATIBLE` failure from `start()` is not auto-resolved: the
cabinet exposes it as the typed error and `clearSaves()` so the page can
offer the choice. The runtime never deletes a user's saves on its own.

### 10.7 `ArcadeStorage` and `ArcadeRomStore`

`ArcadeStorage` is `DosStorage`: database `arcade-runtime`, object store
`overlays`, schema version 1, keyed by a page-supplied string. `save(bytes)`
replaces, `load()` returns a defensive copy or `null`, `clear()` is
idempotent, all failures are `STORAGE_FAILED`.

`ArcadeRomStore` keeps the user's own ROM files in their own browser so a
page can offer "pick your ROM zips once":

```ts
interface ArcadeRomStoreConfig {
    readonly indexedDB: IDBFactoryLike;     // injected; init supplies globalThis.indexedDB
    readonly subtle: SubtleCryptoLike;      // injected; init supplies crypto.subtle
    readonly now: () => number;             // injected; init supplies Date.now
    readonly name?: string;                 // database name override
}

class ArcadeRomStore {
    constructor(config: ArcadeRomStoreConfig);
    list(): Promise<ReadonlyArray<{ readonly name: string; readonly size: number; readonly sha256: string; readonly addedAt: number }>>;
    put(file: RomFile): Promise<void>;
    get(name: string): Promise<RomFile | null>;
    remove(name: string): Promise<void>;
    clear(): Promise<void>;
    static init(config?: Partial<ArcadeRomStoreConfig>): Promise<ArcadeRomStore>;   // UNSUPPORTED when IndexedDB or Web Crypto is absent
}
```

Database `arcade-runtime-roms`, store `archives`, keyed by case-folded
basename. It is strictly local: no sync, no export URL, no listing exposed
outside the page's origin. The library's documentation states that the
store holds whatever the user put in it and that the page author is
responsible for how it is used.

---

## 11. Developer harness

`harness/index.html` is the page the project uses to develop and
demonstrate the library. It is a consumer, not a product feature:

- An index built from `/builds.json` and each family's `build.json` under
  a locally served `dist/mame/`, optionally limited to the families a
  `?family=` query names (W18).
- A file picker/drop zone for zips. Each zip is identified by its
  basename against that index, its `romsets/<machine>.json` supplies the
  title and companion archives, picked files go into `ArcadeRomStore`,
  and the audit verdict is rendered on the game's card before its Start
  (W18; the W13a/W13b family and machine inputs are retired).
  One persisted library-wide setting, "File check: exact 0.161 set / what MAME accepts", controls every card audit and every cabinet start (§10.5 strictness). An `ok` report with warnings reads "Ready to play (N files differ from 0.161; MAME ignores them)", enables Start, and lists each warned file and its true status in the detailed file check; strict-mode wording is unchanged.
- `ArcadeCabinet` with default keyboard map, gamepads, a corner menu
  (fullscreen, sound, reset, save/load state, clear saves), BIOS/DIP
  selectors once M8 exists, and a touch layout chosen by `MachineInfo`
  once M10 exists.

The harness is served by `scripts/serve-harness.ts`, is excluded from the
package, and contains no ROM references. Browser acceptance tests that need
a real machine run the harness page with the private preload config
described below.

### 11.1 Preload config

A developer or the browser suite often wants to test exactly one machine
with one BIOS and one parent without clicking through a file picker. The
preload config does that from locally configured files:

```json
{
    "family": "neogeo",
    "machine": "<machine>",
    "bios": "<bios-option or omitted>",
    "roms": ["../res/neogeo/neogeo.zip", "../res/neogeo/<machine>.zip"],
    "samples": [],
    "dipswitches": {},
    "autostart": true
}
```

- The file lives under ignored `res/` (the inherited probe-config
  convention) and paths resolve relative to it. It is never committed; a
  checked-in `harness/preload.example.json` documents the shape with
  placeholder names only.
- `serve-harness.ts --preload res/<config>.json` validates the config with a
  structural predicate, then serves the listed files at `/preload/<basename>`
  and the sanitized config (basenames only, no source paths) at
  `/preload.json`. Nothing outside the listed files is reachable, and the
  server binds to loopback by default.
- The harness page fetches `/preload.json` when present, builds
  `ArcadeGameConfig` from it with URL sources, populates and selects the
  machine's library card (W18), renders the audit verdict on it, and starts automatically when
  `autostart` is true. Without a preload config it lists the available
  family builds; without a preload the page shows the drop-first library (W18).
- The browser suite reads the same config through one environment variable
  (`ARCADE_PRELOAD_CONFIG`) and skips real-machine cases when it is absent,
  as the inherited probe tests already do.

The preload path uses only public library API (`ArcadePlayer` URL sources
and `ArcadeCabinet`), so it tests the same code a consumer page runs. It
does not use Emscripten `--preload-file` `.data` bundles; those remain a
probe-only technique because they bake ROM bytes into an artifact. Preload
is a test aid, not a deployment: `serve-harness` is a dev server, its output
is not a build, and nothing it serves is written to `dist/`.

---

## 12. Milestones

M0 is inherited complete (go for direct MAME 0.161). Work begins at M1.
Families required for v1.0.0 are the eight marked *required* in §4.6.
M1–M9 are v1.0.0; M10 onward are post-1.0 and ordered by expected value,
not by dependency.

Milestones are the **acceptance view**: a milestone closes when its row
passes. §16 is the **execution view**: the same work cut into packages
with exclusive file ownership so several agents can build them
concurrently on branches. A milestone's packages may land in any order;
the milestone closes only when all of them are merged and its acceptance
row passes on `main`.

| # | Milestone | Acceptance |
| - | --------- | ---------- |
| M1 | **MAME bridge + `MameEmulatorAdapter` + `ArcadeDisplay` + preload.** Implement the production patch set, web OSD modules, bridge exports, fresh-module lifecycle and the family build pipeline over the inherited `neogeo` and `cps1` targets, plus `serve-harness --preload` and a minimal harness page that starts the preloaded machine. | One Neo Geo and one CPS-1 title, loaded from a preload config, render upright at native size and correct speed on controlled 60 and 120 Hz display cadences |
| M2 | **Family build matrix.** Add `cps2`, `namco-classic`, `namco-s1`, `namco-s2`, `taito-classic` and `taito-16` targets; answer F1–F6 per family (§13.1). v1.0.0 requires `neogeo`, `cps1`, `cps2`, `namco-classic` and `taito-16`; `namco-s1`, `namco-s2` and `taito-classic` build and pass the release gate but their F4–F6 evidence is deferred until a lawful set exists (§4.6). | Every required family builds reproducibly, passes the threading gate, has size/memory/startup evidence, and boots one preloaded private title to a stable upright frame at correct speed on desktop |
| M3 | **`ArcadeAudio`.** | Audible after one gesture; `queuedMs` under the cap for 60 s on a CPS title and a Namco WSG title |
| M4 | **`ArcadeInput` + `KeyboardSource` + generated controller config.** Answer F10. | Coin, start and play from the keyboard on one title per family, including a zero-button and an alternating two-player board, without MAME default-key handling |
| M5 | **`GamepadSource`.** Standard-mapping pads, per-player slots, disconnect release. | Two standard pads drive players 1 and 2 on a CPS-2 six-button title and a Neo Geo four-button title; unplugging one releases its held controls |
| M6 | **Saves.** NVRAM flush, Neo Geo memory card, CPS-2 EEPROM, `persist`, `ArcadeStorage`, save states; answer F8. | A Neo Geo memory-card save, a CPS-2 EEPROM setting and a save state survive a reload; a no-NVRAM board reports `hasNvram: false` and persists only states |
| M7 | **ROM supply + `ArcadeCabinet`.** `extract-romsets.ts`, `RomSetAudit`, `ArcadeRomStore`, `arcade-audit-roms`, `ArcadeCabinet`; the harness becomes a cabinet with a file picker alongside preload. | A user picks zips in the harness and sees a correct missing-parent, missing-BIOS, wrong-CRC or optional-samples report before start; the report agrees with MAME's audit verdict in every browser case; the preloaded path and the picked path produce identical sessions |
| M8 | **BIOS and DIP switches.** `MachineInfo.bios`, `-bios` selection, generated DIP cfg, harness selectors; answer F7. | Neo Geo switches region and MVS/AES without a rebuild; a Namco classic's lives/difficulty DIP change is visible. DIP and BIOS choices are page state passed on every start (`ArcadeStartConfig`), not overlay state: the generated cfg is excluded from dirty detection so an explicit selection always wins |
| M9 | **v1.0.0 release gate.** Licence review of distributed emulator artifacts, `npm pack` contents, hosted-harness policy, the §14.1 flows. | A tagged `v1.0.0` whose tarball contains no ROM, cache, `res/`, harness or WASM, with a written decision on whether family builds are published separately |
| M10 | **Mobile: touch primitives + `ArcadeMapper` + portrait layouts.** | Playable with d-pad, buttons, coin and start while sustaining full speed for 60 s on a documented mid-range physical phone, for one vertical and one horizontal title; F6 labels updated from measured phones |
| M11 | **Analogue inputs** (W26). `ArcadeAxis` and `setAxis`, `web_set_axis`, machine input discovery, controller-config analogue and dual-stick sequences, gamepad axis binding, keyboard pedal keys; answer F11. | Through the production bridge: a `tempest.c` dial turns from a relative axis and from a held hat; a `rampart.c` trackball moves; the `bzone.c` tank drives from one hat and from the second stick alone; the controller file loads without warnings; the `segaxbd.c`, `segaorun.c`, `segahang.c`, `polepos.c` and `taito_z.c` boards steer by hand after the family rebuilds |
| M12 | **High-score persistence bridge.** RAM-range read/write exports and a per-machine range table (§12.2); answer H1–H4. | A `pacman.c`-class title's high-score table survives exit and reload through the overlay without NVRAM, and a title with no table entry is unaffected |
| M13 | **Local compatibility matrix.** Audit and manually verify user-supplied local sets per family, parents/BIOS/samples supplied by the user. | Each set either boots with verified metadata or has a precise audit/driver blocker recorded under `docs/probes/families/`; no local ROM or set identity enters source or CI |
| M14 | **Optional FBNeo probe.** Parent spec L1–L8. | Written evidence of a measured benefit worth the separate ROM lineage and licence constraints |
| M15 | **Optional `LibretroAdapter`.** | One optional-core title runs through the unchanged player, cabinet, controls and storage APIs |
| M16 | **Pinned MAME upgrade probe.** Evaluate a newer source tag through the direct bridge without changing the 0.161 build. | Side-by-side build plus documented ROM, save-state, size and performance migration costs |
| M17 | **Deferred families.** `taito-multi` and multi-screen display; `galaxian-misc`. | Multi-screen titles present correctly or have a documented blocker |

### 12.1 M1 implementation slices

M1 is delivered as four separately reviewed increments, inherited from the
parent plan and adjusted for the fork. They define commit boundaries, not
extra milestones.

1. **M1A — contracts and build boundary.** Implement the shared runtime
   types, predicates and `ArcadeRuntimeError`. Relocate the inherited M0
   diagnostic patches 0001–0010 to `mame/probes/patches/`, reserve
   `mame/patches/` for production, convert the inherited probe targets into
   `mame/targets/neogeo.{lua,lst}` and `cps1.{lua,lst}` covering their full
   driver lists, and implement `build-mame.ts` over the P2 recipe. Its first
   integration test produces a deterministic `build.json`, a modularized
   ROM-free factory, and starts MAME through `callMain()` with
   `noInitialRun: true` and injected MEMFS archives.
2. **M1B — production web bridge.** Web video, sound and input OSD modules,
   narrow bridge exports, frontend-result/log callbacks, NVRAM wrapper and
   the non-blocking screen-period accumulator, preserving the M0 decisions:
   single-threaded hosting, upright core rendering, scheduled state
   operations and explicit terminal control.
3. **M1C — TypeScript adapter.** `MameEmulatorAdapter` and its fresh
   per-start session: build metadata and machine validation, memory-budget
   check, MEMFS inputs by role, audit-failure classification, heap-backed
   frame and sound copies, control mapping, lifecycle/state/persistence
   operations, and release of all callbacks and module references on
   failure or exit.
4. **M1D — display, preload and acceptance.** `ArcadeDisplay` with
   native-size and aspect layout, `serve-harness --preload` with the
   minimal harness page, then the real-build browser acceptance at
   controlled 60 and 120 Hz cadences for one preloaded Neo Geo (59.185 Hz,
   BIOS-dependent) and one preloaded CPS-1 (59.637 Hz, 4:3 non-square)
   title.

### 12.2 High-score persistence bridge (M12)

Boards without NVRAM keep their high-score table in work RAM, so it is lost
when the machine exits. Nothing prevents the bridge from persisting it; it
is deferred, not impossible, and is treated as a non-defect until M12.

The mechanism is the one the later MAME `hiscore` plugin and the older
hiscore patches use:

- A **range table** describes, per machine, which CPU address space and
  byte ranges hold the table, plus the start and end byte values the game
  writes once it has initialized that RAM. The community `hiscore.dat` is
  the obvious source; H1 reviews its licence and format, and the runtime
  stores a converted per-machine JSON beside `romsets/` rather than the
  original file.
- Two new exports, `web_read_ram(cpu, addr, len, out)` and
  `web_write_ram(cpu, addr, ptr, len)`, go through the CPU's program
  address space the way the debugger does. H2 confirms the 0.161 API and
  whether reads/writes are safe at the between-timeslice boundary the
  bridge already uses for state operations.
- At start, after the incoming overlay is restored, the adapter polls the
  range each `onTick` until the start/end bytes match (meaning the game has
  cleared the RAM), then writes the saved table once. On `persist()` it
  reads the ranges and stores them under a new overlay root `hiscore/`
  keyed by machine. The dirty-detection snapshot includes them, so
  `persist()` returns a new overlay only when scores changed.
- Nothing of this is a property of the ROM: the table is a few hundred
  bytes of the user's own play state and lives in `ArcadeStorage` like
  NVRAM does.

| ID | Question | Decides |
| -- | -------- | ------- |
| H1 | Under what licence and in what format is a usable range table available for the 0.161-era machine names, and which required-family titles have entries? | Whether the table ships in the repository, is converted at build time, or is user-supplied |
| H2 | Can the bridge read and write a CPU address space at the scheduled-operation boundary in 0.161 without side effects on memory-mapped hardware? | Export design and safety constraints |
| H3 | Do the start/end sentinel bytes reliably detect RAM initialization in Wasm, and what happens when a write lands early? | Polling policy and the failure mode when a title's entry is wrong |
| H4 | Does restoring a table before the first frame interact with save states, DIP changes or soft reset? | Overlay ordering rules |

---

## 13. Probe plans

### 13.1 Family probes (M2, repeated per family)

Each family gets `docs/probes/families/<family>.md` with environment,
commands, target files, logs and measurements. Private title identities
stay in ignored local JSON configs exactly as the inherited probe scripts
already require.

| ID | Question | Decides |
| -- | -------- | ------- |
| F1 | Does a target Lua/`.lst` pair for the family compile under the pinned toolchain with the cores named in §4.6, and does `-listfull` expose every parent and clone of its driver sources? | The committed target pair and `build.json.machines` |
| F2 | Raw, gzip and Brotli size of the family WASM and JS; does folding an adjacent driver set (e.g. `galaxian-misc` into `namco-classic`) change size materially? | Family boundaries and download budget |
| F3 | For the family's largest ROM set, do zip bytes in MEMFS plus loaded and decrypted regions fit in 4,096 pages? What is the peak? | `memoryPages` per family and the `MEMORY_EXCEEDED` threshold formula |
| F4 | Time from `callMain` to first frame in Chromium for the family's slowest-starting title (CPS-2 decryption, Neo Geo graphics decryption, Namco S2 multi-CPU init)? | `starting` UX and whether a progress callback is needed |
| F5 | Does the screen-period accumulator hold the family's native refresh (60.606, 59.185, 57.5 Hz) within 0.5 % on 60, 90, 120 and 144 Hz cadences, and does a vertical title arrive upright at the expected geometry? | Pacing and orientation acceptance per family |
| F6 | Sustained emulated-time ratio over 60 s on desktop, and informationally under the 4× CPU-throttled mobile proxy, for the family's heaviest title? | Desktop full speed is a v1.0.0 gate per family; the proxy number is a provisional phone-playable label that M10 replaces with physical-phone evidence |
| F7 | Which BIOS options does `-listxml` report, does `-bios` select them in the browser, and how does the audit distinguish required BIOS from optional BIOS sets? | `MachineInfo.bios`, `ArcadeStartConfig.bios`, audit roles |
| F8 | Where does 0.161 persist each family's state: NVRAM files, EEPROM, Neo Geo memory cards, Timekeeper? Does `web_flush_nvram()` cover all of them mid-run? After a scheduled state load, is the next rendered frame byte-identical to the frame after the save, and if not which screen or device state the 0.161 driver omits? | Overlay roots, the scope of patch 0003, and the M6 state-fidelity acceptance per family |
| F9 | Which titles reference sample sets, what does the auditor report when a sample zip is absent, and does the title run without it? | `samples` role handling and optional-missing reporting |
| F10 | How does each family name its input ports (`P1_BUTTON1`, `COIN1`, `SELECT1`, `TILT`, shared-stick alternating boards, cocktail DIPs), and how many frames must a coin be held to register? | Controller-config generator coverage and per-family `tap` minimum |
| F11 | Which analogue and dual-stick port types does each family driver declare, with what min/max, sensitivity, key delta, centre delta and reverse attributes, and which generated standard, increment, decrement or synthesized sequence binds each? Answered per family in `docs/probes/families/` by driver source file and port type. | M11 `ArcadeAxis` design and the §4.4 generator |

M2 passes for a family only when F1–F6 have evidence. F7–F11 are answered
by the milestone that consumes them (M8, M6, M7, M4, M11) but are recorded
in the same per-family file. H1–H4 (§12.2) are recorded under
`docs/probes/hiscore.md` when M12 begins.

### 13.2 Inherited and optional probes

P1–P12 are inherited complete and are not repeated unless the source or
toolchain pin changes. The optional libretro probes L1–L8 remain as defined
in the parent spec for M13.

---

## 14. Tests

Same two-suite rule as the DOS runtime: a test that touches the DOM is in
`browser`.

**`spec`:** shared-type predicates (including `buttons: 0`, `select`,
`tilt`), `ArcadeRuntimeError`, `ArcadeInput` over `FakeArcadeSession`
(`tap`, SOCD, channels), `ArcadeDisplay.layoutFor` (vertical and 4:3
non-square cases), `ArcadeMapper` target logic, `GamepadSource` with
injected provider and scheduler, controller-config generation (1–4 players,
zero-button, AES select), DIP cfg generation, the overlay codec and
cumulative-diff logic over an in-memory tree, `RomSetAudit` over fixture
metadata and synthetic zips (missing parent, missing BIOS, wrong CRC,
optional samples, unexpected extra file, merged-set file placement), the
memory-budget formula, `build.json` and `romsets` predicates, and the
inherited pin and threading-inspector tests.

**`browser`:** the adapter against each real family build, display, audio,
player lifecycle (doubles and real build), keyboard and touch sources
through the mapper, `ArcadeStorage` and `ArcadeRomStore` with a real
IndexedDB, `RomSetAudit` verdict versus MAME's own audit verdict on the same
input, and one end-to-end case per milestone acceptance row that can be
automated.

**`build`:** a family build from a clean cache is byte-identical on a
second run, its `build.json` validates, the threading inspector passes,
`romsets/` contains one file per `-listfull` machine, and `npm pack`
contains no ROM, emulator cache, `res/` file, `harness/` file or compiled
WASM.

**Test ROMs.** Required browser cases use legally obtained, user-supplied
sets supported by the pinned build, one per family, supplied through the
preload config of §11.1. Machine identity, parent/BIOS identity, archive
paths and expected frame hashes are private local inputs read from that
ignored JSON config, never committed. Suites skip
locally when the separately built family artifact or the private config is
absent. Commercial sets, including files under `res/`, are local manual
verification material only and never enter source, packages or CI.

### 14.1 Release gates

A milestone is complete only when its acceptance row and the relevant
automated suites pass from a clean checkout. Family builds and probes may
use network access to fetch the pinned emulator source; ordinary `check`,
`test:spec` and package tests do not. Real browser tests may skip in a
local run when their family artifacts are absent, but CI for a tagged
release must build every required family and run them against the private
sets available to the release machine.

v1.0.0 demonstrates all of these flows in the harness, on desktop:

1. Load each required family build from a locally served directory; the
   runtime identity reports the pinned 0.161 source version.
2. Start a machine from a preload config with no user interaction beyond
   the audio gesture, and start the same machine from zips picked on disk;
   both produce the same `MachineInfo` and first stable frame.
3. Pick ROM zips from disk, see an audit report that names the missing
   parent, BIOS or sample set, supply it, and start.
4. Insert coin, start and play from a physical keyboard, for a zero-button
   vertical Namco title and a six-button CPS-2 title.
5. Connect two standard gamepads and independently drive players 1 and 2;
   disconnecting one releases all of its held controls.
6. Hear synchronized stereo after one gesture and stay under the audio cap
   for 60 s.
7. Save a Neo Geo memory card, a CPS-2 EEPROM change and a named state,
   reload the page, restore all three, then clear storage without touching
   the ROM store.
8. Switch Neo Geo BIOS region and MVS/AES mode and observe the change.
9. Give the audit a wrong-version, incomplete, clone-only or wrong-family
   set and receive an actionable report before any module is instantiated.
10. Trigger startup failure at every async boundary and observe an idle,
    reusable player with no attached listeners, animation frame, audio
    context or partial session left behind.

Phone touch play, rotation while running and the 60-second physical-phone
performance run move to the M10 acceptance row.

---

## 15. Out of scope

- Deployments of any kind: manifests, a shared shell, static builds and any
  script that copies ROMs. A page author who wants a hosted game builds
  their own page against the library and answers for its content.
- The MAME UI (menus, OSD, cheat engine), netplay, software lists and home
  systems.
- Shipping or linking to ROMs, BIOS sets or sample sets.
- Mobile touch play in v1.0.0 (M10), and high-score persistence for
  boards without NVRAM in v1.0.0 (M12, §12.2). Neither is a v1.0.0 defect.
- Light-gun titles until an analog pointer control exists (after M11).
- 3D and later-generation boards (Namco System 21/22, CPS-3, Taito F3 and
  later) in v1; they may become families only after the required matrix
  ships and their own F-probes pass.

---

## 16. Concurrent work plan

This section exists so that two or more coding agents can implement the
spec at the same time on separate branches while one integrator reviews and
merges to `main`. It does not change what is built, only how the work is
cut and landed.

### 16.1 Principles

1. **Contracts first, then fan out.** Nothing is parallel until W0 (§16.3)
   has merged: the shared types, predicates, error class and the test
   doubles every other package tests against. After that, §2 is **frozen**.
   A package that needs a contract change does not make it on its branch;
   it opens a short contract-amendment branch that edits §2 of this spec
   and `src/shared.types.ts` only, the integrator merges that first, and
   dependants rebase.
2. **Exclusive write sets.** Every package owns a list of paths and edits
   nothing outside it except its own test files. Shared files
   (`src/index.ts`, `package.json`, `tsconfig*.json`, `tests/run.ts`,
   `src/shared.types.ts`, this spec) are integrator-owned; a package that
   needs a line in one of them says so in its merge request and the
   integrator adds it at merge time. Two packages never own the same path.
3. **Doubles over dependencies.** A package above the adapter is developed
   and tested against the W0 doubles (`FakeArcadeSession`,
   `FakeArcadeAdapter`, `FakeModuleLoader`, `FakeTimer`, `FakeFrameScheduler`), never against another
   package's branch. A package that composes others (`ArcadePlayer`,
   `ArcadeCabinet`) starts only when the packages it composes have merged.
4. **Lanes follow toolchains.** Work that needs emsdk and the MAME source
   tree (patches, bridge C++, family targets, build pipeline) is one lane;
   pure TypeScript work is another. An agent in the TypeScript lane never
   needs the 3 GB of caches, and an agent in the native lane never blocks
   on it.
5. **The integrator does not implement packages.** The integrator writes
   W0, reviews, merges, runs the full suites on `main`, maintains this
   section, and closes milestones. If the integrator also takes a package,
   it is one from the critical path and it is listed here like any other.

### 16.2 Branches, worktrees and merging

- One branch per package, named `wp/<id>-<slug>` (for example
  `wp/w3-arcade-input`), cut from `main` at the package's start.
- Each agent works in its own git worktree so checkouts never share a
  working tree: `git worktree add ../arcade-runtime-ts.w3 wp/w3-arcade-input`.
  A worktree has no `node_modules`, `res/` or `.cache/`; the TypeScript lane
  runs `npm install` and nothing else, and the native lane recreates the
  `res/emsdk` and `.cache/mame0161-source` links or sets `EMSDK_DIR`.
- A package is ready for review when: `npm run check` and `npm test` pass
  on the branch rebased onto current `main`; its browser cases pass or skip
  for a documented reason; it touched only its write set plus its tests;
  it added no file under `res/` and no ROM, machine name or hash to tracked
  files; every public class, config and event has a predicate and a spec
  test; and the branch's commits follow the repository's commit
  conventions (short summary, blank line, details; no attribution lines).
- Review is a spec-compliance review against the sections the package
  row names, then a run of the full suites on the merged result. The
  integrator merges with a merge commit (history is kept; no squash), runs
  `check` and `test` on `main` again, and deletes the branch.
- A merge that breaks `main` is reverted first and discussed second.
- Conflicts are expected only in integrator-owned files and are resolved by
  the integrator at merge time. A conflict anywhere else means a write-set
  violation and the branch is sent back.

### 16.3 Work packages

Columns: **Owns** is the exclusive write set (plus the package's own test
files under `tests/spec/` and `tests/browser/`). **After** lists packages
that must be merged first. **Spec** lists the sections the agent's brief
points at. **Lane** is N (native: emsdk and MAME source needed) or T (pure
TypeScript).

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W0 | Contracts and doubles: `shared.types.ts`, predicates, `ArcadeRuntimeError`, `tests/support/` doubles, `src/index.ts` skeleton | `src/shared.types.ts`, `src/ArcadeRuntimeError/`, `tests/support/`, `src/index.ts` | — | §2, §3, §14 | T | M1 |
| W1 | Patch relocation and family target pairs: move probe patches to `mame/probes/patches/`, fix probe script paths, `neogeo.{lua,lst}` and `cps1.{lua,lst}` covering full driver lists | `mame/patches/`, `mame/probes/`, `mame/targets/`, `scripts/probe-*.sh`, `scripts/read-mame-probe-config.js` | — | §1.2, §4.1, §4.6, §12.1 | N | M1 |
| W2 | Build pipeline: `build-mame.ts`, `build.json` writer, threading gate wiring, `extract-romsets.ts` (metadata only) | `scripts/build-mame.ts`, `scripts/extract-romsets.ts`, `mame/builds/` | W0, W1 | §4.1, §10.5 metadata, §14 build | N | M1, M7 |
| W3 | Production bridge: patches 0001–0003, `mame/bridge/*.cpp`, screen-period accumulator, exports and callbacks | `mame/patches/0001-*`, `0002-*`, `0003-*`, `mame/bridge/` | W1 | §4.2–§4.5, §12.1 M1B | N | M1 |
| W4 | `MameEmulatorAdapter` and session: MEMFS layout, audit classification, heap copies, lifecycle, persist, overlay codec | `src/MameEmulatorAdapter/` | W0, W2, W3 | §2.4, §5 | N | M1, M6 |
| W5 | `ArcadeDisplay` | `src/ArcadeDisplay/` | W0 | §7 | T | M1 |
| W6 | `ArcadeAudio` | `src/ArcadeAudio/` | W0 | §8 | T | M3 |
| W7 | `ArcadeInput` and `KeyboardSource`, `DEFAULT_KEYBOARD_MAP`, controller-config generator (`web.cfg` text) | `src/ArcadeInput/`, `src/KeyboardSource/`, `src/ControllerConfig/` | W0 | §4.4, §6, §10.3 | T | M4 |
| W8 | `GamepadSource` | `src/GamepadSource/` | W7 | §10.4 | T | M5 |
| W9 | `ArcadeStorage` and `ArcadeRomStore` | `src/ArcadeStorage/`, `src/ArcadeRomStore/` | W0 | §10.7 | T | M6, M7 |
| W10 | `RomSetAudit` and the `arcade-audit-roms` bin | `src/RomSetAudit/`, `scripts/audit-roms.ts` | W0 | §10.5 | T | M7 |
| W11 | `ArcadePlayer` | `src/ArcadePlayer/` | W4, W5, W6, W7 | §9 | T | M1–M4 |
| W12 | `ArcadeCabinet` | `src/ArcadeCabinet/` | W8, W9, W10, W11 | §10.6 | T | M7 |
| W13 | Harness and preload: `serve-harness.ts --preload`, `harness/` | `scripts/serve-harness.ts`, `harness/` | W11 (minimal page, W13a), W12 (cabinet page, W13b), W16 (BIOS/DIP selectors, W13c) | §11 | T | M1, M7, M8 |
| W14a–f | One package per remaining family: `cps2`, `namco-classic`, `namco-s1`, `namco-s2`, `taito-classic`, `taito-16`; target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md` | W2 | §4.6, §13.1 | N | M2 |
| W15 | Saves bridge: memory card and EEPROM coverage in `web_flush_nvram`, F8 record | `mame/patches/0003-*`, `docs/probes/families/*` (F8 rows only) | W3, W4 | §4.3, §12 M6 | N | M6 |
| W16 | BIOS and DIP: `web_machine_info` BIOS fields, generated DIP cfg | `mame/bridge/web_bridge.cpp` (BIOS struct only), `src/DipConfig/` | W4, W13 | §4.5, §12 M8 | N+T | M8 |
| W17 | Release gate: licence notices in build output, `npm pack` tests, hosted-harness policy | `scripts/build-mame.ts` (notice copy only), `tests/spec/*package*` | W2, W12 | §0.4, §14.1 | T | M9 |
| W18 | Harness library view: zip-driven identification, per-game start | `harness/`, `scripts/serve-harness.ts`, harness browser tests | W13c | §11 | T | post-1.0 polish |

`src/ControllerConfig/` and `src/DipConfig/` are internal modules (pure
text generators) added to the layout of §1.2 by this section; they are not
public exports.

### 16.4 Dependency graph and critical path

```
W0 ─┬─ W5 (display) ──────────────┐
    ├─ W6 (audio) ────────────────┤
    ├─ W7 (input) ── W8 (gamepad) ┤
    ├─ W9 (storage) ──────────────┼─ W11 (player) ─ W12 (cabinet) ─ W13b (harness) ─ W17
    ├─ W10 (audit) ───────────────┤                                   
    └─ W2 (build) ◄── W1 (targets)│
            │            └─ W3 (bridge) ─ W4 (adapter) ─┘
            │                              ├─ W15 (saves)
            │                              └─ W16 (bios/dip) ─ W13c (selectors)
            └─ W14a … W14f (families, each independent)
```

The critical path is **W0 → W1 → W3 → W4 → W11 → W12**. Everything in the
TypeScript lane except W11 and W12 can run while W1, W3 and W4 are being
built, and W14a–f can run as soon as W2 has merged. W13's minimal page
(enough to start a preloaded machine) is split off so M1 acceptance does not
wait for the cabinet.

### 16.5 Lane assignment for two agents

| Lane | Agent | Order of packages | Notes |
| ---- | ----- | ----------------- | ----- |
| Native (N) | Agent A | W1 → W3 → W4 → W15 → W16 (native half) | Needs emsdk, the source cache and private preload configs; owns everything under `mame/` after W0 |
| TypeScript (T) | Agent B | W5 → W7 → W6 → W9 → W10 → W8 → W11 → W12 → W13 → W17 | Needs only `npm install`; tests against doubles until W4 merges, then reruns its browser cases against the real build |
| Integrator | reviewer | W0 first; then review/merge; W2 if nobody else is free | W2 sits between lanes (Node script that drives emsdk) and is small; it is the integrator's default package |

With a third agent, W14a–f are its lane: one branch per family, each
independent of the others, each gated on W2. With a fourth, W10 and W9
move off Agent B's queue since they share no code with the rest of the
TypeScript lane.

### 16.6 Agent brief

Every package starts from a brief with exactly these parts, so an agent can
work from the brief and the spec alone:

1. The package row from §16.3, verbatim.
2. The spec sections it names, read in full before writing code.
3. The write set and the rule that nothing else is edited.
4. The contracts it consumes (`src/shared.types.ts` at the current `main`)
   and the doubles it tests against (`tests/support/`).
5. The definition of ready-for-review from §16.2.
6. The repository rules that are easy to violate: constructors read no
   globals; `init` supplies browser defaults; one error class; every public
   type has a predicate; a test that touches the DOM goes in `browser`;
   nothing under `res/` is read by a committed test except through the
   preload or probe config environment variable; no ROM identity in tracked
   files; no attribution lines in commits.
7. The exact commands: `npm run check`, `npm test`, `npm run test:browser`,
   and for the native lane the probe and build commands with `EMSDK_DIR`.

A brief that cannot be written this way means the package is not ready to
be handed off; split it or land a contract amendment first.
