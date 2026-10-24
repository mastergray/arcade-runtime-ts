# W29 merge note — coded fields, operator keys, cabinet volume and save support

## Delivered

- `mame/bridge/web_input.cpp` appends virtual-pad items 27–42 without
  changing indices 0–26: volume up/down, F1/F2/F5/F6 and digits 0–9 use
  `ITEM_ID_BUTTON16` through `ITEM_ID_BUTTON31`.
- `mame/bridge/web_bridge.cpp` performs one post-configuration pass over live
  fields. It excludes unused, unknown, special, custom, DIP and config fields;
  appends a unique field type/player sequence; appends the matching pad-1
  operator item for the supported field-owned key codes; avoids duplicate
  codes on a restored machine cfg; and writes changes through
  `set_user_settings`.
- `web_machine_info` now reports ordered, name/key-deduplicated `inputs.keys`,
  `inputs.volume` and `supportsSave`, while retaining the existing player,
  button, analogue and dual-stick discovery.
- The generated controller config binds `VOLUME_UP` to
  `JOYCODE_1_BUTTON16` and `VOLUME_DOWN` to `JOYCODE_1_BUTTON17`.
- The shared control vocabulary adds `key` and `volume`; `ArcadeInput`
  preserves them across every hold path; `MameSession` maps them to pad 0 and
  drops unavailable keys and volume controls; and the machine metadata guard
  accepts the new discovery fields and save flag.
- `KeyboardSource` passes F1/F2/F5/F6 and digits 0–9 through beside the page
  map by default, with `passthroughKeys: false` as the opt-out. `Equal` and
  `Minus` now map to cabinet volume up/down.
- `ArcadePlayer` rejects save and load with `UNSUPPORTED` before calling the
  session when the driver omits `GAME_SUPPORTS_SAVE`.
- The harness renders one operator button per discovered row, conditionally
  renders cabinet volume buttons, and disables quick save/load with the title
  `This driver cannot save in 0.161` when appropriate. Its production
  quick-save browser step conditionally skips with that reason.
- Native, shared-type, input, keyboard, adapter, player, harness and gated
  production-bridge contracts cover the additions. Fixture-only shape updates
  were also required in test 20 and browser tests 37–38 because
  `MachineInputs.keys`, `MachineInputs.volume` and `MachineInfo.supportsSave`
  are required rather than optional.
- `mame/patches/0001-web-osd-modules.patch` and
  `0002-web-bridge-exports.patch` were regenerated from a pristine pinned tree.
  Test 17 applies all three production patches and proves the final bridge
  files equal their review copies.

## Pinned-source findings

- `src/emu/ioport.c:1536–1551` shows that `ioport_field::seq()` uses the
  declaration before live state exists, returns an empty sequence for unused
  fields, expands a live default marker through `type_seq`, and otherwise
  returns the live sequence. `ioport.c:1560–1572` shows that `defseq()` only
  consults `type_seq` when the field declaration itself is the default marker.
- `ioport.c:1676–1703` copies the expanded live sequence into user settings.
  `ioport.c:1711–1734` stores a sequence equal to the type default back as the
  default marker and stores every other sequence verbatim.
- `ioport.c:2397–2400` allocates each port's live state, and
  `ioport.c:2412–2435` initializes every field's live state. The manager does
  this during `ioport_manager::initialize` at `ioport.c:2468–2535` before its
  configuration callbacks are registered.
- `src/emu/machine.c:218–245` initializes I/O during machine start.
  `machine.c:350–354` loads configuration, then `machine.c:364–371` initializes
  UI state and performs the initial reset. `src/emu/config.c:103–145` loads
  controller configuration first (`113–126`), defaults next (`128–132`), the
  machine cfg next (`134–137`), and then fires final callbacks (`139–141`).
  The patched call to `web_bridge_start` at
  `mame/patches/0002-web-bridge-exports.patch:92` is later, immediately before
  the native run loop would start. The rewrite therefore runs in
  `web_bridge_start`; a first-`web_run_frames` deferral is unnecessary.
- `src/emu/input.h:445–480` defines `input_seq` append, OR append, indexing,
  length and default-marker operations; their implementations at
  `src/emu/input.c:612–657` show the fixed 16-code capacity and OR insertion.
  The bridge checks capacity before each idempotent OR append.
- `src/emu/inpttype.h:486–487` defines volume down/up as digital `OTHER`
  types with Minus/Equals defaults. Its type macro at `inpttype.h:16–20`
  supplies the `VOLUME_DOWN` and `VOLUME_UP` controller tokens.
  `inpttype.h:700–760` lists UI defaults including Tab, Escape, F3, F5, F6,
  Minus, Equals, arrows and Enter. No keyboard device is added, so those UI
  and type-default keys remain inactive.
- Required driver declarations are at `src/mame/drivers/toobin.c:114–136`,
  `src/mame/drivers/williams.c:718–730`,
  `src/mame/drivers/qix.c:314–325`,
  `src/mame/drivers/midtunit.c:190–203` and
  `src/mame/drivers/midwunit.c:214–227`.

## Rebuilt artifacts

The prescribed unshimmed build reached the final Emscripten link, where the
pinned Node 8 process stopped with `ERR_UNKNOWN_STREAM_TYPE` under captured
stdio. The ignored `.cache/w29-bash-env.sh` and copied
`.cache/w29.emscripten` select host Node 22 for Emscripten's JavaScript
helpers only. The pinned C/C++ compiler, optimizer, Binaryen, source, flags
and build pipeline are unchanged.

