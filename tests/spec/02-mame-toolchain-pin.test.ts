// realizes: docs/parent/mame-game-runtime-spec.md > §13.1 P2 browser toolchain

// Dependencies:
import { readFileSync } from "node:fs";                          // Reads the committed SDK and patch inputs
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const EMSDK_VERSION_URL = new URL("../../mame/EMSDK_VERSION", import.meta.url);
const PATCH_URL = new URL("../../mame/probes/patches/0001-emscripten-1.38.31-compatibility.patch", import.meta.url);
const NO_MONGOOSE_PATCH_URL = new URL("../../mame/probes/patches/0005-emscripten-disable-mongoose.patch", import.meta.url);
const PROBE_SCRIPT_URL = new URL("../../scripts/probe-mame0161-tiny.sh", import.meta.url);

/**
 *
 * Functions
 *
 */

// HELPER :: URL -> STRING
// Reads a committed text input exactly as the probe tooling will.
const readText = (url: URL): string => readFileSync(url, "utf8");

const testFile: TestFile = {
    label: "direct-MAME browser toolchain pin",
    cases: [
        {
            label: "pins the tested Fastcomp SDK",
            run: () => CTGTest.init("emsdk identity")
                .assert("version is 1.38.31", () => readText(EMSDK_VERSION_URL).trim(), P.equals("1.38.31"))
                .start(undefined),
        },
        {
            label: "keeps the compatibility patch and probe command reproducible",
            run: () => CTGTest.init("probe inputs")
                .assert(
                    "patch targets the pinned source",
                    () => readText(PATCH_URL).includes("NO_MEM_TRACKING")
                        && readText(PATCH_URL).includes("USE_SDL=2"),
                    P.equals(true),
                )
                .assert(
                    "browser build omits Mongoose",
                    () => readText(NO_MONGOOSE_PATCH_URL).includes('if _OPTIONS["targetos"]~="asmjs" then')
                        && readText(NO_MONGOOSE_PATCH_URL).includes('void web_engine::serve() { }')
                        && readText(PROBE_SCRIPT_URL).includes('apply_source_patch "${no_mongoose_patch}"'),
                    P.equals(true),
                )
                .assert(
                    "probe performs the WebAssembly link",
                    () => readText(PROBE_SCRIPT_URL).includes('output_name="mametiny-probe"')
                        && readText(PROBE_SCRIPT_URL).includes('-o "${source_dir}/${output_name}.html"')
                        && readText(PROBE_SCRIPT_URL).includes("TOTAL_MEMORY=268435456")
                        && readText(PROBE_SCRIPT_URL).includes("DISABLE_EXCEPTION_CATCHING=0")
                        && readText(PROBE_SCRIPT_URL).includes("--reverse --forward --batch"),
                    P.equals(true),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
