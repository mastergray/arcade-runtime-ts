# Taito classic family probe

Observed 2026-10-20 on Linux x86-64 with an Intel Core i7-1165G7,
Node.js 22.22.2, npm 10.9.7, GNU gzip 1.10, the pinned MAME 0.161 source
archive and Emscripten 1.38.31. No ROM content was supplied to the build or
metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`taito-classic.lua`](../../../mame/targets/taito-classic.lua)
and [`taito-classic.lst`](../../../mame/targets/taito-classic.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-classic/mametaito-classic"
```

| Result | Clean-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------: | -------------------: | ---------------------: |
| Pass | 212.14 s | 148 | 148 |

The machine count equals the independent derivation from all thirteen driver
sources: 24 from `taitosj.c`, 14 from `bublbobl.c`, 25 from `arkanoid.c`, 27
from `tnzs.c`, 17 from `slapfght.c`, six from `flstory.c`, seven from
`lkage.c`, three from `retofinv.c`, four from `nycaptor.c`, two from
`buggychl.c`, five from `gladiatr.c`, five from `mexico86.c` and nine from
`superqix.c`. No list correction was needed.

Source inspection expanded §4.6's shorthand with the M6809 CPU used by
the `gladiatr.c` set, the MCS51 core used by the `superqix.c` I8751, and the YM2151, MSM5205,
MSM5232 and SN76496 sound cores used across the selected units. It also added
the Taito 8741 machine helper and the SETA001 sprite unit. The first complete
compile then exposed one target correction at link time: `slapfght.c` uses
`BUFFERED_SPRITERAM8`, so the target needed the `BUFSPRITE` video core. The
corrected clean-source build passed.

The resulting build identity is
`a0128bde90e702fa599aea35cd9dc24c1f94d730cd2848c6dcbef4222277c11b`.

## F2 — What are the raw, gzip and Brotli download sizes?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| `mametaito-classic.wasm` | 5,978,352 | 1,628,206 | 1,220,266 |
| `mametaito-classic.js` | 303,449 | 65,670 | 55,344 |

## F3 — Does the largest ROM set fit in 4,096 pages?

Summing the public ROM sizes in every generated metadata file finds
`kabukiz` largest, tied with its clone, at 2,424,832 bytes (2.3125 MiB). The
safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata estimate of 4,849,664 bytes
(4.625 MiB), 2.41% of the safe budget, leaving 196,476,928 bytes
(187.375 MiB). These drivers do not describe an additional whole-ROM
decrypted copy. No machine in the family fails the §5 estimate, so the build
remains at 4,096 pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending private set

The integrator must use an ignored `ARCADE_PRELOAD_CONFIG` for a lawful set
and a throwaway adaptation of `tests/browser/27-mame-adapter.test.ts`. For the
slowest-starting available family title, record monotonic wall-clock
milliseconds from immediately before `callMain()` to the first valid
`onFrame` callback, including machine initialization but excluding file
selection and network transfer. Record Chromium version, desktop CPU and
whether the module and HTTP caches were cold or warm.

## F5 — Does native refresh hold, and is vertical geometry upright?

pending private set

The integrator must use a lawful vertical family set and record its expected
native upright width, height and refresh from public MAME metadata. Record the
first frame's width and height, machine-reported orientation, and whether a
stable frame is upright. Then run controlled 60, 90, 120 and 144 Hz callback
cadences and report the observed emulated-frame rate and percentage error at
each cadence; every rate must be within 0.5% of native refresh.

## F6 — Does the heaviest title sustain full speed?

pending private set

The integrator must use a lawful set for the family's heaviest available
title. After startup and a warm-up interval, measure exactly 60 seconds of
wall time and report `(onTick count / native refresh Hz) / wall-clock seconds`
on desktop; repeat under Chromium's 4× CPU-throttled mobile proxy and report
the same ratio as informational evidence. Record CPU, OS, Chromium version,
native refresh, both ratios and whether frameskip was disabled. Desktop full
speed is the family gate.
