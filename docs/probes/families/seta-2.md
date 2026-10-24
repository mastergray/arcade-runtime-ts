# Seta 2 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is available for the browser probes;
no private machine identity, archive identity, hash or path is recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`seta-2.lua`](../../../mame/targets/seta-2.lua) and
[`seta-2.lst`](../../../mame/targets/seta-2.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 4,096-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/seta-2/mameseta-2"
```

| Result | Initial compile to first link | Final cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | ---------------------------: | -------------------: | ---------------------: |
| Pass | 113.00 s | 73.40 s | 26 | 26 |

The independently derived list contains 26 machines from `drivers/seta2.c`
and matched the production count without a list correction. The pinned Seta
vendor block contributes exactly `drivers/seta2.c` and `video/seta2.c`. The
target selects the M68000/ColdFire and H8 CPU paths, X1-010 and OKI M9810
sound cores, TMP68301 and ColdFire peripheral devices, and serial EEPROM.

The first complete host-Node link found that one public machine configured by
`seta2.c` also references MAME's shared ticket-dispenser implementation. That
unit lives in the upstream `mame.lua` general-components block rather than the
Seta vendor block. Adding only `machine/ticket.c` resolved every undefined
symbol; no other driver, video or shared unit was added.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helpers to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.
The resulting build identity is
`2db7eb2a7d99f2f42a943cd42783e2263d7b513f29b944a8ea978ff88d0d4b94`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,197,937 | 1,564,179 | 1,175,055 |
| JavaScript | 302,025 | 65,565 | 55,274 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 39,845,888 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
79,691,776 bytes, 39.58% of the safe budget, leaving 121,634,816 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

F4 pending: the lawful ignored preload audits successfully, but this sandbox
rejects the harness server's loopback bind with `listen EPERM` before Chromium
page creation. No first frame arrived, so startup time and non-blank output
remain for the integrator to measure on the host.

## F5 — Are native refresh and upright geometry correct?

F5 pending: the same loopback restriction prevented observing geometry,
orientation, native refresh or controlled 60/90/120/144 Hz cadences. The
configured entry carries `GAME_IMPERFECT_GRAPHICS` in MAME 0.161's
`drivers/seta2.c`; this is MAME's own upstream flag, not a browser-port defect.

## F6 — Does the heaviest board sustain full speed?

F6 pending: the same loopback restriction prevented the required 60-second
desktop measurement, so no sustained emulated-time ratio is available. The
4× CPU-throttled mobile proxy also remains pending and is informational.

The configured driver has no `GAME_SUPPORTS_SAVE` flag. MAME 0.161 is therefore
expected to decline the harness quick-save operation; if the host browser run
reaches that case, record it as the known M35 save-support limitation and move
on rather than treating it as a family-port defect.

The ignored preload was audited without logging its identity. Strict and
MAME-compatible policies both returned `ok`: one archive present, all 13
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 17 harmless unexpected
entries.

Run F4–F6 without disclosing the private selection:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-seta-2.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-seta-2.json" \
  npm run test:browser
```

The sandbox attempt completed 0 passed, 32 failed and 25 skipped by design;
every runnable case stopped at `listen EPERM: operation not permitted
127.0.0.1` before Chromium page creation.
