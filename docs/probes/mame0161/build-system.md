# P2/P3: browser build-system findings

Status: P2 passed for the `tiny` subtarget; P3 family measurements continue.

## Stock browser target

MAME 0.161 already contains an Emscripten-specific build path. The root
makefile's `asmjs` target:

1. requires an `EMSCRIPTEN` environment variable;
2. generates GNU Make projects with
   `--gcc=asmjs --gcc_version=4.8 gmake`;
3. calls `$(EMSCRIPTEN)/emcc`, `em++` and `emar` directly; and
4. post-links the native-looking target with:

   ```sh
   emcc -O2 -s TOTAL_MEMORY=268435456 "$TARGET" -o "$TARGET.html"
   ```

The unmodified target was written for the 2015 Fastcomp/asm.js toolchain. Its
name and original output contract do not prove WebAssembly viability: WebAssembly
did not yet exist as a shipping MAME 0.161 build target. A successful M0 result
must emit and run an actual `.wasm`, not merely the stock asm.js output.

## Selected toolchain

Emscripten `1.38.31` Fastcomp is the first tested and pinned compatibility
toolchain. The exact compiler identity is:

```text
emcc 1.38.31
commit 5dd09e4893d434b7ed9c1c5e90dd769dcfc245e5
Python 2.7.18
SDK Node v8.9.1
```

The pin is committed in [`mame/EMSDK_VERSION`](../../../mame/EMSDK_VERSION).
The current upstream-backend SDK remains a future migration option, not part of
the 0.161 build contract.

