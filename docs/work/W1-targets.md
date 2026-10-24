# W1 — Patch relocation and family target pairs

Lane: **native** (needs emsdk and the MAME 0.161 source cache).
Branch: `wp/w1-targets`. Milestone: M1 (slice M1A, build half).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W1 | Patch relocation and family target pairs: move probe patches to `mame/probes/patches/`, fix probe script paths, `neogeo.{lua,lst}` and `cps1.{lua,lst}` covering full driver lists | `mame/patches/`, `mame/probes/`, `mame/targets/`, `scripts/probe-*.sh`, `scripts/read-mame-probe-config.js` | — | §1.2, §4.1, §4.6, §12.1 | N | M1 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §1.2 (layout), §4.1 (build
pipeline, especially step 5 on the 0.161 subset mechanism), §4.6 (family
matrix rows for `neogeo`, `cps1` and `irem-m72`), §12.1 (slice M1A).
Then `docs/probes/mame0161/build-system.md` ("Subset mechanism") and
`docs/probes/mame0161/family-sizes.md`, and `mame/README.md`.

## 3. Write set

Exclusive: `mame/patches/`, `mame/probes/`, `mame/targets/`,
`scripts/probe-mame0161-tiny.sh`, `scripts/probe-mame0161-native-parity.sh`,
`scripts/read-mame-probe-config.js`, plus `tests/spec/04-mame-family-targets.test.ts`
(you own this existing test because it asserts on your files) and any new
test you add under `tests/spec/` or `tests/browser/`.

Do not touch `mame/VERSION`, `mame/EMSDK_VERSION`, `mame/SOURCE.json`,
`mame/bridge/` (W3's), `mame/builds/` (W2's), or anything under `src/`.

## 4. Deliverables

1. **Relocate the ten inherited diagnostic patches.** Move
   `mame/patches/0001-…` through `0010-…` to `mame/probes/patches/` with
   their names unchanged. `mame/patches/` is left empty except for a
   `.gitkeep`; W3 will add production patches 0001–0003 there. Update every
   path in `scripts/probe-mame0161-tiny.sh` (ten hardcoded `mame/patches/…`
   variables near the top) and `scripts/probe-mame0161-native-parity.sh`
   so the inherited probes still run. Update `mame/README.md` paths and
   any `docs/probes/mame0161/*.md` links that point at the old location
   (links only; do not rewrite evidence).
2. **Family target pairs.** Replace `mame/targets/neogeo.lua` and
   `mame/targets/cps1.lua` with real family targets and add their `.lst`
   siblings:
   - The Lua keeps the same shape as the probe targets (core selections,
     `createProjects_…` / `linkProjects_…` with the family's compilation
     units) but is named for the family: project `mame_neogeo` /
     `mame_cps1`, functions `createProjects_mame_neogeo(...)` and
     `linkProjects_mame_neogeo(...)`, matching how `tiny.lua` is named for
     `SUBTARGET=tiny`. Copy the core selections and file lists from the
     corresponding blocks of the pinned source's
     `scripts/target/mame/mame.lua` (search for `drivers/neogeo.c` and
     `drivers/cps1.c`), not from memory. §4.6 lists what is expected.
   - The `.lst` lists **every** parent and clone defined by the family's
     driver sources. Derive it from the source, not by hand: for each
     driver source file in the target, collect the first argument of every
     `GAME(` / `GAMEL(` / `GAME_CUSTOM(` macro, and keep only names that
     also appear in `src/mame/mame.lst`. Record the derivation command in
     a comment at the top of the `.lst` (MAME's list format allows `//`
     comments; verify against `src/mame/tiny.lst`).
   - Keep `mame/targets/irem-m72.lua` and give it an `irem-m72.lst` the
     same way; it is an optional family (§4.6) but its target is inherited
     evidence and must keep building.
   - Add a `mame/targets/README.md` that says what a pair is, how a `.lst`
     is derived, and that targets contain no private machine selection.
3. **Prove a full-family build.** Extend `scripts/probe-mame0161-tiny.sh`'s
   `family` mode (or add a sibling script in your write set) so that a
   family can be built from its committed `.lua` + `.lst` pair with no
   private config: it copies the pair into the source tree as
   `scripts/target/mame/<family>.lua` and `src/mame/<family>.lst`, runs the
   P2 recipe with `SUBTARGET=<family>`, and links a ROM-free
   `-listfull` artifact. Run it for `neogeo` and `cps1` and record in
   `docs/probes/families/neogeo.md` and `cps1.md` (F1 rows only): the
   command, wall time, the machine count `-listfull` reports, and the raw
   `.wasm` size. Do not commit artifacts.
4. **Tests.** Update `tests/spec/04-mame-family-targets.test.ts` so it
   checks: each `.lua` has a `.lst` sibling; each `.lst` is non-empty, has
   no duplicates and no private markers; every `.lst` entry's driver
   source is listed in the matching `.lua`; and the Lua function names
   match the family id. Keep its existing "no private selection" case.

## 5. Contracts and doubles

None from `src/`; this package is build inputs only. The only contract is
§4.1's: a family is a committed `<family>.lua` + `<family>.lst` pair, and
`SUBTARGET=<family>` builds it.

## 6. Definition of ready for review

See `docs/work/README.md` rule 7. In addition: `npm run probe:mame:tiny`
still passes end to end after the relocation (it is the regression check
for the moved patches), and both family builds completed on your machine
with their F1 rows written.

## 7. Repository rules that bite here

- Nothing private in tracked files: no machine names chosen for testing,
  no ROM names, no local paths. The `.lst` files name every machine in
  the family, which is public MAME metadata, and that is fine.
- `res/` is ignored and holds your private probe configs; never commit it.
- Build outputs stay under the ignored source cache; never under `mame/`.
- Commit messages: summary line, blank line, details; no attribution.

## 8. Commands

```sh
# one-time, in your worktree
npm install
ln -s ~/dev/mame-runtume-ts/res/emsdk res/emsdk
mkdir -p .cache && ln -s ~/dev/mame-runtume-ts/.cache/mame0161-source .cache/mame0161-source

# regression for the patch relocation (ROM-free)
EMSDK_DIR="$PWD/res/emsdk" npm run probe:mame:tiny -- "$PWD/.cache/mame0161-source"

# family build from the committed pair (your new mode; adjust to what you implement)
EMSDK_DIR="$PWD/res/emsdk" MAME_PROBE_KIND=family-pair scripts/probe-mame0161-tiny.sh neogeo

# checks
npm run check && npm test
```

The source cache has the probe patches applied in place from M0; the
scripts already detect an applied patch and skip it. If you need a clean
tree, unpack `~/dev/mame-runtume-ts/res/mame0161s.zip`
into a new directory under `.cache/` rather than touching the shared one.
