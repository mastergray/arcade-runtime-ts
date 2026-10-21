// realizes: docs/arcade-runtime-spec.md > §3 ArcadeRuntimeError

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import {
    ArcadeRuntimeError,                                          // Class under test, via the public surface
    isArcadeRuntimeErrorConfig,                                  // Config predicate under test
    isNonEmptyString,                                            // Shared check that a thrown message says something
} from "../../src/index.ts";
import {
    errorSnapshot,                                               // Reduces a thrown value to {isRuntimeError, code, label}
    thrownBy,                                                    // Captures a thrown value for comparison
} from "../support/fixtures.ts";

// Type dependencies:
import type { ArcadeRuntimeErrorConfig } from "../../src/index.ts";   // Config shape; invalid inputs are cast to it
import type { ErrorSnapshot } from "../support/fixtures.ts";          // Snapshot shape for equals comparison
import type { TestCase, TestFile } from "../run.ts";                  // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: errorSnapshot & {data:UNKNOWN}
// A thrown-value snapshot that also carries data.
interface ThrownSnapshot extends ErrorSnapshot {
    data: unknown;                                               // error.data, compared as given
}

/**
 *
 * Constants
 *
 */

const CODE_TABLE = {                                             // The registry as §3 lists it
    INVALID_CODE: -1,
    INVALID_CONFIG: 1,
    INVALID_MESSAGE: 2,
    INTERNAL_ERROR: 3,
    ADAPTER_FAILED: 4,
    ROM_LOAD_FAILED: 5,
    ROM_SET_INVALID: 6,
    MACHINE_NOT_IN_BUILD: 7,
    NOT_STARTED: 8,
    ALREADY_STARTED: 9,
    DESTROYED: 10,
    FULLSCREEN_FAILED: 11,
    AUDIO_FAILED: 12,
    STORAGE_FAILED: 13,
    STATE_FAILED: 14,
    UNSUPPORTED: 15,
    OVERLAY_INCOMPATIBLE: 16,
    MEMORY_EXCEEDED: 17,
} as const;

// HELPER :: UNKNOWN -> thrownSnapshot
// Snapshot of a thrown value including its data.
const thrownSnapshot = (value: unknown): ThrownSnapshot => ({
    ...errorSnapshot(value, ArcadeRuntimeError),
    data: ArcadeRuntimeError.is(value) ? value.data : undefined,
});

// HELPER :: UNKNOWN -> arcadeRuntimeErrorConfig
// Marks a deliberately invalid config as the config type so the constructor can be handed it.
const invalidConfig = (value: unknown): ArcadeRuntimeErrorConfig => value as ArcadeRuntimeErrorConfig;

// HELPER :: STRING, NUMBER -> testCase
// Case: a registered code is accepted and read back.
const acceptsCode = (label: string, code: number): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .stage("construct", () => new ArcadeRuntimeError({ code, message: "m" }))
        .assert("code and label read back", (state) => ({ code: state.subject.code, label: state.subject.label }), P.equals<{ code: number; label: string }>({ code, label: ArcadeRuntimeError.labelOf(code) }))
        .start(undefined),
});

// HELPER :: STRING, NUMBER -> testCase
// Case: an unregistered code throws INVALID_CODE with data the rejected number.
const rejectsCode = (label: string, code: number): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .stage("construct", () => thrownBy(() => new ArcadeRuntimeError({ code, message: "m" })))
        .assert("throws INVALID_CODE with data the code", (state) => thrownSnapshot(state.subject), P.equals<ThrownSnapshot>({ isRuntimeError: true, code: -1, label: "INVALID_CODE", data: code }))
        .start(undefined),
});

// HELPER :: STRING, arcadeRuntimeErrorConfig, UNKNOWN -> testCase
// Case: a bad message throws INVALID_MESSAGE with data the rejected message (null when absent or undefined).
const rejectsMessage = (label: string, config: ArcadeRuntimeErrorConfig, data: unknown): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .stage("construct", () => thrownBy(() => new ArcadeRuntimeError(config)))
        .assert("throws INVALID_MESSAGE", (state) => thrownSnapshot(state.subject), P.equals<ThrownSnapshot>({ isRuntimeError: true, code: 2, label: "INVALID_MESSAGE", data }))
        .start(undefined),
});

