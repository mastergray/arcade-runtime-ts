# Direct MAME build inputs

This directory owns the reproducible direct-MAME WebAssembly build. `VERSION`
pins the initial source release to `mame0161` so it can be compared with the
source-built native baseline.

M0 records the exact source identity, licence files, compatible Emscripten SDK,
build commands and required patches here. `EMSDK_VERSION` pins the first SDK
that completed a clean `tiny` WebAssembly build and browser smoke run. The
ordered files in `patches/` adapt the pinned source without vendoring it.

The reproducible smoke command is:

```sh
EMSDK_DIR="$PWD/res/emsdk" npm run probe:mame:tiny -- \
  "$PWD/.cache/mame0161-source"
```

It applies the compatibility and browser-only Mongoose-removal patches when
needed, builds `mametiny.bc`, and links `mametiny-probe.{html,js,wasm}`. The
probe pre-JavaScript selects MAME's ROM-free `-listfull` path; it is test
harness code, not the runtime bridge.

The real-game M0 probe takes its source, target definition, machine, optional
parent and ROM archives from one ignored local JSON file. The selected title
is deliberately not recorded in the repository. Paths are resolved relative
to the config file. A config under ignored `res/` has this shape:

```json
{
  "source": "../.cache/mame0161-source",
  "emsdk": "emsdk",
  "machine": "<machine>",
  "parent": "<parent-if-required>",
  "secondMachine": "<different-parent-or-clone-if-testing-lifecycle>",
  "sound": "none",
  "target": "mame-runtimeprobe.lua",
  "output": "mamegame-probe",
  "roms": ["<parent-if-required>.zip", "<machine>.zip"]
}
```

Build it with one argument:

```sh
npm run probe:mame:game -- "$PWD/res/mame-probe.json"
```

This emits `mamegame-probe.{html,js,wasm,data}` by default. The `.data` file embeds the
ignored local ROMs for this probe and must not be published or committed.
When `secondMachine` names the other compiled parent/clone entry,
the same artifact can run the P4 lifecycle test. Set
`MAME_LIFECYCLE_PROBE_URL` to its served URL; the test requests an in-module
transition and boots the second entry in a separate fresh-module control.

For ROM-free driver-family size probes, choose one tracked definition under
`mame/targets/` in another ignored config (the `parent`, `secondMachine`,
`sound`, and `roms` fields may be omitted):

```json
{
  "source": "../.cache/mame0161-source",
  "emsdk": "emsdk",
  "machine": "<local-machine>",
  "target": "../mame/targets/<family>.lua",
  "output": "mamefamily-<family>"
}
```

```sh
npm run probe:mame:family -- "$PWD/res/mame-family-probe.json"
```

The family probe runs `-listfull` and does not preload ROM content. Set
`MAME_FAMILY_PROBE_URL` and `MAME_FAMILY_PROBE_MACHINE` to exercise its generic
browser test.

Inspect generated JavaScript/WebAssembly pairs for PThread requirements by
passing artifact stems without extensions:

```sh
npm run probe:mame:threading -- \
  "$PWD/.cache/mame0161-source/mametiny-probe" \
  "$PWD/.cache/mame0161-source/mamefamily-<family>"
```

The inspector reports Wasm memory limits, threaded-loader markers and worker
artifacts, and exits non-zero when the artifact requires pthreads.

Serve the source directory, then run the CTG browser case against the artifact:

```sh
python3 -m http.server 8877 --directory "$PWD/.cache/mame0161-source"
MAME_TINY_PROBE_URL=http://127.0.0.1:8877/mametiny-probe.html \
  npm run test:browser
```

Set `MAME_GAME_PROBE_URL` to the served `mamegame-probe.html` path to run the
private local-game browser case.

Set `MAME_THREADING_PROBE_URL` to the ROM-free `mametiny-probe.html` path to
verify that it instantiates without shared memory, COOP or COEP headers.

For P5, build the same private fixture under a separate generic basename by
setting `"output": "mamepacing-probe"` in its ignored config. Set
`MAME_PACING_PROBE_URL` to
its served HTML path. The browser test replays controlled 60, 90, 120 and 144
Hz callback cadences and compares wall time with scheduler time and screen
frames; generated artifacts and local ROM inputs remain ignored.

For P7, set `"sound": "js"` and use another generic output basename such as
`mamehooks-probe`. Set `MAME_HOOKS_PROBE_URL` to its served HTML path. The
browser probe observes frame and audio callbacks, SDL input state, lifecycle
notifications, scheduled state-operation results and the stock browser loop's
pause/exit behavior. It also verifies save, continued execution, load, time
rewind and continued execution. These probe-only hooks do not define the
production web bridge API.

The repository does not redistribute prebuilt executables from `res/`, and it
does not vendor ROMs, SDK files, generated emulator artifacts or a MAME source
checkout.
