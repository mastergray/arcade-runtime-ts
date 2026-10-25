# W31c merge note — `taito-f3` extension

Status: production build complete; F1–F3 measured. F4–F6 are pending because
this sandbox cannot bind loopback sockets or run Chromium. The target pair,
metadata extraction, threading gate, type checks and full spec suite pass.
The integrator must run the supplied ignored preload on an unrestricted host
to close startup, display and sustained-speed evidence.

## Deliverables

- `mame/targets/taito-f3.lua`: adds `drivers/superchs.c`,
  `video/superchs.c`, `video/tc0480scp.c` and the latter's shared
  `video/taito_helper.c` dependency to the existing F3/Ensoniq target.
- `mame/targets/taito-f3.lst`: 94 public machines derived from
  `drivers/taito_f3.c` and `drivers/superchs.c`.
- `mame/builds/taito-f3.json`: 8,192-page production input for the added
  board's startup-decoded 8 MiB sprite region.
- `docs/probes/families/taito-f3.md`: refreshed F1–F3 measurements, F4–F6
  pending instructions, F11 analogue facts, W29 coded-key and save-capability
  facts, and artwork-layout behavior.
- `tests/spec/04-mame-family-targets.test.ts`: the existing row extended to
  the second driver source and a 94-machine expectation.
- `dist/mame/taito-f3/`: ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
specification section or other family's file changed. No ROM content, private
machine identity, archive identity, ROM hash or resolved private path was
added to a tracked file.

## Production artifact

The exact pre-extension target on this branch built successfully first. It
completed in 170.91 seconds with 90 machines and produced a 5,770,347-byte
Wasm with build ID
`e03d0a3f8f6a0cfe88e613735f36889454e45d39a287bef29c778c33ca31a039`.

The first extension link exposed one dependency hidden behind the broad
upstream Taito vendor block: `video/tc0480scp.c` calls the scanline helper in
`video/taito_helper.c`. Adding that one shared unit resolved the sole
undefined symbol. The corrected cached-source production pipeline completed
in 44.86 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4
```

Bulk XML enumeration aborted out of memory as expected for this family, whose
Ensoniq device embeds a 64 MiB DRAM array in every retained configuration.
The production pipeline used its per-machine fallback and emitted complete
metadata.

```text
dist/mame/taito-f3/
├── build.json                       3,029 bytes
├── mametaito-f3.js                302,027 bytes
├── mametaito-f3.wasm            5,822,132 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           94 files, 493,132 aggregate bytes
```

- `.lst` and `-listfull` machine count: 94
- Wasm before extension: 5,770,347 bytes
- Wasm after extension: 5,822,132 bytes
- Wasm increase: 51,785 bytes
- buildId: `f231ac18aa4e07c0c9316d8882c8985f35d52556077b47f2ebff7ba98f9e0d6e`
- Memory: fixed 8,192 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,822,132 | 1,553,123 | 1,171,941 |
| JavaScript | 302,027 | 65,567 | 55,376 |

## F3 and target findings

The independently derived union contains 94 public entries and exactly
matches production `-listfull`. The existing M680X0 and Ensoniq target already
provided the two 68k-family CPU paths, ES5510/ES5505 sound, serial EEPROM,
MC68681 and MB87078. Only the four source units described above were needed;
no selectable core was added.

The largest public metadata ROM sum remains 41,943,040 bytes. Its conservative
two-copy estimate is 83,886,080 bytes, 20.83% of the 402,653,184-byte safe
budget at 8,192 pages, leaving 318,767,104 bytes. No machine fails the §5
metadata estimate.

The larger heap is still required: the added driver declares an 8 MiB sprite
region and decodes its 4-bit layout into live gfx elements at startup while
retaining the source region. That hidden expansion is not represented by the
two-copy metadata estimate. The host browser run must confirm live startup,
but the family is deliberately not shipped at 4,096 pages.

The added driver declares full-range player-1 `IPT_PADDLE` and `IPT_PEDAL`
ports. W26 binds them to X/RX axes with hat and button fallbacks. It has no
`PORT_CODE` fields, so `inputs.keys` is empty, and its declarations omit
`GAME_SUPPORTS_SAVE`, so `supportsSave` is false. Its entries carry an artwork
layout through `GAMEL`; the runtime bridge ignores the layout and presents
the first emulated screen.

## Browser evidence pending

The ignored preload config is present, but this sandbox cannot bind the test
server's loopback socket or launch Chromium. Per the package instructions the
browser suite was not attempted here. Consequently:

- F4 is pending; no startup time or non-blank first frame is claimed.
- F5 is pending; geometry, refresh and controlled-cadence rates are not
  measured. The host result must describe the first screen, not the ignored
  artwork layout.
- F6 is pending; no 60-second desktop ratio exists yet.
- Live confirmation of the 8,192-page heap and the expected save-state
  refusal is also pending.

The integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-superchs.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-superchs.json" \
  npm run test:browser
```

