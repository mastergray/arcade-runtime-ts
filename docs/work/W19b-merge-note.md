# W19b merge note — `midway-mcr`

Status: target and production artifact ready; F4–F6 browser evidence blocked
by the managed sandbox. The family compiles, exposes all 54 derived machines,
emits all 54 metadata files and passes the threading, typecheck and spec
gates. A lawful ignored preload config was supplied, but Chromium could not
create a page in this environment, so startup, pacing, geometry, non-blank
first-frame and sustained-speed measurements remain pending.

## Deliverables

- `mame/targets/midway-mcr.lua`: MCR-1/2/3 and MCR-68 units, Midway sound,
  the Williams CVSD unit, and their pinned CPU, sound, machine and bus cores.
- `mame/targets/midway-mcr.lst`: 54 public machines derived from the three
  named MAME 0.161 driver sources.
- `mame/builds/midway-mcr.json`: 4,096-page production build input.
- `docs/probes/families/midway-mcr.md`: F1–F6 record; F1–F3 are complete and
  F4–F6 name the exact Chromium blocker and follow-up measurements.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file was changed. No integrator-owned line is
needed. No ROM content, private machine identity, ROM file name, ROM hash or
absolute local path was added.

## Production artifact

The production pipeline completed with the pinned toolchain and a temporary
untracked SDK environment that directed only Emscripten's JavaScript compiler
from its bundled Node 8 to host Node 22:

```sh
/usr/bin/time -p env EMSDK_DIR="$W19B_EMSDK_WRAPPER" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 4
```

`W19B_EMSDK_WRAPPER` named the throwaway, untracked SDK environment described
above; its local absolute path is intentionally omitted.

```text
dist/mame/midway-mcr/
├── build.json                       2,335 bytes
├── mamemidway-mcr.js              302,961 bytes
├── mamemidway-mcr.wasm          6,305,176 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           54 files, 364,095 aggregate bytes
```

- Reused-source wall time: 30.68 seconds
- Machine count: 54
- Wasm bytes: 6,305,176
- buildId: `3259065f9c30a7140825db7909ebc874dd261ea75f28f95ab9559e45eae0c833`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,627,928 gzip-9 bytes and 1,220,386 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 1,114,118 bytes. Its
conservative 2,228,236-byte adapter estimate is 1.11% of the 201,326,592-byte
safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list matched the production `-listfull` count, so
no list correction was needed. The pinned `mame.lua` Midway project block
supplied all eight MCR driver/machine/video units and `audio/midway.c`.
MCR-68's CVSD configurations additionally require `audio/williams.c`, which
selects M6809, YM2151 and HC55516 alongside the Midway boards' Z80, M68000,
AY8910, TMS5220, samples and DAC support.

The first link exposed three machine-device cores configured by the MCR
boards but not pulled in by those compilation units: Z80CTC, Z80PIO and
Z80DART (which supplies Z80SIO0). Adding those selections resolved the link;
the final build completed without further target correction.

## Environment blockers and follow-up

The prescribed build command compiled the family but the SDK's bundled Node
8 rejected the pipeline's captured `emcc` stream as
`ERR_UNKNOWN_STREAM_TYPE`. A temporary untracked Emscripten configuration
using host Node 22 completed the identical pinned link and full metadata,
notice and threading pipeline. No tracked or shared SDK file was edited.

For the one supplied private preload config, the first frame did not arrive
because Chromium never created a page. The browser runner's loopback server
was denied with `listen EPERM`; a throwaway request-intercepted page avoided
the socket but Chromium then terminated because its process broker's
`shutdown` syscall was denied. On an unrestricted Chromium runner:

1. Confirm the real adapter delivers a non-blank first frame and record F4
   startup milliseconds.
2. Record native upright geometry and refresh plus 60/90/120/144 Hz pacing,
   each within 0.5%.
3. Record a 60-second desktop emulated-time ratio and the informational 4×
   CPU-throttled proxy ratio. The supplied set is not known to be the
   heaviest family member, so retain that qualification.

## Verification

- `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts midway-mcr --jobs 4`: family compilation passed; final `emcc` invocation blocked by bundled Node 8 `ERR_UNKNOWN_STREAM_TYPE` in this command runner.
- `/usr/bin/time -p env EMSDK_DIR="$W19B_EMSDK_WRAPPER" node --import tsx scripts/build-mame.ts midway-mcr --jobs 4`: passed in 30.68 seconds; 54 machines, 54 ROM-set metadata files, 6,305,176-byte Wasm. The variable named the temporary untracked SDK environment; its absolute path is omitted.
- `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts midway-mcr --jobs 4 --skip-build`: passed; completed metadata, notices, build identity and the built-in threading gate after the first recovered link.
- `npm run probe:mame:threading -- "$PWD/dist/mame/midway-mcr/mamemidway-mcr"`: passed; one fixed 4,096-page non-shared memory, no worker/runtime markers, no pthread requirement.
- `ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-mcr.json" ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-mcr.json" npm run test:browser`: environment-blocked before Chromium; 0 passed, 32 failed on `listen EPERM`, 27 skipped.
- `npm run check`: passed.
- `npm test`: 507 passed, 0 failed, 0 skipped.
