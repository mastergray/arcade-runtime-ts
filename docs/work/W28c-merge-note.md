# W28c merge note — `taito-classic` `qix.c` extension

Status: production build complete; F4–F6 for both supplied driver-file
selections are pending because this sandbox cannot bind the browser test
server. The extended target pair, metadata extraction, privacy-safe preload
audits, threading gate, type checks and full spec suite pass. The family can
rejoin the release matrix after the integrator records passing desktop browser
measurements for both selections.

## Deliverables

- `mame/targets/taito-classic.lua`: adds the `qix.c` driver, machine, audio
  and video units; the discrete sound core; the MC6845 video core; and the
  6821 PIA machine core.
- `mame/targets/taito-classic.lst`: derives from all fourteen family driver
  sources and contains 165 public machines, including 17 from `qix.c`.
- `mame/builds/taito-classic.json`: records the four added source units and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/taito-classic.md`: replaces F1–F3 with whole-family
  evidence and records the separate `qix.c` and `bublbobl.c` F4–F6 browser
  blockers.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to
  fourteen driver sources and 165 expected machines.
- `dist/mame/taito-classic/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed current-main baseline build reached the final link in 169.26
seconds, where pinned Node 8 stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured
standard streams. Following W27h, an ignored worktree-local `BASH_ENV`
configuration selected host Node 22 for Emscripten's JavaScript helpers only;
the pinned C/C++ compiler, native optimizer, Binaryen, source, flags and
production pipeline remained unchanged. The baseline then completed in 37.89
seconds. The final extended cached-source pipeline completed in 29.27 seconds.

```text
dist/mame/taito-classic/
├── build.json                       4,087 bytes
├── mametaito-classic.js           303,563 bytes
├── mametaito-classic.wasm       6,125,900 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          165 files, 1,448,142 aggregate bytes
```

- `.lst` and `-listfull` machine count: 165
- buildId: `f6997f33d511330c0adc2464aba30309f6ffdf2623295aa15a1d7485c67b5548`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Current-main baseline before extension | 5,981,822 | 1,629,493 | 1,220,547 |
| W28c extended family | 6,125,900 | 1,666,075 | 1,250,383 |
| Increase | 144,078 (2.41%) | 36,582 (2.24%) | 29,836 (2.44%) |

The current-main baseline build id was
`8660c25b307ef912e345b94a0645926864022aec1ad1c2665ae800d3ef8ec494`.
The JavaScript artifact is 303,563 raw, 65,689 gzip-9 and 55,358 Brotli-11
bytes after extension.

The family download grows for every machine already in `taito-classic`, not
only the added board group. F3 found a largest public metadata ROM sum of
2,424,832 bytes in the existing `tnzs.c` group. Its conservative two-copy
estimate is 4,849,664 bytes, 2.41% of the 201,326,592-byte safe budget, so
every family machine remains within 4,096 pages.

## Target findings

The independent derivation found 17 entries in `qix.c`. Added to the existing
148, the 165-entry result matched production `-listfull`, so no list
correction was needed.

The added board group configures two M6809 processors, an M6802 audio
processor and an M68705 MCU. The family already selected their M6809, M6800
and M6805 cores, plus the DAC and SN76496 sound paths. The discrete sound
core was the only new sound selection. The first extended link then reported
the MC6845 and PIA6821 symbols missing; the pinned selectable names are
`VIDEOS["MC6845"]` and `MACHINES["6821PIA"]`. Adding both completed the
source closure with no further undefined unit or core.

The driver has no GFX decode table or decoded graphics regions; its video
unit renders from direct bitmap video RAM, so it does not carry W28's large
decoded-sprite heap risk. It names no sample set or EEPROM device, and every
entry carries `GAME_SUPPORTS_SAVE`; the optional-sample, DIP-less EEPROM and
quick-save exceptions do not apply.

## Browser evidence blocker

Both ignored preloads were audited without logging their private identities.
Strict and MAME-compatible policies returned `ok` for each. The `qix.c`
selection had one archive, all 16 expected files valid, no missing,
wrong-size, wrong-CRC or optional-missing entries, no warnings or problems,
and 58 harmless unexpected entries. The `bublbobl.c` selection had one
archive, 18 valid and three optional-missing expected files, no required
missing, wrong-size or wrong-CRC entries, no warnings or problems, and 103
harmless unexpected entries.

The required real-browser command was attempted:

```sh
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-classic.json,$PWD/res/preload-taito-classic-2.json" \
  npm run test:browser
```

It completed 0 passed, 29 failed and 26 skipped. Every runnable case stopped
at `listen EPERM: operation not permitted 127.0.0.1` before Chromium page
creation. Consequently, for both the `qix.c` and `bublbobl.c` selections:

- F4 is pending; no first frame arrived.
- F5 is pending; geometry, orientation, refresh and controlled cadences were
  not observed.
- F6 is pending; there is no measured 60-second desktop ratio, so the
  family's return to the release matrix remains open.

On a host that permits loopback and Chromium, the integrator should rerun the
command above and copy only privacy-safe `FAMILY-MEASURE` values into the
family probe. Both desktop F6 results must pass before the family rejoins the
matrix.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -f 'WALL_SECONDS=%e' env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-classic --jobs 4

/usr/bin/time -f 'WALL_SECONDS=%e' env \
  BASH_ENV="$PWD/.cache/w28c-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-classic --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-classic/mametaito-classic"

gzip -9 -c dist/mame/taito-classic/mametaito-classic.wasm | wc -c
gzip -9 -c dist/mame/taito-classic/mametaito-classic.js | wc -c

node --import tsx .cache/w28c-audit.ts \
  res/preload-taito-classic.json res/preload-taito-classic-2.json

ARCADE_FAMILY_CONFIGS="$PWD/res/preload-taito-classic.json,$PWD/res/preload-taito-classic-2.json" \
  npm run test:browser

npm run check && npm test
```

- First current-main baseline build: compiled the complete family, then
  failed at the final link after 169.26 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node baseline build: passed in 37.89 seconds with 148 machines,
  148 metadata files and 5,981,822 Wasm bytes.
- First extended link: stopped after 15.74 seconds on the two missing
  selectable device cores; a 15.62-second retry reproduced the result.
  An `EMCC_DEBUG=1` replay preserved the old compiler's settings, and a
  direct privacy-safe diagnostic exposed the MC6845 and PIA6821 undefined
  symbols.
- Final compatibility build after the target correction: passed in 29.27
  seconds with 165 machines and 165 metadata files.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 2,424,832-byte largest ROM sum; the conservative
  estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` for both supplied
  configs, with aggregate results recorded above.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 29 failed and
  26 skipped, so both sets of F4–F6 measurements remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 555 cases; 555 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.

## Integrator note

The integrator-owned specification remains stale: §4.6's `taito-classic` row
should add the four `qix.c` source units, the discrete sound, MC6845 and
6821 PIA cores, and the new 165-machine total. Its deferred-family wording
should change only after both host F6 results pass. This package did not edit
the specification because it is outside W28c's write set.
