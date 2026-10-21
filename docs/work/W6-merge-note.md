# W6 merge note

## Integrator-owned changes

Add the class export beside the other runtime classes in `src/index.ts`:

```ts
export { default as ArcadeAudio } from "./ArcadeAudio/ArcadeAudio.js";                     // Stereo Web Audio playback, gesture unlock and bounded latency
```

Add the complete `types.ts` surface with the other class-owned types and
predicates in `src/index.ts`:

```ts
export {
    audioQueueCapDecision,                                      // Pure oldest-first duration-cap arithmetic
    deinterleaveStereo,                                         // Copies interleaved stereo into independent channels
    isArcadeAudioConfig,                                        // Guard for ArcadeAudioConfig
    isAudioContextLike,                                         // Guard for the injected Web Audio context
    isGestureSourceLike,                                        // Guard for the gesture listener target
    shouldScheduleAudio,                                        // Pure minimum-chunk scheduling decision
    type ArcadeAudioConfig,                                     // Direct construction dependencies
    type AudioContextLike,                                      // Injected Web Audio context subset
    type AudioQueueCapDecision,                                 // Oldest-first frame-drop decision
    type GestureSourceLike,                                     // Gesture listener target subset
} from "./ArcadeAudio/types.js";
```

No `tests/run.ts` change is needed; its manifest discovers both W6 test files
by filename.

## Spec review

I found no incorrect section in the implementation spec. The handoff request
named `docs/work/W6-arcade-display.md`, which does not exist; the work index,
branch name and package identify the applicable brief as
`docs/work/W6-arcade-audio.md`.

## Browser case

Run all browser cases with:

```sh
npm run test:browser
```

`tests/browser/23-arcade-audio.test.ts` starts its own local page, constructs a
real Chromium `AudioContext` through `ArcadeAudio.init`, sends a trusted
Playwright pointer gesture, and verifies that a non-silent 960-frame stereo
buffer is scheduled at 48 kHz through a gain node to the context destination.
It does not use `--autoplay-policy=no-user-gesture-required` and requires no
ROM or environment variable. The unrelated private MAME probe cases skip when
their documented local environment variables are absent.

## Verification

On `wp/w6-arcade-audio`, based directly on the current local `main` at package
start:

```text
npm run check          PASS
npm test               PASS (285 passed)
npm run test:browser   PASS (11 passed, 22 private probe cases skipped)
```
