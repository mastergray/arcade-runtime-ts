# W28e merge note — `midway-tunit` Wolf Unit extension

Status: production build complete; F4–F6 for `midwunit.c` are pending because
this sandbox cannot bind the browser test server. The extended target pair,
metadata extraction, preload audit, threading gate, type checks and full spec
suite pass. The extension remains in the branch for the integrator to measure
and decide with the user after the heavier board's desktop F6 ratio is
available.

## Deliverables

- `mame/targets/midway-tunit.lua`: adds the Wolf Unit driver/machine pair and
  its Midway serial security PIC implementation to the existing T-Unit/Y-Unit
  target; the video unit remains shared with T-Unit.
- `mame/targets/midway-tunit.lst`: derives from all three driver sources and
  contains 82 public machines, including 16 from `midwunit.c`.
- `mame/builds/midway-tunit.json`: records the three added source units and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/midway-tunit.md`: replaces F1–F3 with whole-family
  evidence, records the new-driver F4–F6 browser blocker, preserves the
  earlier-driver measurements, and records the memory and DCS volume findings.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to
  three driver sources and 82 expected machines.
- `dist/mame/midway-tunit/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed source-unpack build compiled the complete pre-extension family
and reached the final link in 135.77 seconds, where the pinned Node 8
JavaScript compiler stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured
standard streams. The established ignored worktree-local `BASH_ENV`
configuration then selected host Node 22 for Emscripten's JavaScript helpers
only; the pinned C/C++ compiler, native optimizer, Binaryen, source, flags and
production pipeline remained unchanged. The successful pre-extension
pipeline completed in 33.98 seconds. After the target edit, the successful
extension pipeline completed in 35.20 seconds.

```text
dist/mame/midway-tunit/
├── build.json                       2,758 bytes
├── mamemidway-tunit.js            301,920 bytes
├── mamemidway-tunit.wasm        5,729,853 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           82 files, 869,433 aggregate bytes
```

- `.lst` and `-listfull` machine count: 82
- buildId: `e108a9f0b3a844b901a7e0a771922917e53545292db178651abe4c9d5091aaea`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 5,676,014 | 1,534,350 | 1,151,484 |
| After extension | 5,729,853 | 1,548,970 | 1,160,679 |
| Increase | 53,839 (0.95%) | 14,620 (0.95%) | 9,195 (0.80%) |

This family download grows for every existing title, not only boards from
`midwunit.c`. The integrator must decide with the user whether the 53,839-byte
raw / 9,195-byte Brotli-11 increase is acceptable after also considering the
pending F6 desktop result.

The JavaScript artifact is 301,920 raw, 65,587 gzip-9 and 55,323 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 26,214,400 bytes in
`midwunit.c`. Its standard two-copy estimate is 52,428,800 bytes. Counting the
driver's complete declared DCS, program and graphics regions instead produces
a stricter 69,206,016-byte peak, 34.38% of the 201,326,592-byte safe budget,
so every family machine remains within 4,096 pages with 132,120,576 bytes of
margin.

## Target findings

The independent derivation found 22 machines from `midtunit.c`, 44 from
`midyunit.c` and 16 from `midwunit.c`. The 82-entry result matched production
`-listfull`, so no list correction was needed.

The added board reuses TMS34010, ADSP-2105, DCS sound and the shared
`video/midtunit.c` unit already selected by the family. The upstream Midway
source block also provides `machine/midwayic.c`, which implements the serial
security PIC that `midwunit.c` configures; adding it resolved the complete
source closure. No selectable CPU, sound or machine core was added, and the
first complete extension link reported no further undefined unit or core.

Source inspection found no boot-time expansion of the full graphics region
into gfx elements. The shared video unit reads the compressed graphics region
directly and performs DMA operations into video RAM as requested; the regions
have neither `ROMREGION_DISPOSE` nor a `GFXDECODE` table. The browser was
blocked before boot, so if the integrator nevertheless encounters the
adapter's `MEMORY_EXCEEDED` error, the prescribed response is to set
`memoryPages` to 8,192, rebuild, and repeat F4–F6.

The new driver declares ordinary DIP switches and `GAME_SUPPORTS_SAVE`, so
the wave's EEPROM/no-DIP and unsupported quick-save exceptions do not apply.
The M33 DCS note does: cabinet volume buttons control a CMOS output-level
setting that the runtime does not yet expose, and low DCS volume is expected
rather than an emulation failure.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 26
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 29 harmless unexpected
entries.

The required real browser command was attempted and completed 0 passed, 32
failed and 25 skipped by design. Every runnable case stopped at `listen EPERM:
operation not permitted 127.0.0.1` before Chromium page creation.
Consequently, for `midwunit.c`:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; native geometry, refresh and controlled cadences were not
  observed.
- F6 is pending; there is no measured desktop ratio, so the performance gate
  and the extension's final family membership remain open.

On a host that permits loopback and Chromium, the integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family probe. If the desktop F6
ratio misses the gate, record that ratio plainly and decide with the user
whether to retain the extension. If the board runs but DCS audio is quiet,
apply the M33 volume note rather than treating that as a board failure.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-tunit --jobs 4

# After extending the target, the same BASH_ENV/EMSDK_DIR build command.

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-tunit/mamemidway-tunit"

stat -c '%n %s' \
  dist/mame/midway-tunit/mamemidway-tunit.wasm \
  dist/mame/midway-tunit/mamemidway-tunit.js \
  dist/mame/midway-tunit/build.json

gzip -9 -c dist/mame/midway-tunit/mamemidway-tunit.wasm | wc -c
gzip -9 -c dist/mame/midway-tunit/mamemidway-tunit.js | wc -c

node --import tsx .cache/w28e-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-tunit.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-tunit.json" \
  npm run test:browser

npm run check && npm test
```

- First production build: compiled the complete pre-extension family, then
  failed at the final link after 135.77 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility baseline build: passed in 33.98 seconds with 66
  machines and 66 metadata files; its wasm was 5,676,014 bytes.
- Host-Node compatibility extension build: passed in 35.20 seconds with 82
  machines and 82 metadata files; its wasm was 5,729,853 bytes.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata/source reduction: 26,214,400-byte largest ROM sum and a stricter
  69,206,016-byte peak; both fit the safe budget without graphics expansion.
- Privacy-safe preload audit: both policies returned `ok` with all 26 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so the new driver's F4–F6 remain pending.
- Final `npm run check && npm test`: passed (`check:src` and `check:tests`),
  then 30 files and 555 cases with 555 passed, 0 failed and 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.

The package content commit succeeded. A later message-format-only
`git commit --amend` attempt was refused because Git could not create the
shared worktree index lock on a temporarily read-only filesystem; no content
change was attempted or lost.

## Integrator note

The integrator-owned specification remains stale: §4.6's `midway-tunit` row
should add `drivers/midwunit.c`, `machine/midwunit.c`, the shared T-Unit video
path and `machine/midwayic.c`, update the machine count from 66 to 82, and
describe the pending F6 retention decision. This package did not edit the
specification because it is outside W28e's write set.
