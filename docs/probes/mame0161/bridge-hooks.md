# P7–P11: 0.161 bridge-hook findings

Status: P7–P11 passed. The runtime boundaries, stock browser-loop gaps,
mid-run persistence behavior, upright RGBA render path, mixer boundary and ROM
audit failure path are measured.

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

[`0004-emscripten-bridge-hooks-probe.patch`](../../../mame/probes/patches/0004-emscripten-bridge-hooks-probe.patch)
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
| Sound | The stock `js` module repeatedly supplied a non-zero `INT16` buffer address and frame count. | A web sound module can adapt this mixed-PCM boundary; P10 measures its exact format and cadence below. |
| Input | Pressing and releasing a browser arrow key changed `IPT_JOYSTICK_RIGHT` from false to true and back through SDL. | MAME's input port layer is live; the production module should replace SDL key handling with bridge-owned virtual-device states. |
| Pause/resume | Both notifications and the paused flag changed, but machine time still advanced by more than 250 ms over 20 browser callbacks while paused. | The replacement outer loop must branch on `paused()` and must not advance the device scheduler while paused. |
| Soft reset | `schedule_soft_reset()` produced a second reset notification without a shell exception. | The narrow soft-reset export can use the existing scheduler API. |
| State load | A scheduled load with no state file reported a file-open error, no save-format error and no shell exception. | The bridge can distinguish file and serialization failures and report completion rather than scraping UI text. |
| State round trip | A scheduled save succeeded, machine time advanced, a scheduled load rewound to the saved time, and another 30 callbacks advanced without an exception. Two legacy-toolchain accommodations were required: pre-create the missing MEMFS state node before native `open(O_CREAT)`, and suppress both the pre-save and post-load `dump_timers()` diagnostics under Emscripten. A P8 regression run caught and corrected a guard that had ended before the post-load call. | Use scheduled operations at a dedicated between-timeslice boundary; do not expose `immediate_save()`/`immediate_load()`. Preserve both Emscripten accommodations in the production patch. |
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
page canvas.

The dedicated browser probe ran on 2026-10-19 with the pinned Emscripten
1.38.31 toolchain and headless Chromium. The private fixture identity and ROM
inputs remain local. The game-only
[`0007-emscripten-video-probe.patch`](../../../mame/probes/patches/0007-emscripten-video-probe.patch)
uses `video_manager`'s existing hidden native snapshot target and software
primitive rasterizer. This avoids SDL canvas readback and exercises the same
path selected for the production web video module.

[`08-mame-video-probe.test.ts`](../../../tests/browser/08-mame-video-probe.test.ts)
confirmed these boundaries:

| Observation | Result | Bridge consequence |
| ----------- | ------ | ------------------ |
| Core buffer | `bitmap_rgb32`: numeric `0x00RRGGBB`, BGRX byte order in little-endian Wasm memory | Convert channels explicitly; do not expose the source bytes as browser RGBA. |
| Browser buffer | Reused C++ storage containing opaque `RGBA8888`; byte length was exactly width × height × 4 and the stable sample contained non-black pixels. | `onFrame(ptr, width, height)` can expose a temporary heap view for the adapter to copy. |
| Native geometry | The output dimensions matched the visible area after combining the system and target orientation flags. | `MachineInfo.width`/`height` come from the upright target, not deployment configuration. |
| Quarter turn | A forced `ROT90` target transposed the dimensions and preserved per-channel sums and the RGB XOR across the entire frame. | The core render target owns rotation; JavaScript does not rotate pixels. |

Each timing sample contained 71,680 pixels and used 30 warmed captures under a
390×844 Chromium viewport with 4× CPU throttling. The dedicated P9 run and
later combined regressions produced these ranges across four executions:

| Work | p50 range | p95 range |
| ---- | ---------: | ---------: |
| RGB32 → opaque RGBA8888 | 0.600–1.000 ms | 1.100–3.400 ms |
| Software primitive rasterization | 2.900–3.500 ms | 4.000–5.900 ms |
| Rasterization + conversion | 3.500–4.500 ms | 5.100–7.200 ms |

