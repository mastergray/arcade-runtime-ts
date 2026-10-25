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
| Where the game is seen | On the device that loaded it | On another display: a TV, monitor or cast target |
| Where the game is controlled | The same device: keyboard, pad, touch | A pad on the couch, or the loading device used as a controller |
| Role of the loading device | Library, play surface and controls in one page | A **console**: library, menus and status, plus an optional touch pad; it does not show the play surface except as a thumbnail |
| Navigation model | Pointer first (mouse, touch); pad and keyboard focus as an alternative | **Focus first**: everything reachable with a d-pad and two buttons; pointer and touch also work on the console |
| Reading distance | Arm's length | TV distance for the play display's own menu; arm's length for the console |
| Entry | Default | Chosen in the Presentation panel, or automatically when a second display or cast target is present and the user accepts |

The two modes share one library, one ROM store, one saved-play store and
one set of per-game settings. Switching modes never re-imports anything.

### 1.1 What "another display" means

Three transports, in the order they are supported. The feature sets in
§3 do not depend on the transport.

1. **Second window, same browser (v1).** The console opens a play window
   and the user drags it to the external display, or the Window
   Management API places it there when the browser grants it. The two
   windows talk over a `BroadcastChannel` or a `MessagePort`.
2. **Cast target (v1 if the browser supports it).** The Presentation API
   starts the play page on a cast target. Chrome renders that page on the
   loading device and streams it as video to the target (its 1-UA mode),
   so the emulator still runs on the loading device. Messages flow over
   the presentation connection.
3. **Mirrored or extended display (always).** The OS already shows the
   loading device's screen on the TV. Presentation mode then only changes
   the UI: the play page is fullscreen on the mirrored display and the
   console is the same page's menu, driven from the pad.

In every transport **the emulator runs on the loading device**. ROMs
never leave the browser that imported them; audio plays where the
emulator runs unless the transport carries it (the cast path does).

### 1.2 Roles

- **Play page**: the display surface. In local mode it is the main page.
  In presentation mode it is the second window, the cast receiver page or
  the fullscreen page on a mirrored display. It shows the canvas, a status
  line, a pad-driven overlay menu (§4.5) and nothing else.
- **Console page**: the library, the load flow, the game menu, controls,
  settings and the presentation panel, on the loading device. In local
  mode the console and the play page are the same page.

## 2. Views

Seven views cover both mockup sets. The table says which mode shows each
view, on which page, and from which mockups it was taken.

| View | Local | Presentation | Source mockups |
| --- | :---: | :---: | --- |
| V1 Library | yes | console | desktop main window, phone library, tablet library dialog, presentation "Library" |
| V2 Load game (import, identify, file check, launch) | yes | console | import dialog, presentation "Load Game" (desktop and phone, six steps) |
| V3 Game (current game, actions, saved states) | yes | console and play-page overlay | cabinet controls strip, presentation "Game", phone game/save/load/sound |
| V4 Controls | yes | console | controls dialog, presentation controls (inputs, analogue, buttons, system, presets, test input) |
| V5 Settings | yes | console | settings dialog (General, Video, Audio, Storage) |
| V6 Presentation | yes (to enter the mode) | console | presentation set, "Presentation" item on every console menu |
| V7 Play surface | yes | play page | play area, phone play portrait and landscape, tablet portrait |

## 3. Feature sets

