# W31b merge note — `capcom-mitchell`

Status: production build complete; F4–F6 are pending because this sandbox
cannot run Chromium or bind the loopback browser-test server. The target pair,
metadata extraction, threading gate, type checks and full spec suite pass.
The integrator must collect the desktop startup, display and sustained-speed
measurements on a browser-capable host.

## Deliverables

- `mame/targets/capcom-mitchell.lua`: the pinned driver, video and Kabuki
  decoder source group; Z80 CPU; OKIM6295, YM2413, YM3812 and MSM5205 sound;
  and serial EEPROM support.
- `mame/targets/capcom-mitchell.lst`: 29 public machines derived from
  `drivers/mitchell.c`, including its mahjong and quiz configurations.
- `mame/builds/capcom-mitchell.json`: 4,096-page production build input.
- `docs/probes/families/capcom-mitchell.md`: F1–F3 measurements and explicit
  pending records for F4–F6, plus input and save-capability observations.
- `tests/spec/04-mame-family-targets.test.ts`: one self-contained
  `FAMILY_TARGETS` row.
- `dist/mame/capcom-mitchell/`: the ignored production output described
  below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed family-only build compiled the complete source closure and
finished in 181.46 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts capcom-mitchell --jobs 4
```

```text
dist/mame/capcom-mitchell/
├── build.json                              1,965 bytes
├── mamecapcom-mitchell.js                301,923 bytes
├── mamecapcom-mitchell.wasm            5,009,704 bytes
├── notices/                                  14 files, 562,168 aggregate bytes
└── romsets/                                  29 files, 114,869 aggregate bytes
```

- `.lst` and `-listfull` machine count: 29
- Wasm bytes: 5,009,704
- buildId: `36c741bddc5cd2b8a2df82910e49cbc5ea48656c7eb6853ba57428dafb2d7d63`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,009,704 | 1,412,148 | 1,067,101 |
| JavaScript | 301,923 | 65,594 | 55,369 |

This is a new family, so there is no before-extension Wasm size. F3 found a
largest public metadata ROM sum of 3,178,496 bytes. Its conservative two-copy
estimate is 6,356,992 bytes, 3.16% of the 201,326,592-byte safe budget,
leaving 194,969,600 bytes. Every family machine therefore remains within
4,096 pages.

The driver uses ordinary static graphics decode layouts. Its largest character
layout expands to 4 MiB of one-byte pixels and the paired sprite layout to
0.5 MiB, rather than decoding a large multi-megabyte sprite region of the kind
that exhausted W27e's smaller heap. The pending browser run remains the final
fixed-memory confirmation.

## Target findings

The independent derivation found 29 public entries in `drivers/mitchell.c`,
exactly matching production `-listfull`, so no list correction was needed.
The production build compiled and linked on the first attempt without adding
a source unit or selectable core.

The family compiles `drivers/mitchell.c`, `video/mitchell.c` and its own copy
of `machine/kabuki.c`. It selects the Z80 core, OKIM6295 and YM2413 sound for
the main boards, the package-specified YM3812/MSM5205 alternate paths, a second
Z80 where configured, and the 93C46 EEPROM device. A harmless Centronics core
keeps the pinned release's mandatory bus archive non-empty.

The mahjong configurations remain in the complete `.lst`, but their
`IPT_MAHJONG_*` keyboard matrices are outside the runtime's current bindings.
The quiz configurations use ordinary action-button fields. The ignored preload
selects an EEPROM configuration with no DIP switches; the production selector
case handles that by offering nothing to select. Source inspection expects the
selected machine report to contain `inputs.keys: []` and
`supportsSave: true`; the pending host browser run must confirm both values.

## Browser evidence blocker

F4–F6 were not run because this environment explicitly cannot run Chromium or
bind loopback sockets. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; upright geometry, native refresh and controlled cadences were
  not observed.
- F6 is pending; there is no measured 60-second desktop ratio.
- Runtime `inputs.keys`, `supportsSave` and zero-DIP behavior remain pending
  browser confirmation, with source and generated-metadata expectations
  recorded in the probe.

On a browser-capable host, the integrator should set `PRIVATE_FAMILY_PRELOAD`
to the ignored family config and run:

```sh
ARCADE_PRELOAD_CONFIG="$PRIVATE_FAMILY_PRELOAD" \
ARCADE_FAMILY_CONFIGS="$PRIVATE_FAMILY_PRELOAD" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family probe. Record F4 startup,
F5 non-blank geometry/refresh and all four controlled cadences, and the
60-second desktop F6 ratio with frameskip disabled. If startup reports the
adapter's fixed-heap error, raise `memoryPages` to 8,192 and rebuild before
repeating the measurements.

## Verification

Commands and results, in execution order:

```sh
npm run check

npm test

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts capcom-mitchell --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/capcom-mitchell/mamecapcom-mitchell"

stat -c '%n %s' dist/mame/capcom-mitchell/mamecapcom-mitchell.wasm \
  dist/mame/capcom-mitchell/mamecapcom-mitchell.js \
  dist/mame/capcom-mitchell/build.json

gzip -9 -c dist/mame/capcom-mitchell/mamecapcom-mitchell.wasm | wc -c
gzip -9 -c dist/mame/capcom-mitchell/mamecapcom-mitchell.js | wc -c

node -e 'const fs=require("node:fs");const z=require("node:zlib");for(const f of process.argv.slice(1)){const b=fs.readFileSync(f);const c=z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11}});console.log(f,c.length)}' \
  dist/mame/capcom-mitchell/mamecapcom-mitchell.wasm \
  dist/mame/capcom-mitchell/mamecapcom-mitchell.js

node -e 'const fs=require("node:fs");const d="dist/mame/capcom-mitchell/romsets";const rows=fs.readdirSync(d).map(f=>JSON.parse(fs.readFileSync(`${d}/${f}`))).map(m=>m.roms.reduce((n,r)=>n+r.size,0));const max=Math.max(...rows);const budget=4096*65536*.75;const estimate=max*2;console.log(JSON.stringify({records:rows.length,maxRomSum:max,estimate,budget,percent:estimate/budget*100,remaining:budget-estimate},null,2))'

npm run check

npm test
```

- Initial `npm run check`: passed (`check:src` and `check:tests`).
- Initial `npm test`: 30 files, 577 cases; 577 passed, 0 failed, 0 skipped.
- Production build: passed in 181.46 seconds with 29 machines, 29 metadata
  files and a 5,009,704-byte Wasm.
- Independent `.lst` derivation: matched all 29 entries exactly.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: the 3,178,496-byte maximum and its conservative
  6,356,992-byte two-copy estimate fit the safe budget.
- Browser suite: not run under the documented sandbox restriction; F4–F6 are
  pending for the integrator.
- Final `npm run check`: passed (`check:src` and `check:tests`).
- Final `npm test` with the real family output present: 30 files, 577 cases;
  577 passed, 0 failed, 0 skipped, including the build-output validation.

The target/build/test-row changes were committed as `56e558b` before this
documentation pass.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`capcom-mitchell` family after the host F6 decision, naming
`drivers/mitchell.c`, `video/mitchell.c`, `machine/kabuki.c`, the selected
Z80/sound/EEPROM closure and the 29-machine count. It should also record the
unbound mahjong keyboard matrix and zero-DIP EEPROM behavior. This package did
not edit the spec because it is outside W31b's write set.
