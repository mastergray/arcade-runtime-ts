#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir=""
emsdk_dir="${EMSDK_DIR:-${project_root}/res/emsdk}"
compatibility_patch="${project_root}/mame/patches/0001-emscripten-1.38.31-compatibility.patch"
no_mongoose_patch="${project_root}/mame/patches/0005-emscripten-disable-mongoose.patch"
lifecycle_probe_patch="${project_root}/mame/patches/0002-emscripten-lifecycle-probe.patch"
pacing_probe_patch="${project_root}/mame/patches/0003-emscripten-pacing-probe.patch"
bridge_hooks_probe_patch="${project_root}/mame/patches/0004-emscripten-bridge-hooks-probe.patch"
persistence_probe_patch="${project_root}/mame/patches/0006-emscripten-persistence-probe.patch"
video_probe_patch="${project_root}/mame/patches/0007-emscripten-video-probe.patch"
audio_probe_patch="${project_root}/mame/patches/0008-emscripten-audio-probe.patch"
audit_output_probe_patch="${project_root}/mame/patches/0009-emscripten-audit-output-probe.patch"
expected_emsdk="$(tr -d '[:space:]' < "${project_root}/mame/EMSDK_VERSION")"
probe_kind="${MAME_PROBE_KIND:-list}"
pre_js="${project_root}/mame/bridge/tiny-probe-pre.js"
output_name="mametiny-probe"
subtarget="tiny"
bitcode_name="mametiny.bc"
link_options=()
generated_pre_js=""
config_output=""

cleanup() {
    if [[ -n "${generated_pre_js}" ]]; then
        rm -f "${generated_pre_js}"
    fi
    if [[ -n "${config_output}" ]]; then
        rm -f "${config_output}"
    fi
}
trap cleanup EXIT

if [[ "${probe_kind}" == "list" ]]; then
    source_dir="${1:-}"
else
    config_file="${1:-}"
    if [[ -z "${config_file}" || "$#" -ne 1 ]]; then
        echo "Usage: $0 /path/to/private-probe.json" >&2
        exit 2
    fi
    if [[ ! -f "${config_file}" ]]; then
        echo "Missing private local probe config: ${config_file}" >&2
        exit 2
    fi

    config_output="$(mktemp)"
    node "${project_root}/scripts/read-mame-probe-config.js" \
        "${config_file}" "${probe_kind}" > "${config_output}"
    mapfile -d '' -t probe_config < "${config_output}"
    if [[ "${#probe_config[@]}" -lt 8 ]]; then
        echo "Private local probe config is incomplete" >&2
        exit 2
    fi

    source_dir="${probe_config[0]}"
    emsdk_dir="${probe_config[1]}"
    machine="${probe_config[2]}"
    parent="${probe_config[3]}"
    second_machine="${probe_config[4]}"
    sound="${probe_config[5]}"
    target_file="${probe_config[6]}"
    output_name="${probe_config[7]}"
    rom_archives=("${probe_config[@]:8}")
fi

