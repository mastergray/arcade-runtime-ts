# W27h merge note — `sega-s32`

Status: production build complete; F4–F6 pending because this sandbox cannot
bind the browser test server. The target pair, metadata extraction, private
preload audit, threading gate, type checks and full spec suite pass. The
desktop performance gate remains open for the integrator to measure after
merge; if it fails, record the family as "built, below the gate" with the
measured ratio and leave it out of the 1.0.0 matrix.

## Deliverables

- `mame/targets/sega-s32.lua`: the pinned driver/machine/video group,
  315-5296 I/O implementation, V60/V70 and V25 protection CPU cores,
  Z80 sound CPU, RF5C68 and MultiPCM paths, Yamaha FM and EEPROM cores.
- `mame/targets/sega-s32.lst`: 52 public machines derived from
  `drivers/segas32.c`.
- `mame/builds/sega-s32.json`: 4,096-page production build input.
- `docs/probes/families/sega-s32.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable sandbox browser capability and MAME's own
  `GAME_IMPERFECT_GRAPHICS` flag distinguished from a port defect under F5.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.
- `dist/mame/sega-s32/`: the ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 107.97 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s32 --jobs 6
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27f,
an ignored worktree-local `BASH_ENV` selects host Node 22 for Emscripten's
JavaScript helpers only; the pinned C/C++ compiler, native optimizer,
Binaryen, source, flags and production pipeline remain unchanged. The
successful cached-source production pipeline completed in 34.16 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s32 --jobs 6
```

```text
dist/mame/sega-s32/
├── build.json                       2,260 bytes
├── mamesega-s32.js                302,356 bytes
├── mamesega-s32.wasm            5,590,571 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           52 files, 291,722 aggregate bytes
```

- `.lst` and `-listfull` machine count: 52
- Wasm bytes: 5,590,571
- buildId: `6fd71b24330fd8f100cd2d8f25443b1004f912f3d3a5f0dde9a4f470cf15b795`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,590,571 | 1,511,118 | 1,136,779 |
| JavaScript | 302,356 | 65,603 | 55,345 |

F3 found a largest public metadata ROM sum of 27,000,832 bytes. Its
conservative two-copy estimate is 54,001,664 bytes, 26.82% of the
201,326,592-byte safe budget, leaving 147,324,928 bytes. Every family machine
therefore remains within 4,096 pages.

## Target findings

The independent derivation found 52 public entries in `segas32.c`, exactly
matching production `-listfull`, so no list correction was needed. The source
closure compiled and linked on the first target definition, with no missing
unit or selectable core once the host-Node compatibility environment exposed
the link.

The driver configures V60 and V70 main CPUs through the V60 selectable core,
a Z80 sound CPU, and a custom V25 protection MCU through the NEC core. Its two
board paths configure YM3438 plus RF5C68 or the 315-5560 MultiPCM. The target
also selects serial EEPROM, compiles `drivers/segas32.c`,
`machine/segas32.c`, `video/segas32.c` and the Sega source block's adjacent
`machine/315_5296.c`, and carries the harmless Centronics core required to
keep the release-era bus archive non-empty.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 19
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 11 harmless unexpected
entries.

The required real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s32.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s32.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped by design. Every runnable case
stopped at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium
page creation. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; geometry, refresh and controlled cadences were not observed.
  The configured entry carries `GAME_IMPERFECT_GRAPHICS` in MAME 0.161's
  `segas32.c`; that is the upstream emulator's flag, not a browser-port defect.
- F6 is pending; there is no measured desktop ratio, so the family is built
  but cannot yet be classified as passing or "built, below the gate."

The integrator should rerun the command above on a host that permits Chromium
and loopback, then copy only privacy-safe measurements into the family probe.
If desktop F6 misses the gate, record the measured ratio plainly and leave the
family out of the 1.0.0 matrix without further package work.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s32 --jobs 6

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27h-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s32 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-s32/mamesega-s32"

gzip -9 -c dist/mame/sega-s32/mamesega-s32.wasm | wc -c
gzip -9 -c dist/mame/sega-s32/mamesega-s32.js | wc -c

node --import tsx .cache/w27h-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s32.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s32.json" \
  npm run test:browser

npm run check
npm test
```

- First production build: compiled the family, then failed at the final link
  after 107.97 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility build: passed in 34.16 seconds with 52 machines and
  52 metadata files; no target correction was required.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 27,000,832-byte largest ROM sum; the conservative
  estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 19 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so F4–F6 remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 553 cases; 553 passed, 0 failed, 0 skipped. The real
  new output was present and passed `tests/spec/32-build-output.test.ts`.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`sega-s32` family after the host F6 decision, naming `segas32.c`, its
driver/machine/video units, V60/V70 plus the V25 protection MCU, the two sound
paths and the 315-5296 I/O unit. If F6 misses the desktop gate, mark the row as
built but excluded from the 1.0.0 matrix with the measured ratio. This package
did not edit the spec because it is outside W27h's write set.
