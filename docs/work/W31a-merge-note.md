# W31a merge note — `nintendo-vs`

Status: production build complete; F1–F3 measured; F4–F6 pending because
this sandbox cannot launch Chromium or bind the loopback browser-test server.
The target pair, metadata extraction, private preload audit, threading gate,
type checks and full spec suite pass. The integrator must run the desktop
startup, display, input and performance gates after merge.

## Deliverables

- `mame/targets/nintendo-vs.lua`: the pinned driver, machine and two video
  units; M6502 and Z80 CPU cores; NES APU, SN76496 and DAC sound; RP5H01
  machine support and the harmless non-empty bus selection.
- `mame/targets/nintendo-vs.lst`: all 54 public machines derived from
  `drivers/vsnes.c`, including its dual-screen configurations.
- `mame/builds/nintendo-vs.json`: 4,096-page production build input.
- `docs/probes/families/nintendo-vs.md`: F1–F6 record, including measured
  F1–F3, the first-screen behavior for dual-screen configurations, input/save
  expectations, and explicit F4–F6 handoff steps.
- `tests/spec/04-mame-family-targets.test.ts`: one self-contained
  `FAMILY_TARGETS` row.
- `dist/mame/nintendo-vs/`: ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No private machine identity,
archive identity, ROM hash or resolved private path was added to a tracked
file.

## Production artifact

The prescribed first build unpacked/reused only this worktree's production
tree, compiled the complete family and finished in 189.91 seconds:

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-vs --jobs 4
```

```text
dist/mame/nintendo-vs/
├── build.json                       2,380 bytes
├── mamenintendo-vs.js             302,238 bytes
├── mamenintendo-vs.wasm         5,341,703 bytes
├── notices/                          14 files, 562,168 aggregate bytes
└── romsets/                          54 files, 273,856 aggregate bytes
```

- `.lst` and `-listfull` machine count: 54
- Wasm bytes: 5,341,703 (new family; no before-build artifact)
- buildId: `fe6c2b6ad1395bcb2ba6a33f6af798068680af182c43c2f354b58efbb8d51fe9`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,341,703 | 1,449,255 | 1,086,734 |
| JavaScript | 302,238 | 65,580 | 55,341 |

F3 found a largest public metadata ROM sum of 262,336 bytes. Its conservative
two-copy estimate is 524,672 bytes, 0.26% of the 201,326,592-byte safe budget,
leaving 200,801,920 bytes. Every family machine therefore remains within
4,096 pages. The PPU reads packed pattern data directly; its inactive
`gfx_layout` does not create the large decoded-graphics allocation that made
8,192 pages necessary for another family.

## Target findings

The independent derivation found 54 public entries in `vsnes.c`, exactly
matching production `-listfull`, so no list correction was needed. The four
requested compilation units and the cores stated in the package brief linked
on the first attempt.

The dual-system configurations remain in the family list. They define two
2A03 CPUs, PPUs and screens, but the production bridge selects and delivers
the first screen only. The ignored preload selects a single-screen
configuration for F4–F6, as required.

The driver defines per-game DIP banks and reversed player mappings for boards
that alternate two players on one physical panel. The selected metadata has
five DIP switches. Source inspection predicts `inputs.keys: []`,
`inputs.volume: false` and `supportsSave: false` for the ignored selection;
the host browser run must confirm those runtime values. The driver-wide coded
fields either use keys outside W29's supported operator vocabulary or belong
to DIP fields, which the bridge intentionally excludes from `inputs.keys`.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one required archive present,
all seven expected files valid, zero warnings or archive problems, and six
harmless unexpected entries. The generated metadata names no sample archive.

Chromium and loopback binding are unavailable in this sandbox, so the browser
suite was not falsely attempted and no browser measurement is claimed:

- F4 is pending: time from `adapter.start()` to the first valid, non-blank
  frame.
- F5 is pending: stable single-screen geometry, orientation, refresh, four
  controlled cadences, and runtime input/save fields.
- F6 is pending: 60-second desktop emulated-time ratio with frameskip disabled,
  plus coin, start and alternating-player input checks.

The integrator should run the family browser gate with the supplied ignored
W31a preload on a host that permits Chromium and loopback, then copy only
privacy-safe measurements into the family probe. There is no F6 ratio yet,
because sandbox capability—not an observed performance miss—blocked the run.

## Verification

Commands and results, in execution order:

```sh
npm test

time BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts nintendo-vs --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/nintendo-vs/mamenintendo-vs"

stat -c '%n %s' dist/mame/nintendo-vs/mamenintendo-vs.wasm \
  dist/mame/nintendo-vs/mamenintendo-vs.js \
  dist/mame/nintendo-vs/build.json

gzip -9 -c dist/mame/nintendo-vs/mamenintendo-vs.wasm | wc -c
gzip -9 -c dist/mame/nintendo-vs/mamenintendo-vs.js | wc -c

node .cache/w31a-measure.mjs
node --import tsx .cache/w31a-audit.ts

npm run check
npm test
```

- Initial spec run: 30 files, 577 cases; 577 passed, 0 failed, 0 skipped.
- Production build: passed in 189.91 seconds with 54 machines and 54 metadata
  files; no target correction was required.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker, runtime marker or pthread requirement.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11 through the ignored measurement helper;
  values are recorded above.
- F3 metadata reduction: 262,336-byte largest ROM sum; the two-copy estimate
  fits the safe budget, and source inspection found no large decoded-graphics
  allocation.
- Privacy-safe preload audit: both policies returned `ok` with all seven
  expected files valid. The ignored helper discovered the config by its family
  field and emitted counts only, so neither its filename nor selection entered
  tracked output.
- `npm run check`: passed (`check:src` and `check:tests`).
- Post-build `npm test`: 30 files, 577 cases; 577 passed, 0 failed, 0 skipped.
  The real new output was present and passed production-output validation.

One intermediate `git add/commit` attempt was refused when Git could not
create its index lock on a temporarily read-only filesystem. An immediate
retry succeeded; no work was lost and all package commits were created.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add this family
after the host F6 decision, naming the four compilation units, M6502/2A03 and
Z80 CPU paths, NES APU/SN76496/DAC sound paths, the RP5H01 machine core, the
54-machine count, dual-screen first-display limitation, DIP-heavy alternating
controls and save-support result. This package did not edit the spec because
it is outside W31a's write set.

## Undone

Only F4–F6 and the integrator-owned §4.6 amendment remain. No implementation,
target correction, memory-page change or package-owned test work is undone.
