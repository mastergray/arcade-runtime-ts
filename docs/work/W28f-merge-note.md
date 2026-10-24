# W28f merge note — `toobin.c` Atari 68010 extension

Status: production build complete; F4–F6 for `toobin.c` are pending because
this sandbox cannot bind the browser test server. The extended target pair,
metadata extraction, privacy-safe preload audit, threading gate, type checks
and full spec suite pass. The integrator must complete the desktop browser
measurements after merge.

## Deliverables

- `mame/targets/atari-gauntlet.lua`: adds the `toobin.c` driver/video pair and
  the JSA implementation to the existing Atari 68010 family.
- `mame/targets/atari-gauntlet.lst`: derives from both driver sources and
  contains 34 public machines, including six from `toobin.c`.
- `mame/builds/atari-gauntlet.json`: records all three added source units and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/atari-gauntlet.md`: replaces F1–F3 with whole-family
  evidence, adds the new-driver F4–F6 browser blocker, and preserves the
  earlier driver's measurements separately.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to two
  driver sources and 34 expected machines.
- `dist/mame/atari-gauntlet/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed pre-extension build compiled the complete original family and
reached the final link after 136.21 seconds, where the pinned Node 8 JavaScript
compiler stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured standard streams.
An ignored worktree-local `BASH_ENV` configuration then selected host Node 22
for Emscripten's JavaScript helpers only; the pinned C/C++ compiler, native
optimizer, Binaryen, source, flags and production pipeline remained unchanged.
The successful cached-source baseline completed in 42.31 seconds. After the
tracked extension, the successful cached-source production pipeline completed
in 27.41 seconds.

```text
dist/mame/atari-gauntlet/
├── build.json                       2,119 bytes
├── mameatari-gauntlet.js          302,199 bytes
├── mameatari-gauntlet.wasm      6,016,749 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           34 files, 258,206 aggregate bytes
```

- `.lst` and `-listfull` machine count: 34
- buildId: `221f082cf26c46c25b0b78fd94774ec28ada3d2d2a8dfc99618bc09be8992e7c`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 5,975,125 | 1,545,906 | 1,159,995 |
| After extension | 6,016,749 | 1,557,498 | 1,167,957 |
| Increase | 41,624 (0.70%) | 11,592 (0.75%) | 7,962 (0.69%) |

This family download grows for every existing consumer, not only the added
board. The JavaScript artifact after extension is 302,199 raw, 65,611 gzip-9
and 55,333 Brotli-11 bytes.

F3 found a largest whole-family public metadata ROM sum of 2,703,360 bytes.
Its conservative two-copy estimate is 5,406,720 bytes, 2.69% of the
201,326,592-byte safe budget, leaving 195,919,872 bytes. Every family machine
therefore remains within 4,096 pages.

## Target findings

The independent derivation found 28 machines from `gauntlet.c` and six from
`toobin.c`. The 34-entry result matched production `-listfull`, so no list
correction was needed.

The added board configures one M68010 and the JSA-I sound device. Its M6502,
YM2151, POKEY and TMS5220 cores were already selected, as were the shared
Atari EEPROM, motion-object and `atarigen.c` units. The existing OKIM6295
selection is still necessary because the complete `audio/atarijsa.c` unit
also defines the later JSA variants. Adding the driver/video pair and that JSA
unit linked without another source or core correction.

The driver explicitly decodes 512 KiB of playfield graphics, 2 MiB of
motion-object graphics and 16 KiB of alpha graphics. The metadata estimate
leaves ample heap margin, and the sandbox browser run failed before module
startup rather than with a memory abort. If the integrator's host run reports
the adapter's “needs more memory” error, set `memoryPages` to 8,192, rebuild
this family and repeat F4–F6.

The added driver names no sample set, so it needs no optional sample archive.
It uses a 2804 EEPROM and generated metadata exposes one service-mode selector.
It is marked `GAME_SUPPORTS_SAVE`; browser confirmation of the production
selector and quick-save flows remains pending with F4–F6.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 34
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 27 harmless unexpected
entries. The config was also confirmed to select a machine defined by
`toobin.c`.

