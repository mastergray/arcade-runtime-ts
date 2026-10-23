# W26 merge note — Analogue and dual-stick input

## Delivered

- Each Web Pad retains digital items 0–15 and adds `HAT2`, `HAT3` and
  `BUTTON13`–`BUTTON15` at items 16–26. It also exposes five absolute axes
  and two relative axes in the assigned order. Absolute writes clamp to
  ±65536; relative writes accumulate pixel deltas and the item callback
  returns and clears the accumulator.
- The native bridge exports `web_set_axis`, clears all pad state on bridge
  exit and machine stop, and reports deduplicated player/kind analogue inputs
  plus a `dualStick` flag from every input field, including conditional ones.
- `ArcadeAxis`, `MachineInputs` and their predicates flow through
  `ArcadeSession`, `MameSession` and `ArcadeInput`. Axis ownership is
  last-writer-wins. Releasing the owning channel centres stick axes at 0 and
  pedal axes at -1, and drops relative axes without emitting a synthetic
  delta.
- The generated controller configuration supplies every standard,
  increment, decrement and dual-stick sequence in the package brief. Existing
  digital mappings and item numbers remain unchanged.
- Standard gamepads bind only capabilities declared for their assigned
  player. The left stick supplies normalized absolute X/Y or relative X/Y,
  the right stick supplies Z, triggers supply pedals, and independently
  quantized left/right sticks supply dual-stick controls. Full relative
  deflection emits 2 pixels per poll, or 120 pixels/second at a 60 Hz poll.
  A board that declares no new capability follows the previous mapping
  unchanged.
- The default keyboard map adds `KeyC` and `KeyV` for player-one pedal presses.
- The four family probe documents contain their F11 driver-file and port-type
  findings. The native sources and their two carrying patches are byte-for-byte
  synchronized by the source contract test.

## Pinned-source evidence

The read-only 0.161 source was inspected before implementation.

- `src/emu/ioport.c:4179-4238` reads the standard sequence once per analogue
  field update. The absolute branch says:

  ```cpp
  if (m_previousanalog != rawvalue)
  {
      // only update if analog value changed
  ```

  and returns only after applying a changed absolute value. An unchanged
  value falls through. A relative item instead seeds the frame delta:

  ```cpp
  if (itemclass == ITEM_CLASS_RELATIVE && rawvalue != 0)
      delta = rawvalue;
  ```

- `src/emu/ioport.c:4243-4267` subtracts or adds the driver's `m_delta` when
  the decrement or increment sequence is pressed. Lines 4279-4294 then apply
  `m_centerdelta` when an auto-centring digital input is released. This is the
  requested keyboard/d-pad ramp; the generated config only has to name the
  Web Pad switch items in those sequences.
- `src/emu/input.c:1002-1014` classifies `ITEM_ID_XAXIS` through
  `ITEM_ID_SLIDER2` as absolute joystick items and
  `ITEM_ID_ADD_RELATIVE1` through `ITEM_ID_ADD_RELATIVE16` as relative items;
  everything else is a switch. `src/emu/input.h:25-30` defines one pixel as
  512 relative units and the absolute range as -65536 through +65536.
- `src/emu/input.h:1148` samples an item by invoking its callback directly:

  ```cpp
  return m_current = (*m_getstate)(m_device.internal(), m_internal);
  ```

  and `src/emu/input.c:2264-2267` returns that sampled value directly for a
  relative item. MAME does not clear an OSD accumulator, so the bridge callback
  must perform the read-and-clear implemented here; otherwise one write would
  repeat every frame.
- `src/emu/ioport.c:190,4414-4420` accepts the exact sequence type tokens
  `standard`, `increment` and `decrement`. `src/emu/input.c:1522-1555`
  constructs item tokens from the device class, one-based device index and
  standard item token. Lines 1989-2006 put spaces between codes and emit the
  token `OR`, yielding sequences such as `JOYCODE_1_HAT1UP OR
  JOYCODE_1_HAT1RIGHT`.
