# Midway T-Unit/Y-Unit/Wolf Unit family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata steps. A lawful ignored preload config selects a board from
`drivers/midwunit.c`; no private selection, archive identity, hash or resolved
path is recorded here. The sandbox could not bind the browser test server, so
the new driver's F4–F6 measurements remain pending for the integrator.

## F1 — Does the target pair compile and expose every machine?

The extended [`midway-tunit.lua`](../../../mame/targets/midway-tunit.lua) and
[`midway-tunit.lst`](../../../mame/targets/midway-tunit.lst) pair built through
the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and both the pipeline and explicit threading
gates reported one fixed, non-shared 4,096-page memory with no worker or
pthread markers.

```sh
BASH_ENV="$PWD/.cache/w28e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-tunit/mamemidway-tunit"
```

| Result | Successful extension pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------: | ---------------------: |
| Pass | 35.20 s | 82 | 82 |

The independently derived list contains 22 machines from `midtunit.c`, 44
from `midyunit.c` and 16 from `midwunit.c`. It matched the production count,
so no list correction was needed. The derivation header now names all three
driver sources.

Wolf Unit reuses the family's TMS34010, ADSP-2105, DCS sound and shared
`video/midtunit.c` paths. Its two named driver units compile alongside
`machine/midwayic.c`, which implements the serial security PIC configured by
`midwunit.c`; that upstream source dependency was the only addition beyond
the work-package pair. No selectable CPU, sound or machine core had to be
added. The resulting build identity is
`e108a9f0b3a844b901a7e0a771922917e53545292db178651abe4c9d5091aaea`.

The first pre-extension link reproduced the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams after
135.77 seconds. The established ignored `BASH_ENV` compatibility config sends
Emscripten's JavaScript helpers to host Node 22 while leaving the pinned
compiler, native optimizer, Binaryen, source, flags and production pipeline
unchanged. A successful pre-extension pipeline then completed in 33.98
seconds before the extension was applied.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact after extension | Raw bytes | gzip -9 | Brotli 11 |
| ------------------------ | --------: | -------: | ---------: |
| Wasm | 5,729,853 | 1,548,970 | 1,160,679 |
| JavaScript | 301,920 | 65,587 | 55,323 |

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 5,676,014 | 1,534,350 | 1,151,484 |
| After extension | 5,729,853 | 1,548,970 | 1,160,679 |
| Increase | 53,839 (0.95%) | 14,620 (0.95%) | 9,195 (0.80%) |

The increase is paid by every title already in this family build; the pending
F6 result decides whether the added board remains worth that download cost.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 26,214,400 bytes in `midwunit.c`. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

The standard metadata-only two-copy estimate is 52,428,800 bytes, 26.04% of
that budget. A stricter source cross-check counts the driver's declared 8 MiB
DCS, 1 MiB program and 32 MiB graphics regions in addition to the supplied
ROM bytes: 69,206,016 bytes, 34.38% of the safe budget, leaving 132,120,576
bytes.

Wolf Unit does not decode the whole graphics region into expanded gfx
elements at boot: `video/midtunit.c` reads the compressed graphics ROM region
directly and performs the selected DMA operation into video RAM as the board
requests it. The regions have neither `ROMREGION_DISPOSE` nor a `GFXDECODE`
table. No family machine fails the estimate and there is no source-level sign
of the large boot-time sprite expansion that invalidated the metadata model
for another wave-3 family, so the build remains at 4,096 pages. If the
integrator's real browser run nevertheless reports the adapter's
`MEMORY_EXCEEDED` error, rebuild with `memoryPages: 8192` and repeat F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7,
headless, quiet host) with the ignored preload for the Wolf Unit extension: 652 ms from
immediately before `adapter.start()` to the first valid, non-blank frame.

## F5 — Are native refresh and upright geometry correct?

400×254 horizontal at 54.707 Hz; every frame that size and the first frame non-blank. Cadences:
60 Hz → 54.66 fps (−0.08 %), 90 Hz → 54.60 fps (−0.20 %), 120 Hz → 54.66 fps (−0.09 %), 144 Hz → 54.85 fps (+0.27 %), all inside the 1 % gate.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0000 over 60 s, frameskip
disabled. M3–M5 acceptance on the same run: audio queue peak 58.7 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

The integrator's host run completed 32 passed, 0 failed, 25 skipped by design.
