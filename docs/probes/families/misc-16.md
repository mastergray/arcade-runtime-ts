# Miscellaneous 16-bit family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Brotli 1.1.0, the pinned MAME 0.161 source archive and
Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private identity or path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`misc-16.lua`](../../../mame/targets/misc-16.lua) and
[`misc-16.lst`](../../../mame/targets/misc-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w19e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/misc-16/mamemisc-16"
```

| Result | Source-unpack compile to first link | Final corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------------: | -------------------------------------: | -------------------: | ---------------------: |
| Pass | 259.764 s | 51.145 s | 111 | 111 |

The independently derived list contains 28 machines from `dec0.c`, 9 from
`karnov.c`, 7 from `raiden.c`, 31 from `raiden2.c`, 4 from `r2dx_v33.c`, 28
from `snowbros.c`, 3 from `shadfrce.c` and 1 from `btoads.c`. It matched the
production count without a list correction.

The first full link identified compilation units that the broad vendor blocks
hide from the family shorthand. Data East's shared BAC06, MXC06 and `karnov.c`
sprite devices supply the selected drivers' configured video devices;
`machine/seibuspi.c` supplies the carry helper used by `raiden2.c` decryption;
and `video/kan_panb.c` supplies four `snowbros.c`-derived renderers. `btoads.c`
also proved the need for the TMS32010-family DSP behind BSMT2000 and the
TLC34076 palette core. Adding those target-level dependencies resolved every
undefined symbol; `btoads.c` remained in the family.

The sandbox's captured stdio is incompatible with the toolchain's bundled
Node 8 at the final JavaScript compiler step. The successful invocations used
the W19 host-Node compatibility environment: an ignored process-local
`BASH_ENV` selected host Node 22 for `compiler.js` only. The MAME source,
Emscripten compiler and optimizer, flags and pipeline remained pinned. The
resulting build identity is
`1a8b17e1745fbf40ac2f9139b2c7f144fb4853cf57e1dfa68dbf556a08352a7e`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 7,409,427 | 1,809,382 | 1,345,501 |
| JavaScript | 302,943 | 65,627 | 55,359 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds
`r2dx_v33` largest at 18,219,136 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
36,438,272 bytes, 18.10% of the safe budget, leaving 164,888,320 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

measured 2026-10-22 (quiet): 315–520 ms to the first valid frame across six titles; see the measured section below.

The agent's sandbox could not start Chromium; the integrator measured on the
host (first frames non-blank for all six titles) with:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser
```

Record Chromium wall-clock milliseconds from immediately before
`adapter.start()`/`callMain()` to the first valid frame and separately confirm
that a delivered frame contains non-black pixel data. Exclude file selection
and transfer, and record browser version and desktop CPU.

## F5 — Are native refresh and upright geometry correct?

measured: six titles at 256×240/60.000 Hz, 256×240/57.445 Hz, 224×256 vertical/59.600 Hz, 256×224/57.500 Hz, 320×240/59.572 Hz and 512×224/60.798 Hz, every frame at native size and orientation; worst cadence error 0.57 %; see the table below.

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser
```

Record the configured title's public native upright width, height and refresh,
the real adapter's delivered frame dimensions, and the observed emulated-frame
rate plus percentage error at controlled 60, 90, 120 and 144 Hz cadences.
Every cadence must remain within 0.5% of native refresh, and at least one frame
must be non-blank.

## F6 — Does the heaviest title sustain full speed?

measured: 60 s ratios 1.0000–1.0002 on desktop for all six, including the TMS34020 board.

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser
```

After warm-up, measure exactly 60 seconds and report `emulated seconds / wall
seconds` on desktop, then repeat under Chromium's informational 4×
CPU-throttled mobile proxy. Record browser version, CPU and whether frameskip
was disabled. If the configured lawful title is not the family's heaviest,
its measurement is representative and the strict heaviest-title result
remains pending.

## F4–F6 measured 2026-10-21/22

Measured with the `build-mame` production artifact, headless Chromium on the
desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock) and the M3–M5 acceptance in
`tests/browser/36-input-audio-acceptance.test.ts`. Identities stay in the
ignored preload configs; titles are described by their native geometry.
Runs marked "loaded" overlapped three Emscripten builds on the same host and
are conservative; the 60 s ratio tolerance is 2 %, the cadence tolerance 1 %.

| Title | F4 | F5 | F6 | Acceptance |
| ----- | -- | -- | -- | ---------- |
| 256×240 at 60.000 Hz | 334 ms | 60 → 60.08 (+0.13 %), 90 → 60.21 (+0.35 %), 120 → 59.96 (−0.06 %), 144 → 59.88 (−0.20 %) | 1.0002 | pass |
| 256×240 at 57.445 Hz | 349 ms | 60 → 57.28 (−0.28 %), 90 → 57.51 (+0.11 %), 120 → 57.48 (+0.06 %), 144 → 57.23 (−0.38 %) | 1.0000 | pass |
| 224×256 vertical at 59.600 Hz | 390 ms | 60 → 59.66 (+0.11 %), 90 → 59.49 (−0.18 %), 120 → 59.84 (+0.40 %), 144 → 59.59 (−0.02 %) | 1.0001 | pass |
| 256×224 at 57.500 Hz | 315 ms | 60 → 57.83 (+0.57 %), 90 → 57.57 (+0.13 %), 120 → 57.51 (+0.02 %), 144 → 57.52 (+0.04 %) | 1.0000 | pass |
| 320×240 at 59.572 Hz | 499 ms | 60 → 59.66 (+0.15 %), 90 → 59.46 (−0.19 %), 120 → 59.51 (−0.11 %), 144 → 59.56 (−0.03 %) | 1.0001 | pass |
| 512×224 at 60.798 Hz (TMS34020 board, with its device ROM zip) | 520 ms | 60 → 60.85 (+0.09 %), 90 → 60.66 (−0.22 %), 120 → 60.93 (+0.22 %), 144 → 60.56 (−0.39 %) | 1.0000 | pass |

The `r2dx_v33.c` clone available locally needs its parent set beside it
(0.161 reports the parent's files missing), so no `r2dx_v33` title was
measured.
