# W21 — Design language kit and gallery (React)

Lane: **web**. Branch: `wp/w21-design-language-kit`. Milestone: M24.

Build the design language in `docs/ui-design-language.md` as a React
component kit with a gallery page that shows every component, at every
density, in every state. No runtime wiring: the kit does not import the
runtime package and the runtime package does not import the kit. The
gallery is the acceptance for M24 and the base the later UI packages
(M25 shell, M26 dialogs, M28 phone, the presentation window) compose
from.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W21 | Tokens, kit, focus controller, gallery, build, serve route, tests | `ui/**`, `tsconfig.ui.json`, `scripts/build-ui.ts`, the `/ui/` route in `scripts/serve-harness.ts`, `tests/browser/39-ui-kit-gallery.test.ts`, `tests/spec/<next>-ui-tokens.test.ts`, the `check:ui` and `build:ui` scripts | — | `docs/ui-design-language.md` (all sections), `docs/ui-spec.md` §6 vocabulary | web | M24 |

## 2. Toolchain (decided 2026-10-25)

- **React 19 with TSX**, `react-jsx` transform. `react`, `react-dom`,
  their types and `esbuild` are already dev dependencies and present in
  your worktree's `node_modules`; do not run `npm install`.
- `tsconfig.ui.json`: extends the root options, `jsx: "react-jsx"`,
  `rootDir: "ui"`, `noEmit`, `include: ["ui"]`. Add `check:ui` to the
  `check` script (`run-s check:src check:ui check:tests`).
- `scripts/build-ui.ts`: the esbuild API, entry `ui/gallery/main.tsx`,
  bundle, ESM, target ES2022, minify off, sourcemap on, out
  `dist/ui/gallery.js`; copies `ui/gallery/index.html` and
  `ui/tokens.css` to `dist/ui/`. Exported `buildUi(outDir?)` for the
  tests, and a CLI entry (`npm run build:ui`). `dist/` is ignored; the
  build is reproducible from the tree. It must not touch `dist/mame`.
- `scripts/serve-harness.ts`: a reserved route prefix `/ui/` that serves
  regular files beneath `dist/ui/` through the existing confinement
  helper, `cache-control: no-store`, `.js` `.css` `.html` `.map` only,
  404 otherwise; `/ui/gallery` serves `dist/ui/index.html`. Nothing else
  in the server changes; the `--page` mocks keep working.
- **Never** run `npm run build`, `npm run clean` or `build-mame` in the
  worktree.

## 3. Layout

```
ui/
  tokens.css          §1 of the design language: custom properties on :root,
                      three density blocks selected by [data-density]
  kit/
    index.ts          re-exports
    Bevel.tsx         raised | sunken surface primitive
    Window.tsx        desk + window grid (title bar · optional menu bar · main · optional status bar)
    TitleBar.tsx
    MenuBar.tsx       menu titles, dropdown, items (small, disabled, checked, radio-bold), separators
    Button.tsx        btn, sm, play, primary, disabled, with glyph; ActionButton (TV density)
    Selector.tsx      ◀ value ▶
    Tabs.tsx
    Modal.tsx         veil + window + sticky title + foot
    Confirm.tsx
    Table.tsx         header, section row, hl, dim, held
    List.tsx          games list rows: selected, active, status word, Play/Resume, accordion detail
    StatusBar.tsx
    Card.tsx          game card (icon, name, meta, status)
    Chip.tsx  Dot.tsx  Pill.tsx  Bar.tsx
    RedButton.tsx  DPad.tsx
    ControllerStrip.tsx   d-pad · card with switch rows and COIN/START · six buttons
    ControlsPicture.tsx
    DropZone.tsx  Terminal.tsx  Fieldset.tsx  KeyValue.tsx  Hint.tsx  Icon.tsx (generated two-tone)
  focus/
    FocusController.tsx   §4: one provider; useFocusable(); arrows/Enter/Esc/Tab, LB/RB and
                          left/right on selectors; gamepad polled through the same handler as keys
  gallery/
    index.html        mounts #root, loads tokens.css and gallery.js
    main.tsx
    Gallery.tsx       sections per §3 group; density switch; state toggles; "all states" mode
```

