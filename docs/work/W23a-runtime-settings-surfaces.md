# W23a — Runtime surfaces for the Settings and Controls dialogs

Lane: **TypeScript** (no native change, no family rebuild). Branch:
`wp/w23a-runtime-settings-surfaces`. Milestones: M32 (mechanism), the
runtime half of M26, the keyboard half of M10.

The Settings and Controls dialogs (W23b, `docs/ui-spec.md` §3.4, §3.5)
need four things the runtime package does not have. This package adds
them, with tests, and nothing in the UI. W23b composes the dialogs on
these surfaces afterwards.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W23a | Analogue settings driver, audio volume, side-border crop, pad device list, player 3–4 keyboard map | `src/AnalogDriver/**` (new), `src/ArcadeCabinet/**`, `src/ArcadeAudio/**`, `src/ArcadeDisplay/**`, `src/GamepadSource/**` (device list only), `src/KeyboardSource/KeyboardSource.ts` (default map only), `src/shared.types.ts` (additive), `src/index.ts`, `docs/arcade-runtime-spec.md` (the sections named below), `tests/spec/**`, `tests/browser/41-analog-driver.test.ts`, `harness/harness.ts` (one line per surface, see §7) | W26, W29, W30 | §4.3, §10.3, §10.4, §12 M11/M32 | T | M32, M26 (runtime), M10 (keyboard) |

## 2. Analogue settings: the mechanism (M32)

### 2.1 Why in TypeScript

MAME applies `keydelta`, `sensitivity`, `centerdelta` and `reverse` from
the per-game `cfg`, which needs each analogue port's tag and mask; the
served metadata has those only for DIP switches, and a native bridge
call would mean rebuilding every family. Instead the runtime drives
analogue ports **only through the absolute axis path** it already has
(`ArcadeInput.setAxis` → `web_set_axis`, §4.3.1), and does the
keyboard's ramping itself. One mechanism then serves keyboard and pad
and every setting is a plain number the dialog can change live.

### 2.2 Settings

```ts
// src/shared.types.ts (additive)
export interface AnalogSetting {
    readonly keySpeed?: number;      // Fraction of full travel per frame while a key is held; default 0.02 (≈ MAME keydelta 4 on a 192-count port)
    readonly centreSpeed?: number;   // Fraction per frame the value returns to centre when no key is held; default = keySpeed; 0 = hold position (paddles, dials)
    readonly travel?: number;        // Pad: stick or trigger travel to control travel, 0.1–4; default 1
    readonly invert?: boolean;       // Negate the axis; default false
}
export type AnalogSettings = Readonly<Partial<Record<`p${PlayerIndex}:${MachineAnalogKind}`, AnalogSetting>>>;
export function isAnalogSetting(value: unknown): value is AnalogSetting;
export function isAnalogSettings(value: unknown): value is AnalogSettings;
export const DEFAULT_ANALOG_SETTING: Required<AnalogSetting>;   // the defaults above, centreSpeed resolved per kind by the driver
```

Kinds that centre by default: `stick-x`, `stick-y`, `stick-z`,
`pedal-*` (pedals return to zero, not centre: their range is 0–1).
Kinds that hold: `paddle`, `paddle-v`, `positional`, `positional-v`.
Relative kinds (`dial`, `dial-v`, `trackball-*`, `mouse-*`) are sent as
deltas on `spin-x` / `spin-y`: `keySpeed` is then the delta per frame
in axis units (default 0.02 × the port's full scale, say so in the
driver comment), `travel` scales pad deltas, `centreSpeed` is ignored.

### 2.3 The driver

`src/AnalogDriver/AnalogDriver.ts`, a class owned by `ArcadeCabinet`
(one per started session):

- **Inputs**: the machine's declared analogue ports
  (`MachineInfo.inputs.analog`), the settings, a frame scheduler (the
  cabinet already has one for `GamepadSource`), and an
  `ArcadeInputChannel` of its own.
- **Keyboard**: `KeyboardSource` keeps its map; the cabinet no longer
  forwards `stick` and `pedal` controls from the keyboard channel to
  the session's digital path. Instead the driver observes those holds
  (give `ArcadeInput` an `onHold(listener)` hook that reports press and
  release of any control on any channel, additive) and each frame
  integrates: held `stick n direction` moves the matching axis by
  `keySpeed` toward ±1; nothing held moves it toward centre by
  `centreSpeed`; held `pedal n` moves 0 → 1 by `keySpeed`, released
  returns by `centreSpeed`. The resulting value, after `invert`, goes to
  `setAxis` on the driver's channel. `direction` controls (digital
  joystick) are untouched.
