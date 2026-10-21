# Namco classic family probe

Observed 2026-10-20 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`namco-classic.lua`](../../../mame/targets/namco-classic.lua)
and [`namco-classic.lst`](../../../mame/targets/namco-classic.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-classic/mamenamco-classic"
```

| Result | Clean-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------: | -------------------: | ---------------------: |
| Pass | 157.49 s | 378 | 378 |

The machine count equals the independently derived total from all eleven
driver sources. The first full compile and link succeeded, so no post-build
Lua or list correction was needed. Source inspection before that build added
the dependencies not explicit in §4.6's shorthand: `toypop.c` needs M68000,
`galaxian.c` needs I8255 and Digitalker plus the shared `audio/cclimber.c`
unit, `rallyx.c` needs the shared `audio/timeplt.c` unit, and the `galaga.c` and
`polepos.c` configurations need the Namco 06XX/50XX–54XX helpers. The Lua
also includes every adjacent video, audio, machine and MCU unit used by the
selected drivers.

The resulting build identity is
`efe5291ecacc7e9bf59a3d326df737fc0e7271a6f3d6090affd6a4b3250e0c94`.

## F2 — What are the Wasm and JavaScript sizes, and is `galaxian.c` material?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Build | Machines | Artifact | Raw bytes | gzip -9 | Brotli 11 |
| ----- | -------: | -------- | --------: | -------: | ---------: |
| Full family | 378 | Wasm | 7,439,583 | 1,885,025 | 1,409,807 |
| Full family | 378 | JavaScript | 303,283 | 65,643 | 55,345 |
| Without `galaxian.c` | 200 | Wasm | 7,059,266 | 1,771,469 | 1,323,188 |
| Without `galaxian.c` | 200 | JavaScript | 303,283 | 65,641 | 55,330 |

The comparison build removed `galaxian.c`, its audio/video units, the
`cclimber.c` audio helper, and the I8255 and Digitalker cores that no
remaining driver uses. It was made only under ignored cache output; the
committed pair and production artifact remain the full family.

Including the source adds 380,317 raw Wasm bytes, 113,556 gzip bytes and
86,619 Brotli bytes. That is 6.14% of the full Brotli Wasm, but only about
84.6 KiB of transfer size. This is not material enough to justify another
production download, so the `galaxian-misc` machines remain folded into
`namco-classic`.

## F3 — Does the largest ROM set fit in 4,096 pages?

Summing the public ROM sizes in every generated metadata file finds
`superabc` largest at 656,192 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata estimate of 1,312,384 bytes,
0.652% of the safe budget, leaving 200,014,208 bytes. These drivers do not
make decrypted region copies. No machine in the family fails the §5 estimate,
so the build remains at 4,096 pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending private set

The integrator must use an ignored `ARCADE_PRELOAD_CONFIG` for a lawful set
and the mechanics from `tests/browser/27-mame-adapter.test.ts`. For the
slowest-starting family candidate, record Chromium wall-clock milliseconds
from immediately before `callMain()` to the first valid `onFrame` callback,
including machine initialization but excluding file selection and network
transfer. Record the browser version and desktop CPU with the result.

## F5 — Are native refresh and upright geometry correct?

pending private set

The integrator must use a lawful vertical set and record its expected native
upright width, height and refresh from public MAME metadata. Record the first
frame's width and height, then run controlled 60, 90, 120 and 144 Hz callback
cadences and report the observed emulated-frame rate and percentage error at
each cadence. Every rate must be within 0.5% of native refresh and the frame
must arrive upright at the expected geometry.

## F6 — Does the heaviest title sustain full speed?

pending private set

The integrator must use a lawful set for the family's heaviest title. After
startup and a warm-up interval, measure exactly 60 seconds of wall time on
desktop and report `emulated seconds / wall seconds`; repeat under Chromium's
4× CPU-throttled mobile proxy and report the same ratio as informational
evidence. Record browser version, CPU and whether frameskip was disabled.



## F4–F6 measured — two titles: a vertical 224×288 one and the family's heaviest, a 256×224 horizontal one (both 60.606 Hz)

Observed 2026-10-20 with the `build-mame` production artifact, headless
Chromium on the desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock; identities stay in the ignored
preload configs). Measurements overlapped a native build in another
worktree, so they are if anything conservative.

| Probe | Result |
| ----- | ------ |
| F4 startup to first valid frame | F4 start 335 ms (vertical title) and 476 ms (heaviest title); geometry ok for both |
| F5 emulated rate against native refresh, per cadence | vertical: 60 Hz → 60.66 fps (+0.09 %), 90 → 60.50 (−0.18 %), 120 → 60.48 (−0.21 %), 144 → 60.55 (−0.09 %); heaviest: 60 → 60.66 (+0.10 %), 90 → 60.61 (0.00 %), 120 → 60.66 (+0.09 %), 144 → 60.59 (−0.02 %); every frame at the machine's native size and orientation |
| F6 sixty-second emulated-time ratio at the 60 Hz cadence (desktop) | 1.0000 (vertical) and 1.0003 (heaviest) |

Desktop full speed holds for this family; the 4× CPU-throttled mobile proxy
is deferred to M10 as §0.2 allows.
