# Atari classic family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31.
No ROM content was supplied to the build or metadata steps.

## F1 — Does the target pair compile and expose every machine?

The committed [`atari-classic.lua`](../../../mame/targets/atari-classic.lua)
and [`atari-classic.lst`](../../../mame/targets/atari-classic.lst) pair built
through the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w19d-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-classic/mameatari-classic"
```

| Result | First full compile/link attempt | Corrected cached build | `-listfull` machines | ROM-set metadata files |
| ------ | ------------------------------: | ---------------------: | -------------------: | ---------------------: |
| Pass | 223.73 s | 49.12 s | 15 | 15 |

The prescribed command without `BASH_ENV` first stopped after 9.96 seconds
when the SDK-bundled Node 8 process could not classify the command runner's
captured stream (`ERR_UNKNOWN_STREAM_TYPE`). The ignored compatibility
environment changed only Emscripten's JavaScript engine to host Node 22; the
pinned compiler, source and flags were unchanged.

The independently derived list matched the production machine count, so no
list correction was needed. Source inspection added `machine/atari_vg.c`,
which supplies the EAROM device instantiated by both vector drivers. The first
modularized link then proved that the compiled Atari support units also need
the parallel EEPROM and ER2055 machine cores; selecting `EEPROMDEV` and
`ER2055` resolved the only undefined symbols. The final target contains the
three driver units, their adjacent `audio/bzone.c` and `video/rampart.c` units,
and the shared Atari vector, EAROM, mathbox, `audio/redbaron.c`, Atari-gen,
motion-object and slapstic units.

The resulting build identity is
`f178804840c9a34ca74957c3e81d805d1356941e1858c3793c77bf637943f27a`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,022,964 | 1,556,676 | 1,169,229 |
| JavaScript | 302,084 | 65,596 | 55,356 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds
`rampart2p` largest at 1,707,786 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
3,415,572 bytes, 1.70% of the safe budget, leaving 197,911,020 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending integrator browser run

This managed sandbox cannot bind loopback or start Chromium, so no browser
suite was attempted. On a host with those capabilities, run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

Record Chromium wall-clock milliseconds from immediately before `callMain()`
to the first valid frame, including machine initialization but excluding file
selection and network transfer. Record the browser version and desktop CPU;
do not record the configured title or ROM identity.

## F5 — Are native refresh, upright geometry and vector output correct?

pending integrator browser run

Run the same exact command on an unrestricted browser host:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

Record the expected native upright width, height and refresh from public MAME
metadata and the first frame's observed width and height. Report observed
emulated-frame rate and percentage error under controlled 60, 90, 120 and
144 Hz cadences; every error must be within 0.5%. For a vector title, confirm
explicitly that the first delivered frame through the real adapter is not
blank. If it is blank, stop and record the failure without changing the
bridge.

## F6 — Does the heaviest title sustain full speed?

pending integrator browser run

Run the same exact command on an unrestricted browser host:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

After startup and a warm-up interval, measure exactly 60 seconds of wall time
and report `emulated seconds / wall seconds` on desktop; repeat under
Chromium's 4× CPU-throttled mobile proxy and report that informational ratio.
Record browser version, CPU and whether frameskip was disabled. If the
configured title is not the public metadata-heaviest family member, retain
that qualification and schedule strict heaviest-title evidence separately.
