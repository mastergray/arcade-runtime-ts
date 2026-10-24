# W29 — Fields with their own key codes, operator keys, volume and the save flag

Lane: **Native + TypeScript** (one agent). Branch: `wp/w29-coded-fields`.
Milestones: M37 (reframed below), M33, M35.

## 0. Why

The hand test of wave 4 (2026-10-24) found three boards whose play or
first boot cannot be driven from the harness, and a port-level reading of
the pinned source shows one cause behind all of them.

The generated controller config (§4.4) binds **port types** under
`<system name="default">`: `P1_BUTTON2`, `COIN1`, `SERVICE`, and so on. In
0.161 that changes `ioport_manager::type_seq`, which a field consults only
when its own sequence is the default marker
(`emu/ioport.c`, `ioport_field::defseq`, lines 1560–1572). A field declared
with `PORT_CODE(KEYCODE_x)` carries its own sequence, so the type mapping
never applies to it, and since the web OSD registers no keyboard device the
key code is dead too. Every such field is unreachable from this runtime
today. The census over the 88 driver sources our `mame/targets/*.lua`
files compile (`grep -o 'PORT_CODE(KEYCODE_[A-Z0-9_]*)'`) finds 173 such
fields:

| Class | Examples (driver: field, code) | Effect today |
| ----- | ------------------------------ | ------------ |
| Standard types with a code | `toobin.c` every button (`P1 Throw` LCONTROL, four paddle buttons D/A/Q/E); `bzone.c` buttons 2–10 (A/Z/S/X/D/C/T/V/M); `segas32.c`, `segaxbd.c`, `segahang.c`, `segaybd.c`, `polepos.c` gear and shift buttons (SPACE/LSHIFT/Z…); `namcos2.c` `P1 Fire`/`P2 Fire` (LSHIFT/RSHIFT); `snowbros.c` gambling clones | The pad and the keyboard map never reach the button. The `toobin.c` title has no `IPT_START`: a game starts with `P1 Throw`, so the hand test could not start it |
| `IPT_SERVICE` with a code | 25 fields on `KEYCODE_F1` (Neo Geo and Konami "Test Switch"/"Service Mode"); `qix.c` `Test Advance` F1, `Test Next line` F2, `Test Slew Up/Down` F5/F6; `taito_f2.c` `Service A/B/C` 9/0/MINUS | Our `test` control (`SERVICE` → `JOYCODE_1_BUTTON11`) does nothing on these boards. The `qix.c` title boots an empty CMOS into a language-select screen that waits for `Test Advance`, so the hand test could not pass it |
| `IPT_OTHER` with a code | `williams.c` `Advance` F2, `Auto Up` F1, `High Score Reset` 9 (every set); `midyunit.c` `Vault Switch` 9; `neogeo.c` `Next Game` 3 / `Previous Game` 4; `mcr.c` door switches A/S/D/F; `taitosj.c` level-skip Q/W | No port type exists, so nothing can bind them. Every `williams.c` title boots into "factory settings restored" and waits for `Advance`: all four hand-tested sets stopped there |
| `IPT_SPECIAL` with a code | `dkong.c` lines 1185–1186 (A/B, a hardware test hook) | Nothing; leave them alone |

Two smaller items ride on the same rebuild because the bridge changes
anyway: M33 (DCS cabinet volume buttons) and M35 (the save-support flag).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W29 | Bridge rebinding of coded fields to their type sequences; operator-key and volume items on virtual pad 1; `inputs.keys` and `supportsSave` in machine info; `key` and `volume` controls through `ArcadeInput`; keyboard pass-through for the operator keys; harness operator row and greyed save controls | `mame/bridge/web_input.cpp`, `mame/bridge/web_bridge.cpp`, `mame/patches/0001-*`, `0002-*` (the parts that carry those files), `src/shared.types.ts` (additive, §3.4), `src/ControllerConfig/`, `src/MameEmulatorAdapter/MameSession.ts` (control mapping and machine-info parsing only), `src/MameEmulatorAdapter/MameEmulatorAdapter.ts` (machine-info parsing only), `src/ArcadeInput/`, `src/KeyboardSource/`, `src/ArcadePlayer/ArcadePlayer.ts` (`saveState`/`loadState` guard only), `harness/harness.ts`, `harness/index.html`, `tests/support/FakeArcadeSession.ts`, `docs/probes/families/atari-gauntlet.md` and `midway-mcr.md` (one paragraph each) | W3, W7, W26, W28 | §2.1, §2.2, §4.2–§4.4, §6, §9, §10.3, §11 | N+T | M37, M33, M35 |