Only privacy-safe timing, geometry, cadence, ratio, input and capability
results should be copied into the family probe.

## Verification

Material commands and results, in execution order:

```sh
# Exact 90-machine baseline.
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

# Initial extension build and one unchanged retry.
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

# Link-stage diagnostic through the same pipeline.
EMCC_DEBUG=2 BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

# Direct diagnostic relink of the newly built bitcode at the old heap size.
env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" bash -c \
  'source "$EMSDK_DIR/emsdk_env.sh" >/dev/null && cd "$1" && \
   emcc -O2 -s WASM=1 -s USE_SDL=2 -s MODULARIZE=1 \
   -s EXPORT_NAME="createMame" -s TOTAL_MEMORY=268435456 \
   -s ALLOW_MEMORY_GROWTH=0 -s NO_EXIT_RUNTIME=1 \
   -s DISABLE_EXCEPTION_CATCHING=0 -s USE_PTHREADS=0 \
   -s '\''EXTRA_EXPORTED_RUNTIME_METHODS=["FS","callMain","cwrap","ccall","UTF8ToString","HEAPU8","HEAPF32"]'\'' \
   -s '\''EXPORTED_FUNCTIONS=["_main","_web_run_frames","_web_pump","_web_set_control","_web_set_axis","_web_pause","_web_resume","_web_reset","_web_save_state","_web_load_state","_web_flush_nvram","_web_exit","_web_machine_info"]'\'' \
   mametaito-f3.bc -o "$2/.cache/w31c-4096.js"' \
  _ "$PWD/.cache/mame/mame0161" "$PWD"

# Corrected production build.
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w29-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts taito-f3 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/taito-f3/mametaito-f3"

stat -c '%n %s' dist/mame/taito-f3/mametaito-f3.wasm \
  dist/mame/taito-f3/mametaito-f3.js dist/mame/taito-f3/build.json

gzip -9 -c dist/mame/taito-f3/mametaito-f3.wasm | wc -c
gzip -9 -c dist/mame/taito-f3/mametaito-f3.js | wc -c

node -e 'const fs=require("fs"),z=require("zlib"); for(const f of ["dist/mame/taito-f3/mametaito-f3.wasm","dist/mame/taito-f3/mametaito-f3.js"]){const b=fs.readFileSync(f); console.log(f,z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11}}).length)}'

node -e 'const fs=require("fs"),p="dist/mame/taito-f3/romsets"; let max=0,total=0,count=0; for(const f of fs.readdirSync(p)){if(!f.endsWith(".json"))continue; const j=JSON.parse(fs.readFileSync(p+"/"+f)); const sum=(j.roms??[]).reduce((n,r)=>n+r.size,0); if(sum>max)max=sum; total+=sum; count++;} console.log({count,max,total});'

npm run check && npm test
```

- Baseline build: passed in 170.91 seconds with 90 machines, 90 metadata
  files and a 5,770,347-byte Wasm.
- Initial extension build: source compilation completed, then the link failed
  after 33.38 seconds. The unchanged retry failed at the same stage after
  22.07 seconds.
- Diagnostic pipeline run: confirmed failure inside `compiler.js`; the direct
  4,096-page relink then reported exactly one undefined Taito scanline-helper
  symbol. No compiler flag or pipeline code changed.
- Corrected production build: passed in 44.86 seconds with 94 machines and 94
  metadata files after the expected per-machine XML fallback.
- Explicit threading inspection: passed with one fixed 8,192-page non-shared
  memory and no worker or pthread markers.
- Raw, gzip and Brotli measurements: produced the values recorded above.
- F3 metadata reduction: 94 files, 41,943,040-byte maximum ROM sum.
- `npm run check`: passed both TypeScript projects.
- `npm test`: 30 files, 576 cases; 576 passed, 0 failed, 0 skipped. The real
  family output was present and passed build-output validation.
- Browser suite: deliberately not run because the stated sandbox restriction
  prevents the required server and browser; F4–F6 remain pending.
- The first merge-note commit attempt was refused with `Read-only file system`
  while Git tried to create the shared worktree `index.lock`. The earlier
  implementation commit succeeded; no tracked content was lost or reverted.

## Integrator note

The integrator-owned §4.6 matrix is stale for this extension. After the host
browser run, update the `taito-f3` row with `drivers/superchs.c`,
`video/superchs.c`, `video/tc0480scp.c`, `video/taito_helper.c`, the 94-machine
count, 8,192-page decoded-sprite rationale, analogue controls, ignored artwork
layout and save-state capability. This package did not edit the specification
because it is outside W31c's write set.
