# Namco System 2 family probe

Observed 2026-10-20 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`namco-s2.lua`](../../../mame/targets/namco-s2.lua) and
[`namco-s2.lst`](../../../mame/targets/namco-s2.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-s2 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-s2/mamenamco-s2"
```

| Result | Clean-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------: | -------------------: | ---------------------: |
| Pass | 186.32 s | 54 | 54 |

The machine count equals the independently derived total from `namcos2.c`.
No post-build Lua, list or link-error correction was needed. Pinned-source
inspection did correct one path in the work-package shorthand before the
build: the shared Namco IC implementation is
`src/mame/drivers/namcoic.c`, not `src/mame/machine/namcoic.c` (which does not
exist in MAME 0.161). The M37450 implementation belongs to the `M6502` core
group, while the HD63705 belongs to `M6805`; the target selects both groups in
addition to `M6809` and `M680X0`.

The resulting build identity is
`b7e10d97b256c6756991a2448a4f22bed7f474b12bf377749c6e91b5f88ab376`.

## F2 — What are the Wasm and JavaScript download sizes?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,335,290 | 1,615,579 | 1,208,838 |
| JavaScript | 302,079 | 65,584 | 55,272 |

## F3 — Does the largest ROM set fit in 4,096 pages?

Summing the public ROM sizes in every generated metadata file finds
`luckywld` largest at 13,779,200 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata estimate of 27,558,400
bytes, 13.69% of the safe budget, leaving 173,768,192 bytes. The driver does
not create startup-decrypted ROM copies. No machine in the family fails the
§5 estimate, so the build remains at 4,096 pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending private set

The integrator must use an ignored `ARCADE_PRELOAD_CONFIG` for a lawful set
and the mechanics from `tests/browser/27-mame-adapter.test.ts`. For the
slowest-starting family candidate, record Chromium wall-clock milliseconds
from immediately before `callMain()` to the first valid `onFrame` callback,
including multi-CPU machine initialization but excluding file selection and
network transfer. Record the browser version and desktop CPU with the result.

## F5 — Are native refresh and upright geometry correct?

pending private set

The integrator must use a lawful set and record its expected native upright
width, height and refresh from public MAME metadata. Record the first frame's
width and height, then run controlled 60, 90, 120 and 144 Hz callback cadences
and report the observed emulated-frame rate and percentage error at each
cadence. Every rate must be within 0.5% of native refresh and the frame must
arrive upright at the expected geometry.

## F6 — Does the heaviest title sustain full speed?

pending private set

The integrator must use a lawful set for the family's heaviest title. After
startup and a warm-up interval, measure exactly 60 seconds of wall time on
desktop and report `emulated seconds / wall seconds`; repeat under Chromium's
4× CPU-throttled mobile proxy and report the same ratio as informational
evidence. Record browser version, CPU and whether frameskip was disabled.
