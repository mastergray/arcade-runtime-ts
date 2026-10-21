# W14f merge note — `taito-16`

Status: ready for review. The clean-source production build completed, its
threading gate passed, and the repository typecheck, spec and available
browser suites are green. F4–F6 are explicitly pending the lawful private set
that was unavailable for this work package.

## Deliverables

- `mame/targets/taito-16.lua`: ten pinned driver groups, their adjacent
  machine/video units, shared Taito audio/IO/video-chip units, and the
  cross-block C-Chip and SETA dependencies used by Taito X.
- `mame/targets/taito-16.lst`: 189 public machines derived from the ten named
  MAME 0.161 driver sources.
- `mame/builds/taito-16.json`: 4,096-page production build input.
- `docs/probes/families/taito-16.md`: complete F1–F6 record, with F4–F6
  marked `pending private set` and their exact follow-up measurements.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, package file, spec section
or other family's files were changed. No integrator-owned line is needed. No
ROM content, private ROM identity, ROM hash or local path was added.

## Production artifact

A clean-source production build completed with:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-16 --jobs 4
```

```text
dist/mame/taito-16/
├── build.json                       4,377 bytes
├── mametaito-16.js                302,504 bytes
├── mametaito-16.wasm            6,914,238 bytes
├── notices/                           13 files, 561,238 aggregate bytes
└── romsets/                          189 files, 498,285 aggregate bytes
```

- Clean-source wall time: 177.14 seconds
- Machine count: 189
- Wasm bytes: 6,914,238
- buildId: `de2b2dca830115a17ae47617fbd8e9afc1769ae64f418d07452e9a0a7f8ee8a9`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,737,112 gzip-9 bytes and 1,291,336 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 12,124,160 bytes. Its
conservative 24,248,320-byte adapter estimate is 12.04% of the 201,326,592-byte
safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list matched the production `-listfull` count, so
no list correction was needed. Source inspection expanded §4.6's hardware
shorthand into the pinned core selections and compilation units. In
particular, Taito B requires the HD63484 video, EEPROM and MB87078 device
cores, while the selected drivers collectively require Z80, Z180, M68000,
YM2151, YM2203, YM2610/YM2610B, MSM5205 and OKIM6295.

The first link found two dependencies inherited by Taito X from the SETA
implementation: `video/seta.c` supplies `seta_state`'s no-layer renderer, and
the X1-010 sound core supplies the configured sound device. Adding that unit
and `SOUNDS["X1_010"]` resolved the undefined symbols. The final clean-source
build then completed without further correction. This is a target-level
dependency finding, not a spec or pipeline defect.

## Integrator follow-up

F4, F5 and F6 are `pending private set` because no `ARCADE_PRELOAD_CONFIG`
was available. Using an ignored lawful preload config and the throwaway
mechanics from `tests/browser/27-mame-adapter.test.ts`, record without
committing the selected ROM identity:

1. F4: Chromium wall-clock milliseconds from immediately before `callMain()`
   to the first valid frame for the slowest-starting family candidate,
   excluding file selection and transfer; include browser version and CPU.
2. F5: expected native upright width, height and refresh from public metadata,
   the first frame's delivered width and height, and observed emulated-frame
   rate plus percentage error under controlled 60, 90, 120 and 144 Hz
   cadences. Cover both an outlier-refresh title and a vertical title; every
   error must be at most 0.5%.
3. F6: `emulated seconds / wall seconds` over exactly 60 seconds after warm-up
   for the heaviest family title, on desktop and under Chromium's
   informational 4× CPU-throttled proxy; include browser version, CPU and
   whether frameskip was disabled.

There is one existing pipeline caveat for the integrator: after production
patches have been applied and MAME project generation has rewritten
`scripts/src/osd/modules.lua`, a subsequent `build-mame.ts` invocation against
that reused source cache can reject patch 0001 as neither wholly forward nor
wholly reversed. Moving aside the ignored source cache and unpacking a clean
one produces the successful deterministic build above. No out-of-scope script
or patch file was edited.

## Verification

- Production family build: passed; 189 machines and 189 ROM-set metadata files
- Explicit threading inspection: passed
- `npm run check`: passed
- `npm test`: 472 passed, 0 failed, 0 skipped
- `npm run test:browser`: 20 passed, 0 failed, 25 skipped; private production
  MAME cases skipped because no lawful preload config was available
