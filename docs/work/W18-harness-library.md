# W18 — Harness: drop-first library view

Lane: **TypeScript**. Branch: `wp/w18-harness-library`. Milestone: post-1.0 polish
of the §11 page; the runtime library is unchanged.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W18 | Harness library view: zip-driven identification, per-game start | `harness/`, `scripts/serve-harness.ts` | W13c | §11 | T | — |

## 2. Why

The release-owner walkthrough (2026-10-21) found the page unusable by
someone who does not already know MAME short names or which family build a
game belongs to. Both are packaging facts the page can derive: a zip's
basename is the MAME short name, every family build's `build.json` lists its
machines, and `romsets/<machine>.json` names the title and every companion
archive with its role. The user's only job should be to bring zips.

## 3. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §11 and §11.1 (amended for
this package), §10.5 (`RomSetMetadata`: `description`, `archives` with
roles, `bios`, `defaultBios`, `dipswitches`), §2.3 (`ArcadeStartConfig`),
§12 M7 and M8.

On `main`: `harness/harness.ts` and `harness/index.html` (yours to
restructure), `scripts/serve-harness.ts` (`/builds.json`, `/mame/<family>/`
routes, `--page`), `src/RomSetAudit/`, and the three browser tests that drive
the page: `tests/browser/29-harness-preload.test.ts`,
`34-harness-cabinet.test.ts`, `37-harness-selectors.test.ts`. Those tests
are yours to update to the new page; keep each one's purpose and its
environment-gated production case.

## 4. Write set

Exclusive: `harness/`, `scripts/serve-harness.ts`, `tests/browser/29-*`,
`34-*`, `37-*`, and a new `tests/browser/38-harness-library.test.ts`.
Nothing under `src/` and no spec test.

## 5. Deliverables

1. **Index.** On load the page fetches `/builds.json`, then each listed
   family's `build.json`, and builds a map from machine short name to
   family. A `?family=<name>` query (or several, comma-separated) limits the
   index to those builds; this is the seed for a page dedicated to one
   family if download time warrants it. Families whose `build.json` fails to
   load are reported in the page, not fatal.
2. **Drop-first identification.** Zips dropped or picked anywhere on the
   page are resolved by basename (case-folded, `.zip` stripped) against the
   index. Recognised names fetch `romsets/<machine>.json` and render a
   library card: title (`description`), family, and a per-archive line for
   every entry of `archives` showing present or missing by name. Unknown
   names render a card stating the name is not a machine of any served
   build. Archives that are companions (BIOS, parent, samples) of a dropped
   game rather than games themselves attach to that card, not to their own.
3. **Store and audit without a separate step.** Confirming is one action
   per card or one "store all" action; the audit runs immediately after
   storing and its verdict replaces the present/missing lines (ok, bad with
   the offending file, incomplete with the missing archive). Archives already
   in `ArcadeRomStore` from an earlier visit count as present, so the
   library repopulates from the store on load.
4. **Start per game.** Each card with an ok audit has its own Start. The
   family, machine and free-text BIOS inputs are removed. The BIOS
   `<select>` and DIP selectors from W13c appear inside the card only when
   the metadata has them, with the same semantics (page state, restart
   action, defaults). Only one machine runs at a time; starting another
   stops the current one through the cabinet's existing path.
5. **Layout.** Canvas and cabinet controls stay. ROM audit and log become
   collapsible details closed by default. The page must remain usable at
   phone width (no horizontal scroll) because the release owner tests it
   from other LAN devices.
6. **Preload path.** A preload config still works: its archives are loaded
   as if dropped, its `machine` card is selected, and `autostart` behaves
   as before.
7. **Privacy.** Names shown come from served metadata or the user's own
   file names. No ROM identity in any tracked file; the tests' synthetic
   families invent machine names and titles.
8. **Tests.** `38-harness-library.test.ts`: serve a synthetic build root
   with two families and three machines (one with a parent, one with a BIOS
   list and a DIP switch, one standalone) through `startHarnessServer`; drop
   a game zip without its parent and assert the card names the missing
   parent; drop the parent and assert the audit turns ok and Start enables;
   drop an unknown basename and assert the unknown card; load with
   `?family=` naming one family and assert a machine of the other family is
   reported unknown; start a scripted cabinet from a card with one changed
   DIP and assert the received start config (pattern in test 37). Keep the
   existing gated production cases in 29, 34 and 37 passing against the
   real build via `ARCADE_PRELOAD_CONFIG`.

## 6. Contracts and doubles

None new. `window.__arcadeHarnessLastStartConfig` stays as the test hook.

## 7. Definition of ready for review

`docs/work/README.md` rule 8, plus the merge note must include a
`page.screenshot` of the library view with the synthetic machines, saved
under the ignored `res/` tree and described (not attached) in the note.

## 8. Repository rules that bite here

- Nothing under `res/` or `dist/mame/` may be referenced by name in a
  tracked file; the real build is reached only through `ARCADE_PRELOAD_CONFIG`.
- No attribution lines in commits.
- Do not run `npm run build`, `npm run clean` or `build-mame` in the
  worktree.

## 9. Commands

```sh
npm install
npm run check && npm test
npm run test:browser
ARCADE_PRELOAD_CONFIG=<private config> npm run test:browser
```
