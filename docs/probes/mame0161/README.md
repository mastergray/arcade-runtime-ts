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
| P1 | Pass | The source package matches all 16,068 files tracked by the official annotated tag, the source-built native CLI metadata is internally consistent, and the historical licence plus linked third-party notices are inventoried; see [source-and-licence.md](source-and-licence.md) and [native-cli.md](native-cli.md). |
| P2 | Pass | Emscripten 1.38.31 completed a clean `tiny` build in 2:59.60 plus a 33.82-second final link, and Chromium ran the result without emulator errors; see [build-system.md](build-system.md). |
| P3 | Pass | The bundled `tiny` plus representative CPS-1, Irem M72 and Neo Geo driver-source subsets have raw/gzip/Brotli measurements and instantiate in Chromium; see [family-sizes.md](family-sizes.md). |
| P4 | Pass | The stock browser loop cannot complete a scheduled second-machine transition; a fresh module starts the second compiled entry cleanly. Use one module per `start()`; see [module-lifecycle.md](module-lifecycle.md). |
| P5 | Pass | The stock loop preserves near-60 Hz machine speed across controlled 60/90/120/144 Hz display cadences by blocking callbacks near 60 Hz. The bridge will replace that outer pacing policy with a non-blocking, screen-period accumulator; see [frame-pacing.md](frame-pacing.md). |
| P6 | Pass | The `tiny`, CPS-1, Irem M72, Neo Geo and real-game modules use fixed non-shared memory, have no PThread loader and run over ordinary HTTP without cross-origin isolation; see [threading-and-hosting.md](threading-and-hosting.md). |
| P7 | Pass | Frame, PCM, input, pause/resume, soft-reset, state-result and exit boundaries were exercised. Scheduled save/advance/load/continue passes after the two pinned-toolchain accommodations documented in [bridge-hooks.md](bridge-hooks.md); pause and terminal behavior still require the replacement control loop. |
| P8 | Pass | A narrow mid-run NVRAM wrapper wrote a real device's non-empty file, IDBFS synced it, and a fresh module hydrated the identical file before startup. Stock `config_save_settings()` is not safe mid-run in this browser build and is excluded; adapter-owned cfg files remain part of the persisted overlay. See [bridge-hooks.md](bridge-hooks.md). |
| P9 | Pass | The native software target yields RGB32/BGRX memory and converts to opaque RGBA8888. A forced quarter turn transposed geometry while preserving pixel aggregates; across dedicated and combined 4× CPU-throttled mobile-proxy runs, conversion p95 was at most 3.4 ms and raster-plus-conversion p95 was at most 7.2 ms. Actual-phone sustained speed remains P12. See [bridge-hooks.md](bridge-hooks.md). |
| P10 | Pass | The 48 kHz mixer supplied interleaved signed 16-bit left/right stereo in exact 960-frame (20 ms) chunks. Four 150-callback runs averaged 49.90–49.97 callbacks/s and 47,904–47,971 frames/s; see [bridge-hooks.md](bridge-hooks.md). |
| P11 | Pass | Missing parent and BIOS fixtures each produced an ordered detailed error plus terminal error on the OSD error channel, followed by frontend result `MAMERR_MISSING_FILES` (`2`) before any main-loop tick. The adapter must consume an explicit frontend-result callback rather than wait for `Module.onExit`; see [bridge-hooks.md](bridge-hooks.md). |
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
