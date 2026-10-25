# UI layouts

Status: draft 2026-10-25. ASCII layouts for every view of both modes of
`docs/ui-spec.md`, one section per device class and mode, drawn in
the order they are agreed. Names in the drawings are placeholders; the
no-titles rule applies. Widths are proportions, not pixels.

Conventions: `[Button]`, `(•) radio`, `[x] checkbox`, `▸` a menu item
with a submenu or a disclosure, `█` the focused control, `…` a dialog
follows, `⌄` a drop-down.

## 1. Desktop, local mode

Pointer first; the focus layer (§4.2) reaches everything with arrows or
a pad. Minimum width 1024 px; below that the tablet layout (§3) applies.

### 1.1 Main screen

Decision applied here (roadmap open decision 1): the menu bar carries
every action; the toolbar keeps only the three mid-session actions, Play,
Import and Controls; status lives in the status bar; nothing else is
duplicated.

```
┌─ Arcade Library ──────────────────────────────────────────────────────────────── _ ☐ ✕ ─┐
│ File   Games   Import   Controls   Settings   Presentation   Help                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [▶ Play]  [⤓ Import…]  [🕹 Controls…]                               1 234 games · 25 builds │
├────────────────────────────┬────────────────────────────────────────────────────────────────┤
│ Library                    │ Play                                                           │
│ ┌ All ┐ Favorites  Recent  │ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search games…       │ │ │                                                          │ │
│ ├────────────────────────┤ │ │                                                          │ │
│ │ ▦ Game name        1984│ │ │                                                          │ │
│ │ ▦ Game name        1985│ │ │                     [ emulator canvas ]                  │ │
│ │ ▦ Game name        1987│▲│ │                       320 × 224 · 60 Hz                  │ │
│ │ █ Game name        1990│█│ │                                                          │ │
│ │ ▦ Game name        1991│ │ │                                                          │ │
│ │ ▦ Game name        1992│ │ │                                                          │ │
│ │ ▦ Game name        1993│ │ │                                                          │ │
│ │ ▦ Game name        1994│ │ └──────────────────────────────────────────────────────────┘ │
│ │ ▦ Game name        1996│ │ ▦ Game name                                                   │
│ │ ▦ Game name        1997│▼│   Manufacturer · 1990 · family · 2 players · 8-way, 3 buttons  │
│ └────────────────────────┘ │ [▶ Play] [☆ Favorite] [ℹ Game info…]                           │
│ 42 games · 25 builds       │ ┌ Cabinet ───────────────────────────────────────────────────┐ │
│ 7 files saved              │ │ [⏸ Pause] [⛶ Fullscreen] [🔇 Mute]  [↺ Soft reset] [⟲ Hard] │ │
│                            │ │ [💾 Save ▾] [📂 Load ▾] [✓ Save changes] [🗑 Clear saved]   │ │
│                            │ │ Operator: [Advance F2] [Auto Up F1] [High Score Reset 9]    │ │
│                            │ └────────────────────────────────────────────────────────────┘ │
├────────────────────────────┴────────────────────────────────────────────────────────────────┤
│ Running · Keyboard on · Gamepad 1 (menu: L3+R3) · Auto-save on · 7 files saved             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Library pane**: tabs All, Favorites, Recent; search filters the list
  as typed; each row is a generated icon, the set's description from the
  served metadata and its year (M27). Double-click or Enter plays; the
  strip under the canvas shows the selection before it is started.
- **Play pane**: the canvas keeps its aspect and scaling per Settings
  Video; below it the game strip (icon, name, meta line, three buttons)
  and the Cabinet box. Save and Load are split buttons listing the three
  slots with their timestamps; Save changes and Clear saved act on NVRAM
  and config; the Operator row appears only when the machine reports
  field-level keys (W29), and a Volume pair appears when it reports
  cabinet volume.
- **Status bar**: state, input sources, each pad's menu gesture or "no
  menu gesture", auto-save, files saved. Clicking the pad segment opens
  Controls on the Gamepad tab.
- **Menus**: File (Import…, Saved files…, Clear all saved play…, Quit
  game), Games (Play, Pause, Add to favorites, Game info…, Soft reset,
  Hard reset, Save state ▸ slots, Load state ▸ slots, Save changes, Clear
  saved play), Import (Import games…, File check…), Controls (Controls…,
  Test input…), Settings (Settings…, Fullscreen, Mute, Show FPS),
  Presentation (Enter presentation mode, On-screen pad), Help (Keyboard
  bindings, Technical log, About).

### 1.2 Load game (V2) — Import dialog

Opened by the toolbar, the File menu, or dropping a zip anywhere on the
page. One dialog carries the six steps of the presentation mockup as a
table plus two panes.

```
┌─ Import games ────────────────────────────────────────────────────────── ✕ ─┐
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│      Drop zip files anywhere on this page, or  [Choose files…]               │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ Files to import                                                              │
│ ┌──────────────┬──────────────────────┬──────────┬──────────────────────────┐ │
│ │ File         │ Identified as        │ Status   │ Details                  │ │
│ ├──────────────┼──────────────────────┼──────────┼──────────────────────────┤ │
│ │ game.zip     │ Game name (family)   │ ● OK     │ 42 files checked         │ │
│ │ parent.zip   │ parent of game.zip   │ ● OK     │ required by game.zip     │ │
│ │ other.zip    │ Game name (family)   │ ● Missing│ needs bios.zip (BIOS)    │ │
│ │ unknown.zip  │ not identified       │ ○ Skip   │ no family matches        │ │
│ └──────────────┴──────────────────────┴──────────┴──────────────────────────┘ │
│ ┌ Required files for the selected row ──────────┐ ┌ Additional information ─┐ │
│ │ ● game.zip        game      found             │ │ Players    2            │ │
│ │ ● parent.zip      parent    found             │ │ Display    320×224 60Hz │ │
│ │ ● bios.zip        BIOS      missing (required)│ │ Controls   8-way, 3 btn │ │
│ │ ○ samples.zip     samples   missing (optional)│ │ Family     family id    │ │
│ │                               [Re-scan files] │ │ Save       supported    │ │
│ └───────────────────────────────────────────────┘ └─────────────────────────┘ │
│ ▸ Technical log                                                              │
│ Confirmed files are kept only in this browser.                               │
│                                     [Store all and check]  [Play now] [Close] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Status values: OK, Missing, Wrong size, Wrong CRC, Skip. Store all and
  check stores every row that is not Skip; Play now is enabled when the
  selected row is OK and starts it after storing.
