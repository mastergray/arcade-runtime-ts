# UI design language

Derived from the local-page mock (`res/ui/mock/local.html`, served at
`/local`) on 2026-10-25, after the phone and presentation mocks were
redrawn from it. This is the input to **M24** (`docs/ui-roadmap.md`):
the tokens and the component kit below are what the kit implements, and
every other view (phone, §8 of `docs/ui-spec.md`; presentation, §9) is
composed from these parts at a different density. Nothing is designed
twice: if a view needs something that is not here, the kit grows and this
file is updated first.

The look is a retro desktop OS: a blue desk, grey bevelled windows, a
title bar in deep blue, one sans-serif face, dotted focus rings. It is
deliberately flat and high-contrast so it reads at TV distance and on a
phone without a second theme.

## 1. Tokens

### 1.1 Colour

| Token | Value | Used for |
| --- | --- | --- |
| `--desk` | `#3767C8` | The desktop behind every window, all modes |
| `--face` | `#C0C0C0` | Window face, buttons, tabs, menus, panels |
| `--light` | `#FFFFFF` | Bevel highlight; sunken panel fill; title text |
| `--dark` | `#404040` | Bevel shadow; d-pad key border |
| `--mid` | `#808080` | Dividers, sunken border, disabled text, separators |
| `--soft` | `#DFDFDF` | Inner bevel highlight |
| `--title` | `#0A2A8C` | Title bars, selected rows, open menus, focus fill |
| `--ink` | `#000000` | Body text |
| `--ok` | `#2F9E52` | Running state, "ready", held input, good verdict |
| `--bad` | `#D11F1F` | Missing / bad / not stored / not a game; destructive confirm |
| `--warn` | `#D9A400` dot, `#8a6a00` text, `#8a4a00` note | Paused state, warnings |
| `--panel` | `#F3F3F3` | Open accordion detail background |
| `--tab-off` | `#B5B5B5` | Unselected tab face |
| `--th` | `#E4E4E4` | Table header, section rows |
| `--rule` | `#C8C8C8` table cell border, `#DDD` list row divider | Hairlines |
| `--active` | `#E6ECFF` | The running game's row in a list (tint, not selection) |
| `--held` | `#E6F4EA` | A table row whose input is currently held |
| `--term-bg` / `--term-fg` | `#0C0C0C` / `#E8E8E8` | Technical log |
| `--stage` | `#000` | The area around the canvas; letterbox bars |
| `--canvas-empty` | `#0E1326` (text `#9aa3c7`) | Canvas placeholder before a game loads |
| Icon gradient | `linear-gradient(90deg, #2A7BD8 50%, #3BA55D 50%)` | Generated game icon (two-tone block; real icons are generated per machine, never artwork) |
| Red button | radial `#ff6b6b → #c41818`, border `#6b0b0b`, drop `#5a0a0a` | Arcade buttons on the controller strip and the controls picture |
| Pill | fill `#e9e9e9`, border `#777`, drop `#555` | COIN / START and cabinet switch pills |

There is no dark theme. The desk is already dark enough for a TV, and the
mocks are checked only in this palette.

### 1.2 Type

One face: `Tahoma, "Segoe UI", Verdana, sans-serif`. Monospace for
technical text (log, file names, pad input names):
`"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`. Line height
1.35–1.4. Weight 700 for titles, selected tabs, names, state words;
400 everywhere else. Menu titles underline their first letter (the
accelerator). No italics.

Sizes are a **density**, not per component. Every component uses the
same role sizes; the root density sets them.

