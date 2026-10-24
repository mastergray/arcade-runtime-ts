# Gottlieb family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, hash or resolved path is
recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`gottlieb.lua`](../../../mame/targets/gottlieb.lua) and
[`gottlieb.lst`](../../../mame/targets/gottlieb.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w28i-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts gottlieb --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/gottlieb/mamegottlieb"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 138.74 s | 24.41 s | 25 | 25 |

The independently derived list contains 25 machines from
`drivers/gottlieb.c` and matched the production count without a list
correction. The pinned vendor block contributes the driver/audio/video trio;
the adjacent `exterm.c` driver and its TMS34010 path are excluded.

The target selects the I86 group for the 8088 main CPU, M6502 sound CPUs,
samples, DAC, AY8910/AY8913, SP0250 and Votrax sound paths, the RIOT6532 and
MIOT6530 devices, and the PR-8210 laserdisc device. The first direct compiler
replay identified the PR-8210's internal I8049 controller as the only missing
symbol, so the MCS-48 CPU core was added. No extra driver or board source was
needed.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helper to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.
The resulting build identity is
`2f94f3dd9d026e04c058926b05276f2b272208ba84bfff6928def39f54c34e0a`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,262,301 | 1,465,004 | 1,107,462 |
| JavaScript | 302,664 | 65,602 | 55,333 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 133,120 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
266,240 bytes, 0.13% of the safe budget, leaving 201,060,352 bytes. No machine
fails the §5 estimate. `gottlieb.c` uses small fixed character, tile and sprite
regions, with a small writable character-RAM layout; it does not decode a
large graphics region like the wave-3 memory outlier. The build therefore
remains at 4,096 pages. If the integrator's browser start nevertheless reports
the adapter's fixed-heap error, raise `memoryPages` to 8,192 and repeat F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7,
headless, quiet host) with the ignored preload for a new family: 315 ms from
immediately before `adapter.start()` to the first valid, non-blank frame.

## F5 — Are native refresh and upright geometry correct?

240×256 vertical at 61.419 Hz; every frame that size and the first frame non-blank. Cadences:
60 Hz → 61.58 fps (+0.26 %), 90 Hz → 61.19 fps (−0.38 %), 120 Hz → 61.29 fps (−0.22 %), 144 Hz → 61.31 fps (−0.18 %), all inside the 1 % gate.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0000 over 60 s, frameskip
disabled. M3–M5 acceptance on the same run: audio queue peak 72 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-gottlieb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-gottlieb.json" \
  npm run test:browser
```

The integrator's host run completed 32 passed, 0 failed, 25 skipped by design.
