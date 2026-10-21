# Neo Geo family probe

## F1 — target pair and list coverage

The committed [`neogeo.lua`](../../../mame/targets/neogeo.lua) and
[`neogeo.lst`](../../../mame/targets/neogeo.lst) pair compiled with the pinned
Emscripten 1.38.31 toolchain. The generated module ran the ROM-free
`-listfull` path; no ROM content was supplied or embedded.

```sh
EMSDK_DIR="$PWD/res/emsdk" MAME_PROBE_KIND=family-pair \
  scripts/probe-mame0161-tiny.sh neogeo
```

| Result | Wall time | `-listfull` machines | Raw Wasm bytes |
| ------ | --------: | -------------------: | -------------: |
| Pass | 113.23 s | 256 | 6,375,199 |

The run used two make jobs with a warmed SDK and port cache. It refreshed the
shared emulator objects before compiling the family units, so the wall time is
the complete observed invocation rather than a link-only measurement.

## M1 acceptance — upright native-size frames at correct speed on 60 and 120 Hz cadences

Observed 2026-10-20 with the `build-mame` production artifact (clean unpack,
production patches 0001–0003), headless Chromium, the real adapter and
`ArcadeDisplay`, and `tests/browser/30-m1-acceptance.test.ts` driving the
adapter's injected scheduler at a controlled cadence with a real clock. The
private preload title is not recorded.

| Scheduler cadence | Native refresh | Emulated frames / wall second | Ratio | Geometry |
| ----------------: | -------------: | ----------------------------: | ----: | -------- |
| 60 Hz | 59.186 Hz | 59.34 | 1.0026 | upright, native size, horizontal |
| 120 Hz | 59.186 Hz | 59.13 | 0.9991 | upright, native size, horizontal |

Both cadences hold the machine's native rate within 0.3 % over a six-second
window after a 1.5-second warm-up, which closes the M1 acceptance row.
