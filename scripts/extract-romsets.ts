#!/usr/bin/env -S node --import tsx

// realizes: docs/arcade-runtime-spec.md > §10.5 romsets/ metadata (extract-romsets.ts)

// Dependencies:
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";   // Writes one JSON per machine
import { join, resolve } from "node:path";                       // Output paths
import { pathToFileURL } from "node:url";                        // Detects direct command-line execution
import { parseListFull } from "./mame-build/buildInfo.js";     // Machine names for the per-machine fallback
import { runMameUnderNode } from "./mame-build/nodeRunner.js";   // Runs the family build's -listxml under Node
import { romsetsFromListXml } from "./mame-build/romsets.js";    // Converts the XML into per-machine metadata

// Type dependencies:
import type { RomSetMetadata } from "../src/RomSetAudit/types.js";    // One machine's metadata

/**
 *
 * Constants
 *
 */

const USAGE = "Usage: extract-romsets <family> [--dist <dir>]";

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, STRING -> PROMISE(MAP(STRING, romSetMetadata))
// Runs one bulk -listxml, falling back to one -listxml per -listfull machine when the bulk run aborts or yields no document.
// NOTE: 0.161 keeps every enumerated machine configuration alive during a bulk -listxml; a family whose device
// configurations are large (Taito F3's Ensoniq board embeds 64 MiB each) exhausts the fixed heap before the end.
export const listXmlRomsets = async (family: string, javascript: string): Promise<Map<string, RomSetMetadata>> => {
    let bulkFailure: string;
    try {
        const run = await runMameUnderNode(javascript, ["-listxml"]);
        if (run.stdout.includes("<mame")) return romsetsFromListXml(family, run.stdout);
        bulkFailure = `no document: ${run.stderr.slice(0, 200)}`;
    } catch (error) {
        bulkFailure = error instanceof Error ? error.message : String(error);
    }
    const listing = await runMameUnderNode(javascript, ["-listfull"]);
    const machines = parseListFull(listing.stdout).map((entry) => entry.name);
    if (machines.length === 0) throw new Error(`-listxml failed for ${family} (${bulkFailure}) and -listfull named no machines to fall back on`);
    console.log(`${family}: bulk -listxml failed (${bulkFailure.slice(0, 120)}); extracting ${machines.length} machines one at a time`);
    const merged = new Map<string, RomSetMetadata>();
    for (const machine of machines) {
        const run = await runMameUnderNode(javascript, ["-listxml", machine]);
        if (!run.stdout.includes("<mame")) throw new Error(`-listxml ${machine} produced no document for ${family}: ${run.stderr.slice(0, 500)}`);
        for (const [name, metadata] of romsetsFromListXml(family, run.stdout)) merged.set(name, metadata);
    }
    return merged;
};

// HELPER :: STRING, STRING -> PROMISE(NUMBER)
// Runs -listxml for the family build under dist/mame/<family>/, writes romsets/<machine>.json for every machine, returns the count.
// NOTE: The romsets directory is replaced wholesale so a rebuilt family never keeps stale machines.
export const extractRomsets = async (family: string, distRoot: string): Promise<number> => {
    const familyDirectory = join(distRoot, family);
    const javascript = join(familyDirectory, `mame${family}.js`);
    if (!existsSync(javascript)) throw new Error(`No family build at ${javascript}; run build-mame first`);
    const romsets = await listXmlRomsets(family, javascript);
    const output = join(familyDirectory, "romsets");
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    for (const [machine, metadata] of romsets) writeFileSync(join(output, `${machine}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
    return romsets.size;
};

// HELPER :: [STRING] -> PROMISE(NUMBER)
// Command-line entry: exit 0 after writing, 1 on usage or extraction failure.
const main = async (argv: ReadonlyArray<string>): Promise<number> => {
    const args = [...argv];
    let distRoot = "dist/mame";
    const positional: string[] = [];
    while (args.length > 0) {
        const arg = args.shift()!;
        if (arg === "--dist") distRoot = args.shift() ?? "";
        else positional.push(arg);
    }
    const family = positional[0];
    if (family === undefined || positional.length !== 1 || distRoot === "") {
        console.error(USAGE);
        return 1;
    }
    const count = await extractRomsets(family, resolve(distRoot));
    console.log(`Wrote ${count} romsets for ${family} under ${join(resolve(distRoot), family, "romsets")}`);
    return 0;
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
