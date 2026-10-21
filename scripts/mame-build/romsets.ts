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
    readonly roms: ReadonlyArray<ListXmlRom>;                      // ROM declarations
    readonly samples: ReadonlyArray<string>;                       // Sample names
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
// Parses the subset of -listxml that romsets need; device elements and everything else are ignored.
// NOTE: 0.161 emits <game> elements under <mame>; later releases renamed them <machine>. Both are accepted.
export const parseListXml = (xml: string): ListXmlMachine[] => {
    const machines: ListXmlMachine[] = [];
    for (const match of xml.matchAll(MACHINE_PATTERN)) {
        const attributes = attributesOf(match[1]!);
        const body = match[2]!;
        if (attributes.name === undefined || attributes.isdevice === "yes") continue;
        const description = DESCRIPTION_PATTERN.exec(body);
        machines.push({
            name: attributes.name,
            description: description === null ? attributes.name : decode(description[1]!),
            cloneof: attributes.cloneof ?? null,
            romof: attributes.romof ?? null,
            sampleof: attributes.sampleof ?? null,
            isbios: attributes.isbios === "yes",
            biossets: [...body.matchAll(BIOSSET_PATTERN)].map((bios) => attributesOf(bios[1]!).name ?? "").filter((name) => name !== ""),
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

// HELPER :: STRING, [listXmlMachine] -> Map<STRING,romSetMetadata>
// Converts every machine of a family's -listxml into the §10.5 per-machine metadata, keyed by machine name.
// NOTE: A ROM's archive is where MAME's split-set layout physically holds it: its own zip when declared without
// merge, otherwise the ancestor that declares the merged name. Undumped ROMs are optional with a placeholder CRC.
export const romsetsFromListXml = (family: string, xml: string): Map<string, RomSetMetadata> => {
    const parsed = parseListXml(xml);
    const machines = new Map(parsed.map((machine) => [machine.name, machine]));
    const result = new Map<string, RomSetMetadata>();
    for (const machine of parsed) {
        const ancestors = ancestorsOf(machines, machine);
        const archives: Array<{ name: string; role: RomSetMetadata["archives"][number]["role"] }> = [
            { name: `${machine.name}.zip`, role: "game" },
            ...ancestors.map((ancestor) => ({ name: `${ancestor.name}.zip`, role: ancestor.isbios ? "bios" as const : "parent" as const })),
        ];
        const sampleArchive = machine.samples.length === 0 ? null : `${machine.sampleof ?? machine.name}.zip`;
        if (sampleArchive !== null && !archives.some((archive) => archive.name === sampleArchive)) archives.push({ name: sampleArchive, role: "samples" });
        result.set(machine.name, {
            machine: machine.name,
            family,
            description: machine.description,
            cloneof: machine.cloneof,
            romof: machine.romof,
            bios: [...machine.biossets],
            sampleof: machine.sampleof,
            archives,
            roms: machine.roms.map((rom) => ({
                name: rom.name,
                size: rom.size,
                crc: rom.nodump || rom.crc === null ? NODUMP_CRC : rom.crc,
                sha1: rom.nodump ? null : rom.sha1,
                archive: `${locateRom(machines, machine, rom.name)}.zip`,
                optional: rom.optional || rom.nodump,
            })),
            samples: sampleArchive === null ? [] : machine.samples.map((name) => ({ name, archive: sampleArchive })),
        });
    }
    return result;
};
