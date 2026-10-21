# W16 merge note — BIOS and DIP switches

## Delivered

- `-listxml` conversion now emits optional per-machine `dipswitches` metadata
  with switch names, tags, masks, named numeric values and default flags.
- `isRomSetMetadata` accepts older metadata without that field and, when it is
  present, requires unique case-folded switch names, one default per switch,
  unsigned 32-bit masks and values contained by their masks.
- The extractor retains every DIP field while disambiguating repeated human
  labels with tag/mask suffixes. It collapses condition-dependent duplicate
  `dipvalue` rows by numeric value because pinned `-listxml` omits the conditions
  and therefore exposes no additional cfg information for those duplicate rows.
- Internal `dipConfigFor` validates every requested switch and setting, emits a
  deterministic MAME 0.161 cfg in metadata order, restores the root-device colon
  stripped by `-listxml`, and omits unmentioned fields.
- `MameEmulatorAdapter` fetches metadata before module load, rejects unverifiable
  non-empty selections with `UNSUPPORTED`, writes the generated machine cfg
  after incoming overlay restore and before `callMain`, and excludes that
  generated cfg from dirty detection beside `cfg/web.cfg`.
- The existing player and cabinet already pass `dipswitches` unchanged; no W16
  edit was needed there.

## Integrator-owned lines

No `src/index.ts` line is needed. Section 16.3 declares `src/DipConfig/` internal,
and the existing root exports of `RomSetMetadata` and `isRomSetMetadata`
automatically expose the additive metadata field.

## Exact one-switch cfg

For synthetic machine `fake`, switch `Difficulty`, and selected setting
`Medium`, the generator emits exactly:

```xml
<?xml version="1.0"?>
<mameconfig version="10">
    <system name="fake">
        <input>
            <port tag=":DSWA" type="DIPSWITCH" mask="3" defvalue="3" value="0"/>
        </input>
    </system>
</mameconfig>
```

There is one final `\n` after `</mameconfig>`.

## Browser verification approach

`tests/browser/35-dip-switches.test.ts` is gated on the documented private
Namco-classic preload config. It reads the regenerated metadata at run time,
chooses `Difficulty` or `Lives`, and enables the machine's service-mode DIP so
the selected field is visible on a stable diagnostic screen. It runs three
fresh modules: default, repeat-default, and one non-default setting.

The test captures emulated-frame checkpoints 60, 120, 180 and 240 and compares
the upright active-screen interior from 5% through 95% on both axes. It requires
the two default runs to be byte-stable at every checkpoint and the changed run
to differ at one of those same stable checkpoints. Assertions return geometry
and comparison booleans only; no private machine, archive or path identity
leaves the local resource server.

## Metadata regeneration

The shared `dist/mame` link is read-only in this sandbox, so the first mandated
regeneration attempt stopped with `EROFS` while refreshing licence notices. A
writable disposable copy of the existing production artifacts was then used
with the same skip-build pipeline and configured SDK. It regenerated 378
Namco-classic romset documents; all 378 passed `isRomSetMetadata`, and the
private preload's document exposed both documented visible fields with unique
selection names. The disposable copy was removed and the original artifact
link restored.

The integrator should regenerate the served artifacts in their writable
location with:

```sh
node --import tsx scripts/build-mame.ts namco-classic --skip-build
```

## Verification

- `npm run check`: passed.
- `npm test`: passed (490 passed, 0 failed, 2 environment-gated skips).
- `ARCADE_PRELOAD_CONFIG=<private config> npm run test:browser`:
  attempted, but the sandbox refused every test page listener with
  `listen EPERM: operation not permitted 127.0.0.1` before Chromium could run.
  The integrator should rerun that exact command in an environment permitting
  loopback listeners.

There is one independent suite-integration issue with that exact browser
command: existing browser files 22, 27, 31 and 32 treat any non-Neo-Geo
`ARCADE_PRELOAD_CONFIG` as an import error instead of skipping a config for a
different family. Those files are outside the W16 write set. They need an
integrator-owned skip-on-family-mismatch adjustment for the full Namco-gated
browser command to pass; the W16 file already follows that behavior.

## Spec review

Two specification assumptions need clarification:

1. The W16 metadata paragraph requires names unique per machine and exactly one
   default per switch, but pinned 0.161 `-listxml` can repeat switch labels and
   can repeat condition-dependent `dipvalue` rows, including the default row.
   Because the XML omits the conditions, direct unnormalized extraction cannot
   satisfy the required predicate. W16 uses deterministic label
   disambiguation and numeric-value collapse as described above.
2. Section 12 M8 says a DIP change persists through the overlay, while W16
   deliverable 3 explicitly requires the generated machine cfg to be excluded
   from dirty detection. This implementation follows the package brief: the
   requested start selection is authoritative and the generated cfg is not
   serialized into `persist()`. If overlay-only DIP persistence is intended,
   one of those requirements must change.

The branch changes only the W16 write set, its assigned tests, and this merge
note. No private identity, hash or absolute path is tracked.
