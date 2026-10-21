# W6 — `ArcadeAudio`

Lane: **TypeScript**. Branch: `wp/w6-arcade-audio`. Milestone: M3.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W6 | `ArcadeAudio` | `src/ArcadeAudio/` | W0 | §8 | T | M3 |

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §8 in full, §2.3
(`SoundEvent`, `ArcadeSession.sampleRate`, `onSound`), §4.2's "web sound"
bullet and the P10 evidence in `docs/probes/mame0161/bridge-hooks.md`
("Sound (P10)"): 48 kHz, interleaved L/R, 960-frame chunks at a 50 Hz
cadence that crosses the screen cadence. That cadence is why §8 says
queue accounting uses buffer duration, never callback arrival time.

Port reference: `/home/mastergray/dev/dos-game-runtime-js/src/DosAudio/`
and `tests/browser/03-dos-audio.test.ts`. §8 says "port of `DosAudio`";
keep its public shape (`armGestureUnlock`, `isUnlocked`, `isMuted`,
`sampleRate`, `queuedMs`, `droppedSamples`, `mute`, `unmute`, `destroy`,
`init` filling the `AudioContext`, the `GestureSourceLike` and
`AudioContextLike` injection types, `AUDIO_FAILED`) and change only what
§8 lists.

## 3. Write set

Exclusive: `src/ArcadeAudio/` (`ArcadeAudio.ts`, `types.ts`), plus your
tests: `tests/spec/18-arcade-audio-queue.test.ts` (pure queue and
de-interleave logic with a scripted `AudioContextLike`) and
`tests/browser/23-arcade-audio.test.ts`.

You will need export lines in `src/index.ts` for `ArcadeAudio` and your
`types.ts` re-exports. Do not add them; list them in your merge note.

## 4. Deliverables

1. `ArcadeAudio` per §8:
   - Attaches to `session.onSound`; each `SoundEvent` is interleaved
     stereo float that must be copied immediately (the buffer is reused
     by the session) and de-interleaved into two channels.
   - `AudioContext` constructed by `init` with
     `{ sampleRate: session.sampleRate }`; the browser may ignore it, so
     every `AudioBuffer` is created at `session.sampleRate` and the
     context converts. `queuedMs` is the sum of scheduled buffer
     durations not yet played, computed from each buffer's own frame count
     and rate, never from when callbacks arrived.
   - Constants `MAX_QUEUE_MS = 120` and `MIN_CHUNK_MS = 16` as static
     fields; samples beyond the cap are dropped oldest-first and counted
     in `droppedSamples`.
   - Gesture unlock, mute through a gain node, `destroy` closing the
     context and unsubscribing, exactly as the DOS class does.
   - Constructor reads no globals; `init` supplies `AudioContext`.
2. Extract the queue arithmetic into pure, testable functions in the
   class (static or module-private but exported from `types.ts` for the
   test): de-interleave of an `n×2` float array into two `n` arrays, the
   cap-and-drop decision given queued ms and an incoming chunk, and the
   "schedule now or wait for MIN_CHUNK_MS" decision.
3. `types.ts` with `ArcadeAudioConfig`, the `AudioContextLike` and
   `GestureSourceLike` interfaces and their predicates.

## 5. Contracts and doubles

From `src/shared.types.ts`: `ArcadeSession`, `SoundEvent`, `Listener`,
`Unsubscribe`, `FiniteNumber`, `isArcadeSession`, `isSoundEvent`. From
`tests/support/`: `FakeArcadeSession` (`emitSound`), `fixtures.ts`.
Write a scripted `FakeAudioContext` inside your spec test (records created
buffers and scheduled start times, has a controllable `currentTime` and
`state`).

## 6. Definition of ready for review

`docs/work/README.md` rule 7. The spec file must show: a 960-frame chunk
at 48 kHz adds exactly 20 ms to `queuedMs`; chunks arriving at a 50 Hz
cadence into a 60 Hz consumer never exceed the cap over 300 simulated
chunks; a burst that would exceed 120 ms drops the oldest samples and
counts them; nothing is scheduled while the context is `suspended`;
`destroy` is idempotent and closes the context once. The browser file
must show audible scheduling after a synthetic gesture under Chromium
(use `--autoplay-policy=no-user-gesture-required` only if the DOS test
does the same; say so).

## 7. Repository rules that bite here

- No `window`, `document` or `AudioContext` in the constructor.
- Only `browser` tests touch Web Audio.
- Every config and event has a predicate and a spec test.
- No attribution lines in commits.

## 8. Commands

```sh
npm install
npm run check
npm test
npm run test:browser
```