Official Emscripten documentation records that the output format is selected
at link time, that current Emscripten emits WebAssembly by default, and that
1.39.0 was the upstream-backend transition. The historical
[`settings.py` record](https://github.com/emscripten-core/emscripten/blob/main/tools/settings.py)
states that 1.38.23 made Wasm the default/required binary output unless
`WASM=0` is selected. The SDK's
[installation documentation](https://github.com/emscripten-core/emsdk#how-do-i-install-an-old-emscripten-compiler-version)
documents its archived-version support.

## Subset mechanism

The modern `SOURCES=<driver files>` command shape in the runtime spec does not
apply directly to 0.161. A family is defined by two files:

- `scripts/target/mame/<family>.lua` selects CPU, sound, machine and bus cores
  and lists the C/C++ compilation units;
- `src/mame/<family>.lst` lists the exposed driver names used to generate the
  driver table.

The bundled `tiny` pair proves that the release can generate and run a subset
without editing it in place. CPS-1, Irem M72 and Neo Geo each need their own
audited pair before the remaining P3 size measurements are meaningful.

## Required compatibility patch

[`0001-emscripten-1.38.31-compatibility.patch`](../../../mame/probes/patches/0001-emscripten-1.38.31-compatibility.patch)
contains the pinned-toolchain compatibility changes. It:

- removes hard-coded legacy system include paths that override 1.38.31's
  libc/libc++ include order;
- selects Emscripten's SDL2 port at compile and link time and avoids native
  SDL_ttf, fontconfig, `sdl2-config` and `libutil` dependencies;
- disables Lua POSIX helpers and Mongoose's native thread/popen paths for the
  browser target;
- avoids launching the optional Lua console listener thread;
- initializes and validates the web upload parser's output variables;
- returns success from the JavaScript sound module's `init` method; and
- disables MAME's diagnostic allocation tracker for this target while keeping
  its explicit allocation paths untracked. This prevents Fastcomp from mixing
  inline tracked deletes with libc++ allocations.

[`0005-emscripten-disable-mongoose.patch`](../../../mame/probes/patches/0005-emscripten-disable-mongoose.patch)
then removes MAME's unused internal HTTP/WebSocket server from browser builds.
It substitutes a no-op `web_engine`, omits the Mongoose archive from the asmjs
link and leaves native builds unchanged. The browser runtime owns its own
bridge and does not support MAME's `-http` feature.

Two consecutive incremental probe builds completed after this patch. The
generated `mametiny` dependency list contains no Mongoose archive, `llvm-nm`
finds no `mg_*` or `ns_*` symbols in `mametiny.bc`, and the maintained CTG
browser startup/static-hosting cases both pass against the resulting module.

The generated GNU Make project does not retain the stock post-build command,
so the reproducible probe script performs the final `emcc` link explicitly.
Real-game probe links also include Emscripten's `idbfs.js` library for the P8
persistence round trip. The game-only
[`0006-emscripten-persistence-probe.patch`](../../../mame/probes/patches/0006-emscripten-persistence-probe.patch)
is applied after the P7 bridge-hook layer and removed before ROM-free list or
family builds.

The game-only
[`0007-emscripten-video-probe.patch`](../../../mame/probes/patches/0007-emscripten-video-probe.patch)
is then applied for P9. Because the P8 and P9 probe patches use minimal
context to keep the tracked patch artifacts whitespace-clean, the build script
checks their unique declarations before applying them; consecutive builds do
not duplicate either layer.

## Clean build result

The successful clean run used two make jobs and a warmed SDK/SDL port cache:

```sh
EMSDK_DIR="$PWD/res/emsdk" npm run probe:mame:tiny -- \
  "$PWD/.cache/mame0161-source"
```

Measured results on the host in [environment.md](environment.md):

| Phase | Wall time | Peak RSS |
| ----- | --------- | -------- |
| Source compile and bitcode link | 2:59.60 | 370,256 KiB |
| Final optimized WebAssembly link | 0:33.82 | 895,632 KiB |

The source/intermediate tree used 76 MiB under `build/asmjs`. These figures
make a cached single-family CI job practical; emsdk/port bootstrap time and
storage still need a cold CI measurement.

## Artifact and browser result

| Artifact | Bytes |
| -------- | ----: |
| `mametiny.bc` intermediate | 21,728,128 |
| `mametiny-probe.html` shell | 93,722 |
| `mametiny-probe.js` loader | 284,902 |
| `mametiny-probe.wasm` | 6,487,485 |
| `mametiny-probe.wasm` gzip -9 | 1,671,277 |
| `mametiny-probe.wasm` Brotli 11 | 1,257,309 |

Node.js's bundled Brotli 1.1.0 encoder supplied the quality-11 measurement.
The Irem M72 family measurement and exact compression method are recorded in
[family-sizes.md](family-sizes.md).

The probe pre-JavaScript supplies `-listfull`, a deterministic ROM-free MAME
path. Chromium loaded the generated shell over ordinary localhost HTTP,
instantiated the module, printed the 0.161 tiny driver list (including
`carpolo` and `wrally`) and produced no emulator console or page exceptions.
(The generic generated shell requests an absent favicon.) The same check is
represented by the `ctg-js-browser-test` case in
`tests/browser/00-mame-tiny-probe.test.ts`.

The Wasm imports 4,096 fixed pages (256 MiB) as non-shared memory. Its text
form has no atomic instructions, and its JavaScript has no `SharedArrayBuffer`
or PThread loader. Thus the tiny proof does not require pthreads, COOP or COEP.

## Remaining build questions

- The stock post-link fixes linear memory at 256 MiB. The final runtime wants
  growth when compatible, so memory behavior must be measured before changing
  this flag.
- `src/emu/machine.c` advances the scheduler by exactly 1/60 second on each
  browser callback and registers an Emscripten main loop with browser-selected
  cadence. That is a P5 risk for 59.6 Hz games and high-refresh displays.
- `src/osd/modules/sound/js_sound.c` forwards the mixed buffer and stereo-frame
  count to JavaScript functions supplied by the future bridge. The later P10
  browser probe confirms 48 kHz signed-16, interleaved left/right audio in
  exact 960-frame updates; see [bridge-hooks.md](bridge-hooks.md).
- The fixed 256 MiB memory is sufficient for `tiny`; family builds must measure
  their own peak and determine whether growth is compatible.
- The 0.161 scripts default to `python`; this host needs
  `PYTHON_EXECUTABLE=python2` for the release-era generators.

P3 now has purpose-built CPS-1, Irem M72 and Neo Geo subset definitions plus
raw/gzip/Brotli measurements. P4–P12 require the real bridge and the private
local fixture; successful `-listfull` startup is not game parity.
