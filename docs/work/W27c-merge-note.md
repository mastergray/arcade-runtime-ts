# W27c merge note — Atari 68010 four-player family

Status: production build complete; F4–F6 pending because the lawful ignored
preload is incomplete for MAME 0.161. The target pair, metadata extraction,
threading gate, type checks and full spec suite pass. A privacy-safe audit
found one missing required file, so W27's incomplete-set rule stopped the
browser work without searching for replacement files.

## Deliverables

- `mame/targets/atari-gauntlet.lua`: the pinned driver/video pair, Atari-gen,
  motion-object and slapstic units, with the board's own 6502/YM2151/POKEY/
  TMS5220 sound path and no JSA audio unit.
- `mame/targets/atari-gauntlet.lst`: 28 public machines derived from
  `drivers/gauntlet.c`.
- `mame/builds/atari-gauntlet.json`: 4,096-page production build input.
- `docs/probes/families/atari-gauntlet.md`: F1–F6 record, with F4–F6
  explicitly pending an incomplete private set.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's files were changed. No integrator-owned line is
needed. No ROM content, private selection, archive identity, ROM hash or
resolved private path was added.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 114.92 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 6
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following W27a and
W27b, an ignored worktree-local `BASH_ENV` selects host Node 22 for
Emscripten's JavaScript helpers only; the pinned C/C++ compiler, optimizer,
Binaryen, source, flags and pipeline remain unchanged. The successful
corrected cached-source production pipeline completed in 34.65 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27c-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 6
```

```text
dist/mame/atari-gauntlet/
├── build.json                       2,029 bytes
├── mameatari-gauntlet.js          302,199 bytes
├── mameatari-gauntlet.wasm      5,975,125 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           28 files, 199,248 aggregate bytes
```

- `.lst` and `-listfull` machine count: 28
- Wasm bytes: 5,975,125
- buildId: `0796f6b5ede8d69c922314586bec2b2625553cf5f256d9aa71c2962e37e8afb6`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,545,906 gzip-9 bytes and 1,159,827 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 1,213,696 bytes. Its
conservative 2,427,392-byte adapter estimate is 1.21% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list matched the production `-listfull` count, so
no list correction was needed. The source closure contains only
`drivers/gauntlet.c`, `video/gauntlet.c`, `machine/atarigen.c`,
`video/atarimo.c` and `machine/slapstic.c`. It selects M68000-family and M6502
CPU cores, the three sound cores configured by the board, and the parallel
EEPROM device. The existing four-pad bridge needs no change.

Once the compatibility environment made the link diagnostics visible, the
complete `machine/atarigen.c` object reported ER2055 and OKIM6295 undefined
symbols. Selecting those two shared cores, as the existing Atari target does,
resolved the first complete link. No extra audio compilation unit was added.

## Browser evidence blocker

The ignored preload config was present and audited locally without logging
its machine or file identities. Strict and MAME-compatible policies both
reported `incomplete`: one archive present, 20 expected files, 19 valid files,
one missing required file, no warnings and no archive problems.

Per W27, F4–F6 are recorded as "pending: set incomplete" with the missing-file
count. The browser suite was not started, because the real adapter cannot
reach a first frame from an incomplete set and the package explicitly forbids
hunting for files. Consequently startup time, non-blank frame confirmation,
geometry/cadence measurements and the sustained desktop ratio remain pending.

After merge, the integrator should supply a complete lawful 0.161-compatible
preload and run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-gauntlet.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-gauntlet.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family record. Do not record the
configured machine, archive names, hashes or resolved paths.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 6

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27c-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-gauntlet/mameatari-gauntlet"

npm run check
npm test
```

- First production build: compiled the family, then failed at the final link
  with the pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE` incompatibility.
- Compatibility diagnostic links: two direct host-Node runs confirmed the
  JavaScript helper invocation; an ignored wrapper exposed the ER2055 and
  OKIM6295 undefined symbols. The corrected target's next timed production
  run passed in 34.65 seconds with 28 machines and 28 metadata files.
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, no runtime markers, worker or pthread requirement.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- Privacy-safe preload audit: strict and MAME-compatible policies both found
  exactly one missing required file; F4–F6 remain pending under W27's rule.
- `npm run check`: passed.
- An early `npm test` checkpoint, before the artifact existed, reached 548
  passed, 2 failed and 2 skipped; the two failures were transient sandbox
  `EPERM` denials for a nested Node process and a loopback listener. The final
  unfiltered `npm test` rerun passed 552, failed 0 and skipped 0. The real new
  build output was present and passed `tests/spec/32-build-output.test.ts`.

The first attempt to commit the target correction and the first attempt to
commit this merge note were refused when the worktree Git index lock was
temporarily read-only. Later retries succeeded; all package commits are
present and no change was lost.
