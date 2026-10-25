# UI specification — modes, views and feature sets

Status: draft 2026-10-25, written from the two mockup sets kept under the
ignored `res/ui/` directory (the retro desktop set of 2026-10-22 and the
presentation-mode set of 2026-10-24). This document fixes **what the UI
has to support in each mode** before any layout is drawn. The ASCII
layouts for desktop, tablet and phone in both modes follow in a second
document once the feature sets below are agreed. `docs/ui-roadmap.md`
keeps the milestone and package plan; this document is its requirements
input and supersedes its §1 inventory.

Rules that apply throughout: §0.3 of the runtime spec (no artwork, no
catalogue, no ROM hosting), the no-titles rule for tracked files, and the
runtime surfaces listed in the roadmap's §2 table. Nothing here needs a
new emulator build.

## 1. The two modes

| | **Local mode** | **Presentation mode** |
| --- | --- | --- |
| Where the game is seen | On the device that loaded it | On a TV that **mirrors** the device: cast screen, AirPlay mirroring or an HDMI cable |
| Where it is controlled | The same device: keyboard, pad, touch | A pad paired with the device; touch on the device as the fallback |
| What the page is | Library, play surface and controls in one page, pointer first | The **same page in a TV skin**: landscape locked, the game fullscreen, a large-type pad-driven menu over the paused game |
| Navigation model | Pointer first; pad and keyboard focus as an alternative | **Focus first**: everything reachable with a d-pad and two buttons; touch also works |
| Reading distance | Arm's length | TV distance |
| Entry | Default | Chosen in the Presentation view, or offered when the device reports a mirrored or external display |

Decided 2026-10-25 (decisions 1, 3, 5 of the first draft): the emulator
always runs on the loading device; mirroring is the only transport, so
the TV shows exactly what the device shows; there is no second page, no
second window, no cast receiver, no channel protocol and no input relay.
A phone in presentation mode shows the TV picture at phone size. The
on-screen touch pad is hidden in presentation mode unless the user turns
it on, because it would appear on the TV. The Presentation API path for
desktop Chrome is a post-1.0 option and is not designed here.

The two modes share one page, one cabinet, one library, one ROM store,
one saved-play store and one preference store. Switching modes never
restarts the emulator or re-imports anything.

### 1.1 Leaving the fullscreen game for the menu

The menu opens over the paused game (presentation) or beside the running
game (local, §4.4) on:

- **Pad**: a configurable **menu gesture**, one physical button or a set
  pressed together, matched on the rising edge of the full set, with no
  hold time. Default: both stick clicks (buttons 10 and 11), which nothing
  else binds. Stored per pad id in the preference store beside the W30
  chords and edited in Controls with a "press the buttons" capture. A pad
  that reports fewer buttons than its gesture needs has no gesture until
  the user sets one, and Controls says so when it connects.
- **Touch**: a two-finger tap anywhere on the canvas. No always-visible
  button. A one-line hint fades over the game for three seconds the first
  time a game starts in presentation mode in a session.
- **Keyboard**: Escape.

Closing it: the Resume item, B with nothing left to back out of, or the
gesture again. Browsers enter fullscreen and lock orientation only from a
user gesture: starting a game from the menu is that gesture, the menu
opens without leaving fullscreen, and if the user leaves fullscreen with
the system gesture the next Resume re-enters it.

## 2. Views

Seven views cover both mockup sets. The table says which mode shows each
view, on which page, and from which mockups it was taken.

| View | Local | Presentation | Source mockups |
| --- | :---: | :---: | --- |
| V1 Library | yes | yes | desktop main window, phone library, tablet library dialog, presentation "Library" |
| V2 Load game (import, identify, file check, launch) | yes | yes | import dialog, presentation "Load Game" (desktop and phone, six steps) |
| V3 Game (current game, actions, saved states) | yes | yes, as the overlay menu | cabinet controls strip, presentation "Game", phone game/save/load/sound |
| V4 Controls | yes | yes | controls dialog, presentation controls (inputs, analogue, buttons, system, presets, test input) |
| V5 Settings | yes | yes | settings dialog (General, Video, Audio, Storage) |
| V6 Presentation | yes (to enter the mode) | yes | presentation set, "Presentation" item on every menu |
| V7 Play surface | yes | yes, fullscreen | play area, phone play portrait and landscape, tablet portrait |

