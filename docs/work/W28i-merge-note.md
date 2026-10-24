# W28i merge note — `gottlieb`

Status: production build complete; F4–F6 pending because this sandbox cannot
bind the browser test server. The target pair, metadata extraction,
privacy-safe preload audit, threading gate, type checks and full spec suite
pass. The desktop performance gate remains open for the integrator to measure
after merge.

## Deliverables

- `mame/targets/gottlieb.lua`: the pinned `gottlieb.c` driver/audio/video
  group, 8088 main CPU, M6502 sound boards, AY-3-8913, DAC, SP0250, samples
  and Votrax paths, RIOT/MIOT devices, plus the PR-8210 and its internal
  MCS-48 controller.
- `mame/targets/gottlieb.lst`: 25 public machines derived from
  `drivers/gottlieb.c`.
- `mame/builds/gottlieb.json`: 4,096-page production build input.
- `docs/probes/families/gottlieb.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable sandbox browser capability and the graphics-memory,
  optional-samples, DIP-selector and quick-save findings recorded.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.
- `dist/mame/gottlieb/`: the ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 138.74 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts gottlieb --jobs 4
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27h,
an ignored worktree-local `BASH_ENV` selects host Node 22 for Emscripten's
JavaScript helper; the pinned C/C++ compiler, native optimizer, Binaryen,
source, flags and production pipeline remain unchanged.

The first compatibility rerun reached `compiler.js` in 27.96 seconds but the
build runner did not surface its diagnostic. A temporary ignored Node wrapper
captured only the generated compiler settings; a direct replay exposed the
PR-8210 controller symbols described below. After that one target correction,
the successful cached-source production pipeline completed in 24.41 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28i-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts gottlieb --jobs 4
```

```text
dist/mame/gottlieb/
├── build.json                       1,891 bytes
├── mamegottlieb.js                302,664 bytes
├── mamegottlieb.wasm            5,262,301 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           25 files, 221,450 aggregate bytes
```

- `.lst` and `-listfull` machine count: 25
- Wasm bytes: 5,262,301
- buildId: `2f94f3dd9d026e04c058926b05276f2b272208ba84bfff6928def39f54c34e0a`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,262,301 | 1,465,004 | 1,107,462 |
| JavaScript | 302,664 | 65,602 | 55,333 |

F3 found a largest public metadata ROM sum of 133,120 bytes. Its conservative
two-copy estimate is 266,240 bytes, 0.13% of the 201,326,592-byte safe budget,
leaving 201,060,352 bytes. The driver uses small fixed character, tile and
sprite regions rather than a large graphics decode, so the family remains at
4,096 pages. If the host browser nevertheless reports the adapter's fixed-heap
error, raise the build to 8,192 pages and repeat F4–F6.

## Target findings and correction

The independent derivation found 25 public entries in `gottlieb.c`, exactly
matching production `-listfull`, so no list correction was needed. The pinned
vendor block contributes exactly `drivers/gottlieb.c`, `audio/gottlieb.c` and
`video/gottlieb.c`; `exterm.c`, its video unit and the TMS34010 core are not in
this family.

The driver configures an 8088 main CPU, M6502 sound CPUs, samples, DAC, two
AY-3-8913 devices and SP0250 speech. Its rev-1 fake-speech path uses samples,
while the compiled audio unit also defines the Votrax-capable fragment. The
target selects the RIOT6532 and MIOT6530 sound-board devices and the PR-8210
laserdisc device. The harmless Centronics core keeps the release-era bus
archive non-empty.

The direct compiler replay reported only `I8049` and the MCS-48 CPU device's
type-info symbol. The PR-8210 implementation configures that controller, so
adding `CPUS["MCS48"]` resolved every symbol. No further selectable core or
compilation-unit correction was required.

Across the public family metadata, three entries expose 134 optional sample
names. The ignored preload's configured board enables the knocker and
faked-speech fragments; raw `-listxml` exposes 45 samples, but its sample-set
basename collides with the required game archive, so the runtime's documented
flat archive conversion omits the optional role. No samples were supplied and
both audit policies still returned `ok`, as expected; the board runs without
those optional sounds. The configured board carries MAME's own
`GAME_IMPERFECT_SOUND` flag.

