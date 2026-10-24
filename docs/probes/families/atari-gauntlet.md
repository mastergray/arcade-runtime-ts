# Atari 68010 four-player family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata steps. A lawful ignored preload config is present; its
private selection, archive identity, hashes and resolved paths are not
recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`atari-gauntlet.lua`](../../../mame/targets/atari-gauntlet.lua)
and [`atari-gauntlet.lst`](../../../mame/targets/atari-gauntlet.lst) pair
built through the production pipeline. The generated module completed the
ROM-free `-listfull` and `-listxml` paths, and both the pipeline and explicit
threading gates reported one fixed, non-shared 4,096-page memory with no
worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w27c-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-gauntlet/mameatari-gauntlet"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 114.92 s | 34.65 s | 28 | 28 |

The independently derived list contains 28 machines from
`drivers/gauntlet.c` and matched the production count without a list
correction. The target compiles only `drivers/gauntlet.c`,
`video/gauntlet.c`, `machine/atarigen.c`, `video/atarimo.c` and
`machine/slapstic.c`. It selects the M68000-family and M6502 CPU cores; the
board's YM2151, POKEY and TMS5220 sound cores; and the parallel EEPROM core.
It does not compile `audio/atarijsa.c`. The bridge already exposes four pads,
so this four-player board required no bridge change.

The first host-Node link exposed ER2055 and OKIM6295 references inside the
complete shared `machine/atarigen.c` object. Selecting those two cores, as the
existing Atari family target does, resolved the only undefined symbols; no
extra driver, audio or video unit was added.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helpers to host Node 22 while leaving the pinned C/C++ compiler,
optimizer, Binaryen, source, flags and production pipeline unchanged. The
resulting build identity is
`0796f6b5ede8d69c922314586bec2b2625553cf5f256d9aa71c2962e37e8afb6`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,975,125 | 1,545,906 | 1,159,827 |
| JavaScript | 302,199 | 65,612 | 55,312 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 1,213,696 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
2,427,392 bytes, 1.21% of the safe budget, leaving 198,899,200 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

F4–F6 pending: set incomplete. A privacy-safe audit of the lawful ignored
preload found one archive, 20 expected files, 19 valid files and one missing
required file under both strict and MAME-compatible policies. Per W27, no
replacement file was sought and the browser measurement was not started.

After the integrator supplies a complete lawful 0.161-compatible preload,
measure Chromium wall-clock milliseconds from immediately before
`adapter.start()` through the first valid, non-blank frame. Do not record the
configured machine, archive names, hashes or resolved paths.

## F5 — Are native refresh and upright geometry correct?

F4–F6 pending: set incomplete (one missing required file). With the completed
ignored preload, run the real adapter and record native refresh, expected and
observed upright geometry, first-frame non-blank status, and emulated-frame
rate under controlled 60, 90, 120 and 144 Hz cadences. Every cadence must stay
within the family gate.

## F6 — Does the four-player board sustain full speed?

F4–F6 pending: set incomplete (one missing required file). The desktop gate
remains open. After startup and warm-up with a completed ignored preload,
measure exactly 60 seconds of wall time and report emulated seconds divided by
wall seconds with frameskip disabled. Record the 4× CPU-throttled mobile proxy
ratio only if available; it is informational.

Run the browser measurements without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser
```
