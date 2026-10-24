# W28a merge note — `atari-classic` extension

Status: production build complete; F4–F6 for `centiped.c` are pending because
the managed sandbox cannot bind the browser test server or launch Chromium.
The extended target pair, metadata extraction, preload audit, threading gate,
type checks and full spec suite pass.

## Deliverables

- `mame/targets/atari-classic.lua`: adds the `centiped.c` driver/video pair
  and the three selectable cores required by the driver's public clone
  configurations.
- `mame/targets/atari-classic.lst`: derives from all four driver sources and
  contains 31 public machines, including 16 from `centiped.c`.
- `mame/builds/atari-classic.json`: records both added source units and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/atari-classic.md`: replaces F1–F3 with whole-family
  evidence, adds the new-driver F4–F6 blocker and updates F11 for the new
  analogue ports while preserving the earlier-driver measurements.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to
  four driver sources and 31 expected machines.
- `dist/mame/atari-classic/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

An ignored worktree-local `BASH_ENV` configuration selected host Node 22 for
Emscripten's JavaScript helpers. The pinned C/C++ compiler, native optimizer,
Binaryen, source, flags and production pipeline remained unchanged. After the
target closure correction, the successful cached-source family pipeline
completed in 34.53 seconds.

```text
dist/mame/atari-classic/
├── build.json                       2,017 bytes
├── mameatari-classic.js           303,108 bytes
├── mameatari-classic.wasm       6,193,930 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           31 files, 252,597 aggregate bytes
```

- `.lst` and `-listfull` machine count: 31
- buildId: `830093aedf306139b771ea81811f5dc586fa9c3bfbb8c066804a5ac376a8c60a`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,022,964 | 1,556,676 | 1,169,229 |
| After extension | 6,193,930 | 1,597,000 | 1,199,086 |
| Increase | 170,966 (2.84%) | 40,324 (2.59%) | 29,857 (2.55%) |

The extension therefore adds 170,966 raw Wasm bytes and 29,857 Brotli-11
bytes to every family download. The JavaScript artifact is 303,108 raw,
65,662 gzip-9 and 55,408 Brotli-11 bytes.

F3 found the whole-family largest public metadata ROM sum unchanged at
1,707,786 bytes. Its conservative two-copy estimate is 3,415,572 bytes,
1.70% of the 201,326,592-byte safe budget. The largest `centiped.c` sum is
only 82,176 bytes; its graphics decoder uses small 8×8 and 8×16 planar
layouts over a largest `gfx1` region of 16 KiB. There is no metadata or source
evidence for raising the family above 4,096 pages.

## Target findings

The independent derivation found 15 machines in the existing three drivers
and 16 in `centiped.c`. The 31-entry result matched production `-listfull`,
so no list correction was needed.

The pinned `mame.lua` Atari block adds only `drivers/centiped.c` and
`video/centiped.c`. The configured board uses the expected M6502, POKEY and
EAROM path, all already selected by the family. Complete-driver coverage also
includes public configurations that instantiate S2650, AY8910 and SN76496;
the first host-Node link reported those undefined symbols. Selecting the
three cores resolved the link without another source unit. This corrects the
brief's hardware shorthand while preserving its named source closure.

Source and generated-metadata inspection found nine DIP switches, no sample
set and `GAME_SUPPORTS_SAVE` on the configured board. Neither the
EEPROM/no-DIP selector exception nor the unsupported quick-save case applies.
The driver's trackball, paddle and AD-stick declarations are recorded under
F11 and already have W26 controller bindings.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all
seven expected files valid, zero missing, wrong-size, wrong-CRC or
optional-missing entries, zero warnings and archive problems, and 61 harmless
unexpected entries.

