# P4: browser module lifecycle

Status: passed. Each `start()` must instantiate a fresh module.

## Question

P4 asks whether one MAME 0.161 WebAssembly module can run a second machine
after the first exits, or whether the adapter must discard it and instantiate
a new module. The private fixture used two different parent/clone entries
compiled into one driver subset. Their short names and ROM archives remain
local inputs and are not recorded here.

## Native lifecycle and browser divergence

The native `machine_manager::execute()` loop creates a stack-local
`running_machine`, calls `run()`, examines `m_new_driver_pending` after that
call returns, updates the selected system and constructs the next machine on
the following loop iteration. MAME's existing Lua and game-selection paths
request that transition by calling `schedule_new_driver()` followed by
`schedule_hard_reset()`.

The Emscripten path does not return through that stack. During
`running_machine::run()` it calls:

```cpp
emscripten_set_main_loop(&js_main_loop, 0, 1);
```

With the pinned Emscripten 1.38.31 runtime, the final argument unwinds the C++
call stack with its `SimulateInfiniteLoop` mechanism. Later browser callbacks
invoke only `js_main_loop()`, which advances scheduler timeslices. The stock
callback does not test the running machine's exit or hard-reset flags and
cannot resume the abandoned `run()`/`execute()` frames.

## Reproducible probe

[`0002-emscripten-lifecycle-probe.patch`](../../../mame/probes/patches/0002-emscripten-lifecycle-probe.patch)
adds diagnostics without changing the lifecycle. On each browser callback it:

- reports the active machine and whether a scheduled event is pending;
- counts callbacks; and
- accepts a generic second-machine request through the same
  `schedule_new_driver()` plus `schedule_hard_reset()` sequence used by MAME.

The game-probe builder accepts the second short name only through
`secondMachine` in the ignored probe config, verifies that it is a different
entry already in the parent/clone build, and injects it into the ignored
generated artifact.
The tracked bridge and browser test contain no machine or ROM identity.

Run the browser check against a locally served two-machine artifact:

```sh
MAME_LIFECYCLE_PROBE_URL=http://127.0.0.1:8877/mamegame-probe.html \
  npm run test:browser
```

## Result

| Scenario | Observation |
| -------- | ----------- |
| Initial module | The first entry reached the browser loop with no lifecycle event pending. |
| Same-module request | MAME accepted the second-driver request. After 30 more browser callbacks, the old entry was still active, the event remained pending and the loop was still running without an exception. |
| Fresh-module control | A new page and module using the same artifact started the second compiled entry without an exception. |

The same-instance transition is therefore not merely unproven: it cannot
complete through the stock browser control flow. Calling the native scheduling
API leaves the module in a pending state while its JavaScript loop continues
to run the old `running_machine`.

## Decision

`MameEmulatorAdapter.start()` instantiates a new modularized build every time.
`exit()` waits for persistence and exit reporting, then discards the complete
module rather than attempting to call `main()` or select another driver on the
same instance. Reuse may be reconsidered only if the browser main loop is
rewritten as an explicit resumable lifecycle state machine and the full
teardown/start sequence receives a new runtime probe.
