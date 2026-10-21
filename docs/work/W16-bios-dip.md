# W16 — BIOS selection and DIP switches

Lane: **TypeScript with a native rebuild for verification**.
Branch: `wp/w16-bios-dip`. Milestone: M8.

The bridge already reports BIOS options (`MachineInfo.bios`) and the adapter
already passes `-bios`; what remains is DIP switches end to end: metadata,
a cfg generator, the adapter writing it, and the player passing selections
through. Harness selectors are a separate follow-up after W13b merges.

## 1. Package row (§16.3)

| ID | Package | Owns | After | Spec | Lane | Milestone |
| -- | ------- | ---- | ----- | ---- | :--: | --------- |
| W16 | BIOS and DIP: `web_machine_info` BIOS fields, generated DIP cfg, harness selectors | `mame/bridge/web_bridge.cpp` (BIOS struct only), `src/DipConfig/`, `harness/` (selectors only) | W4, W13 | §4.5, §12 M8 | N+T | M8 |

For this package the write set is: `src/DipConfig/` (new), the DIP-switch
additions to `scripts/mame-build/romsets.ts` and `src/RomSetAudit/types.ts`
(metadata shape; additive only), the DIP cfg write in
`src/MameEmulatorAdapter/MameEmulatorAdapter.ts` (replace the current
`UNSUPPORTED` rejection of non-empty `dipswitches`), plus your tests:
`tests/spec/30-dip-config.test.ts`, additions to
`tests/spec/23-mame-adapter.test.ts` and `tests/spec/28-romsets-extract.test.ts`,
and `tests/browser/35-dip-switches.test.ts` (gated on `ARCADE_PRELOAD_CONFIG`).
`harness/` is **not** in this package (W13b owns it right now).

## 2. Spec sections to read first

`docs/arcade-runtime-spec.md` §0–§3, §16, then §4.5 (`dipswitches` written
into a generated cfg before start), §2.3 (`ArcadeStartConfig.dipswitches`
is `Record<portName, settingName>`), §9 and §10.6 (the field passes
through the player and cabinet unchanged), §10.5 (metadata is where a
page learns the switch names), §12 M8's acceptance row, §13.1 F7 and F10.

Facts from the pinned source, which you confirm: `-listxml` emits per
machine `<dipswitch name="Difficulty" tag="DSWA" mask="3">` with
`<dipvalue name="Easy" value="3" default="yes"/>` children. The cfg file
MAME reads at start (`src/emu/ioport.c`, `load_game_config` and
`save_game_config`) is

```xml
<?xml version="1.0"?>
<mameconfig version="10">
    <system name="example">
        <input>
            <port tag="DSWA" type="DIPSWITCH" mask="3" defvalue="3" value="0"/>
        </input>
    </system>
</mameconfig>
```

where `type` is the port type token (`DIPSWITCH`), `mask` and `defvalue`
must match the field, and `value` is the chosen `dipvalue`. The adapter
already starts MAME with `-cfg_directory /mame/cfg`, so the file is
`/mame/cfg/<machine>.cfg`. Note the tag MAME prints in `-listxml`
(`DSWA`) versus the tag it stores in cfg (which may carry a leading
colon, `:DSWA`); check `ioport.c` and use what `load_game_config`
compares against.

## 3. Deliverables

1. **Metadata.** `romsets.ts` emits `dipswitches: [{ name, tag, mask,
   values: [{ name, value, default }] }]` per machine from the `-listxml`
   elements; `RomSetMetadata` gains the optional field with a predicate
   (names unique per machine, exactly one default per switch, values
   within mask). Regenerating `dist/mame/<family>/romsets/` is part of
   your verification (`build-mame <family> --skip-build`).
2. **`DipConfig`** (internal, `src/DipConfig/dipConfigFor.ts`): a pure
   function `dipConfigFor(machine, metadata.dipswitches, selections)` →
   cfg XML text, where `selections` is the §2.3
   `Record<switchName, settingName>`. Unknown switch or setting names
   throw `INVALID_CONFIG` naming them; unmentioned switches are omitted
   (MAME keeps their defaults). Deterministic output with `\n`.
3. **Adapter.** When `dipswitches` is non-empty, fetch the machine's
   metadata (already done for the audit path), generate the cfg, write
   `/mame/cfg/<machine>.cfg` before `callMain`, and add it to the paths
   excluded from dirty detection alongside `cfg/web.cfg`. When metadata
   is unreachable and `dipswitches` is non-empty, reject with
   `UNSUPPORTED` saying the switch names cannot be validated.
4. **Tests.** Spec: metadata extraction over the synthetic XML with two
   switches; generator exact text; adapter writes the file and excludes
   it from the snapshot; unknown names reject. Browser (gated): start a
   title with a visible DIP effect (lives or difficulty on the attract
   or test screen) twice, once default and once changed, and show a
   pixel difference in a region you document, or, when no visible effect
   is reachable without play, confirm through `-listxml`-style readback
   that the live port value changed (the bridge's `web_machine_info` does
   not expose ports; a narrow diagnostic through `onLog` of the cfg load
   is acceptable). Say which approach you used.

## 4. Contracts and doubles

`src/shared.types.ts` is frozen; `dipswitches` is already in
`ArcadeStartConfig`. `FakeModuleLoader` for the adapter additions.

## 5. Definition of ready for review

`docs/work/README.md` rule 8, plus regenerated romsets for `namco-classic`
showing switches on a known title, and the gated browser case passing with
`<private config>` (ask the integrator for its presence; it names
a Namco classic with documented DIP switches).

## 6. Repository rules that bite here

- No private identity in tracked files; the browser test reads the
  preload config.
- Do not run `npm run build` or `npm run clean`; `build-mame --skip-build`
  only regenerates metadata.
- No attribution lines in commits.

## 7. Commands

```sh
npm install
npm run check && npm test
node --import tsx scripts/build-mame.ts namco-classic --skip-build
ARCADE_PRELOAD_CONFIG=<private config> npm run test:browser
```
