// realizes: docs/arcade-runtime-spec.md > §2.4 Save-overlay wire format

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";    // Pipeline API and predicate builders
import { strToU8, zipSync } from "fflate";                        // Synthetic hostile archive construction
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed rejection identity
import OverlayCodec, { OVERLAY_LIMITS, type OverlayHeader, type OverlayTree } from "../../src/MameEmulatorAdapter/OverlayCodec.ts";
import { errorSnapshot, thrownBy, type ErrorSnapshot } from "../support/fixtures.ts";   // Stable error capture

// Type dependencies:
import type { TestCase, TestFile } from "../run.ts";              // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const HEADER: OverlayHeader = {
    format: "arcade-runtime-overlay",
    version: 1,
    adapter: "mame",
    engine: "synthetic-family",
    buildId: "0".repeat(64),
    machine: "synthetic-machine",
};                                                               // Synthetic identity only; no private ROM data
const MTIME = new Date(2000, 0, 1);                               // Fixed timestamp for hostile fixtures

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN, {[STRING]:UINT8ARRAY} -> UINT8ARRAY
// Builds an archive without going through the production writer, so reader rejection paths can be exercised.
const rawOverlay = (header: unknown, tree: Record<string, Uint8Array> = {}): Uint8Array => {
    const entries: Record<string, Uint8Array | [Uint8Array, { mtime: Date; os?: number; attrs?: number }]> = {
        "overlay.json": [strToU8(JSON.stringify(header)), { mtime: MTIME }],
    };
    for (const [path, bytes] of Object.entries(tree)) entries[path] = [bytes, { mtime: MTIME }];
    return zipSync(entries, { level: 6, mtime: MTIME });
};

// HELPER :: STRING, UINT8ARRAY -> testCase
// One independent INVALID_CONFIG reader rejection.
const invalidArchiveCase = (label: string, bytes: Uint8Array): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert("INVALID_CONFIG", () => errorSnapshot(thrownBy(() => OverlayCodec.decode(bytes, HEADER)), ArcadeRuntimeError), P.equals<ErrorSnapshot>({
            isRuntimeError: true,
            code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
            label: "INVALID_CONFIG",
        }))
        .start(undefined),
});

// HELPER :: STRING, UNKNOWN -> testCase
// One independent strict-header OVERLAY_INCOMPATIBLE rejection.
const incompatibleHeaderCase = (label: string, header: unknown): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert("OVERLAY_INCOMPATIBLE", () => errorSnapshot(thrownBy(() => OverlayCodec.decode(rawOverlay(header), HEADER)), ArcadeRuntimeError), P.equals<ErrorSnapshot>({
            isRuntimeError: true,
            code: ArcadeRuntimeError.CODE.OVERLAY_INCOMPATIBLE,
            label: "OVERLAY_INCOMPATIBLE",
        }))
        .start(undefined),
});

// HELPER :: UINT8ARRAY -> UINT8ARRAY
// Changes the first persisted entry's central-directory expanded size to 256 MiB + 1 without growing its payload.
const zipBombMetadata = (source: Uint8Array): Uint8Array => {
    const bytes = source.slice();
    const signature = [0x50, 0x4b, 0x01, 0x02];
    let seen = 0;
    for (let offset = 0; offset <= bytes.length - 46; offset++) {
        if (signature.every((byte, index) => bytes[offset + index] === byte)) {
            if (seen++ === 1) {
                const size = OVERLAY_LIMITS.expandedBytes + 1;
                bytes[offset + 24] = size & 0xff;
                bytes[offset + 25] = size >>> 8 & 0xff;
                bytes[offset + 26] = size >>> 16 & 0xff;
                bytes[offset + 27] = size >>> 24 & 0xff;
                return bytes;
            }
        }
    }
    throw new Error("synthetic archive lacked a second central entry");
};

const tooManyFiles: Record<string, Uint8Array> = {};
for (let index = 0; index <= OVERLAY_LIMITS.files; index++) tooManyFiles[`nvram/file-${index}`] = new Uint8Array();

const symlinkEntries: Record<string, Uint8Array | [Uint8Array, { mtime: Date; os?: number; attrs?: number }]> = {
    "overlay.json": [strToU8(JSON.stringify(HEADER)), { mtime: MTIME }],
    "nvram/link": [strToU8("target"), { mtime: MTIME, os: 3, attrs: 0o120777 << 16 }],
};

