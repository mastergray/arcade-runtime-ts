# W3 — Production web bridge

Lane: **native**. Branch: `wp/w3-bridge`. Milestone: M1 (slice M1B).
Starts after W1 has merged (it relies on the relocated probe patches and
the family target pairs).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W3 | Production bridge: patches 0001–0003, `mame/bridge/*.cpp`, screen-period stepping, exports and callbacks | `mame/patches/0001-*`, `0002-*`, `0003-*`, `mame/bridge/` | W1 | §4.2–§4.5, §12.1 M1B | N | M1 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.2, §4.3 and **§4.3.1 in
full** (the module shape is the contract you implement one side of), §4.4
(the token table: your input device registers exactly those items in that
order), §4.5, §5 (how the adapter will drive you), §12.1 (slice M1B).

Then the M0 evidence, which is the design record for this package:
`docs/probes/mame0161/bridge-hooks.md` (P7–P11, all sections),
`frame-pacing.md` (P5), `module-lifecycle.md` (P4),
`threading-and-hosting.md` (P6), and `build-system.md`.

Then the archived diagnostic patches under `mame/probes/patches/` (where
W1 moved them). They are **evidence, not production code**, but they show
exactly where each boundary lives in the 0.161 tree and which pinned-
toolchain accommodations are required:

| Probe patch | Touches | Shows |
| ----------- | ------- | ----- |
| `0003-emscripten-pacing-probe` | `src/emu/machine.c` | The stock Emscripten outer loop and how to step the scheduler from outside it |
| `0004-emscripten-bridge-hooks-probe` | `src/emu/machine.{h,c}`, `src/emu/schedule.c` | Notification hooks, pause/resume/reset/exit requests, scheduled state ops and the MEMFS node + `dump_timers()` accommodations |
| `0006-emscripten-persistence-probe` | `src/emu/machine.{h,c}` | The narrow `nvram_save()` wrapper; why `config_save_settings()` is forbidden mid-run |
| `0007-emscripten-video-probe` | `src/emu/video.{h,c}`, `src/emu/machine.c` | Software-renderer target, `RGB32` → RGBA conversion, orientation handling |
| `0008-emscripten-audio-probe` | `src/osd/modules/sound/js_sound.c` | The 48 kHz interleaved s16 mixer boundary and chunk cadence |
| `0009-emscripten-audit-output-probe` | `src/osd/modules/lib/osdobj_common.c`, `src/emu/clifront.c` | OSD output capture and reporting the frontend result before `onExit` |

`0001-emscripten-1.38.31-compatibility` and `0005-emscripten-disable-mongoose`
are **build-only** patches that every browser build still needs; W1 has
left them where the build script expects. Do not duplicate their content
in your production patches; if the production build needs them applied,
that is a `build-mame.ts` (W2) concern and you say so in the merge note.

## 3. Write set

Exclusive: `mame/patches/0001-web-osd-modules.patch`,
`mame/patches/0002-web-bridge-exports.patch`,
`mame/patches/0003-nvram-flush.patch`, everything under `mame/bridge/`
(the integrator moves the two inherited probe `*-pre.js` files to
`mame/probes/bridge/` when W1 merges, so the directory is yours), plus your tests: `tests/spec/17-web-bridge-sources.test.ts`
(static checks on the patch set and bridge sources) and
`tests/browser/22-web-bridge.test.ts`.

You may add a build-and-link script for your own verification under
`scripts/probe-web-bridge.sh` if the W1 family-pair mode is not enough;
it must apply only `mame/patches/*.patch` (never `mame/probes/patches/`).
Nothing under `src/` is yours.

## 4. Deliverables

1. **Patch 0001 — web OSD modules.** Add `web` video, sound and input
   modules at the OSD boundary 0.161 exposes (P7 records it; follow the
   `js_sound.c` module as the pattern for registration). The sources live
   in `mame/bridge/web_video.cpp`, `web_sound.cpp`, `web_input.cpp` and
   are *added* by the patch (the patch carries them so the build applies
   one patch set; keep the files in `mame/bridge/` as the reviewable
   copy and make the spec test assert the two are identical).
   - Video: rasterize the primitive list with the software renderer at
     native size with orientation applied, convert to opaque RGBA8888 in a
     reused buffer, call `onFrame(ptr, w, h)` once per rendered frame. P9
     gives the exact pixel format you start from.
   - Sound: take the mixed stream at the P10 boundary (48 kHz, interleaved
     s16 L/R, 960-frame chunks), convert to float in a reused buffer, call
     `onSound(ptr, frames)`.
   - Input: register four joystick devices named "Web Pad 1"…"Web Pad 4",
     each with the sixteen items of §4.3.1's `web_set_control` row, in that
     order, using the item ids of the §4.4 table. State is a static array
     the exports write and MAME polls. No keyboard provider is registered;
     SDL input must not be in the path.
