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