The required real browser command was attempted and completed 0 passed, 32
failed and 25 skipped. Every runnable case stopped at
`listen EPERM: operation not permitted 127.0.0.1` before Chromium page
creation. Consequently, for `toobin.c`:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; native geometry, refresh and controlled cadences were not
  observed. Source timing predicts 60.096 Hz and upright 384×512 output.
- F6 is pending; there is no measured desktop ratio, so the performance gate
  remains open.
- The production EEPROM selector and quick-save cases are pending for the same
  loopback restriction; neither reached the browser or emulator.

On a host that permits loopback and Chromium, the integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser
```

Copy only privacy-safe F4–F6, selector and quick-save outcomes into the family
probe. If startup reports the adapter memory error, apply the 8,192-page
correction above before repeating the measurements.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28f-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28f-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-gauntlet/mameatari-gauntlet"

stat -c '%n %s' \
  dist/mame/atari-gauntlet/mameatari-gauntlet.wasm \
  dist/mame/atari-gauntlet/mameatari-gauntlet.js \
  dist/mame/atari-gauntlet/build.json

gzip -9 -c dist/mame/atari-gauntlet/mameatari-gauntlet.wasm | wc -c
gzip -9 -c dist/mame/atari-gauntlet/mameatari-gauntlet.js | wc -c

node --input-type=module -e \
  'import { brotliCompressSync, constants } from "node:zlib"; import { readFileSync } from "node:fs"; for (const path of process.argv.slice(1)) console.log(path, brotliCompressSync(readFileSync(path), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length)' \
  dist/mame/atari-gauntlet/mameatari-gauntlet.wasm \
  dist/mame/atari-gauntlet/mameatari-gauntlet.js

node --input-type=module -e \
  'import { readdirSync, readFileSync } from "node:fs"; const root=process.argv[1]; const totals=readdirSync(root).filter((name)=>name.endsWith(".json")).map((name)=>JSON.parse(readFileSync(`${root}/${name}`,"utf8")).roms.reduce((sum,rom)=>sum+rom.size,0)); console.log(Math.max(...totals));' \
  dist/mame/atari-gauntlet/romsets

node --import tsx .cache/w28f-audit.ts \
  res/preload-atari-gauntlet.json

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser

npm run check && npm test
```

- Unshimmed baseline build: compiled the original family, then failed at the
  final link after 136.21 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- Compatibility baseline build: passed in 42.31 seconds with 28 machines,
  5,975,125 Wasm bytes and baseline build id `0796f6b5ede8…`.
- Extended compatibility build: passed in 27.41 seconds with 34 machines,
  6,016,749 Wasm bytes, 34 metadata files and build id `221f082cf26c…`.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 2,703,360-byte largest ROM sum; the conservative
  estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 34 expected
  files valid and no sample dependency.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped, leaving F4–F6, selector and quick-save evidence pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 555 cases; 555 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.
- The combined `npm run check && npm test` gate was run once after the family
  implementation and again after the merge note; both runs passed with the
  same 555/555 spec result.
- The scoped family implementation was committed successfully as `92c215d`.

## Integrator note

The integrator-owned specification remains stale: §4.6's `atari-gauntlet`
row should add `drivers/toobin.c`, `video/toobin.c`, `audio/atarijsa.c`, the
JSA-I sound board and the new 34-machine count. The earlier statement that
`audio/atarijsa.c` is unused is no longer true. This package did not edit the
spec because it is outside W28f's write set.

## Integrator notes

Gate run on the host with the ignored preload (2026-10-24, quiet host):
32 passed, 0 failed, 25 skipped by design. F4 407 ms; F5 384×512 vertical at 60.096 Hz, cadences within 1 %; F6 1.0001 over
60 s; audio queue peak 77 ms; coin and start reached play; two pads
assigned and released. Measurements copied into the probe record.