Each row is a feature a view must support. **L** is local mode, **P** is
presentation mode. "same" means identical behaviour; a note says what
differs. "runtime" says whether the runtime already has the surface
(see the roadmap's §2 table) or the feature is new UI state.

### 3.1 V1 Library

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| List every playable set in the store, with a generated icon, name and meta line (year, manufacturer, family) | yes | yes | store + metadata; year and manufacturer are M27 | Families and set names come from served metadata; no catalogue |
| Tabs All, Favorites, Recent | yes | yes | new preference store | Recent is the last ten started, per browser |
| Search by name, manufacturer, year | yes | yes | metadata | On the console in P, search is a text field; pad users get an on-screen keyboard only on the play-page overlay (not in v1: the overlay has no search) |
| Select a set and start it | yes | yes | cabinet | In P the start happens on the play page; the console shows "starting" then "running" |
| Add to or remove from favorites | yes | yes | new | |
| Game info (players, display, controls summary, files) | yes | yes | metadata, audit, machine info | The "Additional information" block of the load flow, reused |
| Counts: sets, families, files saved | yes | yes | store | Status bar in L, footer in P |

### 3.2 V2 Load game

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Drop or choose zip files; drop anywhere on the page | yes | console | store | On a phone console the picker is the file chooser; "From downloads" and "Recent files" from the phone mockup are the same chooser (the web has no download-folder access) |
| Identify each file against served metadata | yes | yes | W18 flow | |
| File check table: file, status (ok, missing, optional missing, wrong size or CRC), details | yes | yes | audit | |
| Required files: companion zips, BIOS, device ROMs, with found or missing per archive | yes | yes | audit | |
| Re-scan after adding files | yes | yes | audit | |
| Additional information: players, display, controls, family, driver notes | yes | yes | machine info and metadata | |
| Launch when complete; launch disabled with a reason when not | yes | yes | audit status | In P, launch sends the play page to the game |
| Technical log | yes | yes | harness log | Collapsible in L; a panel in the desktop P layout; a sub-view on the phone |
| Store confirmed files only in this browser; remove one or all | yes | yes | store | |

### 3.3 V3 Game

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Current game card: thumbnail, name, meta | yes | yes | last frame from the display | In P the thumbnail is the console's only picture of the game |
| Resume (close the menu, unpause) | yes | yes | cabinet pause | In L the menu pauses only when the Settings option "pause while the menu is open" is on; in P opening the menu on the play page always pauses, opening it on the console never does |
| Save state to a slot, load state from a slot | yes | yes | player save/load; `supportsSave` | Slots are a UI concept over the quick-save store: v1 ships **one slot** with a thumbnail and a timestamp; the five- and ten-slot lists in the mockups are post-1.0 and need a multi-slot store. Greyed with a reason when the driver cannot save |
| Save changes (persist NVRAM and config now) | yes | yes | cabinet persist | |
| Clear saved play for this game | yes | yes | cabinet | Confirm first |
| Soft reset, hard reset | yes | yes | cabinet | Hard reset confirms |
| Sound on or off, volume | yes | yes | audio mute and gain | The phone mockup's master, game, effects and UI-sound sliders collapse to one gain plus mute; "effects" and "UI sounds" do not exist |
| Operator row (field-level keys the machine reports) and cabinet volume keys | yes | yes | W29 | Shown only when the machine reports them |
| Fullscreen | yes | play page | display | On the play page in P it is the default state |
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
| Test input: live view of every bound control | yes | yes | input state | The phone "Test Input" screen; on the console it also proves the relay in P |
| Touch layout choice (where the on-screen pad exists) | yes | console | §10.1 touch (M10 touch half, M28) | |

### 3.5 V5 Settings

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| General: go fullscreen on start, mute on start, save changes automatically, pause while the menu is open | yes | yes | cabinet autosave, display, audio | |
| Video: aspect ratio, integer scaling, filter, side-border crop | yes | yes | display scaling and rendering; crop is new (roadmap §2) | In P these apply to the play page |
| Audio: volume, mute | yes | yes | audio | |
| Storage: files saved, saved play per game, clear all; strictness (strict or MAME) | yes | yes | store, audit strictness | |
| Emulator build override (Auto) | yes | yes | family resolution | Advanced |
| Show FPS | yes | yes | display | |

### 3.6 V6 Presentation

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Enter presentation mode: open the play window, start a cast, or declare the mirrored display | yes | — | **new**: window and Presentation API glue | |
| Choose the transport and the target (a screen from the Window Management API, a cast target, or "this screen is mirrored") | yes | yes | new | |
| Play-page state: connected, which screen, resolution, lost | — | yes | new | |
| Return to local mode: close the play window or stop the cast; the game continues locally | — | yes | new | The emulator never restarts on a mode change |
| Console input relay on or off: the console's pad, keyboard and touch pad drive the game on the play page | — | yes | new: input relay over the channel | The pad focused on the play page drives the game directly |
| Overlay menu on the play page: enabled, which pad gesture opens it | — | yes | new | See §4.5 |

### 3.7 V7 Play surface

| Feature | L | P | Runtime | Notes |
| --- | :-: | :-: | --- | --- |
| Canvas at native size or scaled per the Video settings, rotation honoured | yes | yes | display | |
| Status line: name, size and rate, input sources, saved | yes | yes | cabinet | Hidden in fullscreen after a few seconds |
| Cabinet strip: save, load, reset, mute, menu | yes | overlay | cabinet | On the play page in P the strip is the overlay menu |
| On-screen pad: d-pad or stick, up to six buttons, coin, start; portrait below the canvas, landscape halves beside it, swap sides | yes (phone, tablet) | console | M28 touch | In P the touch pad lives on the console and relays |
| Pause on hidden tab, resume on return | yes | yes | cabinet | In P the play page's visibility rules the pause, not the console's |
| Pad takeover gesture to open the menu | yes | yes | new focus layer | §4.5 |

## 4. Cross-cutting rules

### 4.1 One state, two pages

The console and the play page are views over the **same cabinet**. In
local mode they are one page. In presentation mode the play page owns the
`ArcadeCabinet` and the console sends it commands and inputs, and receives
status, the current frame as a thumbnail at one or two frames per second,
and the machine info. Every V3 action is therefore available from both
sides with the same meaning. The channel protocol is a small typed
message set (start, stop, pause, resume, save, load, persist, clear, reset,
mute, gain, input press and release, axis, status, thumbnail, machine
info, error) and is a package of its own in the roadmap.

### 4.2 Focus layer

A single focus layer serves keyboard arrows, the pad and TV remotes:
d-pad or left stick moves focus, A (button 1) activates, B (button 2) goes
back, Start opens the menu. It exists in both modes and on both pages.
Every control in every view is reachable through it; pointer and touch
are additional, never required. Focus is visible (the mockups' thick
blue frame).

### 4.3 Pad ownership

While a game runs, the pad focused on the play page belongs to the game,
including the W30 chords. The takeover gesture (§4.5) is the only pad
event the UI consumes. On the console in presentation mode the pad
belongs to the UI while a menu is open and relays to the game otherwise.

### 4.4 Per-game and global settings

Controls, analogue settings, video crop and the pause-on-menu option are
per game with a global default; favorites, recent, strictness and the
presentation transport are global. All of it lives in one preference
store per browser, next to the ROM store.

### 4.5 Overlay menu on the play page

In presentation mode the play page can open a compact V3 menu over the
paused game: resume, save, load, save changes, clear, soft reset, hard
reset, sound, and "back to library" (which stops the game and returns the
console to V1). It is pad-driven only, large type, no text entry. The
opening gesture is a held Select (the coin button) for one second,
which does not collide with the W30 chords because those need a second
button; holding Select alone taps no coin when it opens the menu. The
same gesture works in local mode on the play surface.

### 4.6 Status everywhere

Every view shows the running state in a fixed place: no game, starting,
running, paused, error; the connected pads; and in presentation mode the
play-page connection. The desktop mockups put it in the status bar, the
presentation mockups in the title bar and footer, the phone in the header.

## 5. Out of scope for 1.0 (recorded, not forgotten)

- Multiple save slots with thumbnails (needs a multi-slot store).
- Cross-device presentation over the network (WebRTC and a signalling
  server). The cast path covers the TV case without it.
- Genre: not in MAME's metadata; dropped from every meta line.
- Game artwork: the project ships none; the "game art" panels become the
  last-frame thumbnail.
- Separate game, effects and UI-sound volumes.
- A second player from a second console device.

## 6. Decisions to confirm before the layouts

1. The emulator always runs on the loading device (§1.1). Confirm.
2. One save slot in 1.0, multi-slot later (§3.3). Confirm.
3. The overlay menu gesture is Select held one second (§4.5). Confirm or
   name another.
4. In local mode, opening the menu pauses only when the setting says so;
   in presentation mode the play-page overlay always pauses (§3.3).
   Confirm.
5. The console relays its own touch pad and keyboard to the game in
   presentation mode (§3.6). Confirm it is wanted in 1.0.
6. Local mode replaces the developer harness page in place (the roadmap's
   open decision 2), so the browser tests keep guarding the shipped UI.
   Confirm.
