#!/bin/bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config_file="${1:-}"

if [[ -z "${config_file}" || "$#" -ne 1 || ! -f "${config_file}" ]]; then
    echo "Usage: $0 /path/to/private-probe.json" >&2
    exit 2
fi

config_output="$(mktemp)"
run_root="$(mktemp -d)"
native_log="${run_root}/native.log"
cleanup() {
    rm -f "${config_output}"
    if [[ "${run_root}" == /tmp/tmp.* && -d "${run_root}" ]]; then
        rm -rf "${run_root}"
    fi
}
trap cleanup EXIT

node "${project_root}/scripts/read-mame-probe-config.js" \
    "${config_file}" native-parity > "${config_output}"
mapfile -d '' -t probe_config < "${config_output}"
if [[ "${#probe_config[@]}" -lt 10 ]]; then
    echo "Private local parity config is incomplete" >&2
    exit 2
fi

source_dir="${probe_config[0]}"
machine="${probe_config[2]}"
parent="${probe_config[3]}"
target_file="${probe_config[6]}"
native_result="${probe_config[8]}"
rom_archives=("${probe_config[@]:9}")

if [[ ! -f "${source_dir}/makefile" || ! -f "${target_file}" ]]; then
    echo "Missing MAME source checkout or target definition" >&2
    exit 2
fi
if [[ ! "${machine}" =~ ^[a-z0-9_]+$ ]]; then
    echo "Probe machine must be a non-empty MAME short name" >&2
    exit 2
fi
if [[ -n "${parent}" && ! "${parent}" =~ ^[a-z0-9_]+$ ]]; then
    echo "Probe parent must be a MAME short name when supplied" >&2
    exit 2
fi
if [[ "${#rom_archives[@]}" -eq 0 ]]; then
    echo "The native parity probe requires local ROM archives" >&2
    exit 2
fi

drivers=("${machine}")
if [[ -n "${parent}" ]]; then
    drivers=("${parent}" "${machine}")
fi

mkdir -p "${run_root}/roms" "${run_root}/cfg" "${run_root}/nvram"
for rom_archive in "${rom_archives[@]}"; do
    if [[ ! -f "${rom_archive}" ]]; then
        echo "Missing local ROM archive: ${rom_archive}" >&2
        exit 2
    fi
    ln -s "${rom_archive}" "${run_root}/roms/$(basename "${rom_archive}")"
done

install -m 0644 "${target_file}" "${source_dir}/scripts/target/mame/runtimeprobe.lua"
printf '%s\n' "${drivers[@]}" > "${source_dir}/src/mame/runtimeprobe.lst"

apply_source_patch() {
    local patch_file="$1"
    if patch --dry-run --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        patch --silent --forward --batch -p1 -d "${source_dir}" < "${patch_file}"
    elif ! patch --dry-run --silent --reverse --forward --batch -p1 -d "${source_dir}" < "${patch_file}" >/dev/null 2>&1; then
        echo "MAME source does not accept $(basename "${patch_file}")" >&2
        exit 2
    fi
}

apply_unless_marked() {
    local patch_name="$1"
    local marker_file="$2"
    local marker="$3"
    if ! grep -Fq "${marker}" "${source_dir}/${marker_file}"; then
        apply_source_patch "${project_root}/mame/patches/${patch_name}"
    fi
}

apply_unless_marked 0001-emscripten-1.38.31-compatibility.patch \
    scripts/src/osd/sdl.lua 'BASE_TARGETOS=="unix" and _OPTIONS["targetos"]~="macosx" and _OPTIONS["targetos"]~="asmjs"'
apply_unless_marked 0002-emscripten-lifecycle-probe.patch \
    src/emu/machine.c 'JSMESS.currentMachineName'
apply_unless_marked 0003-emscripten-pacing-probe.patch \
    src/emu/machine.c 'callbackIntervalTotalMs'
