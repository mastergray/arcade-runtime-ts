// realizes: docs/arcade-runtime-spec.md > §10.5 romsets/ metadata (conversion of -listxml into per-machine JSON)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import { parseListXml, romsetsFromListXml } from "../../scripts/mame-build/romsets.ts";   // Conversion under test
import { isRomSetMetadata } from "../../src/index.ts";           // Every produced record must satisfy the shared predicate

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

// A synthetic family: a BIOS root, a parent that inherits one BIOS ROM, a clone that merges into the parent,
// a machine with samples, a device element to ignore, and an undumped ROM.
const LISTXML = `<?xml version="1.0"?>
<mame build="0.161 (fake)">
	<machine name="fakebios" sourcefile="fake.c" isbios="yes">
		<description>Fake BIOS</description>
		<biosset name="euro" description="Europe" default="yes"/>
		<biosset name="japan" description="Japan"/>
		<rom name="bios-e.rom" bios="euro" size="131072" crc="11111111" sha1="${"1".repeat(40)}" region="main" offset="0"/>
		<rom name="bios-j.rom" bios="japan" size="131072" crc="22222222" sha1="${"2".repeat(40)}" region="main" offset="0"/>
		<rom name="common.rom" size="65536" crc="33333333" sha1="${"3".repeat(40)}" region="fixed" offset="0"/>
	</machine>
	<machine name="fakegame" sourcefile="fake.c" romof="fakebios">
		<description>Fake Game &amp; Friends (World)</description>
		<biosset name="euro" description="Europe" default="yes"/>
		<biosset name="japan" description="Japan"/>
		<rom name="bios-e.rom" merge="bios-e.rom" bios="euro" size="131072" crc="11111111" sha1="${"1".repeat(40)}" region="main" offset="0"/>
		<rom name="common.rom" merge="common.rom" size="65536" crc="33333333" sha1="${"3".repeat(40)}" region="fixed" offset="0"/>
		<rom name="game-p1.rom" size="524288" crc="aaaaaaaa" sha1="${"a".repeat(40)}" region="maincpu" offset="0"/>
		<rom name="game-v1.rom" size="1048576" crc="bbbbbbbb" sha1="${"b".repeat(40)}" region="ymsnd" offset="0"/>
		<rom name="undumped.rom" size="1024" status="nodump" region="extra" offset="0"/>
		<dipswitch name="Difficulty" tag="DSWA" mask="3">
			<dipvalue name="Easy" value="3" default="yes"/>
			<dipvalue name="Hard" value="1"/>
		</dipswitch>
		<dipswitch name="Lives" tag="DSWB" mask="192">
			<dipvalue name="3" value="128" default="yes"/>
			<dipvalue name="5" value="192"/>
		</dipswitch>
		<dipswitch name="Bonus Life" tag="DSWB" mask="8">
			<dipvalue name="Only at 100000" value="0"/>
		</dipswitch>
	</machine>
	<machine name="fakeclone" sourcefile="fake.c" cloneof="fakegame" romof="fakegame">
		<description>Fake Game &amp; Friends (Japan)</description>
		<rom name="common.rom" merge="common.rom" size="65536" crc="33333333" sha1="${"3".repeat(40)}" region="fixed" offset="0"/>
		<rom name="game-p1j.rom" size="524288" crc="cccccccc" sha1="${"c".repeat(40)}" region="maincpu" offset="0"/>
		<rom name="game-v1.rom" merge="game-v1.rom" size="1048576" crc="bbbbbbbb" sha1="${"b".repeat(40)}" region="ymsnd" offset="0"/>
		<rom name="extra.rom" size="256" crc="dddddddd" sha1="${"d".repeat(40)}" region="extra" offset="0" optional="yes"/>
	</machine>
	<machine name="fakeold" sourcefile="old.c" sampleof="fakesamp">
		<description>Fake Old Game</description>
		<rom name="old.rom" size="4096" crc="eeeeeeee" sha1="${"e".repeat(40)}" region="maincpu" offset="0"/>
		<sample name="boom"/>
		<sample name="zap"/>
	</machine>
	<machine name="fakedev" sourcefile="dev.c" isdevice="yes" runnable="no">
		<description>Fake Device</description>
	</machine>
	<machine name="fakemcu" sourcefile="mcu.c" isdevice="yes" runnable="no">
		<description>Fake MCU</description>
		<rom name="mcu.bin" size="1024" crc="ffffffff" sha1="${"f".repeat(40)}" region="mcu" offset="0"/>
	</machine>
	<machine name="fakemcugame" sourcefile="old.c">
		<description>Fake MCU Game</description>
		<rom name="mcugame.rom" size="4096" crc="12121212" sha1="${"1".repeat(40)}" region="maincpu" offset="0"/>
		<device_ref name="fakemcu"/>
		<device_ref name="fakedev"/>
		<device_ref name="z80"/>
	</machine>
</mame>
`;

