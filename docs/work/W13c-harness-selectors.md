# W13c — Harness: BIOS and DIP selectors

Lane: **TypeScript**. Branch: `wp/w13c-harness-selectors`. Milestone: M8 (harness half).
Starts after W16 has merged. W13b delivered the cabinet page; this package
adds the selectors §11 defers to "once M8 exists".

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W13 | Harness and preload: `serve-harness.ts --preload`, `harness/` | `scripts/serve-harness.ts`, `harness/` | W16 (selectors) | §11 | T | M8 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §11 and §11.1, §4.5
(the generated DIP cfg and what `dipswitches` names), §2.3
(`ArcadeStartConfig`, `MachineInfo.bios`, `BiosOption`), §10.5
(`RomSetMetadata.bios`, `defaultBios`, `dipswitches`) and §12 M8's row,
which fixes the rule: DIP and BIOS choices are page state passed on every
start, never overlay state.

On `main`: `harness/harness.ts` and `harness/index.html` (yours to extend;
the free-text `#bios` input and the preload `dipswitches` pass-through are
the starting point), `src/DipConfig/dipConfigFor.ts` (the names a selection
must use), `src/RomSetAudit/types.ts`, `tests/browser/34-harness-cabinet.test.ts`
and `tests/browser/35-dip-switches.test.ts` (how the real build is driven
and why its checkpoints sit after the Namco self test).

## 3. Write set

Exclusive: `harness/` and `scripts/serve-harness.ts`, plus your test
`tests/browser/37-harness-selectors.test.ts` (synthetic romsets as in
test 34, plus one case gated on `ARCADE_PRELOAD_CONFIG`). Nothing under
`src/` and no other test file.

## 4. Deliverables

1. **Metadata read.** When the family and machine inputs name a machine
   whose `romsets/<machine>.json` the served build has, the page fetches
   it and renders the selectors from it; when it does not exist, the
   selectors are hidden and the free-text BIOS input stays as today.
2. **BIOS selector.** A `<select>` listing `metadata.bios` with
   `defaultBios` preselected and labelled "(default)". The chosen value
   replaces the free-text input in the start config; an empty choice
   omits `bios`. A preload config's `bios` preselects the option.
3. **DIP selectors.** One `<select>` per `metadata.dipswitches` entry,
   labelled with the switch name, listing its settings with the default
   preselected and labelled "(default)". Only switches whose choice
   differs from the default go into `dipswitches`; a "reset to defaults"
   button clears them. A preload config's `dipswitches` preselects the
   options it names; names it uses that the metadata lacks are shown as a
   warning, not sent.
4. **Restart semantics.** Changing a selector while a machine runs
   enables a "restart with these switches" action; selections are page
   state only and never written to storage (§12 M8).
5. **Privacy.** The page shows names from the served metadata only; no
   ROM identity is added to any tracked file; the test's synthetic
   romsets invent their own switch names.
6. **Tests.** The synthetic case: a served fake build with one romset
   carrying two BIOS options and two switches, select a BIOS and one
   setting, start a scripted cabinet (pattern in test 34), and assert the
   start config the cabinet received carries exactly that `bios` and that
   one `dipswitches` entry; reset to defaults and assert an empty
   `dipswitches`. The gated case: the real build via preload, pick a
   non-default setting, start, and assert the generated selection reached
   the session (the status text or a page-exposed last start config is
   enough; pixel verification is test 35's job).

## 5. Contracts and doubles

None new. The page keeps using `ArcadeCabinet`; `tests/support/` doubles
cover the scripted adapter.

## 6. Definition of ready for review

`docs/work/README.md` rule 8.

## 7. Repository rules that bite here

- Nothing under `res/` or `dist/mame/` may be referenced by name in a
  tracked file.
- No attribution lines in commits.
- Do not run `npm run build`, `npm run clean` or `build-mame` in the
  worktree.

## 8. Commands

```sh
npm install
npm run check && npm test
ARCADE_PRELOAD_CONFIG=<private config> npm run test:browser
```