- `src/emu/inpttype.h:38-45` confirms that both left/right joystick families
  are ordinary switch types. Lines 492-523 show that the stock pedal defaults
  carry an increment sequence and no decrement sequence.
- Driver declarations were checked at `bzone.c:418-421,479-520`,
  `tempest.c:559-564`, `rampart.c:185-197`, `polepos.c:558-564`,
  `segaxbd.c:1104-1110,1373-1379`, `segaorun.c:983-989`,
  `segahang.c:599-605,693-696`, `taito_z.c:2054-2061`,
  `segaybd.c:919-925` and `superchs.c:253-256`. The F11 additions record the
  observed `PORT_MINMAX`, `PORT_SENSITIVITY`, `PORT_KEYDELTA`,
  `PORT_CENTERDELTA` and `PORT_REVERSE` values by driver file and port type.

No inspected source fact contradicted the decided design.

## Controller configuration contract

For every player `n`, the generator emits these standard sequences:

| Port types | Standard item |
| ---------- | ------------- |
| `Pn_AD_STICK_X`, `Pn_PADDLE` | `JOYCODE_n_XAXIS` |
| `Pn_AD_STICK_Y`, `Pn_PADDLE_V` | `JOYCODE_n_YAXIS` |
| `Pn_AD_STICK_Z` | `JOYCODE_n_ZAXIS` |
| `Pn_PEDAL`, `Pn_PEDAL2` | `JOYCODE_n_RXAXIS`, `JOYCODE_n_RYAXIS` |
| `Pn_DIAL`, `Pn_TRACKBALL_X` | `JOYCODE_n_ADDREL1` |
| `Pn_DIAL_V`, `Pn_TRACKBALL_Y` | `JOYCODE_n_ADDREL2` |

X-like ports decrement/increment on `HAT1LEFT/RIGHT`; Y-like ports do so on
`HAT1UP/DOWN`. `AD_STICK_Z` decrements on `BUTTON14` and increments on
`BUTTON13`. `PEDAL`, `PEDAL2` and `PEDAL3` increment on `BUTTON13`,
`BUTTON14` and `BUTTON15`, respectively.

The dual-stick standard sequences are:

```text
Pn_JOYSTICKLEFT_UP       JOYCODE_n_HAT1UP OR JOYCODE_n_HAT1RIGHT OR JOYCODE_n_HAT3UP
Pn_JOYSTICKLEFT_DOWN     JOYCODE_n_HAT1DOWN OR JOYCODE_n_HAT1LEFT OR JOYCODE_n_HAT3DOWN
Pn_JOYSTICKRIGHT_UP      JOYCODE_n_HAT1UP OR JOYCODE_n_HAT1LEFT OR JOYCODE_n_HAT2UP
Pn_JOYSTICKRIGHT_DOWN    JOYCODE_n_HAT1DOWN OR JOYCODE_n_HAT1RIGHT OR JOYCODE_n_HAT2DOWN
Pn_JOYSTICKLEFT_LEFT     JOYCODE_n_HAT3LEFT
Pn_JOYSTICKLEFT_RIGHT    JOYCODE_n_HAT3RIGHT
Pn_JOYSTICKRIGHT_LEFT    JOYCODE_n_HAT2LEFT
Pn_JOYSTICKRIGHT_RIGHT   JOYCODE_n_HAT2RIGHT
```

The exact-text specifications cover all of these tokens and lines.

## Integrator-owned lines

`src/index.ts` should add these public names from `shared.types.ts` beside the
existing shared exports:

```ts
isArcadeAxis,
isArcadeAxisKind,
isMachineAnalogKind,
isMachineInputs,
type ArcadeAxis,
type ArcadeAxisKind,
type MachineAnalogKind,
type MachineInputs,
```

The existing `ArcadeControl`, `ArcadeSession` and `MachineInfo` exports expose
their additive members without another export line.

