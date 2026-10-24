// realizes: docs/arcade-runtime-spec.md > §4.1, §4.6, §12.1 M1A family targets

// Dependencies:
import { existsSync, readFileSync } from "node:fs";              // Reads the tracked family target pairs
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {id:STRING, sources:[STRING], expectedMachines:NUMBER}
// A committed family pair and its independently derived coverage facts.
interface FamilyTarget {
    readonly id: string;                                        // SUBTARGET and target-pair basename
    readonly sources: readonly string[];                        // Driver units allowed to define list entries
    readonly expectedMachines: number;                          // Pinned 0.161 derivation result
}

// INTERFACE :: {name:STRING, source:STRING}
// One machine entry and the driver unit recorded by its list comment.
interface FamilyListEntry {
    readonly name: string;                                      // MAME short name
    readonly source: string;                                    // Defining source unit compiled by the Lua
}

/**
 *
 * Constants
 *
 */

const TARGET_ROOT = new URL("../../mame/targets/", import.meta.url);

const FAMILY_TARGETS: readonly FamilyTarget[] = [
    {
        id: "atari-gauntlet",
        sources: ["src/mame/drivers/gauntlet.c"],
        expectedMachines: 28,
    },
    {
        id: "atari-classic",
        sources: [
            "src/mame/drivers/bzone.c",
            "src/mame/drivers/tempest.c",
            "src/mame/drivers/rampart.c",
        ],
        expectedMachines: 15,
    },
    { id: "cps1", sources: ["src/mame/drivers/cps1.c"], expectedMachines: 178 },
    { id: "cps2", sources: ["src/mame/drivers/cps2.c"], expectedMachines: 293 },
    {
        id: "irem-m72",
        sources: ["src/mame/drivers/m72.c", "src/mame/drivers/m92.c"],
        expectedMachines: 71,
    },
    {
        id: "midway-mcr",
        sources: [
            "src/mame/drivers/mcr.c",
            "src/mame/drivers/mcr3.c",
            "src/mame/drivers/mcr68.c",
        ],
        expectedMachines: 54,
    },
    {
        id: "midway-tunit",
        sources: [
            "src/mame/drivers/midtunit.c",
            "src/mame/drivers/midyunit.c",
        ],
        expectedMachines: 66,
    },
    {
        id: "misc-16",
        sources: [
            "src/mame/drivers/dec0.c",
            "src/mame/drivers/karnov.c",
            "src/mame/drivers/raiden.c",
            "src/mame/drivers/raiden2.c",
            "src/mame/drivers/r2dx_v33.c",
            "src/mame/drivers/snowbros.c",
            "src/mame/drivers/shadfrce.c",
            "src/mame/drivers/btoads.c",
        ],
        expectedMachines: 111,
    },
    {
        id: "konami-16",
        sources: [
            "src/mame/drivers/tmnt.c",
            "src/mame/drivers/simpsons.c",
            "src/mame/drivers/xmen.c",
            "src/mame/drivers/gijoe.c",
            "src/mame/drivers/mystwarr.c",
            "src/mame/drivers/spy.c",
        ],
        expectedMachines: 98,
    },
    {
        id: "neogeo",
        sources: ["src/mame/drivers/neogeo.c", "src/mame/drivers/neogeo_noslot.c"],
        expectedMachines: 256,
    },
    {
        id: "namco-classic",
        sources: [
            "src/mame/drivers/pacman.c",
            "src/mame/drivers/galaga.c",
            "src/mame/drivers/galaxian.c",
            "src/mame/drivers/rallyx.c",
            "src/mame/drivers/mappy.c",
            "src/mame/drivers/toypop.c",
            "src/mame/drivers/gaplus.c",
            "src/mame/drivers/skykid.c",
            "src/mame/drivers/baraduke.c",
            "src/mame/drivers/pacland.c",
            "src/mame/drivers/polepos.c",
        ],
        expectedMachines: 378,
    },
    {
        id: "namco-s1",
        sources: ["src/mame/drivers/namcos1.c", "src/mame/drivers/namcos86.c"],
        expectedMachines: 47,
    },
    {
        id: "namco-s2",
        sources: ["src/mame/drivers/namcos2.c"],
        expectedMachines: 54,
    },
    {
        id: "sega-16",
        sources: [
            "src/mame/drivers/segahang.c",
            "src/mame/drivers/segaorun.c",
            "src/mame/drivers/segaxbd.c",
            "src/mame/drivers/segaybd.c",
        ],
        expectedMachines: 66,
    },
    {
        id: "sega-s16",
        sources: [
            "src/mame/drivers/segas16a.c",
            "src/mame/drivers/segas16b.c",
            "src/mame/drivers/segas18.c",
        ],
        expectedMachines: 139,
    },
    {
        id: "sega-s32",
        sources: ["src/mame/drivers/segas32.c"],
        expectedMachines: 52,
    },
    {
        id: "taito-classic",
        sources: [
            "src/mame/drivers/taitosj.c",
            "src/mame/drivers/bublbobl.c",
            "src/mame/drivers/arkanoid.c",
            "src/mame/drivers/tnzs.c",
            "src/mame/drivers/slapfght.c",
            "src/mame/drivers/flstory.c",
            "src/mame/drivers/lkage.c",
            "src/mame/drivers/retofinv.c",
            "src/mame/drivers/nycaptor.c",
            "src/mame/drivers/buggychl.c",
            "src/mame/drivers/gladiatr.c",
            "src/mame/drivers/mexico86.c",
            "src/mame/drivers/superqix.c",
        ],
        expectedMachines: 148,
    },
    {
        id: "taito-16",
        sources: [
            "src/mame/drivers/rastan.c",
            "src/mame/drivers/opwolf.c",
            "src/mame/drivers/rainbow.c",
            "src/mame/drivers/volfied.c",
            "src/mame/drivers/asuka.c",
            "src/mame/drivers/taito_l.c",
            "src/mame/drivers/taito_x.c",
            "src/mame/drivers/taito_b.c",
            "src/mame/drivers/taito_f2.c",
            "src/mame/drivers/taito_h.c",
            "src/mame/drivers/taito_z.c",
        ],
        expectedMachines: 223,
    },
    {
        id: "taito-f3",
        sources: ["src/mame/drivers/taito_f3.c"],
        expectedMachines: 90,
    },
] as const;

