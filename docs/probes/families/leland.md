# Leland family probe

Observed 2026-10-24 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, ROM hash or path is recorded
here.

## F1 — Does the target pair compile and expose every machine?

The committed [`leland.lua`](../../../mame/targets/leland.lua) and
[`leland.lst`](../../../mame/targets/leland.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/leland/mameleland"
```

| Result | Initial compile to first link | Compatibility pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | ---------------------: | -------------------: | ---------------------: |
| Pass | 153.63 s | 24.90 s | 25 | 25 |

The independently derived list contains 25 machines from `drivers/leland.c`
and matched the production count without a list correction. The source group
contains `drivers/leland.c`, `machine/leland.c`, `audio/leland.c` and
`video/leland.c`. It selects the Z80 and I86 CPU paths, AY-3-8910, DAC and
YM2151 sound, serial EEPROM and PIT8253-family timer devices. The 80186 sound
implementation shares one translation unit with device variants that use the
YM2151 and PIT cores, so both are required even though the older configurations
use only the AY and DAC paths. A harmless Centronics core keeps the pinned
release's mandatory bus archive non-empty.

The prescribed first build compiled the complete source closure, then the
pinned Node 8 JavaScript compiler stopped at the final link with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured standard streams. The
documented ignored `BASH_ENV` compatibility setup selects host Node 22 for
Emscripten's JavaScript helpers only; the pinned C/C++ compiler, native
optimizer, Binaryen, source, flags and production pipeline remain unchanged.
The resulting build identity is
`1a4fd124690a4aa8264cf95f96c1bb979006b72430d63ce36f53c6bef966c3e4`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,178,079 | 1,445,750 | 1,090,185 |
| JavaScript | 302,173 | 65,565 | 55,318 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 1,286,272 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
2,572,544 bytes, 1.28% of the safe budget, leaving 198,754,048 bytes. No
machine in the family fails the §5 estimate.

This driver does not decode large graphics regions into expanded MAME gfx
elements. `video/leland.c` reads packed background pixels directly from the
graphics ROM region and allocates a 64 KiB video RAM; its adjacent video variant
adds only a 64 KiB QRAM. The W27e hidden sprite-expansion cost therefore does
not apply. Keep `memoryPages: 4096`; if the pending host browser run nevertheless
reports the adapter's fixed-heap error, raise it to 8,192 as W28 §2 directs.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

Pending a host that permits the browser test server. The privacy-safe preload
audit passed both strict and MAME-compatible policy: one required archive was
present, all 24 expected files were valid, and there were zero missing,
wrong-size, wrong-CRC, optional-missing, warning or archive-problem rows. The
browser command was attempted, but every runnable page stopped at
`listen EPERM: operation not permitted 127.0.0.1` before Chromium could start
the machine, so no first-frame time or non-blank-frame observation exists.

## F5 — Are native refresh and upright geometry correct?

Pending the same host run. It must record the first-frame geometry and
orientation, confirm non-blank output, and measure native refresh at controlled
60, 90, 120 and 144 Hz scheduler cadences. The generated metadata declares no
DIP switches; the production selector case correctly records that there is
nothing to select on this EEPROM-backed board.

## F6 — Does the heaviest title sustain full speed?

Pending the same host run. It must record the emulated-time/wall-time ratio over
60 seconds on desktop with frameskip disabled. The informational 4× throttled
mobile proxy remains deferred to M10.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-leland.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-leland.json" \
  npm run test:browser
```

The sandbox attempt completed 1 passed, 31 failed and 25 skipped by design;
all 31 failures were the loopback `EPERM` above. The passing production-selector
case was the expected no-DIP result.

## W28h save-state observation

Every public entry in pinned `drivers/leland.c` omits `GAME_SUPPORTS_SAVE`.
Consequently the harness production quick-save case is expected to fail for
the ignored preload until M35 exposes and handles that capability; this is a
known driver limitation for this wave, not a family-build defect. The sandbox
could not reach that browser interaction because loopback binding failed first.
