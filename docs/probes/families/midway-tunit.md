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

For the new `midwunit.c` title, F4 is pending. The sandbox browser suite
stopped before Chromium page creation because binding `127.0.0.1` returned
`EPERM`; no first frame arrived and non-blank output is not yet confirmed.
The privacy-safe preload audit passed in both strict and MAME-compatible modes:
one archive present, all 26 expected files valid, zero missing, wrong-size,
wrong-CRC or optional-missing files, zero warnings and problems, and 29
harmless unexpected entries.

The earlier `midtunit.c` DCS-board measurement remains valid family evidence:
719 ms to a non-blank first frame on the desktop reference host.

## F5 — Are native refresh and upright geometry correct?

For the new `midwunit.c` title, F5 is pending for the same loopback-policy
reason. The integrator must record its native geometry and refresh, confirm
that the first delivered frame is non-blank and upright, and measure the
60/90/120/144 Hz controlled cadences.

The earlier `midtunit.c` measurement remains valid: 400×254 horizontal at
54.707 Hz, every delivered frame at native geometry, with 60 Hz → 54.66 fps
(−0.08%), 90 Hz → 54.91 fps (+0.37%), 120 Hz → 54.64 fps (−0.12%) and
144 Hz → 54.91 fps (+0.37%).

## F6 — Does the heavier Wolf Unit board sustain full speed?

For the new `midwunit.c` title, F6 is pending. No 60-second desktop ratio was
available because the sandbox could not start the browser server, so final
retention of the extension remains open. The earlier `midtunit.c` DCS-board
ratio was 1.0001 over 60 seconds with frameskip disabled.

The new driver uses the same DCS board and its configured title declares
ordinary DIP switches and `GAME_SUPPORTS_SAVE`; the EEPROM/no-DIP and
unsupported quick-save exceptions do not apply. M33 still applies: the DCS
output level is a CMOS setting controlled by cabinet volume buttons that the
runtime does not yet expose, so low audio volume is expected and is not a
Wolf Unit emulation failure.

Run the pending measurements without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

The sandbox attempt completed 0 passed, 32 failed and 25 skipped by design;
every runnable case failed at `listen EPERM: operation not permitted
127.0.0.1`. On a host that permits loopback and Chromium, copy only the
privacy-safe F4–F6 measurements into this record. If the desktop ratio misses
the gate, state the measured ratio plainly and decide whether to remove the
extension.
