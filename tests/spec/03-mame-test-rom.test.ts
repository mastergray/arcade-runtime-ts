// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P12 private local fixture

// Dependencies:
import { readFileSync } from "node:fs";                          // Reads the generic local-probe contracts
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const PACKAGE_URL = new URL("../../package.json", import.meta.url);
const PROBE_SCRIPT_URL = new URL("../../scripts/probe-mame0161-tiny.sh", import.meta.url);
const CONFIG_READER_URL = new URL("../../scripts/read-mame-probe-config.js", import.meta.url);
const PRE_JS_URL = new URL("../../mame/bridge/game-probe-pre.js", import.meta.url);
const LIFECYCLE_PATCH_URL = new URL("../../mame/patches/0002-emscripten-lifecycle-probe.patch", import.meta.url);
const PACING_PATCH_URL = new URL("../../mame/patches/0003-emscripten-pacing-probe.patch", import.meta.url);
const BRIDGE_HOOKS_PATCH_URL = new URL("../../mame/patches/0004-emscripten-bridge-hooks-probe.patch", import.meta.url);
const PERSISTENCE_PATCH_URL = new URL("../../mame/patches/0006-emscripten-persistence-probe.patch", import.meta.url);
const VIDEO_PATCH_URL = new URL("../../mame/patches/0007-emscripten-video-probe.patch", import.meta.url);
const AUDIO_PATCH_URL = new URL("../../mame/patches/0008-emscripten-audio-probe.patch", import.meta.url);
const AUDIT_PATCH_URL = new URL("../../mame/patches/0009-emscripten-audit-output-probe.patch", import.meta.url);
const PARITY_PATCH_URL = new URL("../../mame/patches/0010-native-browser-parity-probe.patch", import.meta.url);
const NATIVE_PARITY_SCRIPT_URL = new URL("../../scripts/probe-mame0161-native-parity.sh", import.meta.url);
const PARITY_RESULT_WRITER_URL = new URL("../../scripts/write-mame-parity-result.js", import.meta.url);
const PARITY_BROWSER_TEST_URL = new URL("../browser/11-mame-parity-probe.test.ts", import.meta.url);

const readText = (url: URL): string => readFileSync(url, "utf8");

