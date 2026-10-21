# W11 merge note: ArcadePlayer

## Status

W11's implementation, double-backed specification coverage, and browser cases
are complete. `npm run check` passes. `npm test` passes with 469 passed, 0
failed, and 2 existing skipped cases. `npm run test:browser` passes with 20
passed, 0 failed, and 25 environment-gated skips, including the always-on W11
real-page composition case.

The private production-build case is present and correctly gated on
`ARCADE_PRELOAD_CONFIG`. This managed sandbox denied every loopback listener
with `listen EPERM` when that private environment was supplied, including the
unrelated existing browser cases, so the production case could not reach its
assertions here. The exact command for an unrestricted environment is below.

The implementation, tests, and this note are committed on
`wp/w11-arcade-player`.

## Integrator-owned `src/index.ts` lines

Add the class export with the other runtime classes:

```ts
export { default as ArcadePlayer } from "./ArcadePlayer/ArcadePlayer.js";
```

Add the public predicates and types with the other class-owned surfaces:

```ts
export {
    isArcadeAdapterSelection,
    isArcadeGameConfig,
    isArcadePlayerConfig,
    isArcadePlayerEvents,
    isArcadePlayerStatus,
    type ArcadeAdapterSelection,
    type ArcadeGameConfig,
    type ArcadePlayerConfig,
    type ArcadePlayerEvents,
    type ArcadePlayerStatus,
} from "./ArcadePlayer/types.js";
```

`RomSourceResolver` is package-internal and should not be added to the root
surface. No `tests/run.ts` line is needed because its manifest discovers the
numbered test files.

## Section 9 contract note

Section 9 declares `reset(kind?: "soft" | "hard"): void`, while a hard reset
must asynchronously persist, exit, and start a fresh session. The implementation
therefore enters `starting` synchronously, performs that sequence in the
background, and reports a failure through the player's typed `error` event.
Callers cannot await completion through the declared surface. A future spec
revision could make `reset` return `Promise<void>` if awaitable hard-reset
completion is required.

No other part of section 9 required a deviation. In particular, an adapter
selection passed to `ArcadePlayer.init` retains its build URL for metadata
lookup; a directly supplied adapter without an exposed build URL uses the
specified permissive metadata-unavailable audit report.

## Browser cases

The W11 cases are in `tests/browser/28-arcade-player.test.ts`. The always-on
case uses `tests/support/TestPageServer.ts` with a fake session inside a real
Chromium page and covers display, audio/input composition, drawing, and natural
exit. Run it as part of the normal suite:

```sh
npm run test:browser
```

The second case serves the ignored production family build and ignored preload
inputs through privacy-safe local resource routes, then audits and starts the
real adapter through `ArcadePlayer.init`. Run the full production suite with
the existing W3 artifact location supplied as documented by W4:

```sh
ARCADE_PRELOAD_CONFIG=res/preload.json \
ARCADE_WEB_BRIDGE_ARTIFACT=dist/mame/neogeo/mameneogeo.js \
npm run test:browser
```

The case returns only generic booleans and counts. No private machine name, ROM
name, hash, or absolute path is recorded in tracked files.
