# W4 merge note: MAME adapter and session

## Status

W4's TypeScript implementation and double-backed specification cases are
complete. `npm run check` passes. `npm test` passes with 451 passed, 0 failed
and 2 existing skipped cases.

The real Neo Geo browser acceptance is blocked on the state-frame condition
described under **Integrator question**. The official browser command also
cannot bind its loopback page server in this sandbox (`listen EPERM`). A
request-intercepted Chromium diagnostic against the same production artifacts
confirmed every W4 observation except byte-identical video after state restore.

The implementation, tests, and this note are committed on
`wp/w4-mame-adapter`.

## Integrator-owned `src/index.ts` lines

Add the class export:

```ts
export { default as MameEmulatorAdapter } from "./MameEmulatorAdapter/MameEmulatorAdapter.js";
```

Add the public config predicates and types:

```ts
export {
    isMameEmulatorAdapterConfig,
    isMameEmulatorAdapterInitConfig,
    type MameClock,
    type MameEmulatorAdapterConfig,
    type MameEmulatorAdapterInitConfig,
} from "./MameEmulatorAdapter/types.js";
```

The private Emscripten module shape, `MameSession`, and `OverlayCodec` stay out
of the root surface. `MAME_FIXED_ARGUMENTS` is exported from the adapter module
for its package-level spec assertion but is not part of the §1.4 root surface.

## Exact argv constant

`callMain` receives the machine first, followed by this frozen 0.161 list:

```text
-rompath /mame/roms
-samplepath /mame/samples
-video web
-sound web
-samplerate 48000
-nothrottle
-noautoframeskip
-joystick
-ctrlr web
-ctrlrpath /mame/ctrlr
-cfg_directory /mame/cfg
-nvram_directory /mame/nvram
-state_directory /mame/sta
-skip_gameinfo
-noautosave
-nomouse
-rotate
```

`samplerate` replaces the constant's default value when configured. `-bios`
follows the fixed list, then the optional `-frameskip` pair. M1 controller
generation passes `select: false`; DIP cfg generation remains W16/M8 work and
non-empty `dipswitches` currently rejects with `UNSUPPORTED`.

## MEMFS and overlay layout

Startup creates:

```text
/mame/roms
/mame/samples
/mame/nvram
/mame/cfg
/mame/sta
/mame/ctrlr
/mame/memcard
```

ROM metadata selects `/mame/samples` only for the `samples` role; all other
supplied archives go under `/mame/roms`. The generated controller file is
`/mame/ctrlr/web.cfg`.

Overlay roots map as follows:

```text
nvram/  -> /mame/nvram/
cfg/    -> /mame/cfg/
states/ -> /mame/sta/
memcard/ -> /mame/memcard/
```

`cfg/web.cfg` is excluded from dirty detection. The reserved standalone
memory-card directory can be changed when W15/F8 determines the production
location.

## Memory-budget interpretation

Current `romsets/<machine>.json` documents do not contain named MAME region
sizes. When metadata is reachable, W4 uses the sum of its resolved ROM entry
sizes as the machine-region estimate. When it is unavailable, the region
estimate is twice the supplied zip bytes, so the total estimate is three times
the supplied bytes. The estimate must be strictly below 75% of fixed Wasm
memory, and rejection happens before module loading.

## Real-module observations and contract differences

- Immediately after `callMain`, `web_machine_info()` returned otherwise valid
  metadata but zero width and height. Both became valid while the first
  `onFrame` callback was firing. The adapter therefore uses one
  scheduler-driven `web_run_frames(1)` startup step, validates machine info in
  that callback, and only then constructs/resolves the session. This differs
  from the W3 note's statement that there were no §4.3.1 shape deviations.
- The production JavaScript is classic modularized output that installs a
  `createMame` variable; it is not an ESM module exporting that factory.
  `init` still implements the specified dynamic-import default, while the real
  browser case injects a classic-script `ModuleLoader`. The build format and
  §5's default-loader wording should be reconciled.
- The tested production run materialized and changed an NVRAM file during
  startup. To make the required first `persist()` return `null`, W4 flushes and
  snapshots persistence at the first valid frame. Taking the snapshot before
  `callMain` as §5 step 5 literally orders it made boot-created NVRAM appear as
  a user change.
- The real bridge reported success for both save and load, and produced a
  state file, but video after restore was not byte-identical. The specified
  next-frame comparison failed, and a diagnostic comparing two 30-frame
  sequences after repeated restores found no identical frame pair. No adapter
  workaround was added.

## Integrator question

Should the state-frame blocker return to W3/W15 for a native bridge fix, or
should the W4 browser acceptance be changed to a non-pixel state criterion?
The committed browser case retains the specified byte-identical expectation
and will fail until that decision is made.

## Browser cases

The W4 case is `tests/browser/27-mame-adapter.test.ts`. It serves the page via
`tests/support/TestPageServer.ts` and a separate generic resource server for
the ignored production build and preload inputs. It returns only booleans and
counts; no private identity is recorded.

Run the full browser suite with the production W3 artifact location supplied
for the older bridge cases:

```sh
ARCADE_PRELOAD_CONFIG=res/preload.json \
ARCADE_WEB_BRIDGE_ARTIFACT=dist/mame/neogeo/mameneogeo.js \
npm run test:browser
```

The W4 acceptance covers valid `MachineInfo`, 300 or more upright native-size
frames, 48 kHz sound, a picture change after a coin tap, state restore, clean
boot persistence, and `DESTROYED` after exit.
