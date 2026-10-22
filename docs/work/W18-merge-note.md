# W18 merge note — harness drop-first library view

## What changed

- `harness/harness.ts` now fetches `/builds.json` and each selected family's
  `build.json`, validates the build documents, and indexes machine basenames.
  Repeated or comma-separated `?family=` values limit that index. A family whose
  build document cannot be loaded is reported in the page without preventing
  the remaining families from loading.
- Dropped, picked, preloaded, and browser-stored zip basenames populate a game
  library. Per-machine metadata supplies the title, family, expected archives,
  BIOS choices, and DIP switches. Parent, BIOS, sample, and device archives are
  attached to the game cards that need them instead of being presented as
  independent games.
- Each card offers one Store and check action, while the page offers Store all
  and check. A check runs immediately after storage. Its archive rows use plain
  messages such as `Needs <archive>` and `Wrong version of file <file>`; an ok
  card gets its own Start button. Stored archives restore and are checked when
  the page is revisited.
- BIOS and DIP controls now live only in the cards whose metadata declares
  them. Their defaults, non-default-only DIP start config, explicit reset, and
  restart behavior remain intact. Starting a different card destroys the one
  current cabinet before creating the next one, so only one game owns the
  canvas and cabinet controls.
- The preload selects its machine's card, supplies its sanitized archive URLs,
  runs the same metadata check, and preserves the gesture-gated autostart path.
- `harness/index.html` is now a responsive library layout. It retains the
  canvas and cabinet controls, uses card-local plain-language status, and puts
  the detailed file check and technical log in closed details elements. The
  tested 390 px viewport has no horizontal scroll.
- `scripts/serve-harness.ts` required no change: its existing `/builds.json`,
  `/mame/<family>/`, sanitized preload, and `--page` routes already provide the
  complete W18 server surface.

## Browser-test changes

- `29-harness-preload.test.ts` now verifies that a sanitized synthetic preload
  selects a titled game card, shows its family, omits irrelevant selectors,
  completes the detailed check, and enables that card's Start. Its gated case
  starts the selected production card and still requires a real first frame and
  attached keyboard controls.
- `34-harness-cabinet.test.ts` now begins with a machine-named synthetic zip,
  observes its parent on the same card, uses the card's single Store and check
  action, then exercises the unchanged incompatible-save recovery, frame,
  per-file removal, and remove-all behavior. Its gated case still covers start,
  quick state, persistence, save clearing, hard restart, and independence from
  browser-stored game files.
- `37-harness-selectors.test.ts` now finds BIOS and DIP selectors inside the
  selected card, verifies valid preload choices and a stale-choice warning,
  starts with the exact non-default page state, resets the DIP choices, and
  explicitly restarts. Its gated case still proves a generated non-default DIP
  value reaches the production session through
  `window.__arcadeHarnessLastStartConfig`.
- New `38-harness-library.test.ts` serves two synthetic families with three
  invented machines. It verifies a named missing parent, companion attachment,
  an ok check and enabled Start after the parent arrives, an unknown-basename
  card, exclusion through `?family=`, three simultaneous game cards, and a
  changed DIP in the scripted adapter's received start config. It also asserts
  no horizontal overflow at 390 px and writes the requested screenshot.

## Verification

- `npm run check`: both source and test TypeScript checks passed.
- `npm test`: `files=30 cases=504 passed=502 failed=0 skipped=2`.
- `npm run test:browser`: `files=31 cases=53 passed=25 failed=0 skipped=28`.
- `ARCADE_PRELOAD_CONFIG=<private config> npm run test:browser`:
  `files=31 cases=58 passed=35 failed=0 skipped=23`.

The first gated invocation was prevented before test execution by the sandbox
rejecting every loopback bind with `EPERM`, including unchanged synthetic cases.
The same gated suite was then run with the environment value injected through a
temporary untracked Node preload so the sandbox could invoke its permitted
browser command form; it produced the passing gated tally above. The temporary
file was removed.

## Screenshot

The ignored `res/w18-library.png` was captured with `page.screenshot` at 390 px
wide from the synthetic W18 case. It shows the drop target, three responsive
game cards across the two invented families, a child and parent both ready, a
standalone zip awaiting storage, a ready BIOS/DIP card with a changed setting,
an unknown-file card, the retained canvas, browser-stored files, cabinet menu,
and both diagnostic details closed. The full page fits without horizontal
scrolling.

## Integrator-owned follow-up

- No `src/` line is needed.
- `docs/arcade-runtime-spec.md` §11.1 still says the preload fills retired
  family/machine/BIOS selectors and that the file picker arrives with W13b.
  Please replace those two historical statements with the W18 behavior: preload
  archives populate and select the machine card, while the drop/picker library
  is the default no-preload view. No other named spec section appeared wrong.
