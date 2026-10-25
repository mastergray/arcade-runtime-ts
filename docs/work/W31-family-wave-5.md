# W31 — Family wave 5 (`W31a` … `W31c`)

Lane: **native**. Branch: `wp/w31<letter>-<slug>`. Milestone: M40.
The three packages run **concurrently**, each in its own worktree and
branch, as wave 4 did. Each edits a different family (or creates one), so
the only shared file is the `FAMILY_TARGETS` array in
`tests/spec/04-mame-family-targets.test.ts`; keep your row self-contained
so the integrator can merge the branches in any order. Everything in
`W14-family.md` §2–§8, `W19-family-wave-2.md` §2, `W27-family-wave-3.md`
§2 and `W28-family-wave-4.md` §2 applies unchanged. Build your family with
`--jobs 4` (three builds share eight threads).

| Package | Family | §4.6 driver sources (0.161) | Notes |
| ------- | ------ | --------------------------- | ----- |
| W31a | `nintendo-vs` (new) | `drivers/vsnes.c`, `machine/vsnes.c`, `video/vsnes.c`, `video/ppu2c0x.c` (the PPU lives under `src/mame/video/` in 0.161, not in the device library) | The 2A03 is `CPUS["M6502"]` with `SOUNDS["NES_APU"]`; the driver also wants `SN76496`, `DAC`, `MACHINES["RP5H01"]` and `Z80` (one bootleg set). Two-screen sets (`vsdual`) declare a second PPU and screen: keep them in the `.lst`, say in the probe record what the bridge does with the second screen (it renders the first), and measure a single-screen set. DIP-switch heavy board (the per-game switches select the controller type, several sets alternate the two players on one control panel); the F4–F6 set is the one the ignored preload config names |
| W31b | `capcom-mitchell` (new) | `drivers/mitchell.c`, `video/mitchell.c`, `machine/kabuki.c` (the same decoder `cps1` and `cps2` compile; this family gets its own copy of the object, not a link to theirs) | Z80 with Kabuki decryption, `OKIM6295`, `YM2413`, the bootleg's `YM3812`, `MSM5205` and second Z80, `EEPROMDEV` (93C46). The driver also carries the mahjong and quiz sets of the same board: keep them in the `.lst`; the mahjong sets declare keyboard-matrix ports the runtime does not bind, record that. EEPROM board: no DIP switches, the production DIP-selector case handles it |
| W31c | extend `taito-f3` | add `drivers/superchs.c`, `video/superchs.c`, `video/tc0480scp.c` (`taito-16` already compiles that chip; this family gets its own object) | 68EC020 with a 68000 sub CPU and the Ensoniq board the family already carries. Analogue steering and pedals through W26's generator; the probe record's F11 paragraph lists the port types. The sprite region is 8 MB and is decoded at start-up: expect `memoryPages: 8192` and say so; a rebuild of the whole family follows, so state the wasm size before and after. The sets carry an artwork layout (`GAMEL`): the bridge ignores layouts, note it |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W31a–c | One package per row above: target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md`, one `FAMILY_TARGETS` row | W14, W19, W27, W28 | §4.6, §13.1 | N | M40 |

## 2. What differs from W28

- The bridge now rebinds `PORT_CODE` fields and exposes operator keys
  (W29) and `supportsSave`: the probe record's input paragraph lists the
  `inputs.keys` rows your title reports if the driver has coded fields,
  and says whether the driver is `GAME_SUPPORTS_SAVE`.
- The shim for the pinned Emscripten link step is already in your
  worktree at `.cache/w29-bash-env.sh` and `.cache/w29.emscripten`; build
  with `BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts <family> --jobs 4`.
- A new family's first build unpacks the source tree; do not pass
  `--fresh`.

## 3. Definition of ready for review

W14 §6 and W19 §3. The merge note states the `.lst` machine count, the
wasm size (before and after, for the extension), the memory pages, the
build id and, for a family that misses F6, the measured ratio.
