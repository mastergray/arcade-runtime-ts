# W23a merge note — Runtime settings surfaces

## Delivered public surface

- `AnalogSetting`, `AnalogSettings`, `DEFAULT_ANALOG_SETTING`,
  `isAnalogSetting` and `isAnalogSettings` describe settings keyed by
  ``p${PlayerIndex}:${MachineAnalogKind}``.
- `AnalogDriver` and `AnalogDriverConfig` own one axis channel, observe
  effective keyboard holds through the new `ArcadeInput.onHold(listener)`
  hook, integrate once per scheduled frame and expose `update(settings)` and
  `axisFilter(axis, value)`.
- `ArcadeControlsConfig.analog`, `ArcadeCabinet.analogSettings` and
  `ArcadeCabinet.setAnalogSettings(settings)` retain settings across fresh
  sessions and apply replacements to the running driver on the next frame.
- `GamepadSourceConfig.axisFilter` and `GamepadSourceInitConfig.axisFilter`
  let the cabinet apply live travel/inversion without adding another pad
  writer. `GamepadSource.devices` returns every connected provider entry as
  `GamepadDevice { index, id, standard, player }`, including unassigned
  non-standard devices.
- `ArcadeAudioConfig.volume` and mutable `ArcadeAudio.volume` use a second
  gain node in series with the mute gain. `ArcadeCabinetConfig.audio.volume`
  and `ArcadeCabinetInitConfig.audio.volume` reapply the initial level to
  every fresh player audio instance.
- `DisplayCrop`, `ArcadeDisplayConfig.crop` and mutable
  `ArcadeDisplay.crop` crop native side columns with CSS clip/scale while
  laying out to the visible aspect. `ArcadeGameConfig.display.crop` passes
  through `ArcadePlayer`.
- `DEFAULT_KEYBOARD_MAP` remains deeply frozen and now includes player 3 on
  Numpad directions plus the pinned later-player button/coin/start group,
  and player 4 on I/J/K/L plus its pinned button/coin/start group.
- The harness adds live playback-volume, left/right crop and analogue JSON
  lines while keeping every existing selector. Its gamepad line uses
  `devices`, so an unassigned non-standard provider entry remains visible.

All new classes, types, constants and predicates above are exported from the
package root.

## Driver policy by discovered kind

| Machine kind | Default behavior | Axis slot |
| ------------ | ---------------- | --------- |
| `stick-x` | centre | `stick-x` |
| `stick-y` | centre | `stick-y` |
| `stick-z` | centre | `stick-z` |
| `pedal-1` | return to released; written as −1..+1 on the pedal axis (2026-10-26 fix: the raw 0..1 level put a released pedal at half throttle) | `pedal-1` |
| `pedal-2` | same | `pedal-2` |
| `paddle`, `paddle-v` | centre (2026-10-26: MAME auto-centres paddles; was hold, and a steering paddle felt stuck) | `stick-x`, `stick-y` |
| `positional`, `lightgun-x` | hold | `stick-x` |
| `positional-v`, `lightgun-y` | hold | `stick-y` |
| `dial`, `trackball-x`, `mouse-x` | relative delta | `spin-x` |
| `dial-v`, `trackball-y`, `mouse-y` | relative delta | `spin-y` |
| `pedal-3` | unchanged digital path | none |

Ordinary `direction` controls remain digital, except on a player whose declared
**absolute** horizontal or vertical port (stick, paddle, positional, light gun)
covers that direction: there the driver takes the arrows and d-pad for the axis.
Relative kinds (dial, trackball, mouse) claim directions only when the machine
reports `inputs.joystick === false` (2026-10-26: an F3 platform game declares a
dial beside its joystick and lost its arrows); with the flag true or absent they
keep MAME's HAT1 increment path at its keydelta, and `GamepadSource` likewise
leaves the left stick to the joystick on such boards and spins the relative
kind from the right stick. Declared stick-1 and pedal-1/2
holds are consumed from the digital session path and become driver-owned axis
writes; machines declaring no analogue rows retain the prior digital path.
Conditional discovered kinds sharing one player/axis slot use their first
metadata row because the current bridge does not identify which conditional
field is active.

## Defaults and rationale

- `keySpeed: 0.04` (2026-10-26, was 0.02): four percent of the −1..1 axis per
  frame, the pinned four-count key delta on a 192-count port (centre to full
  lock in 25 frames). The earlier value measured the half-range and was twice
  as slow as MAME's own ramp.
- `centreSpeed`: omitted values resolve to `keySpeed` for centring kinds and
  zero for hold kinds. Relative kinds ignore it.
- `travel: 1`: pad travel equals control travel; accepted live multipliers
  are 0.1–4. Absolute results clamp after scaling and relative deltas do not.
- `invert: false`: the discovered/native sign is preserved until requested.
- Audio volume is 1; crop is `{ left: 0, right: 0 }`.

The driver operates only through the W26 absolute/relative axis path. It does
not synthesize per-machine cfg because the served analogue metadata lacks the
port tag and mask needed to address those fields safely.

## Native limitations

- `pedal-3` needs an eighth bridge axis (and the corresponding Web Pad item,
  session mapping and family rebuild) before it can leave the digital
  increment path.
- Native per-port cfg editing would require analogue tag/mask metadata from
  `web_machine_info` and family rebuilds; W23a deliberately uses the existing
  axis bridge instead.
- A bridge field identity would be needed to distinguish simultaneously
  reported conditional kinds that share one player/axis slot. The current
  runtime deterministically uses the first row.

No native source, bridge patch or family artifact changed in this package.

## Integrator production gate

Use an ignored preload for a board with a player-one absolute paddle or stick
declared by `segas16.c` or `segaxbd.c` in the built `sega-16` family:

```sh
ARCADE_ANALOG_PRELOAD_CONFIG=/path/to/ignored/config.json npm run test:browser
```

`tests/browser/41-analog-driver.test.ts` starts the real cabinet, measures a
six-frame keyboard ramp through `ArcadeInput.axes`, replaces `keySpeed` live,
then enables `invert` and requires the sign to change. It skips when
`ARCADE_PRELOAD_CONFIG` is absent.

## Verification

- `npm run check` — passed (`check:src`, `check:ui`, `check:tests`).
- `npm test` — passed: 33 files, 594 cases, 592 passed, 0 failed, 2 skipped.
- Two later `npm test` retries reached the sandbox's documented process/socket
  restrictions: the audit-bin case could not `spawnSync` Node and the
  preload-page case could not listen on `127.0.0.1` (`EPERM`). Both retries
  otherwise reported 588 passed, 2 environment failures and 4 skipped; no
  W23a case failed.
- A direct run of all 131 cases in the eight affected spec files after the
  final config guard change reported 131 passed, 0 failed.
- `node --import tsx -e "const m=await import('./tests/browser/41-analog-driver.test.ts'); console.log(JSON.stringify({skip:m.default.skip,cases:m.default.cases.length}));"`
  — reported one case and the expected no-config skip.
- `git diff --check` — passed.

## Left undone

- The production browser case was not executed here because this sandbox
  cannot run Chromium or bind a loopback server. The integrator must run the
  command above; this also rechecks browser cases 24, 36, 37 and 38.
- No family was rebuilt, and no native change is required for the delivered
  seven-axis mechanism.
