# W27f merge note — `sega-16` Y Board extension

Status: production build complete; F4–F6 for `segaybd.c` are pending because
this sandbox cannot bind the browser test server. The extended target pair,
metadata extraction, preload audit, threading gate, type checks and full spec
suite pass. The driver remains in the branch for the integrator to measure and
decide with the user after the desktop F6 ratio is available.

## Deliverables

- `mame/targets/sega-16.lua`: adds the `segaybd.c` driver/video pair and the
  MB8421 dual-port RAM core to the existing Sega 16-bit target.
- `mame/targets/sega-16.lst`: derives from all four driver sources and contains
  66 public machines, including 14 from `segaybd.c`.
- `mame/builds/sega-16.json`: records both added source units and retains the
  evidence-backed 4,096-page memory setting.
- `docs/probes/families/sega-16.md`: replaces F1–F3 with whole-family evidence,
  records the new-driver F4–F6 browser blocker, preserves earlier-driver
  measurements, and expands F11 by `segaybd.c` port type.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to four
  driver sources and 66 expected machines.
- `dist/mame/sega-16/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact and download growth

The prescribed source-unpack build compiled the complete family and reached
the final link in 108.36 seconds, where the pinned Node 8 JavaScript compiler
stopped with `ERR_UNKNOWN_STREAM_TYPE` on captured standard streams. An ignored
worktree-local `BASH_ENV` configuration then selected host Node 22 for the
Emscripten JavaScript helpers only; the pinned C/C++ compiler, native optimizer,
Binaryen, source, flags and production pipeline remained unchanged. The final
successful cached-source pipeline completed in 34.74 seconds.

```text
dist/mame/sega-16/
├── build.json                       2,520 bytes
├── mamesega-16.js                 302,617 bytes
├── mamesega-16.wasm             6,272,886 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           66 files, 1,085,311 aggregate bytes
```

- `.lst` and `-listfull` machine count: 66
- buildId: `f253fd7fd4fc2b997dddaf825db5564f5f26a1e54051e30dc9f3b2306901063b`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,190,516 | 1,613,697 | 1,210,027 |
| After extension | 6,272,886 | 1,636,916 | 1,227,984 |
| Increase | 82,370 (1.33%) | 23,219 (1.44%) | 17,957 (1.48%) |

This family download grows for every title already in `sega-16`, not only
boards from `segaybd.c`. The integrator must decide with the user whether the
82,370-byte raw / 17,957-byte Brotli-11 increase is acceptable after also
considering the pending F6 desktop result.

The JavaScript artifact is 302,617 raw, 65,617 gzip-9 and 55,364 Brotli-11
bytes. F3 found a largest public metadata ROM sum of 21,561,344 bytes in
`segaybd.c`. Its conservative two-copy estimate is 43,122,688 bytes, 21.42% of
the 201,326,592-byte safe budget, so every family machine remains within 4,096
pages.

## Target findings

The independent derivation found 11 machines from `segahang.c`, 17 from
`segaorun.c`, 24 from `segaxbd.c` and 14 from `segaybd.c`. The 66-entry result
matched production `-listfull`, so no list correction was needed.

The added board configures three 68000s and a Z80 with YM2151 and SegaPCM. All
of those selectable cores were already present. Its 315-5248 multiplier and
315-5249 divider implementations are part of the existing
`machine/segaic16.c` unit; its System 16B and Y Board sprite devices are part
of the existing `video/sega16sp.c` unit. The linked-cabinet configuration also
uses MB8421 dual-port RAM, which is the one selectable machine core added to
the target. The first complete link reported no further undefined unit or core.

Source inspection for F11 records `segaybd.c` AD-stick X/Y/Z ranges,
sensitivity, key delta and reverse attributes, plus its paddle, two pedal and
light-gun port declarations. W26 already supplies the standard and digital-ramp
bindings for the AD-stick, paddle and pedal types, so no TypeScript change was
made. Light-gun ports remain source coverage only and outside W26's gamepad
mapping.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 47
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and nine harmless unexpected
entries.

The required real browser command was attempted and completed 0 passed, 32
failed and 25 skipped. Every runnable case stopped at
`listen EPERM: operation not permitted 127.0.0.1` before Chromium page
creation. Consequently, for `segaybd.c`:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; native geometry, refresh and controlled cadences were not
  observed.
- F6 is pending; there is no measured desktop ratio, so the performance gate
  and the driver's final family membership remain open.

On a host that permits loopback and Chromium, the integrator should run:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-16.json" \
  npm run test:browser
```

Copy only privacy-safe measurements into the family probe. If the desktop F6
ratio misses the gate, record that ratio plainly and decide with the user
whether to retain the extension.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 6

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27f-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts sega-16 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/sega-16/mamesega-16"

gzip -9 -c dist/mame/sega-16/mamesega-16.wasm | wc -c
gzip -9 -c dist/mame/sega-16/mamesega-16.js | wc -c

node --import tsx .cache/w27f-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-sega-16.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-sega-16.json" \
  npm run test:browser

npm run check
npm test
```

- First production build: compiled the complete family, then failed at the
  final link after 108.36 seconds with pinned Node 8
  `ERR_UNKNOWN_STREAM_TYPE`.
- First compatibility refinement: the same timed command stopped after 1.41
  seconds when the narrow wrapper let Node 8 run the captured sanity helper.
- Second compatibility refinement: the same timed command passed
  `compiler.js`, then stopped after 34.42 seconds when Node 8 ran the captured
  Acorn optimizer.
- Final compatibility build: passed in 34.74 seconds with 66 machines and 66
  metadata files after host Node was selected for all Emscripten JavaScript
  helpers.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 21,561,344-byte largest ROM sum; the conservative
  estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 47 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 552 cases; 552 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.

The first `git add ... && git commit ...` attempt was refused because Git
could not create the shared worktree index lock on a temporarily read-only
filesystem. A later retry succeeded as commit `db38250`. A subsequent
message-format amend was refused by the same index-lock condition; no content
change was attempted or lost.

## Integrator note

The integrator-owned specification remains stale: §4.6's `sega-16` row should
add `drivers/segaybd.c`, `video/segaybd.c`, three 68000s and MB8421 to its
scope, and should describe the pending F6 retention decision. This package did
not edit the spec because it is outside W27f's write set.
