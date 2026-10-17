# Direct MAME build inputs

This directory owns the reproducible direct-MAME WebAssembly build. `VERSION`
pins the initial source release to `mame0161` so it can be compared with the
local native reference.

M0 must determine and record the exact source identity, licence files,
compatible Emscripten SDK, build commands and required patches before those
inputs are added here. In particular, `EMSDK_VERSION` is intentionally absent
until probe P2 has evidence for a working version.

The repository does not compile or redistribute the native executable in
`res/`, and it does not vendor ROMs or a MAME source checkout.
