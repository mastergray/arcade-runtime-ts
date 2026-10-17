// realizes: docs/mame-game-runtime-spec.md > §13.1 P3 family subsets

// Dependencies:
import { readFileSync } from "node:fs";                          // Reads the tracked family target definitions
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const TARGET_ROOT = new URL("../../mame/targets/", import.meta.url);

const readTarget = (name: string): string => readFileSync(new URL(name, TARGET_ROOT), "utf8");

const testFile: TestFile = {
    label: "MAME 0.161 driver-family probe targets",
    cases: [
        {
            label: "selects the three measured hardware source groups",
            run: () => CTGTest.init("family source definitions")
                .assert(
                    "CPS-1 selects its driver, video and decryption sources",
                    () => {
                        const target = readTarget("cps1.lua");
                        return target.includes("src/mame/drivers/cps1.c")
                            && target.includes("src/mame/video/cps1.c")
                            && target.includes("src/mame/machine/kabuki.c");
                    },
                    P.equals(true),
                )
                .assert(
                    "Irem M72 selects its driver, audio, video and CPU helper sources",
                    () => {
                        const target = readTarget("irem-m72.lua");
                        return target.includes("src/mame/drivers/m72.c")
                            && target.includes("src/mame/audio/m72.c")
                            && target.includes("src/mame/video/m72.c")
                            && target.includes("src/mame/machine/irem_cpu.c");
                    },
                    P.equals(true),
                )
                .assert(
                    "Neo Geo selects its driver, video, protection and memory-card sources",
                    () => {
                        const target = readTarget("neogeo.lua");
                        return target.includes("src/mame/drivers/neogeo.c")
                            && target.includes("src/mame/drivers/neogeo_noslot.c")
                            && target.includes("src/mame/video/neogeo.c")
                            && target.includes("src/mame/machine/neoprot.c")
                            && target.includes("src/mame/machine/ng_memcard.c");
                    },
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps representative machine selection out of tracked targets",
            run: () => CTGTest.init("private family driver list")
                .assert(
                    "family targets contain source selection only",
                    () => ["cps1.lua", "irem-m72.lua", "neogeo.lua"]
                        .every((name) => {
                            const target = readTarget(name);
                            return !target.includes("MAME_PROBE_MACHINE")
                                && !target.includes("ROM_START")
                                && !target.includes("runtimeprobe.lst");
                        }),
                    P.equals(true),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
