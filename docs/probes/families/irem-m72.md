# Irem M72 family probe

Optional family (§4.6). F1–F3 for this target were established by the parent
project's M0 probes (`docs/probes/mame0161/family-sizes.md`,
`threading-and-hosting.md`) and by W1's family-pair build (35 machines). The
production artifact measured below was built by `build-mame irem-m72`:
5,474,516 raw Wasm bytes, 35 romsets, threading gate passed.

## F4–F6 measured — an Irem M72 title

Observed 2026-10-20 with the `build-mame` production artifact, headless
Chromium on the desktop host, the real adapter driven through
`tests/browser/33-family-measurements.test.ts` (injected scheduler at a
controlled cadence against a real clock; identities stay in the ignored
preload configs). Measurements overlapped a native build in another
worktree, so they are if anything conservative.

| Probe | Result |
| ----- | ------ |
| F4 startup to first valid frame | 305 ms; 384×256 horizontal at 55.018 Hz |
| F5 emulated rate against native refresh, per cadence | 60 Hz → 55.00 fps (−0.03 %), 90 → 54.88 (−0.24 %), 120 → 54.92 (−0.17 %), 144 → 55.21 (+0.35 %); every frame at the machine's native size and orientation |
| F6 sixty-second emulated-time ratio at the 60 Hz cadence (desktop) | 0.9999 |

Desktop full speed holds for this family; the 4× CPU-throttled mobile proxy
is deferred to M10 as §0.2 allows. The 55 Hz native refresh is the first
non-60 Hz board verified through the accumulator.
