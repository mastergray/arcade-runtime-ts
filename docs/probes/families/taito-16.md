# Taito 16-bit family probe

Observed 2026-10-20 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`taito-16.lua`](../../../mame/targets/taito-16.lua) and
[`taito-16.lst`](../../../mame/targets/taito-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-16/mametaito-16"
```

| Result | Clean-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------: | -------------------: | ---------------------: |
| Pass | 177.14 s | 189 | 189 |

The machine count equals the independently derived total from all ten driver
sources, and the list needed no correction. Source inspection included each
driver's adjacent machine/video units, the shared Taito chip units from the
pinned `mame.lua`, the C-Chip implementation used by Taito X, and its
cross-block SETA001 sprite implementation. The first link then exposed two
remaining Taito X dependencies: SETA's inherited no-layer renderer and the
X1-010 sound device. Adding `video/seta.c` and the `X1_010` sound core resolved
those undefined symbols; a clean build then passed.

The resulting build identity is
`de2b2dca830115a17ae47617fbd8e9afc1769ae64f418d07452e9a0a7f8ee8a9`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,914,238 | 1,737,112 | 1,291,336 |
| JavaScript | 302,504 | 65,605 | 55,371 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds
`dinorex` largest at 12,124,160 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
24,248,320 bytes, 12.04% of the safe budget, leaving 177,078,272 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending private set

The integrator must use an ignored `ARCADE_PRELOAD_CONFIG` for a lawful set
and the mechanics from `tests/browser/27-mame-adapter.test.ts`. For the
slowest-starting family candidate, record Chromium wall-clock milliseconds
from immediately before `callMain()` to the first valid `onFrame` callback,
including machine initialization but excluding file selection and network
transfer. Record the browser version and desktop CPU with the result.

## F5 — Are native refresh and upright geometry correct?

pending private set

The integrator must use lawful family sets covering an outlier native refresh
and a vertical orientation. Record each set's expected native upright width,
height and refresh from public MAME metadata and the first frame's observed
width and height. Then run controlled 60, 90, 120 and 144 Hz callback cadences
and report the observed emulated-frame rate and percentage error at each
cadence. Every rate must be within 0.5% of native refresh and the vertical
frame must arrive upright at the expected geometry.

## F6 — Does the heaviest title sustain full speed?

pending private set

The integrator must use a lawful set for the family's heaviest title. After
startup and a warm-up interval, measure exactly 60 seconds of wall time on
desktop and report `emulated seconds / wall seconds`; repeat under Chromium's
4× CPU-throttled mobile proxy and report the same ratio as informational
evidence. Record browser version, CPU and whether frameskip was disabled.

## F4–F6 measured — a 320×240 horizontal title at 60.000 Hz

Observed 2026-10-21 with the fresh `build-mame --all --fresh` artifact,
headless Chromium on the desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock; the identity stays in the ignored
preload config). The audit reports the set complete from its single game
archive.

| Probe | Result |
| ----- | ------ |
| F4 startup to first valid frame | 351 ms; geometry ok |
| F5 emulated rate against native refresh, per cadence | 60 Hz → 59.81 fps (−0.32 %), 90 → 59.97 (−0.05 %), 120 → 60.12 (+0.21 %), 144 → 59.87 (−0.21 %); every frame at the machine's native size and orientation |
| F6 sixty-second emulated-time ratio at the 60 Hz cadence (desktop) | 0.9999 |

M3–M5 acceptance (`36-input-audio-acceptance.test.ts`) on the same set:
audio unlocked and under the cap for 60 s (queued max 58.7 ms), keyboard
coin/start changed the picture, two scripted pads took players 1 and 2 and a
held direction released on unplug. The family's heaviest title (F6 strictly)
remains pending a lawful set.
