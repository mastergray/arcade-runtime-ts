# W25 merge note — Phone local layouts

## Delivered layouts

`layoutFor({ width, height, touch })` chooses `phone-portrait` for a taller
viewport up to and including 1100 px wide, including portrait tablets;
`phone-landscape` for a wider viewport shorter than 500 px; otherwise
`desktop`. Square viewports and landscape tablets use desktop. Geometry
selects the layout independently of touch capability. Resize and orientation
changes update the root attributes without replacing the session, library,
preferences, display container or canvas. The existing PlaySurface keeps its
React position through desktop, both phone layouts and presentation.

Both phone layouts use phone density. Portrait has the library title and
right-aligned current name, Games/Pause/Mute/Reset/Menu bar, native-aspect
canvas through PlaySurface, scrolling switches while running, controller and
status with touch/pad facts. Landscape puts Cabinet switches above the d-pad
and COIN, Operator keys above the buttons and START, with the canvas between
panels. Swap sides exchanges the complete panels. Turning Controller off
removes both panels and gives the canvas the full width. The translucent bar
includes status and Fullscreen, fades after three seconds with Controller off,
and returns on a tap. Keyboard or pad focus keeps its actions visible.

Games uses the existing accordion and Stored files footer in a centred kit
window. Import replaces its contents in place with ‹ Games, sharing
ImportModal's content and ImportActions footer; dropping more files and
storing them leaves Import open. Play starts through the existing adapter
boundary and closes the window. Menu has State, View and Settings tabs,
44 px list rows, slot/size selectors and the existing session actions.
Window-opening items close Menu. Phone dialogs use 92% width, outside-tap
and title-bar dismissal, existing staged apply/cancel logic, short Controls
tabs, at most three table columns and stacked analogue boxes. No table
information or Change action is discarded. Footers stay at the window edge.
Phone dialog focus scopes route Escape/B through their cancellation paths.

Phone fullscreen targets the page root so the bar, controller and windows
remain usable; it hides the local title and status. Fullscreen-on-start uses
that same root on phone layouts. Refusals are logged. The W32 gesture hook
routes canvas two-finger touchstart and pad menu gestures to the local phone
Menu, with capture taking priority. Desktop canvas gestures remain inactive.
Presentation uses the same window at phone density, narrower actions and a
card showing name/status with its frame and metadata hidden. Portrait keeps
that window; the existing landscape-lock attempt remains in force.

## Touch surfaces and ownership

| Surface | Behaviour |
| --- | --- |
| D-pad | Captures one pointer over nine cells; pointer movement changes the held set, including adjacent diagonals. Centre, leaving its bounds, pointerup, pointercancel, lost capture and unmount release its directions. Desktop retains individual-key click-and-hold. |
| Red buttons | Independent pointer sets per button; one button's release cannot release another button or the d-pad. The last pointer's up/cancel/lost capture releases it; unmount releases retained holds. Undeclared buttons are dim and disabled. |
| COIN / START | Click/touchscreen tap calls `session.tap` for player 1; ArcadeInput supplies frame-timed release. |
| Cabinet / Operator | Tap through the existing session mapping, including declared volume and `machine.inputs.keys`. Portrait scrolls horizontally; landscape scrolls within each switches area. |
| Canvas | Two-finger touchstart opens Menu through the W32 hook; a single tap wakes a faded bar. |

Directions and buttons use `session.hold` and the existing dedicated strip
channel. Multiple controls remain independent. The page suspends runtime
input forwarding while phone windows/dialogs own interaction, without taking
a pause in local mode; closing clears retained input. Presentation keeps W32's
separate pause ownership. All active phone targets are at least 44 px.

## Preferences and facts

The version 2 global preference record adds `swapSides: boolean`, default
`false`, and changes `controllerView` to `boolean | "auto"`, default `"auto"`.
Auto resolves on for a touch device with no connected pads, off otherwise.
Explicit on/off choices override auto, so Controller can be restored with a
pad connected. Existing boolean records retain their meaning. Invalid or
missing fields fall back independently. Export/import carry both fields;
older exports default missing fields, while explicitly invalid imported
values are rejected. No per-game record or runtime touch configuration changed.

`SessionSnapshot.touchDevice` reads `navigator.maxTouchPoints > 0` from the
canvas document. The existing `pads` snapshot is refreshed on connection and
disconnection events as well as the existing polling interval. The page and
automatic controller resolver read those session facts.

## Stable selectors

- Root: `.local-page[data-layout="desktop" | "phone-portrait" |
  "phone-landscape"][data-mode][data-density]`, `[data-fullscreen]`,
  `[data-bar-visible]`, `[data-swap-sides]`.
- Bar: `[data-phone-bar]`, `[data-phone-action="games" | "pause" | "mute" |
  "reset" | "fullscreen" | "menu"]`, `[data-phone-bar-status]`.
- Controller: `[data-phone-controller]`, `[data-side-panel="directions" |
  "buttons"]`, `[data-switches-row]`, `[data-row="cabinet" | "operator"]`,
  `[data-component="d-pad"][data-touch="true"]`, `[data-pad-cell="0"…"8"]`.
  Primary controls retain `[data-control="up" | "down" | "left" | "right" |
  "button-1"…"button-6" | "coin" | "start"]`; switches retain `service`,
  `test`, `volume-down`, `volume-up` and `key:<key>`. Pressed surfaces expose
  `[data-pressed]`; undeclared buttons expose `[data-off]`.
