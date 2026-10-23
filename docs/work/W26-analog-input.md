# W26 — Analogue and dual-stick input

Lane: **Native + TypeScript** (one agent). Branch: `wp/w26-analog-input`.
Milestone: M11.

Every family build binds only digital joystick ports: the web input module
registers one hat and twelve buttons per virtual pad, and the generated
controller config maps `Pn_JOYSTICK_*`, buttons, coin, start, select,
service, test and tilt to them (§4.3, §4.4). Boards whose play control is
an analogue port therefore run but cannot be steered: `segaxbd.c`,
`segaorun.c`, `segahang.c`, `segaybd.c` and `taito_z.c` declare
`IPT_AD_STICK_X/Y/Z`, `IPT_PADDLE`, `IPT_PEDAL` and `IPT_PEDAL2`;
`polepos.c` declares `IPT_DIAL` with two pedals; `tempest.c` a dial;
`rampart.c` a trackball per player on its three-player set; and the vector
tank board in `bzone.c` uses two 2-way digital sticks
(`IPT_JOYSTICKLEFT_UP/DOWN`, `IPT_JOYSTICKRIGHT_UP/DOWN`) that the single
virtual hat never drives. This package binds all of them from the keyboard
and from standard gamepads, and answers probe question F11.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W26 | Analogue axes and second stick on the virtual pads, `web_set_axis`, machine input discovery, controller-config analogue and dual-stick lines, `ArcadeAxis` through `ArcadeInput`, gamepad axis binding, keyboard pedal keys | `mame/bridge/web_input.cpp`, `mame/bridge/web_bridge.cpp`, `mame/patches/0001-*`, `0002-*` (the parts that carry those files), `src/shared.types.ts` (additive, see §3.3), `src/ControllerConfig/`, `src/MameEmulatorAdapter/MameSession.ts` (control mapping and `setAxis` only), `src/ArcadeInput/`, `src/GamepadSource/`, `src/KeyboardSource/` (default map only), `tests/support/FakeArcadeSession.ts`, `docs/probes/families/` (F11 paragraphs only) | W3, W7, W8, W19 | §2.1, §4.2–§4.4, §6, §10.3, §10.4, §12 M11, F11 | N+T | M11 |

Write set: the files above plus your tests: `tests/spec/10-shared-types.test.ts`,
`13-arcade-input.test.ts`, `15-controller-config.test.ts`,
`16-keyboard-source.test.ts`, `17-web-bridge-sources.test.ts`,
`20-gamepad-source.test.ts`, `23-mame-adapter.test.ts`, and
`tests/browser/22-web-bridge.test.ts` (one case against your rebuilt
family, gated on the ignored preload config as the existing cases are).
`src/shared.types.ts` is normally frozen; for this package the integrator
grants the **additive** changes listed in §3.3 and nothing else in it.
`src/index.ts` stays integrator-owned: list the exports you need in the
merge note.

## 2. Read first, then confirm in the pinned source

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.2–§4.4 (virtual pads
and the controller config), §6 (`ArcadeInput`), §10.3–§10.4, the M11 row
of §12 and F11. `mame/bridge/README.md` and `tests/spec/17-web-bridge-sources.test.ts`
say how `mame/bridge/*.cpp` and the patches are kept identical; keep them
so.

The design below rests on these facts from `.cache/mame0161-source/src`;
read each before relying on it and cite the lines in the merge note:

- `emu/ioport.c`, `analog_field::frame_update` (around line 4179): each
  frame the field reads `seq_axis_value` of its **standard** sequence. An
  absolute item overrides everything *only while its raw value changes*;
  when it is unchanged the field falls through to the **decrement** and
  **increment** sequences, which add `m_delta` (the driver's
  `PORT_KEYDELTA`) per frame and, with `PORT_CENTERDELTA`, auto-centre when
  released. A relative item's raw value is a per-frame delta in
  `INPUT_RELATIVE_PER_PIXEL` (512) units. So MAME already contains the
  keyboard ramp the spec asks for: the generator only has to name our
  digital items in the increment and decrement sequences.
