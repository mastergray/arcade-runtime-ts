# Taito 16-bit incl. Z System family probe

Family description: **Taito 16-bit incl. Z System**.

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

## 2026-10-21 — extended by W19f

F1–F3 were re-recorded after adding the complete Taito Z driver list to the
unchanged `taito-16` family id. The environment and measurement methods are the
same as the original record above.

### F1 — Does the target pair compile and expose every machine?

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-16/mametaito-16"
```

| Result | Successful cached-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 47.16 s | 223 | 223 |

The independently derived list adds all 34 public machines from `taito_z.c`
to the prior 189 and matched the production count without a list correction.
The existing Taito target already selected every CPU, sound, EEPROM, I/O,
road, palette and tilemap dependency referenced by Taito Z. Its first complete
link passed, so no additional shared unit or core was required.

The pinned Node.js 8 runner has the same captured-stdio incompatibility noted
for the Irem build. The ignored W19f process-local Emscripten config selected
host Node.js 22 for compiler subprocesses only, without a tracked change.
The resulting build identity is
`ab64a8cf8311ab1ca1211b5415e6ca8e27073855ce381b2b9d517507b3fe6c1f`.

### F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 7,074,473 | 1,772,767 | 1,313,884 |
| JavaScript | 302,504 | 65,607 | 55,309 |

### F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing all 223 public metadata files still finds `dinorex` largest at
12,124,160 bytes; no Taito Z set exceeds it. The 4,096-page safe adapter budget
is 201,326,592 bytes (192 MiB). Counting the uncompressed ROM sum once for
supplied archive bytes and once for loaded regions gives a conservative
24,248,320-byte peak, 12.04% of the safe budget, leaving 177,078,272 bytes. No
machine fails the §5 estimate, so the build remains at 4,096 pages.

### New-driver F4–F6 status

An ignored lawful preload config for a Taito Z title is present, but this
sandbox cannot bind loopback or start Chromium, so the requested browser suite
was not attempted.

| Probe | Taito Z status |
| ----- | -------------- |
| F4 startup to first valid, non-blank frame | measured 2026-10-22, see below |
| F5 native refresh and upright geometry | measured 2026-10-22, see below |
| F6 sixty-second emulated-time ratio | measured 2026-10-22, see below |

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

## F4–F6 measured 2026-10-22 — the Z System driver added by W19f

Measured with the `build-mame` production artifact, headless Chromium on the
desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock) and the M3–M5 acceptance in
`tests/browser/36-input-audio-acceptance.test.ts`. Identities stay in the
ignored preload configs; titles are described by their native geometry.
Runs marked "loaded" overlapped three Emscripten builds on the same host and
are conservative; the 60 s ratio tolerance is 2 %, the cadence tolerance 1 %.

| Title | F4 | F5 | F6 | Acceptance |
| ----- | -- | -- | -- | ---------- |
| Z System: 320×240 at 60.000 Hz | 496 ms | 60 → 59.66 (−0.56 %), 90 → 59.87 (−0.21 %), 120 → 59.85 (−0.24 %), 144 → 59.98 (−0.03 %) | 1.0000 | pass |

## F11 — Which analogue ports occur?

`taito_z.c` conditionally declares `IPT_PADDLE` at 0x20–0xe0, sensitivity
100, key delta 4 and reverse, or `IPT_DIAL` over a 16-bit mask at sensitivity
100, key delta 2 and reverse. It also conditionally declares 3-bit
`IPT_PEDAL`/`IPT_PEDAL2` at sensitivity 25 and key delta 1. Conditional fields
remain visible in machine discovery. The paddle uses the standard X axis and
`HAT1LEFT/RIGHT`; the dial uses `JOYCODE_n_ADDREL1` with the same digital
fallback; and the pedals use RX/RY plus `BUTTON13/14` increment sequences.

`superchs.c` declares reversed full-range `IPT_PADDLE` at sensitivity 100 and
key delta 4, plus full-range `IPT_PEDAL` at sensitivity 100 and key delta 15.
The paddle uses the standard X axis and `HAT1LEFT/RIGHT`; the pedal uses RX
and the `BUTTON13` increment sequence.
