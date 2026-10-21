// realizes: docs/arcade-runtime-spec.md > §10.5 romsets/ metadata (conversion of -listxml into per-machine JSON)

// Type dependencies:
import type { RomSetMetadata } from "../../src/RomSetAudit/types.js";   // Per-machine shape served beside a build

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: one <machine> element of 0.161 -listxml, reduced to what romsets need
interface ListXmlMachine {
    readonly name: string;                                         // Short name
    readonly description: string;                                  // Title
    readonly cloneof: string | null;                               // Parent machine
    readonly romof: string | null;                                 // Machine whose ROMs are inherited
    readonly sampleof: string | null;                              // Machine whose samples are inherited
    readonly isbios: boolean;                                      // BIOS root
    readonly biossets: ReadonlyArray<string>;                      // BIOS option names
    readonly defaultBios: string | null;                           // biosset default="yes" 
    readonly roms: ReadonlyArray<ListXmlRom>;                      // ROM declarations
    readonly samples: ReadonlyArray<string>;                       // Sample names
    readonly isdevice: boolean;                                    // isdevice="yes": a device with its own ROM set
    readonly deviceRefs: ReadonlyArray<string>;                    // <device_ref name=…/> short names
    readonly dipswitches: ReadonlyArray<ListXmlDipSwitch>;         // DIP fields and their named settings
}

// INTERFACE :: one <rom> element
interface ListXmlRom {
    readonly name: string;                                         // Entry name
    readonly size: number;                                         // Expected bytes
    readonly crc: string | null;                                   // Lower-case hex, or null for nodump
    readonly sha1: string | null;                                  // Lower-case hex, or null for nodump
    readonly merge: string | null;                                 // Name in the parent set when inherited
    readonly bios: string | null;                                  // BIOS option the ROM belongs to
    readonly nodump: boolean;                                      // status="nodump"
    readonly optional: boolean;                                    // optional="yes"
}

// INTERFACE :: one <dipswitch> element
interface ListXmlDipSwitch {
    readonly name: string;                                         // Human-readable field name
    readonly tag: string;                                          // -listxml port tag without the root-device colon
    readonly mask: number;                                         // ioport_value field mask
    readonly values: ReadonlyArray<ListXmlDipValue>;               // Settings in driver declaration order
}

// INTERFACE :: one <dipvalue> child
interface ListXmlDipValue {
    readonly name: string;                                         // Human-readable setting name
    readonly value: number;                                        // Masked ioport value
    readonly default: boolean;                                     // Matches the field's default value
}

/**
 *
 * Constants
 *
 */

const MACHINE_PATTERN = /<(?:machine|game)\b([^>]*)>([\s\S]*?)<\/(?:machine|game)>/g;   // One machine element; 0.161 still names it <game>
const ATTRIBUTE_PATTERN = /([A-Za-z_][\w-]*)="([^"]*)"/g;             // name="value"
const DESCRIPTION_PATTERN = /<description>([^<]*)<\/description>/;    // First description child
const BIOSSET_PATTERN = /<biosset\b([^>]*)\/>/g;                      // Self-closing biosset
const ROM_PATTERN = /<rom\b([^>]*)\/>/g;                              // Self-closing rom
const SAMPLE_PATTERN = /<sample\b([^>]*)\/>/g;                        // Self-closing sample
const DEVICE_REF_PATTERN = /<device_ref\b([^>]*)\/>/g;                // Self-closing device reference
const DIPSWITCH_PATTERN = /<dipswitch\b([^>]*)>([\s\S]*?)<\/dipswitch>/g;   // DIP field and child values
const DIPVALUE_PATTERN = /<dipvalue\b([^>]*)\/>/g;                    // Self-closing DIP setting
const NODUMP_CRC = "00000000";                                        // Placeholder CRC for undumped ROMs, always optional

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Decodes the five XML entities MAME's xml_normalize_string emits.
const decode = (text: string): string => text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// HELPER :: STRING -> {[STRING]:STRING}
// Reads every attribute of one start tag.
const attributesOf = (tag: string): Record<string, string> => {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) attributes[match[1]!] = decode(match[2]!);
    return attributes;
};