Write set: the files above plus your tests: `tests/spec/10-shared-types.test.ts`,
`13-arcade-input.test.ts`, `15-controller-config.test.ts`,
`16-keyboard-source.test.ts`, `17-web-bridge-sources.test.ts`,
`23-mame-adapter.test.ts`, `24-arcade-player.test.ts`, and
`tests/browser/22-web-bridge.test.ts` (cases gated on the ignored preload
configs, as the existing ones are). `src/shared.types.ts` is normally
frozen; the integrator grants the **additive** changes in §3.4 and nothing
else in it. `src/index.ts` stays integrator-owned: list the exports you
need in the merge note. Do not touch `src/ArcadeCabinet/` (M38 landed
there this week) or `src/GamepadSource/` (pads get the operator keys from
the UI lanes, not from this package).

## 2. Read first, then confirm in the pinned source

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.2–§4.4, §6, §10.3,
§11; `docs/work/W26-analog-input.md` (the last package that changed the
bridge input device; its shape is the model for this one);
`mame/bridge/README.md` and `tests/spec/17-web-bridge-sources.test.ts`
for how `mame/bridge/*.cpp` and the patches are kept identical. The ROADMAP
rows M33, M35 and M37 are the requirements; this brief supersedes the M37
row's design sketch.

Facts from `.cache/mame0161-source/src` the design rests on; read each and
cite the lines in the merge note:

- `emu/ioport.c` 1560–1572 (`ioport_field::defseq`): the type sequence is
  consulted only while the field's own sequence `is_default()`. Lines
  1708–1735 (`set_user_settings`): a sequence equal to the type's default
  is stored as the default marker, anything else is stored as is in
  `m_live->seq`. Find where `ioport_field::seq()` reads the live sequence
  and when `m_live` exists (after `ioport_manager::init`), and where the
  machine-specific `cfg/<machine>.cfg` is loaded relative to that point,
  so your rewrite runs after both and is not undone.
- `emu/input.h` 445–480 (`input_seq`): `operator+=` appends a code,
  `operator|=` appends `or_code` then the code, `length()`, `operator[]`,
  `is_default()`. `emu/inpttype.h` 486–487: `IPT_VOLUME_DOWN`/`UP` are
  `OTHER`-class digital types with default keys MINUS/EQUALS, so the
  controller config can bind them like `SERVICE` (`port type="VOLUME_UP"`;
  confirm the token in `ioport.c`'s type-name table).
- `emu/inpttype.h` 700–760: the UI types' default keys (`TAB`, `ESC`,
  `F3`, `F5`, `F6`, `MINUS`, `EQUALS`, arrows, `ENTER`). This is why the
  design below never adds a keyboard device: the moment one exists, those
  UI sequences become live. Everything stays on `DEVICE_CLASS_JOYSTICK`.
- `mame/patches/0002-*` line 92: where `web_bridge_start` is called.
  Decide whether that point is after `ioport_manager::init` and the cfg
  load; if not, run the rewrite from the first `web_run_frames` instead,
  once, and say so.
- `drivers/toobin.c` 115–136, `drivers/williams.c` 718–730,
  `drivers/qix.c` 314–325, `drivers/midtunit.c` 199–200 and
  `drivers/midwunit.c` 222–223 (`IPT_VOLUME_DOWN`/`UP`): the fields this package must reach.

## 3. Design

### 3.1 Bridge: rebind coded fields (`web_bridge.cpp`)

After the ports are live and the controller/machine cfg has been applied,
walk every `ioport_field` once. For each field whose standard sequence is
not the default marker and whose type is not `IPT_UNUSED`/`IPT_UNKNOWN`/
`IPT_SPECIAL`/`IPT_CUSTOM`/a DIP or config type:

