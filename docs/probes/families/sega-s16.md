# Sega System 16/18 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Brotli 1.1.0, the pinned MAME 0.161 source archive and
Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private identity or archive path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`sega-s16.lua`](../../../mame/targets/sega-s16.lua) and
[`sega-s16.lst`](../../../mame/targets/sega-s16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27a-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s16 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-s16/mamesega-s16"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 94.5 s | 30.8 s | 139 | 139 |

The independently derived list contains 31 machines from `segas16a.c`, 81
from `segas16b.c` and 27 from `segas18.c`. It matched the production count
without a list correction.

The target selects the two MCU CPU cores, 68000 and Z80 cores; the DAC,
Yamaha, sample-player and PSG sound cores configured across the three boards;
the Sega I/O and video devices; the three driver/video pairs; common Sega IC,
road and sprite units; and the FD1089, FD1094, MC-8123 and related decryption
units. `segas16a.c` also requires its adjacent encryption implementation even
though the work-package shorthand names only the older shared implementation.

The first link identified one inherited video-core dependency hidden by the
broad upstream vendor block: the 315-5313 device derives from and calls the
315-5124 implementation. Selecting both video cores resolved every undefined
symbol. No compilation-unit or machine-list correction was needed.

The sandbox's captured stdio is incompatible with the toolchain's bundled
Node 8 at the final JavaScript compiler step. The successful invocation used
an ignored process-local `BASH_ENV` that selected host Node 22 for
`compiler.js` only. The MAME source, Emscripten compiler and optimizer, flags
and build pipeline remained pinned. The resulting build identity is
`37f3348521b1510a2a7610dd6ad81d8ec896da3461599517278fcd5f21c083ca`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,456,140 | 1,694,853 | 1,269,541 |
| JavaScript | 302,193 | 65,600 | 55,425 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 15,474,688 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
30,949,376 bytes, 15.37% of the safe budget, leaving 170,377,216 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-23 (Chrome 150, Core i7-1165G7,
headless, quiet host) with the ignored System 18 preload: 540 ms from
immediately before `adapter.start()` to the first valid, non-blank frame
(532 ms and 561 ms on two earlier runs of the same gate).

## F5 — Are native refresh and upright geometry correct?

Native refresh 57.230 Hz, horizontal. The first frame is 256×224 and the
board switches to 320×224 during play: the 315-5313 VDP reconfigures the
screen between its H32 and H40 modes at run time, the bridge resizes its
render target per frame and `ArcadeDisplay` re-creates its image buffer
when a frame's size changes, so `MachineInfo.width` is the boot mode and
later frames are drawn at their own size. The family measurement records
the sizes seen (256×224/320×224) and asserts that every frame carries a
valid size. Cadences: 60 Hz → 57.33 fps (+0.18 %), 90 Hz → 57.18 fps
(−0.08 %), 120 Hz → 57.18 fps (−0.09 %), 144 Hz → 57.26 fps (+0.06 %),
all inside the 1 % gate.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0001 over 60 s (0.9993 and
0.9998 on the two earlier runs), frameskip disabled. M3–M5 acceptance on
the same run: audio queue peak 68 ms against the 120 ms cap, keyboard coin
and start reached play, two pads assigned and released. The 4× CPU-throttled
mobile proxy was not run; it is informational and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s16.json" \
  npm run test:browser
```

The agent's sandbox attempt could not bind loopback (`listen EPERM`); the
integrator's run on the host completed 27 passed, 0 failed, 26 skipped by
design.
