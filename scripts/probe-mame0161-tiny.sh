#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-}"
emsdk_dir="${EMSDK_DIR:-${project_root}/res/emsdk}"
patch_file="${project_root}/mame/patches/0001-emscripten-1.38.31-compatibility.patch"
expected_emsdk="$(tr -d '[:space:]' < "${project_root}/mame/EMSDK_VERSION")"

if [[ -z "${source_dir}" || ! -f "${source_dir}/makefile" ]]; then
    echo "Usage: EMSDK_DIR=/path/to/emsdk $0 /path/to/mame0161-source" >&2
    exit 2
fi

if [[ ! -f "${emsdk_dir}/emsdk_env.sh" ]]; then
    echo "Missing emsdk environment: ${emsdk_dir}/emsdk_env.sh" >&2
    exit 2
fi

if patch --dry-run --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
    patch --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}"
elif ! patch --dry-run --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
    echo "MAME source is neither pristine nor already patched" >&2
    exit 2
fi

# Emscripten 1.38.31 invokes its Python entry points through `python`.
# The tracked shim selects Python 2 without modifying the installed SDK.
# shellcheck source=/dev/null
source "${emsdk_dir}/emsdk_env.sh" >/dev/null
export PATH="${project_root}/scripts/toolchain-shims:${PATH}"

if ! emcc --version 2>&1 | grep -Fq "${expected_emsdk}"; then
    echo "Expected Emscripten ${expected_emsdk}" >&2
    emcc --version >&2
    exit 2
fi

export EMSCRIPTEN="${emsdk_dir}/emscripten/${expected_emsdk}"

make -C "${source_dir}" -j2 \
    SUBTARGET=tiny \
    OSD=sdl \
    TARGETOS=asmjs \
    PYTHON_EXECUTABLE=python2 \
    REGENIE=1 \
    NOWERROR=1 \
    USE_BGFX=0 \
    NOASM=1 \
    FORCE_DRC_C_BACKEND=1 \
    NO_OPENGL=1 \
    NO_USE_MIDI=1 \
    DONT_USE_NETWORK=1 \
    asmjs

# The release's generated GNU Make project drops its stock post-build command,
# so perform the final WebAssembly link explicitly.
emcc -O2 \
    -s USE_SDL=2 \
    -s TOTAL_MEMORY=268435456 \
    --pre-js "${project_root}/mame/bridge/tiny-probe-pre.js" \
    "${source_dir}/mametiny.bc" \
    -o "${source_dir}/mametiny-probe.html"

echo "Built ${source_dir}/mametiny-probe.html"