1. **Type sequence.** Let `T = type_seq(field.type(), field.player())`.
   If `T` is non-empty and this field is the **only** coded field with
   that type and player on the machine, append `OR T` to the field's
   standard sequence. (When several coded fields share a type, as the
   `qix.c` test switches share `IPT_SERVICE`, skip this step for them:
   one pad item must not press four switches. Their keys come from step
   2.) This restores the pad and keyboard-map path for every button in
   the first table row and the `test` control for the single-switch
   boards in the second.
2. **Operator key item.** If the field's own sequence contains one of the
   key codes in the operator table below, append `OR JOYCODE_1_<item>` for
   that key's pad-1 item. This reaches the `IPT_OTHER` and multi-switch
   `IPT_SERVICE` fields by the key MAME documents for them.

Write the result with `set_user_settings`. Make the walk **idempotent**:
skip a code that is already present in the sequence, because a later
`cfg/<machine>.cfg` save (part of the overlay) will carry the rewritten
sequence back in on the next boot and the walk runs again. Log one line
per rewritten field through the existing bridge console path at the
`DIAG`-free default verbosity you find there (or not at all if the bridge
has no such path); never a line per frame.

### 3.2 Bridge: new items on virtual pad 1 (`web_input.cpp`)

Append to the item table, keeping every existing index and token exactly
as it is (the §4.4 contract is frozen for indices 0–26):

| Index | Name | `input_item_id` | Role |
| ----- | ---- | --------------- | ---- |
| 27 | Volume Up | `ITEM_ID_BUTTON16` | `VOLUME_UP` port type (M33) |
| 28 | Volume Down | `ITEM_ID_BUTTON17` | `VOLUME_DOWN` port type (M33) |
| 29 | Key F1 | `ITEM_ID_BUTTON18` | operator key |
| 30 | Key F2 | `ITEM_ID_BUTTON19` | operator key |
| 31 | Key F5 | `ITEM_ID_BUTTON20` | operator key |
| 32 | Key F6 | `ITEM_ID_BUTTON21` | operator key |
| 33–42 | Key 0 … Key 9 | `ITEM_ID_BUTTON22` … `BUTTON31` | operator keys |

`ITEM_ID_BUTTON32` is the last button id in 0.161; this table stops one
short of it. The operator table maps `KEYCODE_F1/F2/F5/F6/0…9` to indices
29–42. `MINUS` (`taito_f2.c` `Service C`) is deliberately left out. These
items exist on pads 2–4 too (the device loop is shared) but only pad 1's
are ever written.

### 3.3 Bridge: machine info (`web_bridge.cpp`)

`web_machine_info` gains:

- `inputs.keys`: one row per field found by §3.1 step 2,
  `{ "name": <field name>, "key": "F1" | "F2" | "F5" | "F6" | "0" … "9", "player": 1–4 }`,
  deduplicated by name and key, in port order. Boards without coded
  fields report `[]`.
- `inputs.volume`: `true` when the machine declares `IPT_VOLUME_UP` or
  `IPT_VOLUME_DOWN`.
- `supportsSave`: `(system().flags & GAME_SUPPORTS_SAVE) != 0` (M35).

Keep `players` and `buttons` as they are.

### 3.4 Shared types (additive only)

```ts
type ArcadeKeyName = "F1" | "F2" | "F5" | "F6" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type ArcadeControl = … existing variants …
    | { readonly kind: "key"; readonly key: ArcadeKeyName }            // operator key: a field's own PORT_CODE
    | { readonly kind: "volume"; readonly direction: "up" | "down" };  // cabinet volume buttons (M33)
interface MachineInputs {
    readonly analog: …; readonly dualStick: boolean;
    readonly keys: ReadonlyArray<{ readonly name: string; readonly key: ArcadeKeyName; readonly player: PlayerIndex }>;
    readonly volume: boolean;
}
interface MachineInfo { …; readonly supportsSave: boolean; }
```

`arcadeControlKey` gives them `key:F1`-style and `volume:up`-style keys;
`isArcadeControl` and `isMachineInfo` accept them; the F10/F11 fixtures
in `tests/spec/10-shared-types.test.ts` gain rows. `MameSession.setControl`
maps `key` and `volume` to pad 0 and the indices above and drops them
silently when `machine.inputs.keys` has no row for that key (same rule as
`select`).

### 3.5 Controller config (`controllerConfigFor.ts`)

