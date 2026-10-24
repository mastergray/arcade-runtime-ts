# Atari 68010 raster family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata steps. A lawful ignored preload config selects a machine
from `toobin.c`; its private identity, archive identity, hashes and resolved
paths are not recorded here.

## F1 — Does the target pair compile and expose every machine?

The extended [`atari-gauntlet.lua`](../../../mame/targets/atari-gauntlet.lua)
and [`atari-gauntlet.lst`](../../../mame/targets/atari-gauntlet.lst) pair
built through the production pipeline. The generated module completed the
ROM-free `-listfull` and `-listxml` paths, and both the pipeline and explicit
threading gates reported one fixed, non-shared 4,096-page memory with no
worker or pthread markers.

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28f-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-gauntlet/mameatari-gauntlet"
```

| Result | Extended cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ------------------------------: | -------------------: | ---------------------: |
| Pass | 27.41 s | 34 | 34 |

The independently derived list contains 28 machines from `gauntlet.c` and
six from `toobin.c`. Its 34 entries exactly matched production `-listfull`,
so no list correction was needed. The extension compiles `drivers/toobin.c`,
`video/toobin.c` and the JSA implementation in `audio/atarijsa.c`. The JSA-I
configuration reuses the target's existing M6502, YM2151, POKEY and TMS5220
cores; the board also reuses the M68000-family CPU, Atari EEPROM, motion-object
and shared `atarigen.c` units. The existing OKIM6295 selection remains needed
because the complete JSA implementation defines its later variants in the
same compilation unit. No additional selectable core was required.

The first unshimmed baseline compile reached the final link after 136.21 s,
where the SDK's bundled Node 8 stopped with `ERR_UNKNOWN_STREAM_TYPE` on the
captured process streams. An ignored worktree-local `BASH_ENV` configuration
then selected host Node 22 for Emscripten's JavaScript helpers only; the pinned
C/C++ compiler, native optimizer, Binaryen, source, flags and production
pipeline remained unchanged. The resulting extended build identity is
`221f082cf26c46c25b0b78fd94774ec28ada3d2d2a8dfc99618bc09be8992e7c`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact after extension | Raw bytes | gzip -9 | Brotli 11 |
| ------------------------ | --------: | -------: | ---------: |
| Wasm | 6,016,749 | 1,557,498 | 1,167,957 |
| JavaScript | 302,199 | 65,611 | 55,333 |

The same worktree and pipeline measured the unextended 28-machine Wasm at
5,975,125 raw, 1,545,906 gzip-9 and 1,159,995 Brotli-11 bytes. Adding
`toobin.c` therefore costs 41,624 raw bytes (0.70%), 11,592 gzip bytes
(0.75%) and 7,962 Brotli bytes (0.69%) for every consumer of this family.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
whole-family set sum of 2,703,360 bytes among the added driver's machines. The
safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
5,406,720 bytes, 2.69% of the safe budget, leaving 195,919,872 bytes. No
family machine fails the §5 estimate, so the build remains at 4,096 pages.

`toobin.c` does decode graphics regions: its layouts cover a 512 KiB
playfield region, a 2 MiB motion-object region and a 16 KiB alpha region.
That startup expansion is materially smaller than the available margin, and
the sandbox browser attempt failed before module startup rather than aborting
for memory. If the integrator's host run reports the adapter's “needs more
memory” error, the prescribed correction is `memoryPages: 8192` followed by a
family rebuild and repeat of F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7,
headless, quiet host) with the ignored preload for the toobin.c extension: 407 ms from
immediately before `adapter.start()` to the first valid, non-blank frame.

## F5 — Are native refresh and upright geometry correct?

384×512 vertical at 60.096 Hz; every frame that size and the first frame non-blank. Cadences:
60 Hz → 60.00 fps (−0.16 %), 90 Hz → 60.00 fps (−0.16 %), 120 Hz → 60.03 fps (−0.11 %), 144 Hz → 60.20 fps (+0.18 %), all inside the 1 % gate.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0001 over 60 s, frameskip
disabled. M3–M5 acceptance on the same run: audio queue peak 77 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser
```

The integrator's host run completed 32 passed, 0 failed, 25 skipped by design.

## Existing-driver browser evidence retained

The family's earlier `gauntlet.c` preload was measured by the integrator on
2026-10-23 through the real adapter. F4 reached its first valid non-blank frame
in 1,151 ms. F5 delivered horizontal 336×240 frames at 59.923 Hz; 60, 90, 120
and 144 Hz cadence errors were +0.35%, −0.13%, −0.05% and +0.35%. F6 sustained
a 1.0001 desktop ratio over 60 seconds. These results remain valid for that
driver, but they do not substitute for the new `toobin.c` measurements above.
