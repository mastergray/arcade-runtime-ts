#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-}"
emsdk_dir="${EMSDK_DIR:-${project_root}/res/emsdk}"
compatibility_patch="${project_root}/mame/patches/0001-emscripten-1.38.31-compatibility.patch"
lifecycle_probe_patch="${project_root}/mame/patches/0002-emscripten-lifecycle-probe.patch"
expected_emsdk="$(tr -d '[:space:]' < "${project_root}/mame/EMSDK_VERSION")"
probe_kind="${MAME_PROBE_KIND:-list}"
pre_js="${project_root}/mame/bridge/tiny-probe-pre.js"
output_name="mametiny-probe"
subtarget="tiny"
bitcode_name="mametiny.bc"
link_options=()
generated_pre_js=""

cleanup() {
    if [[ -n "${generated_pre_js}" ]]; then
        rm -f "${generated_pre_js}"
    fi
}
trap cleanup EXIT

if [[ -z "${source_dir}" || ! -f "${source_dir}/makefile" ]]; then
    echo "Usage: EMSDK_DIR=/path/to/emsdk $0 /path/to/mame0161-source" >&2
    exit 2
fi

if [[ ! -f "${emsdk_dir}/emsdk_env.sh" ]]; then
    echo "Missing emsdk environment: ${emsdk_dir}/emsdk_env.sh" >&2
    exit 2
fi

