# W23b — The Settings and Controls dialogs

Lane: **web**. Branch: `wp/w23b-settings-controls-dialogs`. Milestones:
M26 (dialogs), M32 (the dialog that sets analogue settings), M10
(keyboard map editor).

Build the two dialogs the local page's Configure menu still greys out,
on the W21 kit and the W23a runtime surfaces, and grow the preference
store so everything they set is kept per browser and per game. After
this package the Configure menu has no disabled item but Presentation…
(W24).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W23b | Settings dialog, Controls dialog, preference store v2, export / import, per-game settings list, live application to the session | `ui/local/SettingsModal.tsx`, `ui/local/ControlsModal.tsx`, `ui/local/PerGameModal.tsx`, `ui/model/preferences.ts` (v2), `ui/model/session.ts` (apply settings), `ui/model/bindings.ts` (new: key and pad capture, binding labels), `ui/kit/**` additive only, `ui/local/menus.tsx` (enable the items), `tests/spec/<next>-ui-preferences-v2.test.ts`, `tests/spec/<next>-ui-bindings.test.ts`, `tests/browser/42-local-dialogs.test.ts` | W22, W23a | `docs/ui-spec.md` §3.4, §3.5, §6, §7.4; `docs/ui-design-language.md` §3.3; `docs/work/W23a-merge-note.md` (the surfaces) | web | M26, M32, M10 (keyboard) |

## 2. Preference store v2 (`ui/model/preferences.ts`)

Extend the W22 records; every field falls back on its own.

Global record additions:

```ts
general:  { fullscreenOnStart: boolean; muteOnStart: boolean }      // autoSave already exists
video:    { filter: "pixelated" | "smooth"; crop: { left: number; right: number } }   // size and showFps already exist
audio:    { volume: number }                                        // 0–1
storage:  { strictness: "strict" | "mame" }                         // the audit strictness the library uses
controls: {
  keyboard: KeyboardMap | null;                                     // null = DEFAULT_KEYBOARD_MAP
  gamepads: Record<string, GamepadMapping>;                         // by browser-reported pad id; chords live inside the mapping
  menuGesture: Record<string, number[]>;                            // by pad id: the button set (default [10, 11] = L3 + R3), used by W24
  stickCentre: number;                                              // dead zone 0–0.9, default 0.25
}
```

Per-game record additions (`<family>/<machine>`):

```ts
controls?: { keyboard?: KeyboardMap; gamepads?: Record<string, GamepadMapping> }   // overrides for this game only
analog?:   AnalogSettings                                                            // W23a type, per declared port
video?:    { crop?: { left: number; right: number } }
```

"Apply to: this game / all games" on a Controls tab writes to the
per-game or the global record. Reading resolves per-game over global
over default, field by field. `listOverrides()` returns every game
record that differs from defaults with a short description of what it
overrides, for the per-game settings list.

**Export / import**: `exportPreferences({ includeSavedPlay })` returns
one JSON document `{ version: 2, exportedAt, global, games, savedPlay? }`
where `savedPlay` is the overlay zips from the `overlays` IndexedDB
store, base64 by key; `importPreferences(json, { overwrite })` validates
it, merges by key, and returns what it would overwrite so the dialog
can confirm first. ROM archives are never exported (§3.5).

## 3. The Settings dialog (`docs/ui-spec.md` §3.5, mock in §7)