Seven views, one page. In presentation mode V1–V6 are the panels of the
overlay menu in the TV skin; V7 is the fullscreen game under it.

## 3. Feature sets

Each row is a feature a view must support. **L** is local mode, **P** is
presentation mode. "yes" under P means the feature is in the overlay menu; a note says what
differs. "runtime" says whether the runtime already has the surface
(see the roadmap's §2 table) or the feature is new UI state.

### 3.1 V1 Library

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| List every playable set in the store, with a generated icon, name and meta line (year, manufacturer, family) | yes | yes | store + metadata; year and manufacturer are M27 | Families and set names come from served metadata; no catalogue |
| Tabs All, Favorites, Recent | yes | yes | new preference store | Recent is the last ten started, per browser |
| Search by name, manufacturer, year | yes | yes | metadata | In P the search field opens the device's keyboard on touch; from a pad the list is filtered by the A–Z jump list instead (no on-screen keyboard in v1) |
| Select a set and start it | yes | yes | cabinet | In P starting goes fullscreen and locks landscape (the user gesture) |
| Add to or remove from favorites | yes | yes | new | |
| Game info (players, display, controls summary, files) | yes | yes | metadata, audit, machine info | The "Additional information" block of the load flow, reused |
| Counts: sets, families, files saved | yes | yes | store | Status bar in L, footer in P |

### 3.2 V2 Load game

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Drop or choose zip files; drop anywhere on the page | yes | yes | store | On a phone the picker is the file chooser; "From downloads" and "Recent files" from the phone mockup are the same chooser (the web has no download-folder access) |
| Identify each file against served metadata | yes | yes | W18 flow | |
| File check table: file, status (ok, missing, optional missing, wrong size or CRC), details | yes | yes | audit | |
| Required files: companion zips, BIOS, device ROMs, with found or missing per archive | yes | yes | audit | |
| Re-scan after adding files | yes | yes | audit | |
| Additional information: players, display, controls, family, driver notes | yes | yes | machine info and metadata | |
| Launch when complete; launch disabled with a reason when not | yes | yes | audit status | |
| Technical log | yes | yes | harness log | Collapsible in L; a panel in the desktop P layout; a sub-view on the phone |
| Store confirmed files only in this browser; remove one or all | yes | yes | store | |

### 3.3 V3 Game

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Current game card: thumbnail, name, meta | yes | yes | last frame from the display | |
| Resume (close the menu, unpause) | yes | yes | cabinet pause | Decision 4: in P opening the menu always pauses and Resume unpauses, there is no separate pause item; in L the menu never pauses by itself and the cabinet strip has an explicit Pause button, mirrored by a Pause or Resume item in the Game view |
| Save state to one of **three slots**, load from one | yes | yes | player save/load already take a slot name; `supportsSave` | Decision 2: three named slots; each slot's timestamp and a canvas thumbnail captured at save time live in the preference store; loading confirms; greyed with a reason when the driver cannot save |
| Save changes (persist NVRAM and config now) | yes | yes | cabinet persist | |
| Clear saved play for this game | yes | yes | cabinet | Confirm first |
| Soft reset, hard reset | yes | yes | cabinet | Hard reset confirms |
| Sound on or off, volume | yes | yes | audio mute and gain | The phone mockup's master, game, effects and UI-sound sliders collapse to one gain plus mute; "effects" and "UI sounds" do not exist |
| Operator row (field-level keys the machine reports) and cabinet volume keys | yes | yes | W29 | Shown only when the machine reports them |
| Fullscreen | yes | yes | display | In P it is the state while a game runs |
| Emulator status: state, video size and rate, audio, input sources, family, build, save-data count | yes | yes | machine info, cabinet | The "Emulator status" panel of the desktop P mockup |

### 3.4 V4 Controls

Organised **by player, not by device** (decided 2026-10-25). Pad *n*
drives player *n*, as the runtime assigns them (first pad to press a button is player 1; trading pads fixes a wrong order); the
keyboard serves both players with its two key sets; the touch controller
is player 1.

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Player 1 and Player 2 tabs, identical in shape: a device line (which keyboard set, which pad, touch), a picture of the on-screen controller with the buttons this machine uses lit (for an alternating-players game, player 2 lights only COIN and START), and **one table** whose rows are the controller's own labels (▲▼◀▶, B1–B6, COIN, START) and whose columns are Keyboard and Gamepad n | yes | yes | keyboard map (M10 editor), `GamepadMapping` (W30) | Change… waits for a key or a pad button, whichever comes; scope this game or all games |
| Cabinet tab: Service, Test, Tilt, Volume, the operator keys this game reports, and the page's menu gesture, each with a Keyboard column and a Gamepad column (chords are "hold Select +") | yes | yes | W29, W30 | The same switches appear on the on-screen controller under the game card |
| Analogue tab: one row per analogue control the machine declares (steering, pedal, dial…), with a **Keyboard** column (speed while a key is held, in steps per frame) and a **Gamepad** column (stick or trigger travel to control travel, in percent), an Invert box, and a "Use for all games" button per row; the rows **apply to this game**. Below, one global control for all pads and all games: stick centre tolerance (the dead zone, worded as how far a stick must move before it counts) | yes | yes | M32 in this package; dead zone today | |
| Test input: a table by function (P1 and P2 directions, buttons, coin and start, each analogue control, cabinet switches, operator keys, the menu gesture) with a column per device (Keyboard, Gamepad 1, Gamepad 2) showing the binding, and a Now column that lights or shows a bar while the input is held. Nothing reaches the game while the tab is open | yes | yes | input state | |
| Presets | — | — | — | dropped: scope this game / all games covers it |

### 3.5 V5 Settings

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| General: go fullscreen on start, mute on start, save changes automatically | yes | yes | cabinet autosave, display, audio | |
| Video: aspect ratio, integer scaling, filter, side-border crop | yes | yes | display scaling and rendering; crop is new (roadmap §2) | |
| Audio: volume | yes | yes | audio | Mute is the shortcut |
| Storage: stored files (Manage opens the Import modal's Stored tab), saved play size, **per-game settings** (count, and Manage opens a list of the games whose settings differ from the defaults, what they override, Reset per game and Reset all; saved play untouched), strictness (strict or MAME) | yes | yes | store, audit strictness, preference store | No emulator-build override: the family is resolved from the archive |
| **Export settings / Import settings**: a JSON file carrying the whole preference store (global and per-game settings, controls, favorites, recent) with an option to include saved play (the overlays, base64) so a library moves between browsers or devices; import merges by key and confirms overwrites | yes | yes | new: preference store | ROM archives are never exported |
| Restore all settings to defaults (confirms; keeps saved play and archives) | yes | yes | new | |
| Show FPS | yes | yes | display | |

### 3.6 V6 Presentation

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Enter presentation mode: switch the page to the TV skin, lock landscape, go fullscreen when a game starts | yes | — | new: skin, orientation lock | The device is already mirrored or cabled; the page cannot tell and does not try, beyond offering the mode when a second screen is reported |
| Leave presentation mode: back to the local skin, the game keeps running | — | yes | new | |
| On-screen touch pad in presentation mode: off by default, switchable | — | yes | M28 | It shows on the TV when on |
| Menu gesture status: the connected pad's gesture, or the warning that it has none | — | yes | new | Links to Controls |
| Hint on first start: how to open the menu | — | yes | new | Three seconds, once per session |

### 3.7 V7 Play surface

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Canvas at native size or scaled per the Video settings, rotation honoured | yes | yes | display | |
| Status line: name, size and rate, input sources, saved | yes | yes | cabinet | Hidden in fullscreen after a few seconds |
| Cabinet strip: save, load, reset, mute, pause, menu | yes | — | cabinet | In P the strip is replaced by the overlay menu |
| On-screen pad: d-pad or stick, up to six buttons, coin, start; portrait below the canvas, landscape halves beside it, swap sides | yes (phone, tablet) | off by default | M28 touch | |
| Pause on hidden tab, resume on return | yes | yes | cabinet | |
| Menu gesture to open the menu | yes | yes | new focus layer | §1.1 |

## 4. Cross-cutting rules

### 4.1 One page, one cabinet, two skins

Local and presentation are two skins of one page over one
`ArcadeCabinet`. A skin is a layout and a navigation default, not a
feature set: every V1–V6 feature is in both, and the state (current game,
slots, settings, favorites) is the same object. Switching skin never
restarts the emulator.

### 4.2 Focus layer

A single focus layer serves keyboard arrows, the pad and TV remotes:
d-pad or left stick moves focus, A (button 1) activates, B (button 2) goes
back, Start opens the menu while no game runs. It exists in both skins.
Every control in every view is reachable through it; pointer and touch
are additional, never required. Focus is visible (the mockups' thick
blue frame).

### 4.3 Pad ownership

While a game runs the pad belongs to the game, including the W30 chords.
The menu gesture (§1.1) is the only pad event the UI consumes during
play. While the menu is open the pad belongs to the UI.

### 4.4 Pause

Presentation: the menu opens over the paused game; Resume unpauses. Local:
the menu is beside the game and never pauses by itself; the cabinet strip
has Pause, and the Game view mirrors it. Both: a hidden tab pauses and
return resumes, as today.

### 4.5 Per-game and global settings: the preference store

A third IndexedDB store, `preferences`, beside `archives` (the ROM
store) and `overlays` (saved play). Two record kinds: one **global**
record (Settings values, controller-view default, view size, strictness,
the all-games keyboard map, the gamepad mapping and menu gesture per pad
id, favorites, recent, the skin) and one **per-game** record keyed like
the overlay (control overrides scoped to this game, analogue settings,
side-border crop, the three slot records with timestamp and thumbnail).
Per-game lookups fall back to the global record field by field. Clear
saved play deletes the overlay and the slot records and keeps the control
preferences; Remove all stored files touches neither. The store is a
small TypeScript package of its own and the first package of the UI
wave. Export and import (§3.5) serialise it.

### 4.6 Status everywhere

Every view shows the running state in a fixed place: no game, starting,
running, paused, error; the connected pads and whether each has a menu
gesture. The desktop mockups put it in the status bar, the presentation
mockups in the title bar and footer, the phone in the header.

### 4.7 The developer harness stays

Decision 6: the harness under `res/` and its browser tests stay unchanged
as the baseline for the runtime. The shipped UI is a new page in the
package with its own browser tests, served by the same dev server at a
second route so both can be opened side by side.

## 5. Out of scope for 1.0 (recorded, not forgotten)

- More than three save slots.
- A second surface: the Presentation API on desktop Chrome, or
  cross-device presentation over the network. Mirroring covers 1.0.
- Genre: not in MAME's metadata; dropped from every meta line.
- Game artwork: the project ships none; the "game art" panels become the
  last-frame thumbnail.
- Separate game, effects and UI-sound volumes.
- A second player from a second device.

## 6. Decisions (2026-10-25)

1. The emulator always runs on the loading device. **Confirmed.**
2. Three save slots with timestamp and thumbnail. **Confirmed.**
3. Menu gesture: a configurable button set per pad, default both stick
   clicks, no hold time; two-finger tap on touch; Escape on keyboard.
   **Confirmed.**
4. Presentation pauses on menu, local has an explicit Pause. **Confirmed.**
5. No input relay: mirroring makes it void. **Dropped.**
6. The developer harness stays as the baseline; the shipped UI is a new
   page. **Confirmed.**

Layouts: `docs/ui-layouts.md`.

## 7. The local page (desktop and tablet landscape)

Agreed 2026-10-25 from the tablet-landscape mockup and the HTML mock
`res/ui/mock/local.html`. One page, three regions and a bar: a games
column on the left, the play surface on the right with the controller
view under it, and a menu bar on top. The developer harness's card
details move into the games column as accordions.

### 7.1 Games column

- **Import** button at the top of the column, where the mockup had
  Search. It opens a modal: drop zone (dropping anywhere on the page
  opens the same modal), Choose files, the identification table of the
  dropped files (file, identified as, status, details), the companion
  notice, Store all and check, Close. **The modal stays open after Store
  all and check**: rows update in place to Stored, Pending (naming the
  companion still needed) or Skip, more files can be dropped while it is
  open, and the games column behind it updates live. Second tab Stored
  files (§7.4). No search or filter in 1.0: the column scrolls.
- **One row per game found**, the harness's cards folded into
  **accordions**: the closed row shows the generated icon, the name, and
  on the right either a **Play** button (the set is complete and checked)
  or the words **Missing files** (or "Bad file", "Not stored") in red.
  Playing is marked on the row. Opening a row shows exactly what the
  harness card shows: "Runs with the <family> build", one line per
  expected archive with its state (stored and checked, chosen but not
  stored, missing and whether required, bad file), the verdict, then the
  **game info** inline (manufacturer, year, driver file, players, display
  size, rate and orientation, control summary, operator keys, save-state
  support, when progress was last saved), and the row's actions: File
  check (the audit report), Remove, and Import when a file is missing.
  A row whose archive is no game in any build says so and offers Remove.
- **The closed row's right side holds the one primary action** for the
  row's state: **Play** when stored and checked OK; **Check** when the
  archives were chosen but not stored yet (the harness's Store and check,
  which stores them and runs the audit); the red word otherwise (Missing
  files, Bad file, Not a game), with the details one tap away.
- Column footer: games found, ready count, files saved, and the Saved
  files link (the per-file list with Remove, as in the harness).

### 7.2 Play surface

The canvas at its aspect with the size and rate under it when idle or in
the status bar when running; the PAUSED veil when paused; a one-line
prompt when no game is loaded.

### 7.3 Controller view

The on-screen pad under the canvas: d-pad; in the middle the **cabinet switches** (Service, Test, Volume when the machine
reports it) and the **operator keys** the machine reports, as small
buttons, shown only while a game runs, with COIN and START **below**
them; **always six buttons** (the runtime's maximum per player, which
covers every board in the matrix) with the ones this machine does not
declare dimmed, and the operator keys
the machine reports as small buttons on the card. **Toggleable** from
the View menu and the status bar; off by default when a keyboard or a
pad is present on a desktop, on by default on a touch device. When off
the canvas takes the full height.

### 7.4 Menu bar and shortcuts

The toolbar buttons become a **menu bar** with drop-downs, like the
desktop mockup's, followed by a fixed row of **shortcuts**.

| Menu | Items |
| --- | --- |
| Settings | Settings…, Controls…; Stored files… (the modal that manages every archive in the browser: size, which games use it, Remove, Remove all) |
| State | Save to slot 1–3 and Load slot 1–3, each with its timestamp or "empty"; Save changes; Clear saved play for this game…; Reset; Restart from power-on… |
| View | Controller view (checked), Show FPS; Size: Fit (keep aspect) / Stretch (fill the play area) / Integer (whole pixels); Fullscreen (keep aspect) / Fullscreen, stretched; Mode: Play / Presentation… |
| Log | Technical log…, Detailed file check…, Copy log |

Shortcuts, fixed and not configurable (decided 2026-10-25): Pause/Resume,
Mute/Unmute, Reset, then a **slot group** (a Slot picker showing 1–3 with
each slot's timestamp or "empty", and Save and Load buttons acting on the
chosen slot), Fullscreen, Controller. The State menu keeps the six
explicit slot items for the keyboard and the pad. Shortcuts hide below
tablet width; the menus keep every action reachable.

Vocabulary, so the menu says what the runtime does:

- **Reset** is the cabinet's reset button: MAME's soft reset, CPUs and
  devices restart, NVRAM and the loaded ROMs stay, no reload. The
  shortcut runs this one.
- **Restart from power-on** is the runtime's hard reset: the current
  state is saved to the overlay, the session exits and a fresh module
  starts from the cached ROMs and that overlay. NVRAM survives; it is
  the way out of a wedged machine and the only reset that re-reads DIP
  switches and the BIOS choice. It confirms.
- **Clear saved play for this game** empties that game's overlay: NVRAM,
  high scores, the configuration MAME wrote, and its three slots. It
  confirms. There is no "clear all"; the Stored files modal's Remove all
  removes archives, not saved play.

## 8. The local page on a phone

Mocks `res/ui/mock/mobile-local-portrait.html` and
`mobile-local-landscape.html` (2026-10-25). Same features as §7, laid out
for a phone; the tablet in landscape uses §7, in portrait this section.

### 8.1 Portrait

Rows, top to bottom: title bar (name on the right); a **bar** with
Games, Pause/Resume, Mute, Reset, and an icon-only menu button (☰); the
canvas at its aspect; a slim **switches** row (Cabinet: Service, Test,
Volume; Operator keys) that scrolls sideways and shows only while a game
runs; the **controller** (d-pad left, COIN and START in the middle, six
buttons right); the status line (state, game metadata, touch, pads).

- **Games** opens the games column as a **centred window** (not a bottom tray) with a title bar and Close: Import at the
  top, the same accordion rows with Play, Check or the red word, the
  Stored files link in its footer, Close in its title bar. **Import
  replaces the sheet's content in place** (a "‹ Games" button returns),
  never a second layer: the drop zone and chooser, the file table with
  Stored, Pending (naming the companion) and Skip, Store all and check.
  The screen stays until the user goes back, so several files can be
  added in turn.
- **☰** opens a centred **Menu window** with three **tabs**, State (slot picker,
  Save to slot, Load slot, Save progress, Clear saved play, Reset,
  Restart from power-on), View (Controller on/off, Fullscreen, Size,
  Presentation) and Settings (Settings, Controls, Stored files,
  Technical log, File check), and a ✕ in its title bar; tapping outside
  also closes it. No Close button.
- **The windows behind the items** (Settings, Controls, Presentation,
  Stored files, Per-game settings, Technical log, File check, the two
  confirmations) are the §7 modals as centred windows at 92 % width:
  opening one closes the Menu window; the tab strip wraps to short
  labels (P1, P2, Cabinet, Analogue, Test); tables keep three columns at
  most (control, keyboard, gamepad); the analogue rows stack one control
  per box; footers stick to the window's bottom edge; ✕ in the title bar
  or a tap outside closes.

### 8.2 Landscape

The canvas fills the middle; the controller splits into two side panels.
**Left, top to bottom: the Cabinet switches, the d-pad, COIN. Right: the
Operator keys, the six buttons, START** (decided 2026-10-25: switches
above the primary controls, so thumbs rest on the d-pad and buttons at
the bottom). **Swap sides** in the View tab mirrors the panels for
left-handed play. The bar is a translucent strip over the top of the
canvas in the same order as portrait: Games, Pause/Resume, Mute, Reset,
the status text, Fullscreen, ☰. Games, Import, the Menu window with its
tabs and the windows behind the items are the portrait ones, centred and
wider. With the controller off the canvas takes the whole screen and the
strip stays.

### 8.3 Rules

- Everything is reachable with one thumb: no hover, no double-tap, no
  long-press. Two-finger tap on the canvas opens the menu (§1.1).
- The on-screen pad is on by default on a touch device and off when a
  gamepad connects; the Controller item turns it back on.
- Fullscreen on a phone hides the title bar and status line; the strip
  (landscape) or the bar (portrait) stays until the controller is off,
  then it fades and returns on a tap.

## 9. Presentation mode

Mock `res/ui/mock/presentation.html` (2026-10-25). The same page in the
TV skin: landscape, the game fullscreen, one **menu window** over the
paused game, everything driven from the pad.

### 9.1 Playing

Only the canvas, scaled per the Size setting. On the first start in a
session a one-line hint over the bottom of the game names the three ways
in (the pad gesture, Esc, two-finger tap) and fades after three seconds;
the Presentation section can turn it off. No bar, no status line.

### 9.2 The menu window

Opens over the dimmed, paused game. Left: five large nav buttons, Game,
Library, Controls, Settings, Presentation. Right: the section as a list
of large rows, one focused with a visible frame; a row's right side holds
its value or a ◀ value ▶ selector that left and right change in place.
A footer along the bottom of the screen names the pad keys: A Select, B
Back, ✚ Move, the gesture to return to the game, and the connected pads;
the keyboard uses arrows, Enter, Esc.

| Section | Rows |
| --- | --- |
| Game | Game card (last frame, name, meta, when progress was saved); Resume game; Save to slot ◀ 1–3 with timestamps ▶; Load slot ◀ ▶; Save progress; Sound ◀ volume ▶; Reset; Restart from power-on…; Clear saved play…; Back to library (stops the game) |
| Library | One row per game: icon, name, and Play, "playing" or the red word; A on a ready row starts it and closes the menu. Import is not available here (the header says "import from Play mode") |
| Controls | Read-only summary rows per player and for the cabinet and operator chords; the two per-game analogue values as ◀ ▶ selectors (gamepad travel, invert); the menu gesture; Test input |
| Settings | Size, Filter, Side borders, Volume, Save progress automatically, FPS counter, each as a ◀ ▶ selector; a row saying import, stored files and exports live in Play mode |
| Presentation | Menu gesture per pad (read-only here); Show the touch controller ◀ ▶ (it appears on the TV); Show the hint on start ◀ ▶; Leave presentation mode (back to the local skin, the game keeps running) |

Rules: B on a row returns to the nav; B on the nav or the gesture again
closes the menu and resumes; confirmations (Restart, Clear) are two-row
prompts in the same style; no text entry anywhere; nothing in this skin
needs a pointer, and a mouse or touch still works on every row.

### 9.3 Phone

The same window at phone-landscape size with the nav as a row of five
tabs across the top of the window instead of a column, and the footer
hints inside the window's bottom edge. Portrait is not supported in
presentation mode: the page locks landscape when a game starts.
