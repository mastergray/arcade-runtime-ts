# W9 merge note

## Integrator question

Can the integrator rebase this branch, including implementation commits
`371e46a` and `97a4103`, onto current `main` before review? `main` advanced
from `fa6d7ca` to `c81fb6f` while W9 was in progress, but this managed
worktree exposes `.git` as read-only for history rewrites. Both
`git rebase --autostash main` and a rebase with a temporary index were
rejected when Git tried to write `ORIG_HEAD`/`HEAD`.

The W9 paths do not overlap the five new W6 commits. I tested their exact
combined tree by applying the `fa6d7ca..c81fb6f` file delta over W9, then
reversing it after the run:

- `npm run check` passed.
- `npm test` passed: 392/392 cases.
- `npm run test:browser` passed: 17 runnable cases, with 22 existing private
  MAME probes skipped for their documented environment variables.

The worktree's uncommitted `package-lock.json` change existed before W9 and
was left untouched and uncommitted.

## `src/index.ts` additions

Add these class exports in the implementation order from §1.2 (storage
before audit, ROM store after audit):

```ts
export { default as ArcadeStorage } from "./ArcadeStorage/ArcadeStorage.js";   // Browser-local save-overlay persistence
export { default as ArcadeRomStore } from "./ArcadeRomStore/ArcadeRomStore.js";   // Browser-local user ROM archives
```

Add these class-owned type and predicate re-exports:

```ts
export {
    isArcadeStorageConfig,
    isArcadeStorageInitConfig,
    isIDBFactoryLike,
    type ArcadeStorageConfig,
    type ArcadeStorageInitConfig,
    type IDBFactoryLike,
} from "./ArcadeStorage/types.js";
export {
    isArcadeRomStoreConfig,
    isArcadeRomStoreInitConfig,
    isRomStoreEntry,
    isSubtleCryptoLike,
    type ArcadeRomStoreConfig,
    type ArcadeRomStoreInitConfig,
    type RomStoreEntry,
    type SubtleCryptoLike,
} from "./ArcadeRomStore/types.js";
```

## Spec discrepancy

The `ArcadeRomStore` class snippet in §10.7 shows a constructor that accepts
only `{ indexedDB, name? }` and an `init` config that accepts only `{ name? }`.
The W9 brief and the repository's constructor rule require `subtle` and `now`
to be injected into the constructor, with browser defaults supplied only by
`init`. The implementation follows the brief. The §10.7 snippet should be
updated to show `ArcadeRomStoreConfig` with required `indexedDB`, `subtle` and
`now`, and `ArcadeRomStoreInitConfig` with those dependencies optional.

No other spec section appeared incorrect.

## Browser cases

Run Chromium coverage with:

```sh
npm run test:browser
```

The runner auto-discovers:

- `tests/browser/25-arcade-storage.test.ts`: overlay round trip, defensive
  copies, clear, independent keys, and open/request failure mapping.
- `tests/browser/26-arcade-rom-store.test.ts`: SHA-256 metadata, byte-free
  sorted listing, defensive `get`, case-folded replacement, idempotent
  remove/clear, and named-database isolation.
