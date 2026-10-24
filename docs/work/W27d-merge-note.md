# W27d merge note — `namco-nb`

Status: production build complete; F4–F6 pending because the lawful ignored
preload is incomplete for MAME 0.161. The target pair, metadata extraction,
private preload audit, threading gate, type checks and full spec suite pass.
The first-frame, geometry and desktop-performance gates remain open for the
integrator after the one missing required file is supplied lawfully.

## Deliverables

- `mame/targets/namco-nb.lua`: the pinned NB driver/video group, shared Namco
  IC code, C75/M37710 device, C116 screen controller, C352 sound path and
  parallel EEPROM support.
- `mame/targets/namco-nb.lst`: 15 public machines derived from
  `drivers/namconb1.c`.
- `mame/builds/namco-nb.json`: pre-emptive 8,192-page production build input.
- `docs/probes/families/namco-nb.md`: F1–F6 record, with F4–F6 explicitly
  pending one missing required file and MAME's own `GAME_IMPERFECT_SOUND`
  flag distinguished from a browser-port defect under F6.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.
- `dist/mame/namco-nb/`: the ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete selected source closure and
reached the final link in 104.30 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following the
earlier W27 packages, an ignored worktree-local `BASH_ENV` directs
Emscripten's JavaScript helpers to host Node 22; the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline remain
unchanged.

The first diagnostic host-Node link exposed the missing C116 screen-controller
and M37450 type symbols. After the two upstream dependencies described below
were selected, the compatibility pipeline passed in 40.01 seconds. A final
run with the minimal compatibility environment passed in 34.75 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6
```

```text
dist/mame/namco-nb/
├── build.json                       1,745 bytes
├── mamenamco-nb.js                302,027 bytes
├── mamenamco-nb.wasm            5,928,743 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           15 files, 82,715 aggregate bytes
```

- `.lst` and `-listfull` machine count: 15
- Wasm bytes: 5,928,743
- buildId: `bcfe8813ca3fe0c19b35491d67da1840c54d572118bead34cdefc109e8df8653`
- Memory: fixed 8,192 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,928,743 | 1,521,332 | 1,140,736 |
| JavaScript | 302,027 | 65,565 | 55,359 |

F3 found a largest public metadata ROM sum of 39,337,984 bytes. Its
conservative two-copy estimate is 78,675,968 bytes, 39.08% of the nominal
4,096-page safe budget. No machine fails the metadata-only estimate.

The build nevertheless starts at 8,192 pages. `namconb1.c` describes large
sprite, tile and NB-2 rotation regions as 8-bit gfx elements, which MAME
decodes into live graphics storage at startup. The largest-set sum is the same
scale as the earlier `seta2.c` board that exhausted 4,096 pages at browser
start despite passing this metadata estimate. The larger fixed heap avoids
repeating that known undercount; the integrator's eventual browser run should
confirm the live peak.

## Target findings and corrections

The independent derivation found 15 public entries in `namconb1.c`, exactly
matching production `-listfull`, so no list correction was needed. The pinned
Namco vendor block contributes the driver/video pair, shared
`drivers/namcoic.c`, `machine/namcomcu.c` for the C75 and `video/c116.c` for
the screen controller. The target selects the M68000-family and M37710 CPU
paths, C352 sound and parallel EEPROM.

The shared Namco IC unit includes the System 2 state header, whose optional
M37450 device type is supplied by the M6502 group. The first host-Node link
reported only that type and C116 as undefined. Selecting the M6502 group and
the upstream `video/c116.c` unit resolved every symbol; no unrelated driver,
audio or video unit was added.

## Browser evidence pending

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `incomplete`: one archive present
of two required, 23 expected files valid, one required file missing, zero
wrong-size, wrong-CRC or optional-missing files, zero warnings and archive
problems, and two harmless unexpected entries.

W27 directs an incomplete preload to remain pending rather than searching for
files. The browser suite was therefore not run. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; geometry, orientation, refresh and controlled cadences were
  not observed.
- F6 is pending; there is no measured desktop ratio, so the family has not yet
  passed its desktop gate. The configured NB-2 entry carries MAME 0.161's own
  `GAME_IMPERFECT_SOUND` flag in `drivers/namconb1.c`; that is an upstream
  emulator flag, not a port defect.

The driver does not declare `GAME_SUPPORTS_SAVE`. If the completed host run's
harness quick-save case is declined, record it as the known M35 limitation and
continue with the remaining acceptance cases. The production DIP-selector
case already handles machines that declare no DIP switches.

After completing the private input, the integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-namco-nb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-namco-nb.json" \
  npm run test:browser
```

Then copy only privacy-safe measurements into the family probe. Do not record
the configured machine, file names, hashes or resolved paths.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-nb/mamenamco-nb"

stat -c '%n %s' dist/mame/namco-nb/mamenamco-nb.wasm \
  dist/mame/namco-nb/mamenamco-nb.js dist/mame/namco-nb/build.json
gzip -9 -c dist/mame/namco-nb/mamenamco-nb.wasm | wc -c
gzip -9 -c dist/mame/namco-nb/mamenamco-nb.js | wc -c

node --import tsx .cache/w27d-audit.ts

npm run check && npm test
```

- First production build: compiled the family, then failed at the final link
  after 104.30 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility diagnostics: the link exposed the C116 and M37450
  dependencies; selecting their upstream unit/core resolved them.
- Corrected compatibility build: passed in 40.01 seconds; the final minimal
  compatibility rerun passed in 34.75 seconds with 15 machines and 15 metadata
  files.
- Explicit threading inspection: passed with one fixed 8,192-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 39,337,984-byte largest ROM sum; the conservative
  estimate fits 4,096 pages on paper, while the build uses 8,192 pages for the
  documented live graphics-decode risk.
- Privacy-safe preload audit: both policies returned `incomplete` with one
  required file missing; F4–F6 remain pending by rule.
- Browser suite: not run because the configured set is incomplete for the
  pinned source, as W27 requires.
- Final `npm run check && npm test`: passed; `check:src` and `check:tests`
  completed, then 30 files and 555 cases passed with 0 failed and 0 skipped.
  The real new output was present and passed
  `tests/spec/32-build-output.test.ts`.

## Integrator note

The integrator-owned §4.6 matrix still needs a `namco-nb` row after the host
F6 decision. It should name `drivers/namconb1.c`, `video/namconb1.c`,
`drivers/namcoic.c`, `machine/namcomcu.c`, `video/c116.c`, the M68000-family,
M37710 and M6502 paths, C352 and parallel EEPROM, plus the 15-machine count,
8,192-page heap rationale and upstream imperfect-sound flag. This package did
not edit the spec because it is outside W27d's write set.

## Integrator notes

The missing required file was the shared C75 device ROM archive, which the
user's library holds; added to the ignored preload configs, all three local
sets audit ok. Gate runs on the host (2026-10-24): NB-2 set 30 passed,
2 failed; NB-1 set 30 passed, 2 failed; the failures are the two speed
cases. F6 0.9160 (NB-2) and 0.8208 (NB-1) over 60 s, F4 840 ms and 702 ms,
audio queue peak 101 ms and 97 ms. The family is merged as **built, below
the gate** under the W27 rule and leaves the 1.0.0 matrix; the pre-emptive
8,192-page heap was right (the machines start).
