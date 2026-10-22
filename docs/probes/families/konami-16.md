# Konami 16-bit family probe

Observed 2026-10-21 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Brotli 1.1.0, the pinned MAME 0.161 source archive and
Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config was available for the browser probes;
no private identity or path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`konami-16.lua`](../../../mame/targets/konami-16.lua) and
[`konami-16.lst`](../../../mame/targets/konami-16.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts konami-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/konami-16/mamekonami-16"
```

| Result | Final corrected build wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ------------------------------: | -------------------: | ---------------------: |
| Pass | 57.89 s on the reused source/object cache | 98 | 98 |

The first invocation unpacked the source and reached the link after 129.09 s,
but the emsdk-bundled Node 8 could not initialize stderr when launched beneath
the current Node 22 `spawnSync` capture (`ERR_UNKNOWN_STREAM_TYPE`). For the
successful invocation, the local emsdk configuration temporarily selected the
host Node 22 as Emscripten's JavaScript engine; the config was restored by a
shell trap afterward. The MAME source, Emscripten version, LLVM tools and link
flags remained pinned. A successful clean-source timing was therefore not
available without the prohibited `--fresh` operation.

The independently derived list had 98 entries and exactly matched the
production count, so no list correction was needed. Source inspection added
the six driver groups, their adjacent units and the shared Konami video IC
units. In this release, `CPUS["M6809"]` supplies the M6809, HD6309 and KONAMI
variants. The drivers also prove the need for YM3812, samples, OKIM6295,
address-map banks and K053252 beyond the matrix shorthand.

The first genuine link identified the remaining `mystwarr.c`-class
dependencies: `machine/konamigx.c` and `video/konamigx.c` provide the reused
GX word handlers and mixer, while those helpers require the TMS57002 and
K056800 cores. Adding those target-level dependencies resolved every undefined
symbol. The resulting build identity is
`04f873e154c60d13a083558a4e3f300ed603a437d4e86082f28975f529fe0d25`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,511,127 | 1,671,011 | 1,248,272 |
| JavaScript | 302,191 | 65,596 | 55,293 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds `dadandrn`
largest at 21,233,792 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
42,467,584 bytes, 21.09% of the safe budget, leaving 158,859,008 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

measured 2026-10-21/22: 521–929 ms to the first valid frame across five titles (four of them loaded); see the measured section below.

The ignored lawful preload config validated and named an available family
set, but this sandbox forbids the browser mechanics before any adapter code
runs. The repository browser command failed every listening case with
`listen EPERM: operation not permitted 127.0.0.1`. A throwaway probe then
replaced localhost with Playwright request interception, but both the headless
shell and full Chromium were terminated during process startup by the same
socket policy (`sandbox_host_linux` or Crashpad `Operation not permitted`).
Consequently neither startup time nor the required non-blank first-frame
confirmation was observed.

Outside this restricted sandbox, run the ignored preload through the real
adapter and record Chromium wall-clock milliseconds from immediately before
`adapter.start()`/`callMain()` to its first valid frame, plus time to the first
frame containing a non-black RGB pixel. Exclude file selection and network
transfer, and record browser version and desktop CPU.

## F5 — Are native refresh and upright geometry correct?

measured: five titles at 320×224/60.000 Hz, 288×224/59.186 Hz, 304×224/59.170 Hz and 304×224/60.000 Hz, every frame at native size; worst cadence error 0.76 % (loaded), 0.25 % quiet; see the table below.

The same pre-browser sandbox failure prevented geometry or cadence evidence.
Outside this sandbox, record the first frame's upright width and height and
the public MAME native refresh. Then measure emulated ticks per wall second at
controlled 60, 90, 120 and 144 Hz scheduler cadences. Report each percentage
error; every rate must be within 0.5% of native refresh, every delivered frame
must retain native geometry, and at least one frame must be non-blank.

## F6 — Does the heaviest title sustain full speed?

measured: 60 s ratios 0.9990–1.0000; the heaviest title (288×224 at 59.186 Hz) holds 1.0000 on a quiet host.

The available private config is not a `mystwarr.c`-class title, so even a
successful run would be representative rather than the strict heaviest-family
gate. The sandbox prevented that representative run as well. Outside this
environment, measure exactly 60 seconds after warm-up and report
`emulated seconds / wall seconds` on desktop, then repeat under Chromium's 4×
CPU-throttled mobile proxy. The desktop ratio must establish full speed; the
proxy result is informational. A lawful `mystwarr.c`-class set is still
needed for the strict F6 family result.

## F4–F6 measured 2026-10-21/22

Measured with the `build-mame` production artifact, headless Chromium on the
desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock) and the M3–M5 acceptance in
`tests/browser/36-input-audio-acceptance.test.ts`. Identities stay in the
ignored preload configs; titles are described by their native geometry.
Runs marked "loaded" overlapped three Emscripten builds on the same host and
are conservative; the 60 s ratio tolerance is 2 %, the cadence tolerance 1 %.

| Title | F4 | F5 | F6 | Acceptance |
| ----- | -- | -- | -- | ---------- |
| 320×224 at 60.000 Hz (loaded) | 929 ms | 60 → 60.00 (−0.01 %), 90 → 59.95 (−0.09 %), 120 → 59.91 (−0.15 %), 144 → 59.93 (−0.12 %) | 1.0000 | pass |
| 288×224 at 59.186 Hz (loaded) | 795 ms | 60 → 59.27 (+0.15 %), 90 → 59.46 (+0.46 %), 120 → 59.21 (+0.04 %), 144 → 59.26 (+0.12 %) | 1.0000 | pass |
| 304×224 at 59.170 Hz (loaded) | 881 ms | 60 → 59.05 (−0.21 %), 90 → 59.25 (+0.14 %), 120 → 58.99 (−0.31 %), 144 → 59.62 (+0.76 %) | 0.9996 | pass |
| 288×224 at 59.186 Hz, heaviest (quiet) | 740 ms | 60 → 59.33 (+0.25 %), 90 → 59.18 (−0.01 %), 120 → 59.26 (+0.13 %), 144 → 59.25 (+0.11 %) | 1.0000 | pass |
| 304×224 at 60.000 Hz (loaded) | 521 ms | 60 → 60.15 (+0.25 %), 90 → 59.95 (−0.08 %), 120 → 60.12 (+0.21 %), 144 → 59.99 (−0.02 %) | 0.9990 | pass |

The heaviest title missed the 1 % cadence gate at 90 and 120 Hz (−2.3 %)
only while three builds shared the host; the quiet re-measure is the row
recorded.
