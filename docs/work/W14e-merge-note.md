# W14e merge note — Taito classic

## Delivered

- `mame/targets/taito-classic.lua`: thirteen-driver target with every adjacent
  machine/video unit, the shared Taito 8741 helper and SETA001 sprite unit.
- `mame/targets/taito-classic.lst`: 148 public machines independently derived
  from the pinned driver declarations and annotated by source.
- `mame/builds/taito-classic.json`: production build input with 4,096 memory
  pages.
- `docs/probes/families/taito-classic.md`: complete F1–F6 record; F1–F3 are
  measured and F4–F6 are pending a lawful private set.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row with
  the thirteen sources and derived count.

No integrator-owned source or package export line is needed.

## Production artifact

The required command completed from this worktree in 212.14 seconds and the
explicit threading inspection passed with one fixed, non-shared 4,096-page
memory, no worker artifact and `requiresPthreads: false`.

| Ignored artifact | Contents / bytes |
| ---------------- | ---------------: |
| `dist/mame/taito-classic/build.json` | 3,771 bytes; 148 machines |
| `dist/mame/taito-classic/mametaito-classic.js` | 303,449 bytes |
| `dist/mame/taito-classic/mametaito-classic.wasm` | 5,978,352 bytes |
| `dist/mame/taito-classic/romsets/` | 148 files; 502,961 bytes |
| `dist/mame/taito-classic/notices/` | 13 files; 561,238 bytes |

Build ID:
`a0128bde90e702fa599aea35cd9dc24c1f94d730cd2848c6dcbef4222277c11b`.

## Target corrections and spec note

Source inspection showed that §4.6's Taito classic shorthand is incomplete for
the thirteen selected 0.161 driver units. In addition to its named cores, the
target needs M6809 for the `gladiatr.c` set, MCS51 for the `superqix.c` I8751, and YM2151,
MSM5205, MSM5232 and SN76496 sound cores. The source set also needs
`machine/tait8741.c` and `video/seta001.c`.

The first complete compile reached the link and reported the sole iterative
correction: `slapfght.c` references `BUFFERED_SPRITERAM8`, requiring
`VIDEOS["BUFSPRITE"] = true`. The corrected clean-source build completed; the
derived list required no correction. The integrator should consider updating
the §4.6 row to name the M6809 and I8751/MCS51 CPU dependencies and the omitted
sound cores. No build-pipeline change was needed.

## Integrator follow-up

No lawful private set was available, so the integrator must complete the
measurements recorded verbatim under F4–F6 in the family probe:

- F4: monotonic milliseconds immediately before `callMain()` through the first
  valid `onFrame`, plus Chromium version, desktop CPU and cold/warm module and
  HTTP cache state.
- F5: expected and observed upright width/height/orientation for a lawful
  vertical set, and observed refresh plus percentage error under controlled
  60, 90, 120 and 144 Hz cadences; every error must be within 0.5%.
- F6: after warm-up, exactly 60 seconds of
  `(onTick count / native refresh Hz) / wall-clock seconds` on desktop and with
  Chromium's 4× CPU throttle, recording CPU, OS, Chromium, native refresh and
  frameskip state. Desktop full speed is the family gate.

Private machine selection, archive names, hashes and paths must remain only in
the ignored preload configuration and must not be added to tracked evidence.

## Verification

- `npm run check`: pass.
- `npm test`: pass, 472/472 cases.
- `npm run test:browser`: pass/skip as configured, 20 passed, 25 skipped and
  zero failed. The production adapter cases skipped because
  `ARCADE_PRELOAD_CONFIG` is unavailable, matching the F4–F6 disposition.
