# W32 merge note — Presentation mode

## Delivered surface and state

Presentation is a skin of the local page, with one library, preference store,
SessionModel, cabinet, display container and canvas. The canvas stays mounted
at the same React position across switches. Local menu, shortcut, library,
controller, metadata and status chrome are omitted in presentation. The page
root carries `data-mode="local" | "presentation"` and
`data-density="desktop" | "tv"`; the document density selects the existing
kit tokens. No tokens, native sources, bridge patches or family builds changed.

View › Mode: Presentation… and Configure › Presentation… enter the mode.
View has no disabled action, including fullscreen before a game is started.
The presentation window's Play mode action restores the local skin without
restarting the cabinet. Fullscreen requests target the page root, which
contains the overlay. Landscape lock is attempted after the fullscreen
request settles. Refusals are caught and logged; the mode remains usable.
Play and Resume request fullscreen directly from their activation, including
when the user previously left fullscreen. Leaving exits fullscreen and
unlocks orientation where supported.

SessionSnapshot adds `mode`, `windowOpen`, `windowView` (`game`, `games`,
`controllers`), `lastFrame` and `hintVisible`. SessionModel adds
`enterPresentation`, `leavePresentation`, `toggleWindow`, `openWindow`,
`closeWindow`, `presentationFullscreen` and `hidePresentationHint`.
The private `hintShown` flag lasts for the SessionModel lifetime. The hint
appears on the first presentation start (also when entering with a running
game), fades over three seconds, and does not return on Resume or later starts.
Without a running game the window stays open on Games; its title says
`Presentation mode · no game`. Natural exit and explicit stop also return there.

The window has Resume/Play, Games, Save state, Load state, Reset, Controllers
and Play mode. The two slot pickers independently select slots 1–3. A/Enter
on a slot action or its selector acts on the displayed slot; left/right
changes that slot. Timestamp/empty text comes from the existing slot records.
Save-disabled reasons remain `no game` and `driver cannot save`. An empty Load
slot disables loading while leaving the selector usable.

Games uses flat Table rows, selection through focus, Play on ready rows,
Resume and `tr.hl` on the running row, and status words for unavailable rows.
The current-game view captures `lastFrame` with the same `thumbnail()` helper
used by saved slots. Its metadata and slot progress line use existing records.
Controllers reuses ControlsModal with `inline`: its body and foot remain,
without a veil or title bar. Scope, analogue settings and stick centre use TV
selectors. Tabs support left/right and LB/RB; capture and apply retain the
W23b storage and live-source boundaries. B cancels the draft; dismissing the
whole window also restores unapplied analogue previews.

## Preferences

The existing version 2 global record adds only:

```ts
general.presentationHint: boolean; // default true
general.mode: "local" | "presentation"; // default local
```

Each field falls back independently when missing or invalid. Mode changes
persist immediately; reload restores presentation with the idle Games window.
View › Menu hint toggles the hint field beside Show FPS. Export/import carry
both fields. Older version 2 exports missing these additions import with the
defaults; explicitly invalid imported values still fail validation. Importing
the mode preference takes effect on the next page initialization, like the
other General startup preferences.

## Gesture and focus rules

`MenuGestureDetector` is React-free. Each pad id resolves its recorded
`controls.menuGesture[id]`, otherwise `[10, 11]` (L3 + R3). Only the rising
edge of the whole set fires; partial sets and held repeats do not. Releasing
one member rearms the set. Short pads report `missing`; if the only connected
pad is short, Controllers says to configure a menu gesture. Updates use the
previous physical sample with the new set, so rebinding held buttons does not
invent a new edge. Disconnect removes the previous sample.

The presentation hook polls on requestAnimationFrame only in presentation.
Pad gesture, Escape and canvas two-finger touchstart call `toggleWindow()`.
Escape during binding capture belongs to that capture. Pad capture similarly
owns its presses; the gesture detector observes them without toggling while
capture is active. Ordinary gesture button presses are not intercepted on
the runtime input path.

The FocusProvider reads pads only while the presentation window is open.
Up/down walks a column, left/right crosses columns or edits a selector,
A/Enter activates, and B returns Games → current game → closed window.
Controllers has its own focus scope and B cancels it. Full menu gestures take
priority over UI button activation, including custom gestures that overlap A
or B. A newly enabled focus scope samples held buttons before accepting edges;
rerenders retain the edge history. The shared focus hook also now forwards
A/Enter to ordinary Button clicks. Mouse and touch actions remain available.

Local-mode menu gestures are not polled; the design language's desktop
“focus the menu bar” gesture is outside W32. Normal runtime gamepad polling
and the existing local device/status refresh remain unchanged.

## Pause and input ownership

Opening over a running machine records that exact cabinet in
`windowPausedCabinet`, captures its frame, suspends ArcadeInput and pauses it.
Opening over an already paused machine does not claim that pause. Closing,
Resume or a gesture resumes only the recorded cabinet, only if it is still
current and paused. Play mode (2026-10-26, integrator) drops that ownership
without resuming: the game stays paused on the local page and its Pause /
Resume shortcut takes over. A user pause therefore survives closing the
window and leaving presentation. Switching subviews never changes ownership;
stop/exit clears the cabinet reference.

The input gate combines the existing local dialog request with `windowOpen`.
Closing the presentation window cannot clear another dialog's suspension.
Before forwarding resumes, `releaseAll()` clears UI-held input. Capture and
Test input can still observe suspended input, while no such press reaches
the machine. A newly started cabinet receives the current gate before the
presentation window closes. Save/load retain the paused state and input gate.

## Stable selectors

