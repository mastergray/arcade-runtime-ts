# W27e merge note — `seta-2`

Status: production build complete; F4–F6 pending because this sandbox cannot
bind the browser test server. The target pair, metadata extraction, private
preload audit, threading gate, type checks and full spec suite pass. The
desktop performance gate remains open for the integrator to measure after
merge.

## Deliverables

- `mame/targets/seta-2.lua`: the pinned driver/video group, TMP68301 and
  ColdFire peripherals, M68000/ColdFire and H8 CPU paths, X1-010 and OKI
  M9810 sound paths, serial EEPROM, and the shared ticket-dispenser unit the
  complete public family list requires.
- `mame/targets/seta-2.lst`: 26 public machines derived from
  `drivers/seta2.c`.
- `mame/builds/seta-2.json`: 4,096-page production build input.
- `docs/probes/families/seta-2.md`: F1–F6 record, with F4–F6 explicitly
  pending the unavailable sandbox browser capability and MAME's own
  `GAME_IMPERFECT_GRAPHICS` flag distinguished from a port defect under F5.
- `tests/spec/04-mame-family-targets.test.ts`: one `FAMILY_TARGETS` row.
- `dist/mame/seta-2/`: the ignored production output described below.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No ROM content, private machine
identity, archive identity, ROM hash or resolved private path was added to a
tracked file.

## Production artifact

The prescribed first build compiled the complete source closure and reached
the final link in 113.00 seconds:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6
```

The pinned Node 8 JavaScript compiler then stopped with
`ERR_UNKNOWN_STREAM_TYPE` on the sandbox's captured stdio. Following the
earlier W27 packages, an ignored worktree-local `BASH_ENV` selects host Node
22 for Emscripten's JavaScript helpers only; the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline remain
unchanged.

The first host-Node link identified the shared ticket-dispenser dependency
described below. After that target correction, the compatibility build passed
in 35.07 seconds. A final run with the minimal host-Node config, after the
diagnostic options had been removed, passed in 73.40 seconds:

```sh
/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6
```

```text
dist/mame/seta-2/
├── build.json                       1,921 bytes
├── mameseta-2.js                  302,025 bytes
├── mameseta-2.wasm              6,197,937 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                           26 files, 187,134 aggregate bytes
```

- `.lst` and `-listfull` machine count: 26
- Wasm bytes: 6,197,937
- buildId: `2db7eb2a7d99f2f42a943cd42783e2263d7b513f29b944a8ea978ff88d0d4b94`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 6,197,937 | 1,564,179 | 1,175,055 |
| JavaScript | 302,025 | 65,565 | 55,274 |

F3 found a largest public metadata ROM sum of 39,845,888 bytes. Its
conservative two-copy estimate is 79,691,776 bytes, 39.58% of the
201,326,592-byte safe budget, leaving 121,634,816 bytes. Every family machine
therefore remains within 4,096 pages.

## Target findings and correction

The independent derivation found 26 public entries in `seta2.c`, exactly
matching production `-listfull`, so no list correction was needed. The pinned
Seta vendor block contributes exactly `drivers/seta2.c` and `video/seta2.c`.
The driver configures M68000/ColdFire and H8 CPU paths, X1-010 and OKI M9810
sound, TMP68301 and ColdFire peripherals, serial EEPROM, NVRAM and a ticket
dispenser across its complete public list.

The first host-Node link reported only the ticket-dispenser symbols as
undefined. Its implementation is in `machine/ticket.c` under the upstream
`mame.lua` general-components block rather than the Seta vendor block. Adding
that one shared unit resolved the link; no other driver, video or shared unit
was added.

## Browser evidence blocker

The ignored preload was audited without logging its private identity. Strict
and MAME-compatible policies both returned `ok`: one archive present, all 13
expected files valid, zero missing, wrong-size, wrong-CRC or optional-missing
entries, zero warnings and archive problems, and 17 harmless unexpected
entries.

The required real browser command was attempted:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-seta-2.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-seta-2.json" \
  npm run test:browser
```

It completed 0 passed, 32 failed and 25 skipped by design. Every runnable case
stopped at `listen EPERM: operation not permitted 127.0.0.1`, before Chromium
page creation. Consequently:

