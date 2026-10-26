# W32 — Presentation mode

Lane: **web**. Branch: `wp/w32-presentation-mode`. Milestone: M41
(new: presentation mode, the TV skin of the local page).

Build `docs/ui-spec.md` §9 on the W22 page and the W23b dialogs: the
same page in a TV skin, the game fullscreen, and on the menu gesture a
pad-driven window over the paused game. After this package the View menu
has no disabled item, and the Configure menu's "Presentation…" row and
the design language's "Presentation… / Play mode" pair both work.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W32 | Presentation mode: mode switch and TV skin, menu gesture detector (pad, Esc, two-finger tap), the presentation window (actions, current game, games list, Controllers), first-start hint, pause and input ownership while the window is open | `ui/local/presentation/**` (new), `ui/model/gesture.ts` (new), `ui/model/session.ts` (mode, pause ownership, last frame), `ui/model/preferences.ts` (two global fields, additive), `ui/local/LocalPage.tsx` (mode switch, root attributes), `ui/local/menus.tsx` (enable the items), `ui/local/ControlsModal.tsx` (an inline variant, additive), `ui/local/local.css` (the TV layout), `ui/kit/**` additive only, `tests/spec/<next>-ui-gesture.test.ts`, `tests/browser/43-presentation-mode.test.ts` | W22, W23b | `docs/ui-spec.md` §1, §1.1, §3.6, §3.7, §4.2–4.4, §9; `docs/ui-design-language.md` §1.3 (TV density), §3 (Action button, Selector, Modal at TV), §4 (keys), §5 (vocabulary); `docs/work/W22-merge-note.md` and `W23b-merge-note.md` (surfaces and selectors) | web | M41 |

## 2. The mode

- One page, one cabinet, one store (§1). The mode is page state, not a
  route: `data-mode="local" | "presentation"` on the page root beside
  `data-density`, which becomes `tv` in presentation mode so the kit's
  TV sizes and the inverted focus apply (`docs/ui-design-language.md`
  §1.3, §4). Nothing restarts and nothing is re-imported on a switch.
- **Enter**: View › Mode: Presentation… (desktop), or the window's
  "Play mode" counterpart in reverse. Entering from the menu is the
  user gesture the browser needs: request fullscreen on the **page
  root** (not the display container: the window must render inside the
  fullscreen element) and lock landscape where `screen.orientation.lock`
  exists; both may be refused (headless, desktop) and refusal is
  logged, never thrown. When a game starts from the window later, the
  Play press is the gesture that re-enters fullscreen if the user left
  it with the system gesture (§1.1).
- **Leave**: the window's **Play mode** button. Back to the local skin,
  the game keeps running (§3.6): resume it if the window had paused it,
  exit fullscreen, restore the local layout.
- **Playing** (§9.1): only the canvas, scaled per the local Size
  setting, filling the root. The local chrome (menu bar, shortcuts,
  games column, strip, status bar) is not rendered in this mode; the
  runtime objects behind it are unchanged.
- **Hint** (§9.1): the first time a game starts in presentation mode in
  a session, one line over the bottom of the game names the three ways
  to the menu (the connected pad's gesture, Esc, two-finger tap) and
  fades after three seconds. A global preference
  `general.presentationHint: boolean` (default true) turns it off; the
  View menu gets the checked item "Menu hint" beside Show FPS.
- **No game running**: the window is open with the games list showing
  (there is nothing to resume); its title says so.

## 3. The menu gesture (`ui/model/gesture.ts`)

A detector with a pure core so it is spec-testable:

```ts
export interface GestureSample { readonly id: string; readonly buttons: ReadonlyArray<boolean> }
export class MenuGestureDetector {
  constructor(gestures: Readonly<Record<string, ReadonlyArray<number>>>, fallback: ReadonlyArray<number> /* [10, 11] */);
  update(gestures: Readonly<Record<string, ReadonlyArray<number>>>): void;      // preferences changed
  sample(pads: ReadonlyArray<GestureSample>): ReadonlyArray<string>;            // pad ids whose gesture fired this sample
  status(pad: GestureSample): { readonly buttons: ReadonlyArray<number> } | { readonly missing: true };   // §3.6 status line
}
```

Rules (§1.1): the set for a pad is `controls.menuGesture[id]` from the
W23b store, else the fallback; it fires on the **rising edge of the
full set** (every button in the set pressed now, not all pressed on the
previous sample), with no hold time; a pad that reports fewer buttons
than its set needs has no gesture (`missing`), and the window's
Controllers button shows that as its small text while such a pad is the
only one connected. The page polls `navigator.getGamepads()` on the
frame scheduler **only while in presentation mode**; the buttons of the
gesture still reach the game as ordinary presses (nothing binds 10 and
11 by default), which is accepted. Escape is the keyboard gesture and a
two-finger `touchstart` on the canvas is the touch gesture; all three go
through one `toggleWindow()` on the session. In local mode the pad
gesture is not polled (the design language's "focus the menu bar" is
out of scope here; say so in the note).

## 4. The window (`ui/local/presentation/`)

Composition per §9.2, mock `res/ui/mock/presentation.html` for the look
(ignored file; read it, do not copy its text into tracked files). The
kit's `Window` and `TitleBar`, the TV `Action button` (design language
§3: a `.btn` at TV density, full column width, leading glyph cell,
trailing `small` or a `Selector`), `Selector` for the slot pickers,
`Table` for the games list, `Hint` for the first-start line.

