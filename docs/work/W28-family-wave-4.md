# W28 — Family wave 4 (`W28a` … `W28h`)

Lane: **native**. Branch: `wp/w28<letter>-<slug>`. Milestone: M36.
Unlike wave 3, the packages of this wave run **concurrently**, up to three
agents at a time, each in its own worktree and branch, because the user
wants to hand-test every board of the wave together. Each package edits a
different family (or creates one), so the only shared file is the
`FAMILY_TARGETS` array in `tests/spec/04-mame-family-targets.test.ts`; keep
your row self-contained so the integrator can merge the branches in any
order. Everything in `W14-family.md` §2–§8, `W19-family-wave-2.md` §2 and
`W27-family-wave-3.md` §2 applies unchanged. Build your family with
`--jobs 4` (three builds share eight threads).

| Package | Family | §4.6 driver sources (0.161) | Notes |
| ------- | ------ | --------------------------- | ----- |
| W28a | extend `atari-classic` | add `drivers/centiped.c`, `video/centiped.c` | 6502 with POKEY and the EAROM; the family already carries every core. Edit the target pair, build file, probe record and `FAMILY_TARGETS` row as W19f did; re-run F1–F3 for the family; F4–F6 for the new driver's title |
| W28b | extend `midway-mcr` | add `drivers/williams.c`, `machine/williams.c`, `video/williams.c` (`audio/williams.c` is already in the family) | 6809 with the 6808 sound board, PIAs and the CVSD speech chip, all present. One title uses blitter-heavy video; measure it. Same edit pattern |
| W28c | extend `taito-classic` | add `drivers/qix.c`, `machine/qix.c`, `audio/qix.c`, `video/qix.c` and the discrete sound core | Two 6809s, a 6802 sound CPU and a 68705; the family already carries the CPUs and SN76489. The family was built but deferred for lack of a measured set: run F4–F6 on **both** the ignored preload configs the integrator supplies (the new driver's title and the family's existing `bublbobl.c` title) so the family rejoins the matrix |
| W28d | `nintendo-classic` (new) | `drivers/dkong.c`, `audio/dkong.c`, `video/dkong.c` and whatever its `mame.lua` block adds (the 8035-family sound CPU, the NES APU and 2A03 for the third title, the M58817 speech device, discrete sound) | Three local titles on one driver; the discrete sound core is the CPU cost to watch. Leave room for `mario.c` and `popeye.c` later but do not add them |
| W28e | extend `midway-tunit` | add `drivers/midwunit.c`, `machine/midwunit.c` (the video unit is shared with `midtunit.c`) | Wolf Unit: same TMS34010 and DCS board as T-Unit; 16 machines. F6 decides whether the heavier 1996 title sustains; the DCS volume note (M33) applies |
| W28f | extend `atari-gauntlet` | add `drivers/toobin.c`, `video/toobin.c`, `audio/atarijsa.c` | 68010 with the JSA sound board (6502, YM2151, POKEY, TMS5220, all present); the JSA unit is the only addition |
| W28g | extend `misc-16` | add `drivers/cninja.c`, `video/cninja.c`, `video/deco16ic.c`, `video/decocomn.c`, `machine/deco146.c` (or whichever protection unit the driver configures in 0.161) | Data East 68000 with the H6280 sound CPU; the family already has the earlier Data East boards and YM2151/YM2203/OKI |
| W28h | `leland` (new) | `drivers/leland.c`, `machine/leland.c`, `audio/leland.c`, `video/leland.c` and the 80186 core | Twin Z80s with an 80186 sound CPU and DACs; nothing else shares it. The local title is `GAME_SUPPORTS_SAVE`-less; the quick-save case fails for it (M35), record and move on |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W28a–h | One package per row above: target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md`, one `FAMILY_TARGETS` row | W14, W19, W27 | §4.6, §13.1 | N | M36 |

## 2. What differs from W27

- Concurrency: see the header. Never touch another package's family files.
- Memory: the W27e board aborted out of memory at boot on 4,096 pages
  although the metadata-only F3 estimate said it fit (the driver decodes
  8-bit sprites into gfx elements). Say in the probe record whether your
  driver decodes large graphics regions and, if the integrator's browser run
  aborts with the adapter's "needs more memory" error, the fix is
  `memoryPages: 8192`.
- Samples: a driver that names sample sets (the Gottlieb board is the known
  one in the library, not in this wave) runs without them; record it, do
  not hunt for files.
- EEPROM boards declare no DIP switches and the production DIP-selector
  case handles that; drivers without `GAME_SUPPORTS_SAVE` fail the harness
  quick-save case until M35; both are recorded, not fixed, in this wave.

## 3. Definition of ready for review

W14 §6 and W19 §3. The merge note states the `.lst` machine count, the wasm
size (before and after, for an extension) and the build id.