The integrator should also add `_web_set_axis` to the `EXPORTED_FUNCTIONS`
line in `mame/bridge/README.md`, to `EXPORTED_FUNCTIONS` in
`scripts/mame-build/buildInfo.ts`, and to the matching expected export list in
`tests/spec/27-build-pipeline.test.ts`. Those files are outside W26's write
set. `EMSCRIPTEN_KEEPALIVE` caused the rebuilt module to export the function,
so the W26 artifact is usable, but the explicit link contract still needs to
be synchronized.

## Write-set note

`tests/support/fixtures.ts` has one additive `inputs: { analog: [],
dualStick: false }` line. The shared `validMachineInfo()` function is declared
to return the now-expanded `MachineInfo`, and tests across existing packages
consume it, so the required `MachineInfo.inputs` contract cannot type-check
without updating that common fixture. No other ownership in the support file
changed.

## Exact spec sentences for integration

### Section 2.1

> `ArcadeControl` additionally accepts `{ kind: "stick", player, stick: 1 |
> 2, direction }` for one physical stick of a dual-stick board and `{ kind:
> "pedal", player, pedal: 1 | 2 | 3 }` for a digital pedal press;
> `arcadeControlKey` assigns each variant a distinct canonical key.

> `ArcadeAxisKind` is `"stick-x" | "stick-y" | "stick-z" | "pedal-1" |
> "pedal-2" | "spin-x" | "spin-y"`, and `ArcadeAxis` is `{ player:
> PlayerIndex, kind: ArcadeAxisKind }`. Absolute values use [-1, 1], with
> sticks centred at 0 and pedals ranging from -1 released to +1 floored;
> spin values are signed pixel deltas per call.

> `MachineInfo.inputs` is `{ analog: ReadonlyArray<{ player: PlayerIndex,
> kind: MachineAnalogKind }>, dualStick: boolean }`, where
> `MachineAnalogKind` is `"stick-x" | "stick-y" | "stick-z" | "paddle" |
> "paddle-v" | "pedal-1" | "pedal-2" | "pedal-3" | "dial" | "dial-v" |
> "trackball-x" | "trackball-y" | "lightgun-x" | "lightgun-y" | "mouse-x"
> | "mouse-y" | "positional" | "positional-v"`; analogue rows are unique
> per player and kind.

> `ArcadeSession.setAxis(axis, value)` writes an absolute normalized value or
> relative pixel delta. Out-of-range absolute values are clamped and a
> non-finite value throws `INVALID_CONFIG`.

### Section 4.2

> Web Pad items 0–15 retain their existing meanings. Items 16–19 are
> `HAT2UP/DOWN/LEFT/RIGHT`, items 20–23 are
> `HAT3UP/DOWN/LEFT/RIGHT`, and items 24–26 are
> `BUTTON13/BUTTON14/BUTTON15`; these represent stick 2, stick 1 and three
> digital pedal presses, respectively.

> Each Web Pad also registers `XAXIS`, `YAXIS`, `ZAXIS`, `RXAXIS`, `RYAXIS`,
> `ADD_RELATIVE1` and `ADD_RELATIVE2` at axis indices 0–6. The first five are
> absolute; the last two are relative read-and-clear accumulators.

### Section 4.3

> `web_set_axis(pad: i32, axis: i32, value: f32)` ignores an out-of-range pad
> or axis. For an absolute axis it clamps value to [-1, 1] and stores value
> multiplied by `INPUT_ABSOLUTE_MAX`; for a relative axis it treats value as
> pixels and adds value multiplied by `INPUT_RELATIVE_PER_PIXEL` to an
> accumulator returned and cleared by the item callback.

> `web_machine_info` includes `inputs: { analog, dualStick }`. It emits one
> deduplicated `{ player, kind }` row for every declared supported analogue
> field, including conditional fields, and sets `dualStick` when any
> `JOYSTICKLEFT_*` or `JOYSTICKRIGHT_*` field exists.

### Section 4.4

