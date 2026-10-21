# CPS-2 family probe

Observed 2026-10-20 on Linux x86-64 with an Intel Core i7-1165G7,
Node.js 22.22.2, the pinned MAME `mame0161` source at commit
`76b978d039f922ed84796deb999389ebb1579191`, and Emscripten 1.38.31. No
ROM content was supplied to the build or the F1–F3 measurements.

## F1 — Does the target pair compile and expose every driver machine?

The committed [`cps2.lua`](../../../mame/targets/cps2.lua) and
[`cps2.lst`](../../../mame/targets/cps2.lst) pair built with the required
four-job command from a clean source cache:

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts cps2 --jobs 4
```

| Result | Wall time | `-listfull` machines | ROM-set metadata files | Build ID |
| ------ | --------: | -------------------: | ---------------------: | -------- |
| Pass | 137.5 s | 293 | 293 | `5855fa1219147c43ac7ffd13e523e795777136a5309055c08595fa1590a03d5c` |

The `.lst` count exactly matches the sorted, de-duplicated `GAME`, `GAMEL`
and `GAME_CUSTOM` declarations in `drivers/cps2.c` after intersection with
the pinned `mame.lst`. Every entry is annotated with that driver source.

The first target draft used only the three compilation units named in the
§4.6 CPS-2 row. It compiled but did not link because MAME 0.161 defines the
CPS-2 QSound address map and shared-RAM handlers in `drivers/cps1.c`. Adding
that whole compilation unit also required its Kabuki helper, PIC16C5X,
YM2151, MSM5205 and Timekeeper dependencies. The final Lua and build file
record this source-level coupling; no list correction was needed.

The build pipeline's threading gate passed. The explicit repeat check was:

```sh
npm run probe:mame:threading -- "$PWD/dist/mame/cps2/mamecps2"
```

It reported one imported, fixed 4,096-page non-shared memory, no runtime
thread markers, no worker artifact and `requiresPthreads: false`.

## F2 — What are the raw, gzip and Brotli download sizes?

Sizes use filesystem byte counts, GNU gzip 1.10 at level 9, and Node.js
22.22.2's Brotli encoder at quality 11, matching the method in the inherited
family-size probe.

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| `mamecps2.wasm` | 6,146,856 | 1,603,921 | 1,206,118 |
| `mamecps2.js` | 301,909 | 65,545 | 55,333 |

## F3 — Does the largest set fit the fixed-memory budget?

The largest metadata-described set is `hsf2`, tied with other machines at
46,399,488 bytes (44.25 MiB) when every described ROM size is summed. The
safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

The §5 estimate adds the supplied archive bytes to the metadata ROM-region
sum. Using the ROM-size sum again as the archive-size proxy gives 92,798,976
bytes (88.5 MiB), leaving 108,527,616 bytes (103.5 MiB) of safe budget. No
CPS-2 machine reaches the threshold under that estimate, so the build remains
at 4,096 pages. At runtime the adapter uses the actual supplied archive byte
lengths and rejects an unusually oversized input before module startup.

## F4 — What is the time from `callMain` to the first Chromium frame?

**pending private set**

The integrator must use an ignored lawful CPS-2 preload config and a
throwaway adaptation of `tests/browser/27-mame-adapter.test.ts`; no selected
machine, archive name, hash or local path may be committed. For the
slowest-starting available CPS-2 title, record the elapsed monotonic
milliseconds from immediately before the `callMain` invocation until the
first `onFrame` callback,
along with Chromium version, host CPU and whether the module/HTTP caches were
cold or warm.

## F5 — Does pacing hold native refresh, and is geometry upright?

**pending private set**

Using the same private browser setup, the integrator must record the
effective emulated refresh rate and percentage error from
`session.machine.refreshHz` under controlled 60, 90, 120 and 144 Hz callback
cadences; every error must be within 0.5%. Also record the machine-reported
width, height and orientation, the delivered frame width and height, and
whether a stable frame is upright. Use a lawful vertical CPS-2 set as an
additional private input if the performance set is horizontal.

## F6 — What sustained emulated-time ratio does the family achieve?

**pending private set**

For the heaviest available lawful CPS-2 title, the integrator must measure a
continuous 60-second interval after startup and report
`(onTick count / native refresh Hz) / wall-clock seconds` on desktop and
again with Chromium's 4× CPU-throttled mobile proxy. Record CPU, OS, Chromium
version, native refresh and both ratios; desktop full speed is the family
gate, while the throttled result is informational.
