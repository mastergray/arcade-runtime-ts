# W19d merge note — `atari-classic`

Status: native package ready; F4–F6 and the required vector non-blank-frame
confirmation are pending the integrator browser run. The production family
build, metadata extraction, threading gate, typecheck and 510-case spec suite
pass. The lawful ignored preload config is present, but this sandbox cannot
bind loopback or start Chromium, so the browser suite was not attempted as
directed for this package.

## Deliverables

- `mame/targets/atari-classic.lua`: the three pinned driver groups, adjacent
  `audio/bzone.c` and `video/rampart.c` units, and the shared Atari vector,
  EAROM, mathbox, `audio/redbaron.c`, Atari-gen, motion-object and slapstic units.
- `mame/targets/atari-classic.lst`: 15 public machines derived from the three
  named MAME 0.161 driver sources.
- `mame/builds/atari-classic.json`: 4,096-page production build input.
- `docs/probes/families/atari-classic.md`: complete F1–F6 record, with F1–F3
  measured and F4–F6 marked `pending integrator browser run`.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file was changed. No integrator-owned line is
needed. No ROM content, private machine identity, ROM filename, ROM hash or
absolute local path was added.

## Production artifact

The corrected production pipeline completed with the package-approved,
ignored host-Node compatibility environment:

```sh
BASH_ENV="$PWD/.cache/w19d-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-classic --jobs 4
```

```text
dist/mame/atari-classic/
├── build.json                       1,761 bytes
├── mameatari-classic.js           302,084 bytes
├── mameatari-classic.wasm       6,022,964 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           15 files, 126,405 aggregate bytes
```

- First full compile/link attempt: 223.73 seconds
- Final corrected reused-source build: 49.12 seconds
- Machine count: 15
- Wasm bytes: 6,022,964
- buildId: `f178804840c9a34ca74957c3e81d805d1356941e1858c3793c77bf637943f27a`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,556,676 gzip-9 bytes and 1,169,229 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 1,707,786 bytes. Its
conservative 3,415,572-byte adapter estimate is 1.70% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list and production `-listfull` count both equal
15, so no list correction was needed. The pinned `mame.lua` Atari and shared
blocks supplied the named drivers and support units. Both vector drivers
instantiate the EAROM device defined by `machine/atari_vg.c`, so source
inspection included that shared unit before the build.

The first modularized link exposed two machine-device cores referenced by the
compiled Atari support units: parallel EEPROM support and ER2055. Adding
`MACHINES["EEPROMDEV"]` and `MACHINES["ER2055"]` resolved all undefined
symbols. The corrected pipeline completed without another target or list
change. This is a target-level dependency finding, not a pipeline or spec
contract defect.

The host has the known independent toolchain-launch caveat. The prescribed
command initially stopped after 9.96 seconds because the emsdk-bundled Node 8
could not classify the command runner's captured stdio
(`ERR_UNKNOWN_STREAM_TYPE`). The ignored `BASH_ENV` file selected host Node
22 only as Emscripten's JavaScript engine. The pinned Emscripten compiler,
LLVM, MAME source and all link flags remained unchanged, and nothing from the
compatibility environment is committed.

## Integrator browser follow-up

No browser attempt was made in this managed sandbox, per the package's known
environment restriction. The configured title therefore has not produced an
observable first frame here; non-blank vector output, F4 startup time, F5
geometry/cadence measurements and F6 sustained-speed ratios remain pending.

On a host that permits Chromium and loopback, run without inspecting or
recording the private config's contents:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family record. Confirm through
the real adapter that a vector title's first delivered frame is not blank;
if it is blank, record the failure and stop without changing the bridge. Then
record native upright geometry and refresh error at 60/90/120/144 Hz (at most
0.5%), plus exact 60-second desktop and informational 4×-throttled ratios.

## Verification

Commands and outcomes from this worktree:

```sh
/usr/bin/time -f 'WALL_SECONDS=%e' bash -c \
  'EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts atari-classic --jobs 4'

/usr/bin/time -f 'WALL_SECONDS=%e' bash -c \
  'BASH_ENV="$PWD/.cache/w19d-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts atari-classic --jobs 4'

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-classic/mameatari-classic"

npm run check
npm test
```

- Prescribed production command: environment-blocked after 9.96 seconds by
  the bundled Node 8 `ERR_UNKNOWN_STREAM_TYPE` before family compilation.
- First compatibility-environment build: completed the full compile in
  223.73 seconds, then exposed the two missing device cores at link.
- Final corrected compatibility-environment build: passed in 49.12 seconds;
  15 machines, 15 ROM-set metadata files and a 6,022,964-byte Wasm.
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, zero worker/runtime markers and no pthread requirement.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: `TALLY files=30 cases=510 passed=510 failed=0 skipped=0`.
- Browser suite: not run by instruction; F4–F6 and vector non-blank-frame
  confirmation remain pending the exact integrator command above.