The driver uses NVRAM in its common board configuration rather than an EEPROM,
and the selected metadata exposes 16 DIP switches. Its declaration lacks
`GAME_SUPPORTS_SAVE`, so the known M35 quick-save failure applies and should be
recorded rather than fixed by this package.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 11
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 25 harmless unexpected
entries.

The required real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-gottlieb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-gottlieb.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped by design. Every runnable case
stopped at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium
page creation. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; geometry, refresh and controlled cadences were not observed.
  The `GAME_IMPERFECT_SOUND` flag is MAME's upstream note, not a port defect;
  missing optional samples must remain distinguished from the sound core.
- F6 is pending; there is no measured desktop ratio, so the family cannot yet
  be classified against the desktop gate.
- The known save-less quick-state behavior could not reach its expected M35
  failure because the server bind failed first.

The integrator should rerun the command above on a host that permits Chromium
and loopback, then copy only privacy-safe measurements into the family probe.
If startup reports fixed-heap exhaustion, apply the 8,192-page fallback before
repeating the measurements.

## Verification

Commands and results, in execution order:

```sh
npm test -- --match 'MAME 0.161 driver-family target pairs'

npm test

/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts gottlieb --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28i-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts gottlieb --jobs 4

node "$PWD/res/emsdk/emscripten/1.38.31/src/compiler.js" \
  "$PWD/.cache/w28i-compiler-settings.txt" \
  "$PWD/res/emsdk/emscripten/1.38.31/src/library_pthread_stub.js" \
  >/dev/null

npm run probe:mame:threading -- \
  "$PWD/dist/mame/gottlieb/mamegottlieb"

stat -c '%n %s' dist/mame/gottlieb/mamegottlieb.wasm \
  dist/mame/gottlieb/mamegottlieb.js \
  dist/mame/gottlieb/build.json
gzip -9 -c dist/mame/gottlieb/mamegottlieb.wasm | wc -c
gzip -9 -c dist/mame/gottlieb/mamegottlieb.js | wc -c

node --import tsx .cache/w28i-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-gottlieb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-gottlieb.json" \
  npm run test:browser

npm run check
npm test
npm run check && npm test
```

- The unsupported `--match` attempt printed the test runner's usage and exited
  1; the runner accepts suite names only. The immediate plain spec run passed:
  30 files, 556 cases; 556 passed, 0 failed, 0 skipped.
- First production build: compiled the family, then failed at the final link
  after 138.74 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- First host-Node compatibility build: reached `compiler.js`, then stopped
  silently after 27.96 seconds. A wrapper-assisted rerun took 39.28 seconds
  while regenerating shared SDK cache entries; direct compiler replay then
  identified only the PR-8210's MCS-48 symbols.
- Corrected compatibility build: passed in 24.41 seconds with 25 machines and
  25 metadata files.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 133,120-byte largest ROM sum; the conservative
  266,240-byte estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 11 expected
  files valid and no sample archive supplied.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so F4–F6 remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 556 cases; 556 passed, 0 failed, 0 skipped. The real
  new output was present and passed `tests/spec/32-build-output.test.ts`.
- Final combined `npm run check && npm test` from the committed package state:
  passed with the same 556/556 spec result.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`gottlieb` family after the host F6 decision, naming `gottlieb.c`, its
driver/audio/video units, the 8088 and M6502 board paths, samples/DAC/AY8910/
SP0250/Votrax sound paths, RIOT/MIOT devices and the PR-8210's MCS-48
controller. This package did not edit the spec because it is outside W28i's
write set.

## Integrator notes

Gate run on the host with the ignored preload (2026-10-24, quiet host):
32 passed, 0 failed, 25 skipped by design. F4 315 ms; F5 240×256 vertical at 61.419 Hz, cadences within 1 %; F6 1.0000 over
60 s; audio queue peak 72 ms; coin and start reached play; two pads
assigned and released. Measurements copied into the probe record.
