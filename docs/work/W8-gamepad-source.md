# W8 — `GamepadSource`

Lane: **TypeScript**. Branch: `wp/w8-gamepad-source`. Milestone: M5.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W8 | `GamepadSource` | `src/GamepadSource/` | W7 | §10.4 | T | M5 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §10.4 in full, §6
(channels: this source owns exactly one `ArcadeInputChannel` per
connected pad), §2.1 (`FrameScheduler`), and §0.2 (gamepads are a
first-class v1.0.0 input). Read `src/KeyboardSource/` on `main` as the
sibling source to match in shape: injected targets, `attach`/`detach`,
`enabled` gate, `destroy`, config and init predicates.

There is no DOS port reference for this class; the Gamepad API is new
here. Use the standard mapping from the W3C Gamepad spec: buttons 0–3
face (A/B/X/Y on Xbox layout), 4–5 shoulders, 6–7 triggers, 8 Select/Back,
9 Start, 12–15 d-pad up/down/left/right; axes 0–1 left stick.

## 3. Write set

Exclusive: `src/GamepadSource/` (`GamepadSource.ts`, `types.ts`), plus
your tests: `tests/spec/20-gamepad-source.test.ts` and
`tests/browser/24-gamepad-source.test.ts` (Chromium has no real pads;
the browser case verifies `init` wiring against `navigator.getGamepads`
returning an empty list and a scripted provider, and documents that).

You will need export lines in `src/index.ts` for `GamepadSource` and your
`types.ts` re-exports. List them in your merge note.

## 4. Deliverables

1. **`GamepadSource`** per §10.4:
   - Config: `input: ArcadeInput`, `provider: GamepadProviderLike`
     (`getGamepads(): ReadonlyArray<GamepadLike | null>`), `scheduler:
     FrameScheduler`, optional `deadZone` in `[0, 1)` (default 0.25),
     optional `mapping: GamepadMapping` overriding the default layout.
     `init` fills `provider` from `navigator` and `scheduler` from
     `requestAnimationFrame`; the constructor reads no globals.
   - Polls once per scheduler tick while attached and enabled. Assigns
     each newly seen `standard`-mapping pad to the lowest free player
     slot (1–4) in connection order and keeps it until the pad disappears
     from the provider's list or its `connected` flag drops.
     Non-`standard` pads are ignored unless `mapping` names them.
   - Default layout: d-pad and left stick → directions; buttons 0–5
     (A, B, X, Y, LB, RB) → buttons 1–6; Select/Back → coin; Start →
     start. Pad for player *n* drives player *n*'s controls.
   - D-pad takes precedence over the stick; stick values inside the dead
     zone are zero; a direction derived from the stick uses the same
     threshold on each axis with no diagonal suppression (both axes can
     be active, matching a digital stick's corners).
   - Transitions are deduplicated: the channel sees `press` only when a
     control goes from up to down and `release` only on down to up. Coin
     and start use `tap`.
   - A disconnect releases every control that pad held (channel
     `releaseAll`) before the slot is freed. `enabled = false`, `detach`,
     `destroy`, and the page's blur and `visibilitychange` (injected
     targets as in `KeyboardSource`) release all pads' holds.
   - `players` getter returns the current slot assignment as an array of
     `{ player, id }` for a page to display.
2. **Pure helpers** exported from `types.ts` for the spec test:
   `directionsFor(pad, deadZone, mapping) → Set<ArcadeDirection>` and
   `controlsFor(pad, player, deadZone, mapping) → ReadonlyArray<ArcadeControl>`.
3. **`types.ts`**: `GamepadLike` (the subset of `Gamepad` read: `id`,
   `index`, `connected`, `mapping`, `buttons[].pressed`, `buttons[].value`,
   `axes`), `GamepadProviderLike`, `GamepadMapping`,
   `GamepadSourceConfig`, `GamepadSourceInitConfig`, with predicates.

## 5. Contracts and doubles

From `src/index.ts` on `main`: `ArcadeInput`, `ArcadeControl`,
`ArcadeDirection`, `PlayerIndex`, `FrameScheduler`, `isFrameScheduler`,
`isArcadeControl`. From `tests/support/`: `FakeArcadeSession` (`held`,
`calls`, `emitTick`), `FakeFrameScheduler` (`tick`), `fixtures.ts`. Write
a `FakeGamepadProvider` inside your spec test that returns a scripted
list you mutate between ticks.

## 6. Definition of ready for review

`docs/work/README.md` rule 7. The spec file must show: two pads take
players 1 and 2 in connection order and a third takes 3; unplugging pad
1 releases its holds and frees slot 1 for the next connection; d-pad
beats stick; dead zone; press/release dedup across ticks; coin and start
tap; blur releases; `DESTROYED` after destroy.

## 7. Repository rules that bite here

- No `navigator`, `window` or `requestAnimationFrame` in the constructor.
- One channel per pad, created on assignment and destroyed on disconnect.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
npm run test:browser
```
