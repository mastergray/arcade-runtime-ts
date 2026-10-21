# W11 — `ArcadePlayer`

Lane: **TypeScript**. Branch: `wp/w11-arcade-player`. Milestones: M1–M4.
Starts after W4 has merged (it composes the real adapter's session shape,
and its browser acceptance needs a real build).

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W11 | `ArcadePlayer` | `src/ArcadePlayer/` | W4, W5, W6, W7 | §9 | T | M1–M4 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §9 in full, §2.3
(`RomSource`, `ArcadeStartConfig`, `ArcadeSession`), §5 (what the adapter
does on `start`, and that `reset("hard")` is the player's job: exit then
start again with the cached ROM bytes), §7, §8 and §10.5 (`audit()`).

Port reference: `/home/mastergray/dev/dos-game-runtime-js/src/DosPlayer/`
and `tests/browser/04-dos-player.test.ts`. §9 says lifecycle, failure
handling and event semantics follow `DosPlayer`; read its status machine,
listener error isolation and partial-start teardown closely, then apply
the §9 paragraph that spells out the arcade differences.

On `main`, read `src/ArcadeDisplay/`, `src/ArcadeAudio/`,
`src/ArcadeInput/`, `src/RomSetAudit/` and `src/MameEmulatorAdapter/`
public surfaces; you compose them and must not duplicate their logic.

## 3. Write set

Exclusive: `src/ArcadePlayer/` (`ArcadePlayer.ts`, `types.ts`,
`RomSourceResolver.ts`), plus your tests:
`tests/spec/24-arcade-player.test.ts` (against `FakeArcadeAdapter` and
`FakeArcadeSession`, with scripted display/audio dependencies),
`tests/spec/25-rom-source-resolver.test.ts`, and
`tests/browser/28-arcade-player.test.ts` (doubles in a real page, plus one
case against the real build gated on `ARCADE_PRELOAD_CONFIG`).

You will need export lines in `src/index.ts` for `ArcadePlayer` and your
`types.ts` re-exports. List them in your merge note.

## 4. Deliverables

1. **`RomSourceResolver`** (internal): `resolve(sources, fetch) →
   Promise<RomFile[]>` runs in parallel; URL strings are fetched and a
   non-OK response or network error rejects with `ROM_LOAD_FAILED`
   naming the URL only; `{ name, blob }` is read with `arrayBuffer()`
   and an unreadable blob rejects the same way naming the basename;
   `RomFile` bytes are copied. Basenames derive from the URL path's last
   segment; duplicates after `romNameKey` reject with `INVALID_CONFIG`.
2. **`ArcadePlayer`** per §9, exactly the declared surface. Specifics:
   - Construction needs a resolved `ArcadeAdapter`; `init` resolves
     `adapterConfig` by calling `MameEmulatorAdapter.init` (type
     `"mame"` or omitted) and rejects `"libretro"` with `UNSUPPORTED`
     until M15. Exactly one of `adapter` and `adapterConfig`.
   - `audit()` resolves sources once (cached for the lifetime of the
     player), fetches `romsets/<machine>.json` relative to the adapter's
     build URL when the adapter exposes one, runs `RomSetAudit.audit`
     and resolves with the report. When no metadata is reachable it
     resolves with a report of status `ok` and a `problems` entry saying
     metadata was unavailable, so a page can still start.
   - `start()`: `idle → starting`; audit first and reject
     `ROM_SET_INVALID` with the report when status is `bad` or
     `incomplete`; then `adapter.start` with the resolved files, hints,
     `bios`, `dipswitches`, `options` and `changes`; attach display and
     audio; construct `ArcadeInput`; `running`. Any failure tears down
     whatever was created in that call, emits one `error`, returns to
     `idle`, and may be retried without refetching.
   - `pause`/`resume` idempotent in matching states; `releaseAll` before
     pause. `reset("soft")` forwards; `reset("hard")` is exit then start
     reusing cached bytes and the current overlay (`persist()` first so
     NVRAM is not lost).
   - `saveState(slot = "quick")`, `loadState`, `persist`, `fullscreen`
     forward to the session or display with `NOT_STARTED` guards.
   - `on("status" | "exit" | "error", listener)`; listener exceptions
     are isolated and surface once as `INTERNAL_ERROR` without recursive
     emission. Natural session exit emits `exit` once and returns to
     `idle` keeping display and cached bytes.
   - `destroy()` terminal and idempotent: exits a running session,
     destroys input, audio and display, clears listeners.
   - `display.showPlaceholder` is driven by status: shown while
     `starting`, hidden on `running`.
3. **`types.ts`**: `ArcadeGameConfig`, `ArcadeAdapterSelection`,
   `ArcadePlayerConfig`, `ArcadePlayerStatus`, the event map, and
   predicates.

## 5. Contracts and doubles

From `src/index.ts`: everything above. From `tests/support/`:
`FakeArcadeAdapter` (`script("resolve" | "reject")`), `FakeArcadeSession`
(`emitExit`, `emitFrame`, `emitSound`, `script`), `FakeFrameScheduler`,
`fixtures.ts` (`rejectedBy`, `errorSnapshot`, `blankFrame`). For display
and audio in spec tests, construct the real classes with structural doubles
for canvas, container and `AudioContextLike` (see how
`tests/spec/14-arcade-display-layout.test.ts` and
`tests/spec/18-arcade-audio-queue.test.ts` build theirs).

## 6. Definition of ready for review

`docs/work/README.md` rule 8. Required spec cases: every status
transition; failure at each async boundary (resolve, audit, adapter start,
display attach, audio construction) leaves an idle player with no
subscriptions and no partial session; retry after failure reuses cached
bytes; `exit` event once with display retained; listener exception
isolation; `destroy` idempotence; hard reset persists then restarts.

## 7. Repository rules that bite here

- The constructor reads no globals; `init` supplies `fetch`, the canvas
  and container come from config.
- Do not re-implement audit, layout, queueing or channel logic.
- ROM bytes never appear in error `data`.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check && npm test
npm run test:browser
ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser   # real-build case
```
