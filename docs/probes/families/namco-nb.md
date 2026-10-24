# Namco NB-1/NB-2 family probe

Observed 2026-10-23 on Linux x86-64 with Node.js 22.22.2, npm 10.9.7,
GNU gzip 1.10, Node.js zlib Brotli, the pinned MAME 0.161 source archive
and Emscripten 1.38.31. No ROM content was supplied to the build or metadata
steps. A lawful ignored preload config is present; its private selection,
archive identity, hashes and resolved paths are not recorded here.

## F1 — Does the target pair compile and expose every machine?

The committed [`namco-nb.lua`](../../../mame/targets/namco-nb.lua) and
[`namco-nb.lst`](../../../mame/targets/namco-nb.lst) pair built through the
production pipeline. The generated module completed the ROM-free `-listfull`
and `-listxml` paths, and both the pipeline and explicit threading gates
reported one fixed, non-shared 8,192-page memory with no worker or pthread
markers.

```sh
BASH_ENV="$PWD/.cache/w27d-bash-env.sh" \
  EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts namco-nb --jobs 6

npm run probe:mame:threading -- \
  "$PWD/dist/mame/namco-nb/mamenamco-nb"
```

| Result | Initial compile to first link | Corrected cached-source pipeline | `-listfull` machines | ROM-set metadata files |
| ------ | ----------------------------: | -------------------------------: | -------------------: | ---------------------: |
| Pass | 104.30 s | 40.01 s | 15 | 15 |

The independently derived list contains 15 machines from
`drivers/namconb1.c` and matched the production count without a list
correction. The pinned Namco vendor block supplies the driver/video pair,
the shared `drivers/namcoic.c`, the C75 implementation in
`machine/namcomcu.c` and the C116 screen controller in `video/c116.c`. The
target selects the M68000-family main CPU, M37710 sound MCU, C352 sound core
and parallel EEPROM device. The shared Namco IC unit includes the System 2
state header and therefore also requires the M6502 group for its M37450
device type.

The first host-Node diagnostic link exposed only the C116 and M37450 symbols;
adding those two upstream-listed dependencies resolved every undefined
symbol. No other driver family or compilation unit was added.

The prescribed first link met the SDK's bundled Node 8
`ERR_UNKNOWN_STREAM_TYPE` incompatibility with captured process streams. An
ignored worktree-local `BASH_ENV` configuration directs Emscripten's
JavaScript helpers to host Node 22 while leaving the pinned C/C++ compiler,
native optimizer, Binaryen, source, flags and production pipeline unchanged.
The resulting build identity is
`bcfe8813ca3fe0c19b35491d67da1840c54d572118bead34cdefc109e8df8653`.

## F2 — What are the raw, gzip and Brotli sizes of the Wasm and JavaScript?

Raw sizes are filesystem byte counts. Compressed sizes use `gzip -9 -c` and
Node.js `brotliCompressSync` with `BROTLI_PARAM_QUALITY=11`, matching the
method in [`family-sizes.md`](../mame0161/family-sizes.md).

| Artifact | Raw bytes | gzip -9 | Brotli 11 |
| -------- | --------: | -------: | ---------: |
| Wasm | 5,928,743 | 1,521,332 | 1,140,736 |
| JavaScript | 302,027 | 65,565 | 55,359 |

## F3 — Does the largest ROM set fit in 4,096 pages, and what is the peak?

Summing the public ROM sizes in every generated metadata file finds a largest
set of 39,337,984 bytes. The nominal 4,096-page safe adapter budget is:

```text
4,096 × 65,536 × 0.75 = 201,326,592 bytes (192 MiB)
```

Using the full uncompressed ROM sum once for supplied archive bytes and once
for loaded regions gives a metadata-only peak estimate of 78,675,968 bytes,
39.08% of that budget, leaving 122,650,624 bytes. No machine fails the §5
estimate on paper.

The build nevertheless uses 8,192 pages pre-emptively. `namconb1.c` declares
the sprite, tile and NB-2 rotation graphics as 8-bit `gfx_layout` elements;
the complete graphics regions are decoded into MAME gfx elements at startup.
The 39.3 MiB largest-set sum is effectively the same scale as the earlier
`seta2.c` board whose 4,096-page browser start exhausted the heap despite the
same two-copy metadata estimate. NB-1/NB-2 adds its large live graphics
decode to the MEMFS archive and loaded-region copies, so retaining the nominal
heap would repeat a known undercount risk. At 8,192 pages the same estimate is
19.54% of the 402,653,184-byte safe budget, leaving 323,977,216 bytes. A host
browser run should confirm the live peak rather than treating the metadata
estimate as proof.

## F4 — What is the slowest Chromium time from `callMain` to first frame?

**F4 pending: set incomplete (one required file missing).**

The ignored preload audit found 23 valid expected files, one missing required
file, no wrong-size or wrong-CRC files, and no archive problems under both
strict and MAME-compatible policies. One of two required archives is absent.
Per the W27 rule, no substitute file was sought and no browser startup was
attempted. The integrator should complete the lawful private input, then record
elapsed monotonic milliseconds from immediately before `adapter.start()` to
the first valid, non-blank frame.

## F5 — Are native refresh and upright geometry correct?

**F5 pending: set incomplete (one required file missing).**

After completing the lawful private input, record the machine-reported native
refresh, orientation and geometry, confirm the first frame is non-blank and
upright, and measure the effective rate at controlled 60, 90, 120 and 144 Hz
callback cadences. No geometry or cadence result is claimed from the metadata
path.

## F6 — Does the heaviest title sustain full speed?

**F6 pending: set incomplete (one required file missing).**

After completing the lawful private input, measure emulated seconds divided by
wall seconds over 60 seconds on desktop with frameskip disabled; the desktop
ratio is the family gate. The 4× CPU-throttled mobile proxy is informational.
The configured NB-2 entry carries MAME 0.161's own `GAME_IMPERFECT_SOUND` flag
in `drivers/namconb1.c`; that upstream emulator flag is accepted as such and
is not a browser-port defect. The driver also does not declare
`GAME_SUPPORTS_SAVE`, so a declined harness quick-save is the known M35 case,
not an F6 performance failure.

Run the acceptance cases without disclosing the private selection after its
missing dependency is supplied:

```sh
ARCADE_PRELOAD_CONFIG="$PWD/res/preload-namco-nb.json" \
ARCADE_FAMILY_CONFIGS="$PWD/res/preload-namco-nb.json" \
  npm run test:browser
```
