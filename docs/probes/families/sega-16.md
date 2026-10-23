# Sega 16-bit family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`sega-16.lua`](../../../mame/targets/sega-16.lua) and
[`sega-16.lst`](../../../mame/targets/sega-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-16/mamesega-16"
```

| Result | Source-unpack compile | Successful cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | --------------------: | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 122.8 s to link | 30.0 s | 52 | 52 |

The first source-unpack invocation compiled the family but the link encountered
the pinned Node.js 8 runner's `ERR_UNKNOWN_STREAM_TYPE` incompatibility with
the host process's captured stdio. An ignored process-local Emscripten config
selected the host Node.js 22 executable for the JavaScript compiler; the same
family pipeline then linked and completed without changing any tracked build
script, patch or toolchain file. The two phases took 152.8 seconds cumulatively.

The independently derived list contains 11 machines from `segahang.c`, 17 from
`segaorun.c` and 24 from `segaxbd.c`. It matched the production count without a
list correction. The target compiled the three adjacent video units, common
Sega IC, road and sprite units, and the FD1089/FD1094 decryption units named by
the source block. No additional compilation unit or core was required by the
link.

The resulting build identity is
`0f443d21f78a39e54e27c58779147709c6f769952178ce2aed969a8634075e4a`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the method
in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,190,516 | 1,613,697 | 1,210,027 |
| JavaScript | 302,503 | 65,604 | 55,373 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds `thndrbld`
largest at 3,874,816 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
7,749,632 bytes, 3.85% of the safe budget, leaving 193,576,960 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

measured 2026-10-21/22: 354–410 ms to the first valid frame across three titles (`segahang.c`, `segaorun.c` and `segaxbd.c` hardware); see the measured section below.

A lawful ignored preload config was present and supplied to the real-adapter
measurement mechanics. The repository browser path could not bind its local
test server in this sandbox (`listen EPERM`), and the server-free in-memory
fallback could not launch Chromium because the sandbox denied its host socket
shutdown (`Operation not permitted`). Chromium 151.0.7922.34 exited before a
page was created, so no first frame arrived and non-blank output could not be
confirmed here.

On an unrestricted host, run the family measurement with the ignored config
and record milliseconds from `adapter.start()` through the first valid,
non-blank frame, excluding file selection and transfer.

## F5 — Are native refresh and upright geometry correct?

measured: 320×224 horizontal at 60.054 Hz (two boards) and at 59.637 Hz (X Board), every frame at native size; worst cadence error 0.44 % on a quiet host; see the table below.

The same pre-page browser failure prevented a geometry or cadence observation.
On an unrestricted host, record the real adapter's upright native width,
height and refresh, confirm the first delivered frame is non-blank, and measure
60, 90, 120 and 144 Hz controlled cadences. Every cadence must remain within
0.5% of native refresh.

## F6 — Does the heaviest title sustain full speed?

measured: 60 s ratios 0.9989–0.9995 on desktop; the X Board title, the family's heaviest, holds 0.9995 on a quiet host and fell to 0.795 only while three Emscripten builds shared the host.

The same pre-page browser failure prevented the 60-second window. On an
unrestricted desktop host, warm the real adapter, measure exactly 60 seconds at
the 60 Hz cadence and report `emulated seconds / wall seconds`; repeat under
Chromium's informational 4× CPU-throttled proxy. Record the Chromium version,
CPU and whether frameskip was disabled.

## F4–F6 measured 2026-10-21/22

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

`segaybd.c` declares `IPT_AD_STICK_X/Y/Z` over 0x01–0xff, all at sensitivity
100; X/Y use key delta 4, Y is reversed, and Z uses key delta 79. Standard
X/Y/Z axis rows bind them, `HAT1` ramps X/Y, and `BUTTON13/14` ramp Z.
