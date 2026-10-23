# W27 — Family wave 3 (`W27a` … `W27h`)

Lane: **native**. Branch: `wp/w27<letter>-<family>`. Milestone: M29.
One package per row; the agent's prompt names which. Packages run **one
at a time** in the order of the table, because each lands before the user
can audit their archive for its boards. Everything in `W14-family.md`
§2–§8 and `W19-family-wave-2.md` §2 applies unchanged (spec sections,
deliverables 1–5, the F1–F6 record, the commands, the repository rules,
`memoryPages`, the ignored preload config, the `.lst` derivation header,
`tests/spec/32-build-output.test.ts`). Read W14 and W19 first, then this
file. Production patch `0005-devfind-ioport-array-tag.patch` is part of
the patch set these builds apply; several of these drivers declare their
ports through the array finder it fixes.

| Package | Family | §4.6 driver sources (0.161) | Notes |
| ------- | ------ | --------------------------- | ----- |
| W27a | `sega-s16` (new) | `drivers/segas16a.c`, `segas16b.c`, `segas18.c` with their `video/` units; `machine/segaic16.c`, `video/segaic16.c`, `video/segaic16_road.c`, `video/sega16sp.c`, `machine/315_5296.c`, `machine/fd1089.c`, `machine/fd1094.c`, `machine/mc8123.c`, `machine/segacrpt.c`, plus the i8751 (MCS-51) core `segas16b.c` configures and the 315-5313 VDP, RF5C68 and SN76496 units `segas18.c` pulls in through its `mame.lua` block | FD1089/FD1094/MC-8123 decryption at startup as in `sega-16`. One System 16B parent in the user's library is `GAME_NOT_WORKING` in 0.161 (undumped MCU); its clones run, so the F4–F6 title is a System 18 set. The two families share `segaic16`, `fd1089`, `fd1094`, `sega16sp`: that is fine, each family is its own build |
| W27b | `midway-tunit` (new) | `drivers/midtunit.c`, `machine/midtunit.c`, `video/midtunit.c`, `audio/williams.c` (ADPCM board), `audio/dcs.c` (DCS board, ADSP-2105) and the TMS34010 core; `drivers/midyunit.c` with its units **only if** the `.lst` count and the link stay within budget, else leave Y-Unit for a later package and say so | The later fighting title uses DCS, so the DSP core is required; F6 on the DCS title is the family's gate |
| W27c | `atari-gauntlet` (new) | `drivers/gauntlet.c`, `video/gauntlet.c`, `machine/atarigen.c`, `video/atarimo.c`, `machine/slapstic.c`, `audio/atarijsa.c` is **not** used here (the board has its own 6502 sound with YM2151, POKEY, TMS5220) — take exactly what the `mame.lua` block lists | Four-player board; the bridge already carries four pads |
| W27d | `namco-nb` (new) | `drivers/namconb1.c`, `video/namconb1.c`, `machine/namcoic.c`, `video/namcoic.c` (shared with `namco-s2`, fine), the C352 sound core, the M37710 sound CPU core | NB-1/NB-2; the local set is NB-2 with `GAME_IMPERFECT_SOUND` |
| W27e | `seta-2` (new) | `drivers/seta2.c`, `video/seta2.c`, the TMP68301 device, X1-010 sound | `GAME_IMPERFECT_GRAPHICS` on the local title is MAME's, record it under F5 |
| W27f | extend `sega-16` | add `drivers/segaybd.c`, `video/segaybd.c` and whatever its `mame.lua` block adds beyond the family's existing units | Three 68000s with the X Board's sprite scaler lineage; **F6 decides** whether it stays in the family. Edits the existing target pair, build file, probe record and `FAMILY_TARGETS` row as W19f did; re-run F1–F3 for the family; F4–F6 for the new driver's title |
| W27g | extend `taito-f3` | add `drivers/superchs.c`, `video/superchs.c` and its `mame.lua` additions (the Ensoniq board is already in the family) | Analogue steering; same edit pattern as W27f; F6 decides |
| W27h | `sega-s32` (new) | `drivers/segas32.c`, `machine/segas32.c`, `video/segas32.c`, the V60/V70 core, the 315-5560 "MultiPCM" and RF5C68 sound, `machine/315_5296.c` | V60 at 16 MHz: the heaviest board of the whole matrix. Build and measure; if F6 fails on desktop the family is recorded as "built, below the gate" and leaves the 1.0.0 matrix without further work |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W27a–h | One package per row above: target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md`, one `FAMILY_TARGETS` row in `tests/spec/04-mame-family-targets.test.ts` | W14, W19, W26 | §4.6, §13.1 | N | M29 |

## 2. What differs from W19

- Analogue boards (`W27f`, `W27g`) need nothing from you beyond the
  build: W26's generator binds their `AD_STICK`, `PADDLE` and `PEDAL` ports
  and the probe record's F11 paragraph lists the port types, min/max,
  sensitivity and key delta from the driver source, by driver file and
  port type only.
- The F4–F6 title is whichever set the ignored preload config names; if
  its archive is incomplete for 0.161 the audit report says which files,
  and you record "F4–F6 pending: set incomplete" and the missing-file
  count rather than hunting for files.
- The merge note states the `.lst` machine count, the wasm size and the
  build id, and for a family that misses F6 says so plainly with the
  measured ratio.

## 3. Definition of ready for review

W14 §6 and W19 §3.
