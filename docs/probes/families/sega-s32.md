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

Measured by the integrator on 2026-10-23 (Chrome 150, Core i7-1165G7,
headless, host load average about 5 from unrelated daemons) with the ignored
System 32 preload, which audits ok under both policies: 940 ms and 869 ms on
two runs from immediately before `adapter.start()` to the first valid,
non-blank frame. The V60 board boots through its protection MCU, so this is
the second-slowest start in the matrix after the Gauntlet board.

## F5 — Are native refresh and upright geometry correct?

Native refresh 60.000 Hz, horizontal. The boot mode is 416×224 and the board
switches to 320×224 during play; the bridge and `ArcadeDisplay` follow each
frame's own size, so the measurement records the sizes seen
(416×224/320×224) and asserts that every frame carries a valid size (the M1
acceptance was relaxed the same way as the family measurement had been for
System 18). First frame non-blank. Cadences on the confirming run: 60 Hz →
60.10 fps (+0.17 %), 90 Hz → 59.87 fps (−0.21 %), 120 Hz → 59.88 fps
(−0.20 %), 144 Hz → 60.14 fps (+0.24 %), all inside the 1 % gate (the first
run overshot 60 Hz by 1.21 % on the loaded host). The set carries MAME's own
`GAME_IMPERFECT_GRAPHICS` flag in 0.161; that is upstream's note on the
driver, not a port defect.

## F6 — Does the heaviest board sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0000 and 0.9999 over 60 s on
the two runs, frameskip disabled, with the 16 MHz V60, the Z80 sound CPU and
the V25 protection MCU all running. The family ships in the 1.0.0 matrix.
M3–M5 acceptance on the same runs: audio queue peak 93 ms and 71 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Known failing gate case for this preload: the harness quick-save case. MAME
0.161 declines the save for this driver (no `GAME_SUPPORTS_SAVE`; the
scheduler reports pending anonymous timers), the bridge reports the failure
and the harness shows it, so the case times out waiting for success. Filed
as M35 (expose the driver's save-support flag through `MachineInfo`).

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s32.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s32.json" \
  npm run test:browser
```

The integrator's confirming run on the host completed 31 passed, 1 failed
(the quick-save case above), 25 skipped by design.
