# P5: browser frame pacing

Status: passed. Replace the stock outer pacing loop; retain MAME's scheduler.

Observed 2026-10-18 with the pinned Emscripten 1.38.31 toolchain and headless
Chromium. The private fixture identity and ROM inputs remain local and are not
recorded here.

## Stock control flow

MAME 0.161 registers `js_main_loop` with an Emscripten rate of zero. In the
pinned runtime that selects one callback per `requestAnimationFrame`. Every
callback then advances the device scheduler toward a target exactly 1/60
second beyond its starting emulated time:

```cpp
attotime stoptime = scheduler->time() + attotime(0, HZ_TO_ATTOSECONDS(60));
while (scheduler->time() < stoptime)
    scheduler->timeslice();
```

This outer loop does not derive its slice from the machine's screen period or
elapsed wall time. Scheduler event boundaries can overshoot the target by a
small amount; the measured final advances were 16.668–16.703 ms.

MAME separately throttles at video updates. Its Emscripten clock is
`emscripten_get_now()`, but its single-threaded `usleep` implementation spins
on `performance.now()`. Therefore a callback that reaches a video update early
can occupy the browser main thread until emulated and real time agree.

## Reproducible probe

[`0003-emscripten-pacing-probe.patch`](../../../mame/patches/0003-emscripten-pacing-probe.patch)
wraps the unchanged stock callback with observational telemetry:

- scheduler time and advance;
- primary-screen frame number and configured refresh;
- MAME's reported speed; and
- browser callback count, interval and occupied wall time.

The generic local bridge can replace `requestAnimationFrame` before
Emscripten registers its loop, aligning callbacks to a requested controlled
cadence. [`04-mame-pacing-probe.test.ts`](../../../tests/browser/04-mame-pacing-probe.test.ts)
starts a fresh module at 60, 90, 120 and 144 Hz, warms it for two seconds, then
measures three seconds. This is deterministic cadence replay in headless
Chromium, not a claim about the timing characteristics of a physical monitor.

Build a separate ignored artifact by adding
`"output": "mamepacing-probe"` in the ignored local-game config, serve
the source directory, then run:

```sh
MAME_PACING_PROBE_URL=http://127.0.0.1:8877/mamepacing-probe.html \
  npm run test:browser
```

## Result

The machine reported a 59.186 Hz primary-screen refresh in every case.

| Requested display Hz | Wall seconds | Emulated seconds | Emulated / wall | Screen Hz | Callback Hz | Average callback work | Maximum callback work | Reported speed |
| -------------------: | -----------: | ---------------: | --------------: | --------: | ----------: | --------------------: | --------------------: | -------------: |
| 60  | 3.0168 | 2.972224 | 98.52%  | 58.340 | 59.003 | 9.958 ms  | 17.4 ms | 100.1% |
| 90  | 3.0032 | 2.972224 | 98.97%  | 58.604 | 59.270 | 10.686 ms | 18.9 ms | 100.1% |
| 120 | 3.0133 | 3.005605 | 99.74%  | 59.071 | 59.735 | 11.693 ms | 19.2 ms | 100.1% |
| 144 | 3.0057 | 3.005605 | 100.00% | 59.221 | 59.886 | 12.077 ms | 22.6 ms | 100.0% |

Emulated time stayed within 1.5% of wall time and rendered-screen cadence
stayed within 0.9 Hz of the configured refresh. The game therefore ran at the
correct rate in all four controlled display cases.

That correctness came from blocking rather than display-independent outer
scheduling. At every faster requested cadence the achieved callback rate
collapsed to about 60 Hz, and the callback occupied the main thread for an
average 10.5–12.1 ms. The stock path is unsuitable as the runtime's production
pacer even though it preserves machine speed on this desktop probe.

## Decision

The web bridge will retain MAME's device scheduler but replace the stock outer
pacing policy. It will disable MAME's blocking throttle, accumulate monotonic
wall time across browser scheduler ticks, and advance by the primary screen's
reported period rather than a hard-coded 1/60-second slice. Catch-up is capped
at four frame periods and excess time after a long gap is discarded, avoiding
a background-tab fast-forward burst. This keeps machine cadence independent
of 60, 90, 120 or 144 Hz display scheduling without deliberately blocking the
main thread.
