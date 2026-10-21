# Namco System 1 family probe

Observed 2026-10-20 on Linux x86-64 with an Intel Core i7-1165G7,
Node.js 22.22.2, npm 10.9.7, GNU gzip 1.10, the pinned MAME 0.161 source
archive and Emscripten 1.38.31. No ROM content was supplied to the build or
metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`namco-s1.lua`](../../../mame/targets/namco-s1.lua) and
[`namco-s1.lst`](../../../mame/targets/namco-s1.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-s1 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-s1/mamenamco-s1"
```

| Result | Wall time | `-listfull` machines | ROM-set metadata files |
| ------ | --------: | -------------------: | ---------------------: |
| Pass | 155.4 s | 47 | 47 |

The source tree was already unpacked, and the SDK and ports cache were warm;
the measured command applied patches and performed the complete family
compile, link and metadata pipeline. The machine count equals the independent
derivation from the two driver sources: 38 entries from `namcos1.c` and nine
from `namcos86.c`.

The first full compile and link succeeded, so no post-build Lua or list
correction was needed. Source inspection before the build expanded §4.6's
shorthand to include the M6800 core used by the HD63701 MCU, the C116 video
and C117 machine units, and the 63701X sound core used by part of the System
86 set. The target also includes each driver's adjacent machine and video
unit and the required DAC, YM2151 and CUS30 sound cores.

The resulting build identity is
`e7c627cf9ffa14b6f747c898322bc80c2749df4642509d5341a9d342a4b8683c`.

## F2 — What are the raw, gzip and Brotli download sizes?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| `mamenamco-s1.wasm` | 5,015,128 | 1,437,407 | 1,089,704 |
| `mamenamco-s1.js` | 302,257 | 65,592 | 55,383 |

## F3 — Does the largest ROM set fit in 4,096 pages?

Summing the public ROM sizes in every generated metadata file finds
`splatter` largest, tied with its two clones at 3,149,824 bytes. The safe
adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata estimate of 6,299,648 bytes
(6.01 MiB), 3.13% of the safe budget, leaving 195,026,944 bytes (185.99 MiB).
The drivers do not describe an additional whole-ROM decrypted copy. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending private set

The integrator must use an ignored `ARCADE_PRELOAD_CONFIG` for a lawful set
and a throwaway adaptation of `tests/browser/27-mame-adapter.test.ts`. For the
slowest-starting available family title, record monotonic wall-clock
milliseconds from immediately before `callMain()` to the first valid
`onFrame` callback, including machine initialization but excluding file
selection and network transfer. Record the Chromium version, desktop CPU and
whether the module and HTTP caches were cold or warm.

## F5 — Are native refresh and upright geometry correct?

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
