# Sega System 32/Multi 32 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private identity or archive path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`sega-s32.lua`](../../../mame/targets/sega-s32.lua) and
[`sega-s32.lst`](../../../mame/targets/sega-s32.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s32 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-s32/mamesega-s32"
```

| Result | Initial compile to link | Successful cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------: | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 107.97 s | 34.16 s | 52 | 52 |

The independently derived list contains 52 machines from `segas32.c`. It
matched the production count without a list correction. The target selects
the V60/V70, Z80 and NEC V25 protection MCU cores; YM3438, RF5C68 and
MultiPCM sound cores; serial EEPROM; the driver, machine and video units;
and the adjacent 315-5296 I/O implementation named by the pinned Sega source
block. No compilation-unit, selectable-core or machine-list correction was
needed.

The sandbox's captured stdio is incompatible with the toolchain's bundled
Node 8 at the final JavaScript compiler step. The successful invocation used
an ignored process-local `BASH_ENV` that selected host Node 22 for Emscripten
JavaScript helpers only. The pinned C/C++ compiler, native optimizer,
Binaryen, source, flags and build pipeline remained unchanged. The resulting
build identity is
`6fd71b24330fd8f100cd2d8f25443b1004f912f3d3a5f0dde9a4f470cf15b795`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,590,571 | 1,511,118 | 1,136,779 |
| JavaScript | 302,356 | 65,603 | 55,345 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 27,000,832 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
54,001,664 bytes, 26.82% of the safe budget, leaving 147,324,928 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

F4 pending: sandbox browser unavailable. The ignored preload audited `ok`
under both strict and MAME-compatible policies, with one archive present, all
19 expected files valid, zero missing, wrong-size, wrong-CRC or
optional-missing entries, zero warnings and archive problems, and 11 harmless
unexpected entries. The browser run then stopped at the sandbox's loopback
`listen EPERM` before page creation, so no first-frame time or non-blank-frame
confirmation is available.

## F5 — Are native refresh and upright geometry correct?

F5 pending: sandbox browser unavailable. Geometry and controlled
60/90/120/144 Hz cadence measurements require the same real-browser run that
loopback policy prevented. The ignored selection carries
`GAME_IMPERFECT_GRAPHICS` in the pinned `segas32.c`; this is MAME 0.161's own
driver flag and is not a browser-port defect. The integrator should preserve
that distinction when recording the visual result.

## F6 — Does the heaviest title sustain full speed?

F6 pending: sandbox browser unavailable. No desktop emulated-time ratio was
measured, so the performance gate remains open; the family is built but is not
yet classified as passing or "built, below the gate." If the host measurement
misses the desktop gate, record the measured ratio plainly and leave this
family out of the 1.0.0 matrix. The 4× CPU-throttled mobile proxy is
informational and was not run.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s32.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s32.json" \
  npm run test:browser
```

The sandbox attempt completed 0 passed, 32 failed and 25 skipped by design;
every runnable case stopped at `listen EPERM` before Chromium page creation.
