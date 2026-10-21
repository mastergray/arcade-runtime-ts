# W7 — `ArcadeInput`, `KeyboardSource` and controller config

Lane: **TypeScript**. Branch: `wp/w7-arcade-input`. Milestone: M4.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W7 | `ArcadeInput` and `KeyboardSource`, `DEFAULT_KEYBOARD_MAP`, controller-config generator (`web.cfg` text) | `src/ArcadeInput/`, `src/KeyboardSource/`, `src/ControllerConfig/` | W0 | §4.4, §6, §10.3 | T | M4 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §6 in full, §10.3, §4.4
in full (the token table there is a cross-lane contract you implement one
side of), §2.1 (`ArcadeControl`, `arcadeControlKey`), §2.3
(`ArcadeSession.setControl` and `onTick`), and §4.6's "Zero-button
machines" bullet.

Port references: `/home/mastergray/dev/dos-game-runtime-js/src/DosInput/`
and `src/KeyboardSource/` with their tests (`tests/spec/03-dos-input.test.ts`,
`tests/spec/07-input-target.test.ts`, browser keyboard cases). §6 says
"equivalent of `DosInput`"; keep its lifecycle, `enabled` gate, blur and
visibility handling, and error codes, and replace the key vocabulary with
`ArcadeControl` and channels.

## 3. Write set

Exclusive: `src/ArcadeInput/`, `src/KeyboardSource/`, `src/ControllerConfig/`,
plus your tests: `tests/spec/13-arcade-input.test.ts`,
`tests/spec/15-controller-config.test.ts`, `tests/spec/16-keyboard-source.test.ts`
(target logic with a fake event target) and `tests/browser/21-keyboard-source.test.ts`.

You will need export lines in `src/index.ts` for `ArcadeInput`,
`KeyboardSource`, `DEFAULT_KEYBOARD_MAP` and your `types.ts` re-exports.
`ControllerConfig` is internal and is **not** exported. List the lines in
your merge note.

## 4. Deliverables

1. **`ArcadeInput`** per §6, exactly the declared surface:
   - Channels (`createChannel()`), a default channel for the instance's
     own `press`/`release`/`tap`/`releaseAll`, reference counting so a
     control reaches `session.setControl(control, true)` on the first
     channel's press and `(control, false)` only after the last channel
     releases it. Per-channel idempotency. `destroy()` on a channel
     releases its holds.
   - `tap(control, holdFrames = 3)`: press now, release after `holdFrames`
     `session.onTick` events. Taps on a control already held by the same
     channel are a no-op; a tap's release does not release another
     channel's hold.
   - SOCD: pressing `left` while `right` is held for the same player
     (any channel) releases `right` from every channel first; the later
     physical release of `right` is a no-op. Same for up/down.
   - `snapshot` is the held controls in canonical order (sort by
     `arcadeControlKey`).
   - `releaseAll()` releases every channel's holds in canonical order;
     `destroy()` releases all, unsubscribes from `onTick`, and makes every
     method throw `DESTROYED`.
   - Config predicate; `INVALID_CONFIG` for a bad session or control.
2. **`ControllerConfig`** (internal): a pure function
   `controllerConfigFor({ players, select }) → string` that returns the
   complete `web.cfg` XML of §4.4 for players 1..`players`, emitting the
   `Pn_SELECT` lines only when `select` is true, and the pad-1-only
   service/test/tilt lines always. Output is deterministic, uses `\n`,
   and matches the §4.4 table token for token. Spec tests assert exact
   text for 1 and 4 players and the select on/off difference, and that
   every `ArcadeControl` kind maps to exactly one port token (two for
   service and tilt).
3. **`KeyboardSource`** per §10.3: a page-supplied
   `Record<KeyCode, ArcadeControl>` map, its own `ArcadeInputChannel`,
   repeat ignored, `enabled` gate, release on blur and `visibilitychange`,
   optional `preventDefault`. The event target is injected; `init`
   defaults it to `window`. Export `DEFAULT_KEYBOARD_MAP` with exactly the
   layout §10.3 names: arrows → P1 directions; `ControlLeft`, `AltLeft`,
   `Space`, `ShiftLeft`, `KeyZ`, `KeyX` → P1 buttons 1–6; `Digit5` → P1
   coin; `Digit1` → P1 start; `F2` → test; `Digit9` → service. Add a P2
   block using MAME's defaults (`KeyR`/`KeyF`/`KeyD`/`KeyG` directions,
   `KeyA`/`KeyS`/`KeyQ`/`KeyW`/`KeyE`/`Digit6`… check the 0.161
   `inpttype.h` defaults and say in a comment which you used), `Digit6`
   coin, `Digit2` start. The map is frozen and has a predicate
   (`isKeyboardMap`: every key passes `isKeyCode`, every value
   `isArcadeControl`).

## 5. Contracts and doubles

From `src/shared.types.ts`: `ArcadeControl`, `ArcadeControlKey`,
`arcadeControlKey`, `ArcadeSession`, `KeyCode`, `isKeyCode`,
`isArcadeControl`, `isArcadeSession`, `PlayerCount`. From
`tests/support/`: `FakeArcadeSession` (`held`, `calls`, `emitTick(n)`),
`fixtures.ts`. For `KeyboardSource` spec tests, build a minimal fake
`EventTarget` in your test file (add/remove listener, `dispatch`).

## 6. Definition of ready for review

`docs/work/README.md` rule 7. The `ArcadeInput` spec file must cover, as
§6 lists: per-channel idempotency and reference counting, channel
destruction, `tap` timing driven by fake ticks, cross-channel SOCD,
`releaseAll` order, and `DESTROYED` on every method.

## 7. Repository rules that bite here

- `ArcadeInput` never reads `window` or `document`; blur and visibility
  handling live in the sources that own an event target.
- Do not touch `src/shared.types.ts`. If `ArcadeControl` or
  `arcadeControlKey` is insufficient, write a contract-amendment note.
- The §4.4 token table is frozen for both lanes; if you believe a token is
  wrong, say so in the merge note with the `inpttype.h` line that shows it.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
npm run test:browser
```

For token questions, the pinned source is readable at
`/home/mastergray/dev/mame-runtume-ts/.cache/mame0161-source/src/emu/inpttype.h`
(port tokens: `P<n>_<TYPE>` for player types, bare `<TYPE>` for player-0
types) and `src/emu/input.c` (`code_to_token`: joystick device index + 1).
