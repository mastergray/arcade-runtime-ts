# Atari classic family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The extended [`atari-classic.lua`](../../../mame/targets/atari-classic.lua)
and [`atari-classic.lst`](../../../mame/targets/atari-classic.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w28a-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-classic/mameatari-classic"
```

| Result | Successful corrected build | `-listfull` machines | ROM-set metadata files |
| ------ | -------------------------: | -------------------: | ---------------------: |
| Pass | 34.53 s | 31 | 31 |

The independent derivation found 15 machines in the three original driver
sources and 16 in `centiped.c`; its 31-entry result exactly matched
production `-listfull`, so no list correction was needed. The extension adds
only `drivers/centiped.c` and `video/centiped.c` as compilation units.

The brief's 6502/POKEY/EAROM shorthand covers the configured measurement
board, but complete driver coverage also compiles public configurations that
instantiate the S2650 CPU, AY8910 and SN76496. A diagnostic link exposed
those undefined cores; selecting them resolved every symbol. Existing
`machine/atari_vg.c`, parallel EEPROM and ER2055 selections already cover the
driver's EAROM and multigame configuration.

The successful build identity is
`830093aedf306139b771ea81811f5dc586fa9c3bfbb8c066804a5ac376a8c60a`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching
[`family-sizes.md`](../mame0161/family-sizes.md).

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,022,964 | 1,556,676 | 1,169,229 |
| After extension | 6,193,930 | 1,597,000 | 1,199,086 |
| Increase | 170,966 (2.84%) | 40,324 (2.59%) | 29,857 (2.55%) |

The extended JavaScript artifact is 303,108 raw, 65,662 gzip-9 and 55,408
Brotli-11 bytes. It grew by 1,024 raw, 66 gzip and 52 Brotli bytes.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing public ROM sizes in all 31 generated metadata files leaves the
whole-family maximum unchanged at 1,707,786 bytes in an original driver
source. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Counting the full uncompressed sum once for supplied archive bytes and once
for loaded regions gives a conservative 3,415,572-byte estimate, 1.70% of
the safe budget, leaving 197,911,020 bytes. The largest `centiped.c` metadata
sum is 82,176 bytes, or 164,352 bytes under the same two-copy estimate.

The new driver does decode graphics, but only through small 8×8 and 8×16
planar layouts; its largest declared `gfx1` region is 16 KiB. It does not
have the large decoded graphics regions that caused the earlier 4,096-page
browser abort in another family. No family machine fails the metadata
estimate, so this build remains at 4,096 pages. If the unrestricted browser
run nevertheless reports the adapter's `needs more memory` error, the
prescribed fallback is `memoryPages: 8192` followed by a family-only rebuild.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Pending for the private title from `centiped.c`. The required real-browser
command was attempted, but the family measurement could not bind its
loopback test server (`listen EPERM`), so no first frame arrived and no
startup duration can be claimed.

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

The ignored preload was audited without logging its identity. Strict and
MAME-compatible policies both returned `ok`: one archive present, all seven
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 61 harmless unexpected
entries.

Earlier evidence for the original driver sources remains 299–457 ms to the
first valid frame. The integrator should record the new driver's Chromium
wall time from immediately before `callMain()` to the first valid frame.

## F5 — Are native refresh, upright geometry and output correct?

Pending for `centiped.c`. Source inspection expects the configured rotated
raster board to arrive upright at 240×256 from a 256×240, 60 Hz screen, but
the sandbox produced no browser frame. The integrator must record actual
geometry and refresh plus controlled 60/90/120/144 Hz cadence errors.

The configured board's generated metadata declares nine DIP switches and no
sample set. Its source entry carries `GAME_SUPPORTS_SAVE`, so neither the
EEPROM/no-DIP selector exception nor the unsupported quick-save case applies.
Its EAROM persistence is part of the existing Atari device path.

Earlier whole-family evidence remains valid: the original vector sources
delivered non-blank upright 640×480 and 480×640 frames, the raster source
delivered 336×240 frames, and the quiet confirming cadence run stayed within
0.44% of native refresh.

## F6 — Does the heaviest title sustain full speed?

Pending for the private `centiped.c` title. The browser suite completed 0
passed, 33 failed and 25 skipped: loopback was denied for the family case,
and the socket-free bridge case separately reached Chromium launch but the
sandbox denied Chromium's `shutdown()` IPC operation. No 60-second desktop
or informational 4×-throttled ratio is available.

On an unrestricted host, rerun the command under F4 after the other wave
builds are idle, warm the machine, and record exactly 60 seconds of emulated
time divided by wall time. Earlier original-driver desktop ratios were
0.9999–1.0003.

## F11 — Which analogue and dual-stick ports occur?

`bzone.c` declares a dual-stick board plus `IPT_AD_STICK_X/Y/Z` fields. The
generated left/right-stick sequences synthesize both sticks from `HAT1` and
also bind them independently to `HAT3` and `HAT2`. Its analogue ranges are
64–192 for X/Y and 0x10–0xf0 for reversed Z, with sensitivity 25 and key
delta 10; standard X/Y/Z rows, hat ramps and `BUTTON13/14` bind them.

`tempest.c` declares `IPT_DIAL` for players 1 and 2 over the 0x0f mask, with
sensitivity 100, key delta 20 and full-turn count 72. `JOYCODE_n_ADDREL1`
supplies relative pixels and `HAT1LEFT/RIGHT` supplies the digital fallback.

`rampart.c` declares `IPT_TRACKBALL_X/Y` for players 1–3 over 8-bit halves
of the input words, all sensitivity 100, key delta 30 and reverse. X uses
`JOYCODE_n_ADDREL1` plus `HAT1LEFT/RIGHT`; Y uses `JOYCODE_n_ADDREL2` plus
`HAT1UP/DOWN`.

`centiped.c` declares full-range `IPT_TRACKBALL_X/Y` fields at sensitivity
50 and key delta 10, with reverse on the primary X and cocktail Y fields.
The same relative-axis and hat rows used by `rampart.c` bind them. It also
declares `IPT_PADDLE` for players 1–4 at 0x1d–0xcb, sensitivity 50, key
delta 10 and centre delta 0; standard X axes and `HAT1LEFT/RIGHT` bind those
fields. Finally, its prototype configuration declares `IPT_AD_STICK_X/Y` for
players 1 and 2 at 0x40–0xbf, sensitivity 100 and key delta 10, with reverse
on player 1 Y and player 2 X; standard X/Y axes and hat ramps bind them.
