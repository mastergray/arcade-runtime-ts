# W28d merge note — `nintendo-classic`

Status: production build complete; F4–F6 pending because this sandbox could
not bind the browser test server. The target pair, metadata extraction,
privacy-safe preload audit, threading gate, type checks and full spec suite
pass. The desktop performance gate remains open for the integrator to measure
after merge.

## Deliverables

- `mame/targets/nintendo-classic.lua`: the pinned `dkong.c` driver/audio/video
  group, Z80 and S2650 main CPU paths, MCS-48 sound CPU, 2A03 CPU and NES APU
  paths, discrete sound, M58817 speech and M58819 controller paths, DMA,
  latch and serial-EEPROM cores.
- `mame/targets/nintendo-classic.lst`: 36 public machines derived from
  `drivers/dkong.c`.
- `mame/builds/nintendo-classic.json`: 4,096-page production build input.
- `docs/probes/families/nintendo-classic.md`: F1–F6 record, with F4–F6
  explicitly pending the unavailable sandbox browser capability and the
  memory, samples, EEPROM and quick-save findings recorded.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.
- `dist/mame/nintendo-classic/`: the ignored production output described
  below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 100.89 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27h,
an ignored worktree-local `BASH_ENV` selects host Node 22 for Emscripten's
JavaScript helper; the pinned C/C++ compiler, native optimizer, Binaryen,
source, flags and production pipeline remain unchanged.

The first compatibility rerun reached `compiler.js` in 28.90 seconds but the
build runner did not surface its diagnostic. An `EMCC_DEBUG=1` rerun stopped
at the same point in 15.12 seconds. A temporary ignored Node wrapper copied
only the generated compiler settings and a direct replay exposed the latch
symbols described below. After that one target correction, the successful
cached-source production pipeline completed in 34.82 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4
```

```text
dist/mame/nintendo-classic/
├── build.json                       2,088 bytes
├── mamenintendo-classic.js        302,033 bytes
├── mamenintendo-classic.wasm    5,620,488 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           36 files, 239,116 aggregate bytes
```

- `.lst` and `-listfull` machine count: 36
- Wasm bytes: 5,620,488
- buildId: `577f8ee330ac6da282ea6f01f18cd448ecc31e305eddae7d9a9dc5a636a91f13`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,620,488 | 1,515,112 | 1,136,512 |
| JavaScript | 302,033 | 65,578 | 55,394 |

F3 found a largest public metadata ROM sum of 99,072 bytes. Its conservative
two-copy estimate is 198,144 bytes, 0.10% of the 201,326,592-byte safe budget,
leaving 201,128,448 bytes. The driver uses small fixed tile and sprite regions,
not large graphics-region expansion, so the family remains at 4,096 pages. If
the host browser nevertheless reports the adapter's fixed-heap error, raise
the build to 8,192 pages and repeat F4–F6.

## Target findings and correction

The independent derivation found 36 public entries in `dkong.c`, exactly
matching production `-listfull`, so no list correction was needed. The pinned
Nintendo source block contributes exactly `drivers/dkong.c`, `audio/dkong.c`
and `video/dkong.c`; no `mario.c`, `popeye.c` or adjacent board unit was added.

The driver configures Z80 and S2650 main CPU paths, an MCS-48 sound CPU, two
2A03 sound CPUs, discrete sound, two NES APUs, M58817 speech with an M58819
memory controller, I8257 and Z80 DMA, and serial EEPROM. The harmless
Centronics core keeps the release-era bus archive non-empty.

The direct compiler replay reported only `latch8_device` and `LATCH8`
undefined symbols. The broad upstream target enables that shared machine core
globally, while this isolated board reaches it through `includes/dkong.h` and
its audio configurations. Adding `MACHINES["LATCH8"]` resolved every symbol;
no further target correction was required.

No generated metadata record names a sample archive; the historical sample
interface in the audio source is commented documentation, and the active
speech path uses the selected M58817/M58819 devices. Two public entries use
the serial-EEPROM configuration, while all 36 metadata records still declare
DIP switches. Every public driver declaration has `GAME_SUPPORTS_SAVE`, so
the save-less M35 quick-save limitation is not expected for this family.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 15
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 42 harmless unexpected
entries.

The required real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-nintendo-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-nintendo-classic.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped by design. Every runnable case
stopped at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium
page creation. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; upright geometry, 60.606 Hz refresh and controlled cadences
  were not observed.
- F6 is pending; the discrete sound cost has no measured 60-second desktop
  ratio, so the family cannot yet be classified against the desktop gate.
- The quick-save path is pending in-browser confirmation despite the driver's
  save-support declarations.

The integrator should rerun the browser command above on a host that permits
Chromium and loopback, then copy only privacy-safe measurements into the
family probe. If the adapter reports fixed-heap exhaustion, apply the 8,192-
page fallback before repeating the measurements.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4

EMCC_DEBUG=1 BASH_ENV="$PWD/.cache/w28d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/nintendo-classic/mamenintendo-classic"

stat -c '%n %s' dist/mame/nintendo-classic/mamenintendo-classic.wasm \
  dist/mame/nintendo-classic/mamenintendo-classic.js \
  dist/mame/nintendo-classic/build.json
gzip -9 -c dist/mame/nintendo-classic/mamenintendo-classic.wasm | wc -c
gzip -9 -c dist/mame/nintendo-classic/mamenintendo-classic.js | wc -c

node --import tsx .cache/w28d-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-nintendo-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-nintendo-classic.json" \
  npm run test:browser

npm run check
npm test
npm run check && npm test
```

- First production build: compiled the family, then failed at the final link
  after 100.89 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility diagnostics: the first two reruns stopped after
  28.90 and 15.12 seconds; the captured compiler settings replay identified
  only the shared latch symbols. The wrapper-assisted diagnostic rerun took
  40.31 seconds while regenerating SDK cache entries shared with the
  concurrent wave builds.
- Corrected compatibility build: passed in 34.82 seconds with 36 machines and
  36 metadata files.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 99,072-byte largest ROM sum; the conservative
  198,144-byte estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 15 expected
  files valid and no sample dependency.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so F4–F6 remain pending.
- A preliminary direct spec run before the final gates encountered a transient
  loopback denial in its local-page case: 552 passed, 2 failed and 2 skipped.
  The prescribed `npm test` rerun passed once the sandbox allowed that bind.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 556 cases; 556 passed, 0 failed, 0 skipped. The real
  new output was present and passed the release-output inspection.
- Final combined `npm run check && npm test` from the committed package state:
  passed with the same 556/556 spec result.

## Sandbox git note

The first attempts to commit the target correction and this merge note were
each refused when Git could not create the shared worktree's `index.lock` and
reported that filesystem as read-only. Work continued as instructed; the
target retry succeeded, and no repository data was lost.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`nintendo-classic` family after the host F6 decision, naming `dkong.c`, its
driver/audio/video units, the four CPU paths, discrete and NES APU sound,
M58817/M58819 speech, DMA, latch and EEPROM dependencies. This package did
not edit the spec because it is outside W28d's write set.
