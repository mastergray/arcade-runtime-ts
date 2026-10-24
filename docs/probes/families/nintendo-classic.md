# Nintendo classic family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, hash or resolved path is
recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`nintendo-classic.lua`](../../../mame/targets/nintendo-classic.lua)
and [`nintendo-classic.lst`](../../../mame/targets/nintendo-classic.lst) pair
built through the production pipeline. The generated module completed the
ROM-free `-listfull` and `-listxml` paths, and both the pipeline and explicit
threading gates reported one fixed, non-shared 4,096-page memory with no
worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w28d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/nintendo-classic/mamenintendo-classic"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 100.89 s | 34.82 s | 36 | 36 |

The independently derived list contains 36 machines from `drivers/dkong.c`
and matched the production count without a list correction. The pinned
Nintendo vendor block contributes `drivers/dkong.c`, `audio/dkong.c` and
`video/dkong.c`; the later `mario.c` and `popeye.c` board units remain out of
this family.

The target selects Z80 and S2650 main CPU paths, the MCS-48 sound CPU, and
the M6502 path that supplies the two 2A03 sound CPUs. It also selects discrete
sound, two NES APUs, the TMS5110 implementation containing the M58817 speech
device, I8257 and Z80 DMA, the TMS6100 implementation containing the M58819
speech-memory controller, serial EEPROM, and the shared latch device.

The first complete source compile found only the latch symbols undefined.
The broad upstream target enables `MACHINES["LATCH8"]` globally, while this
driver reaches it through `includes/dkong.h` and its audio configurations.
Adding that one core resolved every undefined symbol; no additional driver,
audio or video unit was needed. The resulting build identity is
`577f8ee330ac6da282ea6f01f18cd448ecc31e305eddae7d9a9dc5a636a91f13`.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helper to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.

No generated metadata record names a sample archive. The historical sample
interface text in `audio/dkong.c` is commented documentation; the active
speech path uses M58817/M58819 devices, so this family does not select the
samples core or require external sample files.

Two public entries use the driver's serial-EEPROM conversion configuration.
All 36 generated metadata records still declare DIP switches, so this family
does not exercise the production selector's valid zero-DIP case. Every public
`GAME` declaration in `drivers/dkong.c` carries `GAME_SUPPORTS_SAVE`, so the
M35 quick-save limitation for save-less drivers is not expected here; the
browser run remains needed to confirm the private selection in practice.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,620,488 | 1,515,112 | 1,136,512 |
| JavaScript | 302,033 | 65,578 | 55,394 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 99,072 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
198,144 bytes, 0.10% of the safe budget, leaving 201,128,448 bytes. No machine
in the family fails the §5 estimate, so the build remains at 4,096 pages.

`drivers/dkong.c` does not decode large graphics regions: its tile and sprite
regions are small, fixed early-board data rather than the multi-megabyte
8-bit sprite expansion that invalidated W27e's metadata estimate. If the
integrator's real browser run nevertheless aborts with the adapter's
"needs more memory" error, raise this family to `memoryPages: 8192` and
rebuild before repeating F4–F6.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Measured by the integrator on 2026-10-24 (Chrome 150, Core i7-1165G7,
headless, quiet host) with the ignored preload for a new family: 298 ms from
immediately before `adapter.start()` to the first valid, non-blank frame.

## F5 — Are native refresh and upright geometry correct?

224×256 vertical at 60.606 Hz; every frame that size and the first frame non-blank. Cadences:
60 Hz → 60.81 fps (+0.34 %), 90 Hz → 60.66 fps (+0.10 %), 120 Hz → 60.63 fps (+0.04 %), 144 Hz → 60.60 fps (−0.01 %), all inside the 1 % gate.

## F6 — Does the heaviest title sustain full speed?

Desktop: emulated seconds / wall seconds = 1.0000 over 60 s, frameskip
disabled. M3–M5 acceptance on the same run: audio queue peak 88 ms against
the 120 ms cap, keyboard coin and start reached play, two pads assigned and
released. The 4× CPU-throttled mobile proxy was not run; it is informational
and M28 replaces it.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-nintendo-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-nintendo-classic.json" \
  npm run test:browser
```

The integrator's host run completed 32 passed, 0 failed, 25 skipped by design.
