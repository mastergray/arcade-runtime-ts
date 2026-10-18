// realizes: docs/mame-game-runtime-spec.md > §13.1 P6 pthread requirement

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import {
    inspectWasmMemories,
    threadRuntimeMarkers,
} from "../../scripts/inspect-mame-threading.ts";               // P6 artifact inspector

// Type dependencies:
import type { WasmMemory } from "../../scripts/inspect-mame-threading.ts"; // Inspector result contract
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Functions
 *
 */

// HELPER :: BOOLEAN -> UINT8ARRAY
// Builds a minimal module importing fixed env.memory with optional shared flag.
const memoryImportModule = (shared: boolean): Uint8Array => new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x02, 0x12,
    0x01,
    0x03, 0x65, 0x6e, 0x76,
    0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79,
    0x02,
    shared ? 0x03 : 0x01,
    0x80, 0x20,
    0x80, 0x20,
]);

const testFile: TestFile = {
    label: "MAME WebAssembly threading inspector",
    cases: [
        {
            label: "reads fixed imported memory and its authoritative shared flag",
            run: () => CTGTest.init("WebAssembly memory limits")
                .assert(
                    "recognizes a non-shared 4,096-page memory",
                    () => inspectWasmMemories(memoryImportModule(false)),
                    P.equals<WasmMemory[]>([{
                        source: "imported",
                        module: "env",
                        name: "memory",
                        minimumPages: 4_096,
                        maximumPages: 4_096,
                        shared: false,
                    }]),
                )
                .assert(
                    "recognizes the same memory when its shared bit is set",
                    () => inspectWasmMemories(memoryImportModule(true))[0]?.shared === true,
                    P.equals(true),
                )
                .start(undefined),
        },
        {
            label: "distinguishes libc stubs from an Emscripten threaded loader",
            run: () => CTGTest.init("JavaScript thread markers")
                .assert(
                    "lowercase compatibility stubs do not imply pthread support",
                    () => threadRuntimeMarkers("function _pthread_create(){return 11}"),
                    P.equals<string[]>([]),
                )
                .assert(
                    "shared memory and the PThread loader are decisive markers",
                    () => threadRuntimeMarkers("new SharedArrayBuffer(1); PThread.init();"),
                    P.equals(["SharedArrayBuffer", "PThread"]),
                )
                .start(undefined),
        },
    ],
};

export default testFile;
