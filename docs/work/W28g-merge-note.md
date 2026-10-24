# W28g merge note — `misc-16` extension with `cninja.c`

Status: production build complete; F4–F6 for the added driver are pending.
The ignored preload is incomplete for MAME 0.161, and this sandbox also
cannot bind the browser test server. The extended target pair, ROM-free
metadata extraction, threading gate, type checks and full spec suite pass.

## Deliverables

- `mame/targets/misc-16.lua`: adds the `cninja.c` driver/video pair, DECO16
  tile and common video units, DECO sprite unit, DECO104/146 protection and
  DECO56 graphics decryption to the existing mixed 16-bit target.
- `mame/targets/misc-16.lst`: derives from all nine driver sources and
  contains 131 public machines, including 20 from `cninja.c`.
- `mame/builds/misc-16.json`: records the complete added source closure and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/misc-16.md`: replaces F1–F3 with whole-family
  evidence, retains the six earlier-driver measurements and records the
  added driver's F4–F6 blockers.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to
  nine driver sources and 131 expected machines.
- `dist/mame/misc-16/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed source-unpack build compiled the complete family and reached
the final link in 174.74 seconds, where the pinned Node 8 JavaScript compiler
stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured standard streams. An
ignored worktree-local `BASH_ENV` configuration then selected host Node 22 for
Emscripten's JavaScript helpers only; the pinned C/C++ compiler, native
optimizer, Binaryen, source, flags and production pipeline remained
unchanged.

The first host-Node link exposed the DECO104 protection device and DECO56
graphics decryptor as two dependencies hidden by the broad pinned-source
vendor block. After their source units were added, the successful
cached-source production pipeline completed in 33.82 seconds.

```text
dist/mame/misc-16/
├── build.json                       3,621 bytes
├── mamemisc-16.js                 303,057 bytes
├── mamemisc-16.wasm             7,605,523 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          131 files, 1,260,425 aggregate bytes
```

- `.lst` and `-listfull` machine count: 131
- buildId: `e9d9f04fad4c5523ce06d29af90a24781e9efc2988bb48b97d55ac09d2d9a38a`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 7,409,427 | 1,809,382 | 1,345,501 |
| After extension | 7,605,523 | 1,860,709 | 1,380,653 |
| Increase | 196,096 (2.65%) | 51,327 (2.84%) | 35,152 (2.61%) |

This family download grows for every title already in `misc-16`, not only
boards from `cninja.c`. The JavaScript artifact grows from 302,943 to 303,057
raw bytes, from 65,627 to 65,647 gzip-9 bytes and from 55,359 to 55,384
Brotli-11 bytes.

F3 found an unchanged whole-family maximum public metadata ROM sum of
18,219,136 bytes. Its conservative two-copy estimate is 36,438,272 bytes,
18.10% of the 201,326,592-byte safe budget, leaving 164,888,320 bytes. The
largest added-driver sum is 8,717,312 bytes, so every family machine remains
within the metadata-only 4,096-page estimate.

The added driver does perform substantial graphics work: one configuration
decrypts two graphics regions through same-size temporary word buffers before
MAME decodes them. The sandbox browser run never reached machine startup. If
the integrator's complete-set run aborts with the adapter's "needs more
memory" error, raise `memoryPages` to 8,192, rebuild and repeat F1–F6.

## Target findings

The independent derivation found 111 existing public entries and 20 from
`cninja.c`; the 131-entry result exactly matched production `-listfull`, so no
list correction was needed.

The driver configures M68000 with H6280 sound, while two bootleg configurations
use the family's existing Z80 core. YM2203, YM2151 and dual OKIM6295 sound,
buffered sprite RAM and every selectable CPU/sound core were already present.
The added source closure supplies two DECO16 tile devices, the common palette
device, DECO sprites, both protection variants and the DECO56 decryptor. The
corrected link reported no further undefined unit or core.

All 20 added-driver metadata entries declare DIP switches, and none names a
sample archive. The configured entry is marked `GAME_SUPPORTS_SAVE` in the
pinned driver. Consequently the EEPROM-without-DIP, optional-sample and
unsupported-quick-save exceptions do not apply; the ordinary DIP and
quick-save browser cases remain pending with F4–F6.

