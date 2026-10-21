# W7 merge note

## Integrator action required

`main` advanced to `ddd7b8b` after this worktree was cut. A normal
`git rebase main` is conflict-free (verified in an isolated clone), but this
managed worktree exposes the shared worktree Git metadata read-only: Git cannot
create `index.lock`, `HEAD.lock`, ref locks or new object-store temporary files.
The package branch therefore remains based on `01d49dd`.

Can the integrator run `git rebase main` for `wp/w7-arcade-input` in an
environment where the shared `.git/worktrees/arcade-runtime-ts.w7` metadata is
writable, then rerun the three verification commands below? In the isolated
rebase, `npm run check` and all 273 spec cases passed. The W7 files replayed
without a conflict or content change.

## `src/index.ts`

Add these class/constant exports in the existing classes section:

```ts
export { default as ArcadeInput } from "./ArcadeInput/ArcadeInput.js";
export { DEFAULT_KEYBOARD_MAP, default as KeyboardSource } from "./KeyboardSource/KeyboardSource.js";
```

Add these class-owned type and predicate exports:

```ts
export {
    isArcadeInputChannel,
    isArcadeInputConfig,
    type ArcadeInputChannel,
    type ArcadeInputConfig,
} from "./ArcadeInput/types.js";
export {
    isKeyboardEventTargetLike,
    isKeyboardMap,
    isKeyboardSourceConfig,
    isKeyboardSourceInitConfig,
    isKeyboardVisibilityTargetLike,
    type KeyboardEventTargetLike,
    type KeyboardMap,
    type KeyboardSourceConfig,
    type KeyboardSourceInitConfig,
    type KeyboardVisibilityTargetLike,
} from "./KeyboardSource/types.js";
```

`ControllerConfig` and `controllerConfigFor` remain internal and must not be
exported. No `tests/run.ts` entry is needed because the runner discovers
`*.test.ts` files.

## Spec notes

No named spec section appears incorrect.

The W7 brief's P2 parenthetical is ambiguous about `KeyE`, but the pinned
MAME 0.161 `src/emu/inpttype.h` is unambiguous: lines 153–156 bind directions
to R/F/D/G, lines 165–168 bind buttons 1–4 to A/S/Q/W, and lines 169–170
give buttons 5–6 joystick bindings only. Line 181 binds start 2 to `2`, while
line 451 binds coin 2 to `6`. `DEFAULT_KEYBOARD_MAP` therefore leaves P2
buttons 5–6 unbound and maps `Digit6` to P2 coin as the brief explicitly
requires. (`Digit6` is also MAME's default P2 select key at line 182, but one
physical `Record<KeyCode, ArcadeControl>` entry cannot represent both, and the
brief chooses coin.) The source comment records this choice.

## Browser cases

Run:

```sh
npm run test:browser
```

`tests/browser/21-keyboard-source.test.ts` starts an ephemeral localhost page,
transpiles the production modules it requests in memory, and loads only
`FakeArcadeSession` from `tests/support/`. The three Chromium cases cover the
real default `window`/`document` targets, Playwright key down/up, repeat and
unmapped-key filtering, both `preventDefault` choices, window blur, and hidden
document visibility. They need no harness artifact or MAME probe environment
variable. If Chromium is absent, install it with
`npx playwright install chromium` and rerun the command.

## Verification

On the committed package worktree:

```text
npm run check        pass
npm test             pass (270/270)
npm run test:browser pass (3 W7 + 7 W5 cases; 22 unrelated probe skips)
```

On the conflict-free isolated rebase onto `main` at `ddd7b8b`:

```text
npm run check pass
npm test      pass (273/273)
```

The rebased clone's localhost browser server could not bind while its test root
was outside the managed workspace. The identical W7 browser source passed all
three Chromium cases in the package worktree as recorded above; rerun
`npm run test:browser` after the integrator installs the rebase.