Rules for the kit:

- Every value comes from `tokens.css`; a component never hard-codes a
  colour or a pixel size. Densities are `data-density="desktop|phone|tv"`
  on the root (the gallery sets it; later pages set it once).
- States are props rendered as `data-*` attributes and styled in CSS,
  not inline styles. Focus is `data-focus`; selected, active, disabled,
  on, held, pressed likewise.
- Components are presentational: callbacks in, no stores, no storage,
  no runtime imports. The focus controller is the one piece of
  behaviour and it is the same for keyboard and gamepad (§4): a
  `FocusProvider` that owns the focused id, a `useFocusable(id, group)`
  hook, and an input hook that maps keys and the standard-mapping pad
  (d-pad and left stick, A, B, LB, RB) to the same moves. The gallery
  proves it on the TV section.
- Text in the kit is the fixed vocabulary of `docs/ui-spec.md` §6 and
  `docs/ui-design-language.md` §5; nothing else is hard-coded.
- **No game titles, artwork or private names anywhere**: sample rows are
  "Game name", icons are generated by `Icon.tsx` from a seed.

## 4. The gallery

One page, `/ui/gallery`. A toolbar at the top: density (desktop · phone ·
tv), "show all states" toggle, and a section index. Below, one section
per design-language group (§3.1–§3.5) with every component and, beside
each, its states as separate instances when "show all states" is on,
or one interactive instance when off. The TV section includes the
presentation window's left column so pad focus can be exercised. The
phone density renders inside a 390 × 844 frame so it is visible on a
desktop. Each section and instance carries `data-section` and
`data-component` / `data-state` attributes for the test.

The gallery must match the mocks the design language was derived from
when you put them side by side at desktop density: `/local` for the
chrome, lists, strip and dialogs; `/presentation` for the TV action
column and the Controls view; `/mobile-local-portrait` for the phone
bar and windows. The mocks are not in the repository (they are under
`res/`); the integrator checks this by eye and the design language's
tables are your source of truth.

## 5. Tests

- `tests/spec/<next>-ui-tokens.test.ts` (Node): parses `ui/tokens.css`
  and checks the colour tokens of §1.1 are present with the documented
  values, that the three density blocks exist and each defines the
  same set of role variables, and that no component file under
  `ui/kit` contains a hex colour or a `px` number outside `tokens.css`.
- `tests/browser/39-ui-kit-gallery.test.ts`: builds the gallery into a
  temporary directory, starts the harness server with that directory as
  the UI root (add `uiRoot?: string` to `HarnessServerConfig`, default
  `dist/ui`), loads `/ui/gallery` and checks: every §3 component has a
  section; switching density changes the root attribute and the
  computed font size of a body-role element to the documented values;
  arrow keys move the focus ring between action buttons and the focused
  one is inverted at TV density; left/right change a selector's value;
  Esc steps back; a games list row with the active state shows Resume;
  the page contains no word from a short denylist the test builds from
  the sample vocabulary (the test cannot know titles; it checks that
  every list row reads "Game name"). Skip with the suite's usual reason
  when Chromium is unavailable.
- You cannot run the browser suite in the sandbox (no loopback bind, no
  Chromium). Write it to the pattern of `tests/browser/37` and `38`, run
  `npm run check` and `npm test` (spec suite), and build the gallery
  with `npm run build:ui` to prove the bundle links. The integrator runs
  the browser suite before merge.

## 6. Definition of ready for review

- `npm run check` (with `check:ui`) and `npm test` pass; `npm run
  build:ui` produces `dist/ui/gallery.js`, `index.html`, `tokens.css`
  and reports the bundle size.
- The merge note (`docs/work/W21-merge-note.md`) lists the component
  files, the bundle size, how the focus controller maps pad and keys,
  anything in `docs/ui-design-language.md` you found under-specified and
  the value you chose (the integrator folds those back into the
  document), and the exact command the integrator runs for the browser
  gate.
- No `Co-Authored-By` or other attribution lines in commits; commit as
  the repository's configured user.
