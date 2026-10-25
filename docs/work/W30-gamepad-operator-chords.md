# W30 — Operator keys and cabinet switches from the gamepad

Lane: **TypeScript** (one agent). Branch: `wp/w30-gamepad-chords`.
Milestone: M39.

## 0. Why

W29 made the field-level operator switches reachable: `key` controls
(F1, F2, F5, F6, 0–9) and `volume` controls flow through `ArcadeInput` to
the operator items of virtual pad 1, `KeyboardSource` passes those keys
through, and the harness has an Operator row. The `GamepadSource` emits
only directions, buttons 1–6, coin and start, so a pad-only setup (a
couch or a cabinet without a keyboard) cannot leave a `williams.c` or
`qix.c` first-boot screen, cannot raise the DCS volume, and cannot reach
the `test`/`service` controls at all.

The need is mostly first boot: those screens appear only while the CMOS
is empty or has a bad checksum, and the NVRAM overlay persists it after
one pass. But a pad-only setup has to make that one pass, and one of the
two `williams.c` first-boot paths needs Advance **held** for several
seconds, so chords must mirror press and release, not tap.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W30 | Chorded operator controls on the gamepad: a held modifier button turns the other buttons into `key`, `volume`, `test`, `service` and `tilt` controls with press/release semantics; a default chord set; `GamepadMapping.chords`; cabinet pass-through of a gamepad mapping; harness hint | `src/GamepadSource/`, `src/ArcadeCabinet/types.ts` and `ArcadeCabinet.ts` (the `controls.gamepads.mapping` pass-through only), `harness/harness.ts`, `harness/index.html` (the gamepad line and the Operator row hint only) | W8, W12, W29 | §10.4, §10.6, §11 | T | M39 |

Write set: the files above plus `tests/spec/20-gamepad-source.test.ts` and
`tests/spec/29-arcade-cabinet.test.ts`. `src/shared.types.ts` and
`src/index.ts` are integrator-owned: list any export you need in the merge
note. Do not touch `src/ArcadeInput/`, `src/KeyboardSource/`, the bridge
or the patches: nothing in this package needs a rebuild.

