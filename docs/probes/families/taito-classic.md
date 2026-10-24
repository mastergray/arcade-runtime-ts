# Taito classic family probe

Observed 2026-10-24 on Linux x86-64 with an Intel Core i7-1165G7,
Node.js 22.22.2, GNU gzip 1.10, the pinned MAME 0.161 source archive and
Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. W28c extends the existing family with the `qix.c` board group.

## F1 — Does the target pair compile and expose every machine?

The committed [`taito-classic.lua`](../../../mame/targets/taito-classic.lua)
and [`taito-classic.lst`](../../../mame/targets/taito-classic.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the explicit threading inspection found
one fixed, non-shared 4,096-page memory with no worker or pthread marker.

```sh
BASH_ENV="$PWD/.cache/w28c-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-classic/mametaito-classic"
```

| Result | Cached-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------: | -------------------: | ---------------------: |
| Pass | 29.27 s | 165 | 165 |

The independent pinned-source derivation found the existing 148 entries plus
17 from `qix.c`, exactly matching production `-listfull`; no list correction
was needed. The `.lst` derivation header now names all fourteen driver files.

The extension compiles `drivers/qix.c`, `machine/qix.c`, `audio/qix.c` and
`video/qix.c`. The existing target already selected M6809, M6800 and M6805
for the board's two 6809 processors, 6802 audio processor and 68705 MCU, and
already carried DAC and SN76496 sound. Source inspection added the discrete
sound core. The first extended link then exposed the MC6845 video controller
and 6821 PIA selectable device cores; selecting both completed the closure,
with no further undefined unit or core.

The resulting build identity is
`f6997f33d511330c0adc2464aba30309f6ffdf2623295aa15a1d7485c67b5548`.

## F2 — What are the raw, gzip and Brotli download sizes?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Current-main baseline before extension | 5,981,822 | 1,629,493 | 1,220,547 |
| W28c extended family | 6,125,900 | 1,666,075 | 1,250,383 |
| Increase | 144,078 (2.41%) | 36,582 (2.24%) | 29,836 (2.44%) |

The extended `mametaito-classic.js` is 303,563 raw, 65,689 gzip-9 and 55,358
Brotli-11 bytes. The baseline was rebuilt from the current branch before the
target edit, so the comparison includes the same production patches and
toolchain state on both sides.

## F3 — Does the largest ROM set fit in 4,096 pages?

Summing public ROM sizes in all 165 generated metadata files leaves the
family-wide maximum unchanged in the existing `tnzs.c` group at 2,424,832
bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative estimate of 4,849,664 bytes, 2.41%
of the safe budget, leaving 196,476,928 bytes. No family machine fails the §5
estimate, so the build remains at 4,096 pages.

The `qix.c` board does not declare decoded graphics regions or a GFX decode
table; its video unit renders from direct bitmap video RAM. It therefore has
none of W28's large decoded-sprite heap risk. It also names no sample set or
EEPROM device, and every entry in the driver carries `GAME_SUPPORTS_SAVE`, so
the optional-sample, DIP-less EEPROM and quick-save exceptions do not apply.

## Browser preload audit and sandbox blocker

Both ignored preload configs were audited without logging their private
identities. Strict and MAME-compatible policies returned `ok` for each. The
`qix.c` selection had one archive with all 16 expected files valid, zero
missing, wrong-size, wrong-CRC or optional-missing files, zero warnings and
problems, and 58 harmless unexpected entries. The `bublbobl.c` selection had
one archive with 18 valid and three optional-missing expected files, zero
required missing, wrong-size or wrong-CRC files, zero warnings and problems,
and 103 harmless unexpected entries.

The required browser gate was attempted with both ignored configs:

```sh
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-classic.json,$PWD/res/preload-taito-classic-2.json" \
  npm run test:browser
```

It completed 0 passed, 29 failed and 26 skipped. Every runnable case stopped
at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium page
creation; the two requested family-measurement cases therefore produced no
browser values.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7, headless, quiet host) with the two ignored preloads: 296 ms for the `qix.c` title and 301 ms for the family's existing `bublbobl.c` title, from immediately before `adapter.start()` to the first valid, non-blank frame. The family's F4–F6 deferral is lifted.

## F5 — Are native refresh and upright geometry correct?

`qix.c` title: 256×224 horizontal at 59.186 Hz; cadences 60 Hz → 59.18 fps (−0.01 %), 90 Hz → 59.19 fps (0.00 %), 120 Hz → 59.33 fps (+0.24 %), 144 Hz → 59.16 fps (−0.04 %). `bublbobl.c` title: 256×256 vertical at 55.838 Hz; cadences 60 Hz → 55.66 fps (−0.31 %), 90 Hz → 55.85 fps (+0.03 %), 120 Hz → 55.64 fps (−0.35 %), 144 Hz → 55.82 fps (−0.04 %). Every frame at native size, first frames non-blank.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0000 (`qix.c`) and 1.0001 (`bublbobl.c`) over 60 s, frameskip disabled. M3–M5 acceptance: audio queue peak 71 ms and 67 ms; keyboard coin and start reached play on both (the `bublbobl.c` case's picture comparison failed because the title plays a long static intro after start; a headless probe with screenshots showed coin, start and play working); two pads assigned and released. The 4× CPU-throttled mobile proxy was not run.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-taito-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-classic.json" \
  npm run test:browser
```

The integrator's host run with both configs: 33 passed, 1 failed (the `bublbobl.c` acceptance picture comparison, explained above), 25 skipped by design.
