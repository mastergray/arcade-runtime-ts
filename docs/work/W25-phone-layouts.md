# W25 — The local page on a phone

Lane: **web**. Branch: `wp/w25-phone-layouts`. Milestones: M28 (touch
and small screens), the touch half of M10, §9.3 of the presentation mode.

Lay the W22 page out for a phone (`docs/ui-spec.md` §8) on the W21 kit:
portrait and landscape layouts, an on-screen controller that several
fingers can use at once, the Games window with Import in place, the
Menu window with its three tabs, the §7 modals as centred windows, and
the phone-size presentation window. No runtime change: the on-screen
controller drives the machine through the session's strip channel
exactly as the desktop controller strip does today.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W25 | Phone layouts (portrait, landscape, tablet portrait), multi-touch on-screen controller, switches row, Games window with in-place Import, Menu window, modals at phone size, swap sides, bar and strip rules, controller default on touch, phone presentation window, phone browser gates | `ui/local/phone/**` (new), `ui/local/LocalPage.tsx` (layout selection), `ui/local/local.css` (phone rules), `ui/kit/DPad.tsx` and `ui/kit/ControllerStrip.tsx` (touch behaviour, additive), `ui/kit/**` additive, `ui/model/preferences.ts` (two global fields), `ui/model/session.ts` (touch-device and pad facts), `ui/local/presentation/**` (§9.3 sizing), `docs/ui-design-language.md` §3 (phone rows), `docs/arcade-runtime-spec.md` §10.1–10.2 (a note), `tests/spec/<next>-ui-layout.test.ts`, `tests/browser/44-phone-local.test.ts` | W22, W23b, W32 | `docs/ui-spec.md` §1.1, §3.7, §4.2, §8, §9.3; `docs/ui-design-language.md` §1.2 (phone density), §3, §4; `docs/work/W22-merge-note.md`, `W23b-merge-note.md`, `W32-merge-note.md` (surfaces and selectors) | web | M28, M10 (touch) |

## 2. Layout selection

A pure function `layoutFor({ width, height, touch })` in
`ui/model/layout.ts` (spec-tested) returns `"desktop" | "phone-portrait"
| "phone-landscape"`:

- `phone-portrait` when the viewport is taller than wide and narrower
  than 700 px, or a tablet in portrait (700–1100 px wide, taller than
  wide); `phone-landscape` when wider than tall and shorter than 500 px;
  otherwise `desktop` (a tablet in landscape uses §7).
- The page root carries `data-layout` beside `data-mode` and
  `data-density`; both phone layouts use density `phone`. Re-evaluated on
  resize and orientation change without restarting anything (§1: one
  cabinet, one page).
- `touch` is `navigator.maxTouchPoints > 0`; it is a fact on the session
  snapshot (`touchDevice`) so the page and tests read one source.

## 3. Portrait (§8.1)

Rows, top to bottom, in `ui/local/phone/PhonePage.tsx` composed from the
kit: title bar (name on the right); the **bar** (Games, Pause/Resume,
Mute, Reset, ☰); the canvas at its aspect through the existing
`PlaySurface`; the **switches** row (Cabinet: Service, Test, Volume when
declared; Operator keys from `machine.inputs.keys`) that scrolls sideways
and renders only while a game runs; the **controller**; the status line
(state, metadata, "touch", pads).

- **Games** opens a centred `Window` with title bar and ✕: Import at the
  top, the W22 accordion rows (Play, Check or the red word), Stored files
  in the footer. **Import replaces the window's content in place** with a
  "‹ Games" button: drop zone and chooser, the W22 file table and its
  statuses, Store all and check. The screen stays until the user goes
  back. Reuse the W22 `GamesColumn` and `ImportModal` content; do not
  fork their logic, lift what must be shared into shared components.
- **☰** opens the centred **Menu window** with tabs State (slot picker,
  Save to slot, Load slot, Save progress, Clear saved play…, Reset,
  Restart from power-on…), View (Controller on/off, Fullscreen, Size,
  Swap sides in landscape, Presentation…) and Settings (Settings…,
  Controls…, Stored files…, Technical log…, File check…), a ✕ in the
  title bar, tap outside closes, no Close button. Items are the design
  language's phone **Menu list** rows (44 px, right `small`).
- **The windows behind the items** are the §7 modals at 92 % width with
  the §8.1 adaptations: short tab labels (P1, P2, Cabinet, Analogue,
  Test); tables keep at most three columns (control, keyboard, gamepad);
  the analogue rows stack one control per box; footers stick to the
  window's bottom edge; ✕ or a tap outside closes; opening one closes the
  Menu window. Do this inside the existing modal components with the
  density and layout attributes, not with copies.

## 4. Landscape (§8.2)

Canvas in the middle; the controller split into two side panels. Left,
top to bottom: Cabinet switches, the d-pad, COIN. Right: Operator keys,
the six buttons, START. **Swap sides** (View tab; a global preference
`swapSides`, default false) mirrors the panels. The bar is a translucent
strip over the top of the canvas: Games, Pause/Resume, Mute, Reset, the
status text, Fullscreen, ☰. With the controller off the canvas takes the
whole screen and the strip stays; after a few seconds it fades and
returns on a tap (§8.3).

