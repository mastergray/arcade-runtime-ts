# W23b merge note — Settings and Controls dialogs

## Delivered surface

- Configure › Settings… and Controls… are enabled. Presentation remains the
  only `next package` item.
- Settings has General, Video, Audio and Storage tabs, staged OK/Cancel
  behavior, confirmed global restore, preference export/import, stored-file
  navigation and the per-game override manager.
- Controls has Player 1, Player 2, Cabinet, Analogue and Test input tabs,
  keyboard/pad/chord capture, per-game or all-game binding scope, live
  analogue previews and confirmed scope restore.
- Dialogs suspend `ArcadeInput` forwarding while leaving its logical holds and
  axes observable. This keeps capture and Test input away from the running
  machine without pausing emulation. Closing a dialog clears retained input
  before forwarding resumes.
- `ArcadeCabinet.setControls()` detaches and rebuilds keyboard, gamepad and
  analogue sources over the current `ArcadeInput`; it does not restart the
  game. Per-browser-id gamepad mappings are selected by `GamepadSource`.
- `ArcadeDisplay.imageRendering` is now a live `pixelated`/`smooth` setter.
  `ArcadeInput.suspended` is the observation/isolation gate used by the page.
- The kit adds only `Range` and declared-button state on `ControlsPicture`.
  Their tokens and usage are recorded in `docs/ui-design-language.md`.

## Preference records

The browser-wide local-storage record remains
`arcade-runtime:ui:global`. Version 2 retains the W22 fields and adds the
following shape:

```ts
interface GlobalPreferences {
  controllerView: boolean;
  size: "fit" | "stretch" | "integer";
  showFps: boolean;
  autoSave: boolean;
  general: { fullscreenOnStart: boolean; muteOnStart: boolean };
  video: {
    filter: "pixelated" | "smooth";
    crop: { left: number; right: number };
  };
  audio: { volume: number };
  storage: { strictness: "strict" | "mame" };
  controls: {
    keyboard: KeyboardMap | null;
    gamepads: Record<string, GamepadMapping>;
    menuGesture: Record<string, number[]>;
    stickCentre: number;
  };
  analog: AnalogSettings;
}
```

`analog` is the all-games destination for Analogue › Use for all games. Its
keys and values have the W23a `AnalogSettings` shape. Defaults are fullscreen
off, start-muted off, auto-save on, Fit, pixelated, no crop, FPS off, volume
1, strict auditing, the runtime default keyboard map, no pad overrides, L3 +
R3 as the implicit menu gesture for an unrecorded pad, 0.25 stick centre and
no all-game analogue override. Each field validates and falls back
independently, including records written by W22.

Each game remains at
`arcade-runtime:ui:game:<family>/<machine>`:

```ts
interface GamePreferences {
  slots: Partial<Record<"slot1" | "slot2" | "slot3", SlotRecord>>;
  controls?: {
    keyboard?: KeyboardMap;
    gamepads?: Record<string, GamepadMapping>;
  };
  analog?: AnalogSettings;
  video?: { crop?: { left: number; right: number } };
}
```

Resolution is per game over global over built-in default. Individual
gamepad-mapping and analogue-setting fields merge over their corresponding
global fields. Resetting settings overrides preserves `slots`; clearing saved
play preserves controls, analogue and crop. `listOverrides()` excludes saved
slots and describes keyboard, pad, analogue-field and side-border overrides.

Export produces one UTF-8 JSON document:

```ts
{
  version: 2;
  exportedAt: string;
  global: GlobalPreferences;
  games: Record<string, GamePreferences>;
  savedPlay?: Record<string, string>; // base64 overlay zip by game key
}
```

The optional payload reads only the `overlays` IndexedDB store. ROM archives
are never read or exported. Import strictly validates version 2 and every
record, merges global/game/saved-play keys, and first returns differing keys
in `overwrites` when confirmation is required. Identical existing values are
not reported as overwrites.

## What each Settings tab applies

| Tab | Stored behavior | Running session |
| --- | --- | --- |
| General | Fullscreen on start, mute on start and auto-save | Start flags and auto-save apply to the next game session. |
| Video | Size, filter, native-column side crop and Show FPS | Size, filter and crop preview and apply live. Show FPS updates page chrome. |
| Audio | Volume from 0–100 percent | Previews and applies live through `ArcadeAudio.volume`; mute remains independent. |
| Storage | Counts, managers, audit policy and preference transfer | Strictness re-audits visible library records after OK; export/import operate immediately after their own confirmation. |

Settings Restore defaults is staged like any other edit and says that saved
play and stored files remain. Cancel restores every live preview to the record
that existed when the dialog opened. A completed import becomes the new open
baseline so Cancel does not undo an explicitly confirmed import.

## What each Controls tab applies

| Tab | Scope and application |
| --- | --- |
| Player 1 / Player 2 | Keyboard and exact-pad-id mappings are staged for this game or all games. OK rebuilds sources live. |
| Cabinet | Keyboard operator bindings follow the selected scope. Pad operator bindings are Select chords. Menu gesture and stick centre are global fields. |
| Analogue | Declared rows stage per-game `keySpeed`, `travel` and `invert`; Use for all games stages that resolved row in global `analog`. Stick centre is global. Row changes preview through `setAnalogSettings`; OK persists, Cancel restores the open snapshot. |
| Test input | Reads effective holds and axes while input forwarding remains suspended. It never writes preferences. |

