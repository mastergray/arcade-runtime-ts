# W20 merge note — Audit strictness modes

## Delivered

- ROM-set extraction carries each `-listxml` ROM region into an additive
  `roms[].region` field. The field remains optional in `isRomSetMetadata`, so
  metadata generated before W20 still validates. The new field is appended
  after every prior ROM field; no existing extractor field was reordered.
- `RomSetAudit.audit` accepts `strictness: "strict" | "mame"`, defaults to
  `"strict"`, validates the option as `INVALID_CONFIG`, and adds `strictness`
  and `warnings` to every report.
- The pure exported `classifyAuditFile` decision classifies `ok` and
  `optional-missing` as accepted, required failures in a region whose tag ends
  in `plds` as warnings only in `"mame"` mode, and every other required defect
  as a failure.
- `ArcadeGameConfig.auditStrictness` is validated and passed to both explicit
  and pre-start player audits. An `ok` report with warnings starts normally and
  remains available through `player.audit()`.
- `ArcadeCabinet.init` preserves the game field through its existing game-copy
  boundary, and picked blobs are still stored only after `report.status ===
  "ok"`.
- The harness has one persisted, folded library setting labelled “File check:
  exact 0.161 set / what MAME accepts”. It rechecks every card, passes the mode
  into each cabinet start, enables Start for accepted warnings, renders the
  requested card verdict, and lists warned files and their true statuses in the
  detailed check.

## Pinned-source evidence and classification choice

The pinned source was read at these lines:

- `src/emu/info.c:539-566` builds each `<rom>` element and unconditionally
  appends its region. The decisive lines are:

  ```cpp
  // append a region name
  strcatprintf(output," region=\"%s\"", ROMREGION_GETTAG(region));
  ```

- `src/mame/drivers/cps1.c:3336,3343,3800,3807,3812` declares the documentary
  programmable-logic regions. Contrary to the brief's literal tag, this driver
  uses three tags ending in `plds`:

  ```cpp
  ROM_REGION( 0x0200, "aboardplds", 0 )
  ROM_REGION( 0x0200, "bboardplds", 0 )
  ROM_REGION( 0x0200, "cboardplds", 0 )
  ```

- `src/emu/romload.c:497-503` increments `warnings` for a wrong length, and
  lines 513-519 increment `warnings` for wrong checksums. Lines 567-573 say:

  ```cpp
  /* if we had warnings, output them, but continue */
  ```

- `src/emu/romload.c:446-468` distinguishes optional/no-dump absence from every
  other missing file. For a non-optional dumped file, the exact branch is:

  ```cpp
  /* anything else is bad */
  romdata->errors++;
  ```

  Lines 559-565 then say:

  ```cpp
  /* if we had errors, they are fatal */
  ```

This source does not make the brief's broad claim exact: wrong length and
checksum are warnings for every region, while a missing required dump is an
error for every region. A policy based on that global warning/error split would
also accept a wrong program dump, directly contradicting W20's required test,
and it would still reject a missing PLD dump. W20 therefore implements the
narrow product policy requested by the deliverables: only required defects in
region tags ending in `plds` are demoted in `"mame"` mode. The suffix covers the
actual `cps1.c` tags as well as drivers that use the literal `plds`. The spec
should describe this as the runtime's compatibility policy rather than as the
literal 0.161 loader distinction.

## Strict compatibility

Every existing audit fixture retains the same archive rows, file rows,
unexpected rows, problems and overall status under the default strict mode.
The only report additions are `strictness: "strict"` and `warnings: []`.
Explicit end-to-end comparisons cover strict and MAME-compatible reports for
wrong-size, wrong-checksum and missing files. Program-region defects fail in
both modes; PLD-region defects keep their true per-file status and become
warnings only in MAME-compatible mode.

## Browser verification approach

The W20 extension to `tests/browser/38-harness-library.test.ts` uses only its
disposable synthetic build tree and generated zip bytes. It first observes the
default strict rejection of a wrong-size PLD entry, switches the folded library
setting to MAME-compatible mode, observes an `ok` report with one warning and
an enabled Start button, checks the detailed warning row, starts through the
cabinet, and opens a second page to verify the persisted choice. No ignored
configuration or external content is required.

## Integrator-owned lines

`src/index.ts` should add these exports from `./RomSetAudit/types.js` beside the
existing metadata/report exports:

```ts
classifyAuditFile,
isAuditStrictness,
type AuditFileDisposition,
type AuditStrictness,
type RomFileStatus,
```

This exposes the requested pure decision and the public type used by
`ArcadeGameConfig` without editing the integrator-owned entry point on this
branch.

## Exact spec sentences for integration

### Section 10.5

> Each `roms[]` row may additionally carry `region`, the string emitted by
> `-listxml`; metadata generated before this field existed remains valid.

> `RomSetAudit.audit(metadata, roms, { bios?, strictness? })` accepts
> `strictness: "strict" | "mame"` and defaults to `"strict"`. Every report
> carries the selected `strictness` and a `warnings` array of `{ name, archive,
> status }` rows. In `"mame"` mode, a required file whose region tag ends in
> `plds` and whose true status is `missing`, `wrong-size` or `wrong-crc` is
> reported as a warning and does not lower the overall status; all other
> required-file defects remain failures. Strict mode produces no warnings and
> retains the previous verdict rules.

### Section 9

> `ArcadeGameConfig` accepts `auditStrictness?: "strict" | "mame"`, defaulting
> to `"strict"`; `audit()` and the pre-start audit use that mode, and `start()`
> accepts an `ok` report even when its `warnings` array is non-empty.

### Section 10.6

> `ArcadeCabinet` forwards `game.auditStrictness` unchanged to its player and
> stores picked blobs only after an audit whose overall status is `ok`, including
> an `ok` MAME-compatible report with warnings.

### Section 11

> The harness has one persisted library-wide setting, “File check: exact 0.161
> set / what MAME accepts”, which controls every card audit and every cabinet
> start. An `ok` report with warnings reads “Ready to play (N files differ from
> 0.161; MAME ignores them)”, enables Start, and lists each warned file and its
> true status in the detailed file check; strict-mode wording is unchanged.

## Metadata regeneration

No family build or metadata regeneration was run, as the brief prohibits family
builds on this package branch. The integrator should regenerate all served
families after merge and verify that the only JSON differences are additive
`roms[].region` fields.

## Verification

- `npm run check && npm test`: passed in the final run; 521 spec cases passed,
  0 failed and 2 environment-gated cases skipped.
- `npm run test:browser`: passed in the final run; 25 browser cases passed, 0
  failed and 28 configuration-gated cases skipped.
- `npm test -- --filter 'RomSetAudit|ArcadePlayer|ArcadeCabinet|romsets
  extraction'`: rejected with the runner's usage message because this repository
  does not implement a filter argument; the full spec suite was used instead.
- An intermediate `npm test` exposed one report-predicate fixture mismatch,
  which was corrected. Two diagnostic reruns also saw sandbox `EPERM` failures
  while spawning the command test or opening a loopback listener; the final full
  spec and browser runs both completed without those transient refusals.
- The first `npm run test:browser` reached the W20 case but found the new select
  correctly hidden inside its closed fold. The test was corrected to open the
  fold as a user would; the final browser run passed.

No build, clean, family-build, rebase or push command was run. The branch changes
only the W20 write set, its assigned tests and this merge note. No external
content identity or local absolute path is tracked.