Two unconditional lines: `VOLUME_UP` → `JOYCODE_1_BUTTON16`,
`VOLUME_DOWN` → `JOYCODE_1_BUTTON17`. Nothing for the operator keys: they
bind at field level in the bridge, not at type level. Update the §4.4
table and the frozen expected output in test 15.

### 3.6 `ArcadeInput`, `KeyboardSource`

`ArcadeInput` passes the two new kinds through unchanged (press, release,
tap, releaseAll, snapshot).

`KeyboardSource` gains a **pass-through layer** beside the map: the
browser codes `F1`, `F2`, `F5`, `F6`, `Digit0`–`Digit9` always send the
matching `key` control in addition to whatever the map says, so on a
`williams.c` board `F2` presses both our `test` control (as today) and the
board's `Advance` switch, exactly as F2 does in MAME. Same `enabled`,
repeat, blur and `preventDefault` rules as mapped keys. A page can turn
the layer off with a new `passthroughKeys?: boolean` option (default
true); the default map itself does not change except for two new entries,
`Equal` → volume up and `Minus` → volume down.

### 3.7 `ArcadePlayer`, harness

`ArcadePlayer.saveState`/`loadState` reject with `UNSUPPORTED` when
`machine.supportsSave` is false, before reaching the session (M35), with
the message naming the driver flag.

Harness: an **Operator** row under the existing cabinet buttons, built
from `machine.inputs.keys` after start (one button per row, label
`<name> (<key>)`, pressing taps the `key` control), hidden when the list
is empty; two volume buttons shown when `inputs.volume` is true; the
quick-save and quick-load buttons disabled with a title "This driver
cannot save in 0.161" when `supportsSave` is false. The production quick-save step of browser test 34
(and any other browser case that quick-saves) skips with that reason
instead of timing out when the preloaded machine cannot save.

### 3.8 Spec

§2.1 (vocabulary), §2.2 (`MachineInfo`), §4.2 (items), §4.3
(`web_machine_info` shape and the rebind step), §4.4 (table rows, and
replace the sentence "Keyboard defaults and the MAME UI are never in the
input path" with the precise rule: no keyboard device exists, so MAME's
UI and type-default keys never fire; a field's own `PORT_CODE` is reached
through the operator items of pad 1), §6, §9 (`saveState` guard), §10.3
(pass-through layer), §11 (operator row).

## 4. Build and verify

Build **two** families with `--jobs 8`: `atari-gauntlet` (the `toobin.c`
coded buttons, first table row) and `midway-mcr` (the `williams.c`
`IPT_OTHER` switches, third row). Your sandbox cannot run Chromium; the
integrator runs F4–F6 and the browser cases with the ignored preload
configs supplied in the worktree (`res/preload-toobin.json`,
`res/preload-joust.json`, `res/preload-defender.json`). What you can and
must do:

- `npm run check`, `npm test` green; test 17 proves the bridge copies and
  the patches are identical.
- Build ids in `mame/builds/<family>.json` updated for both families and
  the probe records gain one paragraph each naming the rewritten fields
  (driver and field names, no game titles).
- A node-side check that `web_machine_info` of each built family's title
  reports the expected `inputs.keys` rows is welcome if the existing
  module-loading fakes allow it; otherwise describe the expected rows in
  the merge note so the integrator's browser run can assert them.

Acceptance the integrator will run: the `toobin.c` title starts from the
pad's button 1 and the keyboard map's button 1 after a coin; a
`williams.c` title leaves "factory settings restored" on `F2` and plays;
the `qix.c` title leaves language select on `F1`; the DCS title's volume
rises with `Equal` and survives a restart (CMOS); `supportsSave` is false
for a `leland.c` machine and true for `williams.c`.

## 5. Rules

Everything in `W14-family.md` §2–§8 about the worktree, the toolchain
links and the ignored inputs applies. Never run `npm run build`,
`npm run clean`, `build-mame --all` or `--fresh`. No game title, and no
reference to a title the integrator tested, in any tracked file or commit
message: name drivers and fields. Commit on your branch as you go; do not
rebase; if a git command is refused, note it and continue. Finish with
`docs/work/W29-merge-note.md`: what changed, the cited source lines, the
build ids, the expected `inputs.keys` rows for the three preload configs,
the exports `src/index.ts` needs, and anything left undone.