| Role | Desktop (`data-density="desktop"`) | Phone (`phone`) | TV (`tv`) |
| --- | --- | --- | --- |
| body | 14 | 15 | 22 |
| small (status, hints, counts, table cells) | 12.5 | 13 | 17–19 |
| tiny (dots' labels, pin hint, switch labels) | 11 | 12 | 15–16 |
| title bar | 15 | 16 | 24–26 |
| heading in a pane / game name on the card | 18 | 18 | 24–28 |
| list row | 14 | 16 | 22 |
| action button (TV only) | — | — | 23 |
| paused overlay | 26 | 24 | 36 |

Rule: TV is desktop × 1.6, phone is desktop × 1.1 with wider touch
targets. The kit exposes the densities as a root attribute and the
components never hard-code a pixel size.

### 1.3 Space and shape

| Token | Desktop | Phone | TV |
| --- | --- | --- | --- |
| desk margin (around the window) | 10 | 0 (window fills) | 14 |
| gutter between columns / rows of controls | 10 | 8 | 18 |
| control padding (button) | 8 × 14 | 10 × 14 | 16 × 20 |
| list row padding | 10 × 10 | 12 × 12 | 12–14 × 18 |
| menu item padding | 5 × 24 (left 20) | 12 × 16 | — (no menus on TV) |
| bevel width | 2 | 2 | 3 |
| focus ring | 2px dotted, inset 5 | same | 3px dotted, inset 8–9 |
| modal / window drop shadow | 2px 2px 0 #000 (menus) | none | 6px 6px 0 #000 |
| radius | 0 everywhere, except pills (20), red buttons (50 %), hint (24), chip (10) | | |

Minimum hit target on phone and TV: 44 px.

### 1.4 The bevel

Two recipes, used by everything:

- **Raised** (`.bevel`): face `--face`; border `2px solid`, colours
  `--light --dark --dark --light` (top, right, bottom, left); inner
  shadow `inset -1px -1px 0 --mid, inset 1px 1px 0 --soft`.
- **Sunken** (`.sunken`): fill `--light`; border `2px solid`, colours
  `--mid --light --light --mid`; inner shadow `inset 1px 1px 0 --dark`.

Windows, buttons, tabs, menus, pad keys, cards: raised. Lists, tables,
text areas, the canvas frame, the controller picture: sunken. On TV the
border is 3 px and the inner shadow unchanged.

## 2. Surfaces

| Surface | Desktop | Phone | TV |
| --- | --- | --- | --- |
| Desk | `--desk`, window inset by the desk margin | `--desk` behind the game only; windows are centred and the desk shows round them | `--desk`, window inset 14 px |
| Main window | raised, grid rows: title bar · menu bar · main · status bar | portrait: bar · canvas · switches · controller · status; landscape: panels either side of the canvas, translucent top strip | raised, grid rows: title bar · main (two columns) |
| Game stage | black, canvas centred by the Size setting | same, full width | fullscreen when playing; last frame in a sunken frame in the menu |
| Dim veil | `rgba(0,0,0,.35)` under modals | `.55` under windows | the game is replaced by the window, no veil |

## 3. Components

Each row says what the component is, its states, and where it is
reused. "Local" is `/local`, "phone" is `/mobile-local-*`, "TV" is
`/presentation`.

### 3.1 Chrome

| Component | Definition | States | Local | Phone | TV |
| --- | --- | --- | --- | --- | --- |
| **Title bar** | `--title` band, 700 white text, small app glyph, right-aligned secondary text (counts, mode, paused) | — | window and every modal | every window; ✕ at the right | window |
| **Menu bar** | row of menu titles, first letter underlined; open title inverts to `--title`; dropdown is a raised panel with black 2 px offset shadow; items are rows with an optional right-aligned `small` (slot time, hint); `hr` is a `--mid` over white rule; disabled item `--mid` with white 1 px text-shadow; ✓ prefix for toggles, bold value for the current radio choice | open, item hover (inverted), disabled, checked | Configure · State · View · Log | replaced by the ☰ Menu window with tabs State · View · Settings | none |
| **Pinned shortcuts** | `.btn` row after a separator: Pause/Resume, Mute, Reset, slot group (Slot select · Save · Load), Fullscreen, Controller; hidden under 950 px | per button | menu bar right | the portrait bar carries Games · Pause · Mute · ↺ · ☰ as icon buttons | the action column (§3.5) |
| **Status bar** | small text, cells divided by `--mid` rules, first cell flexes; state word `--ok` bold when running, `--warn` bold when paused | running, paused, idle | bottom of window | bottom of the page | none; the title bar's right text carries "paused" |
| **Separator** | 1 px `--mid` vertical (bars) or horizontal (menus, panes) | — | | | |

### 3.2 Buttons and controls

| Component | Definition | States | Local | Phone | TV |
| --- | --- | --- | --- | --- | --- |
| **Button** `.btn` | raised, body size, optional leading glyph; `.sm` 12/3 × 9; `.play` 700 12; `.primary` 700 with dotted `--title` ring (the default action in a dialog foot) | hover (none), disabled (`--mid` + white shadow), focus ring, primary | everywhere | everywhere | the foot of the Controls view; row "Change…" |
| **Action button** (TV) | a `.btn` at TV density, full column width, leading glyph in a 34 px cell, trailing `small` or a selector; focused = inverted (`--title` fill, white text, dotted white ring inset 9) | focus, disabled | — | — | the left column |
| **◀ value ▶ selector** | inline: two small raised arrow cells round a value; left/right change it; used where a desktop view would use a select or a slider | focus (on the whole row) | — | the Menu window's View rows | slot, Apply to, Analogue rows, Size and the like |
| **Select** | native `select` in a `label` | — | slot group; Settings | Settings | never (selector instead) |
| **Checkbox / radio** | native in a `label`, one per line inside a `fieldset` | — | Settings, Controls scope | same | selector instead |
| **Range** | native `range` with the value beside it | — | Analogue | Analogue | selector instead |
| **Chip** | small boxed label, `--ok` fill when on (`held`) | on/off | Test input Now column | same | same |
| **Bar** | 90 × 10 sunken meter filled `--ok` | — | Analogue test rows | same | same |
| **Dot** | 9 px circle `--ok` / `--bad` / `--warn` / `#bbb` before a word | — | file check lines, pad status | same | same |
| **Pill** | rounded, 700 small caps-like label with a drop; `.mini` for pictures | pressed (drop collapses) | COIN / START, cabinet switches | same | controls picture only |
| **Red button** | 58 px round gradient button with the button number; `.off` 35 % for undeclared; `.mini` 22–34 px for pictures | pressed, off | controller strip | controller | controls picture only |
| **D-pad** | 3 × 3 grid of raised keys round a flat centre; `.dpadmini` for pictures | pressed | controller strip | controller | controls picture only |
| **Drop zone** | dashed `--dark` border on `#D6D6D6`, bold line and sub-line | drag-over (invert) | Import | Import | never (import is Play mode) |

The kit's `Range` wrapper added for W23b keeps the label, native slider and
formatted output in one focusable row; it does not replace the browser's range
keyboard behavior.

### 3.3 Containers

| Component | Definition | States | Local | Phone | TV |
| --- | --- | --- | --- | --- | --- |
| **Modal** | raised window, fixed, centred, title bar sticky with ✕, `max-height 92vh`, scrolls; `.foot` right-aligned buttons with the primary last-but-highlighted; veil behind | — | Import, Settings, Controls, Presentation, Per-game, Log, File check, confirmations | the same as centred windows at 92 % width, no veil change | the Controls view is this modal's content inlined in the right column |
| **Tabs** | strip under the title bar; tab is raised with the bottom edge open, `--tab-off` face; `.on` is `--face`, 700, overlaps the rule | on, focus | Import, Settings, Controls | short labels (P1 · P2 · Cabinet · Analogue · Test) | same labels as local |
| **Pane** | 10 × 12 margin inside a modal; `.note` small `#333` for guidance, `.note.warn` for cautions | — | | | |
| **Fieldset** | 1 px `--mid` box with legend, one labelled control per line | — | Settings, Analogue | Settings | — |
| **Key-value grid** `.kv2` | two columns, label then control, 8 × 14 gap | — | Settings, Presentation | Settings | — |
| **Table** | white, collapsed, 1 px `--rule` cells, `--th` header; `tr.hl` inverted (the selected row); `tr.dim` `#777`; section rows `--th` 700 spanning the table | selected, dim, held (`--held`) | Controls, Test, File check, Per-game | same | same at TV density |
| **Terminal** `.term` | `--term-bg` on `--term-fg`, monospace, pre, scroll | — | Technical log | same | never |
| **Confirmation** | a small modal: question, one line of consequence, two buttons; the destructive one is not the primary | — | Clear saved play, Restart from power-on | same | never (both are Play mode) |

### 3.4 Lists

| Component | Definition | States | Local | Phone | TV |
| --- | --- | --- | --- | --- | --- |
| **Games list** | sunken, scrolling; row = name · right-aligned status (no icon: generated icons were dropped on 2026-10-25, a game icon returns only if it can come from real game data); selected row inverted; status is `small` `#777`, red word in `--bad` for Missing files / Bad file / Not stored / Not a game | selected, active (running game: `--active` tint, "playing" in `--ok` 700), focus | accordion rows (`details`): closed row shows Play or Check or the red word; open row shows the harness card lines, inline game info, File check / Remove / Import on `--panel` | flat rows in the Games window, Play button per playable row | flat rows, Play per playable row, active row's button reads Resume; no accordion, no import |
| **List head / foot** | heading with right-aligned count; small foot line | — | Import button lives in the head | Import replaces the window content in place (‹ Games back) | foot says import is in Play mode |
| **Stored files list** | same rows, status Stored / Pending / Skip | — | Import's Stored tab | same | never |
| **Menu list** (phone) | one raised row per item with a right `small`, full width, 44 px min | focus | — | Menu window tabs | — |

### 3.5 Game-specific

| Component | Definition | Local | Phone | TV |
| --- | --- | --- | --- | --- |
| **Game card** | icon · name (18, 700) · meta line (manufacturer · year · resolution at Hz · players · buttons) · status line (saved progress, slots) | not on the page: the status bar carries the running game's name and meta, the open list row its info | top of the Menu window's State tab | right column, under the last frame, at TV size |
| **Controller strip** | three columns: d-pad · the **Cabinet** row (Service, Test, Vol −, Vol + as small buttons) and the **Operator** row (the keys the game reports) each with a tiny uppercase label, COIN / START pills below, a one-line note instead of the rows when no game runs · six red buttons; no game card and no name on the strip; hidden by View › Controller | under the canvas | portrait: switches row, then controller; landscape: split either side | never (the pad is real) |
| **Controls picture** | sunken box: mini d-pad, six mini red buttons (off for undeclared), COIN / START mini pills, one-line note | Controls › Player n | same | same |
| **Canvas frame** | black stage, canvas sized by Fit / Stretch / Integer, dashed placeholder before load, PAUSED overlay (`.55` black, 26 px 700 letter-spaced) | | | fullscreen while playing; the menu shows the last frame in a sunken frame |
| **Start hint** | pill-shaped `rgba(0,0,0,.7)` band over the bottom of the game, yellow `b` for the keys, fades after three seconds | — | first start (menu gesture) | first start |

## 4. Focus and input model

One model for keyboard, pad and touch, so the same component works in
every mode:

- **Focusable** things: buttons, rows, tabs, selectors, menu items,
  table rows that have a Change… cell. Not focusable: labels, notes,
  status, the canvas.
- **Focus ring**: dotted, `--title` on a light face, white on an
  inverted one, inset so it never changes layout. On TV the focused
  action button or row is also inverted, because a ring alone is too
  thin at distance.
- **Keys**: arrows move within a group and cross to the neighbouring
  column at the edge; Enter / A activates; Esc / B steps back one
  level (closes a menu, cancels a dialog, returns a sub-view to its
  parent, finally returns to the game); Tab is desktop-only and walks
  groups; left / right on a selector change its value; LB / RB switch
  tabs when a tab strip has focus or on TV anywhere in a tabbed view.
- **Touch**: everything is tappable; the phone has no focus ring until a
  pad or keyboard is used.
- **Menu gesture** (`docs/ui-spec.md` §6): L3 + R3 by default, Esc,
  two-finger tap. It opens the Menu window on the phone and the
  presentation window on TV, and does nothing on the desktop page
  except focus the menu bar.

## 5. Vocabulary

Fixed words, the same in every mode (`docs/ui-spec.md` §6):
**Play / Resume**, **Pause**, **Mute**, **Reset** (soft), **Restart from
power-on…** (hard, confirms), **Save to slot n / Load slot n** (desktop
menus) and **Save state / Load state ◀ slot ▶** (phone and TV),
**Save progress** (write the overlay), **Clear saved play for this
game…** (confirms), **Controller** (the on-screen strip), **Controls…**
(the mapping dialog), **Controllers** (TV: the same dialog),
**Presentation…** / **Play mode** (the mode switch each way),
**Import**, **Stored files**, **File check**, **Technical log**.
Status words: **playing**, **ready**, **Missing files**, **Bad file**,
**Not stored**, **Not a game**, **Stored**, **Pending**, **Skip**.
Trailing ellipsis means "opens a window"; none means it acts at once.

## 6. What M24 builds from this

Built by W21 (merged 2026-10-25): `ui/tokens.css`, `ui/kit/`, `ui/focus/FocusController.tsx`, `ui/gallery/`; `npm run build:ui` then `/ui/gallery` on the dev server. The values W21 fixed where this document gave a range are in `docs/work/W21-merge-note.md` (TV small 18, tiny 16, title 25, heading 26; Page Up / Page Down as the keyboard tab keys; stick threshold 0.55).

1. **Tokens** as CSS custom properties on `:root`, with the three
   densities selected by `data-density` on the root (desktop, phone,
   tv); the phone and TV values are the table in §1.2–1.3, not ad-hoc
   overrides.
2. **The component kit** in §3 as classes with the states listed, each
   driven by `data-*` attributes rather than by JavaScript-added inline
   styles; focus per §4 handled once in a small focus controller the
   kit ships with, so pad navigation is not re-implemented per view.
3. **A gallery page** (the M24 acceptance): every component at all three
   densities with every state, generated icons only, no titles. The
   gallery is served by the dev server beside the mocks and is what the
   kit's browser test screenshots.
4. **The mocks are then retired** in favour of the gallery plus the
   views built from the kit (M25 desktop shell, M26 dialogs, M28 phone,
   and the presentation window after them).

Out of scope for the kit: artwork, a dark theme, animation beyond the
hint's fade and a pressed button's 1 px drop, custom fonts beyond the
system stack.
