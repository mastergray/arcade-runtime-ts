# Nintendo VS. System family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, ROM hash or resolved path is
recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`nintendo-vs.lua`](../../../mame/targets/nintendo-vs.lua) and
[`nintendo-vs.lst`](../../../mame/targets/nintendo-vs.lst) pair built through
the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths. Both the pipeline and the explicit threading
gate reported one fixed, non-shared 4,096-page memory with no worker, runtime
marker or pthread requirement.

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-vs --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/nintendo-vs/mamenintendo-vs"
```

| Result | Production pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ------------------: | -------------------: | ---------------------: |
| Pass | 189.91 s | 54 | 54 |

The independently derived list contains all 54 public machines from
`drivers/vsnes.c` and matched the production count without correction. The
source group contains `drivers/vsnes.c`, `machine/vsnes.c`, `video/vsnes.c`
and `video/ppu2c0x.c`; the PPU implementation is a MAME video unit in this
release rather than a separately selected device-library unit.

The target selects the M6502 core for the 2A03 CPUs and the Z80 core required
by the bootleg configuration. It selects the NES APU, SN76496 and DAC sound
paths plus the RP5H01 machine device. A harmless Centronics core keeps the
pinned release's mandatory bus archive non-empty. No core or source correction
was needed. The resulting build identity is
`fe6c2b6ad1395bcb2ba6a33f6af798068680af182c43c2f354b58efbb8d51fe9`.

The `.lst` deliberately retains the dual-system configurations. They declare
two 2A03 CPUs, PPUs and raster screens. The production bridge selects MAME's
first screen and therefore delivers only the first display; it does not merge
or expose the second display. The ignored preload instead selects a
single-screen configuration for F4–F6.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,341,703 | 1,449,255 | 1,086,734 |
| JavaScript | 302,238 | 65,580 | 55,341 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 262,336 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
524,672 bytes, 0.26% of the safe budget, leaving 200,801,920 bytes. No family
machine fails the §5 estimate, so the build remains at 4,096 pages.

The PPU reads packed pattern data directly while rendering scanlines. Its
historical `gfx_layout` is disabled, and this driver has no active MAME GFX
decode table that expands a large graphics region at startup. The largest
declared pattern region is only 128 KiB, so the large decoded-sprite risk from
W28 does not apply. If the integrator's browser run nevertheless reports the
adapter's fixed-heap error, raise this family to `memoryPages: 8192`, rebuild
it alone and repeat F4–F6.

### Input, DIP-switch and save capability

The board defines its DIP switches per game; the private single-screen
selection's generated metadata contains five switches. Several input blocks
include the reversed base mapping that alternates players 1 and 2 on one
physical control panel. The normal generated controller mapping therefore
remains sufficient, while the selected DIP values determine the board's
per-game behavior.

The selected single-screen input block has no supported non-DIP `PORT_CODE`
field, so the source-derived `inputs.keys` expectation is `[]` and
`inputs.volume` is false. The driver declaration omits `GAME_SUPPORTS_SAVE`,
so `supportsSave` is false and the production quick-save control should be
disabled. These three runtime values remain for the integrator to confirm in
the pending browser run. The dual-system input block also has coded
second-side start fields, but their punctuation keys are outside W29's
operator-key vocabulary, while its F1/F2 service-mode codes belong to DIP
fields and are intentionally excluded from `inputs.keys`.

A privacy-safe local audit of the ignored preload passed both strict and
MAME-compatible policies: one required archive was present, all seven
expected files were valid, no warning or archive problem was reported, and
six harmless unexpected files were ignored. The generated metadata names no
sample archive.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Pending integrator browser run. This sandbox cannot launch Chromium or bind
the loopback page server, so no startup number or first-frame claim is made.
On a host with those capabilities, run the production family-measurement case
with the ignored W31a preload and record milliseconds from immediately before
`adapter.start()` to the first valid, non-blank frame for its single-screen
selection.

## F5 — Are native refresh and upright geometry correct?

Pending integrator browser run for the same reason. Record the delivered
single-screen width, height, orientation and native refresh; confirm every
frame has stable geometry and the first frame is non-blank; then measure 60,
90, 120 and 144 Hz controlled cadences against the native rate. Also confirm
that the runtime reports `inputs.keys: []`, `inputs.volume: false` and
`supportsSave: false`.

## F6 — Does the heaviest available title sustain full speed?

Pending integrator browser run for the same reason. With frameskip disabled,
record emulated seconds divided by wall seconds over 60 desktop seconds for
the single-screen selection named by the ignored W31a preload. Also exercise
coin, start and both alternating-player mappings after applying its DIP
selection. The 4× CPU-throttled proxy remains informational.

Run F4–F6 without copying the ignored config's identity into tracked output:

```sh
ARCADE_PRELOAD_CONFIG="<ignored W31a preload config>" \
ARCADE_FAMILY_CONFIGS="<ignored W31a preload config>" \
  npm run test:browser
```
