# W28b merge note — `midway-mcr` extension

Status: production build complete; F4–F6 for the added `williams.c` board are
pending because this sandbox cannot bind the browser test server. The extended
target pair, metadata extraction, privacy-safe preload audit, threading gate,
type checks and full spec suite pass. The integrator must run the configured
blitter-heavy board on the desktop reference host before making the final F6
retention decision.

## Deliverables

- `mame/targets/midway-mcr.lua`: adds the `williams.c` driver/machine/video
  units, address-map bank core and shared ticket-device implementation to the
  existing family; its Williams sound unit and CPU/sound cores were already
  selected.
- `mame/targets/midway-mcr.lst`: derives from all four driver sources and
  contains 100 public machines, including 46 from `williams.c`.
- `mame/builds/midway-mcr.json`: records the complete source closure and keeps
  the evidence-backed 4,096-page memory setting.
- `docs/probes/families/midway-mcr.md`: replaces F1–F3 with whole-family
  evidence, adds the new-driver F4–F6 result and browser blocker, preserves the
  earlier MCR measurement, and records F11 analogue coverage by driver file.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to four
  driver sources and 100 expected machines.
- `dist/mame/midway-mcr/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed pre-extension build compiled the complete baseline family and
reached the final link in 167.01 seconds, where the pinned Node 8 JavaScript
compiler stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured standard streams.
An ignored worktree-local `BASH_ENV` configuration then selected host Node 22
for Emscripten's JavaScript helpers only; the pinned C/C++ compiler, native
optimizer, Binaryen, source, flags and production pipeline remained unchanged.
The successful current-main baseline pipeline completed in 35.61 seconds, and
the successful extended pipeline completed in 32.14 seconds on the reused
source/object cache.

```text
dist/mame/midway-mcr/
├── build.json                       3,042 bytes
├── mamemidway-mcr.js              303,075 bytes
├── mamemidway-mcr.wasm          6,440,836 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          100 files, 594,801 aggregate bytes
```

- `.lst` and `-listfull` machine count: 100
- buildId: `b0d867ffc6121773fb03c1ae81c7fe40e5d6dcb8f1a31fca6b39b492c01a1f0e`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,307,648 | 1,628,903 | 1,221,093 |
| After extension | 6,440,836 | 1,669,262 | 1,251,850 |
| Increase | 133,188 (2.11%) | 40,359 (2.48%) | 30,757 (2.52%) |

The family download grows for every existing `midway-mcr` machine, not only
boards from `williams.c`. The integrator must decide with the user whether the
133,188-byte raw / 30,757-byte Brotli-11 increase is acceptable after also
considering the pending desktop F6 result.

The JavaScript artifact is 303,075 raw, 65,655 gzip-9 and 55,377 Brotli-11
bytes. Its raw and gzip sizes are unchanged from the baseline; its Brotli-11
encoding is 11 bytes larger.

F3 found a largest public metadata ROM sum of 1,114,118 bytes in `mcr68.c`.
Its conservative two-copy estimate is 2,228,236 bytes, 1.11% of the
201,326,592-byte safe budget, so every family machine remains within 4,096
pages. The largest `williams.c` sum is 291,616 bytes. That driver blits into a
small framebuffer rather than decoding large sprite regions at boot; its
largest graphics region is 49,152 bytes and its color-remap lookup is 65,536
bytes. If the real browser run nevertheless reports `MEMORY_EXCEEDED`, the W28
fallback is `memoryPages: 8192`.

## Target findings

The independent derivation found 29 machines from `mcr.c`, 12 from `mcr3.c`,
13 from `mcr68.c` and 46 from `williams.c`. The 100-entry result matched
production `-listfull`, so no list correction was needed.

The added board configures M6809 and M6808 CPUs, PIAs, DAC and HC55516 CVSD.
Those selectable cores and `audio/williams.c` were already present in the
family. Its banked program maps additionally require `BANKDEV`, while one
public configuration requires `machine/ticket.c` from MAME's shared source
block. Adding those two closure dependencies resolved the complete target;
the first extended link reported no further undefined unit or core.

Source inspection found no samples or EEPROM dependency in the added driver.
All 46 public declarations carry `GAME_SUPPORTS_SAVE`, so the M35
unsupported-save exception does not apply by source inspection. The configured
board's metadata declares no DIP switches, and the production selector case
correctly recorded that there was nothing to select.

The refreshed F11 section records the existing MCR dial, paddle, pedal,
AD-stick and trackball declarations plus the added driver's AD-stick and
trackball declarations. W26 already supplies their standard, relative and
digital-ramp bindings, so no TypeScript change was needed.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 15
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 33 harmless unexpected
entries.

The required real browser command was attempted and completed 1 passed, 31
failed and 25 skipped by design across 57 cases. Every page-backed case,
including the family measurement, stopped at `listen EPERM: operation not
permitted 127.0.0.1` before Chromium page creation. The one metadata-only pass
confirmed the no-DIP handling described above. Consequently, for `williams.c`:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; upright geometry, native refresh and controlled cadences were
  not observed.
- F6 is pending; there is no measured desktop ratio, so final extension
  retention remains open.
- The quick-save browser case is pending, although the driver advertises save
  support for every public machine.

On a host that permits loopback and Chromium, the integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-mcr.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-mcr.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family probe. Confirm non-black
blitter output, record F4 startup, F5 geometry/refresh and 60/90/120/144 Hz
cadences, and record the 60-second desktop F6 ratio plus the informational 4×
CPU-throttled ratio. If the desktop ratio misses the gate, report it plainly
and decide with the user whether to remove the extension.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28b-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-mcr/mamemidway-mcr"

gzip -9 -c dist/mame/midway-mcr/mamemidway-mcr.wasm | wc -c
gzip -9 -c dist/mame/midway-mcr/mamemidway-mcr.js | wc -c

node --import tsx --input-type=module -

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-mcr.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-mcr.json" \
  npm run test:browser

npm run check && npm test
```

- First prescribed baseline build: compiled the complete family, then failed
  at the final link after 167.01 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- First compatibility attempt: the same build command failed at the same Node
  8 bootstrap after 24.58 seconds because the initial ignored environment did
  not override the SDK-generated `EM_CONFIG`; the local shim was corrected.
- Corrected compatibility baseline build: passed in 35.61 seconds with 54
  machines, 54 metadata files and a 6,307,648-byte Wasm.
- Independent `.lst` derivation: matched all 100 entries exactly after adding
  `williams.c`.
- Extended compatibility build: passed in 32.14 seconds with 100 machines, 100
  metadata files and a 6,440,836-byte Wasm.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 1,114,118-byte family maximum and 291,616-byte
  `williams.c` maximum; both conservative two-copy estimates fit the safe
  budget.
- Privacy-safe preload audit: both policies returned `ok` with all 15 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 1 passed, 31 failed and
  25 skipped by design, so new-driver F4–F6 remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 555 cases; 555 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.

The target/build/test-row changes were committed as `6e144ba` before this
documentation pass. The first `git add ... && git commit ...` attempt for the
probe and merge note was refused because Git could not create the shared
worktree index lock on a temporarily read-only filesystem. No content change
was attempted or lost; a later retry is recorded in the branch history if the
shared Git directory became writable again.

## Integrator note

The integrator-owned specification remains stale: §4.6's `midway-mcr` row
should add `drivers/williams.c`, `machine/williams.c`, `video/williams.c`, the
bank and shared ticket dependencies, and the 100-machine count after the host
F6 decision. This package did not edit the spec because it is outside W28b's
write set.