const testFile: TestFile = {
    label: "ArcadeRuntimeError",
    cases: [
        {
            label: "CODE holds exactly the eighteen registry entries of §3",
            run: () => CTGTest.init("CODE registry")
                .assert("registry matches the spec table", () => ArcadeRuntimeError.CODE, P.equals<Record<string, number>>(CODE_TABLE))
                .start(undefined),
        },
        acceptsCode("constructor accepts the first registered code, 1", 1),
        acceptsCode("constructor accepts the last registered code, 17", 17),
        rejectsCode("constructor rejects 0 with INVALID_CODE", 0),
        rejectsCode("constructor rejects 18 with INVALID_CODE", 18),
        rejectsCode("constructor rejects the -1 sentinel with INVALID_CODE", -1),
        {
            label: "constructor rejects a config that is not an object with INVALID_CODE and data null",
            run: () => CTGTest.init("non-object config")
                .stage("construct", () => thrownBy(() => new ArcadeRuntimeError(invalidConfig(null))))
                .assert("throws INVALID_CODE with null data", (state) => thrownSnapshot(state.subject), P.equals<ThrownSnapshot>({ isRuntimeError: true, code: -1, label: "INVALID_CODE", data: null }))
                .start(undefined),
        },
        {
            label: "constructor rejects a config whose code is not a number with INVALID_CODE and data null",
            run: () => CTGTest.init("string code")
                .stage("construct", () => thrownBy(() => new ArcadeRuntimeError(invalidConfig({ code: "1", message: "m" }))))
                .assert("throws INVALID_CODE with null data", (state) => thrownSnapshot(state.subject), P.equals<ThrownSnapshot>({ isRuntimeError: true, code: -1, label: "INVALID_CODE", data: null }))
                .start(undefined),
        },
        rejectsMessage("constructor rejects message \"\" with INVALID_MESSAGE", { code: 1, message: "" }, ""),
        rejectsMessage("constructor rejects message \"  \" with INVALID_MESSAGE", { code: 1, message: "  " }, "  "),
        rejectsMessage("constructor rejects an absent message with INVALID_MESSAGE and data null", invalidConfig({ code: 1 }), null),
        {
            label: "a thrown construction error has a message for which isNonEmptyString is true",
            run: () => CTGTest.init("thrown message")
                .stage("construct with a bad code and with a bad message", () => [
                    thrownBy(() => new ArcadeRuntimeError({ code: 0, message: "m" })),
                    thrownBy(() => new ArcadeRuntimeError({ code: 1, message: "" })),
                ])
                .assert("both messages say something", (state) => state.subject.map((thrown) => ArcadeRuntimeError.is(thrown) && isNonEmptyString(thrown.message)), P.equals<boolean[]>([true, true]))
                .start(undefined),
        },
        {
            label: "the prototype of a thrown construction error is exactly ArcadeRuntimeError.prototype, from this class and from a subclass",
            run: () => CTGTest.init("thrown prototype")
                .stage("construct rejected configs on both classes", () => {
                    class SubError extends ArcadeRuntimeError {}
                    return [
                        thrownBy(() => new ArcadeRuntimeError({ code: 0, message: "m" })),
                        thrownBy(() => new SubError({ code: 0, message: "m" })),
                        thrownBy(() => new SubError({ code: 1, message: "" })),
                    ];
                })
                .assert("every prototype is ArcadeRuntimeError.prototype", (state) => state.subject.map((thrown) => Object.getPrototypeOf(thrown) === ArcadeRuntimeError.prototype), P.equals<boolean[]>([true, true, true]))
                .start(undefined),
        },
        {
            label: "data is stored by reference and is null when omitted or undefined",
            run: () => CTGTest.init("data field")
                .stage("construct with each data form", () => {
                    const error = new Error("caught");
                    return {
                        error,
                        omitted: new ArcadeRuntimeError({ code: 1, message: "m" }),
                        undefinedData: new ArcadeRuntimeError({ code: 1, message: "m", data: undefined }),
                        zero: new ArcadeRuntimeError({ code: 1, message: "m", data: 0 }),
                        falseData: new ArcadeRuntimeError({ code: 1, message: "m", data: false }),
                        errorData: new ArcadeRuntimeError({ code: 1, message: "m", data: error }),
                    };
                })
                .assert("each reads back as given, the Error by reference", (state) => ({
                    omitted: state.subject.omitted.data,
                    undefinedData: state.subject.undefinedData.data,
                    zero: state.subject.zero.data,
                    falseData: state.subject.falseData.data,
                    errorIsSame: state.subject.errorData.data === state.subject.error,
                }), P.equals<{ omitted: unknown; undefinedData: unknown; zero: unknown; falseData: unknown; errorIsSame: boolean }>({
                    omitted: null, undefinedData: null, zero: 0, falseData: false, errorIsSame: true,
                }))
                .start(undefined),
        },
        {
            label: "code, message, name and data read back from a valid config and the instance is an Error",
            run: () => CTGTest.init("valid construction")
                .stage("construct", () => new ArcadeRuntimeError({ code: 6, message: "audit failed", data: { missing: ["neogeo.zip"] } }))
                .assert("fields read back", (state) => ({
                    code: state.subject.code,
                    label: state.subject.label,
                    message: state.subject.message,
                    name: state.subject.name,
                    data: state.subject.data,
                    isError: state.subject instanceof Error,
                    is: ArcadeRuntimeError.is(state.subject),
                }), P.equals<{ code: number; label: string; message: string; name: string; data: unknown; isError: boolean; is: boolean }>({
                    code: 6, label: "ROM_SET_INVALID", message: "audit failed", name: "ArcadeRuntimeError", data: { missing: ["neogeo.zip"] }, isError: true, is: true,
                }))
                .start(undefined),
        },
        {
            label: "init mirrors the constructor and returns the receiving class",
            run: () => CTGTest.init("init")
                .stage("construct through init on the class and a subclass", () => {
                    class SubError extends ArcadeRuntimeError {}
                    return { base: ArcadeRuntimeError.init({ code: 3, message: "m" }), sub: SubError.init({ code: 3, message: "m" }), SubError };
                })
                .assert("both are instances of their class", (state) => ({
                    base: state.subject.base instanceof ArcadeRuntimeError && state.subject.base.code === 3,
                    sub: state.subject.sub instanceof state.subject.SubError,
                }), P.equals<{ base: boolean; sub: boolean }>({ base: true, sub: true }))
                .start(undefined),
        },
        {
            label: "is() rejects a plain Error and a non-object",
            run: () => CTGTest.init("is")
                .assert("neither is a runtime error", () => [ArcadeRuntimeError.is(new Error("x")), ArcadeRuntimeError.is("x")], P.equals<boolean[]>([false, false]))
                .start(undefined),
        },
        {
            label: "labelOf returns INVALID_CODE for -1 and for an unregistered number",
            run: () => CTGTest.init("labelOf")
                .assert("labels", () => [ArcadeRuntimeError.labelOf(-1), ArcadeRuntimeError.labelOf(99), ArcadeRuntimeError.labelOf(17)], P.equals<string[]>(["INVALID_CODE", "INVALID_CODE", "MEMORY_EXCEEDED"]))
                .start(undefined),
        },
        {
            label: "isArcadeRuntimeErrorConfig accepts a numeric code with a non-empty message and rejects otherwise",
            run: () => CTGTest.init("config predicate")
                .assert("verdicts", () => [
                    isArcadeRuntimeErrorConfig({ code: 1, message: "m" }),
                    isArcadeRuntimeErrorConfig({ code: 1, message: "m", data: null }),
                    isArcadeRuntimeErrorConfig({ code: "1", message: "m" }),
                    isArcadeRuntimeErrorConfig({ code: 1, message: " " }),
                    isArcadeRuntimeErrorConfig(null),
                ], P.equals<boolean[]>([true, true, false, false, false]))
                .start(undefined),
        },
    ],
};

export default testFile;