The worst observed combined p95 is below one 16.667 ms frame budget, so P9
selects direct primitive rasterization plus explicit RGBA conversion. The
extra forced-rotation render is probe-only and excluded from those production
path timings. CPU throttling is an engineering proxy, not a physical handset
measurement; sustained physical-phone validation remains an M4 and release
gate after the production display and touch paths exist.

## Sound (P10)

The release's `js` sound module receives `const INT16 *buffer` plus
`samples_this_frame` and forwards the address/count to JavaScript. Master
attenuation is forwarded separately. `osd_common_t::update_audio_stream()`
defines the buffer as stereo samples in left/right order at the configured
sample rate. `sound_manager::update()` clamps each channel to signed 16-bit,
interleaves left then right, and passes `finalmix_offset / 2`, so the count is
stereo frames rather than individual samples. Its periodic update timer runs
at 50 Hz.

The module's `init()` method declares `int` but does not return a value. The
first compatibility patch should return success explicitly before judging a
toolchain failure.

The dedicated runtime probe ran on 2026-10-19 with the pinned Emscripten
1.38.31 toolchain and headless Chromium. The private fixture identity and ROM
inputs remain local. The command line fixed `-samplerate 48000`, while
[`0008-emscripten-audio-probe.patch`](../../../mame/probes/patches/0008-emscripten-audio-probe.patch)
forwarded the sound module's own `sample_rate()` and throttle state with each
stock callback. The JavaScript probe read the two channel slots through the
signed `HEAP16` view; it did not derive the format or rate from wall time.

[`09-mame-audio-probe.test.ts`](../../../tests/browser/09-mame-audio-probe.test.ts)
discarded 25 startup callbacks, then measured 150 callbacks. Dedicated P10 and
combined regression runs produced these ranges across four executions:

| Observation | Result | Bridge consequence |
| ----------- | -----: | ------------------ |
| Mixer format | `S16LE`, two interleaved channels, left then right | De-interleave `HEAP16` pairs and normalize each signed value to Web Audio float channels. |
| Native rate | 48,000 stereo frames/s reported on every callback | Set `ArcadeSession.sampleRate` from the native boundary; do not infer it from browser cadence. |
| Native chunk | Exactly 960 stereo frames, or 20 ms, on every callback | Forward one native mixer update as one audio batch; the 16 ms minimum chunk does not need extra accumulation. |
| Browser delivery | 49.90–49.97 callbacks/s; 17.9–18.2 ms interval p50 and 29.1–30.2 ms p95 | Expect main-loop quantization around the 50 Hz average and schedule by accumulated audio duration, not individual arrival intervals. |
| Sustained delivery | 47,904–47,971 stereo frames/s over the measured window | The stock throttled loop remained within 0.20% of the configured rate during this short probe. |

Both channel positions contained live, in-range signed values, and all 150
callbacks reported the throttled state. The 120 ms queue cap therefore holds
six normal mixer chunks. Long-run drift and queue behavior remain covered by
the release gate rather than this short boundary probe.

## Persistence (P8)

Normal shutdown in `running_machine::run()` performs this sequence:

1. mute sound;
2. call private `running_machine::nvram_save()`;
3. call the public free function `config_save_settings(machine)`; and
4. run exit notifiers during cleanup.

`nvram_save()` iterates every `device_nvram_interface`, opens its calculated
path with create/write flags, calls the device's `nvram_save(file)`, and closes
the file. There is no public mid-run wrapper, so patch 0003 from the runtime
specification is required.

The dedicated runtime probe ran on 2026-10-19 with the pinned Emscripten
1.38.31 toolchain, headless Chromium and a private NVRAM-capable fixture.
[`0006-emscripten-persistence-probe.patch`](../../../mame/probes/patches/0006-emscripten-persistence-probe.patch)
adds a narrow `probe_flush_nvram()` wrapper. It counts live NVRAM interfaces,
uses MAME's own `nvram_filename()` result, retains the pinned toolchain's
missing-file pre-creation accommodation, and then delegates serialization to
the existing private `nvram_save()` method.

[`07-mame-persistence-probe.test.ts`](../../../tests/browser/07-mame-persistence-probe.test.ts)
mounted a fresh IDBFS root, hydrated it before MAME startup, requested the
flush while the machine was running, and synced the result. The fixture
reported a live NVRAM interface and wrote a non-empty 65,536-byte device file.
The loop advanced at least 20 further callbacks after the flush. Reloading the
page at the same origin hydrated a file with the exact same relative path,
size and checksum before the second machine started.