The required real-browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser
```

It completed 0 passed, 33 failed and 25 skipped. The family measurement and
other server-backed cases stopped at
`listen EPERM: operation not permitted 127.0.0.1`. The socket-free bridge
case reached Chromium launch, but Chromium aborted because the sandbox denied
its `shutdown()` IPC operation. Consequently, for `centiped.c`:

- F4 is pending; no first frame arrived and no startup duration was measured.
- F5 is pending; expected upright 240×256 geometry, native refresh and
  controlled 60/90/120/144 Hz cadences were not observed.
- F6 is pending; no 60-second desktop or informational 4×-throttled ratio was
  measured.

The integrator should rerun the command above on an unrestricted host after
the concurrent wave builds are idle and copy only privacy-safe measurements
into the family probe. If the adapter reports `needs more memory` despite the
small F3 estimate, set `memoryPages` to 8,192 and rebuild only this family.

## Verification

Commands and results, in execution order:

```sh
# Independent list derivation, repeated for bzone/tempest/rampart/centiped.
for driver in bzone tempest rampart centiped; do
  comm -12 \
    <(sed -nE 's/^[[:space:]]*(GAME|GAMEL|GAME_CUSTOM)[[:space:]]*[(][^,]+,[[:space:]]*([a-z0-9_]+).*/\2/p' ".cache/mame0161-source/src/mame/drivers/$driver.c" | LC_ALL=C sort -u) \
    <(sed -nE 's/^([a-z0-9_]+)([[:space:]]*\/\/.*)?$/\1/p' .cache/mame0161-source/src/mame/mame.lst | LC_ALL=C sort -u) \
    | awk -v source="src/mame/drivers/$driver.c" '{ print $0 " // " source }'
done | LC_ALL=C sort -u

npm test -- --filter 04-mame-family-targets

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w28a-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-classic --jobs 4

# Diagnostic replay used the exact production flags printed by the failed
# pipeline, with EMCC_DEBUG=1 and the completed family bitcode as input.
source "$PWD/res/emsdk/emsdk_env.sh" >/dev/null
export EM_CONFIG="$PWD/.cache/w28a.emscripten"
export EMSCRIPTEN="$PWD/res/emsdk/emscripten/1.38.31"
export EMCC_DEBUG=1
emcc -O2 -s WASM=1 -s USE_SDL=2 -s MODULARIZE=1 \
  -s 'EXPORT_NAME="createMame"' -s TOTAL_MEMORY=268435456 \
  -s ALLOW_MEMORY_GROWTH=0 -s NO_EXIT_RUNTIME=1 \
  -s DISABLE_EXCEPTION_CATCHING=0 -s USE_PTHREADS=0 \
  -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]' \
  -s 'EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_set_axis","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]' \
  "$PWD/.cache/mame/mame0161/mameatari-classic.bc" \
  -o "$PWD/.cache/w28a-diagnostic.js"

npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-classic/mameatari-classic"

gzip -9 -c dist/mame/atari-classic/mameatari-classic.wasm | wc -c
gzip -9 -c dist/mame/atari-classic/mameatari-classic.js | wc -c

node --import tsx .cache/w28a-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-atari-classic.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-atari-classic.json" \
  npm run test:browser

npm run check
npm test

npm run check && npm test
```

- Independent derivation: 31 entries; a direct diff against the committed
  list body passed.
- Preliminary filtered test attempt: exited with the test runner's usage
  message because this runner does not accept `--filter`; no test ran.
- First compatibility build: stopped after 22.26 seconds because the initial
  ignored config selected the system Node 10 executable rather than host Node
  22, reproducing `ERR_UNKNOWN_STREAM_TYPE` during compilation.
- First host-Node full compile/link: compiled the family, then stopped after
  135.15 seconds at `compiler.js`; the diagnostic replay exposed the missing
  S2650, AY8910 and SN76496 symbols.
- Final corrected production build: passed in 34.53 seconds with 31 machines,
  31 metadata files and a 6,193,930-byte Wasm.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 1,707,786-byte whole-family largest ROM sum; the
  conservative two-copy estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all seven
  expected files valid.
- Browser suite: environment-blocked as described above; F4–F6 remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 555 cases; 555 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.
- Final combined rerun from the committed package state: passed with the same
  555/555 spec result.

No build-all, package build, clean, fresh build, rebase or push command was
run. Ignored source, build output and compatibility files remain untracked.

The two target commits succeeded. The first attempt to commit this probe and
merge note was refused because Git could not create the shared worktree's
`index.lock` on a temporarily read-only filesystem. No content was lost; the
same scoped commit succeeded on retry.

## Integrator note

The integrator-owned specification remains stale: §4.6's `atari-classic` row
should add `drivers/centiped.c`, `video/centiped.c`, S2650, AY8910 and SN76496
to its scope after the host browser measurements are recorded. This package
did not edit the spec because it is outside W28a's write set.
