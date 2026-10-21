# W12 merge note

## Summary

W12 adds `ArcadeCabinet`, its three public config types and predicates, the
required spec coverage, a Chromium case with doubles and real IndexedDB, and
an environment-gated production Neo Geo case. The production case reads
private inputs only through `ARCADE_PRELOAD_CONFIG` and reports boolean
observations only.

`ArcadeCabinet.init` accepts already-constructed `ArcadeStorage` and
`ArcadeRomStore` instances as §10.6 declares. IndexedDB and Web Crypto browser
defaulting therefore remains owned by those two classes; cabinet init itself
defaults `window`, `document`, `navigator`, animation frames and `fetch` for
the player and input sources.

## Integrator-owned `src/index.ts` lines

Add the class export after the other composition/storage classes:

```ts
export { default as ArcadeCabinet } from "./ArcadeCabinet/ArcadeCabinet.js";   // Full player, controls and persistence composition root
```

Add the config predicates and type re-exports with the other class-owned
types:

```ts
export {
    isArcadeCabinetConfig,                                        // Guard for resolved direct construction
    isArcadeCabinetInitConfig,                                    // Guard for browser-defaulting init construction
    isArcadeControlsConfig,                                       // Guard for desktop and reserved touch controls
    type ArcadeCabinetConfig,                                     // Resolved direct-construction config
    type ArcadeCabinetInitConfig,                                 // Page-level init config
    type ArcadeControlsConfig,                                    // Keyboard, gamepad and reserved touch declarations
} from "./ArcadeCabinet/types.js";
```

No other integrator-owned file needs a change; `tests/run.ts` discovers the
new files automatically.

## §9 lifecycle note

Natural `ArcadePlayer` exit destroys its `ArcadeInput` before emitting the
public `exit` event. Cabinet exit cleanup consequently removes source
listeners and drops source references while tolerating `DESTROYED` from an
already-retired source channel. All controls have already been released by
the player at that point.

If source attachment fails after `player.start()` has resolved, the public
§9 surface has no nonterminal session-stop operation. To satisfy §10.6's
complete partial-start teardown, the cabinet destroys the player and becomes
terminal in that one path. Audit and player-start failures still leave the
cabinet retryable.

## Verification and browser cases

Run the double-backed browser case and all ordinary browser coverage with:

```sh
npm run test:browser
```

Run the real production case through `ArcadeCabinet.init` with:

```sh
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```

Verification in this worktree:

- `npm run check` passes.
- `npm test` passes: 481 cases, 479 passed, 2 skipped, 0 failed.
- `npm run test:browser` passed before the environment stopped permitting
  loopback binds, including the new double-backed cabinet case.
- The gated module validates the ignored preload config and confirms the
  production build artifacts are present. The full gated browser command
  could not execute in the final sandbox: every browser file failed before
  test logic with `listen EPERM` on `127.0.0.1`. Re-run the command above in
  an environment that permits the loopback page/resource servers.

No private machine name, archive name, hash or local absolute path is
recorded here or in the tests.
