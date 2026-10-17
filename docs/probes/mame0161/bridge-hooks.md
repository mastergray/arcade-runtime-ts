# P7–P11: 0.161 bridge-hook findings

Status: source API inventory complete enough to design the first bridge;
runtime behavior remains unproven until a WebAssembly build exists.

## Lifecycle and control (P7)

`running_machine` already exposes the core operations the adapter needs:

- `pause()`, `resume()` and `paused()`;
- `schedule_soft_reset()` and `schedule_hard_reset()`;
- `schedule_exit()` and `exit_pending()`;
- `schedule_save()`, `schedule_load()`, `immediate_save()` and
  `immediate_load()`; and
- machine notifications for frame, reset, pause, resume and exit.

The bridge can call these methods through the current-machine pointer after
the running phase begins. Save states are file-based, so the JavaScript side
can exchange `.sta` files through Emscripten's virtual filesystem rather than
serializing MAME internals itself.

The release already adds Emscripten-only `js_get_machine()`, `js_get_ui()` and
`js_get_sound()` functions in `src/emu/machine.c`. These demonstrate the
intended access pattern, but the final patch should expose narrow operations
instead of exporting raw C++ object pointers as the public bridge contract.

## Input

The OSD owns input enumeration. The included minimal OSD demonstrates the
needed pattern: add an input device through `machine.input().device_class(...)`,
then add items backed by small callbacks and stable state fields. A web input
module can register per-player digital devices/items and have each callback
read bridge-owned state set by exported functions.

The first runtime patch still needs to prove the exact item IDs and generated
controller configuration for player buttons, directions, coin, start, service
and test. Browser DOM key handling does not belong in MAME; JavaScript maps
physical sources to `ArcadeControl` and only sends normalized control states
across the bridge.

## Video (P9)

`osd_common_t::update(bool skip_redraw)` is the periodic OSD hook, normally
called at the emulated system's frame cadence. An OSD implementation can
allocate a `render_target`, set its output bounds, and consume the resulting
`render_primitive_list`. The core also supplies minimum-size, visible-area,
pixel-aspect and target-orientation APIs.

This is sufficient to implement a software RGBA target without SDL owning the
page canvas. It does not yet decide whether the lowest-cost implementation is
primitive rasterization or copying a screen bitmap before composition. P9 must
measure the chosen conversion and verify upright output for rotated games.

## Sound (P10)

The release's `js` sound module receives `const INT16 *buffer` plus
`samples_this_frame` and forwards the address/count to JavaScript. Master
attenuation is forwarded separately. The format is therefore signed 16-bit
PCM at the module boundary; channel ordering, negotiated sample rate and
callback cadence still need runtime measurement.

The module's `init()` method declares `int` but does not return a value. The
first compatibility patch should return success explicitly before judging a
toolchain failure.

## Persistence (P8)

Normal shutdown in `running_machine::run()` performs this sequence:

1. mute sound;
2. call private `running_machine::nvram_save()`;
3. call the public free function `config_save_settings(machine)`; and
4. run exit notifiers during cleanup.

`nvram_save()` iterates every `device_nvram_interface`, opens its calculated
path with create/write flags, calls the device's `nvram_save(file)`, and closes
the file. There is no public mid-run wrapper. Therefore patch 0003 from the
runtime specification is required: add one narrow operation that calls NVRAM
and configuration saves while the machine is alive, then lets JavaScript sync
the virtual filesystem. The patch must be tested on a real NVRAM title; source
shape alone cannot establish that every device tolerates a mid-run write.

## Audit and output capture (P11)

The ROM auditor exposes structured summary values (`CORRECT`,
`BEST_AVAILABLE`, `INCORRECT`, `NOTFOUND`, and `NONE_NEEDED`) and per-record
status/substatus data. Its textual summarizer includes the set name, ROM name,
expected length, checksum/length failures, optional/no-dump status and the
short name of a shared device when a missing file belongs there.

The CLI sends these summaries and terminal set status through
`osd_printf_info`; missing sets and bad audits become fatal errors with
`MAMERR_MISSING_FILES`. All `osd_printf_*` calls pass through a stackable
`osd_output` delegate with separate error, warning, info, debug, verbose and
log channels. A web delegate can therefore capture audit text before exit
without scraping browser console output.

The browser probe must still confirm ordering and identify missing parent and
BIOS zips on actual clone/BIOS cases. `-listxml` supplies `cloneof`/`romof`
relationships, so `pack-roms` should combine machine metadata with the audit
records rather than depend on human-readable text alone.

## Patch implications

The source supports the bridge architecture in the specification. The current
minimum patch shape is:

1. add web video/input/sound OSD modules and fix the `js` sound `init()` return;
2. add narrow exported lifecycle, control, metadata and save-state functions;
3. expose a safe mid-run NVRAM/config flush; and
4. register an OSD output delegate for structured audit/error delivery.

This inventory is not acceptance evidence for timing, rendering, audio or
persistence; those remain browser measurements after P2 produces a runnable
module.
