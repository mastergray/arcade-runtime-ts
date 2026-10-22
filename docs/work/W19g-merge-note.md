# W19g merge note — `taito-f3`

Status: blocked on the production metadata step and required browser evidence.
The target compiles and links, `-listfull` exposes all 90 derived machines,
the 4,096-page artifact passes the threading gate, and F1–F3 size/budget
evidence is recorded. The unmodified MAME 0.161 all-machines `-listxml` path
exhausts the 32-bit Wasm heap because every retained Taito Ensoniq device
configuration embeds a 64 MiB array. The managed sandbox also cannot bind
loopback or start Chromium, so F4–F6 and non-blank first-frame confirmation
remain pending without a browser attempt.

## Deliverables

- `mame/targets/taito-f3.lua`: the pinned Taito F3 driver, video and Ensoniq
  sound units with their CPU, sound, machine and non-empty bus selections.
- `mame/targets/taito-f3.lst`: 90 public machines derived from the named MAME
  0.161 driver source.
- `mame/builds/taito-f3.json`: 4,096-page production build input.
- `docs/probes/families/taito-f3.md`: F1–F6 record, with F1–F3 measured and
  F4–F6 marked `pending integrator browser run`.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file was changed. No ROM content, private
machine identity, ROM filename, hash or absolute local path was added. A
pipeline change is required from the integrator before this family can emit
its complete production artifact.

## Partial production artifact

The prescribed build command first encountered the documented bundled-Node
incompatibility:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4
```

It stopped after 10.019 seconds with `ERR_UNKNOWN_STREAM_TYPE`. The approved,
ignored host-Node compatibility environment then compiled and linked the
family, completed `-listfull`, wrote the build manifest and notices, and
stopped at bulk `-listxml` after 149.388 seconds:

```sh
BASH_ENV="$PWD/.cache/w19g-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4
```

A final 4,096-page `--skip-romsets` diagnostic completed in 29.278 seconds so
the linked artifact and explicit threading gate could be verified. It is not
a substitute for the required production command, and the absent `romsets/`
directory is the package blocker.

```text
dist/mame/taito-f3/
├── build.json                       2,962 bytes
├── mametaito-f3.js                301,913 bytes
├── mametaito-f3.wasm            5,761,748 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           absent (required: 90 files)
```

- Machine count: 90
- Wasm bytes: 5,761,748
- buildId: `34ad8cdd3acc35cff52601d171ec46c3d1f5ea4978dbbcf1d0092f60b683c68c`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,533,523 gzip-9 bytes and 1,155,470 Brotli-11
bytes. F3 found a largest public ROM sum of 41,943,040 bytes. Its conservative
83,886,080-byte adapter estimate is 41.67% of the 201,326,592-byte safe
budget, so no machine requires more than 4,096 pages.

## Target findings

The independently derived list and production `-listfull` count both equal
90, so no list correction was needed. The first complete link reported no
missing compilation unit or selected core. The pinned source requires M680X0
for the 68EC020 main CPU and M68000 sound CPU, ES5510 and ES5505 Ensoniq
support, the bootleg driver's OKIM6295, and EEPROM, MC68681 and MB87078
machine devices. The target also carries the harmless Centronics core needed
to keep the release-era bus archive non-empty.

## Production metadata blocker

MAME 0.161's `src/mame/audio/taito_en.h` declares
`UINT32 m_es5510_dram[1 << 24]` directly in `taito_en_device`, making every F3
machine configuration roughly 64 MiB before ordinary configuration data. The
release's all-machine `-listxml` path retains each configuration. With a
diagnostic 8,192-page artifact, it reached only the seventh public machine;
the dynamic heap was already 479,731,712 bytes when allocation aborted. A
single-machine `-listxml` completes at a 143,618,048-byte dynamic high-water
mark, confirming that the failure is aggregate enumeration rather than one
invalid driver.

The 90-machine target therefore cannot finish `extract-romsets.ts` within a
32-bit Wasm address space. The likely repair is an integrator-owned pipeline
change that runs metadata extraction in bounded per-machine batches (or a
separately reviewed upstream-source patch that makes the unused ES5510 DRAM
storage lazy). W19g authorizes neither change, so no file under `scripts/`,
`mame/patches/`, `mame/bridge/` or `src/` was edited.

## Integrator browser follow-up

No browser attempt was made in this managed sandbox, per the package's known
environment restriction. The supplied lawful config therefore has not
produced an observable frame here; first-frame arrival, non-blank output,
F4 startup time, F5 geometry/cadence measurements and F6 sustained-speed
ratios remain pending.

After repairing the metadata pipeline, run on a host that permits Chromium
and loopback without inspecting or recording the private config contents:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-taito-f3.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-f3.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family record: F4 first-frame
and first-non-blank-frame milliseconds; F5 native upright geometry and refresh
error at 60/90/120/144 Hz (at most 0.5%); and F6 exact 60-second desktop and
informational 4×-throttled ratios.

## Verification

Commands and outcomes from this worktree:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

BASH_ENV="$PWD/.cache/w19g-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

BASH_ENV="$PWD/.cache/w19g-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4 --skip-romsets

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-f3/mametaito-f3"

npm run check
npm test
```

- Prescribed production command: environment-blocked after 10.019 seconds by
  bundled Node 8 `ERR_UNKNOWN_STREAM_TYPE` before family compilation.
- Compatibility-environment production command: compiled and linked, exposed
  all 90 machines, passed its built-in threading check and then aborted during
  all-machines `-listxml` after 149.388 seconds; zero of the required 90
  ROM-set metadata files were emitted.
- Temporary uncommitted 8,192-page diagnostic: `-listxml` still aborted after
  30.702 seconds, proving that the metadata issue cannot justify or be fixed by
  changing the runtime family budget. The build input was restored to 4,096.
- Final 4,096-page `--skip-romsets` diagnostic: passed in 29.278 seconds; 90
  machines, 0 ROM sets, 5,761,748-byte Wasm, build `34ad8cdd3acc…`. This is
  retained only as compile/link/threading evidence, not a complete artifact.
- Explicit threading inspection: passed; one fixed 4,096-page non-shared
  memory, zero worker/runtime markers and no pthread requirement.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: `TALLY files=30 cases=511 passed=506 failed=3 skipped=2`.
  Two failures are sandbox infrastructure (`spawnSync … EPERM` in the audit
  bin case and loopback `listen EPERM` in the preload-server case). The third
  is the expected substantive release-output failure for `taito-f3`, because
  its blocked production build has no `romsets/` directory.
- Browser suite: not run by instruction; F4–F6 and non-blank first-frame
  confirmation remain pending the exact integrator command above.
