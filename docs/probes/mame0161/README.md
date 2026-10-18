# MAME 0.161 feasibility probe

Status: in progress. No go/no-go decision has been made.

This directory holds the M0 evidence and decision described in
[§13.1 of the runtime specification](../../mame-game-runtime-spec.md#131-direct-mame-0161-source-m0).
It records exact environments, source identities, commands, patches, logs and
measurements needed to answer P1–P12. Local ROMs, native binaries, source
caches and generated emulator artifacts must not be copied here.

## Progress

| ID | Status | Current evidence or next action |
| -- | ------ | ------------------------------- |
| P1 | Partial | The official source package confirms version 0.161 and the historical licence, and a native `tiny` build produced consistent CLI metadata. Tagged-tree authentication and execution of the Windows reference remain; see [source-and-licence.md](source-and-licence.md) and [native-cli.md](native-cli.md). |
| P2 | Pass | Emscripten 1.38.31 completed a clean `tiny` build in 2:59.60 plus a 33.82-second final link, and Chromium ran the result without emulator errors; see [build-system.md](build-system.md). |
| P3 | Pass | The bundled `tiny` plus representative CPS-1, Irem M72 and Neo Geo driver-source subsets have raw/gzip/Brotli measurements and instantiate in Chromium; see [family-sizes.md](family-sizes.md). |
| P4 | Pass | The stock browser loop cannot complete a scheduled second-machine transition; a fresh module starts the second compiled entry cleanly. Use one module per `start()`; see [module-lifecycle.md](module-lifecycle.md). |
| P5 | Partial | The stock Emscripten main loop advances one fixed 1/60-second scheduler slice per browser callback. Correct behavior at other machine/display rates still requires the browser harness. |
| P6 | Pass | The `tiny`, CPS-1, Irem M72 and Neo Geo modules import fixed, non-shared memory, have no PThread loader and run over ordinary localhost HTTP without cross-origin isolation. |
| P7 | Partial | The required lifecycle, OSD update, render-target, sound and input-device APIs exist; see [bridge-hooks.md](bridge-hooks.md). Runtime proof remains. |
| P8 | Partial | NVRAM/config save functions exist, but NVRAM save is private and normally exit-only. A small public flush patch is required and must be exercised. |
| P9 | Partial | A custom OSD can own a render target and consume its primitive list at machine update cadence. Buffer format, orientation and cost require the browser module. |
| P10 | Partial | The stock JavaScript sound shim forwards signed 16-bit samples and a per-update sample count. Rate and runtime cadence still require measurement. |
| P11 | Partial | Audit results use structured enums/records and route summaries through interceptable OSD output channels. Missing-parent/BIOS behavior still needs a browser run. |
| P12 | Partial | A private, local-only fixture passes the 0.161 hash audit and boots to a visible browser frame with basic digital input events. Native parity, stable-frame hashing and performance measurements remain. |

## Working rules

- Treat `mame0161` as a candidate until every P1–P12 row has evidence.
- Keep source checkouts and generated artifacts under ignored local caches.
- Record failed commands and toolchain versions; a failed candidate is useful
  evidence, but it is not an `EMSDK_VERSION` pin.
- Do not use the current MAME licence as the licence for the historical 0.161
  codebase.
- Do not begin an FBNeo/libretro implementation as a workaround for a failed
  direct-MAME probe.
