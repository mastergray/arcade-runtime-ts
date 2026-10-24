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

Measured by the integrator on 2026-10-23 (Chrome 150, Core i7-1165G7,
headless) with the ignored preload, after the private archive had been
completed for 0.161 (its newer 16 KiB graphics dump split to the pinned
8 KiB file and the missing PROM added; audit ok under both policies): 1151 ms
from immediately before `adapter.start()` to the first valid, non-blank
frame. The board's slapstic and EEPROM start-up and the host serving a
hand-test session at the time both contribute; it is the slowest F4 so far
but well inside the gate.

## F5 — Are native refresh and upright geometry correct?

Native refresh 59.923 Hz, horizontal, 336×240; every delivered frame was
336×240 and the first frame was non-blank. Cadences: 60 Hz → 60.13 fps
(+0.35 %), 90 Hz → 59.85 fps (−0.13 %), 120 Hz → 59.89 fps (−0.05 %),
144 Hz → 60.13 fps (+0.35 %), all inside the 1 % gate.

## F6 — Does the board sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0001 over 60 s, frameskip
disabled. M3–M5 acceptance on the same run: audio queue peak 76 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser
```

The integrator's run on the host completed 32 passed, 0 failed, 25 skipped
by design.