const testFile: TestFile = {
    label: "romsets extraction",
    cases: [
        {
            label: "parseListXml reads machines, attributes, BIOS sets, ROMs, samples and DIP switches",
            run: () => CTGTest.init("parse")
                .stage("parse", () => parseListXml(LISTXML))
                .assert("shape", (state) => ({
                    names: state.subject.map((machine) => machine.name),
                    description: state.subject[1]?.description,
                    bios: state.subject[0]?.biossets,
                    romCount: state.subject[1]?.roms.length,
                    samples: state.subject[3]?.samples,
                    nodump: state.subject[1]?.roms.find((rom) => rom.name === "undumped.rom")?.nodump,
                    dipswitches: state.subject[1]?.dipswitches,
                }), P.equals<{ names: string[]; description: string | undefined; bios: ReadonlyArray<string> | undefined; romCount: number | undefined; samples: ReadonlyArray<string> | undefined; nodump: boolean | undefined; dipswitches: unknown }>({
                    names: ["fakebios", "fakegame", "fakeclone", "fakeold", "fakedev", "fakemcu", "fakemcugame"],
                    description: "Fake Game & Friends (World)",
                    bios: ["euro", "japan"],
                    romCount: 5,
                    samples: ["boom", "zap"],
                    nodump: true,
                    dipswitches: [
                        { name: "Difficulty", tag: "DSWA", mask: 3, values: [{ name: "Easy", value: 3, default: true }, { name: "Hard", value: 1, default: false }] },
                        { name: "Lives", tag: "DSWB", mask: 192, values: [{ name: "3", value: 128, default: true }, { name: "5", value: 192, default: false }] },
                        { name: "Bonus Life", tag: "DSWB", mask: 8, values: [{ name: "Only at 100000", value: 0, default: false }] },
                    ],
                }))
                .start(undefined),
        },
        {
            label: "the pinned release's <game> element name is accepted exactly like <machine>",
            run: () => CTGTest.init("game elements")
                .stage("convert a <game> document", () => romsetsFromListXml("fake-family", LISTXML.replace(/<machine\b/g, "<game").replace(/<\/machine>/g, "</game>")))
                .assert("same machines", (state) => [...state.subject.keys()], P.equals<string[]>(["fakebios", "fakegame", "fakeclone", "fakeold", "fakemcugame"]))
                .start(undefined),
        },
        {
            label: "every produced record satisfies isRomSetMetadata and carries the family id",
            run: () => CTGTest.init("validity")
                .stage("convert", () => [...romsetsFromListXml("fake-family", LISTXML).values()])
                .assert("all valid", (state) => state.subject.length === 5 && state.subject.every((metadata) => isRomSetMetadata(metadata) && metadata.family === "fake-family"), P.equals(true))
                .start(undefined),
        },
        {
            label: "converted metadata carries two validated DIP switches with their tags, masks, values and defaults",
            run: () => CTGTest.init("DIP metadata")
                .stage("convert", () => romsetsFromListXml("fake-family", LISTXML).get("fakegame")!)
                .assert("DIP fields", (state) => ({
                    valid: isRomSetMetadata(state.subject),
                    dipswitches: state.subject.dipswitches,
                }), P.equals<unknown>({
                    valid: true,
                    dipswitches: [
                        { name: "Difficulty", tag: "DSWA", mask: 3, values: [{ name: "Easy", value: 3, default: true }, { name: "Hard", value: 1, default: false }] },
                        { name: "Lives", tag: "DSWB", mask: 192, values: [{ name: "3", value: 128, default: true }, { name: "5", value: 192, default: false }] },
                    ],                                            // "Bonus Life" has no default row and is omitted
                }))
                .start(undefined),
        },
        {
            label: "a parent that inherits from a BIOS lists its own zip and the BIOS zip, placing merged ROMs in the BIOS archive",
            run: () => CTGTest.init("parent placement")
                .stage("convert", () => romsetsFromListXml("fake-family", LISTXML).get("fakegame")!)
                .assert("archives and placement", (state) => ({
                    archives: state.subject.archives.map((archive) => `${archive.name}:${archive.role}`),
                    placement: Object.fromEntries(state.subject.roms.map((rom) => [rom.name, rom.archive])),
                    bios: [...state.subject.bios],
                    cloneof: state.subject.cloneof,
                    romof: state.subject.romof,
                    undumped: state.subject.roms.find((rom) => rom.name === "undumped.rom"),
                    defaultBios: state.subject.defaultBios,
                    euroTag: state.subject.roms.find((rom) => rom.name === "bios-e.rom")?.bios,
                }), P.equals<{ archives: string[]; placement: Record<string, string>; bios: string[]; cloneof: string | null; romof: string | null; undumped: unknown; defaultBios: string | null | undefined; euroTag: string | null | undefined }>({
                    archives: ["fakegame.zip:game", "fakebios.zip:bios"],
                    placement: { "bios-e.rom": "fakebios.zip", "common.rom": "fakebios.zip", "game-p1.rom": "fakegame.zip", "game-v1.rom": "fakegame.zip", "undumped.rom": "fakegame.zip" },
                    bios: ["euro", "japan"],
                    cloneof: null,
                    romof: "fakebios",
                    undumped: { name: "undumped.rom", size: 1024, crc: "00000000", sha1: null, archive: "fakegame.zip", optional: true, bios: null, device: null },
                    defaultBios: "euro",
                    euroTag: "euro",
                }))
                .start(undefined),
        },
        {
            label: "a clone lists game, parent and BIOS zips and places merged ROMs where the chain physically holds them",
            run: () => CTGTest.init("clone placement")
                .stage("convert", () => romsetsFromListXml("fake-family", LISTXML).get("fakeclone")!)
                .assert("archives and placement", (state) => ({
                    archives: state.subject.archives.map((archive) => `${archive.name}:${archive.role}`),
                    placement: Object.fromEntries(state.subject.roms.map((rom) => [rom.name, rom.archive])),
                    optional: state.subject.roms.find((rom) => rom.name === "extra.rom")?.optional,
                }), P.equals<{ archives: string[]; placement: Record<string, string>; optional: boolean | undefined }>({
                    archives: ["fakeclone.zip:game", "fakegame.zip:parent", "fakebios.zip:bios"],
                    placement: { "common.rom": "fakebios.zip", "game-p1j.rom": "fakeclone.zip", "game-v1.rom": "fakegame.zip", "extra.rom": "fakeclone.zip" },
                    optional: true,
                }))
                .start(undefined),
        },
        {
            label: "a machine referencing a device with its own ROMs lists <device>.zip as a device archive and tags those ROMs",
            run: () => CTGTest.init("device roms")
                .stage("convert", () => romsetsFromListXml("fake-family", LISTXML).get("fakemcugame")!)
                .assert("device archive and tagged rom", (state) => ({
                    archives: state.subject.archives.map((archive) => `${archive.name}:${archive.role}`),
                    device: state.subject.roms.find((rom) => rom.name === "mcu.bin"),
                }), P.equals<{ archives: string[]; device: unknown }>({
                    archives: ["fakemcugame.zip:game", "fakemcu.zip:device"],
                    device: { name: "mcu.bin", size: 1024, crc: "ffffffff", sha1: "f".repeat(40), archive: "fakemcu.zip", optional: false, bios: null, device: "fakemcu" },
                }))
                .start(undefined),
        },
        {
            label: "a machine with a sample set names the sampleof zip as an optional samples archive",
            run: () => CTGTest.init("samples")
                .stage("convert", () => romsetsFromListXml("fake-family", LISTXML).get("fakeold")!)
                .assert("samples archive", (state) => ({
                    archives: state.subject.archives.map((archive) => `${archive.name}:${archive.role}`),
                    samples: state.subject.samples.map((sample) => `${sample.archive}/${sample.name}`),
                    sampleof: state.subject.sampleof,
                }), P.equals<{ archives: string[]; samples: string[]; sampleof: string | null }>({
                    archives: ["fakeold.zip:game", "fakesamp.zip:samples"],
                    samples: ["fakesamp.zip/boom", "fakesamp.zip/zap"],
                    sampleof: "fakesamp",
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