- **Gamepad**: `GamepadSource` keeps writing absolute values; the driver
  does not duplicate them. Instead `GamepadSource` gets an `axisFilter`
  config function `(axis, value) => number` the cabinet supplies from
  the driver (`value × travel`, clamped, negated when `invert`); for
  relative kinds the filter scales the delta. The last writer still
  wins per §4.3.1.
- **Which axis a kind maps to**: the existing `AXIS_ITEMS` order
  (`stick-x/y/z`, `pedal-1/2`, `spin-x/y`); `paddle` → `stick-x`,
  `paddle-v` → `stick-y`, `pedal-3` has no slot today: say so and leave
  it on the digital path.
- **Live update**: `driver.update(settings)` replaces the settings
  without a restart; `cabinet.setAnalogSettings(settings)` forwards it
  and stores it for the next start.
- **Config**: `ArcadeControlsConfig.analog?: AnalogSettings`; `ArcadeCabinet`
  exposes `get analogSettings()` and `setAnalogSettings()`.

Keep MAME's own digital increment path reachable for machines that
declare no analogue ports in `inputs.analog` (nothing changes for
them) and for `pedal-3`.

### 2.4 Acceptance

- Spec tests for the driver's integration arithmetic (ramp, centre,
  hold kinds, pedal range, invert, travel, relative deltas) with a fake
  scheduler and channel.
- `tests/browser/41-analog-driver.test.ts`, gated like the other
  production cases on `ARCADE_PRELOAD_CONFIG`: with a config whose
  machine declares a paddle or stick (the integrator supplies one from
  the `segas16`/`segaxbd` or `taito-f3` families), hold a mapped key
  for N frames and read the axis back through the session's last
  `setAxis` value (expose it on the fake-free path through a test hook
  on `ArcadeInput`, not on MAME); change `keySpeed` live and show the
  slope changes; set `invert` and show the sign flips. Skips without
  the env var.
- The W26 keyboard acceptance (`tests/browser/36`) and the gamepad
  suite (`24`) stay green.

## 3. Audio volume

`ArcadeAudio` gets `volume: number` (0–1, default 1) as a getter and
setter on a second gain node in series with the mute gain, so mute and
volume are independent; `ArcadeAudioConfig.volume?`; the cabinet passes
`controls`-independent `audio?: { volume?: number }` through
`ArcadeCabinetInitConfig` and re-applies it on restart. Spec §10.2 (or
wherever audio is specified) gains the line.

## 4. Side-border crop

`ArcadeDisplay` gets `crop: { left: number; right: number }` in native
columns (default 0/0), getter and setter, and `ArcadeDisplayConfig.crop?`.
The layout keeps the aspect of the **cropped** frame and the canvas is
drawn with CSS `clip-path: inset(0 R% 0 L%)` plus a matching scale so
the visible part fills the laid-out rectangle; no change to the frame
buffer or the bridge. `ArcadeGameConfig.display.crop?` passes through
`ArcadePlayer` as `scaling` does. Spec §10.1 line.

## 5. Pad device list

`GamepadSource.devices` (read-only): every pad the provider reports,
`{ index, id, standard: boolean, player: PlayerIndex | null }`, so the
dialog can prefer the standard pad and still show the non-standard one
(the DualShock motion-sensor device from the M26 note). No behaviour
change in assignment.

## 6. Keyboard map for players 3 and 4

`DEFAULT_KEYBOARD_MAP` gains a right-hand set for players 3 and 4 on
keys MAME itself uses for those players (`I J K L` and `R F D G`
are taken: pick `Numpad` arrows for 3, and document the choice), so a
three-player board reaches its third seat from the keyboard. The
default map stays frozen and the page can replace it (that is W23b).

## 7. Harness

One line per surface in `harness/harness.ts` so the integrator can
hand-test without the dialogs: a volume range input, a crop input pair,
and an analogue settings `textarea` (JSON) applied with
`setAnalogSettings`. Keep the existing selectors; `tests/browser/37`
and `38` stay green.

## 8. Definition of ready for review

- `npm run check`, `npm test` green; the new browser test written and
  skipping cleanly without its env var (you cannot run Chromium).
- `docs/work/W23a-merge-note.md`: the public surface added (types,
  methods, config fields), the driver's per-kind table (centre / hold /
  relative, axis slot), the defaults and why, what you could not do
  without a native change (`pedal-3`, anything else), the exact
  integrator gate command with the family you expect, and anything
  undone.
- No game titles, ROM names or private paths in tracked files, tests or
  commit messages; boards by driver file. No `Co-Authored-By` lines.