- Root and mode: `.local-page[data-mode][data-density]`,
  `[data-menu-item="mode-presentation"]`, `[data-menu-item="presentation"]`,
  `[data-menu-item="menu-hint"]`, `[data-mode-switch="local"]`.
- Stage and hint: `[data-presentation-stage]`, existing `[data-play-stage]`
  and `[data-play-canvas]`, `[data-presentation-hint]`.
- Window and view switch: `[data-presentation-window]`,
  `[data-presentation-view="game" | "games" | "controllers"]`.
- Actions: `[data-presentation-action="resume" | "games" | "save" | "load" |
  "reset" | "controllers" | "play-mode"]`. `resume` is stable when its label
  changes to Play for a different playable selection.
- Slots: `[data-presentation-slot="save" | "load"]`,
  `#presentation-save-slot`, `#presentation-load-slot`,
  `[data-selector-value]`, and the selector's `small` timestamp/reason.
  Arrow buttons retain `aria-label="Previous" | "Next"`.
- Games: `[data-presentation-games]`, `[data-table-row="<card key>"]`,
  `tr.hl`, `[data-selected]`, `[data-focus]`,
  `[data-presentation-play="<card key>"]`. Unknown-file rows use an
  `unknown:` prefix.
- Current game: `[data-presentation-game]`, `[data-presentation-frame]`,
  `[data-presentation-metadata]`, `[data-presentation-status]`.
- Controllers: `[data-controls-inline]`, the W23b `[data-controls-tab]`,
  `[data-tab]`, `[data-binding-change]`, `[data-capturing]`,
  `[data-apply-scope]`, `[data-controls-ok]`, `[data-controls-cancel]`,
  `[data-controls-restore]`, `[data-analog-global]`. TV selectors use
  `#controls-scope`, `#cabinet-scope`, `#stick-centre`, and ids formed from
  the declared analogue key plus `-speed`, `-travel`, or `-invert`.

## Runtime and platform limits

- Fullscreen and orientation are browser capabilities, not guaranteed by the
  runtime. Rejection is logged and does not change game or mode state.
- The metadata schema does not yet declare manufacturer/year. The current
  card shows them only when supplied, and uses MachineInfo for resolution,
  players and buttons. It does not invent catalogue values.
- There is no last-frame snapshot API on the runtime. Existing canvas PNG
  readback is reused; unavailable readback leaves the frame empty.
- There is no saved-overlay timestamp query. The progress line names saved
  slot timestamps, not an invented autosave time.
- The existing Controls limits remain: no pedal-3 axis bridge output and no
  touch-mapping runtime. Phone presentation sizing/touch controls are M28.

## Verification and remaining gates

- Commit is blocked in this environment: `git add` cannot create the
  worktree's `index.lock` because its Git metadata is mounted read-only.
  All implementation and documentation changes remain in this worktree,
  uncommitted, on `wp/w32-presentation-mode`. The configured repository
  identity was verified; no alternate identity or attribution was added.
- `npm run check` — passed, including source, UI and browser-test type checks.
- `npm run build:ui` — passed; only UI output was built.
- `npm test` — 605 cases: 599 passed, 2 failed, 4 skipped. All new gesture
  cases and extended preference cases passed. The two failures are existing
  environment-bound tests: the audit CLI case in `19-romset-audit.test.ts`
  cannot spawn Node (`EPERM`), and the extra-pages server case in
  `26-preload-config.test.ts` cannot listen on loopback (`EPERM`). No test was
  weakened or skipped to hide these failures. The full spec pass remains an
  integration gate.
- `tests/browser/43-presentation-mode.test.ts` type-checks and imports as a test
  manifest. Chromium was not launched. The synthetic case includes scripted
  pads, fullscreen/orientation refusal, first-start hint and its preference,
  input isolation, full/partial/held gesture edges, slot 2, Games/B,
  inline tab navigation and key capture, OK/Cancel, unchanged canvas/cabinet,
  user-owned pause, short-pad warning and reload persistence.
- The production case is added only with `ARCADE_PRELOAD_CONFIG`. It uses the
  real machine to verify pause/Resume and slot 1 when supported. Both cases
  use a temporary UI build root; the synthetic case also serves a temporary
  synthetic family. Missing Chromium skips the file cleanly.
- The presentation mock was absent. The TV visual comparison and both browser
  cases remain for the integrator. Import/file management, video/audio and
  per-game settings, exports, logs and destructive state actions stay in Play
  mode as specified.

The integrator gate commands, with `ARCADE_PRELOAD_CONFIG` already naming an
ignored preload configuration for the production case, are:

```sh
npm run check
npm test
npm run build:ui
npm run test:browser
```

Without that variable the synthetic browser case remains defined and the
production case is omitted. The W32 completion gate is not fully satisfied
until the changes can be committed and the environment-bound spec cases and
browser suite pass there.

## Integration (2026-10-26, on main)

- The agent's sandbox could not write the worktree index; the integrator
  committed the package as `cc3cab6` after a clean sweep.
- `MameSession` services a state operation scheduled while paused by
  resuming natively for one frame and pausing again: `web_run_frames`
  declines while the machine is paused, so a save over the paused game
  never completed (spec case in test 23).
- `KeyboardSource` leaves browser defaults alone while its input is
  suspended, so the arrows and Enter reach the window and the dialogs
  (spec case in test 16).
- Browser test 43: the slot step split, the tsx `__name` helper defined
  on the page, the fullscreen assertion reads the log before closing
  that modal, the reload step no longer closes a closed modal.
- Gate on the branch: browser 43 passed, 0 failed, 23 skipped with the
  general and analogue preload configs; spec 607; check clean.
  Merged as `74cfd89`.
