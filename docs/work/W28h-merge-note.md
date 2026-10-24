# W28h merge note — `leland`

Status: production build complete; F4–F6 pending because this sandbox cannot
bind the browser test server. The target pair, metadata extraction, private
preload audit, threading gate, type checks and full spec suite pass. The
desktop startup, display and performance gates remain for the integrator to
measure after merge. The package-specific M35 quick-save limitation and the
board's zero-DIP metadata are recorded rather than changed.

## Deliverables

- `mame/targets/leland.lua`: the pinned driver, machine, audio and video group;
  Z80 and I86 CPU cores; AY-3-8910, DAC and YM2151 sound; serial EEPROM and
  PIT8253-family timer support.
- `mame/targets/leland.lst`: 25 public machines derived from
  `drivers/leland.c`.
- `mame/builds/leland.json`: 4,096-page production build input.
- `docs/probes/families/leland.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable sandbox browser capability and the M35 quick-save
  limitation recorded from pinned source.
- `tests/spec/04-mame-family-targets.test.ts`: one self-contained
  `FAMILY_TARGETS` row.
- `dist/mame/leland/`: the ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 153.63 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27h,
an ignored worktree-local `BASH_ENV` selects host Node 22 for Emscripten's
JavaScript helpers only; the pinned C/C++ compiler, native optimizer, Binaryen,
source, flags and production pipeline remain unchanged. The successful
cached-source production pipeline completed in 24.90 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4
```

```text
dist/mame/leland/
├── build.json                       1,884 bytes
├── mameleland.js                  302,173 bytes
├── mameleland.wasm              5,178,079 bytes
├── notices/                          14 files, 562,168 aggregate bytes
└── romsets/                          25 files, 175,202 aggregate bytes
```

- `.lst` and `-listfull` machine count: 25
- Wasm bytes: 5,178,079
- buildId: `1a4fd124690a4aa8264cf95f96c1bb979006b72430d63ce36f53c6bef966c3e4`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,178,079 | 1,445,750 | 1,090,185 |
| JavaScript | 302,173 | 65,565 | 55,318 |

F3 found a largest public metadata ROM sum of 1,286,272 bytes. Its
conservative two-copy estimate is 2,572,544 bytes, 1.28% of the
201,326,592-byte safe budget, leaving 198,754,048 bytes. Every family machine
therefore remains within 4,096 pages. Unlike W27e, this driver reads packed
background pixels directly from the graphics region; it does not expand a
large sprite region into gfx elements. Its video implementation allocates
64 KiB of video RAM, with another 64 KiB QRAM only in the adjacent variant.

## Target findings

The independent derivation found 25 public entries in `leland.c`, exactly
matching production `-listfull`, so no list correction was needed. The source
closure compiled and linked without a missing unit or selectable core once the
host-Node compatibility environment exposed the link.

The board configures twin Z80s and adds an I80186 on its later sound path.
The family target selects AY-3-8910 and DAC sound plus the YM2151 and
PIT8253-family timer cores referenced by other device variants compiled in the
shared `audio/leland.c` translation unit. Serial EEPROM is selected directly;
the release's standard NVRAM implementation needs no selectable machine core.
A harmless Centronics core keeps the pinned release's mandatory bus archive
non-empty.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one required archive present,
all 24 expected files valid, zero missing, wrong-size, wrong-CRC or
optional-missing entries, zero warnings and archive problems, and 20 harmless
unexpected entries. The generated metadata names no sample set and declares no
DIP switches; the production selector case records that there is nothing to
select.

The required real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-leland.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-leland.json" \
  npm run test:browser
```

It completed 1 passed, 31 failed and 25 skipped by design. Every runnable page
stopped at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium
page creation. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; geometry, orientation, refresh and controlled cadences were
  not observed.
- F6 is pending; there is no measured 60-second desktop ratio.
- The harness quick-save interaction did not run. Pinned `drivers/leland.c`
  gives every public entry flags that omit `GAME_SUPPORTS_SAVE`, so this case
  is expected to fail until M35 exposes and handles that capability. W28h
  records the limitation and makes no save-path change.

The integrator should rerun the command above on a host that permits Chromium
and loopback, then copy only privacy-safe measurements into the family probe.
If the adapter reports its fixed-heap error despite the source-based graphics
analysis, raise `memoryPages` to 8,192 and rebuild as W28 §2 directs.

## Verification

Commands and results, in execution order:

```sh
npm test

/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts leland --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/leland/mameleland"

stat -c '%n %s' dist/mame/leland/mameleland.wasm \
  dist/mame/leland/mameleland.js dist/mame/leland/build.json

gzip -9 -c dist/mame/leland/mameleland.wasm | wc -c
gzip -9 -c dist/mame/leland/mameleland.js | wc -c

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-leland.json" \
  node --import tsx .cache/w28h-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-leland.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-leland.json" \
  npm run test:browser

npm run check
npm test

npm run check && npm test
```

- Initial target/spec run: 30 files, 556 cases; 556 passed, 0 failed, 0
  skipped.
- First production build: compiled the family, then failed at the final link
  after 153.63 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility build: passed in 24.90 seconds with 25 machines and
  25 metadata files; no target correction was required.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 1,286,272-byte largest ROM sum; the conservative
  estimate fits the safe budget, and source inspection found no large decoded
  graphics allocation.
- Privacy-safe preload audit: both policies returned `ok` with all 24 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 1 passed, 31 failed and
  25 skipped by design, so F4–F6 remain pending and quick-save was not reached.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 556 cases; 556 passed, 0 failed, 0 skipped. The real
  new output was present and passed `tests/spec/32-build-output.test.ts`.
- Final combined `npm run check && npm test` rerun from the committed package
  state: passed with the same 556/556 spec result.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`leland` family after the host F6 decision, naming `drivers/leland.c` and its
machine, audio and video units, twin Z80s, the 80186 sound CPU, AY-3-8910 and
DAC paths, EEPROM and the shared audio-unit YM2151/PIT dependencies. It should
also record the zero-DIP EEPROM behavior and lack of `GAME_SUPPORTS_SAVE`
pending M35. This package did not edit the spec because it is outside W28h's
write set.
