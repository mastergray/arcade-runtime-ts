# W5 — `ArcadeDisplay`

Lane: **TypeScript**. Branch: `wp/w5-arcade-display`. Milestone: M1 (slice M1D).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W5 | `ArcadeDisplay` | `src/ArcadeDisplay/` | W0 | §7 | T | M1 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §7 in full, §2.2
(`MachineInfo`, especially `aspectRatio` and `orientation`), §2.3
(`FrameEvent`, `ArcadeSession.onFrame`), §4.6 ("Vertical-first layouts"
and "Startup decryption" bullets), and §9's `display` field of
`ArcadeGameConfig`.

Port reference: `~/dev/dos-game-runtime-js/src/DosDisplay/`
and its tests `tests/spec/04-display-layout.test.ts` and the display cases
under `tests/browser/`. §7 says "port of `DosDisplay`"; keep its public
shape (construction config, `attach`, `detach`, `layoutFor`, `fullscreen`,
`onLayout`, `destroy`, error codes) and change only what §7 lists.

## 3. Write set

Exclusive: `src/ArcadeDisplay/` (`ArcadeDisplay.ts`, `types.ts`), plus
your tests: `tests/spec/14-arcade-display-layout.test.ts` and
`tests/browser/20-arcade-display.test.ts` (numbering: spec `1x`, browser
`2x`; pick the next free number if taken).

You will need two lines in `src/index.ts` (the class export and the
`types.ts` re-exports). Do not add them; list them in your merge note.

## 4. Deliverables

1. `ArcadeDisplay` per §7:
   - `attach(session)` subscribes to `onFrame`, sizes the canvas backing
     store to the frame's native size on the first frame and whenever it
     changes, and draws with `putImageData`. `detach()` unsubscribes.
   - `aspectRatio` defaults to `session.machine.aspectRatio` at attach
     time; a page may override it in the config.
   - Scaling modes `fit`, `integer` and `fill-height`. `fill-height` is
     the default when the machine is `vertical` and the container is
     wider than it is tall; otherwise `fit`. A config `scaling` overrides
     the default.
   - `imageRendering` `"pixelated"` (default) or `"smooth"` applied as CSS.
   - Fullscreen (`FULLSCREEN_FAILED`), resize observation and `onLayout`
     as in `DosDisplay`.
   - A `starting` placeholder: `showPlaceholder(element | null)` (or the
     equivalent config hook) that the player uses while a machine decrypts
     at startup; it must not disturb the canvas sizing.
   - Everything injectable: the `ResizeObserver` constructor, the
     fullscreen functions and the document are taken from config, with
     `init` supplying the browser globals (§0.1 injected-environment rule).
2. `static layoutFor(container: Rect, frame: {width, height}, aspectRatio, mode): Rect`
   is pure and is the unit under `spec` test. Required cases, each with
   exact expected numbers:
   - 384×224 frame, aspect 4/3, in 800×600 with `fit` → 800×600 is 4:3,
     so the frame fills the container.
   - 384×224 frame, aspect 4/3, in 1000×600 with `fit` → 800×600 centred.
   - 224×288 frame, aspect 3/4, in 844×390 (phone landscape) with
     `fill-height` → 292.5×390 centred.
   - 224×288 frame, aspect 3/4, in 390×844 (phone portrait) with `fit`.
   - 320×224 frame, aspect 4/3, in 1920×1080 with `integer` → the largest
     integer multiple of the *display-corrected* size that fits.
   - A container smaller than one frame with `integer` → scale 1 clipped
     or centred, whichever `DosDisplay.layoutFor` does; match it and say
     so in the test label.
3. `types.ts` with `ArcadeDisplayConfig`, `LayoutEvent` and their
   predicates; `isScalingMode` already exists in `shared.types.ts`.

## 5. Contracts and doubles

From `src/shared.types.ts`: `Rect`, `FrameEvent`, `ArcadeSession`,
`MachineInfo`, `ScalingMode`, `Listener`, `Unsubscribe`, `isScalingMode`,
`isRect`. From `tests/support/`: `FakeArcadeSession` (`emitFrame`,
constructor takes a `MachineInfo` so you can make a vertical machine),
`fixtures.ts` (`blankFrame`, `validMachineInfo`, `thrownBy`, `errorSnapshot`).

## 6. Definition of ready for review

`docs/work/README.md` rule 7. Browser cases run under
`ctg-js-browser-test` against a page you build in the test (no harness
dependency); they must pass locally, not merely skip.

## 7. Repository rules that bite here

- The constructor reads no globals. `document`, `ResizeObserver` and
  fullscreen APIs arrive through config; `init` fills them in.
- Only `browser` tests touch the DOM. `layoutFor` and the predicates are
  `spec` tests.
- Every config and event has a predicate and a spec test (one passing
  input, one per violated condition).
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
npm run test:browser      # runs tests/browser/*.test.ts under Chromium
```
