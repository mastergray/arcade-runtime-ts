# W9 — `ArcadeStorage` and `ArcadeRomStore`

Lane: **TypeScript**. Branch: `wp/w9-storage`. Milestones: M6 (storage), M7 (ROM store).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W9 | `ArcadeStorage` and `ArcadeRomStore` | `src/ArcadeStorage/`, `src/ArcadeRomStore/` | W0 | §10.7 | T | M6, M7 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §10.7 in full, §0.3 (the
ROM store is local-only and the page is responsible for its contents),
§2.3 (`RomFile`, `romNameKey`), §3 (`STORAGE_FAILED`).

Port reference: `~/dev/dos-game-runtime-js/src/DosStorage/`
with `tests/spec/09-storage-config.test.ts` and its browser case, plus
`tests/support/FailingIndexedDB.ts` there. §10.7 says `ArcadeStorage` "is
`DosStorage`": keep its public shape (`save`, `load`, `clear`, `key`,
injected `IDBFactory`, `init` supplying the global) and change only the
database and store names.

## 3. Write set

Exclusive: `src/ArcadeStorage/`, `src/ArcadeRomStore/`, plus your tests:
`tests/spec/21-storage-config.test.ts`, `tests/support/FailingIndexedDB.ts`
(port it), `tests/browser/25-arcade-storage.test.ts` and
`tests/browser/26-arcade-rom-store.test.ts`.

You will need export lines in `src/index.ts` for both classes and their
`types.ts` re-exports. List them in your merge note.

## 4. Deliverables

1. **`ArcadeStorage`**: database `arcade-runtime`, object store
   `overlays`, schema version 1, keyed by a page-supplied non-empty
   string. `save(bytes)` replaces, `load()` returns a defensive copy or
   `null`, `clear()` is idempotent, every IndexedDB failure (open,
   upgrade, transaction, request) becomes `STORAGE_FAILED` with the
   underlying error as `data`. Constructor takes `{ key, indexedDB }`;
   `init` supplies `globalThis.indexedDB` and throws `UNSUPPORTED` when
   absent.
2. **`ArcadeRomStore`** per §10.7: database `arcade-runtime-roms`, store
   `archives`, keyed by `romNameKey(name)`. Records hold `{ name, bytes,
   size, sha256, addedAt }`; `sha256` is computed with the injected
   `SubtleCrypto` (`crypto.subtle.digest`) at `put` time and `addedAt`
   from an injected `now()`; `init` supplies both. `list()` returns the
   metadata without bytes, sorted by name; `get(name)` returns a `RomFile`
   copy or `null`; `put` replaces an existing record with the same key;
   `remove` and `clear` are idempotent. All failures are `STORAGE_FAILED`.
   An optional `name` config lets a page use a separate database.
3. **`types.ts`** for each with config interfaces, the `IDBFactoryLike`
   and `SubtleCryptoLike` injection types, `RomStoreEntry`, and predicates.

## 5. Contracts and doubles

From `src/shared.types.ts`: `RomFile`, `isRomFile`, `isRomName`,
`romNameKey`, `NonEmptyString`. From `tests/support/`: `fixtures.ts`.
Spec tests cover predicates and the `UNSUPPORTED`/`STORAGE_FAILED`
mapping with `FailingIndexedDB`; everything that opens a real database
is a browser test.

## 6. Definition of ready for review

`docs/work/README.md` rule 7. Browser cases: save/load/clear round trip
with a defensive copy proven (mutate the returned array, reload, compare);
two keys do not interfere; ROM store put/list/get/remove with the SHA-256
of a known byte array checked against a precomputed hex; a replaced
record keeps one entry; a `FailingIndexedDB` produces `STORAGE_FAILED` for
open and for a request failure.

## 7. Repository rules that bite here

- Constructors take `indexedDB`, `subtle` and `now` from config; `init`
  reads the globals.
- The ROM store never exposes a URL, never exports, and never touches the
  network.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
npm run test:browser
```