- F4 is pending; no first frame arrived and non-blank output is not confirmed.
- F5 is pending; geometry, refresh and controlled cadences were not observed.
  The configured entry carries `GAME_IMPERFECT_GRAPHICS` in MAME 0.161's
  `seta2.c`; that is the upstream emulator's flag, not a browser-port defect.
- F6 is pending; there is no measured desktop ratio, so the family cannot yet
  be classified as passing the desktop gate.

The configured driver also lacks `GAME_SUPPORTS_SAVE`. MAME 0.161 is expected
to decline the harness quick-save operation; if the host rerun reaches that
case, record it as the known M35 save-support limitation and move on.

The integrator should rerun the browser command above on a host that permits
Chromium and loopback, then copy only privacy-safe measurements into the
family probe.

## Verification

Commands and results, in execution order:

```sh
/usr/bin/time -p env EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6

/usr/bin/time -p env BASH_ENV="$PWD/.cache/w27e-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts seta-2 --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/seta-2/mameseta-2"

stat -c '%n %s' dist/mame/seta-2/mameseta-2.wasm \
  dist/mame/seta-2/mameseta-2.js dist/mame/seta-2/build.json
gzip -9 -c dist/mame/seta-2/mameseta-2.wasm | wc -c
gzip -9 -c dist/mame/seta-2/mameseta-2.js | wc -c

node --import tsx .cache/w27e-audit.ts

ARCADE_PRELOAD_CONFIG="$PWD/res/preload-seta-2.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-seta-2.json" \
  npm run test:browser

npm run check
npm test

npm run check && npm test
```

- First production build: compiled the family, then failed at the final link
  after 113.00 seconds with pinned Node 8 `ERR_UNKNOWN_STREAM_TYPE`.
- Host-Node compatibility diagnostics: the link exposed six undefined
  ticket-dispenser symbols; adding the one upstream shared unit resolved them.
- Corrected compatibility build: passed in 35.07 seconds; the final minimal
  compatibility rerun passed in 73.40 seconds with 26 machines and 26 metadata
  files.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- F3 metadata reduction: 39,845,888-byte largest ROM sum; the conservative
  estimate fits the safe budget.
- Privacy-safe preload audit: both policies returned `ok` with all 13 expected
  files valid.
- Browser suite: blocked by sandbox loopback policy; 0 passed, 32 failed and
  25 skipped by design, so F4–F6 remain pending.
- `npm run check`: passed (`check:src` and `check:tests`).
- `npm test`: 30 files, 554 cases; 554 passed, 0 failed, 0 skipped. The real
  new output was present and passed `tests/spec/32-build-output.test.ts`.
- Final combined `npm run check && npm test`: passed with the same 554/554
  spec result.
- The first attempt to commit this merge note was refused when the sandbox
  reported the shared worktree metadata's `index.lock` path as a read-only
  filesystem. Earlier package commits succeeded; the command was retried
  after recording the refusal here as the package instructions require.

## Integrator note

The integrator-owned specification remains stale: §4.6 should add the
`seta-2` family after the host F6 decision, naming `seta2.c`, its driver/video
units, the M68000/ColdFire and H8 paths, TMP68301, X1-010, OKI M9810 and the
shared ticket-dispenser dependency. This package did not edit the spec because
it is outside W27e's write set.

## Integrator notes

The first host gate run aborted at start-up: MAME ran out of memory in the
4,096-page heap although the metadata-only F3 estimate said the largest set
fits. The driver decodes its 8-bit sprite data into gfx elements at boot,
which that estimate does not count. `memoryPages` raised to 8,192 (as `cps2`
and `neogeo`) and the family rebuilt; the probe record's F3 says so.

Two further gate runs (2026-10-23, host load average about 5): 31 passed,
1 failed, 25 skipped by design each time. F6 0.9806 and 0.9932 over 60 s,
inside the 2 % tolerance, so the family ships; F4 802 ms and 876 ms; the
cadence case missed one rate per run (60 Hz −1.47 %, then 144 Hz −4.47 %)
with the others inside 1 %; audio queue peak 109 ms and 97 ms; quick save,
coin, start and two pads passed.
