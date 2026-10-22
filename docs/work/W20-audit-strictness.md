# W20 — Audit strictness modes

Lane: **TypeScript**. Branch: `wp/w20-audit-strictness`. Milestone: M23.

`RomSetAudit` treats every non-optional file as a hard requirement and
`ArcadePlayer` refuses to start a set whose report is not `ok`. MAME 0.161
itself is more lenient: a file in a programmable-logic (`plds`) region that
is missing or has the wrong length or CRC produces a warning screen, not a
fatal error, because those dumps document the board and are never read by
the emulation. Several lawful CPS-1 archives from later MAME generations
differ from 0.161 only in such a PLD redump and are therefore refused by
the runtime although the emulator would run them. This package makes the
strictness a mode, with today's behaviour the default.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W20 | Audit strictness: ROM `region` in metadata, `strictness` option on the audit, pass-through from player and cabinet, harness toggle | `scripts/mame-build/romsets.ts` (region only), `src/RomSetAudit/`, `src/ArcadePlayer/` (option only), `src/ArcadeCabinet/` (pass-through only), `harness/` (toggle and verdict wording only) | W16, W18 | §10.5, §9, §11 | T | M23 |

Write set: the files above plus your tests: additions to
`tests/spec/28-romsets-extract.test.ts`, `tests/spec/19-romset-metadata.test.ts`,
`tests/spec/19-romset-audit.test.ts`, `tests/spec/24-arcade-player.test.ts`,
the cabinet spec test, and `tests/browser/38-harness-library.test.ts`
(the toggle, if a case can be written without a private config; say so if
not). `src/shared.types.ts` is frozen and needs no change: the option lives
on `ArcadeGameConfig` (`src/ArcadePlayer/types.ts`) and the cabinet config
that wraps it.

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §10.5 (metadata shape and
report), §9 (player start and the `ROM_SET_INVALID` rejection), §10.6
(cabinet forwards the audit), §11 (harness cards and verdicts), §12 M6/M7
rows that mention the audit.

Facts from the pinned source, which you confirm before relying on them:
`-listxml` emits `region="…"` on every `<rom>` element (the synthetic XML in
test 28 already carries it); PLD dumps are declared under
`ROM_REGION( …, "plds", 0 )` in the CPS-1 driver (`src/mame/drivers/cps1.c`)
and elsewhere; and in `src/emu/romload.c` a wrong-length or bad-CRC ROM
increments `m_warnings` while a missing required ROM increments
`m_errors`, so only the latter stops the machine. Cite the lines you read in
the merge note. Decide from the source whether the lenient mode should be
defined by region name (`plds`) or by MAME's own warning/error distinction
for every file; prefer the narrower definition unless the source makes the
broad one exact, and explain the choice.

## 3. Deliverables

1. **Metadata.** `romsets.ts` carries each ROM's `region` into the
   per-machine JSON (`roms[].region`, additive, optional in the predicate
   so metadata generated before this package still validates). Keep the
   extractor's existing output otherwise byte-identical: the integrator
   regenerates the fifteen families' `romsets/` after the merge and diffs
   them, so no other field may move.
2. **Audit.** `RomSetAudit.audit(metadata, roms, { bios?, strictness? })`
   with `strictness: "strict" | "mame"`, default `"strict"` (today's
   behaviour, bit for bit). In `"mame"` mode a file that MAME would only
   warn about keeps its true per-file status (`wrong-size`, `wrong-crc`,
   `missing`) but does not lower the overall `status`, and the report
   gains `strictness` (the mode used) and `warnings`, the list of such
   files (`{ name, archive, status }`), empty in strict mode. Both new
   report fields are additive. Invalid `strictness` values throw
   `INVALID_CONFIG` naming the field. Put the per-file classification in a
   pure exported decision in `src/RomSetAudit/types.ts` beside the other
   predicates so it is testable without a zip.
3. **Player and cabinet.** `ArcadeGameConfig.auditStrictness?: "strict" | "mame"`
   (default strict). The player passes it to the audit it performs while
   starting, and a `"mame"` report with warnings starts the machine; the
   warnings are surfaced on the player's audit result so a page can show
   them. The cabinet forwards the field unchanged and still stores picked
   blobs only after a report whose status is `ok`.
4. **Harness.** One library-wide setting, "File check: exact 0.161 set /
   what MAME accepts", persisted like the other folded settings, applied
   to every card's check and to the start config. A card whose report is
   `ok` with warnings reads "ready to play (N files differ from 0.161;
   MAME ignores them)" and enables Start; the detailed check lists the
   warned files with their status. Strict mode wording is unchanged.
5. **Tests.** Extract: region parsed from the synthetic XML and absent
   when the attribute is absent. Metadata predicate: accepts with and
   without `region`, rejects a non-string. Audit pure decision: a
   `plds`-region wrong-size file is a warning in `"mame"` mode and a
   failure in `"strict"`; a program ROM with the same defect fails in both;
   a missing `plds` file is a warning in `"mame"`. Audit end to end over
   the existing synthetic zips: both modes, report fields exact. Player:
   default rejects with `ROM_SET_INVALID`, `"mame"` starts and exposes the
   warnings. Cabinet: field forwarded. Harness browser case if feasible.

## 4. Contracts and doubles

`src/shared.types.ts` is frozen. Existing `FakeModuleLoader`, synthetic
zips and metadata fixtures in the tests named above.

## 5. Definition of ready for review

`docs/work/README.md` rule 8, plus a merge note that quotes the
`romload.c` and driver lines behind the classification, states the exact
spec sentences for §10.5, §9, §10.6 and §11 (the integrator applies them),
and records that strict mode's reports are unchanged for every existing
test fixture.

## 6. Repository rules that bite here

- No game titles, set names from any library, ROM hashes or private paths
  in tracked files or commit messages; refer to boards by driver name
  (`cps1.c`) and to files by their role (a PLD dump).
- Do not run `npm run build`, `npm run clean` or any family build; the
  extractor change is verified over the synthetic XML only.
- No attribution lines in commits. Do not rebase; do not stop on a refused
  git command, report it in the merge note instead.

## 7. Commands

```sh
npm install
npm run check && npm test
```
