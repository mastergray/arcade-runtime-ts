# P1: source-built native CLI baseline

Observed 2026-10-17 from the extracted 0.161 source package. This is a native
Linux `tiny`-subtarget baseline, not yet a comparison against the supplied
Windows reference.

## Build

The host compiler is GCC/G++ 9.4.0. The successful incremental build command
was:

```sh
make -j2 SUBTARGET=tiny OSD=osdmini NOWERROR=1 \
  PYTHON_EXECUTABLE=python2 REGENIE=1 USE_BGFX=0 \
  LDOPTS='-pthread -Wl,--no-as-needed /lib/x86_64-linux-gnu/libportmidi.so.0'
```

The resulting ignored `mametiny64` executable is 10,876,864 bytes. Earlier
attempts established these host-specific requirements:

- the unqualified `python` default fails because this host exposes only
  `python2` and `python3`;
- default BGFX compilation fails because native OpenGL development headers are
  absent;
- `NO_OPENGL=1` and `NO_USE_MIDI=1` are not registered options for the
  `osdmini` script in this release;
- the minimal OSD link omits pthread and PortMidi even though its selected
  objects use them, hence the explicit native-only `LDOPTS`.

This proves the packaged source and bundled `tiny` definition can compile with
a newer host compiler. It does not prove Emscripten compatibility.

## Metadata commands

All four required commands exited with status 0:

```sh
./mametiny64 -help
./mametiny64 -listfull
./mametiny64 -listsource
./mametiny64 -listxml
```

The outputs agree on the source-built release and subset:

| Evidence | Result |
| -------- | ------ |
| Help banner | `M.A.M.E. v0.161 (Oct 17 2026)` |
| `-listfull` | 25 unique runnable driver names |
| `-listsource` | 25 unique driver-to-source mappings |
| `-listxml` root | `build="0.161 (Oct 17 2026)"`, `mameconfig="10"` |
| Parsed XML | 58 entries: 25 runnable games and 33 non-runnable devices |

The 25 runnable names are:

```text
alienar carpolo circus crash fax fax2 fireone gridlee hardhat looping
ripcord robby robotbwl sidetrac spectar starfir2 starfire starfirea
supertnk targ teetert topgunnr victorba victory wrally
```

Their source mappings are:

| Source file | Drivers |
| ----------- | ------- |
| `astrocde.c` | `robby` |
| `carpolo.c` | `carpolo` |
| `circus.c` | `circus`, `crash`, `ripcord`, `robotbwl` |
| `exidy.c` | `fax`, `fax2`, `hardhat`, `sidetrac`, `spectar`, `targ`, `teetert` |
| `gridlee.c` | `gridlee` |
| `looping.c` | `looping` |
| `starfire.c` | `fireone`, `starfir2`, `starfire`, `starfirea` |
| `supertnk.c` | `supertnk` |
| `vertigo.c` | `topgunnr` |
| `victory.c` | `victorba`, `victory` |
| `williams.c` | `alienar` |
| `wrally.c` | `wrally` |

## Compiler-age diagnostic

Each command also emits `attempt to free untracked memory` diagnostics on
stderr: 92 lines for each of `-help`, `-listfull` and `-listsource`, and 2,182
lines for `-listxml`. Stdout remains complete (`-listxml` parses successfully)
and every command returns zero. The messages come from 0.161's allocation
tracker when built with this much newer compiler/runtime and must not be
silently treated as clean native behavior. They are a compatibility warning to
recheck under the eventual pinned Emscripten toolchain and, if necessary, with
a minimal allocator patch.

## Remaining comparison

P1 remains partial until the same commands can run against the 0.161 Windows
reference and the local source package is authenticated against the pinned tag
tree or an independently published official checksum. The future browser
module must then reproduce the same release, 25-name subset and source/XML
relationships.
