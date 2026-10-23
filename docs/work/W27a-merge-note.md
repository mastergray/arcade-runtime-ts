# W27a merge note — `sega-s16`

Status: production deliverables complete; F4–F6 pending the integrator's
browser run. The family build, metadata extraction, threading gate, type
checks and full spec suite pass. The ignored System 18 preload audits cleanly,
but this sandbox denies the loopback bind required by every browser case.

## Deliverables

- `mame/targets/sega-s16.lua`: the three pinned driver/video groups, common
  Sega IC, road and sprite units, I/O device, startup-decryption units, MCU
  cores, 315-5313 VDP lineage and required sound cores.
- `mame/targets/sega-s16.lst`: 139 public machines derived from the three
  named MAME 0.161 driver sources.
- `mame/builds/sega-s16.json`: 4,096-page production build input.
- `docs/probes/families/sega-s16.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable browser capability.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's files were changed. No integrator-owned line is
needed. No ROM content, private selection, ROM hash or private archive path was
added.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the link in approximately 94.5 seconds, then met the pinned Node 8 JavaScript
compiler's captured-stdio incompatibility:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s16 --jobs 6
```

It stopped with `ERR_UNKNOWN_STREAM_TYPE`. An ignored process-local
`BASH_ENV` then selected host Node 22 for `compiler.js` only; the MAME source,
Emscripten compiler and optimizer, flags and build pipeline remained pinned.
That rerun exposed the target dependency described below. After the target
correction, the same production pipeline passed from the reused source and
object cache in approximately 30.8 seconds:

```sh
BASH_ENV="$PWD/.cache/w27a-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s16 --jobs 6
```

```text
dist/mame/sega-s16/
├── build.json                       3,651 bytes
├── mamesega-s16.js                302,193 bytes
├── mamesega-s16.wasm            6,456,140 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          139 files, 1,580,419 aggregate bytes
```

- `.lst` and `-listfull` machine count: 139
- Wasm bytes: 6,456,140
- buildId: `37f3348521b1510a2a7610dd6ad81d8ec896da3461599517278fcd5f21c083ca`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,694,853 gzip-9 bytes and 1,269,541 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 15,474,688 bytes. Its
conservative 30,949,376-byte adapter estimate is 15.37% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Target findings and correction

The independently derived list contains 31 machines from `segas16a.c`, 81
from `segas16b.c` and 27 from `segas18.c`; it matched production `-listfull`,
so no list correction was needed.

The selected sources require Z80, MCS-48, MCS-51 and 68000 CPU cores; DAC,
YM2151, YM2413, YM2612/YM3438, uPD7759, RF5C68 and SN76496 sound cores; I8243
and I8255 machine cores; both generations of the Sega VDP implementation; the
three driver/video pairs; common Sega IC, road and sprite units; and FD1089,
FD1094, MC-8123 and adjacent Sega decryption units. The target also carries
the harmless Centronics core required to keep the release-era bus archive
non-empty.

The first host-Node link reported that the 315-5313 VDP derives from and calls
the 315-5124 implementation. The broad upstream vendor block selects both;
the isolated family initially selected only the newer device named in the
brief. Adding the inherited core resolved every undefined symbol. No source
unit was dropped or added after that link.

## Browser evidence blocker

The ignored preload config was present, selects the required System 18 board,
and was audited locally without logging its identity. Both strict and
MAME-compatible audit policies returned `ok`: 18 expected files, zero
missing, wrong-size, wrong-CRC or optional-missing entries, and zero warnings
or archive problems.

The real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s16.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped. Every runnable case stopped
at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium page
creation. Consequently:

- a first frame did not arrive in this environment;
- non-blank output is not yet confirmed;
- F4 startup time, F5 geometry/cadences and F6 sustained desktop and 4× proxy
  ratios are pending.

The integrator should rerun the command above on a host that permits Chromium
and loopback, then copy only privacy-safe measurements into the family record.
Do not record the configured machine, archive names, hashes or resolved paths.

## Verification

Commands and results, in execution order:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s16 --jobs 6

BASH_ENV="$PWD/.cache/w27a-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-s16 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-s16/mamesega-s16"

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-s16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-s16.json" \
  npm run test:browser

npm run check
npm test
```

- First production build: compiled the family, then failed at the final link
  with the pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE` incompatibility.
- First host-Node production rerun: failed at the link with the inherited VDP
  core's undefined symbols, which identified the one target correction.
- Final host-Node production rerun: passed; 139 machines and 139 ROM-set
  metadata files, with the artifact identity recorded above.
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, no runtime markers, worker or pthread requirement.
- Browser suite: environment failure as recorded above; F4–F6 pending.
- `npm run check`: passed.
- `npm test`: 550 passed, 0 failed, 0 skipped. The real new build output was
  present and passed the release-output inspection.

Raw and compressed artifact sizes were collected with `stat`, `gzip -9 -c`
and Node.js `brotliCompressSync` at quality 11. A privacy-safe inline Node
audit loaded the ignored config through `loadPreloadConfig` and called
`RomSetAudit.audit` under both supported policies; its result is recorded in
the browser-blocker section.

## Sandbox git note

The initial target-input commit succeeded. The first attempt to commit the
VDP correction was refused because Git could not create the external
worktree's `index.lock` and reported the shared Git directory read-only. Work
continued as instructed; the same commit command succeeded on retry, and no
repository data was lost.