| Family | Machines / romsets | JavaScript | Wasm | buildId |
| ------ | ------------------: | ---------: | ---: | ------- |
| `atari-gauntlet` | 34 / 34 | 302,199 bytes | 6,022,872 bytes | `d3886d3d0708fa6007b003717b92eb7a981703c65686001044642ba9f067196b` |
| `midway-mcr` | 100 / 100 | 303,075 bytes | 6,446,958 bytes | `66a8f9cee1049aad71598b4a4a414afeb88115e27867b67c515d772f1b072ea7` |

Each output has 14 notice files, fixed 4,096-page non-shared memory, no
worker/runtime marker and no pthread requirement. The full identities are
also recorded in the two requested `mame/builds/*.json` files and their
family probe records.

## Expected `inputs.keys` rows

The single ignored `atari-gauntlet` config selects a `toobin.c` machine. Its
field-owned codes fall outside the operator table, so the expected rows are:

```json
[]
```

Each of the two ignored `midway-mcr` configs selects a `williams.c` machine.
Both must report these rows in port order:

```json
[
  { "name": "Auto Up / Manual Down", "key": "F1", "player": 1 },
  { "name": "Advance", "key": "F2", "player": 1 },
  { "name": "High Score Reset", "key": "9", "player": 1 }
]
```

## Integrator-owned `src/index.ts`

Add these exports from `shared.types.js`:

- runtime predicate `isArcadeKeyName`;
- type `ArcadeKeyName`.

The already-exported `ArcadeControl`, `MachineInputs`, `MachineInfo`, their
predicates and `arcadeControlKey` carry their additive W29 behavior without
new export names.

## Integrator-owned specification amendments

- §2.1: add `ArcadeKeyName`, the `key` and `volume` control variants, and
  their `key:F1` / `volume:up` canonical forms.
- §2.2: add `inputs.keys`, `inputs.volume` and `supportsSave` to machine info.
- §4.2: append item rows 27–42 exactly as the W29 brief specifies.
- §4.3: document the `web_machine_info` additions and the one-time,
  idempotent coded-field rewrite after controller and machine cfg loading.
- §4.4: add the two unconditional volume rows. Replace the old keyboard
  sentence with: “No keyboard device exists, so MAME's UI and type-default
  key sequences never fire. A field's own `PORT_CODE` is reached through the
  operator-key items on virtual pad 1.”
- §6: include `key` and `volume` in all `ArcadeInput` hold, tap, release and
  snapshot rules.
- §9: specify the pre-session `GAME_SUPPORTS_SAVE` guard for save/load.
- §10.3: specify the default-on operator-key pass-through layer, its opt-out,
  and the Equal/Minus volume mappings.
- §11: specify the discovered operator row, conditional volume controls and
  disabled save controls.

## Commands and results

```sh
npm run check
```

Passed before the builds (`check:src` and `check:tests`).

```sh
npm test
```

The first run exposed the intermediate patch-2/patch-3 overlap during patch
regeneration; patch 2 was regenerated at its correct pre-patch-3 boundary and
test 17 then passed. Two diagnostic reruns also encountered the sandbox's
transient `spawnSync ... EPERM` and `listen EPERM` in pre-existing tests 19
and 26. The final unfiltered verification below passed every case.

```sh
EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 8
```

Compiled the family and failed only at the final link with pinned Node 8
`ERR_UNKNOWN_STREAM_TYPE`.

```sh
BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts atari-gauntlet --jobs 8

BASH_ENV="$PWD/.cache/w29-bash-env.sh" EMSDK_DIR="$PWD/res/emsdk" \
  node --import tsx scripts/build-mame.ts midway-mcr --jobs 8
```

Both passed with the machine counts, artifact sizes and identities in the
table above.

```sh
npm run probe:mame:threading -- \
  "$PWD/dist/mame/atari-gauntlet/mameatari-gauntlet"

npm run probe:mame:threading -- \
  "$PWD/dist/mame/midway-mcr/mamemidway-mcr"
```

Both passed: one imported fixed 4,096-page non-shared memory and no pthread
requirement.

```sh
npm run check && npm test
```

Passed in the final run: `TALLY files=30 cases=572 passed=572 failed=0
skipped=0`.

Patch regeneration used a temporary pristine copy, applied patch 1, replaced
the review `web_input.cpp`, emitted its `git diff --binary`, then applied the
original patch 2, replaced `web_bridge.cpp`, reversed only patch 3's bridge
hunk, and emitted the second `git diff --binary`. The temporary tree was
deleted after test 17 proved the resulting series.

The first combined Git staging/commit attempt for the build records was
refused before changing the index because the external worktree
`index.lock` was temporarily read-only. Separate `git add` and `git commit`
retries succeeded. Commits are `75475b4` and `da3b820` before this note.

## Pending integration-host evidence

Chromium and loopback listeners are unavailable in this sandbox, so no new
browser measurement is claimed. The gated browser-22 cases encode the
expected rows above and branch through the standard coded button or F2
operator item; the harness case encodes the operator row, volume buttons,
save-control guard and conditional quick-save skip.

The integrator still needs to run the three supplied ignored preloads and
confirm the W29 play/first-boot paths. The `qix.c` F1 first-boot path, DCS
Equal/Minus volume persistence, and a `leland.c` false save flag also remain
real-build browser checks because their families were outside the two builds
authorized for this package. No other implementation work is left undone.

No package build, clean, all-family build, fresh build, rebase or push command
was run.
