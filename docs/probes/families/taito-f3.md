# Taito F3 family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive and
Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is present; no private machine,
archive, file, hash or resolved-path identity is recorded here.

## F1 — Does the target pair compile and expose every machine?

The extended [`taito-f3.lua`](../../../mame/targets/taito-f3.lua) and
[`taito-f3.lst`](../../../mame/targets/taito-f3.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
path with all 94 independently derived machines. Bulk `-listxml` exhausted
the heap because each enumerated F3 configuration embeds a 64 MiB Ensoniq
DRAM array; the production pipeline's established per-machine fallback then
generated all 94 metadata files. The explicit threading gate reported one
fixed, non-shared 8,192-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-f3/mametaito-f3"
```

| Result | Wall time | `-listfull` machines | ROM-set metadata files |
| ------ | --------: | -------------------: | ---------------------: |
| Pass | 44.86 s | 94 | 94 |

The list is the sorted union of public entries from `drivers/taito_f3.c` and
`drivers/superchs.c`; it grew from 90 to 94 with no list correction. The
existing family already selected the M680X0, ES5510, ES5505, OKIM6295,
EEPROM, MC68681 and MB87078 paths. The extension adds
`drivers/superchs.c`, `video/superchs.c` and `video/tc0480scp.c`. Its first
link exposed the TC0480SCP implementation's dependency on the shared Taito
scanline helper; adding the upstream vendor block's `video/taito_helper.c`
resolved the only undefined symbol. The build identity is
`f231ac18aa4e07c0c9316d8882c8985f35d52556077b47f2ebff7ba98f9e0d6e`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,822,132 | 1,553,123 | 1,171,941 |
| JavaScript | 302,027 | 65,567 | 55,376 |

An immediately preceding production build of the unextended 90-machine
family produced a 5,770,347-byte Wasm. The extension therefore adds 51,785
raw Wasm bytes.

## F3 — Does the largest ROM set fit, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a
family-wide maximum of 41,943,040 bytes, unchanged by the extension. The
safe adapter budget is:

```text
8,192 × 65,536 × 0.75 = 402,653,184 bytes (384 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
83,886,080 bytes, 20.83% of the safe budget, leaving 318,767,104 bytes. No
machine fails the §5 estimate.

The build nevertheless uses 8,192 pages. `drivers/superchs.c` declares an
8 MiB sprite region and a 4-bit `gfx_layout` that MAME decodes into live gfx
elements at startup while retaining the source region. That expansion is not
represented by the two-copy metadata estimate and is the same class of hidden
working-set cost that exhausted a 4,096-page build in an earlier family. The
larger fixed heap is therefore required for the added board; the pending host
browser run remains the live-start confirmation.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

**Pending: this sandbox cannot bind loopback sockets or run Chromium.** No
first-frame or non-blank-frame result is claimed for the added driver. The
integrator should measure wall-clock time immediately around `adapter.start()`
through the first valid, non-blank frame with the ignored preload:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-superchs.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-superchs.json" \
  npm run test:browser
```

## F5 — Are native refresh and upright geometry correct?

**Pending for the same sandbox restriction.** The integrator should record
native refresh, upright width and height, non-blank output, and observed rates
at controlled 60, 90, 120 and 144 Hz scheduler cadences. The added entries use
an artwork layout through `GAMEL`; the runtime bridge does not expose that
layout or its artwork controls and presents the first emulated screen, so the
measurement is of that screen alone.

## F6 — Does the heaviest title sustain full speed?

**Pending for the same sandbox restriction.** After warm-up, the integrator
should record `emulated seconds / wall seconds` over exactly 60 seconds on a
quiet desktop with frameskip disabled. The 4× CPU-throttled proxy remains
informational.

## F11 — Which analogue and dual-stick ports occur?

`drivers/superchs.c` declares a player-1 `IPT_PADDLE` over the full
0x00–0xff range, defaulting to 0x80, at sensitivity 100, key delta 4 and
centre delta 4, with reverse enabled. W26 binds it to the standard X axis and
`HAT1LEFT/RIGHT` decrement/increment sequences.

The same driver declares a player-1 `IPT_PEDAL` over the full 0x00–0xff
range, defaulting to 0x00, at sensitivity 100, key delta 15 and centre delta
15, without reverse. W26 binds it to the standard RX axis and the `BUTTON13`
increment sequence. The driver declares no dual-stick fields.

## W29 input and save-capability observation

The added driver declares no `PORT_CODE` fields, so its reported
`inputs.keys` array is empty. Its machine-input summary has player-1
`paddle` and `pedal-1` analogue rows, `dualStick: false` and `volume: false`.
All four added `GAMEL` declarations use flags that omit
`GAME_SUPPORTS_SAVE`, so `supportsSave` is false and MAME 0.161 is expected
to decline quick-save requests. This is an upstream driver capability, not a
family-build defect.
