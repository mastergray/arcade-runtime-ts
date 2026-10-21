# P12: Native/browser parity

Status: passed. Native/browser parity and sustained desktop speed pass.
Physical-phone performance is tracked separately by M4 and the release gate.

Observed 2026-10-20 with the pinned MAME 0.161 source, the pinned Emscripten
1.38.31 toolchain, a native Linux build and headless Chromium. The legally
authorized fixture, machine names, ROM archives and frame hash remain private
local inputs and are not recorded here.

## Deterministic checkpoint

[`0010-native-browser-parity-probe.patch`](../../../mame/probes/patches/0010-native-browser-parity-probe.patch)
runs the same checkpoint code in native and Emscripten builds. At emulated
frame 180 it renders MAME's hidden native snapshot target, converts every
pixel to RGBA byte order and computes a 32-bit FNV-1a checksum. It also records
the machine short name, target and visible geometry, native refresh rate and
non-black pixel count.

The probe injects one player-one right-direction transition through an
`ioport_field`, then reads the resulting emulated port bit on the following
frames. That distinguishes a core-visible input transition from merely
changing a browser or host key state.

The native minimal-OSD build exposed three host-only compatibility details:

- the release's allocation tracker is incompatible with this host's newer C++
  runtime, so the probe compiles native objects with `NO_MEM_TRACKING`;
- the minimal OSD has no initialized modular font provider, so it explicitly
  returns no host font and lets the core use its embedded UI font; and
- one shared legacy audio device can be configured without its optional
  sample-ROM region, so the probe treats an absent region as an empty source.

These changes are confined to the probe patch. The browser parity artifact
uses the same frame and input checkpoint, which prevents separate
implementations from quietly agreeing on different definitions.

## Results

[`11-mame-parity-probe.test.ts`](../../../tests/browser/11-mame-parity-probe.test.ts)
loads all private details through one ignored JSON config and runs through
`ctg-js-browser-test`.

| Criterion | Result |
| --------- | ------ |
| Machine identity | Exact native/browser match |
| Target and visible geometry | Exact native/browser match |
| Native refresh rate | Exact native/browser match |
| Deterministic frame-180 RGBA hash | Exact native/browser match; both frames contained visible pixels |
| Core input | Released → pressed → released in both builds |
| Browser input | A real Chromium arrow-key press and release both reached the core |
| Desktop sustained speed | Pass: 10.014 seconds measured, 0.999× emulated-time ratio and 0.999 reported speed |

The desktop screen cadence also matched the core-reported refresh rate within
the two-hertz test tolerance. The test logs only comparison booleans and
performance aggregates; it does not print the private machine name or hash.

## Reproduction

Build the native baseline and browser artifact from the same ignored config,
serve the ignored MAME source/output directory, and point the browser suite at
that one config:

```sh
npm run probe:mame:parity:native -- res/local-parity-probe.json
npm run probe:mame:game -- res/local-parity-probe.json
python3 -m http.server 8877 --directory "$PWD/.cache/mame0161-source"
MAME_PARITY_PROBE_CONFIG=res/local-parity-probe.json npm run test:browser
```

The config uses the existing `source`, `emsdk`, `machine`, `parent`, `target`,
`output` and `roms` fields. It may additionally set `nativeResult`,
`browserBaseUrl` and `desktopSeconds`; defaults keep generated results under
the ignored source cache, use the local port above and measure ten seconds.

P12 is the native/browser parity baseline and is complete from this evidence.
M4 and the release gate separately require a 60-second full-speed run on a
documented mid-range physical phone using the production display and touch
paths; that future record must still omit the private fixture identity.
