# W27b merge note — `midway-tunit`

Status: blocked on required browser evidence. The production family build,
metadata extraction, threading gate, type checks and full spec suite pass, and
the ignored DCS-board preload audits cleanly. This sandbox denies the loopback
bind required by every browser case, so F4–F6 and the non-blank first-frame
confirmation remain pending for the integrator after merge.

## Deliverables

- `mame/targets/midway-tunit.lua`: the pinned `midtunit.c` and `midyunit.c`
  driver/machine/video groups, Williams and DCS audio units, and required CPU,
  sound, machine and bus cores.
- `mame/targets/midway-tunit.lst`: 66 public machines derived from the two
  named MAME 0.161 driver sources.
- `mame/builds/midway-tunit.json`: 4,096-page production build input.
- `docs/probes/families/midway-tunit.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable host browser capability.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's files were changed. No integrator-owned line is
needed. No ROM content, private selection, archive identity, ROM hash or
resolved private path was added.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 102.60 seconds:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 6
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27a, an
ignored process-local `BASH_ENV` selected host Node 22 for Emscripten's
JavaScript compiler helpers only; the pinned C/C++ compiler, optimizer,
Binaryen, source, flags and pipeline remained unchanged. The successful
cached-source production pipeline completed in 33.61 seconds:

```sh
BASH_ENV="$PWD/.cache/w27b-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 6
```

```text
dist/mame/midway-tunit/
├── build.json                       2,523 bytes
├── mamemidway-tunit.js            301,920 bytes
├── mamemidway-tunit.wasm        5,676,009 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           66 files, 695,092 aggregate bytes
```

- `.lst` and `-listfull` machine count: 66
- Wasm bytes: 5,676,009
- buildId: `7064c4a67ab369540a5d1a2162454da5b7c568734d2f7c145f8f7d84b239bbec`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,534,364 gzip-9 bytes and 1,150,906 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 16,777,216 bytes. Its
conservative 33,554,432-byte adapter estimate is 16.67% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Optional Y-Unit decision and target findings

`midyunit.c` stays in the family. The independent derivation contains 22
machines from `midtunit.c` and 44 from `midyunit.c`, for 66 total. The combined
target linked without a source or core correction, and its 5,676,009-byte raw,
1,150,906-byte Brotli artifact is below the earlier single-family baseline
range. The list count, link and download size are therefore within budget;
deferring the adjacent driver would provide no demonstrated benefit.

The source closure requires TMS34010, ADSP-2105, M6809 and Z80 CPU cores; DAC,
DMA DAC, YM2151, HC55516 and OKIM6295 sound cores; 6821 PIA; the two complete
driver/machine/video groups; `audio/williams.c`; and the shared
`audio/dcs.c`. The target also carries the harmless Centronics core required
to keep the release-era bus archive non-empty. The independently derived list
matched production `-listfull`, so no list correction was needed.

## Browser evidence blocker

The ignored preload config was present, selects the required DCS board, and
was audited locally without logging its identity. Both strict and
MAME-compatible policies returned `ok`: one archive present, 20 expected
files, and zero missing, wrong-size, wrong-CRC, optional-missing, warning or
archive-problem entries.

The real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped. Every runnable case stopped
at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium page
creation. Consequently:

- a first frame did not arrive in this environment;
- non-blank output is not yet confirmed;
- F4 startup time, F5 geometry/cadences and F6 sustained desktop and 4× proxy
  ratios are pending;
- the family's required DCS-board F6 gate remains open.

The integrator should rerun the command above on a host that permits Chromium
and loopback, then copy only privacy-safe measurements into the family record.
Do not record the configured machine, archive names, hashes or resolved paths.

## Verification

Commands and results, in execution order:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 6

BASH_ENV="$PWD/.cache/w27b-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-tunit/mamemidway-tunit"

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser

npm run check
npm test
```

- First production build: compiled the family, then failed at the final link
  with the pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE` incompatibility.
- Two cached compatibility-shim refinements exposed the same captured-stream
  failure in the JavaScript-engine sanity and Acorn optimizer helpers; the
  final ignored wrapper directs Emscripten `.js` helpers to host Node and the
  next production run passed in 33.61 seconds with 66 machines and 66 metadata
  files.
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, no runtime markers, worker or pthread requirement.
- Privacy-safe preload audit: strict and MAME-compatible policies passed with
  the aggregate counts recorded above.
- Browser suite: environment failure as recorded above; F4–F6 pending.
- `npm run check`: passed.
- `npm test`: 551 passed, 0 failed, 0 skipped. The real new build output was
  present and passed `tests/spec/32-build-output.test.ts`.

Raw and compressed artifact sizes were collected with `stat`, `gzip -9 -c`
and Node.js `brotliCompressSync` at quality 11. The private audit was a
read-only inline Node invocation of `loadPreloadConfig` and
`RomSetAudit.audit`; it emitted only aggregate status counts.

## Integrator notes

Gate run on the host with the ignored DCS-board preload (2026-10-23): 32
passed, 0 failed, 25 skipped by design. F4 719 ms (host also serving a
hand-test session); F5 400×254 at 54.707 Hz, every frame valid and the first
non-blank, cadences within 0.37 % at 60/90/120/144 Hz; F6 1.0001 over 60 s;
audio queue peak 58.7 ms; coin and start reached play; two pads assigned and
released. Measurements copied into the probe record. The Y-Unit decision
(kept in the family) stands.