## 2. Read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §2.1, §6, §10.4, §10.6,
§11; `docs/work/W8-gamepad-source.md` and `W29-coded-fields-operator-keys.md`
§3.4–§3.7 (the control kinds you emit and how they reach MAME);
`src/GamepadSource/GamepadSource.ts` `forward`/`forwardControls` (the
edge reconciliation your chords plug into); `src/KeyboardSource/KeyboardSource.ts`
lines 30–60 (the pass-through table and the default map, so the pad's
defaults agree with the keyboard's).

## 3. Design

### 3.1 Chord model

A **modifier** is one physical button index. While it is held, the pad's
digital layer is replaced: no direction, button, coin or start control is
emitted, and each bound chord button emits its bound control for as long
as it is held. The ordinary set returns when the modifier is released.
Analogue axes (§10.4, M11) are unaffected by the modifier.

Edge semantics reuse `forwardControls`: the chord controls simply become
the `next` set while the modifier is down. Because `key`, `volume`,
`test`, `service` and `tilt` are not coin or start, they go through
`press`/`release`, so holding Select+Start holds Advance (the second
`williams.c` first-boot path). Ordinary controls that were held when the
modifier went down are released by the same diff, which is what a player
expects when switching to the operator layer.

**The modifier defaults to the coin button** (index 8, Select/Back, or
`mapping.coin`). Coin today taps on the rising edge. With the chord layer,
coin becomes: tap on the modifier's **release** when no chord fired during
the hold. A plain Select press-and-release therefore still inserts one
coin, with the latency of a human release; a Select+Start sequence inserts
none. When `chords.modifier` names another index, coin keeps its
rising-edge tap and that index is removed from the ordinary layer.

### 3.2 Default chord set

Chosen so a pad clears every first-boot screen W29 documented and agrees
with the keyboard pass-through and default map:

| Chord (modifier held) | Physical index (standard layout) | Control | Reaches |
| --------------------- | -------------------------------- | ------- | ------- |
| Start | 9 (`mapping.start`) | `{ kind: "key", key: "F2" }` | `williams.c` Advance, `qix.c` Test Next line |
| d-pad up | 12 (`mapping.dpad.up`) | `{ kind: "key", key: "F1" }` | `williams.c` Auto Up, `qix.c` Test Advance, the F1 `IPT_SERVICE` switches |
| d-pad down | 13 | `{ kind: "key", key: "9" }` | `williams.c` High Score Reset, `midyunit.c` Vault, `taito_f2.c` Service A |
| d-pad left | 14 | `{ kind: "key", key: "F5" }` | `qix.c` Test Slew Up |
| d-pad right | 15 | `{ kind: "key", key: "F6" }` | `qix.c` Test Slew Down |
| button 1 | 0 (`mapping.buttons[0]`) | `{ kind: "test" }` | the type-level test switch |
| button 2 | 1 | `{ kind: "service" }` | the type-level service switch |
| button 3 | 2 | `{ kind: "tilt" }` | the type-level tilt |
| LB | 4 | `{ kind: "volume", direction: "down" }` | DCS volume (M33) |
| RB | 5 | `{ kind: "volume", direction: "up" }` | DCS volume (M33) |

The `key` and `volume` controls are forwarded whether or not the machine
declares them; `MameSession` drops a `key` with no row, as it does for the
keyboard pass-through today.

### 3.3 Types (`src/GamepadSource/types.ts`)

```ts
export interface GamepadChord {
    readonly button: number;                                      // Physical index pressed while the modifier is held
    readonly control: ArcadeControl;                              // key, volume, test, service or tilt
}

export interface GamepadChords {
    readonly modifier?: number;                                   // Physical index; defaults to the coin index
    readonly bindings?: ReadonlyArray<GamepadChord>;              // Replaces the default set when supplied
}

// GamepadMapping gains:
    readonly chords?: GamepadChords | false;                      // false disables the chord layer entirely
```

`isGamepadMapping` validates: `modifier` a physical index; each binding a
physical index plus a control whose kind is `key`, `volume`, `test`,
`service` or `tilt` (use the shared guards; a `key` must satisfy
`isArcadeKeyName`); no two bindings share a button; a binding's button may
not equal the modifier. `chords: false` turns the layer off and restores
the pre-W30 behaviour exactly (coin taps on the rising edge). Export the
default set as a frozen constant (`DEFAULT_GAMEPAD_CHORDS`) from the
module, the way `DEFAULT_KEYBOARD_MAP` is exported, and list it for
`src/index.ts` in the merge note.

### 3.4 Cabinet pass-through (`src/ArcadeCabinet/`)

`controls.gamepads` gains `mapping?: GamepadMapping`, guarded with
`isGamepadMapping` in the control guard and forwarded to the
`GamepadSource` constructor beside `deadZone`. Nothing else in the cabinet
changes; `followPlayerStatus` rebuilds sources from the same config, so
the mapping survives a hard reset for free. Add one case to test 29.

### 3.5 Harness

The gamepad line (`#gamepads`) gains, after the assignment text, a short
hint while a pad is assigned: "Hold Select: Start = Advance (F2), d-pad =
F1 / 9 / F5 / F6, A B X = test / service / tilt, LB RB = volume". The
Operator row's heading tooltip says the same. No new controls; the
harness keeps the default chord set.

### 3.6 Spec

§10.4: one paragraph after the M11 paragraph describing the chord layer,
the modifier default, the deferred coin tap, press/release semantics and
`chords: false`; the default table from §3.2 in compact form. §10.6: the
`gamepads.mapping` field. §11: the hint. §2.1 needs no change: no new
control kinds.

## 4. Verify

`npm run check`, `npm test` green. Test 20 must cover, with the fake
provider the file already uses:

- a Select press-and-release with nothing else taps one coin on release;
- Select held, Start pressed: `press` of `key F2` on the pad's channel,
  `release` on Start release, **no** coin on Select release;
- Select held for several polls with Start held: no repeated presses;
- Select pressed while button 1 is held: button 1 released by the diff;
  button 1 then pressed again while Select held: `test` pressed, not
  button 1; Select released: `test` released, ordinary layer back;
- `chords.modifier` set to index 10: coin taps on the rising edge again,
  index 10 is silent in the ordinary layer, chords work from it;
- a custom `bindings` list replaces the defaults; the validator rejects a
  binding on the modifier, a duplicate button, a `direction` control and a
  bad key name;
- `chords: false` reproduces the pre-W30 cases byte for byte (the existing
  coin cases keep passing with it set, and also with the default layer,
  adjusted for tap-on-release where they assert timing);
- disconnect or `enabled = false` while a chord is held releases it.

Acceptance the integrator and the user run with a real pad on the
rebuilt families: Select+Up then Select+Start held clears a `williams.c`
first boot; Select+Up repeatedly clears the `qix.c` language screen;
Select+RB raises the DCS volume; a plain Select still coins every board.

## 5. Rules

Everything in `W14-family.md` §2–§8 about the worktree applies. Never run
`npm run build`, `npm run clean`, `build-mame`. No game title, and no
reference to a title the integrator tested, in any tracked file or commit
message: name drivers and fields. Commit on your branch as you go; do not
rebase; if a git command is refused, note it and continue. Finish with
`docs/work/W30-merge-note.md`: what changed, the exports `src/index.ts`
needs, the spec paragraphs you wrote, and anything left undone.
