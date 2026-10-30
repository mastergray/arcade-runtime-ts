# W33 — `gradius3.c` into `konami-16`

Lane: **native**. Branch: `wp/w33-konami-16-gradius3`. Milestone: M42.
One package, one worktree. Everything in `W14-family.md` §2–§8,
`W19-family-wave-2.md` §2, `W27-family-wave-3.md` §2, `W28-family-wave-4.md`
§2 and `W31-family-wave-5.md` §2 applies unchanged. Build with `--jobs 8`
(nothing else is building).

| Package | Family | §4.6 driver sources (0.161) | Notes |
| ------- | ------ | --------------------------- | ----- |
| W33 | extend `konami-16` | add `drivers/gradius3.c`, `video/gradius3.c` (header `includes/gradius3.h`) | Two 68000s at 10 MHz and a Z80 with YM2151 and K007232; the K052109 and K051960 video chips and every sound core it needs are already compiled for this family by `tmnt.c`, so the target gains the two source units and nothing else. Three public machines in 0.161 (one parent, two clones) |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W33 | Target pair, build file, probe record for the extended family | `mame/targets/konami-16.*`, `mame/builds/konami-16.json`, `docs/probes/families/konami-16.md`, the `konami-16` row of `FAMILY_TARGETS` in `tests/spec/04-mame-family-targets.test.ts` | W31 | §4.6, §12 M42 | N | M42 |

## 2. What differs from W31

- The build is an extension: record the wasm size before and after, raw
  and compressed, in the merge note as W27f did, so the integrator can
  decide with the user whether the growth is acceptable for every title
  already in the family.
- `dist/mame` in your worktree is a real directory, not a link: your
  build lands there alone, and the integrator rebuilds the family on
  main after the merge. Do not copy artifacts anywhere else.
- The shim for the pinned Emscripten link step is in your worktree at
  `.cache/w29-bash-env.sh` and `.cache/w29.emscripten`; build with
  `BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts konami-16 --jobs 8`.
  The first build unpacks the source tree; do not pass `--fresh`.
- F4–F6 need Chromium, which you cannot run: write the probe record with
  F1–F3 and the whole-family facts, mark F4–F6 pending for the
  integrator, and say which machine of the three the integrator should
  measure (the parent).

## 3. Definition of ready for review

W14 §6 and W19 §3. `docs/work/W33-merge-note.md` states the `.lst`
machine count (was 106), the wasm size before and after, the memory
pages, the build id, and anything undone. No titles, ROM names, hashes or
private paths in tracked files or commit messages; boards by driver file.
No `Co-Authored-By`.
