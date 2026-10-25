# W30 merge note

## What changed

- `GamepadSource` now swaps its digital controls for a held operator-chord
  layer while leaving analogue axes active. The default coin modifier defers
  its tap until release and suppresses it after any chord fires; a different
  modifier leaves coin on its original rising edge. Layer transitions,
  disabling, disconnecting and focus loss release held controls.
- `GamepadMapping.chords` accepts a modifier and replacement bindings, or
  `false` for the pre-W30 behavior. Validation permits only operator keys,
  volume, test, service and tilt, and rejects invalid indices, duplicate
  buttons, modifier collisions and malformed controls. The frozen
  `DEFAULT_GAMEPAD_CHORDS` constant exposes the standard set.
- `ArcadeCabinet` validates and forwards `controls.gamepads.mapping`, including
  when sources are rebuilt after a hard reset.
- The harness shows the default chord hint on assigned gamepads and as the
  Operator heading tooltip.
- Spec tests cover default and custom chords, deferred and legacy coin timing,
  held-control deduplication, layer transitions, validation, analogue
  continuity, lifecycle releases and cabinet mapping retention.

## Integrator-owned exports

`src/index.ts` needs these additions:

```ts
export { DEFAULT_GAMEPAD_CHORDS } from "./GamepadSource/GamepadSource.js";
export type { GamepadChord, GamepadChords } from "./GamepadSource/types.js";
```

## Spec amendments

- §10.4 describes the replacement digital layer, unchanged analogue axes,
  default modifier, deferred coin tap, press/release semantics, custom
  bindings, `chords: false`, and the compact default-binding table.
- §10.6 adds `mapping?: GamepadMapping` to `controls.gamepads`.
- §11 records the assigned-gamepad and Operator-tooltip hint.

## Verification

- `npm run check` — passed.
- `npm test` — 574 passed, 0 failed, 2 skipped.

## Left undone

- The root exports above remain for the integrator because `src/index.ts` is
  outside this package's write set.
- Real-pad acceptance on rebuilt families remains for the integrator and user;
  it requires physical hardware and local artifacts.