if [[ -z "${source_dir}" || ! -f "${source_dir}/makefile" ]]; then
    echo "Missing MAME 0.161 source checkout: ${source_dir}" >&2
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
        if [[ ! "${machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "Probe machine must be a non-empty MAME short name" >&2
            exit 2
        fi
        if [[ ! "${output_name}" =~ ^[a-z0-9_-]+$ ]]; then
            echo "Probe output must be a safe artifact basename" >&2
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
        if [[ ! "${machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "Probe machine must be a non-empty MAME short name" >&2
            exit 2
        fi
        if [[ -n "${parent}" && ! "${parent}" =~ ^[a-z0-9_]+$ ]]; then
            echo "Probe parent must be a MAME short name when supplied" >&2
            exit 2
        fi
        if [[ -n "${second_machine}" && ! "${second_machine}" =~ ^[a-z0-9_]+$ ]]; then
            echo "Probe secondMachine must be a MAME short name when supplied" >&2
            exit 2
        fi
        if [[ ! "${output_name}" =~ ^[a-z0-9_-]+$ ]]; then
            echo "Probe output must be a safe artifact basename" >&2
            exit 2
        fi
        if [[ "${sound}" != "none" && "${sound}" != "js" ]]; then
            echo "Probe sound must be none or js" >&2
            exit 2
        fi
        if [[ "${#rom_archives[@]}" -eq 0 ]]; then
            echo "The game probe requires local ROM archives in its config" >&2
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
                echo "Probe secondMachine must name a different compiled parent/clone entry" >&2
                exit 2
            fi
        fi

        for rom_archive in "${rom_archives[@]}"; do
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
        printf 'var MAME_PROBE_PARENT = "%s";\n' "${parent}" >> "${generated_pre_js}"
        printf 'var MAME_PROBE_SECOND_MACHINE = "%s";\n' "${second_machine}" >> "${generated_pre_js}"
        printf 'var MAME_PROBE_SOUND = "%s";\n' "${sound}" >> "${generated_pre_js}"
        pre_js="${project_root}/mame/bridge/game-probe-pre.js"
        subtarget="runtimeprobe"
        bitcode_name="mameruntimeprobe.bc"
        link_options=(--pre-js "${generated_pre_js}" -lidbfs.js "${link_options[@]}")
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
    elif ! patch --dry-run --silent --reverse --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        echo "MAME source does not accept $(basename "${patch_file}")" >&2
        exit 2
    fi
}

remove_source_patch() {
    local patch_file="$1"
    if patch --dry-run --silent --reverse --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        patch --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}"
    elif ! patch --dry-run --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        echo "MAME source does not accept $(basename "${patch_file}")" >&2
        exit 2
    fi
}

remove_source_patch_if_applied() {
    local patch_file="$1"
    if patch --dry-run --silent --reverse --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        patch --silent --reverse --batch -p1 -d "${source_dir}" < "${patch_file}"
    fi
}

bridge_hooks_probe_is_applied() {
    grep -Fq 'probe_service_saveload()' "${source_dir}/src/emu/machine.h"
}

persistence_probe_is_applied() {
    grep -Fq 'probe_flush_nvram()' "${source_dir}/src/emu/machine.h"
}

video_probe_is_applied() {
    grep -Fq 'probe_render_rgba()' "${source_dir}/src/emu/video.h"
}

audio_probe_is_applied() {
    grep -Fq 'jsmess_update_audio_stream($0, $1, $2, $3)' \
        "${source_dir}/src/osd/modules/sound/js_sound.c"
}

audit_output_probe_is_applied() {
    grep -Fq 'JSMESS.auditOutputMessages' \
        "${source_dir}/src/osd/modules/lib/osdobj_common.c" \
        && grep -Fq 'JSMESS.frontendResult' "${source_dir}/src/emu/clifront.c"
}

apply_source_patch "${compatibility_patch}"
if [[ "${probe_kind}" == "game" ]]; then
    # The pacing probe is layered on the lifecycle probe and overlaps its
    # function context. When P7 is absent, peel P5 off before checking P4 and
    # restore the complete stack. An already-complete stack stays untouched so
    # the P7 header probe does not force an unnecessary broad rebuild.
    if ! bridge_hooks_probe_is_applied; then
        remove_source_patch_if_applied "${pacing_probe_patch}"
        apply_source_patch "${lifecycle_probe_patch}"
        apply_source_patch "${pacing_probe_patch}"
        apply_source_patch "${bridge_hooks_probe_patch}"
    fi
    if ! persistence_probe_is_applied; then
        apply_source_patch "${persistence_probe_patch}"
    fi
    if ! video_probe_is_applied; then
        apply_source_patch "${video_probe_patch}"
    fi
    if ! audio_probe_is_applied; then
        apply_source_patch "${audio_probe_patch}"
    fi
    if ! audit_output_probe_is_applied; then
        apply_source_patch "${audit_output_probe_patch}"
    fi
else
    remove_source_patch "${audit_output_probe_patch}"
    remove_source_patch "${audio_probe_patch}"
    remove_source_patch "${video_probe_patch}"
    remove_source_patch "${persistence_probe_patch}"
    remove_source_patch "${bridge_hooks_probe_patch}"
    remove_source_patch "${pacing_probe_patch}"
    remove_source_patch "${lifecycle_probe_patch}"
fi
apply_source_patch "${no_mongoose_patch}"

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
