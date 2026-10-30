# Konami 16-bit family probe

Observed 2026-10-30 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's Brotli encoder, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. The W33 extension adds the board defined by `gradius3.c`; private
machine, archive and path identities are not recorded here.

## F1 — Does the target pair compile and expose every machine?

The extended [`konami-16.lua`](../../../mame/targets/konami-16.lua) and
[`konami-16.lst`](../../../mame/targets/konami-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the pipeline and explicit threading gates reported
one fixed, non-shared 4,096-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts konami-16 --jobs 8

npm run probe:mame:threading -- \
  "$PWD/dist/mame/konami-16/mamekonami-16"
```

| Result | Extended build wall time | `-listfull` machines | ROM-set metadata files |
| ------ | -----------------------: | -------------------: | ---------------------: |
| Pass | 47.10 s on the reused source/object cache | 101 | 101 |

The same prescribed command first built the unextended 98-machine baseline in
108.76 s. The sandbox initially denied the shared SDK cache lock; redirecting
only Emscripten's cache and temporary directories into ignored worktree
storage allowed the pinned compiler, optimizer, source, patches and flags to
run unchanged.

Independent derivation found 98 entries across the six existing driver files
and three entries in `gradius3.c`. The 101-entry result exactly matched
production `-listfull`, so no list correction was needed. Although the W33
brief says the prior count was 106, the checked-in list, derivation, earlier
probe and production baseline all establish that the actual prior count was
98.

The added board configures two M68000 CPUs, one Z80, YM2151, K007232, K052109
and K051960. All selectable cores and shared video units were already present
in the target. The only additions were `drivers/gradius3.c` and
`video/gradius3.c`; the first complete extended link reported no further
dependency. The resulting build identity is
`f6c7c72d6f4bf82568e4897b8ee0fb5b40a12e258e811df5e09ed0c77a19ce0d`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,538,443 | 1,679,491 | 1,254,423 |
| JavaScript | 302,305 | 65,607 | 55,338 |

The extension changes the Wasm download for every machine already in this
family:

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,520,690 | 1,675,113 | 1,250,512 |
| After extension | 6,538,443 | 1,679,491 | 1,254,423 |
| Increase | 17,753 (0.27%) | 4,378 (0.26%) | 3,911 (0.31%) |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds the
whole-family maximum in `mystwarr.c` at 21,233,792 bytes. The added
`gradius3.c` board's maximum is 3,997,952 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the whole-family maximum once for supplied archive bytes and once for
loaded regions gives a conservative metadata-only peak estimate of 42,467,584
bytes, 21.09% of the safe budget, leaving 158,859,008 bytes. No machine in the
family fails the §5 estimate, so the build remains at 4,096 pages.

The added driver does not decode a large graphics region into a larger
startup allocation. It maps a 2 MiB graphics region and copies selected data
at run time into a fixed 128 KiB character-RAM window, so it does not displace
the existing whole-family maximum.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured 2026-10-30 by the integrator on the desktop reference host with the `gradius3.c` parent from a private preload config: 556 ms from `callMain` to the first frame (test 33, `FAMILY-MEASURE`).
This agent cannot run Chromium. Measure from immediately before
`adapter.start()`/`callMain()` to the first valid frame and separately confirm
the first non-black frame. The earlier six-driver family evidence remains
521–929 ms across five private configurations, but it does not answer F4 for
the added board.

## F5 — Are native refresh and upright geometry correct?

Measured 2026-10-30: 320 × 224 horizontal at 60.000 Hz, frames valid; cadences 60 Hz → 60.08 fps (0.14 %), 90 Hz → 60.16 fps (0.27 %), 120 Hz → 60.02 fps (0.03 %), 144 Hz → 59.98 fps (−0.03 %). The M1 acceptance (test 30) also passed on this machine at ratios 1.0012 and 1.0007.
Source metadata describes a 320×224 horizontal display at 60 Hz; confirm
native-size frames and non-blank output, then measure 60, 90, 120 and 144 Hz
scheduler cadences against native refresh. The earlier six-driver evidence
held native geometry with a worst measured cadence error of 0.76%.

## F6 — Does the heaviest title sustain full speed?

Measured 2026-10-30: 60-second sustained ratio 1.0000 on the desktop reference host. The board ships.
After warm-up, measure exactly 60 seconds and report emulated seconds divided
by wall seconds on desktop; the 4× CPU-throttled proxy remains informational.
The existing `mystwarr.c`-class whole-family result held 1.0000 on a quiet
host, but the added dual-M68000 board needs its own result before the extension
is accepted for the family.

## Earlier F4–F6 evidence for the six-driver family

Measured 2026-10-21/22 with the production artifact, headless Chromium on the
desktop host and the real adapter. Private identities remained in ignored
preload configs. Loaded runs overlapped three Emscripten builds and are
conservative; the quiet run established the earlier family's heaviest-board
result.

| Configuration | F4 | F5 | F6 |
| ------------- | -- | -- | -- |
| 320×224 at 60.000 Hz (loaded) | 929 ms | 60 → 60.00 (−0.01%), 90 → 59.95 (−0.09%), 120 → 59.91 (−0.15%), 144 → 59.93 (−0.12%) | 1.0000 |
| 288×224 at 59.186 Hz (loaded) | 795 ms | 60 → 59.27 (+0.15%), 90 → 59.46 (+0.46%), 120 → 59.21 (+0.04%), 144 → 59.26 (+0.12%) | 1.0000 |
| 304×224 at 59.170 Hz (loaded) | 881 ms | 60 → 59.05 (−0.21%), 90 → 59.25 (+0.14%), 120 → 58.99 (−0.31%), 144 → 59.62 (+0.76%) | 0.9996 |
| 288×224 at 59.186 Hz (quiet, earlier heaviest board) | 740 ms | 60 → 59.33 (+0.25%), 90 → 59.18 (−0.01%), 120 → 59.26 (+0.13%), 144 → 59.25 (+0.11%) | 1.0000 |
| 304×224 at 60.000 Hz (loaded) | 521 ms | 60 → 60.15 (+0.25%), 90 → 59.95 (−0.08%), 120 → 60.12 (+0.21%), 144 → 59.99 (−0.02%) | 0.9990 |

These measurements predate the `gradius3.c` parent, whose own F4–F6 above (2026-10-30) close W33's handoff.
