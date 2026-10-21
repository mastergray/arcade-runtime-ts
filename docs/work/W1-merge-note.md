# W1 merge note — patch relocation and family target pairs

## Status

The W1 implementation and native deliverables are complete, and the branch is
rebased on current `main`. Review is blocked only by inherited spec tests whose
patch constants still point at the pre-W1 directory. Those files are outside
W1's exclusive write set.

## Integrator question and required lines

Should the integrator update the inherited tests below, or expand W1's write
set and return the branch for that path-only edit?

- In `tests/spec/02-mame-toolchain-pin.test.ts`, change both patch URLs from
  `../../mame/patches/` to `../../mame/probes/patches/`.
- In `tests/spec/03-mame-test-rom.test.ts`, change all eight patch URLs from
  `../../mame/patches/` to `../../mame/probes/patches/`.

No changes are needed in `src/index.ts`, `src/shared.types.ts`, `package.json`,
the TypeScript configs, `tests/run.ts`, or the runtime spec.

Until the two out-of-write-set test files are updated, `npm test` reports 229
passed and 9 failed cases. All nine failures are missing-file errors from those
old URLs; W1's five family-target cases pass.

## Build evidence

Both required builds used the committed pair directly, the pinned Emscripten
1.38.31 toolchain, two make jobs, a warmed SDK/port cache, fixed 256 MiB memory,
and the ROM-free `-listfull` path.

| Family | Command suffix | Wall time | Machines | Raw Wasm bytes |
| ------ | -------------- | --------: | -------: | -------------: |
| Neo Geo | `family-pair scripts/probe-mame0161-tiny.sh neogeo` | 113.23 s | 256 | 6,375,199 |
| CPS-1 | `family-pair scripts/probe-mame0161-tiny.sh cps1` | 39.28 s | 178 | 6,066,767 |

The optional Irem M72 committed pair also completed a ROM-free build and
generated 35 drivers. The required relocation regression completed end to end:

```sh
EMSDK_DIR="$PWD/res/emsdk" npm run probe:mame:tiny -- \
  "$PWD/.cache/mame0161-source"
```

That regression generated 25 drivers and completed the final WebAssembly link.
No artifacts are committed.

## Verification

- `npm run check`: pass after rebasing on current `main`.
- `npm test`: blocked as described above; 229 pass, 9 stale-path failures.
- `npm run test:browser`: 7 pass, 0 fail, 22 skip. The skips are the inherited
  native probe cases and each reports its required local environment variable.
- `git diff --check main...HEAD`: pass before this note.
- `mame/patches/` contains only `.gitkeep`; the ten diagnostics are under
  `mame/probes/patches/`.
- No files under `res/` or `.cache/` are tracked.

## Spec and brief discrepancies

No runtime-spec contract needs amendment. One W1 brief instruction is
incomplete: its `.lst` derivation names only `GAME`, `GAMEL`, and
`GAME_CUSTOM`, but the pinned Neo Geo source declares the required BIOS root
with `CONS`. The committed list includes that public root, consistent with
§4.6's complete-family and BIOS requirements; the derivation comment records
`CONS` explicitly.

The W1 write-set paragraph also omits two categories its deliverables require:
the M0 documentation links under `docs/probes/mame0161/` and the two F1 records
under `docs/probes/families/`. This branch changed only those explicitly
required documentation files in addition to the stated write set. The same
paragraph does not assign the inherited stale-path tests above to W1, which is
the remaining review blocker.
