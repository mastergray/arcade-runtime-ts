# W22 — The local desktop page (React, on the kit)

Lane: **web**. Branch: `wp/w22-local-desktop-page`. Milestone: M25.

Build the local page of `docs/ui-spec.md` §7 as a React page composed
from the W21 kit (`ui/kit`, `ui/focus`, `ui/tokens.css`) and wired to the
runtime package exactly as the developer harness is. The harness
(`harness/index.html`, `harness/harness.ts`) stays untouched and keeps
its tests; this page is a second page, `/ui/local`, with its own tests
(spec §6 decision 6). It is the page a player uses; the harness is the
developer's.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W22 | Local page: shell, games column, play surface, controller strip, menus and shortcuts, Import / Stored files / Log / File check / confirmations, slots, preference store, build entry, route, tests | `ui/local/**`, `ui/model/**`, `scripts/build-ui.ts` (second entry), the `/ui/local` route in `scripts/serve-harness.ts`, `tests/browser/40-local-page.test.ts`, `tests/spec/<next>-ui-preferences.test.ts` | W21 | `docs/ui-spec.md` §3 (L column), §6, §7; `docs/ui-design-language.md` | web | M25 |

## 2. Scope

In this package (everything in §7 that the runtime can do today):

- **The shell** (§7, §7.4): the kit's `Window` with title bar ("Arcade
  Library — <game or no game>", counts on the right), the menu bar
  Settings · State · View · Log, the fixed shortcuts (Pause/Resume,
  Mute/Unmute, Reset, the slot group, Fullscreen, Controller), the games
  column, the play surface, the controller strip, the status bar.
  Density `desktop`; the layout is the §7 three regions and a bar.
- **Games column** (§7.1): Import button; one accordion row per game
  the served builds know and the store or the private preload has an
  archive for, exactly the harness's card content folded as §7.1 says
  (closed row: icon, name, Play / Check / red word; open row: build
  line, archive lines, verdict, inline game info, File check / Remove /
  Import). Unknown archives get a "not a game" row with Remove. Footer:
  games found, ready count, files saved, Stored files link.
- **Play surface** (§7.2): the canvas through `ArcadeDisplay`, Size
  from the View menu (Fit / Stretch / Integer map to the display's
  scaling modes), PAUSED veil, idle prompt, fullscreen both ways.
- **Controller strip** (§7.3): the kit's `ControllerStrip` driven by the
  running machine: cabinet switches and operator keys from
  `machine.inputs`, six buttons with undeclared ones dimmed, presses
  through `player.input` (tap for keys and switches; hold while pressed
  for d-pad and buttons through the input channel the harness uses).
  Toggle from View and the status bar; default off when a keyboard or a
  pad is present, on otherwise.
- **State menu and slot group**: three named slots through
  `cabinet.quickSave(slot)` / `player.loadState(slot)` with the slot
  names `slot1` `slot2` `slot3`; each slot's timestamp (and a small
  canvas thumbnail captured at save time) kept in the preference store;
  Save changes = `cabinet.save()`; Reset = `player.reset("soft")`;
  Restart from power-on… = confirm, then `player.reset("hard")`; Clear
  saved play for this game… = confirm, then `cabinet.clearSaves()` plus
  the slot records; disabled with the harness's reasons when the driver
  cannot save.
- **View menu**: Controller view, Show FPS (the display's layout event
  rate or the player's frame counter, whichever the runtime exposes),
  Size, Fullscreen / Fullscreen stretched, Mode: Play (checked) and
  Mode: Presentation… **disabled** with the small text "next package".
- **Settings menu**: Settings… and Controls… **disabled** with "next
  package" (M26 / W23); Stored files… opens the Stored files modal.
- **Log menu**: Technical log… (the harness's log lines in the kit's
  `Terminal`, in a modal), Detailed file check… (the audit report for
  the selected or running game, as the harness renders it), Copy log.
- **Import modal** (§7.1, spec §3.2): drop zone (dropping anywhere on
  the page opens it), Choose files, the identification table (file,
  identified as, status, details), the companion notice, Store all and
  check, Close; stays open after Store all and check with rows
  updating to Stored / Pending (naming the companion) / Skip; second
  tab Stored files (every archive: size, which games use it, Remove,
  Remove all). The logic is the harness's W18 flow (`discoverArchives`,
  `chooseFiles`, `storeArchives`, `checkCard`, `removeStored`,
  `clearStored`) moved into `ui/model`, not rewritten.
- **Status bar**: the harness's status message and state word; video
  size and rate when running; keyboard / pads line (`gamepads.players`);
  auto-save on/off; the Controller toggle.
- **Preference store** `ui/model/preferences.ts`: one IndexedDB or
  localStorage record per browser (`global`: controller view, size, show
  FPS, auto-save) and one per game keyed like the overlay
  (`<family>/<machine>`: slot records). Field-by-field fallback to
  defaults. Typed, with a spec test. Export / import and the Settings
  dialog that shows it are W23.
