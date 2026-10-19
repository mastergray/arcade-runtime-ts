# P7–P11: 0.161 bridge-hook findings

Status: P7 passed. The runtime boundaries and the stock browser-loop gaps are
now measured. P8–P11 retain the source findings below and still need their
dedicated runtime probes.

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

## Runtime probe (P7)

Observed 2026-10-19 with the pinned Emscripten 1.38.31 toolchain and headless
Chromium. The fixture, its machine names and its ROM archives remain private
local inputs and are not recorded here.

[`0004-emscripten-bridge-hooks-probe.patch`](../../../mame/patches/0004-emscripten-bridge-hooks-probe.patch)
counts machine notifications and exposes generic requests for pause, resume,
soft reset, scheduled save/load and exit. It also reports one stock SDL input
state and the native file/save error codes. The JavaScript shim counts the
stock `js` sound-module callbacks without consuming their samples.

[`06-mame-bridge-hooks-probe.test.ts`](../../../tests/browser/06-mame-bridge-hooks-probe.test.ts)
runs each terminal or stateful observation in a fresh module through
`ctg-js-browser-test`:

| Boundary | Runtime result | Bridge consequence |
| -------- | -------------- | ------------------ |
| Video/frame | More than 30 `MACHINE_NOTIFY_FRAME` callbacks arrived after startup. | The production loop can expose a frame/tick notification, while P9 still owns pixels, format and orientation. |
| Sound | The stock `js` module repeatedly supplied a non-zero `INT16` buffer address and frame count. | A web sound module can adapt this mixed-PCM boundary; P10 still measures rate and cadence. |
| Input | Pressing and releasing a browser arrow key changed `IPT_JOYSTICK_RIGHT` from false to true and back through SDL. | MAME's input port layer is live; the production module should replace SDL key handling with bridge-owned virtual-device states. |
| Pause/resume | Both notifications and the paused flag changed, but machine time still advanced by more than 250 ms over 20 browser callbacks while paused. | The replacement outer loop must branch on `paused()` and must not advance the device scheduler while paused. |
| Soft reset | `schedule_soft_reset()` produced a second reset notification without a shell exception. | The narrow soft-reset export can use the existing scheduler API. |
| State load | A scheduled load with no state file reported a file-open error, no save-format error and no shell exception. | The bridge can distinguish file and serialization failures and report completion rather than scraping UI text. |
| State round trip | A scheduled save succeeded, machine time advanced, a scheduled load rewound to the saved time, and another 30 callbacks advanced without an exception. Two legacy-toolchain accommodations were required: pre-create the missing MEMFS state node before native `open(O_CREAT)`, and suppress the scheduler's diagnostic-only timer dumps under Emscripten. | Use scheduled operations at a dedicated between-timeslice boundary; do not expose `immediate_save()`/`immediate_load()`. Preserve both Emscripten accommodations in the production patch. |
| Exit | `schedule_exit()` set `exit_pending`, but 20 more callbacks ran and no exit notifier fired. | Stop the browser loop and discard the module explicitly; do not wait for the abandoned native `run()` stack to perform cleanup. |

P4 already established the same terminal behavior for hard reset and a
new-driver request. A hard reset therefore means a fresh module, not an
in-module machine transition.

## Input source boundary

The OSD owns input enumeration. The included minimal OSD demonstrates the
needed pattern: add an input device through `machine.input().device_class(...)`,
then add items backed by small callbacks and stable state fields. A web input
module can register per-player digital devices/items and have each callback
read bridge-owned state set by exported functions.

The runtime probe confirms that input reaches `ioport_manager`; it does not
prove the final web device's item IDs or generated controller configuration
for player buttons, directions, coin, start, service and test. Browser DOM key
handling does not belong in MAME; JavaScript maps physical sources to
`ArcadeControl` and only sends normalized control states across the bridge.

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

The source and runtime probe support the bridge architecture in the
specification. The minimum patch shape is:

1. add web video/input/sound OSD modules and fix the `js` sound `init()` return;
2. add narrow exported lifecycle, control, metadata and scheduled state
   functions, plus explicit result callbacks;
3. replace the stock outer loop so pause does not run the scheduler, pending
   state work is serviced at a controlled boundary, and terminal operations
   stop callbacks rather than waiting on an abandoned stack;
4. expose a safe mid-run NVRAM/config flush; and
5. register an OSD output delegate for structured audit/error delivery.

P7 accepts the scheduled state boundary and its save/load round trip for the
probe fixture. The final adapter still needs the same assertions against its
public Promise API. Rendering, audio cadence, persistence and audit behavior
remain P8–P11 measurements.