> The generated controller file unconditionally binds each player's X/Y/Z,
> RX/RY and two relative Web Pad axes to their corresponding analogue port
> types; it also supplies `increment` and `decrement` sequences from HAT1 and
> `BUTTON13`–`BUTTON15`, allowing MAME's driver key delta and centre delta to
> provide digital ramps. MAME 0.161 ignores a configured port type absent
> from the running machine.

> A standard HAT1 synthesizes dual-stick forward, reverse and tank turns;
> HAT3 independently drives the left stick and HAT2 independently drives the
> right stick, using `OR` between synthesized and independent sequences.

### Section 6

> `ArcadeInput` and every `ArcadeInputChannel` expose `setAxis(axis, value)`.
> Axis writes are last-writer-wins rather than reference-counted; releasing or
> destroying the owning channel writes 0 for stick axes, -1 for pedal axes
> and nothing for spin axes. `ArcadeInput.axes` returns the effective last
> values, and `ArcadeInput.machine` exposes the session's `MachineInfo`.

### Section 10.3

> `DEFAULT_KEYBOARD_MAP` maps player-one `KeyC` to pedal 1 and `KeyV` to
> pedal 2. Analogue arrow-key ramps and second-stick mappings are supplied by
> the generated controller configuration rather than by `KeyboardSource`.

### Section 10.4

> On a standard-layout gamepad, only analogue kinds declared for the assigned
> player are written: the dead-zone-rescaled left stick supplies X/Y absolute
> axes or relative spin deltas, the right stick vertical supplies Z, and
> trigger buttons 7 and 6 map their [0, 1] values to pedal values [-1, 1]. At
> full deflection a spin axis emits 2 pixels per poll.

> When `dualStick` is true, the left and right physical sticks are independently
> quantized into logical sticks 1 and 2 while the d-pad continues to emit
> ordinary directions. `GamepadMapping.rightAxes` and
> `GamepadMapping.pedals` optionally override their standard indices. A board
> declaring no W26 input capability behaves exactly as before.

### Section 12, M11 row

> M11 accepts analogue axes, relative `IPT_DIAL`/`IPT_TRACKBALL_X/Y` motion,
> MAME-key-delta keyboard ramps, digital and trigger-driven pedals, and both
> synthesized and independently driven dual-stick controls through the
> production bridge.

### F11

> F11: Which analogue and dual-stick port types does each family driver
> declare, what min/max, sensitivity, key delta, centre delta and reverse
> attributes apply, and which generated standard, increment, decrement or
> synthesized sequence binds each declaration?

> The per-family F11 answers live in `docs/probes/families/atari-classic.md`,
> `sega-16.md`, `namco-classic.md` and `taito-16.md`; they identify boards only
> by driver source file and port type.

## Family build and browser evidence

The prescribed family build compiled and linked the changed bridge. Its final
result was 15 machines, a 6,025,433-byte WebAssembly artifact, 15 metadata
rows and build id prefix `7f518eef6ae1`. The generated JavaScript is 302,198
bytes, and the module exports `web_set_axis`.

The pinned SDK's bundled Node executable cannot process the build script's
captured standard streams on this host and raised `ERR_UNKNOWN_STREAM_TYPE` at
the final link. A worktree-local ignored Emscripten configuration selecting
the host Node executable was therefore used for the successful rebuild; the
pinned clang, Emscripten, optimizer and Binaryen paths were unchanged.

The browser evidence case is gated by `ARCADE_FAMILY_CONFIGS`, filters to the
rebuilt family, and selects its three ignored board configurations by the
machine-discovered input shape inside the page. It records only numbers and
booleans. The current managed sandbox prevented execution at two independent
OS boundaries:

```text
attempts                  6
loopbackBindAllowed       false
chromiumIpcAllowed        false
w26CaseStarted            false
observationsComplete      false
```

The existing local-server path failed with `listen EPERM` on loopback. A
socket-free request-interception path then reached Chromium launch, which
failed because the sandbox denied its `shutdown()` IPC operation. Therefore
no dial, trackball, dual-stick picture-change or controller-warning result is
claimed here. On an integration host that permits headless Chromium, the W26
case requires these numeric/boolean verdicts:

