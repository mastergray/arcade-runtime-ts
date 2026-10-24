# Midway MCR family probe (including `williams.c`)

Whole-family F1–F3 evidence was refreshed 2026-10-24 on Linux x86-64 with
Node.js 22.22.2, npm 10.9.7, GNU gzip 1.10, the pinned MAME 0.161 source
archive and Emscripten 1.38.31. No ROM content was supplied to the build or
metadata steps.

## F1 — Does the target pair compile and expose every machine?

The extended [`midway-mcr.lua`](../../../mame/targets/midway-mcr.lua) and
[`midway-mcr.lst`](../../../mame/targets/midway-mcr.lst) pair compiled through
the production pipeline. The generated module completed the ROM-free
`-listfull` and `-listxml` paths, and the threading gate reported one fixed,
non-shared 4,096-page memory with no worker or pthread markers.

```sh
BASH_ENV="$PWD/.cache/w28b-bash-env.sh" \
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-mcr/mamemidway-mcr"
```

| Result | Reused-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------: | -------------------: | ---------------------: |
| Pass | 32.14 s | 100 | 100 |

Independent derivation found 29 machines in `mcr.c`, 12 in `mcr3.c`, 13 in
`mcr68.c` and 46 in `williams.c`. The 100-entry result matched production
`-listfull`, so no list correction was needed.

The extension adds the driver, machine and video units from `williams.c`;
`audio/williams.c` and the M6800, M6809, PIA, DAC and HC55516 cores were
already selected by the family. Source inspection added `BANKDEV` for the
driver's address-map banks and `machine/ticket.c` from MAME's shared block for
its ticket device. The first complete extended link found no other missing
unit or selectable core. The resulting build identity is
`b0d867ffc6121773fb03c1ae81c7fe40e5d6dcb8f1a31fca6b39b492c01a1f0e`.

The prescribed build without the compatibility environment compiled the
whole pre-extension family and reached the final link in 167.01 seconds, where
the SDK-bundled Node 8 process stopped with `ERR_UNKNOWN_STREAM_TYPE` on the
runner's captured standard streams. The successful ignored process-local
configuration selects host Node 22 for Emscripten's JavaScript helpers only;
the pinned C/C++ compiler, native optimizer, Binaryen, source, flags and
production pipeline remain unchanged.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md). The before row was
rebuilt from current main immediately before extending the target.

| Artifact state | Raw bytes | gzip -9 | Brotli 11 |
| -------------- | --------: | -------: | ---------: |
| Wasm before extension | 6,307,648 | 1,628,903 | 1,221,093 |
| Wasm after extension | 6,440,836 | 1,669,262 | 1,251,850 |
| Wasm increase | 133,188 (2.11%) | 40,359 (2.48%) | 30,757 (2.52%) |
| JavaScript before extension | 303,075 | 65,655 | 55,366 |
| JavaScript after extension | 303,075 | 65,655 | 55,377 |

The extension therefore adds 30,757 Brotli-11 bytes to the family download
while exposing 46 additional public machines.

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds the
family maximum at 1,114,118 bytes in `mcr68.c`. The largest `williams.c`
metadata sum is 291,616 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative whole-family peak estimate of
2,228,236 bytes, 1.11% of the safe budget, leaving 199,098,356 bytes. No
machine in the extended family fails the §5 estimate, so the build remains at
4,096 pages.

The added driver does not decode large sprite or tile regions at startup. Its
blitter-heavy path draws into a small 4-bit framebuffer; its largest graphics
region is 49,152 bytes and its generated color-remap lookup is 65,536 bytes.
This differs from the large decoded-sprite case called out by W28. If the
integrator's real browser run nevertheless aborts with the adapter's
`MEMORY_EXCEEDED` error, rebuild with `memoryPages: 8192` and record the
observed browser evidence.

## F4 — What is the Chromium time from `callMain` to first frame?

Pending for the supplied private `williams.c` title. A privacy-safe audit of
the ignored preload passed under both strict and MAME-compatible policies:
one archive was present, all 15 expected files were valid, and there were no
missing, wrong-size, wrong-CRC, optional-missing or archive-problem rows. The
33 unexpected entries are harmless.

