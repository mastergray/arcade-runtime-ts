# Seta 2 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, hash or path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`seta-2.lua`](../../../mame/targets/seta-2.lua) and
[`seta-2.lst`](../../../mame/targets/seta-2.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/seta-2/mameseta-2"
```

| Result | Initial compile to first link | Final cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | ---------------------------: | -------------------: | ---------------------: |
| Pass | 113.00 s | 73.40 s | 26 | 26 |

The independently derived list contains 26 machines from `drivers/seta2.c`
and matched the production count without a list correction. The pinned Seta
vendor block contributes exactly `drivers/seta2.c` and `video/seta2.c`. The
target selects the M68000/ColdFire and H8 CPU paths, X1-010 and OKI M9810
sound cores, TMP68301 and ColdFire peripheral devices, and serial EEPROM.

The first complete host-Node link found that one public machine configured by
`seta2.c` also references MAME's shared ticket-dispenser implementation. That
unit lives in the upstream `mame.lua` general-components block rather than the
Seta vendor block. Adding only `machine/ticket.c` resolved every undefined
symbol; no other driver, video or shared unit was added.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helpers to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.
The resulting build identity is
`2db7eb2a7d99f2f42a943cd42783e2263d7b513f29b944a8ea978ff88d0d4b94`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,197,937 | 1,564,179 | 1,175,055 |
| JavaScript | 302,025 | 65,565 | 55,274 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 39,845,888 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
79,691,776 bytes, 39.58% of the safe budget, leaving 121,634,816 bytes. No
machine in the family fails the §5 estimate on paper. The host browser run
proved the estimate wrong for this board: with 4,096 pages the ignored preload
aborted with MAME's out-of-memory error at start-up (the adapter reported "needs
more memory than this family build provides (256 MiB fixed heap)"). The driver
decodes its 24 MiB of 8-bit sprite data into MAME's gfx elements at start, which
the metadata-only estimate does not count. The integrator raised `memoryPages`
to 8,192 (512 MiB, as `cps2` and `neogeo` use) and rebuilt; the start then
succeeded.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-23 (Chrome 150, Core i7-1165G7,
headless, host load average about 5 from unrelated daemons) with the ignored
preload after the heap was raised to 8,192 pages (see F3): 802 ms and 876 ms
on two runs from immediately before `adapter.start()` to the first valid,
non-blank frame. With 4,096 pages the machine did not start at all.

## F5 — Are native refresh and upright geometry correct?

Native refresh 60.000 Hz, horizontal, 304×232; every frame was 304×232 and
the first frame was non-blank. Cadences on the two runs: 60 Hz → 59.12 fps
(−1.47 %) then 59.89 fps (−0.18 %); 90 Hz → 59.91 fps (−0.16 %) then
59.54 fps (−0.76 %); 120 Hz → 59.43 fps (−0.95 %) then 60.05 fps (+0.09 %);
144 Hz → 60.07 fps (+0.11 %) then 57.32 fps (−4.47 %). Each run had one
cadence outside the 1 % tolerance, a different one each time, so the
measurement case failed on both runs while every rate passed on at least
one. As with the Y Board, the misses are dropped frames under host load; the
geometry and refresh are correct. The set carries MAME's own
`GAME_IMPERFECT_GRAPHICS` flag in 0.161, upstream's note on the driver.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 0.9806 and 0.9932 over 60 s on
the two runs, frameskip disabled, both inside the 2 % tolerance, so the
family ships under the W27 rule that F6 decides. The margin is the thinnest
in the matrix on the first run; the TMP68301 with 24 MiB of 8-bit sprites
and the X1-010 is heavier than its clock suggests. M3–M5 acceptance on the
same runs: audio queue peak 109 ms and 97 ms against the 120 ms cap, the
highest in the matrix; keyboard coin and start reached play; two pads
assigned and released; the quick-save case passed (the driver supports save
states). The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-seta-2.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-seta-2.json" \
  npm run test:browser
```

The integrator's two host runs each completed 31 passed, 1 failed (the
cadence case above), 25 skipped by design.