Analogue is disabled with an explanatory note until a machine is running.
Restore defaults clears the selected controls scope on OK. A cleared game
scope inherits the global bindings and analogue settings; a cleared global
scope uses runtime defaults. Saved play is untouched.

## Capture rules

- Change… starts one capture request. `Escape` cancels it.
- Keyboard capture stores `KeyboardEvent.code`. Binding a code already used
  elsewhere moves it, leaving the old row unbound.
- Pad capture polls `navigator.getGamepads()`, detects the first rising
  standard-layout button and stores it under that browser-reported pad id.
  Moving a pad button likewise unbinds its previous ordinary row.
- Cabinet pad capture requires the mapping's Select modifier plus a newly
  pressed button. Editing one operator chord materializes and preserves the
  other runtime-default chords.
- Menu capture records the complete non-empty button set and completes when
  that set is released. Its implicit default is buttons 10 + 11 (L3 + R3).
- Capture and Test input remain visible through `ArcadeInput.onHold`,
  `snapshot` and `axes`, but `ArcadeInput.suspended` prevents those values
  reaching `ArcadeSession`.

## Stable selectors

- Settings shell and actions: `[data-modal="settings"]`,
  `[data-settings-tab]`, `[data-settings-ok]`, `[data-settings-cancel]`,
  `[data-settings-restore]`, `[data-modal="restore-settings"]`.
- Settings fields: `[data-setting="fullscreen-on-start"]`,
  `[data-setting="mute-on-start"]`, `[data-setting="auto-save"]`,
  `[data-setting="size"]`, `[data-setting="filter"]`,
  `[data-setting="crop-left"]`, `[data-setting="crop-right"]`,
  `[data-setting="show-fps"]`, `[data-setting="volume"]`,
  `[data-setting="strictness"]`, and
  `[data-setting="include-saved-play"]`.
- Storage and transfer: `[data-storage-count]`, `[data-settings-manage]`,
  `[data-settings-export]`, `[data-settings-import]`,
  `[data-settings-import-picker]`, `[data-settings-message]`, and
  `[data-modal="import-settings"]`.
- Controls shell and tabs: `[data-modal="controls"]`,
  `[data-controls-tab]`, `[data-controls-device]`, `[data-apply-scope]`,
  `[data-controls-ok]`, `[data-controls-cancel]`,
  `[data-controls-restore]`, and `[data-modal="restore-controls"]`.
- Capture and analogue: `[data-binding-change]`, `[data-capturing]`,
  `[data-analog-invert]`, `[data-analog-global]`, `[data-stick-centre]`, and
  `[data-analogue-disabled]`.
- Per-game manager: `[data-modal="per-game-settings"]`,
  `[data-per-game-setting]`, `[data-per-game-reset]`,
  `[data-per-game-reset-all]`, and `[data-modal="reset-per-game"]`.
- Kit selectors used within the dialogs remain `[data-tab]`,
  `[data-component="table"]`, `[data-component="chip"]`,
  `[data-component="bar"]`, `[data-confirm]`, `[data-cancel]` and
  `[data-modal-close]`.

## Runtime limits kept visible

- The bridge has no pedal-3 axis. Its Analogue row can be stored, but live
  axis output and the Test input bar remain unavailable until the bridge gains
  that slot; the runtime's existing digital path is unchanged.
- Touch control mapping is still rejected by `ArcadeCabinet` before the later
  touch milestone, so the device line reports it unavailable.
- Fullscreen-on-start is attempted after start and can still be refused by
  browser user-activation policy. The session records that failure in its log.
- Auto-save has no live cabinet setter. Its changed value is used by the next
  cabinet session rather than rebuilding the running cabinet.
- The stored menu gesture is intentionally not consumed until Presentation in
  W24.
- Show FPS remains the machine's nominal refresh rate because the runtime has
  no measured frame-rate event.

No native source, bridge patch or family build changed in this package.

## Browser gate

With `ARCADE_PRELOAD_CONFIG` already naming an ignored preload configuration
for any built family, the exact gate is:

```sh
npm run test:browser
```

From a fresh shell the equivalent form is:

```sh
ARCADE_PRELOAD_CONFIG=/path/to/ignored/config.json npm run test:browser
```

`tests/browser/42-local-dialogs.test.ts` always defines the synthetic case.
It adds the production case only when `ARCADE_PRELOAD_CONFIG` is set.

## Verification

- `npm run check` — passed (`check:src`, `check:ui`, `check:tests`).
- `npm test` — passed: 35 files, 599 cases, 597 passed, 0 failed, 2 expected
  skips.
- A direct run of the 72 cases in the affected ArcadeInput, ArcadeDisplay,
  ArcadeCabinet, preference-v2 and binding files passed 72, failed 0.
- `npm run build:ui` — passed. It emitted `gallery.js` at 1,258,987 bytes and
  `local.js` at 1,663,301 bytes, with their HTML, CSS and source maps.
- Importing `tests/browser/42-local-dialogs.test.ts` through `tsx` succeeded
  and exposed its synthetic case without a preload configuration.
- `git diff --check` — passed.

## Left undone

- The browser suite was not executed because this sandbox cannot run Chromium
  or bind its loopback harness. The integrator must run the gate above for the
  synthetic and production adapter boundaries.
- Presentation remains disabled for W24. The saved menu gesture is persisted
  but deliberately has no in-game action in W23b.
