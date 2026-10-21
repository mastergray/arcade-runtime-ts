# W13b — Harness: cabinet page with ROM picker, ROM store and save controls

Lane: **TypeScript**. Branch: `wp/w13b-harness-cabinet`. Milestone: M7.
Starts after W12 has merged. W13a delivered the server and the preload
page; this package turns that page into a full cabinet.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W13 | Harness and preload: `serve-harness.ts --preload`, `harness/` | `scripts/serve-harness.ts`, `harness/` | W11 (minimal page), W12 (cabinet page) | §11 | T | M1, M7 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §11 and §11.1 (the page
now gets the file picker §11.1 defers to this package), §10.6
(`ArcadeCabinet`), §10.7 (`ArcadeRomStore`), §10.5 (the audit report the
page renders), §0.3 (nothing the harness does may host, link or persist
ROMs beyond the user's own browser), §12 M7's acceptance row and §14.1
flows 2, 3, 7 and 8.

On `main`: `harness/harness.ts` and `harness/index.html` (yours to
extend), `scripts/serve-harness.ts` (yours; it needs no new routes unless
you find one), `src/ArcadeCabinet/`, `src/ArcadeRomStore/`,
`tests/browser/29-harness-preload.test.ts` and
`tests/browser/31-arcade-cabinet.test.ts` (patterns for driving the page
and the cabinet in Chromium).

## 3. Write set

Exclusive: `harness/` and `scripts/serve-harness.ts`, plus your tests:
`tests/browser/34-harness-cabinet.test.ts` (synthetic zips and romsets as
in test 29, plus one case gated on `ARCADE_PRELOAD_CONFIG`) and additions
to `tests/spec/26-preload-config.test.ts` only if the config shape grows
(it should not).

## 4. Deliverables

1. **Cabinet composition.** The page constructs `ArcadeCabinet.init`
   instead of a bare player: `ArcadeStorage` keyed by
   `<family>/<machine>`, `ArcadeRomStore`, keyboard and gamepads enabled,
   `autosave` as a checkbox (default off).
2. **ROM picker and store.** A file input (multiple) and a drop zone.
   Picked zips are shown with name and size, put into the `ArcadeRomStore`
   after the user confirms, and the store's contents are listed with a
   remove button and a "clear store" button. A game is started from
   store entries by basename (the cabinet resolves bare basenames from the
   store) or from a preload. The audit panel from W13a renders the report
   before start for either path, naming each missing archive with its
   role so the user knows whether to supply a game, parent, BIOS, sample
   or device zip.
3. **Save controls.** Buttons for save state, load state (slot `quick`),
   persist now, clear saves; status text reflecting `save()` results and
   `OVERLAY_INCOMPATIBLE` with a "clear saves and retry" choice that the
   user must click (the harness never clears on its own).
4. **Corner menu.** Fullscreen, sound mute/unmute, soft reset, hard reset,
   keyboard and gamepad toggles. Connected gamepads are listed from
   `GamepadSource.players`.
5. **Privacy.** The page shows basenames only; nothing it stores leaves
   the browser; no URL to a ROM ever appears in the page source. Say so
   in `harness/README.md`.
6. **Tests.** The synthetic case: pick two generated zips, confirm, see
   them listed, start, see the audit report and a frame from a
   `FakeArcadeSession`-free path (use the real cabinet with a scripted
   adapter if the real build is absent; the pattern in test 31 shows
   how), remove one, clear the store. The gated case: the real build via
   preload, start, quick save, persist, clear saves, and restart.

## 5. Contracts and doubles

The harness is a consumer; it uses only the root export. Browser tests
use `tests/support/TestPageServer.ts` or the harness server itself.

## 6. Definition of ready for review

`docs/work/README.md` rule 8, plus a hand-run of
`npm run harness -- --preload res/preload.json` and of the picker path
with two of your own lawful zips, described in the merge note without
naming them.

## 7. Repository rules that bite here

- No ROM identity in tracked files; the committed example config keeps
  placeholder names.
- The harness is excluded from the package and never writes to `dist/`.
- Do not run `npm run build` or `npm run clean`.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run harness -- --preload res/preload.json
npm run check && npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```
