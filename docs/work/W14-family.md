# W14 — One family build (`W14a` … `W14f`)

Lane: **native**. Branch: `wp/w14<letter>-<family>`. Milestone: M2.
One package per family; the agent's prompt names which. Each package is
independent of the others and of everything in the TypeScript lane.

| Package | Family | §4.6 driver sources (0.161) |
| ------- | ------ | --------------------------- |
| W14a | `cps2` | `drivers/cps2.c`, `machine/cps2crpt.c`, `video/cps1.c` |
| W14b | `namco-classic` | `drivers/pacman.c`, `galaga.c`, `galaxian.c`, `rallyx.c`, `mappy.c`, `toypop.c`, `gaplus.c`, `skykid.c`, `baraduke.c`, `pacland.c`, `polepos.c` |
| W14c | `namco-s1` | `drivers/namcos1.c`, `drivers/namcos86.c` with their `machine/` and `video/` units |
| W14d | `namco-s2` | `drivers/namcos2.c`, `machine/namcos2.c`, `machine/namcoic.c`, `video/namcos2.c`, `video/c45.c` |
| W14e | `taito-classic` | `drivers/taitosj.c`, `bublbobl.c`, `arkanoid.c`, `tnzs.c`, `slapfght.c`, `flstory.c`, `lkage.c`, `retofinv.c`, `nycaptor.c`, `buggychl.c`, `gladiatr.c`, `mexico86.c`, `superqix.c` |
| W14f | `taito-16` | `drivers/rastan.c`, `opwolf.c`, `rainbow.c`, `volfied.c`, `asuka.c`, `taito_l.c`, `taito_x.c`, `taito_b.c`, `taito_f2.c`, `taito_h.c` |

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W14a–f | One package per remaining family: target pair, build file, F1–F6 record | `mame/targets/<family>.*`, `mame/builds/<family>.json`, `docs/probes/families/<family>.md` | W2 | §4.6, §13.1 | N | M2 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.6 in full (your family's
row and the "Hardware characteristics" bullets), §4.1 (the build pipeline
you run), §13.1 (F1–F11; you answer F1–F6 now), §12 (M2's acceptance row).
Then `mame/targets/README.md` and the three committed pairs there, which
are the pattern; `mame/builds/neogeo.json`; `mame/README.md` ("Production
family builds"); and `docs/probes/families/neogeo.md` for the record
format.

## 3. Write set

Exclusive: `mame/targets/<family>.lua`, `mame/targets/<family>.lst`,
`mame/builds/<family>.json`, `docs/probes/families/<family>.md`, plus an
entry you add to `tests/spec/04-mame-family-targets.test.ts`'s
`FAMILY_TARGETS` table for your family (that table is shared across the
W14 packages; add one row and nothing else, so merges stay trivial).

Nothing under `src/`, `scripts/` or `mame/patches/`. If
`scripts/build-mame.ts` cannot build your family as written, stop and
write the reason into your merge note rather than editing it.

## 4. Deliverables

1. **Target pair.** `mame/targets/<family>.lua` with the cores and
   compilation units copied from the family's blocks in the pinned
   source's `scripts/target/mame/mame.lua` (search for each driver
   source; take every `CPUS`, `SOUNDS`, `MACHINES`, `BUSES` and `files`
   line those drivers need; the bus library must be non-empty, see the
   comment in `cps1.lua`). Project and function names follow the
   committed pattern (`mame_<family>` with hyphens turned to underscores
   where Lua needs an identifier). `mame/targets/<family>.lst` derived
   from the driver sources exactly as `mame/targets/README.md` describes,
   with the derivation command in its header comment and the source
   annotation on every line.
2. **Build file.** `mame/builds/<family>.json` in the W2 shape with
   `memoryPages: 4096` unless F3 evidence says otherwise.
3. **Build it.** `node --import tsx scripts/build-mame.ts <family> --jobs 4`
   from your worktree (the pipeline unpacks the pinned archive into
   `.cache/mame/mame0161/` on first use). It must finish with
   `dist/mame/<family>/{mame<family>.js,.wasm,build.json,romsets/,notices/}`
   and the threading gate passing. Fix target problems by editing the
   pair, never the pipeline.
4. **F1–F6 record** in `docs/probes/families/<family>.md`, one section
   per probe id with the question from §13.1 restated:
   - F1: command, wall time, `-listfull` machine count, any Lua/list
     corrections you needed and why.
   - F2: raw, gzip -9 and Brotli-11 sizes of the `.wasm` (use the method
     in `docs/probes/mame0161/family-sizes.md`); for `namco-classic`, also
     build once without `galaxian.c` and report both sizes so §4.6's
     `galaxian-misc` question is answered.
   - F3: the largest ROM set the family's `romsets/` metadata describes
     (sum of ROM sizes, machine name may be stated since it is public MAME
     metadata), versus `memoryPages × 65536 × 0.75`; say whether any
     machine fails the §5 budget estimate.
   - F4, F5, F6: these need a lawful private set. If
     `ARCADE_PRELOAD_CONFIG` names one for this family, run the W4
     adapter's browser case against your build with it and record
     time-to-first-frame, refresh and geometry, and a 60-second
     emulated-time ratio on desktop (reuse `tests/browser/27-mame-adapter.test.ts`
     mechanics in a throwaway script; do not commit a new test). If no
     set is available, write "pending private set" under each and list
     exactly what measurement the integrator should run later.
5. **Test row.** Add your family to `FAMILY_TARGETS` in
   `tests/spec/04-mame-family-targets.test.ts` with the derived machine
   count.

## 5. Contracts and doubles

None from `src/`. §4.1's contract applies: the pair plus the build file is
the whole input to `build-mame.ts`.

## 6. Definition of ready for review

`docs/work/README.md` rule 8, plus: the build completed from your
worktree and the artifact directory listing is in the merge note with the
`build.json` machine count, `wasm` byte size and `buildId`; the F1–F6
record exists with every section present.

## 7. Repository rules that bite here

- The `.lst` names every public machine of the family, which is MAME
  metadata and fine; a *chosen test title*, ROM name, hash or local path
  is private and never appears in tracked files.
- Build output stays under ignored `dist/` and `.cache/`.
- Do not touch another family's files or the shared test table beyond
  your row.
- Commit messages: summary line, blank line, details; no attribution.

## 8. Commands

```sh
npm install
ln -sfn /home/mastergray/dev/mame-runtume-ts/res/emsdk res/emsdk
ln -sfn /home/mastergray/dev/mame-runtume-ts/res/mame0161s.zip res/mame0161s.zip
EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts <family> --jobs 4
npm run probe:mame:threading -- "$PWD/dist/mame/<family>/mame<family>"
npm run check && npm test
```
