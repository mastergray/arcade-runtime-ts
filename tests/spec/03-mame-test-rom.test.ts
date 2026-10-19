// realizes: docs/mame-game-runtime-spec.md > §13.1 P12 private local fixture

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
    ],
};

export default testFile;
