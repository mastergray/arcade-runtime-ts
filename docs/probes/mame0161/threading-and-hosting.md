# P6: threading and static hosting

Status: passed. Direct MAME 0.161 builds set `pthreads: false` and need no
cross-origin isolation headers.

Observed 2026-10-18 with the pinned Emscripten 1.38.31 toolchain. No private
machine or ROM identity is part of this evidence.

## Artifact inspection

[`inspect-mame-threading.ts`](../../../scripts/inspect-mame-threading.ts)
parses each WebAssembly binary's memory declarations directly and checks its
matching JavaScript and output directory for Emscripten thread-runtime
signals. Run it against any generated artifact stems:

```sh
npm run probe:mame:threading -- \
  "$PWD/.cache/mame0161-source/mametiny-probe" \
  "$PWD/.cache/mame0161-source/mamefamily-cps1" \
  "$PWD/.cache/mame0161-source/mamefamily-neogeo"
```

The command exits non-zero if it finds a shared memory, a PThread loader
marker or a sibling worker artifact. Lowercase libc symbols such as
`pthread_create` are not treated as evidence by themselves: the non-threaded
Emscripten library supplies compatibility stubs, including a create stub that
returns an unsupported-operation error.

| Build scope | Memory declaration | Shared | Thread-runtime markers | Worker artifact | Requires pthreads |
| ----------- | ------------------ | :----: | :--------------------: | :-------------: | :----------------: |
| Bundled `tiny` | imported `env.memory`, 4,096-page minimum and maximum | No | None | No | No |
| CPS-1 family | imported `env.memory`, 4,096-page minimum and maximum | No | None | No | No |
| Irem M72 family | imported `env.memory`, 4,096-page minimum and maximum | No | None | No | No |
| Neo Geo family | imported `env.memory`, 4,096-page minimum and maximum | No | None | No | No |
| Private real-game probe | imported `env.memory`, 4,096-page minimum and maximum | No | None | No | No |

The current inspector rerun covered `tiny`, CPS-1, Neo Geo and the generic
real-game artifact. The M72 artifact had already received the identical
binary/loader inspection during P3 and its result is retained in
[family-sizes.md](family-sizes.md). A fixed 4,096-page memory is 256 MiB. More
importantly for P6, its WebAssembly limits flags have the shared bit clear.
Atomic Wasm instructions therefore cannot be used by these valid modules.

## Browser proof without isolation

The ROM-free `tiny` shell and Wasm were served by Python's ordinary static
HTTP server. Its responses had the correct `application/wasm` media type but
neither `Cross-Origin-Opener-Policy` nor
`Cross-Origin-Embedder-Policy` headers.

[`05-mame-static-hosting-probe.test.ts`](../../../tests/browser/05-mame-static-hosting-probe.test.ts)
verified all of the following in Chromium:

- `crossOriginIsolated` was false;
- `SharedArrayBuffer` was unavailable;
- a same-page fetch observed no COOP or COEP response headers; and
- the MAME module instantiated and completed its ROM-free command without an
  exception.

Reproduce that case with:

```sh
python3 -m http.server 8877 --directory "$PWD/.cache/mame0161-source"
MAME_THREADING_PROBE_URL=http://127.0.0.1:8877/mametiny-probe.html \
  npm run test:browser
```

## Decision

Every direct MAME 0.161 family `build.json` records `pthreads: false`.
Deployments can use an ordinary static host and do not need COOP, COEP,
`SharedArrayBuffer` or a worker loader. The host still serves Wasm as
`application/wasm`. Browser secure-context restrictions for unrelated APIs,
such as gamepads over plain LAN HTTP, remain a shell concern rather than an
emulator-threading requirement.

The threading inspector is a build gate, not a permanent assumption. A future
toolchain, source release or changed linker configuration must be measured
again; a shared-memory result changes both `build.json` and the deployment
header requirements.
