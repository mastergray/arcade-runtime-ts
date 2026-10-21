# W3 merge note: production MAME web bridge

## Result

W3 is ready for review. The production patches apply in order to a pristine
MAME 0.161 source tree, the review copies match the applied sources, and the
production bridge passes its Chromium cases with the private `neogeo` preload
configuration. The generated artifact has fixed, unshared WebAssembly memory
and no pthread or worker markers.

## Source footprint

Patch `0001-web-osd-modules.patch` touches:

- `scripts/src/osd/modules.lua`
- `src/osd/modules/lib/osdobj_common.c`
- `src/osd/modules/web/web_input.cpp`
- `src/osd/modules/web/web_sound.cpp`
- `src/osd/modules/web/web_video.cpp`
- `src/osd/sdl/input.c`
- `src/osd/sdl/sdlmain.c`
- `src/osd/sdl/video.c`

Patch `0002-web-bridge-exports.patch` touches:

- `scripts/src/osd/modules.lua`
- `src/emu/clifront.c`
- `src/emu/machine.c`
- `src/emu/machine.h`
- `src/emu/mame.c`
- `src/emu/schedule.c`
- `src/osd/modules/lib/osdobj_common.c`
- `src/osd/modules/web/web_bridge.cpp`
- `src/osd/modules/web/web_bridge.h`
- `src/osd/sdl/sdlmain.c`

Patch `0003-nvram-flush.patch` touches:

- `src/emu/machine.c`
- `src/emu/machine.h`
- `src/osd/modules/web/web_bridge.cpp`

No production patch contains probe telemetry or a `MAME_PROBE_` marker.

## Link contract

The exact production link settings, in addition to the family bitcode and any
preload arguments, are:

```sh
-O2
-s WASM=1
-s USE_SDL=2
-s MODULARIZE=1
-s 'EXPORT_NAME="createMame"'
-s TOTAL_MEMORY=268435456
-s ALLOW_MEMORY_GROWTH=0
-s NO_EXIT_RUNTIME=1
-s DISABLE_EXCEPTION_CATCHING=0
-s USE_PTHREADS=0
-s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]'
-s 'EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]'
```

The threading inspector reported one imported memory with 4,096 initial and
maximum pages, `shared: false`, fixed memory, no runtime threading markers, no
worker artifact, and no pthread requirement.

## 0.161 implementation details

`callMain` returns normally. MAME 0.161 ordinarily owns `sdl_options`, the OSD
interface, the CLI frontend, `machine_manager`, `machine_config`, and
`running_machine` through nested stack scopes. Returning while retaining only
the machine pointer leaves those references invalid. The Emscripten-only path
therefore heap-owns that complete graph after successful startup; an early
frontend failure still destroys it normally. No `emscripten_set_main_loop`
callback remains, and only `web_run_frames` advances the scheduler.

The web video module owns a non-SDL render target so 0.161 regards the screen
as live, rasterizes its primitive list into a reused RGB32 bitmap, and converts
it explicitly to opaque RGBA8888. It rasterizes after each explicit completed
frame because the release's `skip_redraw` signal remains stale under one-frame
host stepping. The first frame after a scheduled load is treated as skipped;
`onTick` still fires and rendering resumes on the following frame.

These are native 0.161 ownership and rendering accommodations, not deviations
from the JavaScript-visible §4.3.1 API or behavior. There are no §4.3.1 shape
deviations.

## Machine metadata

BIOS options come from `root_device().rom_region()`: system-BIOS entries supply
their name through `ROM_GETNAME`, description through `ROM_GETHASHDATA`, and
`isDefault` by comparing `ROM_GETBIOSFLAGS` with
`root_device().default_bios()`.

`hasNvram` is true when either `nvram_interface_iterator` finds a live NVRAM or
EEPROM device, or `image_interface_iterator` finds an `IO_MEMCARD` device.

## NVRAM observation

For the tested Neo Geo title, `web_flush_nvram()` returned success but wrote
zero files and zero bytes below the configured NVRAM root. The machine reported
`hasNvram: true` because it exposes a memory-card image device; it had no live
`device_nvram_interface`, so the W3 wrapper's delegated `nvram_save()` loop had
nothing to serialize. Memory-card and EEPROM expansion remains the explicitly
assigned W15/F8 work; W3 does not widen the proven narrow mid-run serializer.

## Reproduction

Start with a pristine unpacked source root at `.cache/mame0161-w3`, then apply
the production patches before invoking the inherited family build:

```sh
export EMSDK_DIR="$PWD/res/emsdk"
export MAME_SOURCE_DIR="$PWD/.cache/mame0161-w3"

for patch_file in mame/patches/*.patch; do
  patch --batch --forward -p1 -d "$MAME_SOURCE_DIR" -i "$PWD/$patch_file"
done

EMSDK_DIR="$EMSDK_DIR" MAME_SOURCE_DIR="$MAME_SOURCE_DIR" \
  MAME_PROBE_KIND=family-pair scripts/probe-mame0161-tiny.sh neogeo
```

Relink the resulting bitcode into the modular production pair:

```sh
source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
export PATH="$PWD/scripts/toolchain-shims:$PATH"
export EMSCRIPTEN="$EMSDK_DIR/emscripten/1.38.31"
mkdir -p .cache/w3-web

emcc -O2 \
  -s WASM=1 \
  -s USE_SDL=2 \
  -s MODULARIZE=1 \
  -s 'EXPORT_NAME="createMame"' \
  -s TOTAL_MEMORY=268435456 \
  -s ALLOW_MEMORY_GROWTH=0 \
  -s NO_EXIT_RUNTIME=1 \
  -s DISABLE_EXCEPTION_CATCHING=0 \
  -s USE_PTHREADS=0 \
  -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]' \
  -s 'EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]' \
  "$MAME_SOURCE_DIR/mameneogeo.bc" \
  -o "$PWD/.cache/w3-web/mame.js"
```

Then run:

```sh
npm run check
MAME0161_SOURCE_ARCHIVE=res/mame0161s.zip npm test
npm run probe:mame:threading -- "$PWD/.cache/w3-web/mame"
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```

Observed results:

- check: pass
- spec: 240 passed, 0 failed, 0 skipped
- threading inspector: pass
- browser: 9 passed, 0 failed, 22 unrelated probe cases skipped
- W3 browser cases: 2 passed
