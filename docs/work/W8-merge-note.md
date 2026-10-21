# W8 merge note

## Integrator question

Can the integrator rebase this branch, including implementation commits
`7aeb72e` and `e9eece2`, onto current `main` before review? `main` advanced
from `ddcd9fb` to `50f1c86` while W8 was in progress, but this managed
worktree exposes the shared `.git` worktree directory as read-only for
history rewrites. A clean `git rebase main` is rejected when Git tries to
create `index.lock`; `--autostash` cannot create the shared stash ref.

The W8 paths do not overlap the W9 files or the later brief/lockfile commit.
I tested the exact W8 files over a fresh archive of `50f1c86`:

- `npm run check` passed.
- `npm test` passed: 404/404 cases.
- `npm run test:browser` passed: 19 runnable cases, with 22 existing private
  MAME probes skipped for their documented environment variables.

The worktree's `package-lock.json` bytes exactly match current `main`
(`55230bf06742a51a12a3e7ecb7000e3034e8640a`). The old branch base makes
that file appear modified; rebasing makes it clean without a W8 change.

## `src/index.ts` additions

Add this class export in the implementation order from §1.2, after
`KeyboardSource`:

```ts
export { default as GamepadSource } from "./GamepadSource/GamepadSource.js";   // Polled Gamepad API to per-player ArcadeInput channels
```

Add these pure helpers, predicates and class-owned type re-exports:

```ts
export {
    controlsFor,
    directionsFor,
    isGamepadLike,
    isGamepadMapping,
    isGamepadProviderLike,
    isGamepadSourceConfig,
    isGamepadSourceInitConfig,
    type GamepadLike,
    type GamepadMapping,
    type GamepadProviderLike,
    type GamepadSourceConfig,
    type GamepadSourceInitConfig,
} from "./GamepadSource/types.js";
```

## Spec discrepancy

§10.4 requires gamepad holds to release on pause, but the frozen
`ArcadeInput` and `ArcadeInputChannel` contracts expose no pause event, and
the W8 config owns only an `ArcadeInput`, not its underlying session. The W8
brief's deliverable list correspondingly omits pause and requires releases
for disable, detach, destroy, blur and visibility loss; the implementation
follows the brief.

The integrator should either remove "pause" from §10.4 or land a contract
amendment that gives input sources an observable pause boundary. W8 should
not infer pause by reaching through `ArcadeInput` internals.

No other spec section appeared incorrect.

## Browser cases

Run Chromium coverage with:

```sh
npm run test:browser
```

If Chromium is absent, install the allowed browser binary first:

```sh
npx playwright install chromium
```

The runner auto-discovers `tests/browser/24-gamepad-source.test.ts`. Chromium
has no physical pads in this environment, so its cases verify both:

- `GamepadSource.init` wiring to the real empty `navigator.getGamepads` and
  real animation-frame scheduler; and
- the same `init` wiring with a scripted `navigator.getGamepads` snapshot,
  including controls, assignment, disconnect release and slot removal.