| Area | Build |
| --- | --- |
| Title bar | Library name; right text "Presentation mode · <game> paused", or "Presentation mode · no game" |
| Left column | **Resume** (label **Play** when the list's selection is a different, playable game); **Games** (count); **Save state** ◀ slot 1–3 ▶ (A saves to the shown slot; left/right change it; the Selector shows the slot's timestamp or "empty" as its small text); **Load state** ◀ slot ▶; **Reset** (soft); **Controllers** (small text: "<n> pads", or the missing-gesture warning); gap; **Play mode**. Disabled with the W22 reasons where the driver cannot save |
| Right, default | The current game: last frame in a sunken frame (capture with the same helper the W22 slot thumbnails use, taken when the window opens), name, the metadata line (resolution · players · buttons; manufacturer and year arrive with M27, show them when `metadata` has them), status line (Playing / Ready, when progress was saved, which slots are saved or empty) |
| Right, after Games | Flat rows: name, then the Play button on a playable row or the red status word; the running game's row highlighted (`tr.hl`), its word "playing" in green and its button reading Resume. Up and down move the selection, A on a ready row starts it (through `session.start`) and closes the window, B returns to the current game. Footer line: import and file management are in Play mode |
| Right, after Controllers | The W23b `ControlsModal` content **inlined**: add an `inline` prop (no veil, no modal chrome, the foot stays) so one component serves both; tabs Player 1 · Player 2 · Cabinet · Analogue · Test input; Left and Right at the tab strip switch tabs; Apply to as a ◀ this game / all games ▶ Selector at TV density; B is Cancel; OK applies exactly as in local mode. Change… capture works from the pad because the W23b capture already polls pads |

Pad and key model (§9.2, design language §4): up and down move focus
within the column, left and right change a Selector or cross into the
right column, A activates, B steps back (list → current game → window
closes), the gesture toggles the window. Through the kit's
`FocusProvider` (`onBack` for B); no legend on screen; mouse and touch
still work on every row and button.

**Ownership while the window is open** (§4.3, §4.4): the game is paused
(`session.pauseResume` semantics: pause on open, resume on Resume or
on the gesture; a game the user had paused before opening stays paused
after closing, say how you track that) and `session.setInputPaused(true)`
so no pad or key reaches the machine; the FocusProvider's pad reading
is enabled only while the window is open. Closing restores both.

Not in the window (§9.2 last paragraph): import, file check, remove,
storage, exports, video and audio settings, per-game settings, the log,
Restart from power-on, Clear saved play. §9.3 (phone size) is M28.

## 5. Wiring

- `ui/model/session.ts`: `mode`, `windowOpen`, `windowView` ("game" |
  "games" | "controllers") in the snapshot; `enterPresentation()`,
  `leavePresentation()`, `toggleWindow()`, `openWindow(view)`,
  `closeWindow()`; the hint-shown flag for the session; the last-frame
  capture. The model stays React-free.
- `ui/model/preferences.ts`: `general.presentationHint` (default true)
  and `general.mode: "local" | "presentation"` (default local; the
  mode survives a reload so a TV setup comes back as it was). Export
  and import carry them; the spec test gains the fallbacks.
- `ui/local/menus.tsx`: Mode: Presentation… enabled; View gains Menu
  hint; the shortcuts are unchanged.
- `ui/local/LocalPage.tsx`: renders the local shell or the presentation
  stage from `mode`; root attributes; the gesture hooks (Escape,
  two-finger tap, pad polling) live here or in a small hook under
  `ui/local/presentation/`.
- Stable `data-*` selectors on the stage, hint, window, every action
  button, the slot selectors, the list rows and their buttons, the
  view switch, and the mode switch; list them in the merge note.
- Density tv; no new tokens; any kit addition (the Action button is the
  likely one) goes in `docs/ui-design-language.md` §3 with its states.

## 6. Tests

- Spec: the gesture detector (rising edge of the full set, a partial
  set never fires, repeat samples fire once, release and press fires
  again, per-pad ids with the fallback, `missing` for short pads,
  `update` swaps sets live); preference fallbacks for the two fields.
- `tests/browser/43-presentation-mode.test.ts`, pattern of 40 and 42
  (synthetic family, injected adapter, built UI in a temp root, a
  stubbed `navigator.getGamepads` returning a scripted standard pad):
  View › Mode: Presentation… sets `data-mode` and `data-density="tv"`
  and hides the local chrome; with no game the window is open on the
  list; Play on the row starts the injected adapter, the window closes,
  the canvas fills the root and the hint is visible then gone; Escape
  opens the window and the adapter reports paused and the input
  suspended; the scripted pad's L3 + R3 rising edge toggles it; a
  partial press does not; Save state with the slot selector moved to
  slot 2 writes slot 2 and Load state reads it; Games highlights the
  running row and B returns; Controllers shows the inline Controls with
  the Player 1 tab and Left/Right switch tabs, Change… captures a key,
  OK applies (the W23b adapter boundary proves the new key); Play mode
  returns to the local skin with the game still running and resumed.
  Fullscreen and orientation lock are refused headless: the test proves
  only that refusal is tolerated. Production case gated on
  `ARCADE_PRELOAD_CONFIG`: enter presentation, Escape opens the window
  over the paused real machine, Resume resumes, Save then Load on slot 1
  round-trip when the driver supports save.
- You cannot run the browser suite; the integrator runs it. `npm run
  check`, `npm test`, `npm run build:ui` must pass.

## 7. Definition of ready for review

`docs/work/W32-merge-note.md`: the mode state and preference fields,
the selector list, the gesture rules as built, how pause and input
ownership are tracked, what the runtime could not do (name it, do not
work around it), the gate command, and anything undone. No titles,
artwork, ROM names or private paths; no `Co-Authored-By`.
