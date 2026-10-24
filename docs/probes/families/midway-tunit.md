# Midway T-Unit/Y-Unit family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata steps. A lawful ignored preload config selects a DCS board
from `drivers/midtunit.c`; no private selection, archive identity, hash or
resolved path is recorded here.

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

Pending integrator browser run. The ignored DCS-board preload audits cleanly
under both strict and MAME-compatible policies: one supplied archive, 20
expected files, and zero missing, wrong-size, wrong-CRC, optional-missing,
warning or archive-problem entries. The sandbox browser run stopped before
page creation because the shared server could not bind loopback (`listen
EPERM`), so a first frame and its non-blank status remain unconfirmed.

On a host that permits loopback and Chromium, measure milliseconds from
immediately before `adapter.start()`/`callMain()` until the first valid frame
and until the first non-blank frame. Record browser version and desktop CPU
without recording the private selection.

## F5 — Are native refresh and upright geometry correct?

Pending integrator browser run for the same sandbox reason. Record the DCS
board's public native upright width, height and refresh, the first delivered
frame geometry, and observed emulated-frame rate plus percentage error at
controlled 60, 90, 120 and 144 Hz cadences. Every cadence must remain within
the repository gate and at least one delivered frame must be non-blank.

## F6 — Does the DCS board sustain full speed?

Pending integrator browser run; this is the family's gate. After warm-up,
measure exactly 60 seconds and report `emulated seconds / wall seconds` on
desktop with frameskip disabled. Repeat under Chromium's 4× CPU-throttled
mobile proxy as informational evidence.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

The agent's sandbox run completed 0 passed, 32 failed and 25 skipped; every
runnable case stopped at `listen EPERM: operation not permitted 127.0.0.1`.
