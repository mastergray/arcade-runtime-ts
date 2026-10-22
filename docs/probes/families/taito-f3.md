# Taito F3 family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node's bundled Brotli 1.1.0 encoder, the pinned MAME 0.161
source archive and Emscripten 1.38.31. No ROM content was supplied to the
build or metadata measurements. A lawful ignored preload config is present;
its private machine, file and path identities were not inspected or recorded.

## F1 — Does the target pair compile and expose every machine?

The committed [`taito-f3.lua`](../../../mame/targets/taito-f3.lua) and
[`taito-f3.lst`](../../../mame/targets/taito-f3.lst) pair compiles and links.
The generated module completes the ROM-free `-listfull` path with all 90
independently derived machines, exactly matching the list. The explicit
threading gate reports one fixed, non-shared 4,096-page memory with no worker
or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-f3/mametaito-f3"
```

| Result | Compile/link plus `-listfull` wall time | `-listfull` machines | ROM-set metadata files |
| ------ | --------------------------------------: | -------------------: | ---------------------: |
| Blocked after link | 149.388 s | 90 | 0 |

The prescribed command first stopped after 10.019 seconds because the
emsdk-bundled Node 8 could not classify the command runner's captured stderr
(`ERR_UNKNOWN_STREAM_TYPE`). The approved ignored `BASH_ENV` compatibility
configuration selected host Node 22 only as Emscripten's JavaScript engine;
the pinned compiler, LLVM tools, source, patches and flags remained unchanged.

No list or link correction was needed. The pinned Taito block supplies
`drivers/taito_f3.c`, `video/taito_f3.c` and `audio/taito_en.c`. Their includes
and machine configurations select M680X0 (including the 68EC020), ES5510,
ES5505, OKIM6295, EEPROM, MC68681 and MB87078 support, plus the harmless
Centronics core required to keep the release-era bus archive non-empty.

The production pipeline cannot finish its subsequent all-machines `-listxml`
step for this family. MAME 0.161's `taito_en_device` embeds
`UINT32 m_es5510_dram[1 << 24]` in every machine configuration: 64 MiB per
configuration. The release's all-machine XML enumerator retains those
configurations. A diagnostic 8,192-page link had reached only the seventh
machine when its dynamic heap stood at 479,731,712 bytes and the module
aborted `OOM`; one-machine XML completes. A 32-bit Wasm heap cannot hold all
90 configurations, so increasing the family runtime budget cannot repair the
metadata step. Per the package boundary, no source patch or pipeline change
was made. The partial artifact's build identity is
`34ad8cdd3acc35cff52601d171ec46c3d1f5ea4978dbbcf1d0092f60b683c68c`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,761,748 | 1,533,523 | 1,155,470 |
| JavaScript | 301,913 | 65,552 | 55,353 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Because bulk `-listxml` is blocked as described in F1, a throwaway diagnostic
instantiated the 4,096-page module separately for each of the 90 public
machine names and parsed that machine's ROM-free XML. Summing the public ROM
sizes finds `kirameki` largest at 41,943,040 bytes (40 MiB). No generated
metadata was committed or substituted for the production pipeline.

The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
83,886,080 bytes (80 MiB), 41.67% of the safe budget, leaving 117,440,512
bytes. No machine fails the §5 estimate, so the build remains at 4,096 pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

pending integrator browser run

This sandbox cannot bind loopback or start Chromium, so the browser suite was
not attempted. On an unrestricted host, run the supplied ignored config
through the real adapter:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-taito-f3.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-f3.json" \
  npm run test:browser
```

Record Chromium wall-clock milliseconds from immediately before
`adapter.start()`/`callMain()` to the first valid frame and to the first frame
containing a non-black RGB pixel. Exclude file selection and transfer, and
record browser version and desktop CPU. A non-blank first frame remains
unconfirmed here.

## F5 — Are native refresh and upright geometry correct?

pending integrator browser run

Run the exact integrator command:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-taito-f3.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-f3.json" \
  npm run test:browser
```

Record the configured title's public native upright width, height and refresh,
the first delivered frame's geometry, and observed emulated-frame rate plus
percentage error at controlled 60, 90, 120 and 144 Hz scheduler cadences.
Every rate must be within 0.5% of native refresh and at least one delivered
frame must be non-blank.

## F6 — Does the heaviest title sustain full speed?

pending integrator browser run

Run the exact integrator command:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-taito-f3.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-f3.json" \
  npm run test:browser
```

After warm-up, measure exactly 60 seconds of wall time and report
`emulated seconds / wall seconds` on desktop; repeat under Chromium's 4×
CPU-throttled mobile proxy and report that ratio as informational evidence.
Record browser version, CPU and whether frameskip was disabled. Desktop full
speed for this heaviest-per-frame family remains unconfirmed here.
