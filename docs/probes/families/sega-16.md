# Sega 16-bit family probe

Updated 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`sega-16.lua`](../../../mame/targets/sega-16.lua) and
[`sega-16.lst`](../../../mame/targets/sega-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w27f-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-16/mamesega-16"
```

| Result | Source-unpack compile | Successful cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | --------------------: | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 108.36 s to link | 34.74 s | 66 | 66 |

The first source-unpack invocation compiled the family but the link encountered
the pinned Node.js 8 runner's `ERR_UNKNOWN_STREAM_TYPE` incompatibility with
the host process's captured stdio. An ignored process-local Emscripten config
selected the host Node.js 22 executable for the SDK's JavaScript helpers; the
same family pipeline then linked and completed without changing a tracked build
script, patch or toolchain file.

The independently derived list contains 11 machines from `segahang.c`, 17 from
`segaorun.c`, 24 from `segaxbd.c` and 14 from `segaybd.c`. It matched the
production count without a list correction. The extension adds the Y Board
driver/video pair and the selectable MB8421 dual-port RAM core used by its link
configuration. Its three 68000s use the existing M68000-family core; the
315-5248 multiplier and 315-5249 divider already live in the compiled
`machine/segaic16.c` unit, and both sprite devices already live in
`video/sega16sp.c`. No further compilation unit or core was required by the
link.

The resulting build identity is
`f253fd7fd4fc2b997dddaf825db5564f5f26a1e54051e30dc9f3b2306901063b`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the method
in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,272,886 | 1,636,916 | 1,227,984 |
| JavaScript | 302,617 | 65,617 | 55,364 |

Before this extension the family Wasm was 6,190,516 raw bytes, so adding
`segaybd.c` increases every title's family download by 82,370 raw bytes
(1.33%). The corresponding gzip-9 increase is 23,219 bytes and the Brotli-11
increase is 17,957 bytes.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds the largest
entry, from `segaybd.c`, at 21,561,344 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
43,122,688 bytes, 21.42% of the safe budget, leaving 158,203,904 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

F4 pending for `segaybd.c`: the ignored preload audited `ok` under both strict
and MAME-compatible policies, with one archive present and all 47 expected
files valid. The real-adapter browser command then stopped at `listen EPERM`
when the test server tried to bind `127.0.0.1`. No page was created, so no
first frame arrived and non-blank output could not be confirmed in this
sandbox. The integrator must record the startup milliseconds on a host that
permits loopback and Chromium.

## F5 — Are native refresh and upright geometry correct?

F5 pending for `segaybd.c`: the same loopback denial prevented a geometry,
refresh or cadence observation. The integrator must confirm an upright,
non-blank native-size first frame and measure the 60, 90, 120 and 144 Hz
controlled cadences through the real adapter.

## F6 — Does the heaviest title sustain full speed?

F6 pending for `segaybd.c`: the same loopback denial prevented the 60-second
desktop window, so no sustained emulated-time ratio is claimed and the W27f
performance gate remains open. The driver stays in this branch for the
integrator to decide after measuring the ignored preload on an unrestricted
desktop; the informational 4× CPU-throttled proxy remains a secondary result.

## Earlier-driver F4–F6 measured 2026-10-21/22

Measured with the `build-mame` production artifact, headless Chromium on the
desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` and the M3–M5 acceptance in
`tests/browser/36-input-audio-acceptance.test.ts`. Identities stay in the
ignored preload configs; titles are described by their native geometry.
Rows marked "loaded" overlapped three Emscripten builds on the same host.
Cadence tolerance 1 %, 60 s ratio tolerance 2 %.

| Title | F4 | F5 | F6 | Acceptance |
| ----- | -- | -- | -- | ---------- |
| 320×224 at 60.054 Hz, `segaorun.c` board (quiet) | 354 ms | 60 → 60.20 (+0.24 %), 90 → 59.86 (−0.33 %), 120 → 59.79 (−0.44 %), 144 → 60.11 (+0.09 %) | 0.9994 | pass (queued max 57.4 ms) |
| 320×224 at 60.054 Hz, `segahang.c` board (loaded) | 356 ms | 60 → 60.12 (+0.11 %), 90 → 60.23 (+0.29 %), 120 → 60.18 (+0.21 %), 144 → 60.14 (+0.14 %) | 0.9989 | pass |
| 320×224 at 59.637 Hz, X Board, heaviest (quiet) | 410 ms | 60 → 59.66 (+0.05 %), 90 → 59.66 (+0.04 %), 120 → 59.62 (−0.03 %), 144 → 59.52 (−0.19 %) | 0.9995 | pass |

Analog steering and throttle on these boards take the digital fallback
(M11); the acceptance's coin, start and direction inputs changed the picture
from both keyboard and gamepad.

## F11 — Which analogue ports occur?

`segaxbd.c` declares `IPT_AD_STICK_X` at 0x20–0xe0, sensitivity 100 and key
delta 4; `IPT_AD_STICK_Y` at 0x40–0xc0 with the same sensitivity/delta and
reverse; and full 8-bit `IPT_AD_STICK_Z` at sensitivity 100 and key delta 79.
It also declares `IPT_PADDLE` at 0x20–0xe0, sensitivity 100, key delta 4 and
reverse, plus full 8-bit `IPT_PEDAL`/`IPT_PEDAL2` at sensitivity 100 and key
deltas 20/40. Standard X/Y/Z/RX/RY axis rows bind them; `HAT1` ramps X/Y and
the paddle, `BUTTON13/14` ramp Z, and `BUTTON13/14` press the two pedals.

`segaorun.c` declares `IPT_PADDLE` at 0x20–0xe0, sensitivity 100 and key delta
4, plus full 8-bit `IPT_PEDAL`/`IPT_PEDAL2` at sensitivity 100 and key deltas
20/40. The paddle uses the standard X axis and `HAT1LEFT/RIGHT`; the pedals
use RX/RY and `BUTTON13/14`.

`segahang.c` has the same paddle and two-pedal values, with reverse on the
paddle, and also declares reversed `IPT_AD_STICK_X/Y` at 0x20–0xe0,
sensitivity 100 and key delta 4. Standard X/Y/RX/RY rows supply the analogue
values, with the matching `HAT1` and pedal-button increment rows as digital
fallbacks.

`segaybd.c` declares `IPT_AD_STICK_X` at 0x01–0xff and 0x20–0xe0, plus
full-range 0x00–0xff instances; all use sensitivity 100 and key delta 4.
`IPT_AD_STICK_Y` uses 0x01–0xff, 0x40–0xc0 and full-range instances with
sensitivity 100, key delta 4 and reverse. `IPT_AD_STICK_Z` uses 0x01–0xff
and full-range instances with sensitivity 100 and key delta 79. None declares
a centre delta. Standard X/Y/Z axis rows bind these ports, `HAT1` ramps X/Y,
and `BUTTON13/14` decrement/increment Z.

The same driver declares `IPT_PADDLE` at 0x20–0xe0, sensitivity 100 and key
delta 4; full-range `IPT_PEDAL` and `IPT_PEDAL2` at sensitivity 100 and key
deltas 20 and 40; and full-range `IPT_LIGHTGUN_X`/`IPT_LIGHTGUN_Y` at
sensitivity 50 and key delta 5. No one of these declares a centre delta or
reverse. W26's standard X/RX/RY rows and digital increments already bind the
paddle and pedals. Light-gun ports remain outside W26's analogue gamepad
mapping and are recorded here as source coverage only.
