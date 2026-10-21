# W12 — `ArcadeCabinet`

Lane: **TypeScript**. Branch: `wp/w12-arcade-cabinet`. Milestone: M7.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W12 | `ArcadeCabinet` | `src/ArcadeCabinet/` | W8, W9, W10, W11 | §10.6 | T | M7 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §10.6 in full, §9
(`ArcadePlayer`, which the cabinet owns), §10.3 and §10.4 (the two
sources it attaches), §10.7 (`ArcadeStorage` and `ArcadeRomStore`), §10.5
(`audit()`), §0.2 (v1.0.0 has no touch controls: the three touch fields
of `ArcadeControlsConfig` are accepted by the predicate but rejected with
`UNSUPPORTED` at construction until M10).

Port reference: `/home/mastergray/dev/dos-game-runtime-js/src/DosDeployment/`
and `tests/spec/08-deployment-config.test.ts` plus its browser case. §10.6
says the cabinet is the counterpart of `DosDeployment`: keep its lifecycle
(player started before sources attach, teardown of everything created in a
failed `start()`, exit tears controls down, setters remembered across
restarts, idempotent terminal `destroy`) and apply the §10.6 differences.

On `main`, read the public surfaces of `src/ArcadePlayer/`,
`src/KeyboardSource/`, `src/GamepadSource/`, `src/ArcadeStorage/`,
`src/ArcadeRomStore/` and `src/RomSetAudit/`; you compose them and must not
duplicate their logic.

## 3. Write set

Exclusive: `src/ArcadeCabinet/` (`ArcadeCabinet.ts`, `types.ts`), plus your
tests: `tests/spec/29-arcade-cabinet.test.ts` (against `FakeArcadeAdapter`,
`FakeArcadeSession`, a scripted `IDBFactoryLike`, fake event targets and
`FakeFrameScheduler`) and `tests/browser/31-arcade-cabinet.test.ts` (a real
page with doubles, plus one case gated on `ARCADE_PRELOAD_CONFIG` that
starts the real build through `ArcadeCabinet.init`).

You will need export lines in `src/index.ts` for `ArcadeCabinet` and your
`types.ts` re-exports. List them in your merge note.

## 4. Deliverables

1. **`ArcadeCabinet`** per §10.6, exactly the declared surface:
   - Constructor takes a resolved `ArcadePlayer` plus the optional
     `storage`, `romStore`, `controls`, `keyboardTarget`, `autosave` and
     injected event targets; it reads no globals. `init` builds the player
     (`ArcadePlayer.init` with `adapter` or `adapterConfig`, exactly one),
     supplies browser defaults, applies `DEFAULT_KEYBOARD_MAP` when
     `controls.keyboard.map` is absent, and restores `storage` into
     `game.changes` only when `game.changes` was not given.
   - **ROM store integration.** When `romStore` is present, every
     `game.roms` entry that is a bare basename string with no URL scheme
     and no `/` is fetched from the store (`ROM_LOAD_FAILED` naming the
     basename when absent); every blob source is stored after a successful
     audit. URL and `RomFile` sources pass through unchanged.
   - `audit()` forwards to the player. `start()` audits, starts the player,
     then creates and attaches `KeyboardSource` (channel from the player's
     input, `enabled` from config) and `GamepadSource`; any failure tears
     down what this call created and rejects. A player `exit` event tears
     the sources down too and leaves the cabinet startable again.
   - `save()` persists through the player and stores a non-null overlay,
     returning `false` when nothing changed; `UNSUPPORTED` without storage.
     `quickSave(slot = "quick")` is `player.saveState(slot)` then `save()`.
     `clearSaves()` clears storage (not the ROM store); `UNSUPPORTED`
     without storage.
   - `autosave: true` persists on `visibilitychange` to hidden (injected
     visibility target) while running.
   - `keyboardEnabled` / `gamepadsEnabled` setters validate booleans,
     remember their value across restarts, and update a live source.
   - `fullscreen()` / `exitFullscreen()` forward to the player's display.
   - `destroy()` is idempotent, destroys sources before the player, and
     releases every held control.
   - `OVERLAY_INCOMPATIBLE` from `start()` is surfaced as the typed error;
     the cabinet never clears storage on its own.
2. **`types.ts`**: `ArcadeControlsConfig`, `ArcadeCabinetConfig`,
   `ArcadeCabinetInitConfig`, and predicates; the touch fields validate
   structurally but the constructor rejects them with `UNSUPPORTED`.

## 5. Contracts and doubles

From `src/index.ts`: everything above. From `tests/support/`:
`FakeArcadeAdapter`, `FakeArcadeSession`, `FakeFrameScheduler`,
`FailingIndexedDB`, `fixtures.ts`. For storage in spec tests, script a
minimal in-memory `IDBFactoryLike` or construct `ArcadeStorage` with
`FailingIndexedDB` for the failure paths; the round trips belong in the
browser case.

## 6. Definition of ready for review

`docs/work/README.md` rule 8. Required spec cases mirror the DOS deployment
tests: restored overlay wins unless `game.changes` is explicit; source
gates; partial-construction cleanup; exit cleanup; save and no-save;
double destroy; ROM store resolution of bare basenames and storage of
blobs; touch fields rejected with `UNSUPPORTED`.

## 7. Repository rules that bite here

- No globals in the constructor; `init` supplies `window`, `document`,
  `navigator`, `indexedDB`, `crypto.subtle` and `fetch`.
- Do not re-implement audit, resolution, input or storage logic.
- Do not run `npm run build` or `npm run clean` (they remove `dist/`).
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check && npm test
npm run test:browser
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```
