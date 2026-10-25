# Capcom/Mitchell family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, ROM hash or resolved path is
recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed
[`capcom-mitchell.lua`](../../../mame/targets/capcom-mitchell.lua) and
[`capcom-mitchell.lst`](../../../mame/targets/capcom-mitchell.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and both the pipeline and explicit threading
gates reported one fixed, non-shared 4,096-page memory with no worker or
pthread markers.

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts capcom-mitchell --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/capcom-mitchell/mamecapcom-mitchell"
```

| Result | Wall time | `-listfull` machines | ROM-set metadata files |
| ------ | --------: | -------------------: | ---------------------: |
| Pass | 181.46 s | 29 | 29 |

The independently derived list contains 29 machines from
`drivers/mitchell.c` and matched the production count without a list
correction. The source group contains `drivers/mitchell.c`,
`video/mitchell.c` and its own compiled copy of `machine/kabuki.c`; it does not
link the decoder object from either CPS family.

The target selects the Z80 core; OKIM6295, YM2413, YM3812 and MSM5205 sound;
and the serial-EEPROM device. This covers the main Kabuki-decrypted path and
the second-Z80 and alternate-sound bootleg paths in the driver unit. A harmless
Centronics core keeps the pinned release's mandatory bus archive non-empty.
The complete source closure compiled and linked without a missing unit or
selectable core. The resulting build identity is
`36c741bddc5cd2b8a2df82910e49cbc5ea48656c7eb6853ba57428dafb2d7d63`.

The mahjong configurations in `drivers/mitchell.c` declare `IPT_MAHJONG_*`
keyboard-matrix ports. The runtime's standard arcade controls do not bind
that matrix, so those public machines remain present in the family but need a
future matrix-input path for play. The quiz configurations use ordinary
button fields and remain in the same complete driver list.

The ignored preload selects an EEPROM configuration whose generated metadata
declares zero DIP switches; the production selector correctly treats that as
nothing to select. Source inspection of that selection finds no `PORT_CODE`
fields, so its expected `inputs.keys` rows are `[]`. Its driver declaration
does include `GAME_SUPPORTS_SAVE`, so `supportsSave` is expected to be `true`.
The pending host browser run must confirm both reported runtime values.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,009,704 | 1,412,148 | 1,067,101 |
| JavaScript | 301,923 | 65,594 | 55,369 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 3,178,496 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
6,356,992 bytes, 3.16% of the safe budget, leaving 194,969,600 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

`drivers/mitchell.c` does use static graphics decode layouts, but it does not
carry a W27e-scale graphics region. Its largest layout expands 65,536 8×8
characters to 4,194,304 one-byte decoded pixels, and the corresponding 2,048
16×16 sprite layout adds 524,288 pixels. The other fractional layouts remain
in the same small range. If the integrator's browser run nevertheless reports
the adapter's fixed-heap error, raise this family to `memoryPages: 8192` and
rebuild before repeating F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Pending integrator browser run. This sandbox cannot run Chromium or bind the
loopback test server, so no first frame was observed. Measure from the call to
`callMain` through the first valid, non-blank frame and record the slowest
startup result without disclosing the private selection.

## F5 — Are native refresh and upright geometry correct?

Pending integrator browser run for the same sandbox limitation. Confirm the
first frame is non-blank, record upright native geometry and refresh, and run
the controlled 60, 90, 120 and 144 Hz scheduler cadences. The pinned driver
configuration selected by the ignored preload declares 384×240 horizontal
output at 57.42 Hz; that is source expectation, not browser evidence.

## F6 — Does the heaviest title sustain full speed?

Pending integrator browser run for the same sandbox limitation. There is no
measured desktop ratio yet. Run 60 seconds with frameskip disabled and record
emulated seconds divided by wall seconds; the 4× CPU-throttled proxy remains
informational.

Run F4–F6 without disclosing the private selection by setting a shell variable
to the ignored family preload and using it for both browser inputs:

```sh
ARCADE_PRELOAD_CONFIG="$PRIVATE_FAMILY_PRELOAD" \
ARCADE_FAMILY_CONFIGS="$PRIVATE_FAMILY_PRELOAD" \
  npm run test:browser
```

The integrator should also confirm that the production machine report has
`inputs.keys: []` and `supportsSave: true`, and that the zero-DIP selector case
does not block startup.
