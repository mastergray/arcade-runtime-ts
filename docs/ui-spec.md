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

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Device picker: player 1, player 2, gamepad n, touch | yes | yes | keyboard map, pad players | |
| Action to key table per player, with Change key | yes | yes | **M10 keyboard half**: map editor and persisted custom map | |
| Gamepad layout: which physical button is which logical button, coin, start; d-pad and stick | yes | yes | `GamepadMapping` through the cabinet (W30) | |
| Operator chords (modifier and bindings) shown and editable | yes | yes | W30 | At least shown; editing is nice to have |
| Analogue: dead zone, and per game key speed, sensitivity, centre speed, invert | yes | yes | dead zone today; the rest is **M32** inside this package | |
| System: coin, start, service, test, tilt bindings | yes | yes | keyboard map | |
| Presets: save, load, restore defaults | yes | yes | new preference store | Per game and global |
| Test input: live view of every bound control | yes | yes | input state | The phone "Test Input" screen |
| Touch layout choice (where the on-screen pad exists) | yes | yes | §10.1 touch (M10 touch half, M28) | In P the pad is off by default |
| Menu gesture per pad (§1.1) | yes | yes | new, beside the W30 chords | Capture by pressing the buttons; shows a warning when the pad lacks the default |

### 3.5 V5 Settings

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| General: go fullscreen on start, mute on start, save changes automatically | yes | yes | cabinet autosave, display, audio | |
| Video: aspect ratio, integer scaling, filter, side-border crop | yes | yes | display scaling and rendering; crop is new (roadmap §2) | |
| Audio: volume, mute | yes | yes | audio | |
| Storage: files saved, saved play per game, clear all; strictness (strict or MAME) | yes | yes | store, audit strictness | |
| Emulator build override (Auto) | yes | yes | family resolution | Advanced |
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

### 4.5 Per-game and global settings

Controls, analogue settings, video crop and the three slots' records are
per game with a global default; favorites, recent, strictness, the skin
and the menu gestures per pad are global. All of it lives in one
preference store per browser, next to the ROM store.

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
  notice, Store and check, Cancel. Search moves into the column header
  as a filter icon that reveals a field when there are more games than
  fit; not shown by default.
- **One row per game found**, the harness's cards folded into
  **accordions**: the closed row shows the generated icon, the name, and
  on the right either a **Play** button (the set is complete and checked)
  or the words **Missing files** (or "Bad file", "Not stored") in red.
  Playing is marked on the row. Opening a row shows exactly what the
  harness card shows: "Runs with the <family> build", one line per
  expected archive with its state (stored and checked, chosen but not
  stored, missing and whether required, bad file), the verdict, and the
  row's actions: Store and check (when archives are pending), Remove,
  Detailed file check, Game info. A row whose archive is no game in any
  build says so and offers Remove.
- Column footer: games found, ready count, files saved, and the Saved
  files link (the per-file list with Remove, as in the harness).

### 7.2 Play surface

The canvas at its aspect with the size and rate under it when idle or in
the status bar when running; the PAUSED veil when paused; a one-line
prompt when no game is loaded.

### 7.3 Controller view

The on-screen pad under the canvas: d-pad, the game card with COIN and
START, six buttons with undeclared ones dimmed, and the operator keys
the machine reports as small buttons on the card. **Toggleable** from
the View menu and the status bar; off by default when a keyboard or a
pad is present on a desktop, on by default on a touch device. When off
the canvas takes the full height.

### 7.4 Menu bar and pinned shortcuts

The toolbar buttons become a **menu bar** with drop-downs, like the
desktop mockup's, followed by a row of **pinned shortcuts**.

| Menu | Items |
| --- | --- |
| Settings | Settings…, Controls…, Stored files…, Clear all saved play… |
| State | Save to slot 1–3 and Load slot 1–3, each with its timestamp or "empty"; Save changes; Clear saved play…; Soft reset; Hard reset… |
| View | Controller view (checked), Fullscreen, Show FPS; Mode: Play / Presentation…; Pinned shortcuts… |
| Log | Technical log…, Detailed file check…, Copy log |

Pause/Resume and Mute/Unmute are not menus: they are shortcuts. Any
menu item can be **pinned**; pinned items render as buttons right of the
menus, in the order pinned, and drop off from the right as the width
shrinks (the menus keep every action reachable). Default pins: Pause,
Mute, Save to slot 1, Fullscreen, Controller view. Pins are a global
preference.

"Stored files" is the harness's "Files saved in this browser": the zip
archives in the ROM store. Since every game's archives are visible in
its accordion row, the separate list only matters for archives no row
claims (a BIOS or device zip, or a leftover), so it lives in the Import
modal as a second tab, **Stored**, with size, which games use each file,
Remove and Remove all. The Settings menu item opens that tab.
