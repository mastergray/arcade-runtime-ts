# W14a merge note — CPS-2 family

Status: ready for review. The pinned production build completed, its threading
gate passed, and the repository typecheck and spec suite are green. F4–F6 are
explicitly pending the lawful private set that was unavailable for this work
package.

## Delivered files

- `mame/targets/cps2.lua`
- `mame/targets/cps2.lst` — 293 entries derived from the pinned CPS-2 driver
- `mame/builds/cps2.json` — 4,096 fixed-memory pages
- `docs/probes/families/cps2.md` — F1–F6 record
- One CPS-2 row in `tests/spec/04-mame-family-targets.test.ts`

No files outside the W14a write set were changed. No ROM content, private ROM
identity, ROM hash or local path was added.

## Build and artifacts

The successful clean-source invocation was:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts cps2 --jobs 4
```

It completed in 137.5 seconds and produced the following ignored artifact
directory:

| `dist/mame/cps2/` entry | Result |
| ----------------------- | ------ |
| `mamecps2.js` | 301,909 bytes |
| `mamecps2.wasm` | 6,146,856 bytes |
| `build.json` | 5,694 bytes; 293 machines |
| `romsets/` | 293 JSON files; 1,141,443 aggregate bytes |
| `notices/` | 13 files; 561,238 aggregate bytes |

Build ID:
`5855fa1219147c43ac7ffd13e523e795777136a5309055c08595fa1590a03d5c`.

The explicit threading inspection reported fixed 4,096-page non-shared
memory, no runtime thread markers, no worker artifact and
`requiresPthreads: false`.

## Target corrections

The §4.6 CPS-2 source row is insufficient for a standalone MAME 0.161
subtarget. An initial target containing only `drivers/cps2.c`,
`machine/cps2crpt.c` and `video/cps1.c` compiled but failed at link because
the CPS-2 QSound address map and shared-RAM handlers are defined in
`drivers/cps1.c`. Linking that whole unit also requires `machine/kabuki.c`
and the CPS-1 unit's PIC16C5X, YM2151, MSM5205 and Timekeeper cores. The
committed Lua and build JSON contain this minimal compilation-unit-level
correction. The derived `.lst` itself needed no correction and remains the
293 machines declared by `drivers/cps2.c`.

The integrator should update the CPS-2 row in spec §4.6 and the example
`sources` array in §4.1 to reflect this source coupling; the spec is outside
this package's write set. No other integrator-owned line is needed.

One existing pipeline caveat surfaced after the failed first link: rerunning
against that already patched source cache stopped with
`Source does not accept 0001-web-osd-modules.patch`. Moving the ignored cache
aside and allowing the required command to unpack a clean source tree
produced the successful build above. No pipeline file was edited. The
integrator may wish to follow up on production-patch idempotence in W2's
owned code; it does not affect a clean W14a build.

## Verification

- `npm run probe:mame:threading -- "$PWD/dist/mame/cps2/mamecps2"` — pass
- `npm run check` — pass
- `npm test` — pass, 23 files and 453 cases, 0 failed, 0 skipped
- Browser/private-set cases — not run because no lawful CPS-2 set was
  available; this is the documented F4–F6 pending condition

## Integrator follow-up

Use an ignored lawful CPS-2 preload config and the throwaway browser mechanics
described in `docs/probes/families/cps2.md`. Record, without committing the
selected title or ROM identity:

1. F4: monotonic milliseconds from `callMain` invocation to first frame for
   the slowest-starting available CPS-2 title.
2. F5: effective native refresh and percentage error under 60, 90, 120 and
   144 Hz callback cadences, plus reported/delivered geometry, orientation
   and upright-frame result.
3. F6: the 60-second emulated-time ratio on desktop and under Chromium's 4×
   CPU-throttled mobile proxy for the heaviest available title.

The probe record lists the environment fields and acceptance thresholds to
capture with those measurements.