```text
controllerWarnings        0
dialDeclared              true
dialAxisChanged           true
dialRampChanged           true
trackballDeclared         true
trackballChanged          true
dualStickDeclared         true
tankBothChanged           true
tankSecondChanged         true
```

After the remaining families are rebuilt, inspect `segaxbd.c`, `segaorun.c`,
`segahang.c` and `segaybd.c` for X/Y/Z, paddle and pedal bindings;
`polepos.c` for dial and two-pedal bindings; and `taito_z.c` plus `superchs.c`
for conditional paddle/dial and pedal bindings. Their logs should contain
zero controller-config warnings.

## Verification

- `npm run check && npm test`: passed in the final run; 549 spec cases passed
  and 0 failed. Two intermediate `npm test` retries each reported 545 passed,
  2 failed and 2 skipped when the sandbox transiently denied one child process
  and one loopback listener; the final unfiltered `npm test` rerun passed all
  549 cases with no skips.
- `EMSDK_DIR="$PWD/res/emsdk" node --import tsx scripts/build-mame.ts
  atari-classic --jobs 4 --fresh`: compiled the family but failed during the
  final link with `ERR_UNKNOWN_STREAM_TYPE` from the pinned SDK's bundled Node
  executable.
- `BASH_ENV="$PWD/.cache/w26-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" node
  --import tsx scripts/build-mame.ts atari-classic --jobs 4 --fresh`: passed
  with the family-build result recorded above. The ignored `BASH_ENV` file
  points Emscripten's JavaScript engine at the host Node executable only.
- `ARCADE_FAMILY_CONFIGS=$(ls res/preload-*.json | paste -sd,) npm run
  test:browser`: the runner completed 0 passed, 42 failed and 26 skipped;
  every regular browser case was blocked by loopback `EPERM`, and the W26
  socket-free case was blocked by denied Chromium IPC.
- The attempted `git commit --amend` for the checkpoint message and later
  combined `git add ... && git commit ...` commands were refused before
  changing the repository because Git could not create the external worktree's
  `index.lock`. Normal `git add` and `git commit` retries later succeeded; the
  checkpoint message remained unchanged, and the browser case and this note
  are committed.

No build-all, package build, clean, rebase or push command was run. Ignored
family artifacts, source extraction and Emscripten configuration remain
untracked.

## Integrator notes (2026-10-22)

- Browser evidence was collected on the integration host after the merge
  note above was written; the sandbox had blocked it for the agent. On the
  rebuilt `atari-classic` family: the `tempest.c` dial moves the player
  from a relative-axis stream and from a held hat (keyboard ramp); the
  `bzone.c` tank drives from one hat (synthesized both-sticks-forward) and
  from the second stick alone; the controller file loads with zero
  warnings. The `rampart.c` trackball branches are logged but not asserted:
  that board's coin inputs do not register through the virtual pad on a
  pristine EEPROM (20-frame holds, 60-frame holds and the harness's keyboard
  coin all leave the credit counter at zero), so its branches run in
  attract mode, where the demo ignores the trackball. Tracked on the
  roadmap.
- Coin timing learned on the way: these Atari boards miss a coin held
  under about 10 frames and ignore one held 60 frames as a jammed switch;
  20–30 frames register. The vector tank board defaults to two coins per
  play, which was the whole of the former M22 item; the acceptance test now
  inserts two coins.
- The gamepad spin rate was raised from 2 to 20 pixels per poll at full
  deflection, the order of the `PORT_KEYDELTA` the pinned dial and
  trackball drivers declare, so a pad spins as fast as the keyboard ramp.
- Four browser tests the agent could not run needed small updates: the
  keyboard test's "unmapped" example key is now `KeyB` (`KeyV` became a
  pedal), and the three harness tests' scripted sessions gained the
  `inputs` field and a `setAxis` method.
