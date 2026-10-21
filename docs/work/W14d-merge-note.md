# W14d merge note — `namco-s2`

Status: ready for review. The clean-source production build completed, its
threading gate passed, and the repository typecheck, spec and available
browser suites are green. F4–F6 are explicitly pending the lawful private set
that was unavailable for this work package.

## Deliverables

- `mame/targets/namco-s2.lua`: the four pinned CPU core groups, YM2151 and
  C140 sound, shared Namco IC implementation, System 2 machine/video units
  and C45 road-chip unit.
- `mame/targets/namco-s2.lst`: 54 public machines derived from the pinned
  `namcos2.c` driver source.
- `mame/builds/namco-s2.json`: 4,096-page production build input.
- `docs/probes/families/namco-s2.md`: complete F1–F6 record, with F4–F6
  marked `pending private set` and their exact follow-up measurements.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, package file or other
family's files were changed. No ROM content, private ROM identity, ROM hash or
local path was added.

## Production artifact

A clean-source production build completed with:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-s2 --jobs 4
```

```text
dist/mame/namco-s2/
├── build.json                       2,298 bytes
├── mamenamco-s2.js                302,079 bytes
├── mamenamco-s2.wasm            6,335,290 bytes
├── notices/                           13 files, 561,238 aggregate bytes
└── romsets/                           54 files, 341,387 aggregate bytes
```

- Clean-source wall time: 186.32 seconds
- Machine count: 54
- Wasm bytes: 6,335,290
- buildId: `b7e10d97b256c6756991a2448a4f22bed7f474b12bf377749c6e91b5f88ab376`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

## Target findings and corrections

The first complete target compiled and linked, so no post-build target
correction or link-error iteration was needed. Source inspection found one
path error in the brief and §4.6 shorthand: pinned MAME 0.161 stores the
shared implementation at `src/mame/drivers/namcoic.c`; there is no
`src/mame/machine/namcoic.c`. The committed target and build file use the
existing driver path. The integrator should correct the Namco S2 row in
§4.6, and the W14 family brief when it is next maintained; both are outside
this package's write set.

The M37450 implementation is selected by `CPUS["M6502"]`, while HD63705 uses
`CPUS["M6805"]`. The target also selects `M6809` and `M680X0`, matching the
four processors configured by the family driver.

F3 found a largest public metadata ROM sum of 13,779,200 bytes. Its
conservative 27,558,400-byte adapter estimate is 13.69% of the 201,326,592-byte
safe budget, so no machine requires more than 4,096 pages.

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
   cadences. Every error must be at most 0.5%.
3. F6: `emulated seconds / wall seconds` over exactly 60 seconds after warm-up
   for the heaviest family title, on desktop and under Chromium's
   informational 4× CPU-throttled proxy; include browser version, CPU and
   whether frameskip was disabled.

No other integrator-owned line is needed.

## Verification

- Production family build: passed; 54 machines and 54 ROM-set metadata files
- Explicit threading inspection: passed
- `npm run check`: passed
- `npm test`: 472 passed, 0 failed, 0 skipped
- `npm run test:browser`: 20 passed, 0 failed, 25 skipped; private production
  MAME cases skipped because no lawful preload config was available
