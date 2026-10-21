# W4 — `MameEmulatorAdapter`

Lane: **native** (TypeScript, but its browser acceptance needs a real
family build). Branch: `wp/w4-mame-adapter`. Milestones: M1 (slice M1C), M6.
Starts after W3 has merged.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W4 | `MameEmulatorAdapter` and session: MEMFS layout, audit classification, heap copies, lifecycle, persist, overlay codec | `src/MameEmulatorAdapter/` | W0, W2, W3 | §2.4, §5 | N | M1, M6 |

W2 (the build pipeline) may not be merged when you start. You do not need
it: your spec tests run against `FakeModuleLoader`, and your browser test
runs against the artifact W3's merge note tells you how to build.

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §5 in full, §4.3.1 in
full (the module shape you drive; `FakeModuleLoader` resolves with
whatever object you script, so model the real one exactly), §4.4 and
§4.5 (what you write into MEMFS and pass as argv), §2.4 (overlay wire
format, limits and rejection rules), §4.6 ("Memory budget" and "Sample
sets" bullets), and W3's merge note at `docs/work/W3-merge-note.md` for
the artifact names and link flags.

Port reference for the overlay codec and session shape:
`/home/mastergray/dev/dos-game-runtime-js/src/JsDosEmulatorAdapter/` (its
overlay zip reading/writing with `fflate`, path validation and limits are
the model for §2.4).

## 3. Write set

Exclusive: `src/MameEmulatorAdapter/` (`MameEmulatorAdapter.ts`,
`MameSession.ts`, `OverlayCodec.ts`, `types.ts`), plus your tests:
`tests/spec/22-overlay-codec.test.ts`, `tests/spec/23-mame-adapter.test.ts`
(against `FakeModuleLoader`), and `tests/browser/27-mame-adapter.test.ts`
(against the real build, gated on `ARCADE_PRELOAD_CONFIG`).

`src/ControllerConfig/controllerConfigFor.ts` is internal and already on
`main`; import it, do not copy it. You will need export lines in
`src/index.ts` for `MameEmulatorAdapter` and your public `types.ts`
re-exports (the module type stays private). List them in your merge note.

## 4. Deliverables

1. **`OverlayCodec`** per §2.4: `encode(tree, header) → Uint8Array` and
   `decode(bytes, expectedHeader) → tree`, where a tree maps logical
   paths under `nvram/`, `cfg/`, `states/`, `memcard/` to bytes.
   Deterministic output (sorted paths, fixed timestamps, no directory
   entries). Decoding rejects with `OVERLAY_INCOMPATIBLE` for a header
   mismatch and `INVALID_CONFIG` for any path or limit violation listed
   in §2.4. Include a `hashTree(tree) → string` used for dirty detection.
2. **`MameEmulatorAdapter`** per §5: constructor with `{ buildUrl, build,
   loadModule }`, `init` fetching and validating `build.json` with
   `isBuildInfo`, resolving artifact URLs relative to `buildUrl`,
   refusing a `build.json` whose `adapter` is not `"mame"` or whose
   `artifacts` do not include the expected `mame<family>.js`.
3. **`start`** in the §5 order. Specifics:
   - Memory budget: sum of ROM bytes plus the machine's region sizes
     (from `romsets/<machine>.json` when it is reachable; otherwise ROM
     bytes × 2 as a documented fallback) must be below
     `memoryPages × 65536 × 0.75`; reject `MEMORY_EXCEEDED` first.
   - MEMFS layout: `/mame/roms`, `/mame/samples`, `/mame/nvram`,
     `/mame/cfg`, `/mame/sta`, `/mame/ctrlr`; write `web.cfg` from
     `controllerConfigFor({ players: hints.players, select })` where
     `select` is true only when `machineHints` or later `MachineInfo`
     indicates a select port (for M1, pass `false` and note it).
   - argv: `[machine, ...fixed §4.5 options in 0.161 spelling, ...bios,
     ...options]`; record the exact list in a constant the spec test
     asserts on.
   - Resolve on first `onFrame` after `web_machine_info` parses to a
     valid `MachineInfo` (add `family` from the build). Reject with
     `ROM_SET_INVALID` (ordered `onLog` records as `data`) when
     `onFrontendDone` fires with `MAMERR_MISSING_FILES` (2) before the
     first frame; any other pre-frame result or a thrown factory/load
     error is `ADAPTER_FAILED`. On any rejection, drop the module and
     every callback.
4. **`MameSession`**: the §5 session behaviour exactly.
   - Pacing: the accumulator lives here. Config takes an injected
     `scheduler: FrameScheduler` and `clock: () => number`; each tick adds
     elapsed ms, computes whole periods of `1000 / refreshHz`, calls
     `web_run_frames(min(periods, 4))`, discards excess beyond the cap,
     and resets the accumulator on resume so no catch-up burst occurs.
     While paused, each tick calls `web_pump()` only.
   - `onTick`/`onFrame`/`onSound` fan-out: copy from `HEAPU8`/`HEAPF32`
     into reused typed arrays before notifying listeners; never retain a
     heap view.
   - `setControl` maps through `arcadeControlKey` to `(pad, item)` per
     §4.3.1 and ignores controls above the machine's player/button count.
   - `saveState`/`loadState` resolve or reject on `onStateDone`; only one
     may be pending.
   - `persist`: `web_flush_nvram()`, rehash, `null` if unchanged, else a
     complete cumulative overlay, advancing the snapshot.
   - `exit`: `web_exit()`, await `onExit`, stop the scheduler, drop the
     module; every method throws `DESTROYED` afterwards.
   - `reset("hard")` is implemented in `ArcadePlayer` (W11) as exit plus
     start; the session's `reset("hard")` rejects with `UNSUPPORTED` and
     says so.
5. **Tests.**
   - `spec` overlay codec: round trip, determinism (equal trees give
     equal bytes), every §2.4 rejection one per condition, zip-bomb
     metadata (expanded size over limit) rejected without inflating.
   - `spec` adapter with `FakeModuleLoader`: script a module object with
     `FS`, `callMain`, `cwrap` returning recording functions, `HEAPU8`,
     `HEAPF32`, `UTF8ToString`; assert the MEMFS writes and argv; drive
     `Module.web` callbacks by hand to cover resolve-on-first-frame,
     `ROM_SET_INVALID` with ordered logs, `ADAPTER_FAILED`, the pacing
     accumulator at 59.637 and 60.606 Hz on 60 and 120 Hz
     `FakeFrameScheduler` ticks over 10 simulated seconds (frames run
     within one of the expected count), the 4-period cap, pause pumping,
     persist null-then-overlay, and `DESTROYED` after exit.
   - `browser`: against the real build from the preload config: start
     resolves with the expected `MachineInfo`; 300 frames arrive upright
     at the native size; sound arrives at 48 kHz; a coin tap changes the
     picture; save/load round trip restores an identical next frame;
     `persist` is `null` at boot; exit then any call throws `DESTROYED`.

## 5. Contracts and doubles

From `src/index.ts`: every §2 type and predicate, `arcadeControlKey`,
`ArcadeRuntimeError`. From `tests/support/`: `FakeModuleLoader`,
`FakeFrameScheduler`, `fixtures.ts` (`validBuildInfo`,
`validMachineInfo`, `blankFrame`).

## 6. Definition of ready for review

`docs/work/README.md` rule 7, plus the browser cases passing against a
real family build on your machine (say which), and a merge note listing
the argv constant, the MEMFS layout, and any point where the real
module's behaviour differed from §4.3.1 (that is a contract issue to
raise, not to paper over).

## 7. Repository rules that bite here

- Only `src/MameEmulatorAdapter/` and the future `LibretroAdapter` may
  load an Emscripten module (§1.3); the loader is injected.
- The private module type is not exported.
- No ROM identity or absolute path in tracked files; the browser test
  reads the preload config.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
# native links, as in docs/work/README.md
npm run check && npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```
