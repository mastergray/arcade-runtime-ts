# Irem M72/M92 family probe

Family description: **Irem M72/M92**. The original M72 F4–F6 evidence remains
below unchanged; W19f adds M92 to the same family id and re-records F1–F3.

## 2026-10-21 — extended by W19f

Observed on Linux x86-64 with Node.js 22.22.2, npm 10.9.7, GNU gzip
1.10, the pinned MAME 0.161 source archive and Emscripten 1.38.31. No ROM
content was supplied to the build or metadata steps.

### F1 — Does the target pair compile and expose every machine?

The extended [`irem-m72.lua`](../../../mame/targets/irem-m72.lua) and
[`irem-m72.lst`](../../../mame/targets/irem-m72.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and the threading gate reported one fixed, non-shared
4,096-page memory with no worker or pthread markers.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts irem-m72 --jobs 4

npm run probe:mame:threading -- \
  "$PWD/dist/mame/irem-m72/mameirem-m72"
```

| Result | Successful cached-source wall time | `-listfull` machines | ROM-set metadata files |
| ------ | ---------------------------------: | -------------------: | ---------------------: |
| Pass | 33.55 s | 71 | 71 |

The first invocation encountered the pinned Node.js 8 runner's
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured stdio. As in W19a, an
ignored process-local Emscripten config selected the host Node.js 22 executable
for compiler subprocesses only; no tracked toolchain or pipeline file changed.

The independently derived list adds all 36 public machines from `m92.c` to the
35 from `m72.c` and matched the production count without a list correction.
Source inspection selected the Irem GA20 and OKIM6295 sound cores. The first
complete debug link then identified M92's buffered 16-bit sprite RAM device;
adding the pinned `BUFSPRITE` video core resolved the only undefined symbol.

The resulting build identity is
`60258693a34ad579c0e95f6385aa0dc533b1bdfdcbefd41797c9da8508a589c9`.

### F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,574,888 | 1,518,686 | 1,142,314 |
| JavaScript | 302,519 | 65,606 | 55,379 |

### F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds `psoldier`
largest at 11,141,120 bytes. The safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a conservative metadata-only peak estimate of
22,282,240 bytes, 11.07% of the safe budget, leaving 179,044,352 bytes. No
machine in the family fails the §5 estimate, so the build remains at 4,096
pages.

### New-driver F4–F6 status

An ignored lawful preload config for an M92 title is present, but this sandbox
cannot bind loopback or start Chromium, so the requested browser suite was not
attempted.

| Probe | M92 status |
| ----- | ---------- |
| F4 startup to first valid, non-blank frame | pending integrator browser run |
| F5 native refresh and upright geometry | pending integrator browser run |
| F6 sixty-second emulated-time ratio | pending integrator browser run |

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