const testFile: TestFile = {
    label: "MAME 0.161 private local-game probe",
    cases: [
        {
            label: "keeps the selected machine and ROM paths out of tracked configuration",
            run: () => CTGTest.init("private fixture inputs")
                .assert(
                    "the package exposes only a generic game-probe command",
                    () => {
                        const packageJson = JSON.parse(readText(PACKAGE_URL)) as { scripts: Record<string, string> };
                        return [
                            packageJson.scripts["probe:mame:family"] ?? "",
                            packageJson.scripts["probe:mame:game"] ?? "",
                        ].join("\n");
                    },
                    P.equals([
                        "MAME_PROBE_KIND=family scripts/probe-mame0161-tiny.sh",
                        "MAME_PROBE_KIND=game scripts/probe-mame0161-tiny.sh",
                    ].join("\n")),
                )
                .start(undefined),
        },
        {
            label: "accepts the machine, parent and archives through one local config",
            run: () => CTGTest.init("local probe contract")
                .assert(
                    "the probe reads a private JSON config instead of many environment variables",
                    () => {
                        const build = readText(PROBE_SCRIPT_URL);
                        const reader = readText(CONFIG_READER_URL);
                        return build.includes("read-mame-probe-config.js")
                            && reader.includes('stringValue("machine")')
                            && reader.includes('stringValue("parent")')
                            && reader.includes('stringValue("secondMachine")')
                            && reader.includes('stringValue("sound", "none")')
                            && reader.includes("parsed.roms")
                            && build.includes("Missing local ROM archive")
                            && build.includes("--preload-file");
                    },
                    P.equals(true),
                )
                .assert(
                    "the tracked bridge stays machine-neutral",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        return preJs.includes("MAME_PROBE_MACHINE")
                            && preJs.includes('"-rompath", "/roms"')
                            && preJs.includes('"-sound", MAME_PROBE_SOUND');
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps the two-machine lifecycle diagnostics generic",
            run: () => CTGTest.init("private lifecycle probe contract")
                .assert(
                    "the bridge selects the local second entry symbolically",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        return preJs.includes("MAME_PROBE_SECOND_MACHINE")
                            && preJs.includes('mame_probe_machine") === "second"')
                            && preJs.includes("scheduleMachine");
                    },
                    P.equals(true),
                )
                .assert(
                    "the source patch instruments the stock new-driver path",
                    () => {
                        const patch = readText(LIFECYCLE_PATCH_URL);
                        return patch.includes("schedule_new_driver")
                            && patch.includes("schedule_hard_reset")
                            && patch.includes("scheduled_event_pending")
                            && patch.includes("mainLoopTicks");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps frame-pacing instrumentation generic and observational",
            run: () => CTGTest.init("private pacing probe contract")
                .assert(
                    "the source patch measures without replacing stock pacing",
                    () => {
                        const patch = readText(PACING_PATCH_URL);
                        return patch.includes("callbackIntervalTotalMs")
                            && patch.includes("callbackWorkTotalMs")
                            && patch.includes("emulatedTimeUs")
                            && patch.includes("screenFrameNumber")
                            && patch.includes("refreshMilliHz")
                            && patch.includes("speedPermille")
                            && !patch.includes("emscripten_set_main_loop");
                    },
                    P.equals(true),
                )
                .assert(
                    "the browser bridge exposes a controlled generic cadence",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        return preJs.includes("mame_probe_hz")
                            && preJs.includes("requestAnimationFrame")
                            && preJs.includes("pacingSnapshot");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps bridge-hook instrumentation narrow and observational",
            run: () => CTGTest.init("private bridge-hook probe contract")
                .assert(
                    "the source patch exercises running-machine hooks without replacing the loop",
                    () => {
                        const patch = readText(BRIDGE_HOOKS_PATCH_URL);
                        return patch.includes("machineNotifications")
                            && patch.includes("schedule_soft_reset")
                            && patch.includes("schedule_save")
                            && patch.includes("schedule_load")
                            && patch.includes("probe_service_saveload")
                            && patch.includes("schedule_exit")
                            && patch.includes("type_pressed")
                            && patch.includes("@@ -690,0 +694 @@\n+#endif")
                            && !patch.includes("emscripten_set_main_loop");
                    },
                    P.equals(true),
                )
                .assert(
                    "the browser bridge exposes generic hook and sound observations",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        return preJs.includes("requestHook")
                            && preJs.includes("audioCallbackCount")
                            && preJs.includes("MAME_PROBE_SOUND");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "exposes a generic mid-run persistence probe",
            run: () => CTGTest.init("private persistence probe contract")
                .assert(
                    "the core owns NVRAM filename selection and serialization",
                    () => {
                        const patch = readText(PERSISTENCE_PATCH_URL);
                        return patch.includes("probe_flush_nvram")
                            && patch.includes("nvram_save()")
                            && patch.includes("persistenceNvramDeviceCount")
                            && !patch.includes("config_save_settings(*this)");
                    },
                    P.equals(true),
                )
                .assert(
                    "the browser bridge hydrates and syncs an IDBFS mount",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        const build = readText(PROBE_SCRIPT_URL);
                        return preJs.includes("mame_probe_persistence")
                            && preJs.includes("FS.mount(IDBFS")
                            && preJs.includes("FS.syncfs(true")
                            && preJs.includes("syncPersistence")
                            && build.includes("-lidbfs.js")
                            && build.includes("persistence_probe_is_applied")
                            && build.includes('apply_source_patch "${persistence_probe_patch}"');
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "measures a production-shaped upright RGBA video path",
            run: () => CTGTest.init("private video probe contract")
                .assert(
                    "the core rasterizes its native target before explicit RGBA conversion",
                    () => {
                        const patch = readText(VIDEO_PATCH_URL);
                        return patch.includes("create_snapshot_bitmap(screen)")
                            && patch.includes("sourceFormat = \"RGB32\"")
                            && patch.includes("sourceMemoryOrder = \"BGRX\"")
                            && patch.includes("outputFormat = \"RGBA8888\"")
                            && patch.includes("rotationPreservesPixels")
                            && patch.includes("conversionUs")
                            && patch.includes("rasterUs");
                    },
                    P.equals(true),
                )
                .assert(
                    "the browser bridge exposes only a generic capture command",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        const build = readText(PROBE_SCRIPT_URL);
                        return preJs.includes("captureVideo: 8")
                            && preJs.includes("resetVideoProbe")
                            && build.includes("video_probe_is_applied")
                            && build.includes('apply_source_patch "${video_probe_patch}"')
                            && build.includes('remove_source_patch "${video_probe_patch}"');
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "measures the stock 48 kHz stereo mixer boundary",
            run: () => CTGTest.init("private audio probe contract")
                .assert(
                    "the source patch reports native mixer facts with each callback",
                    () => {
                        const patch = readText(AUDIO_PATCH_URL);
                        return patch.includes("sample_rate()")
                            && patch.includes("is_throttled")
                            && patch.includes("jsmess_update_audio_stream($0, $1, $2, $3)");
                    },
                    P.equals(true),
                )
                .assert(
                    "the bridge samples signed interleaved stereo at an explicit 48 kHz",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        const build = readText(PROBE_SCRIPT_URL);
                        return preJs.includes('"-samplerate", "48000"')
                            && preJs.includes("HEAP16[sampleOffset + frame * 2]")
                            && preJs.includes("HEAP16[sampleOffset + frame * 2 + 1]")
                            && preJs.includes('JSMESS.audioChannelOrder = "left-right"')
                            && preJs.includes("resetAudioProbe")
                            && build.includes("audio_probe_is_applied")
                            && build.includes('apply_source_patch "${audio_probe_patch}"')
                            && build.includes('remove_source_patch "${audio_probe_patch}"');
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "captures startup audit failures before frontend return",
            run: () => CTGTest.init("private audit-output probe contract")
                .assert(
                    "the OSD delegate records formatted channel messages without replacing output",
                    () => {
                        const patch = readText(AUDIT_PATCH_URL);
                        return patch.includes("vsnprintf")
                            && patch.includes("auditOutputMessages")
                            && patch.includes('channelName = $0 === 0 ? "error"')
                            && patch.includes("vfprintf") === false;
                    },
                    P.equals(true),
                )
                .assert(
                    "the generic bridge can omit its configured dependency after preload",
                    () => {
                        const preJs = readText(PRE_JS_URL);
                        const build = readText(PROBE_SCRIPT_URL);
                        const patch = readText(AUDIT_PATCH_URL);
                        return preJs.includes('mame_probe_omit')
                            && preJs.includes('"/roms/" + MAME_PROBE_PARENT + ".zip"')
                            && patch.includes("auditOutputCountAtFrontendReturn")
                            && patch.includes("frontendResult = $0")
                            && build.includes("MAME_PROBE_PARENT")
                            && build.includes("audit_output_probe_is_applied")
                            && build.includes('apply_source_patch "${audit_output_probe_patch}"')
                            && build.includes('remove_source_patch "${audit_output_probe_patch}"');
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "compares one private fixture across native and browser builds",
            run: () => CTGTest.init("native/browser parity contract")
                .assert(
                    "the same core checkpoint records identity, video and input in both builds",
                    () => {
                        const patch = readText(PARITY_PATCH_URL);
                        return patch.includes("const UINT64 capture_frame = 180")
                            && patch.includes("create_snapshot_bitmap(screen)")
                            && patch.includes("checksum = (checksum ^ red) * 16777619U")
                            && patch.includes("refresh_millihertz")
                            && patch.includes("right->port().read() & right->mask()")
                            && patch.includes("JSMESS.parityFrame")
                            && patch.includes("JSMESS.parityInput")
                            && patch.includes("P12_FRAME")
                            && patch.includes("P12_INPUT");
                    },
                    P.equals(true),
                )
                .assert(
                    "the native runner emits a config-relative structured baseline",
                    () => {
                        const packageJson = JSON.parse(readText(PACKAGE_URL)) as { scripts: Record<string, string> };
                        const reader = readText(CONFIG_READER_URL);
                        const runner = readText(NATIVE_PARITY_SCRIPT_URL);
                        const writer = readText(PARITY_RESULT_WRITER_URL);
                        return packageJson.scripts["probe:mame:parity:native"]
                                === "scripts/probe-mame0161-native-parity.sh"
                            && reader.includes('"native-parity"')
                            && reader.includes('pathValue("nativeResult"')
                            && runner.includes("CPPFLAGS=-DNO_MEM_TRACKING")
                            && runner.includes("-seconds_to_run 5")
                            && runner.includes("write-mame-parity-result.js")
                            && writer.includes("Native parity output did not contain complete frame and input records");
                    },
                    P.equals(true),
                )
                .assert(
                    "the browser comparison uses one ignored JSON config and exact parity fields",
                    () => {
                        const browser = readText(PARITY_BROWSER_TEST_URL);
                        return browser.includes("MAME_PARITY_PROBE_CONFIG")
                            && browser.includes("machineMatches")
                            && browser.includes("geometryMatches")
                            && browser.includes("refreshMatches")
                            && browser.includes("frameHashMatches")
                            && browser.includes("coreInputMatches")
                            && browser.includes("reportedSpeedRatio")
                            && browser.includes("ctg-js-browser-test");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
