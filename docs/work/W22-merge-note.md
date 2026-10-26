# W22 merge note

## What changed

- `/ui/local` is a React 19 desktop page composed from the W21 window, menu,
  list, canvas, controller, status, modal, table, terminal and confirmation
  components at desktop density. It has the three specified regions, fixed
  shortcuts and status bar.
- `ui/model/library.ts` owns the W18 flow moved out of the harness shape:
  served-build indexing, metadata discovery, pending-file identification,
  browser-store listing and mutation, private preload sources, audit reports,
  card verdicts and observable library counts.
- `ui/model/session.ts` owns the one-cabinet lifecycle, status and bounded log,
  runtime actions, display sizing/fullscreen, input taps and held controller
  input. `ui/model/preferences.ts` owns global and per-game browser records.
- The Import modal remains open after storage and has Import and Stored files
  tabs. It reports Stored, Pending and Skip rows and updates the library behind
  it. Dropping files anywhere opens the same modal.
- The UI build now emits the gallery and local bundles together. The server
  maps `/ui/local` to `local.html` without changing the harness routes.
- Small additive W21-kit contracts make existing visuals usable by a real
  page: dynamic game-row copy/actions, live canvas children, extra status
  cells, held d-pad/button input, declared-button dimming, stable selectors,
  and a focus-provider switch that gives the pad to a running machine.
- `tsconfig.ui.json` uses the repository root as `rootDir`; this is required so
  the UI checker can follow the mandated model imports through `src/index.ts`.

## Model public surface

`LibraryModel` exposes `init`, `subscribe`, `snapshot`, `card`, `select`,
`initialize`, `chooseFiles`, `storeAllAndCheck`, `storeAndCheck`, `checkCard`,
`removeArchive`, `removeStored`, `clearStored`, `startSources`, `startChoices`,
`gamesUsing`, `archiveAvailability`, `pendingFor`, `verdict` and
`companionNotice`. Its snapshot is byte-free; archive bytes remain in pending
`File` objects, the runtime ROM store or private preload responses.

`SessionModel` exposes `subscribe`, `snapshot`, `start`, `stop`,
`pauseResume`, `toggleMute`, `reset`, `saveSlot`, `loadSlot`, `saveChanges`,
`clearSavedPlay`, `setSize`, `fullscreen`, `tap`, `hold`, `stripControls` and
`refreshExternalState`, plus the current cabinet for the injected acceptance
boundary. Both models are plain TypeScript and have no React import.

`PreferenceStore` exposes `hasGlobalRecord`, `getGlobal`, `setGlobal`,
`updateGlobal`, `getGame`, `setSlot` and `clearSlots`. Construction receives a
storage boundary and does not read browser globals.

## Preference records

One local-storage record holds browser-wide choices:

```json
{
  "controllerView": false,
  "size": "fit",
  "showFps": false,
  "autoSave": true
}
```

Its key is `arcade-runtime:ui:global`. `size` is `fit`, `stretch` or `integer`.
Every field falls back independently to the value above when absent or
invalid; invalid JSON falls back as a whole.

Each game uses `arcade-runtime:ui:game:<family>/<machine>` and has only its
three optional slot records:

```json
{
  "slots": {
    "slot1": {
      "savedAt": "2026-10-25T12:34:56.000Z",
      "thumbnail": "data:image/png;base64,..."
    }
  }
}
```

`slot1`, `slot2` and `slot3` are validated independently. A malformed slot is
ignored without discarding valid siblings. Clearing saved play removes this
per-game record after the runtime overlay is cleared.

## Runtime calls by menu item

| Menu item | Action |
| --- | --- |
| Settings… | Disabled, with `next package` |
| Controls… | Disabled, with `next package` |
| Stored files… | Opens the Import modal on Stored files |
| Save to slot 1–3 | `cabinet.quickSave("slot1" | "slot2" | "slot3")`, then records timestamp and canvas thumbnail |
| Load slot 1–3 | `player.loadState("slot1" | "slot2" | "slot3")` |
| Save changes | `cabinet.save()` |
| Clear saved play for this game… | Confirms, then `cabinet.clearSaves()` and clears the preference slot record |
| Reset | `player.reset("soft")` |
| Restart from power-on… | Confirms, then `player.reset("hard")` |
| Controller view | Updates the global preference and shows/hides the W21 strip |
| Show FPS | Updates the global preference and shows the machine's reported refresh rate |
| Size: Fit | `player.display.scaling = "fit"` |
| Size: Stretch | `player.display.scaling = "fill-height"` |
| Size: Integer | `player.display.scaling = "integer"` |
| Fullscreen | `cabinet.fullscreen()` or `cabinet.exitFullscreen()` |
| Fullscreen, stretched | Selects Stretch, then calls the same fullscreen toggle |
| Mode: Play | Checked; no call |
| Mode: Presentation… | Disabled, with `next package` |
| Technical log… | Opens the model's bounded runtime log in `Terminal` |
| Detailed file check… | Opens the selected/running card's `RomSetReport` |
| Copy log | Writes the joined log lines through the Clipboard API when present |

