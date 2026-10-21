# W17 — v1.0.0 release gate

Lane: **TypeScript**. Branch: `wp/w17-release-gate`. Milestone: M9.
Starts after W16 has merged.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W17 | Release gate: licence notices in build output, `npm pack` tests, hosted-harness policy | `scripts/build-mame.ts` (notice copy only), `tests/spec/*package*` | W2, W12 | §0.4, §14.1 | T | M9 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §0.4, §1.4 (package
surface, the single bin, what a tarball contains), §4.1 step 6 (notices),
§14 ("build" suite) and §14.1 (the ten v1.0.0 flows), §12 M9's row.
Then `docs/probes/mame0161/source-and-licence.md`, `LICENSE`, `README.md`,
`package.json` and `scripts/mame-build/buildInfo.ts` (`NOTICE_SOURCES`).

## 3. Write set

Exclusive: `tests/spec/31-package-contents.test.ts`, `tests/spec/32-build-output.test.ts`,
`docs/release.md` (new), `LICENSE` (scope wording only if needed),
`README.md` ("Licensing" and "Repository policy" sections only), and
`scripts/build-mame.ts` **only** if a notice is found missing from the
P1 inventory. You will need `package.json` changes (`files`, `version`,
possibly `exports`); list them in the merge note, do not edit.

## 4. Deliverables

1. **Package test.** `npm pack --dry-run --json` (or pack to a temp dir
   and list) must contain: `dist/` compiled library and declarations,
   `src/`, `scripts/audit-roms.ts` with whatever it imports at run time,
   `LICENSE`, `README.md`, `package.json`; and must not contain anything
   under `res/`, `harness/`, `tests/`, `docs/probes/`, `.cache/`,
   `dist/mame/`, any `.wasm`, `.zip`, `.bc` or `.sta` file, or
   `mame/probes/`. The test runs `npm run build:package` first in a temp
   copy, or skips with a reason when `npm` is unavailable.
2. **Bin check.** The published bin must run from the tarball: a
   `.ts` bin needs `tsx`, which is a dev dependency. Decide and document
   one of: compile `scripts/audit-roms.ts` into `dist/bin/` and point the
   bin there (preferred), or declare the bin requires `tsx`. The test
   executes the packed bin against a synthetic romsets directory.
3. **Build-output test.** For every `dist/mame/<family>/` present:
   `build.json` validates, every `artifacts` entry exists, `notices/`
   holds every `licenses` entry, `romsets/` has one file per `machines`
   entry and each validates, and the threading inspector passes. Skip
   per family when absent, never fail for an unbuilt family.
4. **`docs/release.md`.** The release procedure: build every required
   family from a clean unpack (`build-mame --all --fresh`), run `check`,
   `test`, `test:browser` with the private configs, the family
   measurements and the M1/M3–M5 acceptance cases, then `npm pack`. State
   plainly what a release does and does not distribute: the npm package
   never contains a MAME build, a ROM or a notice bundle; family builds
   are consumer-hosted artifacts under MAME 0.161's historical licence
   with the P1 notice set beside them; the harness is never hosted
   publicly with ROMs. Record the licence review outcome for the
   emulator artifacts as a decision with the reviewer and date left for
   the user to fill.
5. **Version.** Propose `1.0.0` in the merge note with the changelog
   entries drawn from `docs/ROADMAP.md`'s log; do not edit `package.json`.

## 5. Contracts and doubles

None. This package is tests and documents over the real repository.

## 6. Definition of ready for review

`docs/work/README.md` rule 8, plus a pasted tarball file listing in the
merge note and the bin's output from the packed artifact.

## 7. Repository rules that bite here

- Nothing under `res/` or `dist/mame/` may be referenced by name in a
  tracked file; the build-output test discovers families from the
  directory.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check && npm test
npm run build:package
npm pack --dry-run
```