// HELPER :: STRING -> [listXmlMachine]
// Parses the subset of -listxml that romsets need, including device elements (isdevice="yes") and device references.
// NOTE: 0.161 emits <game> elements under <mame>; later releases renamed them <machine>. Both are accepted.
export const parseListXml = (xml: string): ListXmlMachine[] => {
    const machines: ListXmlMachine[] = [];
    for (const match of xml.matchAll(MACHINE_PATTERN)) {
        const attributes = attributesOf(match[1]!);
        const body = match[2]!;
        if (attributes.name === undefined) continue;
        const description = DESCRIPTION_PATTERN.exec(body);
        machines.push({
            name: attributes.name,
            description: description === null ? attributes.name : decode(description[1]!),
            cloneof: attributes.cloneof ?? null,
            romof: attributes.romof ?? null,
            sampleof: attributes.sampleof ?? null,
            isbios: attributes.isbios === "yes",
            biossets: [...body.matchAll(BIOSSET_PATTERN)].map((bios) => attributesOf(bios[1]!).name ?? "").filter((name) => name !== ""),
            defaultBios: [...body.matchAll(BIOSSET_PATTERN)].map((bios) => attributesOf(bios[1]!)).find((a) => a.default === "yes")?.name ?? null,
            roms: [...body.matchAll(ROM_PATTERN)].map((rom) => {
                const a = attributesOf(rom[1]!);
                return {
                    name: a.name ?? "",
                    size: Number.parseInt(a.size ?? "0", 10),
                    crc: a.crc === undefined ? null : a.crc.toLowerCase(),
                    sha1: a.sha1 === undefined ? null : a.sha1.toLowerCase(),
                    merge: a.merge ?? null,
                    bios: a.bios ?? null,
                    nodump: a.status === "nodump",
                    optional: a.optional === "yes",
                };
            }).filter((rom) => rom.name !== ""),
            samples: [...body.matchAll(SAMPLE_PATTERN)].map((sample) => attributesOf(sample[1]!).name ?? "").filter((name) => name !== ""),
            isdevice: attributes.isdevice === "yes",
            deviceRefs: [...new Set([...body.matchAll(DEVICE_REF_PATTERN)].map((ref) => attributesOf(ref[1]!).name ?? "").filter((name) => name !== ""))],
            dipswitches: [...body.matchAll(DIPSWITCH_PATTERN)].map((dipswitch) => {
                const a = attributesOf(dipswitch[1]!);
                return {
                    name: a.name ?? "",
                    tag: a.tag ?? "",
                    mask: Number.parseInt(a.mask ?? "0", 10),
                    values: [...dipswitch[2]!.matchAll(DIPVALUE_PATTERN)].map((dipvalue) => {
                        const setting = attributesOf(dipvalue[1]!);
                        return {
                            name: setting.name ?? "",
                            value: Number.parseInt(setting.value ?? "0", 10),
                            default: setting.default === "yes",
                        };
                    }).filter((setting) => setting.name !== ""),
                };
            }).filter((dipswitch) => dipswitch.name !== "" && dipswitch.tag !== ""),
        });
    }
    return machines;
};

// HELPER :: Map<STRING,listXmlMachine>, listXmlMachine, STRING -> STRING
// Finds the machine whose own set physically holds a ROM: follows merge names up the romof chain until a
// machine declares the name without merge. Falls back to the starting machine if the chain is broken.
const locateRom = (machines: Map<string, ListXmlMachine>, machine: ListXmlMachine, romName: string): string => {
    let current = machine;
    let name = romName;
    for (let depth = 0; depth < 8; depth++) {
        const rom = current.roms.find((candidate) => candidate.name === name);
        if (rom === undefined || rom.merge === null) return current.name;
        const parent = current.romof === null ? undefined : machines.get(current.romof);
        if (parent === undefined) return current.name;
        current = parent;
        name = rom.merge;
    }
    return current.name;
};

// HELPER :: Map<STRING,listXmlMachine>, listXmlMachine -> [listXmlMachine]
// The romof ancestors of a machine, nearest first.
const ancestorsOf = (machines: Map<string, ListXmlMachine>, machine: ListXmlMachine): ListXmlMachine[] => {
    const chain: ListXmlMachine[] = [];
    let current = machine.romof === null ? undefined : machines.get(machine.romof);
    while (current !== undefined && chain.length < 8 && !chain.includes(current)) {
        chain.push(current);
        current = current.romof === null ? undefined : machines.get(current.romof);
    }
    return chain;
};