apply_unless_marked 0004-emscripten-bridge-hooks-probe.patch \
    src/emu/machine.h 'probe_service_saveload()'
apply_unless_marked 0006-emscripten-persistence-probe.patch \
    src/emu/machine.h 'probe_flush_nvram()'
apply_unless_marked 0007-emscripten-video-probe.patch \
    src/emu/video.h 'probe_render_rgba()'
apply_unless_marked 0008-emscripten-audio-probe.patch \
    src/osd/modules/sound/js_sound.c 'jsmess_update_audio_stream($0, $1, $2, $3)'
apply_unless_marked 0009-emscripten-audit-output-probe.patch \
    src/emu/clifront.c 'JSMESS.frontendResult'
if ! grep -Fq 'probe_parity_frame' "${source_dir}/src/emu/video.c" \
    || ! grep -Fq 'virtual osd_font *font_alloc() { return NULL; }' \
        "${source_dir}/src/osd/osdmini/osdmini.h" \
    || ! grep -Fq 'm_samples = samples == NULL ? NULL : samples->base();' \
        "${source_dir}/src/mame/audio/m72.c"; then
    apply_source_patch "${project_root}/mame/patches/0010-native-browser-parity-probe.patch"
fi
apply_unless_marked 0005-emscripten-disable-mongoose.patch \
    src/emu/webengine.c 'void web_engine::push_message(const char *message) { (void)message; }'

native_bin_dir="${source_dir}/build/linux_gcc/bin/x64/Release/mame_runtimeprobe"
allocation_flag_stamp="${source_dir}/build/linux_gcc/.p12-no-mem-tracking"
rm -f \
    "${native_bin_dir}/libbus.a" \
    "${native_bin_dir}/libdasm.a" \
    "${native_bin_dir}/libmame_runtimeprobe.a" \
    "${native_bin_dir}/liboptional.a" \
    "${source_dir}/mameruntimeprobe64"

# The release's inline allocation tracker is incompatible with the much newer
# host C++ runtime.  A clean native object set is required once because Make
# does not treat a changed command-line preprocessor flag as a dependency.
if [[ ! -f "${allocation_flag_stamp}" ]]; then
    make -C "${source_dir}" \
        SUBTARGET=runtimeprobe \
        OSD=osdmini \
        NOWERROR=1 \
        PYTHON_EXECUTABLE=python2 \
        REGENIE=1 \
        USE_BGFX=0 \
        CPPFLAGS=-DNO_MEM_TRACKING \
        LDOPTS='-pthread -Wl,--no-as-needed /lib/x86_64-linux-gnu/libportmidi.so.0' \
        clean
fi

make -C "${source_dir}" -j2 \
    SUBTARGET=runtimeprobe \
    OSD=osdmini \
    NOWERROR=1 \
    PYTHON_EXECUTABLE=python2 \
    REGENIE=1 \
    USE_BGFX=0 \
    CPPFLAGS=-DNO_MEM_TRACKING \
    LDOPTS='-pthread -Wl,--no-as-needed /lib/x86_64-linux-gnu/libportmidi.so.0'
touch "${allocation_flag_stamp}"

native_executable="${source_dir}/mameruntimeprobe64"
if [[ ! -x "${native_executable}" ]]; then
    echo "Native parity executable was not produced: ${native_executable}" >&2
    exit 2
fi

if ! timeout --signal=TERM --kill-after=2s 60s \
    "${native_executable}" "${machine}" \
    -rompath "${run_root}/roms" \
    -video none \
    -sound none \
    -nothrottle \
    -seconds_to_run 5 \
    -skip_gameinfo \
    -cfg_directory "${run_root}/cfg" \
    -nvram_directory "${run_root}/nvram" > "${native_log}" 2>&1; then
    tail -80 "${native_log}" >&2
    exit 2
fi

node "${project_root}/scripts/write-mame-parity-result.js" \
    "${native_log}" "${native_result}"
echo "Wrote native parity result to ${native_result}"
