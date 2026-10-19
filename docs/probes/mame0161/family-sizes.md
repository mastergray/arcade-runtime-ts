# P3: driver-family WebAssembly sizes

Observed 2026-10-17 from the pinned Emscripten 1.38.31 probe builds.

## Measurement method

The table measures executable WebAssembly only. HTML, JavaScript and private
ROM `.data` payloads are excluded so the family comparison is independent of
the local fixture. Raw sizes use the filesystem byte count, gzip sizes use GNU
gzip 1.10 at level 9, and Brotli sizes use Node.js 22.22.2 with its bundled
Brotli 1.1.0 encoder at quality 11.

| Subset | Driver-list scope | Raw bytes | gzip -9 | Brotli 11 |
| ------ | ----------------- | --------: | -------: | ----------: |
| Bundled `tiny` | 25 runnable drivers | 6,487,485 | 1,671,277 | 1,257,309 |
| Irem M72 | Private two-entry parent/clone list | 5,194,430 | 1,447,955 | 1,093,247 |
| CPS-1 | Private single-entry list | 5,937,042 | 1,543,182 | 1,160,648 |
| Neo Geo | Private single-entry list | 5,943,328 | 1,546,255 | 1,162,658 |

The M72 build uses the same compiler, optimization, 256 MiB fixed-memory link
and exception-catching setting as the browser probe. Its generated JavaScript
contains no PThread loader or `SharedArrayBuffer` reference, and its Wasm
imports a fixed, non-shared 4,096-page memory. The CPS-1 and Neo Geo probes
have the same memory import and no threaded-loader marker. This extends the P6
result from the synthetic `tiny` subset to all three real driver-source probes.

The smaller M72 result is plausible despite being a real game-family build:
the bundled `tiny` target includes 25 drivers across multiple CPU and sound
cores, while this measurement selects only the cores needed by one hardware
family.

The tracked family definitions are `mame/targets/cps1.lua`,
`mame/targets/irem-m72.lua` and `mame/targets/neogeo.lua`. They select source
and device cores but contain no private machine or ROM identity. A local probe
supplies one representative machine at build time:

Create an ignored JSON config with the source, emsdk, representative machine,
tracked target path and generic output basename, then run:

```sh
npm run probe:mame:family -- "$PWD/res/mame-family-probe.json"
```

Each resulting module instantiated in Chromium and returned its generated
single-entry driver list without an emulator or page exception. P3 therefore
passes for representative driver-source subsets; expanding each list to every
clone in that source file is future release-size work, not an M0 feasibility
requirement.