## Browser evidence blockers

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both reported `incomplete`: two expected archive
roles, 19 expected files, 15 missing required files, zero wrong-size,
wrong-CRC or optional-missing entries, zero warnings and archive problems,
and no sample archive. Per the package rules, no replacement files were
sought.

The required real browser command was also attempted. It completed 0 passed,
32 failed and 25 skipped by design. Every runnable case stopped at
`listen EPERM: operation not permitted 127.0.0.1` before Chromium page
creation. Consequently, for `cninja.c`:

- F4 is pending; `callMain` was not reached, no first frame arrived and
  non-blank output is not confirmed.
- F5 is pending; native geometry, refresh and controlled cadences were not
  observed.
- F6 is pending; there is no measured desktop ratio for the added driver.

On a host that permits loopback and Chromium, the integrator should first
supply a complete lawful MAME 0.161-compatible preload and then run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family probe. If startup reports
the adapter's memory error, apply the 8,192-page fallback above before the
measurement run.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28g-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4

source "$PWD/res/emsdk/emsdk_env.sh" >/dev/null
export PATH="$PWD/scripts/toolchain-shims:$PATH"
EM_CONFIG="$PWD/.cache/w28g.emscripten" EMCC_DEBUG=2 \
  "$PWD/res/emsdk/emscripten/1.38.31/emcc" \
  -O2 -s WASM=1 -s USE_SDL=2 -s MODULARIZE=1 \
  -s 'EXPORT_NAME="createMame"' -s TOTAL_MEMORY=268435456 \
  -s ALLOW_MEMORY_GROWTH=0 -s NO_EXIT_RUNTIME=1 \
  -s DISABLE_EXCEPTION_CATCHING=0 -s USE_PTHREADS=0 \
  -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]' \
  -s 'EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_set_axis","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]' \
  "$PWD/.cache/mame/mame0161/mamemisc-16.bc" \
  -o /tmp/w28g-diag.js

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28g-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts misc-16 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/misc-16/mamemisc-16"

gzip -9 -c dist/mame/misc-16/mamemisc-16.wasm | wc -c
gzip -9 -c dist/mame/misc-16/mamemisc-16.js | wc -c

node --import tsx .cache/w28g-audit.ts \
  "$PWD/res/preload-misc-16.json"

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-misc-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-misc-16.json" \
  npm run test:browser

npm run check && npm test
```

- First production build: compiled the complete family, then failed at the
  final link after 174.74 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- First host-Node build: reached the JavaScript compiler, then failed after
  19.23 seconds because the initial source closure lacked DECO104 and DECO56.
- Diagnostic production-flags link: confirmed only those three undefined
  symbols; no additional source or core was missing.
- Corrected host-Node build: passed in 33.82 seconds with 131 machines and
  131 metadata files, producing the build identity recorded above.
- Independent `.lst` regeneration: 131 entries and no diff from the committed
  list body.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 18,219,136-byte whole-family maximum ROM sum; the
  conservative estimate fits the safe budget.
- Privacy-safe preload audit: both policies reported 15 required files
  missing; zero wrong-size, wrong-CRC or optional-sample entries.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so the added driver's F4–F6 remain pending.
- `npm run check && npm test`: passed (`check:src`, `check:tests`; 30 spec
  files, 555 cases, 555 passed, 0 failed, 0 skipped). The real output was
  present and passed `tests/spec/32-build-output.test.ts`.

## Integrator note

The integrator-owned specification remains stale: §4.6's `misc-16` row should
add `drivers/cninja.c`, its driver/video support units, DECO104/146 protection
and DECO56 graphics decryption to scope, and update the family count to 131.
This package did not edit the spec because it is outside W28g's write set.

F4–F6 require both a complete lawful 0.161 preload and a host that permits
loopback/Chromium. No other integrator-owned line is needed.

## Integrator notes

The ignored preload names a clone set whose archive lacks the parent's fifteen files; the integrator recorded F4–F6 pending and merged the build (131 machines, +196 KB). The measurement runs when the parent archive is available.
