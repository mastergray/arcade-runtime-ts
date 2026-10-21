# W14c merge note — `namco-s1`

Status: ready for review. The pinned production build completed, its threading
gate passed, and the repository typecheck, spec suite and available browser
cases are green. F4–F6 are explicitly pending the lawful private set that was
unavailable for this work package.

## Delivered files

- `mame/targets/namco-s1.lua`
- `mame/targets/namco-s1.lst` — 47 entries derived from the two pinned driver
  sources
- `mame/builds/namco-s1.json` — 4,096 fixed-memory pages
- `docs/probes/families/namco-s1.md` — F1–F6 record
- One `namco-s1` row in `tests/spec/04-mame-family-targets.test.ts`

No integrator-owned source, package, manifest or spec line is needed. No ROM
content, private ROM identity, ROM hash or local path was added.

## Production artifact

The required production invocation completed in 155.4 seconds against the
newly unpacked source cache with warmed SDK and ports caches:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-s1 --jobs 4
```

```text
dist/mame/namco-s1/
├── build.json                         2,179 bytes
├── mamenamco-s1.js                  302,257 bytes
├── mamenamco-s1.wasm              5,015,128 bytes
├── notices/                              13 files; 561,238 aggregate bytes
└── romsets/                              47 files; 237,707 aggregate bytes
```

- Machine count: 47
- Wasm bytes: 5,015,128
- buildId: `e7c627cf9ffa14b6f747c898322bc80c2749df4642509d5341a9d342a4b8683c`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,437,407 gzip-9 bytes and 1,089,704 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 3,149,824 bytes. Its
conservative 6,299,648-byte adapter estimate is 3.13% of the 201,326,592-byte
safe budget, so no machine requires more than 4,096 pages.

## Target corrections

No post-build target or list correction was required: the first complete
source-derived target compiled and linked, and `-listfull` reported the same
47 machines as the independent driver-macro derivation.

Source inspection expanded §4.6's hardware shorthand before the build: the
HD63701 uses the M6800 core; the System 1 driver needs its adjacent machine
and video units plus the shared C116 video and C117 machine units; and the
System 86 games add their adjacent video unit and the Namco 63701X sound
core. The committed target also selects M6809, DAC, YM2151 and CUS30. These
are implementation details already covered by §4.6's “with their machine/
and video/ units” wording, so no spec correction is requested.

## Verification

- `npm run probe:mame:threading -- "$PWD/dist/mame/namco-s1/mamenamco-s1"`
  — pass
- `npm run check` — pass
- `npm test` — pass, 25 files and 472 cases, 0 failed, 0 skipped
- `npm run test:browser` — pass, 20 passed, 0 failed, 25 skipped; the
  production MAME cases skipped because no private preload config was
  available

## Integrator follow-up

F4, F5 and F6 are `pending private set`. Use an ignored lawful
`ARCADE_PRELOAD_CONFIG` and the throwaway browser mechanics described in
`docs/probes/families/namco-s1.md`. Record, without committing the selected
title or ROM identity:

1. F4: monotonic milliseconds from immediately before `callMain()` to the
   first valid frame for the slowest-starting available family title, plus
   Chromium/CPU and cache-state details.
2. F5: expected and delivered upright geometry for a lawful vertical family
   set, plus effective native refresh and percentage error under controlled
   60, 90, 120 and 144 Hz callback cadences; every error must be within 0.5%.
3. F6: the exact 60-second emulated-time ratio for the heaviest available
   lawful title on desktop and under Chromium's informational 4× CPU-throttled
   mobile proxy, with CPU, OS, Chromium, native refresh and frameskip details.