- "File check…" in the Import menu opens the same dialog on the stored
  files instead of new ones, with the strictness choice (strict or MAME)
  shown above the table.

### 1.3 Game (V3) — Save and Load slots

The Game view on desktop is the strip plus the Cabinet box of §1.1; the
only extra surface is the slot list under the split buttons.

```
[💾 Save ▾]                          [📂 Load ▾]
┌───────────────────────────────┐    ┌───────────────────────────────┐
│ ▣ Slot 1   2026-10-25 14:32   │    │ ▣ Slot 1   2026-10-25 14:32   │
│ ▢ Slot 2   (empty)            │    │ ▢ Slot 2   (empty)            │
│ ▣ Slot 3   2026-10-24 21:07   │    │ ▣ Slot 3   2026-10-24 21:07   │
└───────────────────────────────┘    └───────────────────────────────┘
```

Saving to a used slot and loading any slot confirm with the slot's
thumbnail. Both buttons are disabled with the tooltip "This driver cannot
save" when `supportsSave` is false.

### 1.4 Controls (V4) dialog

```
┌─ Controls — Game name ─────────────────────────────────────────────────── ✕ ─┐
│ ┌ Player 1 ┐ Player 2   Gamepad   Analogue   System   Presets   Test input    │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ ┌───────────┐  Action          Key          │ Scope                       │ │
│ │ │    ●      │  Up              ↑            │ (•) This game               │ │
│ │ │   ╱│╲     │  Down            ↓            │ ( ) All games               │ │
│ │ │  ──┴──    │  Left            ←            │                             │ │
│ │ │ 8-way     │  Right           →            │ Layout shows what the       │ │
│ │ │           │  █ Button 1      Ctrl         │ machine declares: 8-way,    │ │
│ │ │ ● ● ●     │  Button 2        Alt          │ three buttons.              │ │
│ │ │ B1 B2 B3  │  Button 3        Space        │                             │ │
│ │ │           │  Coin            5            │                             │ │
│ │ └───────────┘  Start           1            │                             │ │
│ │                [Change key…]  Press a key to assign it to Button 1         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ [Restore defaults]                                        [OK]  [Cancel]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tabs:

- **Player 1, Player 2**: the key table above. Rows beyond what the
  machine declares are greyed, not hidden.
- **Gamepad**: pad picker (connected pads by id), the physical-to-logical
  table (d-pad, left stick, buttons 1–6, coin, start), the W30 chord list
  (modifier and bindings), and the **menu gesture** row with
  `[Press the buttons…]`; a warning line when the pad has no gesture.
- **Analogue**: dead zone (global), and per game: key speed, sensitivity,
  centre speed, invert vertical, for each declared analogue port (M32).
- **System**: coin, start, service, test, tilt, volume up and down, and
  the machine's operator keys with their names.
- **Presets**: save the current tabs as a named preset, load one, delete.
- **Test input**: the live view, every bound control lighting as pressed,
  axes as bars.

### 1.5 Settings (V5) dialog

```
┌─ Settings ────────────────────────────────────────────── ✕ ─┐
│ ┌ General ┐ Video   Audio   Storage   Advanced               │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ When a game starts                                      │ │
│ │   [x] Go fullscreen        [ ] Mute sound               │ │
│ │ Saved play                                              │ │
│ │   [x] Save changes automatically (when the tab hides)   │ │
│ │ Show                                                    │ │
│ │   [ ] FPS counter                                       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Video   Aspect ratio  [Keep original ⌄]                 │ │
│ │         Scaling       [Integer ⌄]   Filter [Nearest ⌄]  │ │
│ │         Side borders  [Keep ⌄]  per game                │ │
│ │ Audio   Volume [────────●──] 80 %   [ ] Mute            │ │
│ │ Storage 7 files · 3 games with saved play               │ │
│ │         Strictness (•) Strict ( ) MAME                  │ │
│ │         [Saved files…] [Clear all saved play…]          │ │
│ │ Advanced Emulator build [Auto ⌄]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                        [OK]  [Cancel] [Apply]│
└─────────────────────────────────────────────────────────────┘
```

(Drawn with the tabs' contents stacked to show them all; each tab shows
only its own block.)

### 1.6 Presentation (V6) dialog

```
┌─ Presentation ────────────────────────────────────────── ✕ ─┐
│ Your screen is mirrored or cabled to the TV? Presentation    │
│ mode shows the game fullscreen with a menu you drive from    │
│ the pad.                                                     │
│                                                              │
│ Menu gesture   Gamepad 1: L3 + R3            [Change…]       │
│                Gamepad 2: no gesture set     [Set…]          │
│ On-screen pad  [ ] Show the touch pad (it appears on the TV) │
│ Orientation    Landscape, locked while a game runs           │
│                                                              │
│                        [Enter presentation mode]  [Cancel]   │
└──────────────────────────────────────────────────────────────┘
```

### 1.7 Game info (V1 detail)

```
┌─ Game name ──────────────────────────────────────────── ✕ ─┐
│ ▦  Manufacturer · 1990 · family id · driver.c                │
│ Players 2 · Display 320×224 at 60 Hz, horizontal             │
│ Controls 8-way joystick, 3 buttons · Operator keys: 3        │
│ Files   game.zip ● parent.zip ●                              │
│ Save    supported · 2 slots used · NVRAM saved 2026-10-25    │
│ [☆ Favorite]  [Controls…]  [Clear saved play…]  [Play]       │
└──────────────────────────────────────────────────────────────┘
```

### 1.8 Focus order

Toolbar → library tabs → search → list → game strip buttons → cabinet
buttons → operator row → status bar segments, then wraps. Within a
dialog: tabs → fields in reading order → footer buttons; Escape cancels;
Enter activates the default button.