The real browser command was attempted, but the managed sandbox denied the
test page's loopback listener with `listen EPERM: operation not permitted
127.0.0.1` before Chromium page creation. No first frame arrived, so startup
time and non-black output remain pending.

On a host that permits loopback and Chromium, time from immediately before
`adapter.start()` through the first valid frame and confirm that the delivered
frame contains non-black pixels. The configured board exercises the added
driver's blitter-heavy video path.

## F5 — Are native refresh and upright geometry correct?

Pending for the same `williams.c` title because the browser stopped before
page creation. Record the public upright native width, height and refresh;
verify every delivered frame has the expected orientation and geometry; and
measure the emulated frame rate at controlled 60, 90, 120 and 144 Hz
cadences. Each cadence must remain within the family-measurement tolerance.

The metadata for the configured board declares no DIP switches. The
production selector case recognized that there was nothing to select; this
is expected board metadata, not a selector failure.

## F6 — Does the blitter-heavy title sustain full speed?

Pending for the same loopback-policy reason. After warm-up, measure exactly
60 seconds at the 60 Hz controlled cadence and report emulated seconds divided
by wall seconds; also collect the informational 4× CPU-throttled mobile-proxy
ratio. This desktop result decides whether the extension remains in the
family.

All 46 public `williams.c` machine declarations carry `GAME_SUPPORTS_SAVE`,
so the M35 unsupported-save exception does not apply by source inspection.
The browser quick-save confirmation remains pending with F4–F6 because its
page could not start.

The attempted command was:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-midway-mcr.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-midway-mcr.json" \
  npm run test:browser
```

The run completed 31 files and 57 cases: 1 passed, 31 failed at the denied
loopback bind, and 25 skipped by design. The single passing metadata-only case
is the no-DIP result above; it does not supply F4–F6 evidence.

The previously recorded MCR-board measurement remains valid and is preserved
for comparison: a 512×480 interlaced horizontal board at 30.000 Hz reached its
first frame in 933 ms during a loaded-host run, held 30.00/29.96/29.95/29.96
fps at the four controlled cadences, and sustained a 1.0000 desktop ratio.
It does not substitute for the new driver's blitter-heavy measurement.

## F11 — Which analogue and dual-stick ports occur?

`mcr.c` declares `IPT_DIAL` over 6-, 7- and 8-bit ranges with
sensitivity/key-delta pairs 3/50, 10/10, 40/10 and 50/10, generally reversed.
Its `IPT_AD_STICK_X/Y` declarations use ranges 48–152 at sensitivity 100 and
key delta 52, plus X instances over 0–206 at sensitivity 100 and key delta 10.
Its full-range `IPT_TRACKBALL_X/Y` declarations use sensitivity 50 and key
delta 10, with reversed Y, plus one Y instance at sensitivity 100 and key
delta 10.

`mcr3.c` declares 6- and 8-bit `IPT_DIAL` at sensitivity 25 or 50 and key
delta 10, reversed; `IPT_PEDAL` at 0x30–0xff, sensitivity 100, key delta 10
and reverse, plus a 60–180 instance without reverse; and `IPT_PADDLE` at
0x34–0xb4, sensitivity 40, key delta 10 and reverse, plus a full-range
instance at sensitivity 40 and key delta 10.

`mcr68.c` declares full-range reversed `IPT_DIAL` at sensitivity 50 and key
delta 10; `IPT_PEDAL` at 0x30–0xff, sensitivity 100, key delta 10 and reverse;
`IPT_PADDLE` at 0x10–0xf0, sensitivity 80, key delta 10 and reverse;
`IPT_AD_STICK_X/Y` at 0x00–0x6f, sensitivity 100 and key delta 10, with
reverse on one X variant; and full-range `IPT_TRACKBALL_X/Y` at sensitivity
100 and key delta 20, with reversed Y.

`williams.c` adds `IPT_AD_STICK_X/Y` at 0x00–0x6f, sensitivity 100 and key
delta 10, with reversed Y; another X/Y pair uses 0x00–0x3f, sensitivity 25
and key delta 10. It also adds full-range `IPT_TRACKBALL_X/Y` for two players
at sensitivity 25 and key delta 32, with reversed Y. None of the four driver
files declares a centre delta for these ports.

W26's generated standard sequences bind AD-stick X/Y and paddles to X/Y axes,
pedals to RX, dials and trackball X to `ADDREL1`, and trackball Y to `ADDREL2`.
`HAT1` supplies decrement/increment fallback for each directional analogue
port, and `BUTTON13` supplies the pedal press fallback. No runtime or
controller-config change is required by this extension.
