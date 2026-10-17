# Initial probe environment

Observed 2026-10-17 in the project workspace.

## Host

| Item | Observed value |
| ---- | -------------- |
| OS | Ubuntu 20.04-derived x86-64 userspace |
| Kernel | `5.17.5-76051705-generic` |
| Node.js | `v22.22.2` |
| npm | `10.9.7` |
| Git | `2.25.1` |

## Build and reference tools

| Tool or capability | Status |
| ------------------ | ------ |
| `emcc`, `emmake` | Emscripten 1.38.31 Fastcomp installed locally under ignored `res/emsdk/` |
| Wine | Not installed; the Windows reference cannot yet run here |
| Docker client | Installed |
| Docker daemon | Unavailable to the workspace user through its Unix socket |
| 7-Zip CLI | Not installed |
| Python `py7zr` | Installed, but cannot decode the archive's BCJ2-compressed executable member |
| libarchive | Runtime library present; sufficient for local inspection of selected archive members |
| MAME 0.161 source package | Present as an ignored local input; both zip layers pass archive integrity checks |
| Extracted source | Present under ignored `.cache/mame0161-source/` |
| Native compiler | GCC/G++ and GNU Make installed |
| Python | Python 2 and Python 3 installed; no unversioned `python` command |
| Native SDL development files | Not installed; the source's minimal OSD can be used for CLI probes |
| Emscripten Python/Node | Python 2.7.18 compatibility shim; SDK-bundled Node v8.9.1 |
| Browser | System Google Chrome, driven headlessly through Playwright |

## Consequence

P1 can inspect the official source package locally. A source-built minimal-OSD
CLI baseline succeeded after disabling BGFX and supplying the minimal target's
otherwise omitted native link dependencies:

```sh
make -j2 SUBTARGET=tiny OSD=osdmini NOWERROR=1 \
  PYTHON_EXECUTABLE=python2 REGENIE=1 USE_BGFX=0 \
  LDOPTS='-pthread -Wl,--no-as-needed /lib/x86_64-linux-gnu/libportmidi.so.0'
```

The explicit Python setting is required because the 0.161 makefile defaults
to the missing `python` command. The PortMidi path is host-specific and is
only part of this native probe; it is not a proposed browser-build flag.

P2 subsequently installed and pinned Emscripten 1.38.31. The old SDK invokes
`python` but requires Python 2 for this release-era driver, so the repository's
probe script prepends a tracked `python` shim rather than modifying the host or
SDK. Its SDL2 port cache and all generated outputs remain ignored local data.

At the successful clean build, the filesystem had 19 GiB free. The build used
76 MiB under `build/asmjs`, peaked at about 370 MiB RSS during compilation and
about 896 MiB during the final link. The probe therefore does not require the
large free-space estimate associated with a full multi-family MAME build.
