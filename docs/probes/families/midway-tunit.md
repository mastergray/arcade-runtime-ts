# Midway T-Unit/Y-Unit family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata steps. A lawful ignored preload config selects a DCS board
from `drivers/midtunit.c`; no private selection, archive identity, hash or
resolved path is recorded here. F4–F6 were measured by the integrator on the
host after the agent's sandbox could not open a browser.

## F1 — Does the target pair compile and expose every machine?

The committed [`midway-tunit.lua`](../../../mame/targets/midway-tunit.lua)
and [`midway-tunit.lst`](../../../mame/targets/midway-tunit.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and both the pipeline and explicit threading
gates reported one fixed, non-shared 4,096-page memory with no worker or
pthread markers.

```sh
BASH_ENV="$PWD/.cache/w27b-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-tunit/mamemidway-tunit"
```

| Result | Initial compile to first link | Successful cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 102.60 s | 33.61 s | 66 | 66 |

The independently derived list contains 22 machines from `midtunit.c` and 44
from `midyunit.c`. It matched the production count without a list correction.
The combined count and successful link remain well within the established
family scope, and F2 shows a smaller artifact than the earlier single-driver
baselines, so the optional `midyunit.c` group stays in this package.

The target selects TMS34010, ADSP-2105, M6809 and the Y-Unit-only Z80 CPU
cores; DAC, DMA DAC, YM2151, HC55516 and OKIM6295 sound cores; the 6821 PIA;
both driver/machine/video groups; the Williams sound-board unit; and the DCS
unit from the upstream shared block. The harmless Centronics core keeps the
release-era bus archive non-empty. The first complete source compile found no
missing compilation unit or core, and no tracked target correction was needed.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored process-local `BASH_ENV` configuration sends Emscripten's JavaScript
compiler helpers to host Node 22 while leaving the pinned compiler, optimizer,
Binaryen, source, flags and build pipeline unchanged. The resulting build
identity is
`7064c4a67ab369540a5d1a2162454da5b7c568734d2f7c145f8f7d84b239bbec`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,676,009 | 1,534,364 | 1,150,906 |
| JavaScript | 301,920 | 65,590 | 55,328 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 16,777,216 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
33,554,432 bytes, 16.67% of the safe budget, leaving 167,772,160 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-23 (Chrome 150, Core i7-1165G7,
headless) with the ignored DCS-board preload: 719 ms from immediately before
`adapter.start()` to the first valid, non-blank frame. The host was also
serving a hand-test session at the time, so the figure is an upper bound.
The agent's sandbox audit of the same preload passed under both strictness
policies (one archive, 20 expected files, nothing missing or wrong).

## F5 — Are native refresh and upright geometry correct?

Native refresh 54.707 Hz, horizontal, 400×254; every delivered frame was
400×254 and the first frame was non-blank. Cadences: 60 Hz → 54.66 fps
(−0.08 %), 90 Hz → 54.91 fps (+0.37 %), 120 Hz → 54.64 fps (−0.12 %),
144 Hz → 54.91 fps (+0.37 %), all inside the 1 % gate.

## F6 — Does the DCS board sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0001 over 60 s, frameskip
disabled, with the TMS34010 video CPU, the ADSP-2105 DCS sound DSP and the
M6809 running together. M3–M5 acceptance on the same run: audio queue peak
58.7 ms against the 120 ms cap, keyboard coin and start reached play, two
pads assigned and released. The 4× CPU-throttled mobile proxy was not run;
it is informational and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

The agent's sandbox attempt could not bind loopback (`listen EPERM`); the
integrator's run on the host completed 32 passed, 0 failed, 25 skipped by
design.
