# W13a merge note

## Integrator-owned change

Add this entry under `package.json` `scripts`:

```json
"harness": "node --import tsx scripts/serve-harness.ts"
```

No integrator-owned file was edited on this branch.

## What landed

- `serve-harness` validates the §11.1 config, resolves archive paths relative
  to that config, rejects duplicate case-folded basenames, and serves a
  path-free `/preload.json` plus only its allowlisted `/preload/` files.
- The server lists family directories containing `build.json`, confines the
  configured build root under `/mame/`, serves WASM with
  `application/wasm`, and transpiles the harness and root-export source graph
  in memory.
- The page imports only `/src/index.js`, audits before start, renders the
  report, supports the autostart gesture, and attaches `KeyboardSource` with
  `DEFAULT_KEYBOARD_MAP` after `ArcadePlayer.start()`.
- Spec coverage exercises config predicate failures, config-relative path
  sanitisation, served-URL mapping and folded duplicate rejection. Browser
  coverage uses generated zip bytes and generated romsets metadata, plus an
  environment-gated real-build first-frame case.

The source transpilation mapping is copied in minimal form from
`TestPageServer`: its mapping and handler are not exported as an extensible
router, while this server must add build discovery, build artifacts and an
exact private-file allowlist.

## How to run

```sh
npm run harness -- --preload res/preload.json
```

Open the printed loopback URL and click once to start an autostart preload.
Without `--preload`, the page lists available builds and explains that local
file picking arrives with W13b.

Run the gates with:

```sh
npm run check
npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```

## Verification

- `npm run check`: passed.
- `npm test`: passed (474 cases, 472 passed, 2 documented skips).
- `ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser`: attempted,
  but this sandbox refuses every loopback listener with
  `listen EPERM: operation not permitted 127.0.0.1`. Both W13a cases reached
  the same listener boundary; the environment-gated config was loaded before
  bind was refused. The integrator should run the exact command above in an
  environment that permits loopback listeners.
- Manual family start: not possible in this sandbox for the same listener
  refusal. The integrator should run the harness command above and hand-start
  the available Neo Geo family build, then confirm its first visible frame.

No private machine name, archive name, hash or absolute path is recorded here
or in another tracked W13a file.

## Spec note

§11.1 says that no-preload mode falls back to a file picker, while the W13a
brief explicitly defers that picker to W13b and requires a note in its place.
This branch follows the package brief; §11.1 should be clarified to reflect
the W13a/W13b split.