case "${probe_kind}" in
    list)
        ;;
    family)
        machine="${MAME_PROBE_MACHINE:-}"
        target_file="${MAME_PROBE_TARGET:-${project_root}/res/mame-runtimeprobe.lua}"
        output_name="${MAME_PROBE_OUTPUT:-mamefamily-probe}"
        shift

        if [[ ! "${machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "MAME_PROBE_MACHINE must be a non-empty MAME short name" >&2
            exit 2
        fi
        if [[ ! "${output_name}" =~ ^[a-z0-9_-]+$ ]]; then
            echo "MAME_PROBE_OUTPUT must be a safe artifact basename" >&2
            exit 2
        fi
        if [[ "$#" -ne 0 ]]; then
            echo "The family probe accepts only the MAME source path" >&2
            exit 2
        fi
        if [[ ! -f "${target_file}" ]]; then
            echo "Missing private local target definition: ${target_file}" >&2
            exit 2
        fi

        install -m 0644 \
            "${target_file}" \
            "${source_dir}/scripts/target/mame/runtimeprobe.lua"
        printf '%s\n' "${machine}" > "${source_dir}/src/mame/runtimeprobe.lst"

        output_name="${output_name}"
        subtarget="runtimeprobe"
        bitcode_name="mameruntimeprobe.bc"
        ;;
    game)
        machine="${MAME_PROBE_MACHINE:-}"
        parent="${MAME_PROBE_PARENT:-}"
        second_machine="${MAME_PROBE_SECOND_MACHINE:-}"
        target_file="${MAME_PROBE_TARGET:-${project_root}/res/mame-runtimeprobe.lua}"
        shift

        if [[ ! "${machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "MAME_PROBE_MACHINE must be a non-empty MAME short name" >&2
            exit 2
        fi
        if [[ -n "${parent}" && ! "${parent}" =~ ^[a-z0-9_]+$ ]]; then
            echo "MAME_PROBE_PARENT must be a MAME short name when supplied" >&2
            exit 2
        fi
        if [[ -n "${second_machine}" && ! "${second_machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "MAME_PROBE_SECOND_MACHINE must be a MAME short name when supplied" >&2
            exit 2
        fi
        if [[ "$#" -eq 0 ]]; then
            echo "The game probe requires local ROM archives after the source path" >&2
            exit 2
        fi
        if [[ ! -f "${target_file}" ]]; then
            echo "Missing private local target definition: ${target_file}" >&2
            exit 2
        fi

        declare -A required_archives=(["${machine}"]=0)
        drivers=("${machine}")
        if [[ -n "${parent}" ]]; then
            required_archives["${parent}"]=0
            drivers=("${parent}" "${machine}")
        fi
        if [[ -n "${second_machine}" ]]; then
            second_machine_in_build=0
            for driver in "${drivers[@]}"; do
                if [[ "${driver}" == "${second_machine}" ]]; then
                    second_machine_in_build=1
                fi
            done
            if [[ "${second_machine_in_build}" -ne 1 || "${second_machine}" == "${machine}" ]]; then
                echo "MAME_PROBE_SECOND_MACHINE must name a different compiled parent/clone entry" >&2
                exit 2
            fi
        fi

        for rom_archive in "$@"; do
            if [[ ! -f "${rom_archive}" ]]; then
                echo "Missing local ROM archive: ${rom_archive}" >&2
                exit 2
            fi
            archive_name="$(basename "${rom_archive}")"
            archive_driver="${archive_name%.zip}"
            if [[ "${archive_name}" == "${archive_driver}" || -z "${required_archives[${archive_driver}]+set}" ]]; then
                echo "Unexpected ROM archive for the selected local machine: ${archive_name}" >&2
                exit 2
            fi
            required_archives["${archive_driver}"]=1
            link_options+=(--preload-file "${rom_archive}@/roms/${archive_name}")
        done

        for driver in "${drivers[@]}"; do
            if [[ "${required_archives[${driver}]}" -ne 1 ]]; then
                echo "Missing required local ROM archive: ${driver}.zip" >&2
                exit 2
            fi
        done

        install -m 0644 \
            "${target_file}" \
            "${source_dir}/scripts/target/mame/runtimeprobe.lua"
        printf '%s\n' "${drivers[@]}" > "${source_dir}/src/mame/runtimeprobe.lst"

        generated_pre_js="$(mktemp)"
        printf 'var MAME_PROBE_MACHINE = "%s";\n' "${machine}" > "${generated_pre_js}"
        printf 'var MAME_PROBE_SECOND_MACHINE = "%s";\n' "${second_machine}" >> "${generated_pre_js}"
        pre_js="${project_root}/mame/bridge/game-probe-pre.js"
        output_name="mamegame-probe"
        subtarget="runtimeprobe"
        bitcode_name="mameruntimeprobe.bc"
        link_options=(--pre-js "${generated_pre_js}" "${link_options[@]}")
        ;;
    *)
        echo "Unknown MAME_PROBE_KIND: ${probe_kind} (expected list, family or game)" >&2
        exit 2
        ;;
esac

apply_source_patch() {
    local patch_file="$1"
    if patch --dry-run --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        patch --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}"
    elif ! patch --dry-run --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        echo "MAME source does not accept $(basename "${patch_file}")" >&2
        exit 2
    fi
}

remove_source_patch() {
    local patch_file="$1"
    if patch --dry-run --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        patch --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}"
    elif ! patch --dry-run --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        echo "MAME source does not accept $(basename "${patch_file}")" >&2
        exit 2
    fi
}

apply_source_patch "${compatibility_patch}"
if [[ "${probe_kind}" == "game" ]]; then
    apply_source_patch "${lifecycle_probe_patch}"
else
    remove_source_patch "${lifecycle_probe_patch}"
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

# The release-era archiver can retain a renamed duplicate member when a core
# object changes. Recreate the aggregate so the linker cannot select stale
# code from an earlier probe build.
rm -f "${source_dir}/build/asmjs/bin/libemu.a"

# Regenerated projects reuse these archive paths across private/family target
# definitions. Recreate them so a target switch cannot retain object membership
# from the previously selected driver source set.
if [[ "${subtarget}" == "runtimeprobe" ]]; then
    rm -f \
        "${source_dir}/build/asmjs/bin/mame_runtimeprobe/libbus.a" \
        "${source_dir}/build/asmjs/bin/mame_runtimeprobe/libdasm.a" \
        "${source_dir}/build/asmjs/bin/mame_runtimeprobe/libmame_runtimeprobe.a" \
        "${source_dir}/build/asmjs/bin/mame_runtimeprobe/liboptional.a" \
        "${source_dir}/${bitcode_name}"
fi

make -C "${source_dir}" -j2 \
    SUBTARGET="${subtarget}" \
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
    -s DISABLE_EXCEPTION_CATCHING=0 \
    "${link_options[@]}" \
    --pre-js "${pre_js}" \
    "${source_dir}/${bitcode_name}" \
    -o "${source_dir}/${output_name}.html"

echo "Built ${source_dir}/${output_name}.html"
