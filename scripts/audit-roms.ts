#!/usr/bin/env -S node --import tsx

// realizes: docs/arcade-runtime-spec.md > §10.5 arcade-audit-roms bin

// Dependencies:
import { readFileSync } from "node:fs";                            // Reads metadata JSON and explicitly named local zips
import { basename, join, resolve } from "node:path";               // Builds metadata path and archive basenames
import { pathToFileURL } from "node:url";                          // Detects direct command-line execution
import ArcadeRuntimeError from "../src/ArcadeRuntimeError/ArcadeRuntimeError.js";   // Identifies audit argument errors
import RomSetAudit from "../src/RomSetAudit/RomSetAudit.js";       // Shared browser/Node audit logic
import { isRomSetMetadata } from "../src/RomSetAudit/types.js";    // Validates parsed metadata before audit

// Type dependencies:
import type { RomFile } from "../src/shared.types.js";             // In-memory archive input
import type { RomSetReport } from "../src/RomSetAudit/types.js";   // JSON and table report

/**
 *
 * Type Declarations
 *
 */

// TYPE :: [STRING]
// One row in a plain-text table.
type TableRow = ReadonlyArray<string>;

/**
 *
 * Constants
 *
 */

const USAGE = "Usage: arcade-audit-roms [--json] [--bios <option>] <romsets-dir> <machine> <zip>...";

/**
 *
 * Functions
 *
 */

// HELPER :: [STRING], [[STRING]] -> STRING
// Renders a stable, whitespace-aligned table without terminal-specific glyphs.
const table = (headings: TableRow, rows: ReadonlyArray<TableRow>): string => {
    const widths = headings.map((heading, column) => Math.max(
        heading.length,
        ...rows.map((row) => row[column]?.length ?? 0),
    ));
    const line = (row: TableRow): string => row
        .map((cell, column) => cell.padEnd(widths[column] ?? cell.length))
        .join("  ")
        .trimEnd();
    return [line(headings), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)].join("\n");
};

// HELPER :: STRING, [STRING], [[STRING]] -> STRING
// Renders one titled table or an explicit empty marker.
const section = (title: string, headings: TableRow, rows: ReadonlyArray<TableRow>): string =>
    `${title}\n${rows.length === 0 ? "(none)" : table(headings, rows)}`;

// PUBLIC :: romSetReport -> STRING
// Renders every report field as human-readable tables for the default CLI mode.
export const renderReport = (report: RomSetReport): string => [
    `Machine: ${report.machine}`,
    `Status: ${report.status}`,
    "",
    section("ARCHIVES", ["NAME", "ROLE", "PRESENT", "REQUIRED"], report.archives.map((archive) => [
        archive.name, archive.role, archive.present ? "yes" : "no", archive.required ? "yes" : "no",
    ])),
    "",
    section("FILES", ["ARCHIVE", "NAME", "STATUS"], report.files.map((file) => [file.archive, file.name, file.status])),
    "",
    section("UNEXPECTED", ["ARCHIVE", "NAME"], report.unexpected.map((file) => [file.archive, file.name])),
    "",
    section("PROBLEMS", ["ARCHIVE", "REASON"], report.problems.map((problem) => [problem.archive, problem.reason])),
].join("\n");

// HELPER :: romSetReport -> NUMBER
// Maps the three audit verdicts onto the documented process statuses.
const reportExitCode = (report: RomSetReport): number => report.status === "ok" ? 0 : report.status === "incomplete" ? 2 : 3;

// COMMAND :: [STRING] -> VOID
// Reads one metadata file and the explicitly named zips, then prints exactly one report.
const main = (args: string[]): void => {
    const json = args.includes("--json");
    const biosIndex = args.indexOf("--bios");
    const bios = biosIndex >= 0 ? args[biosIndex + 1] : undefined;
    const positional = args.filter((arg, index) => arg !== "--json" && (biosIndex < 0 || (index !== biosIndex && index !== biosIndex + 1)));
    if (positional.length < 3 || positional.some((arg) => arg.startsWith("--"))) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    const [romsetsDirectory, machine, ...zipPaths] = positional as [string, string, ...string[]];
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(romsetsDirectory, `${machine}.json`), "utf8"));
        if (!isRomSetMetadata(parsed) || parsed.machine.toLowerCase() !== machine.toLowerCase()) {
            throw new Error("Metadata is invalid or does not match the requested machine.");
        }
        const roms: RomFile[] = zipPaths.map((path) => ({
            name: basename(path),
            bytes: new Uint8Array(readFileSync(path)),
        }));
        const report = RomSetAudit.audit(parsed, roms, bios === undefined ? {} : { bios });
        console.log(json ? JSON.stringify(report, null, 2) : renderReport(report));
        process.exitCode = reportExitCode(report);
    } catch (error) {
        const message = ArcadeRuntimeError.is(error)
            ? error.message
            : error instanceof Error ? error.message : "Metadata or archive input could not be read.";
        console.error(`arcade-audit-roms: ${message}`);
        process.exitCode = 1;
    }
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    main(process.argv.slice(2));
}
