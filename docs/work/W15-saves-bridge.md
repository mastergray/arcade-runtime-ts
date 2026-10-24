# W15 — Saves bridge: memory card, EEPROM and state fidelity (F8)

Lane: **native**. Branch: `wp/w15-saves-bridge`. Milestone: M6.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W15 | Saves bridge: memory card and EEPROM coverage in `web_flush_nvram`, F8 record | `mame/patches/0003-*`, `mame/bridge/` (persistence paths only), `docs/probes/families/*` (F8 rows only) | W3, W4 | §4.3, §12 M6, §12.2 is *not* yours | N | M6 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.3 (the `web_flush_nvram`
row and the P8 constraints), §4.3.1 (`hasNvram`, `web_flush_nvram`), §2.4
(overlay roots, including `memcard/`), §5 (persist and the boot snapshot),
§13.1 F8 (all three questions), §12 M6's acceptance row.

Then `docs/work/W3-merge-note.md` ("NVRAM observation"),
`docs/work/W4-merge-note.md` ("MEMFS and overlay layout", "Real-module
observations"), `mame/bridge/web_bridge.cpp`, `mame/patches/0003-nvram-flush.patch`,
`docs/probes/mame0161/bridge-hooks.md` ("Persistence (P8)").

What the pinned source says, which you should confirm rather than take on
trust: the Neo Geo memory card (`src/mame/machine/ng_memcard.c`) is a
`device_image_interface`, not a `device_nvram_interface`, so
`nvram_save()` never touches it; it is loaded from a mounted image file
(`call_load` reads 0x800 bytes) and written back through the image
interface. The CPS-2 EEPROM is an `eeprom_serial_93cxx_device`, which *is*
a `device_nvram_interface`, so the existing flush should already cover it.

## 3. Write set

Exclusive: `mame/patches/0003-nvram-flush.patch` (regenerate it), the
persistence paths of `mame/bridge/web_bridge.cpp` (keep every other export
byte-identical), `src/MameEmulatorAdapter/MameSession.ts` and
`MameEmulatorAdapter.ts` **only** where the memory-card mount and the
`memcard/` root are concerned (say exactly which lines in the merge note),
the F8 sections of `docs/probes/families/neogeo.md` and `cps2.md`, plus
your tests: additions to `tests/spec/23-mame-adapter.test.ts` for the
memory-card mount argv and overlay root, and
`tests/browser/32-saves-bridge.test.ts` (gated on `ARCADE_PRELOAD_CONFIG`).

## 4. Deliverables

1. **Memory card persistence.** Make a Neo Geo memory card survive
   `persist()` and a restart:
   - The adapter mounts a card image at `/mame/memcard/<machine>.bin`
     through the 0.161 image option for the `memcard` device (find the
     exact option name in `src/emu/emuopts.c` / the image interface:
     `-memcard <path>` or the device's instance name). When the overlay
     carries `memcard/<machine>.bin` it is restored first; otherwise the
     adapter writes a fresh 0x800-byte zeroed card so the device mounts.
   - `web_flush_nvram()` additionally writes every mounted
     `IO_MEMCARD` image device's data back to its file without unmounting
     (study `ng_memcard_device::call_unload` / the image save path and
     call the narrowest equivalent). Return non-zero on any write failure.
   - The `memcard/` overlay root is already walked by `persistedTree`;
     confirm the file appears in the overlay after a card write and that
     the boot snapshot (§5 step 4) does not report the freshly mounted
     empty card as a change.
2. **EEPROM confirmation.** Confirm with evidence that the existing flush
   writes the CPS-2 EEPROM file (`nvram/<machine>/...`) mid-run; if no
   CPS-2 set is available, confirm on the Neo Geo title's BIOS-side NVRAM
   that the path is exercised and record CPS-2 as pending.
3. **F8 state fidelity.** Answer the third F8 question for Neo Geo: after
   `saveState` then `loadState`, compare the next rendered frame with the
   frame after the save; if they differ, identify what the 0.161 driver
   or the bridge omits (screen bitmap, sprite RAM timing, the one-frame
   skip after load in `web_run_frames`) and either fix it in the bridge
   when it is a bridge omission, or record precisely which driver state
   is missing when it is a driver limitation. Do not loosen any test.
4. **Record** F8 in `docs/probes/families/neogeo.md` (and `cps2.md` for
   the EEPROM half) with commands and observations, no private identity.
5. **Tests.** Spec: the adapter writes the card file and mount argument
   and maps `memcard/`. Browser (gated): start, write something the game
   persists to the card if the title allows it (otherwise write a known
   pattern into the mounted file through the bridge's flush path and read
   it back), `persist()` returns an overlay containing `memcard/…`,
   restart with that overlay and read the same bytes; save-state fidelity
   observation reported as data.

## 5. Contracts and doubles

§4.3.1 is frozen; adding an export is a contract amendment (write it up
and stop). `tests/support/FakeModuleLoader` for the spec additions.

## 6. Definition of ready for review

`docs/work/README.md` rule 8; the production patches still apply cleanly
to a pristine unpack (the existing spec case checks this); the threading
inspector still passes on a rebuilt `neogeo` artifact; the browser case
passes with the private config on your machine.

## 7. Repository rules that bite here

- Native lane: links as in `docs/work/README.md`; rebuild with
  `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts neogeo --jobs 4`
  into your worktree's `dist/` (do not touch the main checkout's `dist/`).
- No private identity in tracked files.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
ln -sfn ~/dev/mame-runtume-ts/res/emsdk res/emsdk
ln -sfn ~/dev/mame-runtume-ts/res/mame0161s.zip res/mame0161s.zip
EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts neogeo --jobs 4
npm run check && npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```
