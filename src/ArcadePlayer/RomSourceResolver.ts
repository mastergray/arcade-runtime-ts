// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer (parallel ROM source resolution)

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed load and duplicate-name failures
import {
    isRomFile,                                                     // Distinguishes in-memory sources
    isRomName,                                                     // Validates URL-derived basenames
    isRomSource,                                                   // Guards every caller source
    romNameKey,                                                    // Case-insensitive duplicate comparison
} from "../shared.types.js";

// Type dependencies:
import type { FetchLike, RomFile, RomSource } from "../shared.types.js";   // Inputs and resolved output

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {source:romSource, name:STRING}
// One validated source paired with the basename it will produce.
interface NamedSource {
    readonly source: RomSource;
    readonly name: string;
}

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Returns the decoded last URL-path segment using a fixed base for relative page URLs.
const basenameFromUrl = (source: string): string => {
    let pathname: string;
    try {
        pathname = new URL(source, "https://arcade-runtime.invalid/").pathname;
    } catch {
        throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "A ROM URL does not contain a valid basename.",
            data: source,
        });
    }
    const segment = pathname.split("/").at(-1) ?? "";
    let name = segment;
    try { name = decodeURIComponent(segment); } catch { /* Preserve an otherwise valid literal percent sequence. */ }
    if (!isRomName(name)) throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
        message: "A ROM URL must end with a valid archive basename.",
        data: source,
    });
    return name;
};

// HELPER :: romSource -> namedSource
// Validates one source and determines its output name without reading bytes.
const nameSource = (source: RomSource): NamedSource => {
    if (!isRomSource(source)) throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
        message: "A ROM source is invalid.",
        data: null,
    });
    if (typeof source === "string") return { source, name: basenameFromUrl(source) };
    return { source, name: source.name };
};

// HELPER :: namedSource, fetchLike -> PROMISE(romFile)
// Reads one source and maps every transport/read failure to a byte-free ROM_LOAD_FAILED.
const resolveOne = async ({ source, name }: NamedSource, fetcher: FetchLike): Promise<RomFile> => {
    if (typeof source === "string") {
        try {
            const response = await fetcher(source);
            if (!response.ok) throw new Error(`status ${response.status}`);
            return { name, bytes: new Uint8Array(await response.arrayBuffer()) };
        } catch {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.ROM_LOAD_FAILED,
                message: `The ROM at ${source} could not be loaded.`,
                data: source,
            });
        }
    }
    if (isRomFile(source)) return { name, bytes: source.bytes.slice() };
    try {
        return { name, bytes: new Uint8Array(await source.blob.arrayBuffer()) };
    } catch {
        throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.ROM_LOAD_FAILED,
            message: `The ROM ${name} could not be read.`,
            data: name,
        });
    }
};

/**
 *
 * Class
 *
 */

// Resolves user ROM inputs in parallel into defensively copied, uniquely named byte archives.
export default class RomSourceResolver {

    // Static-only service; source resolution carries no instance state.
    private constructor() {}

    /**
     *
     * Static Methods
     *
     */

    // STATIC :: [romSource], fetchLike -> PROMISE([romFile])
    // Names and validates every source, rejects duplicate folded basenames, then reads all bytes in parallel.
    static async resolve(sources: ReadonlyArray<RomSource>, fetcher: FetchLike): Promise<RomFile[]> {
        if (!Array.isArray(sources) || typeof fetcher !== "function") throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            message: "ROM resolution requires a source array and fetch function.",
            data: null,
        });
        const named = sources.map(nameSource);
        const seen = new Set<string>();
        for (const source of named) {
            const key = romNameKey(source.name);
            if (seen.has(key)) throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
                message: `ROM sources contain duplicate basename ${source.name}.`,
                data: source.name,
            });
            seen.add(key);
        }
        return Promise.all(named.map((source) => resolveOne(source, fetcher)));
    }
}
