# W15 merge note: saves bridge

## Status

W15 is ready for review. Patch 0003 applies to a pristine MAME 0.161 unpack,
the rebuilt Neo Geo review source matches `mame/bridge/web_bridge.cpp`, the
threading inspector passes, and the specification and private-config browser
suites pass.

## Result

The adapter restores `memcard/<machine>.bin` before MAME starts. When the
overlay has no card, it creates a zero-filled 0x800-byte image. Neo Geo starts
with the pinned image option:

```text
-memcard /mame/memcard/<machine>.bin
```

The card is present before `callMain`, so `ng_memcard_device::call_load()`
reads it into the live card buffer. The post-first-frame flush and snapshot
include the mounted image, which keeps the first unchanged `persist()` at
`null` for both a new blank card and a restored card.

`web_flush_nvram()` now writes two persistence classes without stopping the
machine:

- every `device_nvram_interface` through MAME's existing `nvram_save()` path,
  below `/mame/nvram/`; and
- every mounted `IO_MEMCARD` image through its existing `call_unload()` writer,
  back to the still-mounted image file. For Neo Geo that is the complete live
  0x800-byte card buffer at `/mame/memcard/<machine>.bin`.

The export returns non-zero for an absent machine, a delegated NVRAM failure,
a read-only mounted card, or a card write whose final file position does not
equal its file length. It does not unmount or clear an image.

The gated Chromium case proved that the flush replaced externally changed
MEMFS card bytes with the live device buffer, `persist()` included the card in
the `memcard/` overlay root, and a fresh module restored and flushed the same
bytes. It also confirmed a BIOS-side file under `nvram/`. Runtime CPS-2 EEPROM
verification remains pending because no private CPS-2 preload was available;
the pinned source confirms its `eeprom_serial_93cxx_device` implements
`device_nvram_interface` and writes through the already-covered NVRAM path.

## Exact adapter edits

Only [`MameEmulatorAdapter.ts`](../../src/MameEmulatorAdapter/MameEmulatorAdapter.ts)
changed in the adapter implementation:

- lines 116–117: Neo Geo family and 0x800-byte card-size constants;
- line 389: card restore/create preparation after incoming overlay restore;
- lines 394–400: append `-memcard /mame/memcard/<machine>.bin` to Neo Geo
  `callMain` arguments; and
- lines 537–548: `prepareMemoryCard`, which preserves an overlay-restored file
  and creates the zeroed image only when absent.

`MameSession.ts` has no W15 changes. Its existing lines 85–90 map the
`memcard/` overlay root to `/mame/memcard`, and its existing persisted-tree
walk already includes that mapping.

## F8 state-fidelity finding

After a scheduled save, the browser case retained the next three rendered
frames. After the matching scheduled load, it retained the next three again.
The first frames were not byte-identical, and there was no matching pair
across the two three-frame sequences. Both state operations succeeded and
rendering continued at the same geometry.

A diagnostic relink that rendered the normally suppressed first emulated
frame after load produced the same result, ruling out the one-frame skip in
`web_run_frames`.

The pinned Neo Geo implementation does save palette RAM, sprite video RAM,
sprite auto-animation counters and screen timing fields. The missing state is
the MAME 0.161 screen presentation state: `screen_device` does not register
its two RGB32 bitmaps or `m_curbitmap`/`m_curtexture`, its post-load hook only
reallocates the bitmaps, and `video_manager::postload()` only resets recording
timestamps. Exact next-frame fidelity is therefore a pinned core/driver-state
limitation, not a web-bridge omission. The production bridge and strict
observation were not loosened.

## Contract and integrator questions

No §4.3.1 amendment is needed. W15 adds no JavaScript-facing export and does
not change an export signature. No integrator-owned line is requested.

The only outstanding family evidence is the explicitly permitted CPS-2
runtime follow-up: use an ignored lawful CPS-2 preload, change an EEPROM-backed
setting, persist, restart with the overlay, and verify the setting and bytes.
The source-level coverage and Neo Geo NVRAM exercise are recorded in
`docs/probes/families/cps2.md` meanwhile.

## Verification

Commands and results:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts neogeo --jobs 4 --fresh
# pass: pristine patch application, build, metadata extraction

npm run probe:mame:threading -- "$PWD/dist/mame/neogeo/mameneogeo"
# pass: one fixed 4,096-page non-shared memory, no worker or pthread markers

npm run check
# pass

npm test
# pass: 483 passed, 0 failed, 0 skipped

ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
# pass: 30 passed, 0 failed, 22 unrelated probe cases skipped
```

The branch changes only the W15 write set and its two assigned test files:

- `mame/patches/0003-nvram-flush.patch`
- the persistence export in `mame/bridge/web_bridge.cpp`
- the memory-card portions of `src/MameEmulatorAdapter/MameEmulatorAdapter.ts`
- the F8 sections of `docs/probes/families/neogeo.md` and `cps2.md`
- `tests/spec/23-mame-adapter.test.ts`
- `tests/browser/32-saves-bridge.test.ts`
- this merge note