Modal "Settings", tabs **General · Video · Audio · Storage**, foot
`Restore defaults` · `OK` · `Cancel`. OK applies and saves; Cancel
reverts to the values at open; Restore defaults confirms ("keeps saved
play and stored files"), then resets the global record.

| Tab | Controls | Applied how |
| --- | --- | --- |
| General | Go fullscreen when a game starts; Mute when a game starts; Save changes automatically | preference; the session reads them at start |
| Video | Size (Fit / Stretch / Integer, same as View); Filter (Pixelated / Smooth); Side borders: trim left / right in native columns (0–32 each) with a note about the Neo Geo bars; Show FPS | `display.scaling`, `display` image rendering (needs a setter: W23a left `imageRendering` config-only; add a `imageRendering` setter to `ArcadeDisplay` in this package, additive), `display.crop` |
| Audio | Volume slider 0–100 % | `audio.volume` live |
| Storage | Stored files: count and size, **Manage** (opens the Import modal's Stored tab); Saved play: count of games with saved play; **Per-game settings**: count and **Manage** (§4); File check policy: Strict / MAME (`auditStrictness`); **Export settings…** with a checkbox "include saved play"; **Import settings…** (file picker, then a confirmation listing the keys that would be overwritten); | preference; the library re-audits when strictness changes |

## 4. Per-game settings list (`PerGameModal.tsx`)

Modal "Per-game settings": a table of games whose record differs from
the defaults, columns Game · Overrides (e.g. "Controls (keyboard) ·
Steering travel · Invert vertical") · Reset…; foot `Reset all…` and the
close square. Reset confirms with the warning tone and clears that
game's overrides; saved play is untouched (say so in the consequence).

## 5. The Controls dialog (`docs/ui-spec.md` §3.4, mock in §7)

Modal "Controls — <game or defaults>", tabs **Player 1 · Player 2 ·
Cabinet · Analogue · Test input**, foot `Restore defaults` · `OK` ·
`Cancel`. Organised by player.

- **Player n**: device line ("Keyboard (left-hand set) · Gamepad 1 ·
  Touch controller" as applicable; for a pad, the id and whether it is
  the standard-layout one, from `GamepadSource.devices`); the kit's
  `ControlsPicture` with this machine's declared buttons lit; **one
  table** with rows ▲ ▼ ◀ ▶, B1–B6, COIN, START and columns Keyboard ·
  Gamepad n · Change…; `Apply to: this game / all games`.
- **Change…**: the row enters capture; the next key (`KeyboardEvent.code`)
  or pad button press (standard-layout index, through
  `navigator.getGamepads` polled by `ui/model/bindings.ts`) binds the
  row for the device that sent it; Esc cancels; a key already bound to
  another row moves (the old row shows "unbound" until set). The
  capture must not reach the game: pause input while a dialog is open
  (the session has `pause`; or detach the sources: say which you did).
- **Cabinet**: rows Service · Test · Tilt · Volume down / up · the
  operator keys the machine reports (W29) · "Open the menu while
  playing"; columns Keyboard · Gamepad (hold Select +) · Change…. Pad
  chords are "Select + <button>" captured as a chord; the menu gesture
  is captured as the set of buttons held when capture ends (default L3
  + R3) and stored per pad id for W24.
- **Analogue**: one row per `machine.inputs.analog` port: Control
  (name from the kind and player), Keyboard speed (steps per frame as a
  percentage, `keySpeed` × 100, range 0.5–20), Gamepad travel (`travel`
  × 100, 10–400 %), Invert, **Use for all games** (copies the row to the
  global record); rows apply to this game. Below: Stick centre tolerance
  (global, `deadZone`). Applied live through
  `cabinet.setAnalogSettings`. Disabled with a note when no game runs.
- **Test input**: the table from the spec row with Keyboard · Gamepad 1
  · Gamepad 2 · Now; Now lights from `ArcadeInput.onHold` for digital
  controls and shows a bar from `ArcadeInput.axes` for analogue ones;
  nothing reaches the game while the tab is open.
- Restore defaults: confirms, then clears controls for the current
  scope. OK applies: `cabinet` sources are rebuilt with the new
  `KeyboardMap` / `GamepadMapping` (restart the sources, not the game:
  `ArcadeCabinet` has `keyboardEnabled` / `gamepadsEnabled` toggles and
  builds sources on start; add a `setControls()` to the cabinet if that
  is the cleanest way, additive, with a spec test).

## 6. Wiring

- `ui/model/session.ts` gains `applyPreferences()`: on start, pass the
  resolved keyboard map, pad mappings, analogue settings, volume, crop,
  filter, strictness and the General flags into `ArcadeCabinet.init`;
  while running, apply what can change live (volume, crop, filter,
  analogue, size).
- `ui/local/menus.tsx`: Configure › Settings… and Controls… enabled;
  Presentation… stays "next package".
- The kit grows only where the dialogs need a component the design
  language lists and W21 did not build (a captured-key cell, a
  two-column binding table are plain `Table` rows; a `Range` wrapper is
  fine). Document any addition in `docs/ui-design-language.md`.
- Density desktop; keyboard focus through the kit; a pad can walk the
  dialog while no game runs.

## 7. Tests

- Spec: preference store v2 (fallbacks, per-game over global, overrides
  list, export / import round trip and overwrite report, saved play
  passthrough with a fake store); bindings (capture state machine,
  moving a bound key, chord capture, label formatting).
- `tests/browser/42-local-dialogs.test.ts`, pattern of 40: synthetic
  case (build the UI into a temp root, synthetic family with a machine
  declaring one analogue port and two buttons, injected adapter) that
  opens Settings, changes volume and crop and sees the display and audio
  calls through the adapter boundary; opens Controls, rebinds B1 to a
  key via Change… and proves the new key reaches the injected adapter
  while the old one does not; sets an analogue row and sees
  `cabinet.analogSettings`; Test input lights a row; Export produces a
  document and Import merges it. Production case gated on
  `ARCADE_PRELOAD_CONFIG` (any family): Settings volume change is heard
  as a gain change and a Controls rebind drives the real machine.
- You cannot run the browser suite; the integrator runs it. `npm run
  check`, `npm test`, `npm run build:ui` must pass.

## 8. Definition of ready for review

`docs/work/W23b-merge-note.md`: the record shapes, the selector list,
what each tab applies and how (live or at next start), the capture
rules, anything the runtime could not do (name it, do not work around
it), the gate command, and anything undone. No titles, artwork, ROM
names or private paths; no `Co-Authored-By`.
