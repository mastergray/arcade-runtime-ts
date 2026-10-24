# Namco NB-1/NB-2 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is present; its private selection,
archive identity, hashes and resolved paths are not recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`namco-nb.lua`](../../../mame/targets/namco-nb.lua) and
[`namco-nb.lst`](../../../mame/targets/namco-nb.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 8,192-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-nb/mamenamco-nb"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 104.30 s | 34.75 s | 15 | 15 |

The independently derived list contains 15 machines from
`drivers/namconb1.c` and matched the production count without a list
correction. The pinned Namco vendor block supplies the driver/video pair,
the shared `drivers/namcoic.c`, the C75 implementation in
`machine/namcomcu.c` and the C116 screen controller in `video/c116.c`. The
target selects the M68000-family main CPU, M37710 sound MCU, C352 sound core
and parallel EEPROM device. The shared Namco IC unit includes the System 2
state header and therefore also requires the M6502 group for its M37450
device type.

The first host-Node diagnostic link exposed only the C116 and M37450 symbols;
adding those two upstream-listed dependencies resolved every undefined
symbol. No other driver family or compilation unit was added.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helpers to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.
The resulting build identity is
`bcfe8813ca3fe0c19b35491d67da1840c54d572118bead34cdefc109e8df8653`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,928,743 | 1,521,332 | 1,140,736 |
| JavaScript | 302,027 | 65,565 | 55,359 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 39,337,984 bytes. The nominal 4,096-page safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a metadata-only peak estimate of 78,675,968 bytes,
39.08% of that budget, leaving 122,650,624 bytes. No machine fails the §5
estimate on paper.

The build nevertheless uses 8,192 pages pre-emptively. `namconb1.c` declares
the sprite, tile and NB-2 rotation graphics as 8-bit `gfx_layout` elements;
the complete graphics regions are decoded into MAME gfx elements at startup.
The 39.3 MiB largest-set sum is effectively the same scale as the earlier
`seta2.c` board whose 4,096-page browser start exhausted the heap despite the
same two-copy metadata estimate. NB-1/NB-2 adds its large live graphics
decode to the MEMFS archive and loaded-region copies, so retaining the nominal
heap would repeat a known undercount risk. At 8,192 pages the same estimate is
19.54% of the 402,653,184-byte safe budget, leaving 323,977,216 bytes. A host
browser run should confirm the live peak rather than treating the metadata
estimate as proof.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7,
headless, host load average about 4 to 5 from unrelated daemons) with two
ignored preloads, both completed with the shared C75 device archive the
agent's audit had found missing: 840 ms for the NB-2 set and 702 ms for the
NB-1 set, from immediately before `adapter.start()` to the first valid,
non-blank frame.

## F5 — Are native refresh and upright geometry correct?

Native refresh 59.700 Hz. NB-2 set: 288×224 horizontal, every frame that
size, first frame non-blank. NB-1 set: 224×288 vertical (upright rotation),
every frame that size, first frame non-blank. Cadences, NB-2: 60 Hz →
53.59 fps (−10.24 %), 90 Hz → 58.05 fps (−2.76 %), 120 Hz → 59.90 fps
(+0.34 %), 144 Hz → 59.75 fps (+0.09 %). NB-1: 60 Hz → 59.27 fps (−0.72 %),
90 Hz → 59.28 fps (−0.71 %), 120 Hz → 57.20 fps (−4.19 %), 144 Hz →
55.83 fps (−6.48 %). Geometry and refresh are correct; the cadence misses
are the board not keeping up, see F6. All three local sets carry MAME's own
`GAME_IMPERFECT_SOUND` flag in 0.161, upstream's note on the C352 path.

## F6 — Does the heaviest title sustain full speed?

**No.** Desktop, frameskip disabled: emulated seconds / wall seconds =
0.9160 over 60 s for the NB-2 set and 0.8208 for the NB-1 set, far outside
the 2 % tolerance, on the same host and under the same load where the
System 32 family measured 1.0000 minutes earlier. The 68EC020 at 24 MHz with
the M37710 sound CPU, the C352 and the sprite and tilemap chain is more than
this build sustains on the desktop reference machine. Per the W27 brief the
family is recorded as **built, below the gate** and leaves the 1.0.0 matrix;
the build stays in the repository and the artefacts are served, so the games
start and play at about 82–92 % speed, but the family is not claimed as
measured. M3–M5 acceptance passed on both runs: audio queue peak 101 ms and
97 ms against the 120 ms cap, keyboard coin and start reached play, two pads
assigned and released, quick save passed. The 4× CPU-throttled mobile proxy
was not run.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-namco-nb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-namco-nb.json" \
  npm run test:browser
```

The integrator's runs completed 30 passed, 2 failed (the M1 acceptance and
the family measurement, both on speed), 25 skipped by design.
