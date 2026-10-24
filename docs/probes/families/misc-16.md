# Miscellaneous 16-bit family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js Brotli quality 11, the pinned MAME 0.161 source
archive and Emscripten 1.38.31. No ROM content was supplied to the build or
metadata steps. A lawful ignored preload config for a `cninja.c` title was
used only for the privacy-safe audit and attempted browser probes; no private
identity or path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The extended [`misc-16.lua`](../../../mame/targets/misc-16.lua) and
[`misc-16.lst`](../../../mame/targets/misc-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w28g-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/misc-16/mamemisc-16"
```

| Result | Source-unpack compile to first link | Final cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------------: | ---------------------------: | -------------------: | ---------------------: |
| Pass | 174.74 s | 33.82 s | 131 | 131 |

The independently derived list contains 28 machines from `dec0.c`, 9 from
`karnov.c`, 7 from `raiden.c`, 31 from `raiden2.c`, 4 from `r2dx_v33.c`, 28
from `snowbros.c`, 3 from `shadfrce.c`, 1 from `btoads.c` and 20 from
`cninja.c`. Its 131 entries matched production `-listfull`, so no list
correction was needed.

The added driver uses the family's existing M68000, H6280 and Z80 CPU cores,
YM2203/YM2151/OKIM6295 sound cores and buffered sprite RAM. The pinned
Data East project block also requires `deco16ic.c`, `decocomn.c` and
`decospr.c` for its configured video devices; `deco104.c` and `deco146.c`
for both protection-device variants; and `decocrpt.c` for DECO56 graphics
decryption. A diagnostic link exposed the latter two dependencies after the
broad vendor block hid them; adding that pinned-source closure resolved every
undefined symbol.

The first full link hit the known `ERR_UNKNOWN_STREAM_TYPE` incompatibility
between the sandbox's captured standard streams and the toolchain's bundled
Node 8. The successful invocation used an ignored process-local `BASH_ENV`
configuration that selects host Node 22 for Emscripten's JavaScript helpers
only. The MAME source, Emscripten C/C++ compiler, native optimizer, Binaryen,
flags and production pipeline remained pinned. The resulting build identity
is `e9d9f04fad4c5523ce06d29af90a24781e9efc2988bb48b97d55ac09d2d9a38a`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact state | Raw bytes | gzip -9 | Brotli 11 |
| -------------- | --------: | -------: | ---------: |
| Wasm before extension | 7,409,427 | 1,809,382 | 1,345,501 |
| Wasm after extension | 7,605,523 | 1,860,709 | 1,380,653 |
| Wasm increase | 196,096 (2.65%) | 51,327 (2.84%) | 35,152 (2.61%) |
| JavaScript before extension | 302,943 | 65,627 | 55,359 |
| JavaScript after extension | 303,057 | 65,647 | 55,384 |
| JavaScript increase | 114 (0.04%) | 20 (0.03%) | 25 (0.05%) |

The extension adds 20 public machines for a 196,096-byte raw and 35,152-byte
Brotli-11 Wasm increase to every `misc-16` download.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in all 131 generated metadata files leaves the
whole-family maximum unchanged at 18,219,136 bytes. The largest metadata sum
among the 20 `cninja.c` machines is 8,717,312 bytes. The safe adapter budget
is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the whole-family maximum once for supplied archive bytes and once for
loaded regions gives a conservative metadata-only peak estimate of 36,438,272
bytes, 18.10% of the safe budget, leaving 164,888,320 bytes. No machine fails
the §5 estimate, so the build remains at 4,096 pages.

`cninja.c` does decode graphics regions: one configuration invokes the DECO56
decryptor over two graphics regions, and that decryptor temporarily allocates
a same-size word buffer while rewriting each region. The metadata estimate
still leaves substantial margin, but the browser run did not reach startup.
If the integrator's complete-set run aborts with the adapter's "needs more
memory" error, raise this family's `memoryPages` to 8,192 and rebuild before
recording F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Pending: the local `cninja.c` archive is a clone set missing its parent's fifteen files, so the integrator could not start it; the agent's audit found the same. F4 will be measured once the parent archive is supplied.

## F5 — Are native refresh and upright geometry correct?

Pending for the same reason. The family's earlier boards are unchanged by the extension.

## F6 — Does the heaviest title sustain full speed?

Pending for the same reason; the driver's 68000 with the H6280 sound CPU is lighter than the family's existing `raiden2.c` boards, so the family's gate is not expected to move.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \\
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \\
  npm run test:browser
```

No host run was possible for the new driver's title; the family build, metadata and spec suite pass.

## Earlier-driver F4–F6 evidence retained

The family's earlier six-title measurements remain valid for their driver
sources; they do not substitute for the pending `cninja.c` measurement.
They were collected 2026-10-21/22 with the production artifact, headless
Chromium, the real adapter and controlled-cadence scheduler. Private identities
remain omitted; titles are distinguished only by native geometry.

| Earlier board geometry | F4 | F5 | F6 | Acceptance |
| ---------------------- | -- | -- | -- | ---------- |
| 256×240 at 60.000 Hz | 334 ms | 60 → 60.08 (+0.13%), 90 → 60.21 (+0.35%), 120 → 59.96 (−0.06%), 144 → 59.88 (−0.20%) | 1.0002 | pass |
| 256×240 at 57.445 Hz | 349 ms | 60 → 57.28 (−0.28%), 90 → 57.51 (+0.11%), 120 → 57.48 (+0.06%), 144 → 57.23 (−0.38%) | 1.0000 | pass |
| 224×256 vertical at 59.600 Hz | 390 ms | 60 → 59.66 (+0.11%), 90 → 59.49 (−0.18%), 120 → 59.84 (+0.40%), 144 → 59.59 (−0.02%) | 1.0001 | pass |
| 256×224 at 57.500 Hz | 315 ms | 60 → 57.83 (+0.57%), 90 → 57.57 (+0.13%), 120 → 57.51 (+0.02%), 144 → 57.52 (+0.04%) | 1.0000 | pass |
| 320×240 at 59.572 Hz | 499 ms | 60 → 59.66 (+0.15%), 90 → 59.46 (−0.19%), 120 → 59.51 (−0.11%), 144 → 59.56 (−0.03%) | 1.0001 | pass |
| 512×224 at 60.798 Hz | 520 ms | 60 → 60.85 (+0.09%), 90 → 60.66 (−0.22%), 120 → 60.93 (+0.22%), 144 → 60.56 (−0.39%) | 1.0000 | pass |

The final row is the TMS34020 board and includes its required device archive.
All six first frames were non-blank and arrived at native size and orientation;
their 60-second desktop ratios were 1.0000–1.0002.
