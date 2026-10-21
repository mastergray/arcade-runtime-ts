# W14b merge note — `namco-classic`

## Deliverables

- `mame/targets/namco-classic.lua`: eleven driver groups plus their pinned
  CPU, sound, machine, bus, video, audio and custom-chip dependencies.
- `mame/targets/namco-classic.lst`: 378 public machines, derived from the
  eleven named MAME 0.161 driver sources.
- `mame/builds/namco-classic.json`: 4,096-page production build input.
- `docs/probes/families/namco-classic.md`: F1–F6 record.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No integrator-owned source, package, manifest or spec line is needed.

## Production artifact

A clean-source production build completed with:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-classic --jobs 4
```

```text
dist/mame/namco-classic/
├── build.json                         7,317 bytes
├── mamenamco-classic.js             303,283 bytes
├── mamenamco-classic.wasm         7,439,583 bytes
├── notices/                              13 files
└── romsets/                             378 files
```

- Machine count: 378
- Wasm bytes: 7,439,583
- buildId: `efe5291ecacc7e9bf59a3d326df737fc0e7271a6f3d6090affd6a4b3250e0c94`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

Two clean-source full builds reproduced the machine count, Wasm byte size and
buildId exactly.

## Target and family-boundary findings

No post-build target correction was required: the first complete target
compiled and linked. Source inspection added dependencies that the matrix
summarizes rather than names individually: M68000 for `toypop.c`, I8255,
Digitalker and shared `audio/cclimber.c` for `galaxian.c`, shared `audio/timeplt.c`
audio for `rallyx.c`, and the Namco 06XX/50XX–54XX helpers.

The required comparison build without `galaxian.c` produced a 7,059,266-byte
Wasm (1,323,188 Brotli-11 bytes), versus 7,439,583 raw and 1,409,807
Brotli-11 for the full family. The full source adds 86,619 Brotli bytes, so
the probe keeps `galaxian-misc` folded into this family.

F3 found a largest public metadata ROM sum of 656,192 bytes. Its conservative
1,312,384-byte adapter estimate is 0.652% of the 201,326,592-byte safe
budget, so no machine requires more than 4,096 pages.

## Integrator follow-up

F4, F5 and F6 are `pending private set` because no `ARCADE_PRELOAD_CONFIG`
was available. The family probe record lists the exact later measurements:

1. Chromium milliseconds from `callMain()` to first valid frame for the
   slowest-starting lawful set.
2. Upright width/height and native-refresh error at controlled 60, 90, 120
   and 144 Hz cadences for a lawful vertical set; each error must be at most
   0.5%.
3. The 60-second emulated-time ratio for the heaviest lawful set on desktop
   and under the informational 4× CPU-throttled proxy.

There is one existing pipeline caveat for the integrator: after all production
patches have been applied to a reused source cache, a subsequent
`build-mame.ts` invocation can reject patch 0001 because patch 0002 inserted
an adjacent line into the same hunk. Clean source caches build successfully;
the two clean builds above prove deterministic output. This is not
family-target-specific, and no out-of-scope pipeline or patch file was edited.

## Verification

- `npm run check`: passed
- `npm test`: 453 passed, 0 failed, 0 skipped
- `npm run test:browser`: 19 passed, 0 failed, 25 skipped; the production
  MAME adapter cases skipped because no private preload config was available
- Explicit threading inspection: passed

