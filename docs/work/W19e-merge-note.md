# W19e merge note — `misc-16`

Status: blocked on required browser evidence. The production family build,
metadata extraction and threading checks pass, but this sandbox permits neither
the browser test server nor Chromium's host socket setup. F4–F6 and the required
non-blank first-frame confirmation therefore remain pending even though a
lawful ignored preload config is present.

## Deliverables

- `mame/targets/misc-16.lua`: the eight pinned driver groups, their adjacent
  machine/video/audio units, shared Data East and Seibu devices, both Kaneko
  renderers, and the CPU, DSP, sound and palette cores required by the link.
- `mame/targets/misc-16.lst`: 111 public machines derived from the eight named
  MAME 0.161 driver sources.
- `mame/builds/misc-16.json`: 4,096-page production build input.
- `docs/probes/families/misc-16.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable integrator browser run.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's files were changed. No integrator-owned line is
needed. No ROM content, private ROM identity, ROM hash or absolute local path
was added.

## Production artifact

The first source-unpack build reached the link after 259.764 seconds. The
sandbox's captured child-process stdio is incompatible with the SDK's bundled
Node 8, so an ignored process-local `BASH_ENV` selected host Node 22 for
Emscripten's JavaScript compiler only. The pinned compiler, optimizer, source,
flags and pipeline were unchanged.

The first full link then exposed target-level dependencies described below.
After those corrections, the same pipeline completed from the reused source
and object cache in 51.145 seconds:

```sh
time BASH_ENV="$PWD/.cache/w19e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4
```

```text
dist/mame/misc-16/
├── build.json                       3,304 bytes
├── mamemisc-16.js                 302,943 bytes
├── mamemisc-16.wasm             7,409,427 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          111 files, 990,040 aggregate bytes
```

- Source-unpack compile to first link: 259.764 seconds
- Successful corrected cached-source pipeline: 51.145 seconds
- Machine count: 111
- Wasm bytes: 7,409,427
- buildId: `1a8b17e1745fbf40ac2f9139b2c7f144fb4853cf57e1dfa68dbf556a08352a7e`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,809,382 gzip-9 bytes and 1,345,501 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 18,219,136 bytes. Its
conservative 36,438,272-byte adapter estimate is 18.10% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list matched the production `-listfull` count, so no
list correction was needed. The selected drivers collectively require Z80,
M6502, H6280, NEC V30/V33, MCS51, M6809/HD6309, M68000, TMS32010 and TMS34020
CPU/DSP cores; YM2151, YM2203, YM3526, YM3812, MSM5205, OKIM6295 and BSMT2000
sound cores; buffered sprite RAM and TLC34076 video cores; bank and EEPROM
devices; and the harmless Centronics core that keeps the release-era bus
archive non-empty.

The first full link found five cross-block compilation-unit dependencies:

- `video/decbac06.c`, `video/decmxc06.c` and `video/deckarn.c` implement the
  shared Data East devices configured by `dec0.c` and `karnov.c`;
- `machine/seibuspi.c` supplies the carry helper used by `raiden2.c` decryption;
- `video/kan_panb.c` supplies the `snowbros.c`-derived renderers not implemented
  by `video/kan_pand.c`.

The same link proved that `btoads.c`'s BSMT2000 device needs the TMS32010 core
and that its video unit needs TLC34076. Adding those target-level dependencies
resolved every undefined symbol. `btoads.c` did not need to be dropped, and
the corrected production pipeline completed without further target changes.

## Browser evidence blocker

Per the known sandbox restriction for W19, the browser suite was not attempted:
loopback binding and Chromium startup are unavailable. Consequently:

- a first frame did not arrive in this environment;
- non-blank output is not yet confirmed;
- F4 startup time, F5 geometry/cadences and F6 sustained ratio are pending.

The integrator should run on a host that permits Chromium and loopback:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser
```

Then copy only the privacy-safe measurements into the family record. Do not
record the configured machine, ROM file names, hashes or resolved paths.

## Verification

```sh
time BASH_ENV="$PWD/.cache/w19e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4
npm run probe:mame:threading -- "$PWD/dist/mame/misc-16/mamemisc-16"
npm run check
npm test
```

- Production family build with the ignored host-Node compatibility
  environment: passed; 111 machines and 111 ROM-set metadata files
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, no runtime markers, worker or pthread requirement
- Browser suite: not run, as required for this sandbox; F4–F6 and non-blank
  first-frame confirmation are pending the integrator command above
- `npm run check`: passed
- `npm test`: 510 passed, 0 failed, 0 skipped

## Sandbox git note

The initial target commit succeeded. A later `git add` was refused when Git
could not create the worktree `index.lock` on the externally stored shared Git
directory because the sandbox reported it read-only. Work continued as
instructed; the final commit was retried after all tracked deliverables were
complete.
