# W13a — Harness: minimal preload page and `serve-harness --preload`

Lane: **TypeScript**. Branch: `wp/w13a-harness-preload`. Milestone: M1.
Starts after W11 has merged. W13b (the cabinet page) is a later package.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W13 | Harness and preload: `serve-harness.ts --preload`, `harness/` | `scripts/serve-harness.ts`, `harness/` | W11 (minimal page), W12 (cabinet page) | §11 | T | M1, M7 |

This brief is the W11 half only: a page that starts a preloaded machine
through `ArcadePlayer`, with keyboard input, so M1's 60/120 Hz acceptance
and every later real-build browser case have one shared way to load a
private test set.

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §11 and **§11.1 in full**,
§0.2 (preload is a test aid, not a deployment), §0.3 (never a ROM
reference in tracked files), §9 (`ArcadePlayer.init` and `audit()`),
§10.3 (`KeyboardSource` with `DEFAULT_KEYBOARD_MAP`), and §14 (the
`ARCADE_PRELOAD_CONFIG` convention).

Read on `main`: `tests/support/TestPageServer.ts` (the in-memory
transpile approach you may reuse for the harness dev server, since the
harness page imports library source directly), `src/ArcadePlayer/`,
`src/KeyboardSource/`.

## 3. Write set

Exclusive: `scripts/serve-harness.ts`, `harness/` (`index.html`,
`harness.ts`, `preload.example.json`, `README.md`), plus your tests:
`tests/spec/26-preload-config.test.ts` (config predicate, path
sanitisation, served-URL mapping) and `tests/browser/29-harness-preload.test.ts`
(starts the server with a synthetic preload config pointing at synthetic
zips and checks the page's audit rendering; a second case gated on
`ARCADE_PRELOAD_CONFIG` starts a real machine and sees the first frame).

You will need a `package.json` script `"harness": "node --import tsx
scripts/serve-harness.ts"`. List it in your merge note.

## 4. Deliverables

1. **Preload config** per §11.1: `PreloadConfig` type and predicate in
   `scripts/serve-harness.ts` (exported for the test): `family`,
   `machine`, optional `bios`, `roms[]`, optional `samples[]`,
   optional `dipswitches`, optional `autostart`. Paths resolve relative
   to the config file; the sanitised form served at `/preload.json`
   replaces every path with its basename and adds `romUrls` under
   `/preload/<basename>`. Duplicate basenames after case folding reject
   at startup with a clear message.
2. **`serve-harness.ts`**: `--port` (default 8787), `--host` (default
   127.0.0.1), `--build-root <dir>` (default `dist/mame`, served at
   `/mame/` with `.wasm` as `application/wasm`), `--preload <config>`.
   Serves `harness/index.html` at `/`, transpiles `harness/harness.ts`
   and the repository `src/` modules in memory the way `TestPageServer`
   does (share code by importing it, since it is test support, or copy
   the minimal mapping and say why), serves `/preload.json` and
   `/preload/<basename>` only for the listed files, 404 for anything
   else, and never serves `res/` itself. Prints the URL on start.
3. **Harness page**: a family/build selector listing the directories
   under the build root that contain a `build.json`, a machine input, a
   BIOS input, a "start" button, the canvas in a container, an audit
   panel, a status line and a log panel. When `/preload.json` exists it
   fills the selectors, runs `player.audit()`, renders the report, and
   if `autostart` is true starts after one click anywhere (the audio
   gesture). Keyboard play through `KeyboardSource` with
   `DEFAULT_KEYBOARD_MAP`. Without a preload config it shows the
   selectors and a note that the file picker arrives with W13b.
4. **`harness/preload.example.json`** with placeholder names only, and
   `harness/README.md` with the commands below.

## 5. Contracts and doubles

The harness is a consumer: it uses only the root export. For the browser
test, generate synthetic zips with `fflate` and a synthetic
`romsets/` directory so the audit panel can be exercised without a real
build; mark the real-build case as skipping when the env var is absent.

## 6. Definition of ready for review

`docs/work/README.md` rule 8, plus: `npm run harness -- --preload
res/preload.json` starts, the page loads, and with a real family build in
`dist/mame/<family>/` the preloaded machine starts and shows frames on
your machine (say which family). If W2's build pipeline has not merged
yet, use the artifact W3's merge note describes and say so.

## 7. Repository rules that bite here

- Nothing under `res/` is read except through `--preload`; the
  committed example has placeholders only.
- The server binds loopback by default and serves only listed files
  under `/preload/`.
- The harness is excluded from the package (`files` in `package.json`
  already excludes it) and imports only the root export.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run harness -- --preload res/preload.json
npm run check && npm test
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser
```