The same probe also ruled out calling `config_save_settings()` at this
boundary. A temporary stage trace showed every registered default/game
serializer, both XML writes and all final callbacks completing, after which
the Chromium renderer crashed as the function returned. Pausing first,
explicitly closing both files and guarding the optional UI render target did
not make the call safe. No version of that diagnostic patch is retained.

The production bridge therefore exposes only `web_flush_nvram()`. Controller
and launch configuration under `cfg/` is adapter-owned and written before
startup; it is still included in the cumulative overlay and dirty hashes, but
MAME's shutdown-oriented configuration serializer is never invoked mid-run.
If a later feature allows MAME itself to mutate configuration, it needs a new
safe serializer and a new probe rather than widening the NVRAM export.

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

The dedicated browser probe ran on 2026-10-20 with the pinned Emscripten
1.38.31 toolchain, headless Chromium and separate private parent-dependent and
BIOS-dependent fixtures. Their identities and ROM inputs remain local.
[`0009-emscripten-audit-output-probe.patch`](../../../mame/probes/patches/0009-emscripten-audit-output-probe.patch)
copies each formatted OSD message into a `{ sequence, channel, text }` record
before the existing SDL callback prints it. It also reports the authoritative
`cli_frontend::execute()` result without changing the audit or error path.

[`10-mame-audit-probe.test.ts`](../../../tests/browser/10-mame-audit-probe.test.ts)
removed the configured dependency archive from MEMFS after preload and before
`main()`. Each otherwise-complete artifact produced the same ordered shape:

| Fixture | Detailed record | Terminal record | Frontend result | Main-loop ticks |
| ------- | --------------- | --------------- | --------------: | --------------: |
| Missing parent | Error-channel record contained missing-file lines and named the configured dependency among the searched sets. | A later error-channel record reported that required files were missing. | `2` (`MAMERR_MISSING_FILES`) | 0 |
| Missing BIOS | Error-channel record contained missing-file lines and named the configured dependency among the searched sets. | A later error-channel record reported that required files were missing. | `2` (`MAMERR_MISSING_FILES`) | 0 |

Both cases had exactly two output records, both records were captured before
the frontend result, and no generated-shell or console scraping was required.
The pinned Emscripten runtime did not invoke `Module.onExit` after the frontend
returned, so the production bridge needs an explicit frontend-result callback.
Result `2` before the first frame maps to `ROM_SET_INVALID`; its ordered error
records become the error's `data` without using text to classify the failure.

The missing-file details themselves remain pinned-MAME text. Build-time
`pack-roms` should continue using the auditor's structured records plus
`-listxml` `cloneof`/`romof` relationships to identify parent and BIOS archives,
rather than trying to infer dependency roles from those lines.

## Patch implications

The source and runtime probe support the bridge architecture in the
specification. The minimum patch shape is:

1. add web video/input/sound OSD modules and fix the `js` sound `init()` return;
2. add narrow exported lifecycle, control, metadata and scheduled state
   functions, plus explicit result callbacks;
3. replace the stock outer loop so pause does not run the scheduler, pending
   state work is serviced at a controlled boundary, and terminal operations
   stop callbacks rather than waiting on an abandoned stack;
4. expose a safe mid-run NVRAM flush without invoking the shutdown-oriented
   configuration serializer; and
5. register an OSD output delegate for structured audit/error delivery.

P7 accepts the scheduled state boundary and its save/load round trip for the
probe fixture. P8 accepts the NVRAM/IDBFS round trip and excludes the unsafe
config-save call. P9 accepts core primitive rasterization, core-owned
orientation and explicit RGB32-to-RGBA conversion. P10 accepts 48 kHz,
interleaved signed-16 left/right audio in 20 ms native chunks and
duration-based browser scheduling. The final adapter still needs the same
assertions against its public Promise API. P11 accepts ordered OSD records plus
an explicit frontend result for `ROM_SET_INVALID`, with structured build-time
dependency validation remaining the responsibility of `pack-roms`.
