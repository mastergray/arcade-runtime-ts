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

The library is the developer harness's library, restyled: a drop zone,
then one **card per game found** among the chosen and stored archives,
each card listing every archive the game needs with its state, a verdict
line and its actions. Managing what is loaded happens on the cards and
in the Saved files pane, never in a flat list.

```
┌─ Arcade Library ──────────────────────────────────────────────────────────────── _ ☐ ✕ ─┐
│ File   Games   Import   Controls   Settings   Presentation   Help                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [▶ Play]  [⤓ Import…]  [🕹 Controls…]                               1 234 games · 25 builds │
├──────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ Games                                │ Play                                                 │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │ ┌──────────────────────────────────────────────────┐ │
│   Drop zip files anywhere, or        │ │                                                  │ │
│   [Choose files…]  [Store all and check] │                                                  │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │ │                                                  │ │
│ 🔍 Filter…   [All ⌄]  Ready · Pending │ │               [ emulator canvas ]                │ │
│ ┌──────────────────────────────────┐ │ │                 320 × 224 · 60 Hz                │ │
│ │ ▦ Game name            ● Playing │ │ │                                                  │ │
│ │   Runs with the family build     │ │ │                                                  │ │
│ │   ● game.zip     stored, checked │ │ │                                                  │ │
│ │   ● parent.zip   stored, checked │ │ └──────────────────────────────────────────────────┘ │
│ │   Ready to play                  │ │ ▦ Game name                                           │
│ │   [Playing] [Game info…] [Remove]│ │   Manufacturer · 1990 · family · 2 players · 8-way, 3 btn │
│ ├──────────────────────────────────┤ │ [▶ Play] [☆ Favorite] [ℹ Game info…]                   │
│ │ ▦ Game name                      │ │ ┌ Cabinet ────────────────────────────────────────────┐ │
│ │   Runs with the family build     │ │ │ [⏸ Pause] [⛶ Fullscreen] [🔇 Mute] [↺ Soft] [⟲ Hard] │ │
│ │   ● game.zip     chosen, not stored│ │ [💾 Save ▾] [📂 Load ▾] [✓ Save changes] [🗑 Clear]  │ │
│ │   ○ bios.zip     missing (BIOS)  │ │ │ Operator: [Advance F2] [Auto Up F1] [HS Reset 9]    │ │
│ │   Needs bios.zip before it can run │ └─────────────────────────────────────────────────────┘ │
│ │   [Store and check] [Start]      │ │ ┌ Saved files in this browser ────────────────────────┐ │
│ ├──────────────────────────────────┤ │ │ game.zip     1.2 MB   used by 1 game      [Remove]  │ │
│ │ ▦ other.zip                      │▼│ │ parent.zip   3.4 MB   used by 2 games     [Remove]  │ │
│ │   Not a game in any available    │ │ │ bios.zip     128 KB   BIOS, used by 6     [Remove]  │ │
│ │   build.              [Remove]   │ │ │ 7 files · 5.1 MB            [Remove all saved files] │ │
│ └──────────────────────────────────┘ │ └─────────────────────────────────────────────────────┘ │
│ 42 games found · 38 ready            │ ▸ Detailed file check    ▸ Technical log               │
├──────────────────────────────────────┴──────────────────────────────────────────────────────┤
│ Running · Keyboard on · Gamepad 1 (menu: L3+R3) · Auto-save on · 7 files saved             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Drop zone** at the top of the Games pane, as in the harness; dropping
  anywhere on the page lands here. "Store all and check" stores every
  chosen archive that a card claims.
- **Cards**: one per game found, with the harness's lines: the set's
  description, "Runs with the <family> build", one line per expected
  archive (game, parent, BIOS, device, samples) with its state (stored
  and checked, chosen but not stored, missing and whether required, bad
  file), a verdict line, and the actions the harness has: Store and
  check, Start or Playing, Remove, plus Game info. A card whose archive
  is not a game in any build says so and offers Remove. The filter box
  and the All, Ready, Pending, Favorites, Recent drop-down narrow the
  cards; nothing is hidden by default.
- **Saved files pane** under the Cabinet box, the harness's "Files saved
  in this browser" with size, how many games use each archive, Remove
  per file and Remove all.
- **Detailed file check** and **Technical log** stay as disclosures at
  the bottom of the Play pane, as in the harness.
- **Play pane**, **Cabinet box** and **status bar** as described in the
  previous draft: Pause explicit, Save and Load as split buttons over the
  three slots, the Operator row only when the machine reports field-level
  keys, the status bar naming each pad's menu gesture.
- **Menus**: File (Choose files…, Store all and check, Saved files,
  Remove all saved files…, Quit game), Games (Play, Pause, Add to
  favorites, Game info…, Soft reset, Hard reset, Save state ▸ slots, Load
  state ▸ slots, Save changes, Clear saved play), Import (Choose files…,
  File check strictness ▸ Strict / MAME, Detailed file check), Controls
  (Controls…, Test input…), Settings (Settings…, Fullscreen, Mute, Show
  FPS), Presentation (Enter presentation mode, On-screen pad), Help
  (Keyboard bindings, Technical log, About).

### 1.2 Load game (V2)

There is no separate load dialog on desktop. The six steps of the
presentation mockup map onto the card: import is the drop zone, identify
is the card appearing with its description and family, file check is the
archive lines, required files is the same lines marked required or
optional, additional information is Game info, and launch is Start. The
Import toolbar button opens the file chooser and scrolls to the new
cards. "Detailed file check" shows the audit report of the selected card
with the strictness choice above it.

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

### 1.7 Game info (card detail)

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
