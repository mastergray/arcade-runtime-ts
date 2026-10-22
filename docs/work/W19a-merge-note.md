# W19a merge note — `sega-16`

Status: blocked on required browser evidence. The production family build,
metadata extraction and threading checks pass, but this sandbox permits neither
the browser test server nor Chromium's host socket setup. F4–F6 and the required
non-blank first-frame confirmation therefore remain pending even though the
lawful ignored preload config was present and used for both attempted paths.

## Deliverables

- `mame/targets/sega-16.lua`: the three pinned Sega driver/video groups, common
  Sega IC, road and sprite units, and FD1089/FD1094 decryption units.
- `mame/targets/sega-16.lst`: 52 public machines derived from the three named
  MAME 0.161 driver sources.
- `mame/builds/sega-16.json`: 4,096-page production build input.
- `docs/probes/families/sega-16.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable sandbox browser capability.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.

No runtime source, build script, production patch, package file, spec section
or other family's files were changed. No integrator-owned line is needed. No
ROM content, private ROM identity, ROM hash or local path was added.

## Production artifact

The prescribed clean-source command unpacked and compiled the family, then met
a host-only link-runner incompatibility:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 4
```

The pinned Node.js 8 JavaScript compiler could not classify the modern parent
process's captured stdio (`ERR_UNKNOWN_STREAM_TYPE`). With an ignored
process-local `BASH_ENV` selecting host Node.js 22 for that compiler only, the
same pipeline completed without a tracked toolchain or pipeline edit:

```sh
BASH_ENV="$PWD/.cache/sega16-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 4
```

```text
dist/mame/sega-16/
├── build.json                       2,308 bytes
├── mamesega-16.js                 302,503 bytes
├── mamesega-16.wasm             6,190,516 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           52 files, 771,097 aggregate bytes
```

- Initial source-unpack compile: 122.8 seconds to the link
- Successful cached-source production pipeline: 30.0 seconds
- Machine count: 52
- Wasm bytes: 6,190,516
- buildId: `0f443d21f78a39e54e27c58779147709c6f769952178ce2aed969a8634075e4a`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

F2 measured the Wasm at 1,613,697 gzip-9 bytes and 1,210,027 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 3,874,816 bytes. Its
conservative 7,749,632-byte adapter estimate is 3.85% of the
201,326,592-byte safe budget, so no machine requires more than 4,096 pages.

## Target findings and corrections

The independently derived list matched the production `-listfull` count, so no
list correction was needed. The source block and the selected drivers require
Z80, MCS51 and M68000 CPU cores; YM2151, YM2203 and SegaPCM sound cores; I8255;
the three driver/video pairs; the common Sega IC, road and sprite units; and the
FD1089/FD1094 decryption units. The target also carries the harmless Centronics
core required to keep the release-era bus archive non-empty. The first complete
link reported no missing family unit or core.

## Browser evidence blocker

The ignored preload config was available and was supplied without logging its
machine or file identities. The repository family-measurement and real-adapter
mechanics stopped at `listen EPERM` when their shared page server attempted to
bind loopback. A throwaway server-free route-interception probe then stopped
before page creation because Chromium's sandbox host received `Operation not
permitted` while setting up its socket. Consequently:

- a first frame did not arrive in this environment;
- non-blank output is not yet confirmed;
- F4 startup time, F5 geometry/cadences and F6 sustained ratio are pending.

The integrator should run on a host that permits Chromium and loopback:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-16.json" \
  npm run test:browser
```

Then copy only the privacy-safe measurements into the family record. Do not
record the configured machine, file names, hashes or resolved paths.

## Verification

```sh
BASH_ENV="$PWD/.cache/sega16-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 4
npm run probe:mame:threading -- "$PWD/dist/mame/sega-16/mamesega-16"
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-16.json" npm run test:browser
npm run check
npm test
```

- Production family build with the ignored host-Node compatibility environment:
  passed; 52 machines and 52 ROM-set metadata files
- Explicit threading inspection: passed
- `npm run test:browser`: 0 passed, 32 failed, 27 skipped; every failure
  stopped at the sandbox's loopback `listen EPERM` before Chromium page work
- `npm run check`: passed
- `npm test`: 507 passed, 0 failed, 0 skipped