// HELPER :: [listXmlDipSwitch] -> romSetMetadata.dipswitches
// Makes the human selection keys unique and collapses condition-dependent duplicate numeric settings. Pinned
// -listxml omits setting conditions, so repeated rows for one value carry no additional cfg information.
// NOTE: A field whose default value has no named setting (a driver quirk: 0.161 emits no default="yes" row) is
// omitted, because §4.5 needs the default's value to write a cfg entry and the page could never show it selected.
const normalizedDipSwitches = (dipswitches: ReadonlyArray<ListXmlDipSwitch>): NonNullable<RomSetMetadata["dipswitches"]> => {
    const selectable = dipswitches.filter((dipswitch) => dipswitch.values.some((setting) => setting.default));
    const switchCounts = new Map<string, number>();
    for (const dipswitch of selectable) {
        const key = dipswitch.name.toLowerCase();
        switchCounts.set(key, (switchCounts.get(key) ?? 0) + 1);
    }
    const usedSwitchNames = new Set<string>();
    return selectable.map((dipswitch) => {
        const baseName = switchCounts.get(dipswitch.name.toLowerCase()) === 1
            ? dipswitch.name
            : `${dipswitch.name} (${dipswitch.tag} mask ${dipswitch.mask})`;
        let name = baseName;
        for (let ordinal = 2; usedSwitchNames.has(name.toLowerCase()); ordinal++) name = `${baseName} #${ordinal}`;
        usedSwitchNames.add(name.toLowerCase());

        const grouped = new Map<number, ListXmlDipValue[]>();
        for (const setting of dipswitch.values) {
            const group = grouped.get(setting.value) ?? [];
            group.push(setting);
            grouped.set(setting.value, group);
        }
        const collapsed = [...grouped.entries()].map(([value, settings]) => ({
            name: settings[0]!.name,
            value,
            default: settings.some((setting) => setting.default),
        }));
        const settingCounts = new Map<string, number>();
        for (const setting of collapsed) {
            const key = setting.name.toLowerCase();
            settingCounts.set(key, (settingCounts.get(key) ?? 0) + 1);
        }
        return {
            name,
            tag: dipswitch.tag,
            mask: dipswitch.mask,
            values: collapsed.map((setting) => ({
                ...setting,
                name: settingCounts.get(setting.name.toLowerCase()) === 1 ? setting.name : `${setting.name} (value ${setting.value})`,
            })),
        };
    });
};

// HELPER :: STRING, [listXmlMachine] -> Map<STRING,romSetMetadata>
// Converts every machine of a family's -listxml into the §10.5 per-machine metadata, keyed by machine name.
// NOTE: A ROM's archive is where MAME's split-set layout physically holds it: its own zip when declared without
// merge, otherwise the ancestor that declares the merged name. Undumped ROMs are optional with a placeholder CRC.
export const romsetsFromListXml = (family: string, xml: string): Map<string, RomSetMetadata> => {
    const parsed = parseListXml(xml);
    const machines = new Map(parsed.map((machine) => [machine.name, machine]));
    const result = new Map<string, RomSetMetadata>();
    for (const machine of parsed) {
        if (machine.isdevice) continue;
        // Devices with their own ROMs (Namco MCU programs, the QSound DSP) are required too; MAME loads them from
        // <device>.zip on the ROM path or from the game archive. Transitive references are followed one level.
        const deviceSets = machine.deviceRefs
            .map((name) => machines.get(name))
            .filter((device): device is ListXmlMachine => device !== undefined && device.isdevice && device.roms.length > 0);
        const ancestors = ancestorsOf(machines, machine);
        const archives: Array<{ name: string; role: RomSetMetadata["archives"][number]["role"] }> = [
            { name: `${machine.name}.zip`, role: "game" },
            ...ancestors.map((ancestor) => ({ name: `${ancestor.name}.zip`, role: ancestor.isbios ? "bios" as const : "parent" as const })),
        ];
        // A sample set lives under MAME's separate sample path and may share its zip name with the game or parent
        // (sampleof pointing at the parent is common). The flat archive model keys by basename, so a colliding sample
        // set is omitted: samples are optional and the game runs without them.
        const sampleName = machine.samples.length === 0 ? null : `${machine.sampleof ?? machine.name}.zip`;
        const sampleArchive = sampleName !== null && !archives.some((archive) => archive.name.toLowerCase() === sampleName.toLowerCase()) ? sampleName : null;
        if (sampleArchive !== null) archives.push({ name: sampleArchive, role: "samples" });
        for (const device of deviceSets) if (!archives.some((archive) => archive.name === `${device.name}.zip`)) archives.push({ name: `${device.name}.zip`, role: "device" });
        result.set(machine.name, {
            machine: machine.name,
            family,
            description: machine.description,
            cloneof: machine.cloneof,
            romof: machine.romof,
            bios: [...machine.biossets],
            defaultBios: machine.defaultBios,
            dipswitches: normalizedDipSwitches(machine.dipswitches),
            sampleof: machine.sampleof,
            archives,
            roms: [
                ...machine.roms.map((rom) => ({
                    name: rom.name,
                    size: rom.size,
                    crc: rom.nodump || rom.crc === null ? NODUMP_CRC : rom.crc,
                    sha1: rom.nodump ? null : rom.sha1,
                    archive: `${locateRom(machines, machine, rom.name)}.zip`,
                    optional: rom.optional || rom.nodump,
                    bios: rom.bios,
                    device: null,
                })),
                ...deviceSets.flatMap((device) => device.roms.map((rom) => ({
                    name: rom.name,
                    size: rom.size,
                    crc: rom.nodump || rom.crc === null ? NODUMP_CRC : rom.crc,
                    sha1: rom.nodump ? null : rom.sha1,
                    archive: `${device.name}.zip`,
                    optional: rom.optional || rom.nodump,
                    bios: null,
                    device: device.name,
                }))),
            ],
            samples: sampleArchive === null ? [] : machine.samples.map((name) => ({ name, archive: sampleArchive })),
        });
    }
    return result;
};
