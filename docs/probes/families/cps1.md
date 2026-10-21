# CPS-1 family probe

## F1 — target pair and list coverage

The committed [`cps1.lua`](../../../mame/targets/cps1.lua) and
[`cps1.lst`](../../../mame/targets/cps1.lst) pair compiled with the pinned
Emscripten 1.38.31 toolchain. The generated module ran the ROM-free
`-listfull` path; no ROM content was supplied or embedded.

```sh
EMSDK_DIR="$PWD/res/emsdk" MAME_PROBE_KIND=family-pair \
  scripts/probe-mame0161-tiny.sh cps1
```

| Result | Wall time | `-listfull` machines | Raw Wasm bytes |
| ------ | --------: | -------------------: | -------------: |
| Pass | 39.28 s | 178 | 6,066,767 |

The run used two make jobs with a warmed SDK, port cache and shared emulator
objects. The wall time is the complete observed invocation, including target
generation, family compilation, bitcode link and final WebAssembly link.

## F4–F6 measured — a 384×224 horizontal title at 59.637 Hz

Observed 2026-10-21 with the `build-mame cps1 cps2 --fresh` artifact
(patch 0004 present; this title has no QSound), headless Chromium on the
desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts`. The audit reports the set
complete from its single game archive.

| Probe | Result |
| ----- | ------ |
| F4 startup to first valid frame | 396 ms; geometry ok |
| F5 emulated rate against native refresh, per cadence | 60 Hz → 59.64 fps (+0.01 %), 90 → 59.65 (+0.02 %), 120 → 59.56 (−0.14 %), 144 → 59.62 (−0.03 %); every frame at the machine's native size and orientation |
| F6 sixty-second emulated-time ratio at the 60 Hz cadence (desktop) | 0.9999 |

M3–M5 acceptance on the same three-button set: audio unlocked and under the
cap for 60 s (queued max 66.7 ms), keyboard coin/start changed the picture,
two scripted pads took players 1 and 2 and released on unplug.
