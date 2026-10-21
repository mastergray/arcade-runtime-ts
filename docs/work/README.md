# Work package briefs

One file per work package from §16.3 of
[the runtime spec](../arcade-runtime-spec.md), in the shape §16.6 defines.
An agent handed a brief works from the brief and the spec alone.

| Brief | Lane |
| ----- | ---- |
| [W1 — patch relocation and family target pairs](W1-targets.md) | Native |
| [W3 — production web bridge](W3-bridge.md) | Native |
| [W4 — `MameEmulatorAdapter`](W4-mame-adapter.md) | Native |
| [W5 — `ArcadeDisplay`](W5-arcade-display.md) | TypeScript |
| [W6 — `ArcadeAudio`](W6-arcade-audio.md) | TypeScript |
| [W7 — `ArcadeInput`, `KeyboardSource`, controller config](W7-arcade-input.md) | TypeScript |
| [W8 — `GamepadSource`](W8-gamepad-source.md) | TypeScript |
| [W9 — `ArcadeStorage`, `ArcadeRomStore`](W9-storage.md) | TypeScript |
| [W10 — `RomSetAudit`, `arcade-audit-roms`](W10-romset-audit.md) | TypeScript |
| [W11 — `ArcadePlayer`](W11-arcade-player.md) | TypeScript |
| [W13a — harness preload page and `serve-harness`](W13a-harness-preload.md) | TypeScript |
| [W14a–f — one family build each](W14-family.md) | Native |

Package and milestone status is tracked in one place,
[`docs/ROADMAP.md`](../ROADMAP.md); this list only links the briefs.

## Rules every brief shares

These are repeated in each brief; they are listed once here so the
integrator can keep them in sync.

1. Read `docs/arcade-runtime-spec.md` §0–§3 and §16 in full, then the
   sections the brief names, before writing code.
2. Edit only the brief's write set plus your own test files under
   `tests/spec/` and `tests/browser/`. Integrator-owned files
   (`src/index.ts`, `src/shared.types.ts`, `package.json`, `tsconfig*.json`,
   `tests/run.ts`, the spec) are never edited on a package branch. If you
   need a line in one of them, say so in your merge note.
3. Contracts in `src/shared.types.ts` are frozen. If one is wrong for your
   package, stop and write a contract-amendment note instead of working
   around it.
4. Test against `tests/support/` doubles, never against another package's
   branch.
5. Repository rules: constructors read no globals and `init` supplies
   browser defaults; one error class (`ArcadeRuntimeError`), every public
   class, config and event has a structural predicate and a spec test; a
   test that touches the DOM lives in `tests/browser/`; nothing under
   `res/` is read by a committed test except through the documented
   environment variable; no ROM identity, hash or local path in any
   tracked file; commit messages are a short summary line, a blank line,
   then details, with no attribution lines.
6. Code style follows the existing files: a `// realizes:` header, the
   `// TYPE ::` / `// INTERFACE ::` / `// PREDICATE ::` / `// INSTANCE ::`
   comment conventions, `Type Declarations` / `Type Predicates` / `Class`
   banners, and the `tests/run.ts` `TestFile` manifest shape with
   `ctg-js-test` pipelines.
7. A browser test that needs a page serves it through
   `tests/support/TestPageServer.ts` (`withTestPage(PAGE, run)`), which
   transpiles repository modules in memory and resolves the runtime
   dependencies the browser cannot (`fflate`). Do not write a private
   page server.
8. Ready for review means: branch rebased on current `main`;
   `npm run check` and `npm test` pass; browser cases pass or skip for a
   documented reason; only the write set and your tests changed; the
   merge note lists any integrator-owned line you need and any spec
   section you believe is wrong.

## Branch and worktree

```sh
git worktree add ../arcade-runtime-ts.<id> -b wp/<id>-<slug> main
cd ../arcade-runtime-ts.<id>
npm install
```

The TypeScript lane needs nothing else.

When the agent is a sandboxed Codex run, the worktree's `.git` is a file
pointing into the main checkout's `.git/worktrees/`, which is outside the
sandbox's writable workspace. Launch with that directory writable, cut the
branch from current `main` immediately before launching so no rebase is
needed, and tell the agent never to rebase and never to stop on a refused
git command:

```sh
codex exec -s workspace-write -c 'approval_policy="never"' \
  -c 'sandbox_workspace_write.writable_roots=["/home/mastergray/dev/arcade-runtime-ts/.git"]' - < brief-prompt.md
``` The native lane additionally
recreates the two ignored links:

```sh
ln -s /home/mastergray/dev/mame-runtume-ts/res/emsdk res/emsdk
mkdir -p .cache && ln -s /home/mastergray/dev/mame-runtume-ts/.cache/mame0161-source .cache/mame0161-source
```
