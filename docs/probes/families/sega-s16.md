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

Pending: the sandbox denied the browser test server's loopback bind with
`listen EPERM`, before Chromium page creation. The ignored System 18 preload
audits cleanly against the generated metadata (18 expected files; zero
missing, wrong-size or wrong-CRC entries), but a first frame could not arrive
in this environment.

On an unrestricted host, run the family browser measurement and record
milliseconds from immediately before `adapter.start()` through the first
valid, non-blank frame. Exclude file selection and transfer, and record the
Chromium version and desktop CPU.

## F5 — Are native refresh and upright geometry correct?

Pending for the same loopback `EPERM`. On an unrestricted host, record the
real adapter's native upright width, height and refresh, confirm every frame
matches that geometry and contains non-black pixels, and measure controlled
60, 90, 120 and 144 Hz display cadences. Each measured emulated-frame rate
must remain within 0.5% of the native refresh.

## F6 — Does the heaviest title sustain full speed?

Pending for the same loopback `EPERM`. The ignored preload selects the System
18 board required by this package. After warm-up on an unrestricted desktop,
measure exactly 60 seconds and report `emulated seconds / wall seconds`, then
repeat under Chromium's informational 4× CPU-throttled mobile proxy. Record
the Chromium version, CPU and whether frameskip was disabled.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s16.json" \
  npm run test:browser
```

The sandbox attempt completed 0 passed, 32 failed and 25 skipped browser
cases. Every runnable case, including the family measurement, stopped at the
same loopback `listen EPERM`; this was an environment failure rather than a
family-build result.
