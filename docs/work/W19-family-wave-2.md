# W19 — Family wave 2 (`W19a` … `W19g`)

Lane: **native**. Branch: `wp/w19<letter>-<family>`. Milestone: M21.
One package per row; the agent's prompt names which. Packages are
independent of each other except where a row says it edits an existing
family. Everything in `W14-family.md` §2–§8 applies unchanged (spec
sections to read, deliverables 1–5, the F1–F6 record, the commands, the
repository rules); this brief adds the package table and the notes that
differ per family. Read W14 first, then this file.

| Package | Family | §4.6 driver sources (0.161) | Notes |
| ------- | ------ | --------------------------- | ----- |
| W19a | `sega-16` (new) | `drivers/segahang.c`, `segaorun.c`, `segaxbd.c` with their `video/` units, `machine/segaic16.c`, `video/segaic16.c`, `video/segaic16_road.c`, `video/sega16sp.c`, `machine/fd1089.c`, `machine/fd1094.c` and whatever else the `mame.lua` blocks for those drivers pull in | Encrypted 68000 program ROMs (FD1089/FD1094) decrypt at startup; road and sprite chips are per-board units |
| W19b | `midway-mcr` (new) | `drivers/mcr.c`, `mcr3.c`, `mcr68.c`, `machine/mcr.c`, `machine/mcr68.c`, `video/mcr.c`, `video/mcr3.c`, `video/mcr68.c`, `audio/midway.c` plus the Williams sound units `mcr68` configures | Z80 with the SSIO sound board; Turbo Cheap Squeak and Sounds Good boards on `mcr68`; many titles use the 49-way or spinner inputs (digital fallback acceptable for v1) |
| W19c | `konami-16` (new) | `drivers/tmnt.c`, `simpsons.c`, `xmen.c`, `gijoe.c`, `mystwarr.c`, `spy.c` with their `video/` units, the Konami video IC units (`video/k052109.c`, `k051960.c`, `k053251.c`, `k053244_k053245.c`, `k053936.c`, `k054000.c`, `k053246_k053247_k055673.c`, `k054338.c`, `k055555.c`, `k056832.c`, `k051316.c`, `konami_helper.c`), `machine/k053252.c` | KONAMI CPU core for `spy`; K007232, K053260, K054539, uPD7759, YM2151 sound; `mystwarr` is the heaviest member; EEPROM on the later boards |
| W19d | `atari-classic` (new) | `drivers/bzone.c`, `tempest.c`, `rampart.c`, `video/avgdvg.c`, `machine/mathbox.c`, `audio/redbaron.c`, `machine/atarigen.c`, `video/atarimo.c`, `machine/slapstic.c` and the discrete sound units the drivers include | **Vector screens.** `bzone` and `tempest` draw line primitives; the bridge's `rendersw.inc` software renderer draws `render_primitive::LINE`, so no bridge change is expected. F5 must state the delivered frame is not blank for a vector title; if it is, record that under F5 and stop rather than editing the bridge. `rampart` is raster (Atari G1-class) |
| W19e | `misc-16` (new) | `drivers/dec0.c`, `machine/dec0.c`, `video/dec0.c`, `drivers/karnov.c`, `video/karnov.c`, `drivers/raiden.c`, `video/raiden.c`, `audio/seibu.c`, `drivers/raiden2.c`, `drivers/r2dx_v33.c` with the `raiden2.c` machine/video units, `drivers/snowbros.c`, `video/kan_pand.c`, `drivers/shadfrce.c`, `video/shadfrce.c`, `drivers/btoads.c`, `video/btoads.c` | Data East, Seibu, Toaplan, Technos and Rare boards that share nothing but the era; one build keeps the download count down. `btoads` needs the TMS34020 core and BSMT2000; if it alone breaks the link, drop it, say so in the merge note and keep the rest |
| W19f | extend `irem-m72` and `taito-16` | add `drivers/m92.c`, `video/m92.c` and the GA20 sound core to `irem-m72`; add `drivers/taito_z.c`, `video/taito_z.c` to `taito-16` | Edits two existing target pairs, two build files, two probe records and two `FAMILY_TARGETS` rows (new expected counts). Family ids stay as they are; the descriptions in the records say "Irem M72/M92" and "Taito 16-bit incl. Z System". Re-run F1–F3 for both; F4–F6 remain as recorded unless a title from the new driver is the family's new heaviest member |
| W19g | `taito-f3` (new) | `drivers/taito_f3.c`, `video/taito_f3.c`, `audio/taito_en.c` with the ES5505/ES5510 cores and the 68EC020 core | 68020 at 16 MHz with the Ensoniq sound board; the heaviest per-frame cost in this wave, so F6 on desktop matters |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W19a–g | One package per row above: target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md`, one `FAMILY_TARGETS` row | W14 | §4.6, §13.1 | N | M21 |

## 2. What differs from W14

- `memoryPages` starts at 4096. Raise to 8192 only when F3's largest set
  estimate exceeds 75 % of the 256 MiB budget, as `cps2` and `neogeo` did.
- An ignored preload config may be present at `res/preload-<family>.json`
  in your worktree, naming a lawful local set for one title of the family.
  When it is, run the F4–F6 measurements with it as W14 §4.4 describes
  and additionally confirm the title reaches a non-blank first frame
  through the real adapter. Record numbers only; the title, its ROM names,
  hashes and the path stay out of every tracked file.
- Do not run `npm run build`, `npm run clean` or `build-mame --all`. Build
  your family only, with `--jobs 4`.
- The `.lst` derivation command in the header must list every driver
  source of your package, as the existing lists do.
- `tests/spec/32-build-output.test.ts` validates every family in
  `mame/builds/`; it must pass with your build output present.

## 3. Definition of ready for review

W14 §6, plus the merge note states for each title the preload config
named (without naming it) whether the first frame arrived and whether
F4–F6 were measured or are pending.