The Pause/Resume, Mute/Unmute, Reset, slot Save/Load, Fullscreen and
Controller shortcuts call the same action definitions as their menu
counterparts. Cabinet and operator switches use `player.input.tap`; d-pad and
declared buttons use a dedicated `player.input.createChannel()` for held
press/release ownership.

## Stable selectors

- Chrome: `[data-menu]`, `[data-menu-title]`, `[data-menu-item]`,
  `[data-shortcut]`, `[data-slot-picker]`, `[data-status-cell]`,
  `[data-status-controller]`.
- Library: `[data-region="games"]`, `[data-row]`, `[data-row-action]`,
  `[data-game-detail]`, `[data-archive]`, `[data-card-action]`,
  `[data-library-count]`, `[data-import-open]`,
  `[data-open-stored-files]`.
- Play and controller: `[data-region="play"]`, `[data-play-canvas]`,
  `[data-play-meta]`, `[data-video-size]`, `[data-video-rate]`, `[data-fps]`,
  `[data-controller-strip]`, and `[data-control]` (`up`, `down`, `left`,
  `right`, `button-1` through `button-6`, `coin`, `start`, cabinet ids and
  `key:<key>` operator ids).
- Import: `[data-modal="import"]`, `[data-tab]`,
  `[data-import-drop-zone]`, `[data-import-picker]`, `[data-choose-files]`,
  `[data-import-file]`, `[data-import-status]`, `[data-companion-notice]`,
  `[data-store-all-check]`, `[data-close-import]`,
  `[data-stored-files-tab]`, `[data-stored-file]`, `[data-remove-stored]`,
  `[data-remove-all-stored]`.
- Diagnostics and confirmations: `[data-modal="technical-log"]`,
  `[data-copy-log]`, `[data-close-log]`, `[data-modal="file-check"]`,
  `[data-file-check-warnings]`, `[data-close-file-check]`,
  `[data-modal="clear-saved-play"]`, `[data-modal="restart"]`,
  `[data-confirm]`, `[data-cancel]`, `[data-modal-close]`.
- Bootstrap: `[data-local-loading]` and `[data-local-error]`.

## Runtime limits kept visible

- `ArcadeDisplay` has no arbitrary two-axis stretch mode. The runtime's third
  scaling mode is `fill-height`, so the specified Stretch choice maps to that
  mode; it does not distort aspect ratio to fill both axes.
- The display exposes layout changes but no live frame counter or frame-rate
  event. Show FPS therefore reports `MachineInfo.refreshHz`, the machine's
  nominal rate, rather than measured delivery FPS.
- Served `RomSetMetadata` has no year, manufacturer, driver source file,
  player count, video geometry, control summary or save-support fields. The
  unopened row can show description, family, machine, build, archives, BIOS
  and DIP counts. Player/display/control/save details become available only
  after start through `MachineInfo`; unavailable catalogue fields are not
  invented.
- The runtime has no saved-overlay size/count query. The status bar reports
  auto-save state and slot timestamps, but not a byte count for saved play.

## Verification

- `npm run check` — passed (`check:src`, `check:ui`, `check:tests`). An early
  run exposed the UI `rootDir` issue above; the complete rerun passed.
- `npm test` — passed: 578 passed, 0 failed, 2 skipped across 580 cases. The
  new preference case passed.
- `npm run build:ui` — passed and produced both bundles. At the recorded run,
  `gallery.js` was 1,257,445 bytes and `local.js` was 1,567,052 bytes; both
  source maps, both HTML files, `tokens.css` and `local.css` were emitted.
- The browser suite was not run because this sandbox cannot bind loopback or
  launch Chromium. The synthetic and environment-gated production cases are
  in `tests/browser/40-local-page.test.ts` following tests 37–39.

## Browser gate

With `ARCADE_PRELOAD_CONFIG` already naming the integrator's ignored preload
configuration, the exact gate command is:

```sh
npm run test:browser
```

Without that environment variable, the synthetic case remains available and
the production case is omitted, matching the existing environment-gated
harness tests.

## Left undone

- Run the browser gate in the integration environment, including its private
  production case.
- Perform the desktop visual comparison where the retired mock reference is
  available.
- Settings…, Controls… and Presentation… remain deliberately disabled for the
  next packages.