- **Private preload** (`/preload.json`) is honoured as the harness
  honours it: preloaded archives count as present, the preload's game
  is selected, `autostart` arms the one-gesture start.
- **Keyboard and pad focus** through the kit's `FocusProvider`: Tab and
  arrows walk the menu bar, shortcuts, rows and dialog controls; the pad
  does the same while no game runs. While a game runs the pad belongs to
  the machine (the menu gesture is W24's).

Not in this package: Settings…, Controls… and Presentation… (W23 and
later), favourites, recent and search (not in 1.0), touch, phone
layouts, year and manufacturer (M27; show what metadata has today),
the presentation window.

## 3. Layout

```
ui/
  model/
    library.ts       builds index, metadata, store discovery, audit, card state (from harness.ts §Library)
    session.ts       cabinet lifecycle: start / stop / actions / status / log (from harness.ts §Session)
    preferences.ts   the preference store
    types.ts
  local/
    index.html       mounts #root, loads tokens.css and local.js
    main.tsx
    LocalPage.tsx    the shell
    GamesColumn.tsx  ImportModal.tsx  StoredFilesTab.tsx  PlaySurface.tsx  Strip.tsx
    menus.tsx        the four menus and the shortcuts, one definition used by both
    LogModal.tsx  FileCheckModal.tsx  Confirm uses the kit
```

Rules:

- The model is plain TypeScript with no React import: small classes or
  functions with a `subscribe` for the page, so it can be unit-tested in
  Node (the audit and store parts already have tests through the
  harness; reuse those test doubles). It imports the runtime package
  only through `src/index.ts`.
- The page is kit components plus layout; a new visual element means a
  new kit component or a documented addition to
  `docs/ui-design-language.md`, never page-local CSS for a thing the
  kit should own. Page layout CSS lives in `ui/local/local.css`, tokens
  only.
- Vocabulary is §6 and §7.4 verbatim.
- Stable `data-*` selectors on every control the later packages or
  tests will reach (menus, items, shortcuts, rows, row actions, modal
  controls, status cells); list them in the merge note.
- **No game titles, artwork or private names** in any tracked file, test
  or commit message. Tests use synthetic metadata the way
  `tests/browser/37` and `38` do, and an injected adapter boundary like
  the harness's `__arcadeHarnessAdapter` (name yours
  `__arcadeLocalAdapter`), so the page can be driven without ROMs.

## 4. Build, serve, run

- `scripts/build-ui.ts`: a second entry `ui/local/main.tsx` →
  `dist/ui/local.js`, copying `ui/local/index.html` to
  `dist/ui/local.html`; `buildUi` returns both bundle sizes.
- `scripts/serve-harness.ts`: `/ui/local` serves `dist/ui/local.html`
  the way `/ui/gallery` serves its index; nothing else changes.
- The page fetches `/builds.json`, `/mame/<family>/build.json`, the
  romsets metadata and `/preload.json` exactly as the harness does.

## 5. Tests

- `tests/spec/<next>-ui-preferences.test.ts`: defaults, field-by-field
  fallback over a partial or corrupt record, per-game keying, slot
  record round trip, with an in-memory storage double.
- `tests/browser/40-local-page.test.ts`, two cases in the pattern of 37
  and 38:
  1. **Synthetic**: build the UI into a temporary root, start the
     harness server with a temporary build root holding a synthetic
     family (`build.json` and romsets metadata, as 37 does) and the
     injected adapter; load `/ui/local`; prove: the column lists the
     synthetic game with the red word; dropping a synthetic archive
     through the Import modal turns the row into Check then Play; Play
     starts the injected adapter and the title bar, status bar and
     strip reflect running; Pause / Resume, Mute, Reset, the slot group
     (save then load shows a timestamp), Controller toggle, Size items,
     the Log modal, the File check modal, Clear saved play's
     confirmation, Stored files Remove; keyboard focus walks the menu
     bar and rows.
  2. **Production** (skips without `ARCADE_PRELOAD_CONFIG`): the real
     family build and private preload start from the page's Play, the
     status bar shows the running state and size, Save to slot 1 and
     Load slot 1 round-trip when the driver supports save.
- You cannot run the browser suite in the sandbox; write it, run `npm
  run check`, `npm test` and `npm run build:ui`, and say so in the merge
  note. The integrator runs the gate.

## 6. Definition of ready for review

- `npm run check`, `npm test` green; `npm run build:ui` produces both
  bundles and reports their sizes.
- `docs/work/W22-merge-note.md`: the model's public surface, the
  selector list, the preference record shapes, what each menu item
  calls on the runtime, anything in §7 you could not do with the
  runtime as it is (say what is missing, do not work around it in the
  page), the exact browser gate command, and anything undone.
- No `Co-Authored-By` or other attribution lines; commit as the
  repository's configured user.
