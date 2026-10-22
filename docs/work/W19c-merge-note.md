# W19c merge note — `konami-16`

Status: blocked on F4–F6 browser evidence. The production family build,
metadata generation, threading gate, typecheck and 507-case spec suite pass.
The ignored lawful preload config was available and validated, but this
sandbox denied both localhost listening and Chromium's own startup sockets,
so the title could not reach an observable frame here.

## Deliverables

- `mame/targets/konami-16.lua`: six pinned driver groups, adjacent
  machine/video units, shared Konami video IC units and link-proven GX mixer
  dependencies.
- `mame/targets/konami-16.lst`: 98 public machines independently derived from
  the six named MAME 0.161 driver sources.
- `mame/builds/konami-16.json`: 4,096-page production build input.
- `docs/probes/families/konami-16.md`: F1–F6 record; F1–F3 complete and
  F4–F6 explicitly pending browser execution with the measured blocker.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file was changed. No integrator-owned line is
needed. No ROM content, private machine identity, ROM filename, hash or local
path was added.

## Production artifact

The corrected production build completed with:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts konami-16 --jobs 4
```

```text
dist/mame/konami-16/
├── build.json                       3,080 bytes
├── mamekonami-16.js               302,191 bytes
├── mamekonami-16.wasm           6,511,127 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                            98 files, 563,544 aggregate bytes
```

- Final corrected build wall time: 57.89 seconds on the reused source/object
  cache; the first source-unpack/compile invocation reached link in 129.09
  seconds before the legacy-Node host incompatibility described below
- Machine count: 98
- Wasm bytes: 6,511,127
- buildId: `04f873e154c60d13a083558a4e3f300ed603a437d4e86082f28975f529fe0d25`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,671,011 gzip-9 bytes and 1,248,272 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 21,233,792 bytes. Its
conservative 42,467,584-byte adapter estimate is 21.09% of the 201,326,592-byte
safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list and production `-listfull` count both equal
98, so no list correction was needed. Source inspection expanded §4.6's
hardware shorthand into the actual pinned release selections. Notably,
MAME 0.161's `M6809` selection compiles the plain M6809, HD6309 and KONAMI
variants together. The selected drivers also require YM3812, samples,
OKIM6295, BANKDEV and K053252 in addition to the sounds and devices named in
the W19 row.

The first genuine link found four `mystwarr.c`-class dependencies outside
the immediately adjacent units: Konami GX word handlers and mixer functions
from `machine/konamigx.c` and `video/konamigx.c`, plus the TMS57002 and
K056800 cores those helpers reference. Adding them resolved all undefined
symbols. This is a target-level dependency finding, not a pipeline or spec
contract change.

The host has a separate toolchain-launch caveat. The emsdk-bundled Node 8
cannot initialize stderr when Emscripten is launched under Node 22.22.2's
`spawnSync` capture and exits with `ERR_UNKNOWN_STREAM_TYPE`. The successful
production run temporarily selected the installed Node 22 executable in the
local emsdk config, protected by a shell restore trap. The config was restored;
no tracked toolchain or repository file changed, and Emscripten 1.38.31, LLVM,
the MAME source and all link flags stayed pinned.

## Browser blocker and integrator follow-up

The private preload named an available lawful set for this family, but no
browser measurement was possible. The normal suite could not bind its required
loopback servers (`listen EPERM`). A throwaway request-interception probe under
`/tmp` removed the server requirement, then Chromium itself was terminated
before page creation because the sandbox denied its sandbox-host/Crashpad
socket operation. Thus the first frame did not arrive in this environment,
non-blank output is unconfirmed, and F4–F6 remain pending rather than being
filled with inferred values.

Run the following outside the restricted sandbox without recording the
private config's contents:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-konami-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-konami-16.json" \
  npm run test:browser
```

Record F4 startup and first non-blank frame time; F5 upright native geometry
and refresh error at 60/90/120/144 Hz (at most 0.5%); and F6's exact 60-second
desktop and 4×-throttled ratios. The configured set can provide representative
evidence, but the strict F6 gate still needs a lawful `mystwarr.c`-class
set because the available config is not from that heaviest class.

## Verification

- `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts konami-16 --jobs 4`: passed after the local JavaScript-engine workaround; 98 machines, 98 ROM-set files, 6,511,127-byte Wasm, build `04f873e154c6…`
- `npm run probe:mame:threading -- "$PWD/dist/mame/konami-16/mamekonami-16"`: passed; one fixed 4,096-page non-shared memory, zero worker/runtime/pthread markers
- `ARCADE_PRELOAD_CONFIG="$PWD/res/preload-konami-16.json" ARCADE_FAMILY_CONFIGS="$PWD/res/preload-konami-16.json" npm run test:browser`: infrastructure-blocked; `TALLY files=31 cases=59 passed=0 failed=32 skipped=27`, with every attempted case failing before execution at `listen EPERM`
- `ARCADE_PRELOAD_CONFIG="$PWD/res/preload-konami-16.json" node --import tsx /tmp/w19c-browser-probe.mjs`: infrastructure-blocked before page creation; both Playwright Chromium variants exited on denied socket operations
- `npm run check`: passed (`check:src` and `check:tests`)
- `npm test`: `TALLY files=30 cases=507 passed=507 failed=0 skipped=0`