- `emu/input.c`, `input_class::standard_item_class` (around line 1000):
  `ITEM_ID_XAXIS`…`ITEM_ID_SLIDER2` are absolute on a joystick device;
  `ITEM_ID_ADD_RELATIVE1`…`16` are relative; everything else is a switch.
  `emu/input.h`: absolute values span `INPUT_ABSOLUTE_MIN`…`MAX`
  (±65536). `input.c` lines 75–110 show how relative and absolute items
  sample the device callback; decide from them whether the bridge must
  clear a relative accumulator after each sample (read-and-clear in the
  item callback is the intended shape) and prove it with the dial board.
- `emu/inpttype.h` lines 38–42 and 492–523: the stock default sequences,
  including that `JOYSTICKLEFT_*`/`JOYSTICKRIGHT_*` are plain digital
  types and that pedals default to an increment key with no decrement.
- `emu/ioport.c` line 190 and 4417: the controller-config `<newseq>`
  `type` attribute accepts `standard`, `increment` and `decrement`; and
  `input_seq` tokens join with ` OR ` (confirm the exact token in
  `input.c`'s sequence-to-token code).
- The driver port declarations with their `PORT_MINMAX`, `PORT_SENSITIVITY`,
  `PORT_KEYDELTA`, `PORT_CENTERDELTA` and `PORT_REVERSE` values:
  `drivers/bzone.c` 418–421 and 479–520, `tempest.c` 559–564,
  `rampart.c` 185–197, `polepos.c` 558–564, `segaxbd.c` 1104–1110 and
  1373–1379, `segaorun.c` 983–989, `segahang.c` 599–605 and 693–696,
  `taito_z.c` 2054–2061, `segaybd.c` 919–925, `superchs.c` 253–256.

## 3. Design (decided; implement as written, argue in the merge note if a fact above contradicts it)

### 3.1 Virtual pads (`web_input.cpp`, patch 0001)

Each Web Pad keeps items 0–15 exactly as today (test 17's contract) and
adds, in this order:

| Item | `input_item_id` | Name | Role |
| ---- | --------------- | ---- | ---- |
| 16–19 | `ITEM_ID_HAT2UP/DOWN/LEFT/RIGHT` | "Stick 2 …" | right stick of a dual-stick board |
| 20–23 | `ITEM_ID_HAT3UP/DOWN/LEFT/RIGHT` | "Stick 1 …" | left stick of a dual-stick board when a pad drives both sticks separately |
| 24–26 | `ITEM_ID_BUTTON13/14/15` | "Pedal 1/2/3" | digital pedal press (keyboard) |

and five absolute axes plus two relative axes, addressed by a separate
index through the new export:

| Axis index | `input_item_id` | Class | Role |
| ---------- | --------------- | ----- | ---- |
| 0 | `ITEM_ID_XAXIS` | absolute | stick X, paddle, steering |
| 1 | `ITEM_ID_YAXIS` | absolute | stick Y, vertical paddle |
| 2 | `ITEM_ID_ZAXIS` | absolute | stick Z (throttle) |
| 3 | `ITEM_ID_RXAXIS` | absolute | pedal 1 |
| 4 | `ITEM_ID_RYAXIS` | absolute | pedal 2 |
| 5 | `ITEM_ID_ADD_RELATIVE1` | relative | dial, trackball X |
| 6 | `ITEM_ID_ADD_RELATIVE2` | relative | vertical dial, trackball Y |

`web_set_axis(pad: i32, axis: i32, value: f32)` (patch 0002, exported and
`cwrap`ped like `web_set_control`): for an absolute axis `value` is
clamped to [−1, 1] and stored as `value × INPUT_ABSOLUTE_MAX`; for a
relative axis `value` is a delta in pixels (so `1.0` is one
`INPUT_RELATIVE_PER_PIXEL` unit) **added** to an accumulator that the item
callback returns and clears. Out-of-range `pad` or `axis` is ignored, as
`web_set_control` does. `web_input_exit` and a machine stop zero
everything.

### 3.2 Machine input discovery (`web_bridge.cpp`, patch 0002)

`web_machine_info` gains `"inputs"`: `{ "analog": [ { "player": n, "kind": k } … ], "dualStick": bool }`,
walking the same port loop that counts players and buttons. `kind` is
derived from the field type: `AD_STICK_X` → `"stick-x"`, `AD_STICK_Y` →
`"stick-y"`, `AD_STICK_Z` → `"stick-z"`, `PADDLE` → `"paddle"`, `PADDLE_V`
→ `"paddle-v"`, `PEDAL` → `"pedal-1"`, `PEDAL2` → `"pedal-2"`, `PEDAL3` →
`"pedal-3"`, `DIAL` → `"dial"`, `DIAL_V` → `"dial-v"`, `TRACKBALL_X/Y` →
`"trackball-x"/"trackball-y"`, `LIGHTGUN_X/Y` → `"lightgun-x"/"lightgun-y"`,
`MOUSE_X/Y` → `"mouse-x"/"mouse-y"`, `POSITIONAL`/`POSITIONAL_V` →
`"positional"/"positional-v"`. One entry per (player, kind), deduplicated;
fields behind a `PORT_CONDITION` are reported like any other.
`dualStick` is true when any `JOYSTICKLEFT_*` or `JOYSTICKRIGHT_*` field
exists. Light-gun, mouse and positional kinds are reported but not bound
by this package.

### 3.3 Shared types (additive only)

```ts
type ArcadeControl = … existing variants …
    | { readonly kind: "stick";  readonly player: PlayerIndex; readonly stick: 1 | 2; readonly direction: ArcadeDirection }   // one physical stick of a dual-stick board
    | { readonly kind: "pedal";  readonly player: PlayerIndex; readonly pedal: 1 | 2 | 3 };                                    // digital pedal press

type ArcadeAxisKind = "stick-x" | "stick-y" | "stick-z" | "pedal-1" | "pedal-2" | "spin-x" | "spin-y";
interface ArcadeAxis { readonly player: PlayerIndex; readonly kind: ArcadeAxisKind; }

type MachineAnalogKind = "stick-x" | "stick-y" | "stick-z" | "paddle" | "paddle-v" | "pedal-1" | "pedal-2" | "pedal-3"
    | "dial" | "dial-v" | "trackball-x" | "trackball-y" | "lightgun-x" | "lightgun-y" | "mouse-x" | "mouse-y" | "positional" | "positional-v";
interface MachineInputs { readonly analog: ReadonlyArray<{ readonly player: PlayerIndex; readonly kind: MachineAnalogKind }>; readonly dualStick: boolean; }
interface MachineInfo { … existing …; readonly inputs: MachineInputs; }
interface ArcadeSession { … existing …; setAxis(axis: ArcadeAxis, value: number): void; }
```

Predicates for each (`isArcadeAxis`, `isArcadeAxisKind`, `isMachineInputs`,
`isMachineAnalogKind`), `arcadeControlKey` extended for the two new
variants, `isArcadeSession` requires `setAxis`, and `MachineInfo` built by
the adapter from the JSON. Axis values: absolute kinds take [−1, 1] where
`stick-*` centre at 0 and `pedal-*` are −1 released … +1 floored; `spin-*`
take a signed delta in pixels per call. Out-of-range values are clamped,
non-finite ones throw `INVALID_CONFIG`.

### 3.4 Controller config (`controllerConfigFor`)

Emit, for every player 1…`players`, in addition to today's lines (which do
not change, so the existing exact-text cases only gain lines):

- Standard sequences: `Pn_AD_STICK_X` and `Pn_PADDLE` → `JOYCODE_n_XAXIS`;
  `Pn_AD_STICK_Y` and `Pn_PADDLE_V` → `JOYCODE_n_YAXIS`; `Pn_AD_STICK_Z` →
  `JOYCODE_n_ZAXIS`; `Pn_PEDAL` → `JOYCODE_n_RXAXIS`; `Pn_PEDAL2` →
  `JOYCODE_n_RYAXIS`; `Pn_DIAL` and `Pn_TRACKBALL_X` → the relative-1
  token; `Pn_DIAL_V` and `Pn_TRACKBALL_Y` → the relative-2 token. Use the
  exact tokens `code_to_token` prints for those item ids.
- Increment/decrement sequences, so keys and d-pads ramp through MAME's
  own key delta: X-like ports (`AD_STICK_X`, `PADDLE`, `DIAL`,
  `TRACKBALL_X`, `POSITIONAL`) decrement on `HAT1LEFT`, increment on
  `HAT1RIGHT`; Y-like ports (`AD_STICK_Y`, `PADDLE_V`, `DIAL_V`,
  `TRACKBALL_Y`, `POSITIONAL_V`) decrement on `HAT1UP`, increment on
  `HAT1DOWN` (MAME's own up/down convention; drivers apply `PORT_REVERSE`
  where the board wants the opposite); `AD_STICK_Z` increments on
  `BUTTON13` and decrements on `BUTTON14`; `PEDAL`, `PEDAL2`, `PEDAL3`
  increment on `BUTTON13`, `BUTTON14`, `BUTTON15` with no decrement.
- Dual-stick synthesis, so a single hat or d-pad drives both sticks as a
  tank (forward = both forward, turn = one forward one back) while a pad
  that drives the sticks separately uses hats 3 and 2:
  `Pn_JOYSTICKLEFT_UP` → `HAT1UP OR HAT1RIGHT OR HAT3UP`;
  `Pn_JOYSTICKLEFT_DOWN` → `HAT1DOWN OR HAT1LEFT OR HAT3DOWN`;
  `Pn_JOYSTICKRIGHT_UP` → `HAT1UP OR HAT1LEFT OR HAT2UP`;
  `Pn_JOYSTICKRIGHT_DOWN` → `HAT1DOWN OR HAT1RIGHT OR HAT2DOWN`;
  `Pn_JOYSTICKLEFT_LEFT/RIGHT` → `HAT3LEFT/RIGHT`;
  `Pn_JOYSTICKRIGHT_LEFT/RIGHT` → `HAT2LEFT/RIGHT`.

The config is written before the machine boots, so these lines are
unconditional; 0.161 ignores a port type the running machine lacks (§4.4).
Confirm in the MAME log of your rebuilt family that no line is rejected.

### 3.5 Session, input, sources

- `MameSession.setAxis` maps `ArcadeAxis` to `(pad, axisIndex)` and calls
  `web_set_axis`; `setControl` maps `stick` to hats 3 and 2 (items 20–23 and
  16–19) and `pedal` to items 24–26; both ignore players above
  `machine.players`.
- `ArcadeInput` and each `ArcadeInputChannel` gain `setAxis(axis, value)`.
  Axes are last-writer-wins, not reference-counted; `releaseAll` and
  channel destruction recentre every axis that channel last wrote (0 for
  `stick-*`, −1 for `pedal-*`, nothing for `spin-*`). Add
  `get axes(): ReadonlyArray<{ axis: ArcadeAxis; value: number }>` for the
  last written values and `get machine(): MachineInfo` (the session's) so
  sources can see what the board declares.
- `GamepadSource`, standard layout, applied only when `input.machine.inputs`
  declares the kind for that pad's player: left stick → `stick-x`/`stick-y`
  (dead zone, then rescaled to the full range) when the board declares
  `stick-x`, `stick-y`, `paddle` or `paddle-v`; left stick → `spin-x`/`spin-y`
  deltas proportional to deflection when it declares a dial or trackball
  (pick a per-poll rate that turns the `tempest.c` dial at a playable
  speed and record it); right stick vertical → `stick-z` when declared;
  trigger buttons 7 and 6 (`value` 0…1 mapped to −1…1) → `pedal-1` and
  `pedal-2` when declared. When `dualStick` is true, the left stick drives
  `stick: 1` and the right stick `stick: 2` through the existing
  direction quantiser, and the d-pad keeps driving ordinary directions
  (the synthesis in §3.4 turns those into tank control). Everything else
  in the layout is unchanged, and a pad on a board that declares nothing
  behaves exactly as today. `GamepadMapping` gains optional `rightAxes`
  and `pedals` overrides with the same shape as the existing fields.
- `DEFAULT_KEYBOARD_MAP` adds `KeyC` → pedal 1 and `KeyV` → pedal 2 for
  player 1 (both unused by MAME's stock layout and by the existing map).
  Nothing else in `KeyboardSource` changes: analogue steering from the
  arrow keys and the second stick come from §3.4.

### 3.6 F11 in the probe files

Add an "F11" paragraph to `docs/probes/families/atari-classic.md`,
`sega-16.md`, `namco-classic.md` and `taito-16.md` listing, per driver
source file, the analogue port types with their min/max, sensitivity and
key delta from the declarations above, and which §3.4 lines bind them.
Driver file names and port types only: no title and no set name.

## 4. Verification

1. `npm run check`, `npm test`.
2. Rebuild **one** family, `atari-classic`, with
   `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts atari-classic --jobs 4`
   (never `--all`, never `npm run build`), so the bridge change compiles
   and the §4.3.1 contract test in `tests/browser/22-web-bridge.test.ts`
   runs against it. Ignored preload configs for that family's three boards
   are in your worktree under `res/`; `ls res/preload-*.json`.
3. Browser evidence, headless, recorded in the merge note as numbers and
   booleans only: on the dial board a `spin-x` delta stream changes the
   player's position between frames and a held `HAT1RIGHT` ramps it; on
   the trackball board the same through `spin-x`/`spin-y`; on the tank
   board a held `HAT1UP` changes the picture (both sticks forward) and a
   held `stick: 2` alone also does; the MAME log carries no controller-
   config warning. Other families are rebuilt by the integrator after the
   merge; your merge note says what to look for on the `sega-16`,
   `namco-classic` and `taito_z.c` boards.
4. Test 17 passes with the patches and `mame/bridge/` in step; test 15's
   exact-text cases are updated to the new output and a case checks every
   §3.4 line and token; test 20 covers each new binding and the
   "declares nothing" invariance; test 13 covers `setAxis` ownership and
   recentring; test 10 covers the new predicates.

## 5. Definition of ready for review

`docs/work/README.md` rule 8, plus a merge note in the shape of
`docs/work/W20-merge-note.md` that quotes the `ioport.c` and `input.c`
lines behind §3.1 and §3.4, states the exact spec sentences for §2.1,
§4.2–§4.4, §6, §10.3, §10.4 and F11 (the integrator applies them), lists
the `src/index.ts` exports needed, and gives the §4.3 evidence.

## 6. Repository rules that bite here

- No game titles, set names from any library, ROM hashes or private paths
  in tracked files, test names or commit messages; refer to boards by
  driver file (`tempest.c`) and port type (`IPT_DIAL`).
- Build only `atari-classic`, with `--jobs 4`; never `npm run build`,
  `npm run clean`, `build-mame --all` or `--fresh`.
- No attribution lines in commits. Do not rebase; do not stop on a refused
  git command, report it in the merge note instead.

## 7. Commands

```sh
npm install
npm run check && npm test
EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts atari-classic --jobs 4
ARCADE_FAMILY_CONFIGS=$(ls res/preload-*.json | paste -sd,) npm run test:browser
```
