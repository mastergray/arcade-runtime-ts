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

## F8 — memory card, NVRAM and state fidelity

Observed 2026-10-20 with a fresh production build, headless Chromium and the
ignored Neo Geo preload configuration. No private machine or archive identity
is recorded. The reproduction commands were:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts neogeo --jobs 4 --fresh

ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```

### Persistence paths

Pinned-source inspection confirmed that `ng_memcard_device` is a
`device_image_interface`, not a `device_nvram_interface`. Its sole image
instance is named `memcard`; `call_load()` accepts exactly 0x800 bytes, and
`call_unload()` seeks to byte zero and writes the live 0x800-byte card buffer.
The adapter therefore mounts `/mame/memcard/<machine>.bin` with `-memcard`, and
`web_flush_nvram()` calls that existing writer without unloading the image.

The browser case seeded a generic 0x800-byte pattern through the incoming
overlay, then overwrote only the mounted MEMFS file while the emulated card
buffer retained the pattern. A mid-run `persist()` caused the native flush to
restore the mounted file byte-for-byte. The complete overlay contained the
card under `memcard/`; a fresh module restored the same bytes, and its next
flush did so again. The first `persist()` after startup returned `null`, so the
fresh or restored mounted card is included in the boot snapshot rather than
reported as a user change.

The same cumulative overlay contained a file under `nvram/`, confirming that
the existing `device_nvram_interface` path also serialized the tested Neo Geo
BIOS-side NVRAM during the mid-run flush.

### Scheduled state fidelity

The test scheduled a save, retained the next three rendered frames, scheduled
the corresponding load, and retained the next three rendered frames again.
The first frame after load was not byte-identical to the first frame after the
save, and no frame in the three-frame post-load sequence matched any frame in
the three-frame post-save sequence. Both native operations completed
successfully and rendering continued at the same geometry.

A diagnostic relink that rendered rather than suppressed the first emulated
frame after `web_service_saveload()` produced the same result. The bridge's
one-frame suppression is therefore not the cause, and the production bridge
retains it.

The pinned core identifies the state-fidelity limitation. Neo Geo palette RAM,
sprite video RAM, sprite auto-animation counters and screen timing fields are
registered with the save manager. However, `screen_device` does not register
either RGB32 screen bitmap or `m_curbitmap`/`m_curtexture`; its post-load hook
only reallocates the bitmaps, while `video_manager::postload()` only resets
movie-recording timestamps. Thus the serialized driver state omits the
presentation bitmap and active double-buffer selection needed for a
byte-identical next rendered frame. This is a MAME 0.161 core/driver-state
limitation rather than a web-bridge omission; no state contract or test was
loosened.