const testFile: TestFile = {
    label: "MAME overlay codec",
    cases: [
        {
            label: "complete trees round-trip as defensive byte copies",
            run: () => CTGTest.init("overlay round trip")
                .assert("all logical roots survive", () => {
                    const tree: Record<string, Uint8Array> = {
                        "states/slot.sta": new Uint8Array([7, 8, 9]),
                        "cfg/machine.cfg": new Uint8Array([4, 5]),
                        "nvram/device.nv": new Uint8Array([1, 2, 3]),
                        "memcard/card.bin": new Uint8Array([6]),
                    };
                    const encoded = OverlayCodec.encode(tree, HEADER);
                    tree["nvram/device.nv"]![0] = 99;
                    const decoded = OverlayCodec.decode(encoded, HEADER);
                    return Object.fromEntries(Object.entries(decoded).map(([path, bytes]) => [path, Array.from(bytes)]));
                }, P.equals<unknown>({
                    "cfg/machine.cfg": [4, 5],
                    "memcard/card.bin": [6],
                    "nvram/device.nv": [1, 2, 3],
                    "states/slot.sta": [7, 8, 9],
                }))
                .start(undefined),
        },
        {
            label: "equal trees produce byte-identical archives and hashes regardless of insertion order",
            run: () => CTGTest.init("overlay determinism")
                .assert("archive and hash equality", () => {
                    const left: OverlayTree = { "states/z": new Uint8Array([3]), "nvram/a": new Uint8Array([1, 2]) };
                    const right: OverlayTree = { "nvram/a": new Uint8Array([1, 2]), "states/z": new Uint8Array([3]) };
                    const changed: OverlayTree = { "nvram/a": new Uint8Array([1, 9]), "states/z": new Uint8Array([3]) };
                    return {
                        bytesEqual: Buffer.compare(OverlayCodec.encode(left, HEADER), OverlayCodec.encode(right, HEADER)) === 0,
                        hashesEqual: OverlayCodec.hashTree(left) === OverlayCodec.hashTree(right),
                        changedDiffers: OverlayCodec.hashTree(left) !== OverlayCodec.hashTree(changed),
                    };
                }, P.equals<unknown>({ bytesEqual: true, hashesEqual: true, changedDiffers: true }))
                .start(undefined),
        },
        incompatibleHeaderCase("format mismatch is incompatible", { ...HEADER, format: "other-overlay" }),
        incompatibleHeaderCase("version mismatch is incompatible", { ...HEADER, version: 2 }),
        incompatibleHeaderCase("adapter mismatch is incompatible", { ...HEADER, adapter: "other" }),
        incompatibleHeaderCase("engine mismatch is incompatible", { ...HEADER, engine: "other-family" }),
        incompatibleHeaderCase("build mismatch is incompatible", { ...HEADER, buildId: "1".repeat(64) }),
        incompatibleHeaderCase("machine mismatch is incompatible", { ...HEADER, machine: "other-machine" }),
        invalidArchiveCase("absolute paths reject", rawOverlay(HEADER, { "/nvram/file": new Uint8Array() })),
        invalidArchiveCase("backslashes reject", rawOverlay(HEADER, { "nvram\\file": new Uint8Array() })),
        invalidArchiveCase("NUL bytes reject", rawOverlay(HEADER, { "nvram/fi\0le": new Uint8Array() })),
        invalidArchiveCase("empty path segments reject", rawOverlay(HEADER, { "nvram//file": new Uint8Array() })),
        invalidArchiveCase("dot path segments reject", rawOverlay(HEADER, { "nvram/./file": new Uint8Array() })),
        invalidArchiveCase("dot-dot path segments reject", rawOverlay(HEADER, { "nvram/../file": new Uint8Array() })),
        invalidArchiveCase("entries outside logical roots reject", rawOverlay(HEADER, { "other/file": new Uint8Array() })),
        invalidArchiveCase("duplicate case-folded paths reject", rawOverlay(HEADER, { "nvram/File": new Uint8Array(), "NVRAM/file": new Uint8Array() })),
        invalidArchiveCase("symbolic links reject", zipSync(symlinkEntries, { level: 6, mtime: MTIME })),
        invalidArchiveCase("the 4,096-file limit rejects the next file", rawOverlay(HEADER, tooManyFiles)),
        invalidArchiveCase("compressed archives over 64 MiB reject before zip parsing", new Uint8Array(OVERLAY_LIMITS.compressedBytes + 1)),
        invalidArchiveCase("expanded zip-bomb metadata rejects before payload inflation", zipBombMetadata(rawOverlay(HEADER, { "nvram/tiny": new Uint8Array([1]) }))),
        invalidArchiveCase("corrupt zip bytes reject", new Uint8Array([1, 2, 3, 4])),
        {
            label: "writer applies the same path, duplicate, file and expanded-size rules",
            run: () => CTGTest.init("overlay writer validation")
                .assert("invalid path", () => errorSnapshot(thrownBy(() => OverlayCodec.encode({ "cfg/../bad": new Uint8Array() }, HEADER)), ArcadeRuntimeError), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .assert("duplicate", () => errorSnapshot(thrownBy(() => OverlayCodec.encode({ "cfg/A": new Uint8Array(), "CFG/a": new Uint8Array() }, HEADER)), ArcadeRuntimeError), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .assert("file limit", () => errorSnapshot(thrownBy(() => OverlayCodec.encode(tooManyFiles, HEADER)), ArcadeRuntimeError), P.equals<ErrorSnapshot>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .start(undefined),
        },
    ],
};

export default testFile;
