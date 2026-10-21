// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer (ROM source resolution)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed failure identity
import RomSourceResolver from "../../src/ArcadePlayer/RomSourceResolver.ts";   // Internal resolver under test
import { errorSnapshot, rejectedBy } from "../support/fixtures.ts";   // Stable rejection snapshots

// Type dependencies:
import type { FetchLike, FetchResponseLike, RomSource } from "../../src/shared.types.ts";   // Resolver inputs
import type { TestFile } from "../run.ts";                       // Test manifest shape

/**
 *
 * Classes
 *
 */

// Blob whose read rejects, matching a picker object that became unreadable.
class UnreadableBlob extends Blob {
    // INSTANCE :: VOID -> PROMISE(ArrayBuffer)
    // Rejects every read with a private cause that must not escape in error data.
    override arrayBuffer(): Promise<ArrayBuffer> {
        return Promise.reject(new Error("private blob failure"));
    }
}

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY, BOOLEAN?, NUMBER? -> fetchResponseLike
// Builds one response whose body is detached from later source mutation.
const response = (bytes: Uint8Array, ok = true, status = 200): FetchResponseLike => ({
    ok,
    status,
    arrayBuffer: async () => bytes.slice().buffer,
});

const testFile: TestFile = {
    label: "ArcadePlayer ROM source resolver",
    cases: [
        {
            label: "URL, Blob and RomFile sources resolve in parallel, retain input order and copy every byte buffer",
            run: () => CTGTest.init("parallel resolution and copies")
                .stage("start two pending URL reads beside Blob and byte sources", async () => {
                    const releases = new Map<string, (value: FetchResponseLike) => void>();
                    const calls: string[] = [];
                    const fetcher: FetchLike = (url) => {
                        calls.push(url);
                        return new Promise((resolve) => { releases.set(url, resolve); });
                    };
                    const memory = new Uint8Array([7, 8]);
                    const sources: RomSource[] = [
                        "/sets/first.zip?download=1",
                        { name: "picked.zip", blob: new Blob([new Uint8Array([4, 5, 6])]) },
                        { name: "memory.zip", bytes: memory },
                        "https://example.invalid/sets/encoded%20name.zip#fragment",
                    ];
                    const pending = RomSourceResolver.resolve(sources, fetcher);
                    const startedTogether = calls.slice();
                    releases.get("https://example.invalid/sets/encoded%20name.zip#fragment")?.(response(new Uint8Array([9])));
                    releases.get("/sets/first.zip?download=1")?.(response(new Uint8Array([1, 2, 3])));
                    const resolved = await pending;
                    memory.fill(0);
                    return {
                        startedTogether,
                        names: resolved.map((rom) => rom.name),
                        bytes: resolved.map((rom) => Array.from(rom.bytes)),
                    };
                })
                .assert("all transports started before either settled and results preserve names, order and copies", (state) => state.subject,
                    P.equals<unknown>({
                        startedTogether: ["/sets/first.zip?download=1", "https://example.invalid/sets/encoded%20name.zip#fragment"],
                        names: ["first.zip", "picked.zip", "memory.zip", "encoded name.zip"],
                        bytes: [[1, 2, 3], [4, 5, 6], [7, 8], [9]],
                    }))
                .start(undefined),
        },
        {
            label: "a non-OK response and a network rejection become ROM_LOAD_FAILED naming only their URL",
            run: () => CTGTest.init("URL failures")
                .stage("resolve both failure modes", async () => {
                    const nonOk = await rejectedBy(RomSourceResolver.resolve(["/missing.zip"], async () => response(new Uint8Array([99]), false, 404)));
                    const network = await rejectedBy(RomSourceResolver.resolve(["/offline.zip"], async () => { throw new Error("private network detail"); }));
                    return {
                        nonOk: { ...errorSnapshot(nonOk, ArcadeRuntimeError), data: ArcadeRuntimeError.is(nonOk) ? nonOk.data : null },
                        network: { ...errorSnapshot(network, ArcadeRuntimeError), data: ArcadeRuntimeError.is(network) ? network.data : null },
                    };
                })
                .assert("both errors are typed and carry no response or byte data", (state) => state.subject, P.equals<unknown>({
                    nonOk: { isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED", data: "/missing.zip" },
                    network: { isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED", data: "/offline.zip" },
                }))
                .start(undefined),
        },
        {
            label: "an unreadable Blob becomes ROM_LOAD_FAILED naming its basename without exposing the read failure",
            run: () => CTGTest.init("Blob failure")
                .stage("attempt the unreadable picker source", async () => {
                    const error = await rejectedBy(RomSourceResolver.resolve([{ name: "picked.zip", blob: new UnreadableBlob() }], async () => response(new Uint8Array())));
                    return { ...errorSnapshot(error, ArcadeRuntimeError), data: ArcadeRuntimeError.is(error) ? error.data : null };
                })
                .assert("the error names only the picked basename", (state) => state.subject,
                    P.equals<unknown>({ isRuntimeError: true, code: 5, label: "ROM_LOAD_FAILED", data: "picked.zip" }))
                .start(undefined),
        },
        {
            label: "duplicate case-folded basenames reject with INVALID_CONFIG before any transport starts",
            run: () => CTGTest.init("duplicate names")
                .stage("supply the same basename through URL and bytes", async () => {
                    let fetchCalls = 0;
                    const error = await rejectedBy(RomSourceResolver.resolve([
                        "/sets/GAME.ZIP",
                        { name: "game.zip", bytes: new Uint8Array([1]) },
                    ], async () => { fetchCalls++; return response(new Uint8Array([2])); }));
                    return { snapshot: errorSnapshot(error, ArcadeRuntimeError), fetchCalls };
                })
                .assert("duplicate validation wins without reading either source", (state) => state.subject,
                    P.equals<unknown>({ snapshot: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }, fetchCalls: 0 }))
                .start(undefined),
        },
        {
            label: "a URL with no final path basename rejects with INVALID_CONFIG",
            run: () => CTGTest.init("missing URL basename")
                .stage("resolve a directory URL", async () => errorSnapshot(
                    await rejectedBy(RomSourceResolver.resolve(["/sets/"], async () => response(new Uint8Array()))),
                    ArcadeRuntimeError,
                ))
                .assert("the malformed source is a config error", (state) => state.subject,
                    P.equals<unknown>({ isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }))
                .start(undefined),
        },
    ],
};

export default testFile;