- Games: `[data-modal="phone-games"]`, `[data-phone-games]`,
  `[data-phone-games-state="games" | "import" | "stored"]`,
  `[data-phone-games-back]`, `[data-phone-import="import" | "stored"]`.
  Shared selectors remain `[data-row]`, `[data-row-action]`,
  `[data-import-open]`, `[data-open-stored-files]`, `[data-import-drop-zone]`,
  `[data-import-picker]`, `[data-import-file]`, `[data-import-status]`,
  `[data-store-all-check]`, `[data-import-play]` and the stored-file selectors.
- Menu: `[data-modal="phone-menu"]`, `[data-phone-menu]`,
  `[data-phone-menu-tab="state" | "view" | "settings"]`, its `[data-tab]`,
  `#phone-slot`, `#phone-size` and `[data-phone-menu-item="save-slot" |
  "load-slot" | "save-progress" | "clear-saved-play" | "reset" | "restart" |
  "controller" | "fullscreen" | "swap-sides" | "presentation" | "settings" |
  "controls" | "stored-files" | "technical-log" | "file-check"]`.
- Existing dialog, Controls tab, capture, analogue, confirmation and
  `[data-modal-close]` selectors remain. Stacked analogue boxes preserve
  `[data-table-row]`. W32 presentation selectors are unchanged; reduced-card
  sizing follows the root's phone density.

## Runtime and platform limits

- No `src/`, native source, bridge, emulator build or family output changed.
  The kit implements the page's digital touch controls and mapping on
  ArcadeInput channels. Cabinet touch configuration stays rejected.
- MachineInfo does not report separate Service/Test availability; the page
  retains the desktop strip's Service/Test switches. Volume and Operator
  keys do have declaration facts and are rendered from those facts.
- The runtime has no public measured-FPS event on ArcadePlayer. Existing Show
  FPS remains nominal refresh rate, shown as a small phone canvas overlay. The production browser test observes the
  real adapter's public ticks/frames through the injected boundary to measure
  ten seconds; it does not fabricate a page FPS counter.
- Fullscreen and landscape lock can be refused by the browser. The local
  phone page remains usable, and presentation retains its window in portrait
  if orientation cannot be locked.
- Existing missing pedal-3 axis output and unavailable catalogue metadata
  remain unchanged. Analogue touch sticks and trackpads are not implemented
  by this digital phone controller.

## Verification and remaining integration gates

- `npm run check` passes, including the complete browser test's type checks.
- `npm run build:ui` passes; only UI output was built.
- `git diff --check` passes. Browser test 44 imports as a manifest with one
  synthetic case, or two cases when the preload environment variable is set.
- `npm test`: 615 cases, 609 passed, 2 failed, 4 skipped. All four new layout
  and preference cases pass. The two failures are environment restrictions:
  the audit CLI case in test 19 cannot spawn Node (`EPERM`), and the extra-page
  server case in test 26 cannot bind loopback (`EPERM`). These tests were not
  changed or bypassed. A full passing spec run remains required at integration.
- Browser test 44 has the synthetic case unconditionally and adds its
  production case only with `ARCADE_PRELOAD_CONFIG`. Missing Chromium skips
  the file. It creates a Playwright Pixel-class context with `hasTouch` and
  `isMobile`, uses touchscreen taps and CDP touch contacts for genuine pointer
  streams, and serves temporary UI/synthetic builds. Production uses the real
  adapter through an observing proxy, tests held input and COIN/START edges,
  and requires native tick rate within 10% over ten seconds with visible frames.
- Chromium was not launched. The integrator must run browser 44, the existing
  desktop/presentation gates, the phone visual comparison, and the sixty-second
  physical-phone measurement. Phone reference mocks were absent in this
  worktree. No browser or physical-device pass is claimed.

With the ignored preload configuration already selected in the environment:

```sh
npm run check
npm test
npm run build:ui
npm run test:browser
```

Without `ARCADE_PRELOAD_CONFIG`, the synthetic phone case remains available
and the production case is omitted. Only `wp/w25-phone-layouts` is used for
this work; the configured repository identity is used for committing.

## Commit handoff

All changes remain **uncommitted** in this worktree on
`wp/w25-phone-layouts`. The repository's configured identity was verified,
but `git add` failed while creating the worktree's `index.lock`: Git metadata
is mounted read-only. No alternate index, identity or attribution was used.
The integrator must stage and commit the changes, and rerun the two restricted
spec cases plus the browser/device gates above.

## Integration (2026-10-26, on main)

- The agent's sandbox could not write the worktree index; the integrator
  committed the package as `c05f5b3` after a clean sweep.
- Browser test 44 needed three Chromium facts: touch-derived pointer moves
  are animation-frame aligned (the held set is polled), a `touchEnd` lists
  the touches being released and an empty list releases all, and the first
  tap after a raw CDP touch session loses its click (spent on the title bar).
  The synthetic board declares a pedal instead of a paddle so the d-pad
  directions stay digital for the adapter check. The portrait d-pad element
  hugs its nine cells and the touch math measures the cells.
- Gate on the branch: browser 45 passed, 0 failed, 23 skipped with the
  general and analogue preload configs; spec 615; check clean. Merged as
  `2e297e4`. The sixty-second physical-phone measurement of M10 is still
  the user's, through Show FPS on a real phone.