const PRIVATE_MARKERS = [
    "MAME_PROBE_MACHINE",
    "ROM_START",
    "runtimeprobe.lst",
    "private-probe",
    "<machine>",
] as const;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Reads one tracked family-target file.
const readTarget = (name: string): string => readFileSync(new URL(name, TARGET_ROOT), "utf8");

// HELPER :: familyTarget -> [familyListEntry]
// Parses machine lines, requiring their public driver-source annotations.
const readListEntries = (family: FamilyTarget): FamilyListEntry[] =>
    readTarget(`${family.id}.lst`)
        .split(/\r?\n/)
        .flatMap((line): FamilyListEntry[] => {
            const trimmed = line.trim();
            if (trimmed.length === 0 || trimmed.startsWith("//")) {
                return [];
            }

            const match = /^([a-z0-9_]+)\s+\/\/\s+(src\/mame\/drivers\/[a-z0-9_]+\.c)$/.exec(trimmed);
            if (match === null) {
                throw new Error(`Malformed ${family.id}.lst entry: ${trimmed}`);
            }

            return [{ name: match[1]!, source: match[2]! }];
        });

// HELPER :: STRING, "create"|"link" -> STRING
// Gives the Lua declaration form for a family, including hyphenated ids.
const functionDeclaration = (id: string, operation: "create" | "link"): string => {
    const functionName = `${operation}Projects_mame_${id}`;
    return id.includes("-") ? `_G["${functionName}"] = function` : `function ${functionName}`;
};

const testFile: TestFile = {
    label: "MAME 0.161 driver-family target pairs",
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
            label: "commits a complete list sibling for every Lua target",
            run: () => CTGTest.init("family target pairs")
                .assert(
                    "each Lua target has a list sibling",
                    () => FAMILY_TARGETS.every(({ id }) =>
                        existsSync(new URL(`${id}.lua`, TARGET_ROOT))
                        && existsSync(new URL(`${id}.lst`, TARGET_ROOT))),
                    P.equals(true),
                )
                .assert(
                    "each list has the pinned derivation count",
                    () => FAMILY_TARGETS.every((family) =>
                        readListEntries(family).length === family.expectedMachines),
                    P.equals(true),
                )
                .assert(
                    "lists contain no duplicate machine names",
                    () => FAMILY_TARGETS.every((family) => {
                        const names = readListEntries(family).map(({ name }) => name);
                        return new Set(names).size === names.length;
                    }),
                    P.equals(true),
                )
                .assert(
                    "lists contain no private-selection markers",
                    () => FAMILY_TARGETS.every(({ id }) => {
                        const list = readTarget(`${id}.lst`);
                        return PRIVATE_MARKERS.every((marker) => !list.includes(marker));
                    }),
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps list coverage coupled to each family Lua",
            run: () => CTGTest.init("family list source coverage")
                .assert(
                    "every list entry names an allowed driver source",
                    () => FAMILY_TARGETS.every((family) =>
                        readListEntries(family).every(({ source }) => family.sources.includes(source))),
                    P.equals(true),
                )
                .assert(
                    "every entry's driver source is compiled by its Lua",
                    () => FAMILY_TARGETS.every((family) => {
                        const target = readTarget(`${family.id}.lua`);
                        return readListEntries(family).every(({ source }) => target.includes(`"${source}"`));
                    }),
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "names Lua projects and functions for the family subtarget",
            run: () => CTGTest.init("family Lua names")
                .assert(
                    "function declarations match each family id",
                    () => FAMILY_TARGETS.every(({ id }) => {
                        const target = readTarget(`${id}.lua`);
                        return target.includes(functionDeclaration(id, "create"))
                            && target.includes(functionDeclaration(id, "link"));
                    }),
                    P.equals(true),
                )
                .assert(
                    "required family project names match their subtargets",
                    () => ["cps1", "neogeo"].every((id) => {
                        const target = readTarget(`${id}.lua`);
                        return target.includes(`project ("mame_${id}")`)
                            && target.includes(`"mame_${id}",`);
                    }),
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "keeps representative machine selection out of tracked targets",
            run: () => CTGTest.init("private family driver list")
                .assert(
                    "family targets contain complete source selection only",
                    () => FAMILY_TARGETS.every(({ id }) => {
                        const pair = `${readTarget(`${id}.lua`)}\n${readTarget(`${id}.lst`)}`;
                        return PRIVATE_MARKERS.every((marker) => !pair.includes(marker));
                    }),
                    P.equals(true),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
