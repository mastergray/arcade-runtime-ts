# W21 merge note

## What changed

- `ui/tokens.css` defines the documented palette, bevels, type, spacing,
  dimensions and the desktop, phone and TV role sets. Component styles consume
  those properties; component source contains no literal hex colour or pixel
  measurement.
- The React kit is split across `Bar`, `Bevel`, `Button` (including
  `ActionButton`), `CanvasFrame`, `Card`, `Chip`, `Confirm`, `ControllerStrip`,
  `ControlsPicture`, `DPad`, `Dot`, `DropZone`, `Fieldset`, `Hint`, `Icon`,
  `KeyValue`, `List`, `MenuBar`, `Modal`, `Pill`, `RedButton`, `Selector`,
  `StatusBar`, `Table`, `Tabs`, `Terminal`, `TitleBar` and `Window`, with the
  public surface in `ui/kit/index.ts`. Native select, checkbox, radio and range
  controls are styled by the shared token sheet and demonstrated in the
  gallery rather than wrapped.
- `FocusProvider` and `useFocusable` provide one focus registry and one action
  path for keyboard, standard-mapping gamepad and pointer modality. Components
  are presentational and the UI tree has no runtime-package import.
- `/ui/gallery` contains the five design-language groups, density and all-state
  controls, a 390 by 844 phone frame, generated seed icons, and the TV action
  column. Instances expose section, component and state data attributes.
- `build:ui` creates the ESM gallery, source map, HTML and tokens under
  `dist/ui` without reading or writing `dist/mame`. The unminified
  `gallery.js` produced by the final build is **1,253,990 bytes**.
- The harness confines `/ui/` files beneath the configurable `uiRoot`, permits
  only HTML, JavaScript, CSS and source maps, serves `/ui/gallery` as the index,
  and retains the existing extra-page and harness routes.

## Focus mapping

| Intent | Keyboard | Standard gamepad | Result |
| --- | --- | --- | --- |
| Move | Arrow keys | D-pad or left stick | Moves in registration order inside the group, then crosses to the adjacent group at an edge |
| Activate | Enter or Space | A | Invokes the target callback or its real DOM click |
| Back | Escape | B | Runs the target back callback, then the provider back callback |
| Previous / next tab | Page Up / Page Down | LB / RB | Runs the provider tab callback from anywhere in the tabbed view |
| Change selector | Left / Right | D-pad or left stick left / right | Changes the focused selector without leaving it |
| Walk groups | Shift+Tab / Tab on desktop | — | Moves to the previous / next registered group |

Gamepad input is edge-triggered and uses a 0.55 left-stick threshold. Pointer
input suppresses the phone focus ring; the first keyboard or gamepad action
restores it. Touch still invokes the components' ordinary callbacks.

## Under-specified choices

- The ranged TV type values were fixed at 18 for small, 16 for tiny, 25 for
  title bars and 26 for pane headings. TV list padding uses the upper documented
  value, 14 by 18. The desktop-only minimum target, absent from the table, is
  30; phone and TV use the required 44.
- Page Up and Page Down are the keyboard equivalents for the LB/RB tab action;
  the specification named the pad buttons but no desktop key pair.
- Directional layout has no geometry contract, so a group uses DOM registration
  order. Reaching its first or last member selects the last or first member of
  the adjacent registered group.
- The gamepad stick threshold and repeat policy were not specified. The chosen
  threshold is 0.55 and actions fire once per press/threshold crossing rather
  than every animation frame.
- Generated icons hash their seed into one of four arrangements of the fixed
  two-tone gradient. They never load artwork or external data.
- The gallery starts with all states visible. Turning the option off leaves one
  interactive instance of each component.

## Verification

- `npm run check` — passed (`check:src`, `check:ui`, `check:tests`).
- `npm run build:ui` — passed; produced `gallery.js` (1,253,990 bytes),
  `gallery.js.map` (1,935,366 bytes), `index.html` (349 bytes), and
  `tokens.css` (21,647 bytes) in `dist/ui`.
- `npm test` — the suite completed with 573 passed, 2 failed and 4 skipped.
  The two failures are sandbox restrictions in existing cases: spawning the
  Node executable returned `EPERM` in the command snapshot, and binding
  `127.0.0.1` returned `EPERM` in the extra-page server case. The new token test
  passed.

## Browser gate

The gallery browser case was written but not run here because this sandbox
cannot bind a loopback listener or launch Chromium. The integrator command is:

```sh
npm run test:browser
```

The case builds into a temporary UI root and covers the route, component
inventory, exact density font sizes, TV focus movement/inversion, selector
changes, Escape back navigation, active-row `Resume`, and sample-row text.

## Left undone

- Run the browser gate above in the integration environment.
- Perform the requested side-by-side visual review there; `res/ui/mock` is not
  available in this worktree.
- No runtime wiring was added, by design.
