# Direct MAME build inputs

This directory owns the reproducible direct-MAME WebAssembly build. `VERSION`
pins the initial source release to `mame0161` so it can be compared with the
local native reference.

M0 records the exact source identity, licence files, compatible Emscripten SDK,
build commands and required patches here. `EMSDK_VERSION` pins the first SDK
that completed a clean `tiny` WebAssembly build and browser smoke run. The
ordered files in `patches/` adapt the pinned source without vendoring it.

The reproducible smoke command is:

```sh
EMSDK_DIR="$PWD/res/emsdk" npm run probe:mame:tiny -- \
  "$PWD/.cache/mame0161-source"
```

It applies the compatibility patch when needed, builds `mametiny.bc`, and
links `mametiny-probe.{html,js,wasm}`. The probe pre-JavaScript selects MAME's
ROM-free `-listfull` path; it is test harness code, not the runtime bridge.

The real-game M0 probe takes its target definition, machine, optional parent
and ROM archives only as private local inputs. The selected title is
deliberately not recorded in the repository. Store the target definition at
the ignored `res/mame-runtimeprobe.lua` path (or set `MAME_PROBE_TARGET`) and
build with the matching MAME short names and ignored archives:

```sh
MAME_PROBE_MACHINE=<machine> \
MAME_PROBE_PARENT=<parent-if-required> \
MAME_PROBE_SECOND_MACHINE=<different-parent-or-clone-if-testing-lifecycle> \
EMSDK_DIR="$PWD/res/emsdk" \
npm run probe:mame:game -- \
  "$PWD/.cache/mame0161-source" \
  "$PWD/res/<parent-if-required>.zip" \
  "$PWD/res/<machine>.zip"
```

This emits `mamegame-probe.{html,js,wasm,data}`. The `.data` file embeds the
ignored local ROMs for this probe and must not be published or committed.
When `MAME_PROBE_SECOND_MACHINE` names the other compiled parent/clone entry,
the same artifact can run the P4 lifecycle test. Set
`MAME_LIFECYCLE_PROBE_URL` to its served URL; the test requests an in-module
transition and boots the second entry in a separate fresh-module control.

For ROM-free driver-family size probes, choose one of the tracked definitions
under `mame/targets/` and supply a representative machine only through the
local environment:

```sh
MAME_PROBE_MACHINE=<local-machine> \
MAME_PROBE_TARGET="$PWD/mame/targets/<family>.lua" \
MAME_PROBE_OUTPUT=mamefamily-<family> \
EMSDK_DIR="$PWD/res/emsdk" \
npm run probe:mame:family -- "$PWD/.cache/mame0161-source"
```

The family probe runs `-listfull` and does not preload ROM content. Set
`MAME_FAMILY_PROBE_URL` and `MAME_FAMILY_PROBE_MACHINE` to exercise its generic
browser test.

Serve the source directory, then run the CTG browser case against the artifact:

```sh
python3 -m http.server 8877 --directory "$PWD/.cache/mame0161-source"
MAME_TINY_PROBE_URL=http://127.0.0.1:8877/mametiny-probe.html \
  npm run test:browser
```

Set `MAME_GAME_PROBE_URL` to the served `mamegame-probe.html` path to run the
private local-game browser case.

The repository does not compile or redistribute the native executable in
`res/`, and it does not vendor ROMs, SDK files, generated emulator artifacts,
or a MAME source checkout.