2. **Patch 0002 — bridge exports and callbacks.** `mame/bridge/web_bridge.{h,cpp}`
   implementing every export and callback of §4.3.1 exactly. Key points:
   - `web_run_frames(count)` is the only way the machine advances. Replace
     the stock Emscripten outer loop so `callMain` returns control to JS
     with the running machine retained, as the pacing and lifecycle
     probes did, and so no native throttle, autoframeskip or
     `emscripten_set_main_loop` callback is left running.
   - Service a pending scheduled save/load only at the between-timeslice
     boundary; preserve both pinned-toolchain accommodations (pre-create
     the MEMFS state node; suppress `dump_timers()` under Emscripten).
     Never call `immediate_save`/`immediate_load`.
   - `onTick` fires per emulated frame even when video is skipped.
   - `onFrontendDone(result)` fires when the frontend returns early
     (audit failure etc.) and `onLog` carries every OSD output line with
     the level mapping in §4.3.1. `Module.onExit` is not relied on.
   - `web_exit` stops stepping, flushes NVRAM, fires `onExit`, and leaves
     the module in a state the adapter can discard. No second machine is
     ever started in the same module (P4).
   - `web_machine_info()` returns the JSON of §4.3.1. `bios` comes from
     the machine's BIOS options; `hasNvram` is whether any NVRAM/EEPROM/
     memory-card device exists. Say in the merge note how you determined
     each.
3. **Patch 0003 — NVRAM flush.** The narrow mid-run `nvram_save()` wrapper
   from P8, exposed as `web_flush_nvram()`. Memory-card and EEPROM
   coverage is W15's; here, flush what `nvram_save()` covers and record in
   the merge note what you observed it write for a Neo Geo title.
4. **Build flags.** Document in `mame/bridge/README.md` the exact link
   flags the production build needs (`MODULARIZE`, `EXPORT_NAME=createMame`,
   the `EXTRA_EXPORTED_RUNTIME_METHODS` list of §4.3.1, fixed
   `TOTAL_MEMORY`, no pthreads) so W2 can encode them. Confirm with the
   threading inspector that your output still has no shared memory.
5. **Tests.**
   - `spec`: the three production patches apply cleanly to a pristine
     unpack of the source archive (use a temp dir under the ignored
     `.cache/`; skip with a reason if the archive is absent), touch only
     the files you list in the merge note, and carry no `MAME_PROBE_`
     markers; the bridge sources in `mame/bridge/` match the copies inside
     patch 0001; the input item order matches §4.3.1.
   - `browser`: against a real `neogeo` or `cps1` build driven through the
     §4.3.1 shape **by hand** (no adapter exists yet; write the minimal JS
     in the test), with the private preload config in
     `ARCADE_PRELOAD_CONFIG` (skip when absent): `callMain` returns with
     the machine running; `web_machine_info` parses and matches the
     expected geometry and refresh; 120 `web_run_frames(1)` calls yield
     120 `onTick`s and ≥1 `onFrame` of the right size with non-black
     pixels; `onSound` chunks arrive at 48 kHz with `frames` = 960; a
     `web_set_control` press of P1 right is visible through the input port
     (reuse the P12 technique); pause makes `web_run_frames` return 0;
     save then load through `onStateDone` both report ok; `web_exit`
     fires `onExit` once; a deliberately missing BIOS zip yields
     `onFrontendDone(2)` preceded by error-level `onLog` lines and no
     `onTick`.

## 5. Contracts and doubles

§4.3.1 and §4.4 are the contracts; `src/shared.types.ts` is not consumed by
C++. The browser test drives the module directly, so no TypeScript doubles
apply; `tests/support/fixtures.ts` has `thrownBy`/`rejectedBy` if useful.

## 6. Definition of ready for review

`docs/work/README.md` rule 7, plus: the browser cases above pass on your
machine with the private config (say which family); the spec cases pass
from a clean checkout; the threading inspector passes on your artifact;
and the merge note lists every source file the three patches touch and any
0.161 API that forced a deviation from §4.3.1 (a deviation is a contract
amendment, so stop and write it up rather than inventing a different
shape).

## 7. Repository rules that bite here

- Production patches never include probe telemetry, `MAME_PROBE_`
  markers, counters, or fixture-only compatibility changes.
- No ROM identity, machine name, hash or absolute path in tracked files;
  the browser test reads everything from the preload config.
- Generated artifacts stay under ignored `.cache/`.
- The private source cache is shared with the parent checkout; if you
  need a pristine tree, unpack `res/mame0161s.zip` into a new directory
  under `.cache/` rather than reverting the shared one.
- Commit messages: summary line, blank line, details; no attribution.

## 8. Commands

```sh
npm install
ln -s ~/dev/mame-runtume-ts/res/emsdk res/emsdk
mkdir -p .cache && ln -s ~/dev/mame-runtume-ts/.cache/mame0161-source .cache/mame0161-source
cp ~/dev/mame-runtume-ts/res/*.json ~/dev/mame-runtume-ts/res/*.lua res/   # private probe configs

# family build from the committed pair (W1's mode)
EMSDK_DIR="$PWD/res/emsdk" MAME_PROBE_KIND=family-pair scripts/probe-mame0161-tiny.sh neogeo

# threading gate on your artifact
npm run probe:mame:threading -- "$PWD/.cache/mame0161-source/<artifact-stem>"

npm run check && npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```

The preload config shape is §11.1; create yours under ignored `res/`
pointing at your lawful local zips. `serve-harness --preload` does not
exist yet (W13a), so your browser test serves its own files the way the
inherited probe tests do (see `tests/browser/01-mame-game-probe.test.ts`).