## 5. The on-screen controller

Built from the kit's `DPad`, `RedButton`, `Pill` and the switches, and it
must be playable with two thumbs:

- **Several fingers at once**: a d-pad hold and a button hold at the same
  time, two buttons at once. Each surface owns its pointer (pointer
  capture per element is fine for buttons).
- **Rolling thumb on the d-pad**: one finger pressed on the d-pad can
  slide between directions without lifting, including diagonals (two
  adjacent directions held). The d-pad therefore handles `pointermove`
  on one captured pointer and derives the held set from the pointer's
  position over its nine cells; releases on `pointerup`, `pointercancel`
  and leaving the pad. Add this as a `touch` behaviour of `DPad`
  (additive; the desktop strip keeps its click-and-hold).
- **COIN and START** tap (`session.tap`); directions and buttons hold
  (`session.hold`); switches and operator keys tap, as the desktop strip
  does. Undeclared buttons dimmed per `machine.buttons`.
- **Default**: on when the device reports touch, off when a gamepad
  connects (`session.pads`), on again from the Controller item; the
  stored `controllerView` becomes `boolean | "auto"` with `"auto"` the
  default, resolved by that rule (preference store, spec test).
- No hover, double-tap or long-press anywhere; 44 px minimum targets.

## 6. Gestures, fullscreen, presentation

- Two-finger tap on the canvas opens the Menu window (reuse the W32
  gesture hook; in local mode on a phone the gesture targets the Menu
  window, on the desktop it still does nothing).
- Fullscreen on a phone hides the title bar and status line; the bar or
  strip stays per §8.3. Refusals are logged, never thrown (W32 pattern).
- Presentation mode (§9.3): the W32 window at phone-landscape size, the
  action buttons narrower and the current-game card reduced to name and
  status; the page already locks landscape when a game starts. Portrait
  in presentation mode shows the same window; nothing else is built.

## 7. Wiring and rules

- `LocalPage.tsx` chooses `PhonePage` or the desktop shell from the
  layout; the session, library, preferences and the canvas element stay
  the same objects across a layout change (the canvas keeps its React
  position as W32 did for the mode switch).
- Vocabulary is `docs/ui-design-language.md` §5 verbatim.
- Stable `data-*` selectors on the layout root, bar buttons, switches
  row, each controller surface, the Games window and its Import state,
  the Menu window and its tabs and items, the side panels and the swap
  state; list them in the merge note.
- Kit additions (the bar, side panel, switches row, Menu list) go in
  `docs/ui-design-language.md` §3 with their states.
- `docs/arcade-runtime-spec.md` §10.1–10.2: add one note that the page's
  kit fulfils the touch primitives and the mapper on top of
  `ArcadeInput` channels, so no `src/` touch sources are planned; the
  cabinet's touch config fields stay rejected as they are.

## 8. Tests

- Spec: `layoutFor` across the breakpoints and orientations; the
  `controllerView` auto rule; `swapSides` fallback; export and import
  carry both fields.
- `tests/browser/44-phone-local.test.ts`, pattern of 40 and 43, with
  Playwright's device emulation (a Pixel-class descriptor: `hasTouch`,
  `isMobile`, portrait and landscape viewports; the synthetic family and
  the injected adapter):
  1. Portrait: `data-layout="phone-portrait"`, density phone, the bar is
     present and the desktop menu bar is not; Games opens the window,
     Import replaces it in place, dropping the synthetic archive and
     Store all and check turns the row into Play, ‹ Games returns, Play
     starts the adapter and closes the window; the switches row appears;
     the controller is on by default (touch, no pad).
  2. Touch: a `touchscreen` tap on COIN and START reaches the adapter as
     taps; a d-pad touch held, slid to a diagonal, then released reaches
     the adapter as the right holds and releases; a button held while a
     direction is held; two buttons at once.
  3. Menu: ☰ opens the Menu window, the tabs switch, Save to slot writes
     slot 1, Settings… opens the Settings window at phone width with the
     short tabs, tap outside closes it; two-finger tap opens the Menu.
  4. Landscape: `data-layout="phone-landscape"`, two side panels with the
     switches above the d-pad and buttons, Swap sides mirrors them,
     Controller off leaves the canvas alone and the strip present, the
     strip fades and a tap brings it back.
  5. A scripted standard pad connecting turns the controller off; the
     Controller item turns it on.
  6. Presentation: enter from the View tab in landscape; the window is
     phone-sized with the reduced card; Play mode returns.
  Production case gated on `ARCADE_PRELOAD_CONFIG`: the portrait page
  starts the real machine from the Games window's Play, a d-pad touch
  shows the held control through `player.input`, COIN and START reach the
  machine, and the frame rate holds over ten seconds (the sixty-second
  physical-phone measurement of M10 is the integrator's, on a real phone,
  through Show FPS).
- You cannot run the browser suite; the integrator runs it. `npm run
  check`, `npm test`, `npm run build:ui` must pass.

## 9. Definition of ready for review

`docs/work/W25-merge-note.md`: the layout rules as built, the selector
list, the touch behaviour of each surface, the preference fields, what
the runtime could not do (name it, do not work around it), the gate
command, and anything undone. No titles, artwork, ROM names or private
paths; no `Co-Authored-By`.
