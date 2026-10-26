# UI roadmap — "Arcade Library" retro desktop

Status: draft 2026-10-22, started from the design mockups kept under the
ignored `res/ui/` directory (a retro desktop-OS treatment: title bars,
bevelled windows, a menu bar, dialogs, tabs and a status bar; desktop,
tablet-portrait, phone-portrait and phone-landscape artboards plus three
dialogs). The mockups are the aesthetic reference; this document maps their
screens onto runtime surfaces and work packages. All of it is post-1.0.0.

Decided: the aesthetic is the retro desktop OS. Open: see §5.

## 1. What the mockups contain

| Screen | Elements |
| --- | --- |
| Desktop main | Menu bar (File, Games, Import, Controls, Settings, Help); toolbar (Import games…, Saved files…, Controls…, Settings…, File check…, Technical log…); counts "N games / N builds"; three windows: Game library (tabs All / Favorites / Recent, search, list with generated icons), Play area (canvas, cabinet controls: Fullscreen, Mute, Soft reset, Hard reset, Save state, Load state, Save changes, Clear saved play; a strip with Play, Add to favorites, Game info and the game's maker / year / genre), and a status bar (Ready, Keyboard on, Gamepads, Auto-save, files saved) |
| Import dialog | Drop-anywhere zone, Choose files…, table File / Identified as / Status, a companion-zip notice, Store all and check, Cancel |
| Controls dialog | Tabs Player 1 / Player 2 / Gamepad; Action / Key table with Change key…; cabinet keys (Test, Service); Enable gamepads, connected-pad picker; Restore defaults, Cancel |
| Settings dialog | Tabs General / Video / Audio / Storage; when a game starts: go fullscreen, mute; saved play: save changes automatically; emulator build (Auto), aspect ratio, filter; Cancel, Apply |
| Phone library | Back to play, Import, tabs, search, list, status line (games, builds, saved) |
| Phone play (portrait) | Menu, toolbar (Library, Import, Controls, Settings, Full), canvas, cabinet controls (Save state, Load state, Reset ▾, Mute), on-screen pad (d-pad, COIN, START) |
| Phone play (landscape) | Pad halves flank the canvas; Save / Load / Reset / Menu; a swap-sides option |
| Tablet portrait | Canvas with pad below; Library opens as a dialog over play |

## 2. Mapping to the runtime

Everything the mockups show already has a runtime surface except the items
marked new.

| Mockup element | Runtime surface today | Gap |
| --- | --- | --- |
| Import, identification, companion notice, Store all and check | harness library flow over `ArcadeRomStore`, served metadata and `RomSetAudit` (§11, W18) | none; wording carries over |
| File check… | `RomSetAudit` strictness (M23) | none |
| Cabinet controls, auto-save, saved files | `ArcadeCabinet` actions and `ArcadeRomStore` | none |
| Status bar (keyboard, gamepads, auto-save) | cabinet state and `GamepadSource.players` | none |
| Favorites, Recent | — | **new**: a small per-browser preference store (IndexedDB or localStorage) keyed by machine |
| Search | served metadata descriptions | none |
| Maker / year / genre on the game strip and list | metadata has `description` only | **new**: extractor adds `year` and `manufacturer` from `-listxml`; genre is not in MAME and stays out unless a separately licensed catalogue is added later |
| Per-game icons | — | generated placeholders from a palette, as in the mockups; the project ships no artwork (§0.3) |
| Controls dialog, Change key… | `DEFAULT_KEYBOARD_MAP` is fixed | **M10 key remapping** (already on the roadmap): a map editor and a persisted custom map |
| Emulator build "Auto" | family resolved from the zip basename (W18) | none; the select only exposes an override |
| Aspect ratio, filter | `display.scaling`, `imageRendering` | none |
| Side-border trim (Video tab) | — | **new** (hand test 2026-10-22): the Neo Geo driver outputs the full 320-pixel line, and some titles leave the outer 8 columns on each side in their backdrop colour, which shows as flat vertical bars, and sprites that wrap across the left edge flicker in those same columns on another title (both hand tests 2026-10-22); most emulators offer a 304-wide crop that hides both. A per-family or per-machine `display.crop` of a few pixels, off by default, exposed on the Settings Video tab |
| On-screen pad, landscape pad halves, swap | §10.1 touch primitives (post-1.0, M10) | **new**: `TouchSource` and the pad layouts; today's runtime is desktop-only |
| Tablet library-as-dialog, phone navigation | — | **new**: responsive shell |
| Gamepad navigation of the shell (decided 2026-10-22) | `GamepadSource` drives the machine only | **new**: a UI focus layer driven by the pad (d-pad or stick moves focus, one button activates, one goes back, Start opens the menu) so the library, dialogs and cabinet controls work from the couch; the same layer serves keyboard arrows. While a game runs the pad belongs to the game, so a held button or the Select/Start pair opens the shell |

## 3. Milestones and packages (proposed)

| Milestone | Package | Scope | Depends on |
| --- | --- | --- | --- |
| M24 Retro desktop design system | W21 | **Done 2026-10-25** (W21 merged: React 19 kit under `ui/`, esbuild bundle, `/ui/gallery`, `docs/work/W21-merge-note.md`). Tokens, densities, components, states and the focus model are written down in `docs/ui-design-language.md` (2026-10-25, derived from the local mock). Theme tokens and a component kit taken from the mockups' values: window chrome and title bar, bevels, menu bar and menus, toolbar, dialog, tabs, list, table, status bar, buttons and form controls; a static gallery page proving every component in light of the mockups; no runtime wiring | — |
| M25 Desktop shell | W22 | The main screen built from the kit on top of the existing library flow: three windows, menu bar, toolbar, status bar, favorites and recent, search, generated icons; gamepad and keyboard focus navigation across every control; replaces `harness/index.html`'s layout while keeping its selectors and the browser tests green | M24, M19 |
| M26 Dialogs | W23 | Import, Settings and Controls dialogs; Controls needs the map editor and persisted custom map (M10's keyboard half), so W23 lands that half or follows it. Also a per-game **invert vertical** toggle (added 2026-10-23 after the W26 hand test): the `segaxbd.c` flight titles declare their vertical stick with MAME's reverse flag, so pulling back climbs as on an aircraft stick, which feels inverted on a pad; the toggle flips the Y-like increment/decrement lines in the generated controller file and negates the pad's vertical axis for that machine, so keyboard and pad invert together. A pad spin-rate setting for dial and trackball boards belongs beside it. **M32 (per-game analogue settings: key speed, sensitivity, centre speed, reverse, written to the machine's `cfg` like the DIP switches) lands with this package** (decided 2026-10-24) so the mechanism is tested through the dialog a player reaches, with the `leland.c` d-pad steering and the `tempest.c` dial as the acceptance | M25, M10 (keyboard) |
| M27 Game metadata | W24 | `year` and `manufacturer` in `romsets/<machine>.json` (additive), shown on the strip and list; search covers them | — (can run first) |
| M28 Touch and small screens | W25 | `TouchSource` and the on-screen pad from §10.1, phone-portrait, phone-landscape (with swap) and tablet layouts, the library-as-dialog, and the M10 mobile gates | M25, M10 (touch) |

Ordering: M27 and M24 first (independent, metadata is small); M25; M26;
M28 last since it brings the first mobile acceptance gates.

## 4. Rules that apply

- The page is still never hosted with ROMs; the "Arcade Library" is a page a
  consumer composes, exactly as the harness is today (§0.3, §11).
- No game titles, artwork or private library identity enter tracked files;
  the mockups' sample lists are not copied. Generated icons only.
- The harness tests (`tests/browser/37`, `38`) keep passing against the
  new shell; selectors are preserved or the tests move with them.

## 5. Open decisions

1. **Menu bar versus buttons.** The desktop mockup carries every action
   twice: in the menu bar (File, Games, Import, Controls, Settings, Help)
   and as toolbar buttons or in-window buttons. Which actions are
   menu-only, which are buttons, and what the phone's single Menu holds,
   needs deciding once for all layouts before W22 starts.
2. **Harness or product.** Whether this replaces the developer harness in
   place (one page, same tests) or becomes a second page that the package
   documents as the reference library UI.
3. **Pad takeover while playing.** Which pad gesture leaves the game and opens the shell (a held button, Select + Start), and whether it pauses the machine.
4. **Genre.** Out of MAME's metadata; include only if a licensed catalogue
   is chosen, otherwise drop the field from the strip.
