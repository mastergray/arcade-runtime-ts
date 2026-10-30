# W33 merge note — `gradius3.c` extension of `konami-16`

Status: production build, metadata extraction, independent list derivation,
threading inspection, type checks and the full spec suite pass. F4–F6 for the
added board remain pending because this agent cannot run Chromium; the
integrator should measure the parent machine defined by `gradius3.c`.

## Deliverables

- `mame/targets/konami-16.lua`: adds only the `gradius3.c` driver/video pair;
  every CPU, sound and shared video core was already selected.
- `mame/targets/konami-16.lst`: derives from seven driver files and contains
  101 public machines, including three from the added driver.
- `mame/builds/konami-16.json`: records the two added compilation units and
  retains the evidence-backed 4,096-page memory setting.
- `docs/probes/families/konami-16.md`: replaces F1–F3 with whole-family
  evidence and marks the added driver's F4–F6 measurements pending.
- `tests/spec/04-mame-family-targets.test.ts`: updates the existing row to
  seven driver sources and 101 expected machines.
- `dist/mame/konami-16/`: contains the rebuilt ignored production output.

No runtime source, build script, production patch, bridge file, package file,
spec section or other family's file changed. No private machine identity,
archive identity, ROM hash or resolved private path was added to a tracked
file.

## Production artifact and download growth

The unextended family baseline completed with the prescribed family-only
source-unpack command in 108.76 seconds. The extended build reused the source
and object cache, compiled the two added units and completed in 47.10 seconds.
Both used `--jobs 8` and the pinned source, patches, compiler, optimizer and
link flags.

```text
dist/mame/konami-16/
├── build.json                       3,130 bytes
├── mamekonami-16.js               302,305 bytes
├── mamekonami-16.wasm           6,538,443 bytes
├── notices/                           14 files, 562,168 aggregate bytes
└── romsets/                          101 files, 639,804 aggregate bytes
```

- `.lst` and `-listfull` machine count: 101
- Prior checked-in and production-baseline count: 98
- buildId: `f6c7c72d6f4bf82568e4897b8ee0fb5b40a12e258e811df5e09ed0c77a19ce0d`
- Memory: fixed 4,096 pages, non-shared
- Threading gate: passed; no worker, runtime marker or pthread requirement

The brief's statement that the previous machine count was 106 is stale. The
checked-in list, its independent derivation, the earlier family record and the
unextended production baseline all agree on 98; adding the three entries from
`gradius3.c` produces the verified count of 101.

| Wasm state | Raw bytes | gzip -9 | Brotli 11 |
| ---------- | --------: | -------: | ---------: |
| Before extension | 6,520,690 | 1,675,113 | 1,250,512 |
| After extension | 6,538,443 | 1,679,491 | 1,254,423 |
| Increase | 17,753 (0.27%) | 4,378 (0.26%) | 3,911 (0.31%) |

This family download grows for every machine already in `konami-16`, not only
the three entries from the added driver. The integrator should decide with the
user whether the 17,753-byte raw / 3,911-byte Brotli-11 increase is acceptable
after considering the pending desktop F6 result.

The JavaScript artifact is 302,305 raw, 65,607 gzip-9 and 55,338 Brotli-11
bytes. F3 found a whole-family maximum public metadata ROM sum of 21,233,792
bytes in `mystwarr.c`; its conservative two-copy estimate is 42,467,584 bytes,
21.09% of the 201,326,592-byte safe budget. The added `gradius3.c` board's
maximum is 3,997,952 bytes. Every family machine therefore remains within
4,096 pages.

## Target findings

Independent derivation found 98 machines across the six prior driver files
and three in `gradius3.c`. The 101-entry result matched production
`-listfull`, so no list correction was needed.

The added board configures two M68000 CPUs, one Z80, YM2151, K007232, K052109
and K051960. Every selectable core and shared video unit was already compiled
for the family, and the first complete extended link reported no other
dependency. The driver maps a 2 MiB graphics region and copies selected data
at run time into a fixed 128 KiB character-RAM window; it does not perform a
large startup decode requiring a memory-page increase.

## Chromium handoff

F4–F6 are the only work left undone. The integrator should supply a lawful
ignored preload for the parent machine from `gradius3.c` and run the real
adapter in Chromium:

```sh
ARCADE_PRELOAD_CONFIG="$W33_PRELOAD_CONFIG" \
ARCADE_FAMILY_CONFIGS="$W33_PRELOAD_CONFIG" \
  npm run test:browser
```

Record time to first valid and first non-black frame for F4; native geometry,
refresh and 60/90/120/144 Hz cadence error for F5; and the 60-second desktop
emulated-time ratio for F6. The source metadata expectation is 320×224
horizontal at 60 Hz. Copy only privacy-safe measurements into the family
probe. If F6 misses the desktop gate, record the ratio plainly and decide with
the user whether to retain the extension.

## Verification

Commands and results, in execution order:

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts konami-16 --jobs 8

npm run probe:mame:threading -- \
  "$PWD/dist/mame/konami-16/mamekonami-16"

gzip -9 -c dist/mame/konami-16/mamekonami-16.wasm | wc -c

npm run check
npm test
```

- Initial baseline attempt: stopped before target compilation after 9.19
  seconds because the sandbox denied the shared SDK cache lock.
- Cache-localized baseline: passed in 108.76 seconds with 98 machines and 98
  metadata files; only ignored cache and temporary paths changed.
- Extended build: passed in 47.10 seconds with 101 machines and 101 metadata
  files.
- Explicit threading inspection: passed with one fixed 4,096-page non-shared
  memory and no worker or pthread markers.
- Raw and compressed sizes: collected with `stat`, `gzip -9 -c` and Node.js
  `brotliCompressSync` at quality 11; values are recorded above.
- `npm run check`: passed (`check:src`, `check:ui` and `check:tests`).
- `npm test`: 37 files, 618 cases; 618 passed, 0 failed, 0 skipped. The real
  output was present and passed `tests/spec/32-build-output.test.ts`.

## Integrator note

The integrator-owned specification remains stale: §4.6's `konami-16` row
should add `drivers/gradius3.c` and `video/gradius3.c`, update the family count
to 101, describe the dual-M68000 board, and record the F6 retention decision.
This package did not edit the spec because it is outside W33's write set.

## Integration (2026-10-30, on main)

Merged as `bca07c7`; the family rebuilt on main to the same build id. Gate
with the board's private preload: browser 40 passed, 0 failed, 25 skipped by
design (M1 acceptance ratios 1.0012 and 1.0007); family measurement F4 556 ms,
F5 cadences within 0.27 %, F6 1.0000 over 60 s. Recorded in the family probe
record. Spec 618.
