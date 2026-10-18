#!/usr/bin/env -S node --import tsx

// Dependencies:
import { existsSync, readFileSync } from "node:fs";              // Reads generated JavaScript and WebAssembly artifacts
import { basename, resolve } from "node:path";                  // Normalizes artifact stems for reports
import { pathToFileURL } from "node:url";                       // Detects direct command-line execution

/**
 *
 * Type Declarations
 *
 */

export interface WasmMemory {
    source: "defined" | "imported";
    module?: string;
    name?: string;
    minimumPages: number;
    maximumPages: number | null;
    shared: boolean;
}

export interface ThreadingInspection {
    artifact: string;
    memories: WasmMemory[];
    fixedMemory: boolean;
    runtimeMarkers: string[];
    workerArtifact: boolean;
    requiresPthreads: boolean;
}

/**
 *
 * Constants
 *
 */

const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00] as const;
const THREAD_RUNTIME_MARKERS = [
    "SharedArrayBuffer",
    "Atomics.",
    "PThread",
    "ENVIRONMENT_IS_PTHREAD",
    ".worker.js",
    "pthread-main",
] as const;
const decoder = new TextDecoder();

/**
 *
 * Classes
 *
 */

class WasmReader {
    offset = 0;

    constructor(
        readonly bytes: Uint8Array,
        readonly end = bytes.length,
    ) {}

    byte(): number {
        if (this.offset >= this.end) throw new Error("Unexpected end of WebAssembly binary");
        return this.bytes[this.offset++]!;
    }

    varUint32(): number {
        let result = 0;
        let shift = 0;
        for (let index = 0; index < 5; index++) {
            const value = this.byte();
            result += (value & 0x7f) * 2 ** shift;
            if ((value & 0x80) === 0) return result >>> 0;
            shift += 7;
        }
        throw new Error("Invalid WebAssembly varuint32");
    }

    name(): string {
        const length = this.varUint32();
        const end = this.offset + length;
        if (end > this.end) throw new Error("Invalid WebAssembly name length");
        const value = decoder.decode(this.bytes.subarray(this.offset, end));
        this.offset = end;
        return value;
    }

    section(length: number): WasmReader {
        const end = this.offset + length;
        if (end > this.end) throw new Error("Invalid WebAssembly section length");
        const section = new WasmReader(this.bytes, end);
        section.offset = this.offset;
        this.offset = end;
        return section;
    }
}

/**
 *
 * Functions
 *
 */

// HELPER :: wasmReader, SOURCE, STRING?, STRING? -> wasmMemory
// Reads the limits flags whose shared bit is authoritative for WebAssembly threads.
const readMemory = (
    reader: WasmReader,
    source: WasmMemory["source"],
    module?: string,
    name?: string,
): WasmMemory => {
    const flags = reader.varUint32();
    const minimumPages = reader.varUint32();
    const maximumPages = (flags & 0x01) === 0 ? null : reader.varUint32();
    return {
        source,
        ...(module === undefined ? {} : { module }),
        ...(name === undefined ? {} : { name }),
        minimumPages,
        maximumPages,
        shared: (flags & 0x02) !== 0,
    };
};

// HELPER :: wasmReader -> VOID
// Skips an imported table's element type and limits.
const skipTable = (reader: WasmReader): void => {
    reader.byte();
    const flags = reader.varUint32();
    reader.varUint32();
    if ((flags & 0x01) !== 0) reader.varUint32();
};

// PUBLIC :: UINT8ARRAY -> [wasmMemory]
// Parses imported and module-defined memory declarations without external tools.
export const inspectWasmMemories = (bytes: Uint8Array): WasmMemory[] => {
    if (bytes.length < WASM_HEADER.length
        || !WASM_HEADER.every((value, index) => bytes[index] === value)) {
        throw new Error("Not a WebAssembly 1 binary");
    }

    const reader = new WasmReader(bytes);
    reader.offset = WASM_HEADER.length;
    const memories: WasmMemory[] = [];

    while (reader.offset < reader.end) {
        const sectionId = reader.byte();
        const section = reader.section(reader.varUint32());

        if (sectionId === 2) {
            const count = section.varUint32();
            for (let index = 0; index < count; index++) {
                const module = section.name();
                const name = section.name();
                const kind = section.byte();
                if (kind === 0) section.varUint32();
                else if (kind === 1) skipTable(section);
                else if (kind === 2) memories.push(readMemory(section, "imported", module, name));
                else if (kind === 3) {
                    section.byte();
                    section.byte();
                } else if (kind === 4) {
                    section.varUint32();
                    section.varUint32();
                } else {
                    throw new Error(`Unknown WebAssembly import kind: ${kind}`);
                }
            }
        } else if (sectionId === 5) {
            const count = section.varUint32();
            for (let index = 0; index < count; index++) {
                memories.push(readMemory(section, "defined"));
            }
        }
    }

    return memories;
};

// PUBLIC :: STRING -> [STRING]
// Ignores lowercase libc pthread stubs and selects only threaded-loader signals.
export const threadRuntimeMarkers = (javaScript: string): string[] =>
    THREAD_RUNTIME_MARKERS.filter((marker) => javaScript.includes(marker));

// PUBLIC :: STRING -> threadingInspection
// Inspects matching <stem>.js/.wasm files plus an optional worker artifact.
export const inspectThreading = (input: string): ThreadingInspection => {
    const stem = input.endsWith(".wasm") || input.endsWith(".js")
        ? input.slice(0, input.lastIndexOf("."))
        : input;
    const memories = inspectWasmMemories(readFileSync(`${stem}.wasm`));
    const runtimeMarkers = threadRuntimeMarkers(readFileSync(`${stem}.js`, "utf8"));
    const workerArtifact = existsSync(`${stem}.worker.js`);
    const requiresPthreads = workerArtifact
        || runtimeMarkers.length > 0
        || memories.some((memory) => memory.shared);

    return {
        artifact: basename(stem),
        memories,
        fixedMemory: memories.length > 0
            && memories.every((memory) => memory.maximumPages === memory.minimumPages),
        runtimeMarkers,
        workerArtifact,
        requiresPthreads,
    };
};

// COMMAND :: [STRING] -> VOID
// Prints stable JSON and fails if any inspected artifact requires pthreads.
const main = (inputs: string[]): void => {
    if (inputs.length === 0) {
        console.error("Usage: inspect-mame-threading <artifact-stem> ...");
        process.exitCode = 2;
        return;
    }

    const inspections = inputs.map(inspectThreading);
    console.log(JSON.stringify(inspections, null, 2));
    if (inspections.some((inspection) => inspection.requiresPthreads)) process.exitCode = 1;
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    main(process.argv.slice(2));
}
