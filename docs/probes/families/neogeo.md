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
