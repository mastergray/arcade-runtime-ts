# Midway MCR family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`midway-mcr.lua`](../../../mame/targets/midway-mcr.lua) and
[`midway-mcr.lst`](../../../mame/targets/midway-mcr.lst) pair compiled through
the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-mcr/mamemidway-mcr"
```

| Result | Reused-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------: | -------------------: | ---------------------: |
| Pass | 30.68 s | 54 | 54 |

The machine count equals the independently derived total from `mcr.c`,
`mcr3.c` and `mcr68.c`; the list needed no correction. Source inspection
added `audio/williams.c` for the CVSD board configured by MCR-68. The first
link then proved that the MCR and IPU configurations also require the
separately selected Z80 CTC, PIO and DART cores. Adding `Z80CTC`, `Z80PIO`
and `Z80DART` resolved every undefined symbol; no further target correction
was needed.

The sandbox presents captured child-process output to the SDK's bundled
Node 8 as an unsupported stream, so the prescribed command reached the link
and then stopped in Node bootstrap with `ERR_UNKNOWN_STREAM_TYPE`. The
successful timed pass used the same pinned Emscripten compiler, optimizer,
Binaryen, flags, cache and source tree, with only `compiler.js` directed to
host Node 22 through a temporary untracked SDK environment. No repository or
shared toolchain file was changed. The resulting build identity is
`3259065f9c30a7140825db7909ebc874dd261ea75f28f95ab9559e45eae0c833`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,305,176 | 1,627,928 | 1,220,386 |
| JavaScript | 302,961 | 65,636 | 55,422 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds
`blasted` largest at 1,114,118 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
2,228,236 bytes, 1.11% of the safe budget, leaving 199,098,356 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending unrestricted Chromium runner

An ignored lawful private set was supplied to the real adapter and family
measurement browser cases. The managed sandbox denied the loopback test
server with `listen EPERM`; a throwaway no-socket Playwright route then
reached Chromium 151.0.7922.34, but Chromium itself terminated before page
creation because the sandbox denied its process broker's `shutdown` call.
The browser suite therefore produced no startup measurement, and a non-blank
first frame could not be confirmed. No private set identity was logged or
recorded.

On an unrestricted runner, record wall-clock milliseconds from immediately
before `adapter.start()` (which covers `callMain`) until it resolves on the
first valid frame, and separately confirm that a delivered frame contains
non-black pixel data. Record the browser version and desktop CPU with the
result.

## F5 — Are native refresh and upright geometry correct?

pending unrestricted Chromium runner

The same pre-page Chromium failure prevented a geometry or pacing result.
Using the ignored lawful config and the mechanics from
`tests/browser/33-family-measurements.test.ts`, record the public native
upright width, height and refresh, the delivered frame dimensions, and the
observed emulated-frame rate plus percentage error at controlled 60, 90, 120
and 144 Hz cadences. Every cadence must be within 0.5% of native refresh.

## F6 — Does the heaviest title sustain full speed?

pending unrestricted Chromium runner

The same pre-page Chromium failure prevented the 60-second run. After a
warm-up interval, measure exactly 60 seconds at the 60 Hz cadence and report
`emulated seconds / wall seconds`; repeat under Chromium's 4× CPU-throttled
mobile proxy as informational evidence. Record browser version, CPU and
whether frameskip was disabled. The available lawful set is not asserted to
be the family's heaviest title, so the strict heaviest-title gate remains
pending even after that set is measured.
