// realizes: docs/arcade-runtime-spec.md > §4.4 Generated controller config (exact web.cfg text and token coverage)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import { controllerConfigFor } from "../../src/ControllerConfig/controllerConfigFor.ts";   // Internal pure generator under test
import { isControllerConfig } from "../../src/ControllerConfig/types.ts";   // Internal config guard
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed invalid-config identity
import { errorSnapshot, thrownBy, type ErrorSnapshot } from "../support/fixtures.ts";   // Error capture helpers

// Type dependencies:
import type { ControllerConfig } from "../../src/ControllerConfig/types.ts";   // Invalid generator input cast
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const ONE_PLAYER = `<?xml version="1.0"?>
<mameconfig version="10">
    <system name="default">
        <input>
            <port type="P1_JOYSTICK_UP"><newseq type="standard">JOYCODE_1_HAT1UP</newseq></port>
            <port type="P1_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_1_HAT1DOWN</newseq></port>
            <port type="P1_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_1_HAT1LEFT</newseq></port>
            <port type="P1_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_1_HAT1RIGHT</newseq></port>
            <port type="P1_BUTTON1"><newseq type="standard">JOYCODE_1_BUTTON1</newseq></port>
            <port type="P1_BUTTON2"><newseq type="standard">JOYCODE_1_BUTTON2</newseq></port>
            <port type="P1_BUTTON3"><newseq type="standard">JOYCODE_1_BUTTON3</newseq></port>
            <port type="P1_BUTTON4"><newseq type="standard">JOYCODE_1_BUTTON4</newseq></port>
            <port type="P1_BUTTON5"><newseq type="standard">JOYCODE_1_BUTTON5</newseq></port>
            <port type="P1_BUTTON6"><newseq type="standard">JOYCODE_1_BUTTON6</newseq></port>
            <port type="COIN1"><newseq type="standard">JOYCODE_1_BUTTON7</newseq></port>
            <port type="START1"><newseq type="standard">JOYCODE_1_BUTTON8</newseq></port>
            <port type="P1_SELECT"><newseq type="standard">JOYCODE_1_BUTTON9</newseq></port>
            <port type="SERVICE1"><newseq type="standard">JOYCODE_1_BUTTON10</newseq></port>
            <port type="SERVICE"><newseq type="standard">JOYCODE_1_BUTTON11</newseq></port>
            <port type="TILT"><newseq type="standard">JOYCODE_1_BUTTON12</newseq></port>
            <port type="TILT1"><newseq type="standard">JOYCODE_1_BUTTON12</newseq></port>
        </input>
    </system>
</mameconfig>
`;                                                                 // Exact one-player output with select

const FOUR_PLAYERS = `<?xml version="1.0"?>
<mameconfig version="10">
    <system name="default">
        <input>
            <port type="P1_JOYSTICK_UP"><newseq type="standard">JOYCODE_1_HAT1UP</newseq></port>
            <port type="P1_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_1_HAT1DOWN</newseq></port>
            <port type="P1_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_1_HAT1LEFT</newseq></port>
            <port type="P1_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_1_HAT1RIGHT</newseq></port>
            <port type="P1_BUTTON1"><newseq type="standard">JOYCODE_1_BUTTON1</newseq></port>
            <port type="P1_BUTTON2"><newseq type="standard">JOYCODE_1_BUTTON2</newseq></port>
            <port type="P1_BUTTON3"><newseq type="standard">JOYCODE_1_BUTTON3</newseq></port>
            <port type="P1_BUTTON4"><newseq type="standard">JOYCODE_1_BUTTON4</newseq></port>
            <port type="P1_BUTTON5"><newseq type="standard">JOYCODE_1_BUTTON5</newseq></port>
            <port type="P1_BUTTON6"><newseq type="standard">JOYCODE_1_BUTTON6</newseq></port>
            <port type="COIN1"><newseq type="standard">JOYCODE_1_BUTTON7</newseq></port>
            <port type="START1"><newseq type="standard">JOYCODE_1_BUTTON8</newseq></port>
            <port type="P2_JOYSTICK_UP"><newseq type="standard">JOYCODE_2_HAT1UP</newseq></port>
            <port type="P2_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_2_HAT1DOWN</newseq></port>
            <port type="P2_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_2_HAT1LEFT</newseq></port>
            <port type="P2_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_2_HAT1RIGHT</newseq></port>
            <port type="P2_BUTTON1"><newseq type="standard">JOYCODE_2_BUTTON1</newseq></port>
            <port type="P2_BUTTON2"><newseq type="standard">JOYCODE_2_BUTTON2</newseq></port>
            <port type="P2_BUTTON3"><newseq type="standard">JOYCODE_2_BUTTON3</newseq></port>
            <port type="P2_BUTTON4"><newseq type="standard">JOYCODE_2_BUTTON4</newseq></port>
            <port type="P2_BUTTON5"><newseq type="standard">JOYCODE_2_BUTTON5</newseq></port>
            <port type="P2_BUTTON6"><newseq type="standard">JOYCODE_2_BUTTON6</newseq></port>
            <port type="COIN2"><newseq type="standard">JOYCODE_2_BUTTON7</newseq></port>
            <port type="START2"><newseq type="standard">JOYCODE_2_BUTTON8</newseq></port>
            <port type="P3_JOYSTICK_UP"><newseq type="standard">JOYCODE_3_HAT1UP</newseq></port>
            <port type="P3_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_3_HAT1DOWN</newseq></port>
            <port type="P3_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_3_HAT1LEFT</newseq></port>
            <port type="P3_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_3_HAT1RIGHT</newseq></port>
            <port type="P3_BUTTON1"><newseq type="standard">JOYCODE_3_BUTTON1</newseq></port>
            <port type="P3_BUTTON2"><newseq type="standard">JOYCODE_3_BUTTON2</newseq></port>
            <port type="P3_BUTTON3"><newseq type="standard">JOYCODE_3_BUTTON3</newseq></port>
            <port type="P3_BUTTON4"><newseq type="standard">JOYCODE_3_BUTTON4</newseq></port>
            <port type="P3_BUTTON5"><newseq type="standard">JOYCODE_3_BUTTON5</newseq></port>
            <port type="P3_BUTTON6"><newseq type="standard">JOYCODE_3_BUTTON6</newseq></port>
            <port type="COIN3"><newseq type="standard">JOYCODE_3_BUTTON7</newseq></port>
            <port type="START3"><newseq type="standard">JOYCODE_3_BUTTON8</newseq></port>
            <port type="P4_JOYSTICK_UP"><newseq type="standard">JOYCODE_4_HAT1UP</newseq></port>
            <port type="P4_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_4_HAT1DOWN</newseq></port>
            <port type="P4_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_4_HAT1LEFT</newseq></port>
            <port type="P4_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_4_HAT1RIGHT</newseq></port>
            <port type="P4_BUTTON1"><newseq type="standard">JOYCODE_4_BUTTON1</newseq></port>
            <port type="P4_BUTTON2"><newseq type="standard">JOYCODE_4_BUTTON2</newseq></port>
            <port type="P4_BUTTON3"><newseq type="standard">JOYCODE_4_BUTTON3</newseq></port>
            <port type="P4_BUTTON4"><newseq type="standard">JOYCODE_4_BUTTON4</newseq></port>
            <port type="P4_BUTTON5"><newseq type="standard">JOYCODE_4_BUTTON5</newseq></port>
            <port type="P4_BUTTON6"><newseq type="standard">JOYCODE_4_BUTTON6</newseq></port>
            <port type="COIN4"><newseq type="standard">JOYCODE_4_BUTTON7</newseq></port>
            <port type="START4"><newseq type="standard">JOYCODE_4_BUTTON8</newseq></port>
            <port type="SERVICE1"><newseq type="standard">JOYCODE_1_BUTTON10</newseq></port>
            <port type="SERVICE"><newseq type="standard">JOYCODE_1_BUTTON11</newseq></port>
            <port type="TILT"><newseq type="standard">JOYCODE_1_BUTTON12</newseq></port>
            <port type="TILT1"><newseq type="standard">JOYCODE_1_BUTTON12</newseq></port>
        </input>
    </system>
</mameconfig>
`;                                                                 // Exact four-player output without select

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> [{type:STRING, code:STRING}]
// Extracts generated port-token pairs for explicit vocabulary assertions.
const portsOf = (xml: string): Array<{ type: string; code: string }> =>
    [...xml.matchAll(/<port type="([^"]+)"><newseq type="standard">([^<]+)<\/newseq><\/port>/g)]
        .map((match) => ({ type: match[1] ?? "", code: match[2] ?? "" }));

const testFile: TestFile = {
    label: "ControllerConfig",
    cases: [
        {
            label: "one player with select matches the complete web.cfg text exactly",
            run: () => CTGTest.init("one-player controller config")
                .assert("exact XML", () => controllerConfigFor({ players: 1, select: true }), P.equals<string>(ONE_PLAYER))
                .start(undefined),
        },
        {
            label: "four players without select matches the complete web.cfg text exactly",
            run: () => CTGTest.init("four-player controller config")
                .assert("exact XML", () => controllerConfigFor({ players: 4, select: false }), P.equals<string>(FOUR_PLAYERS))
                .start(undefined),
        },
        {
            label: "select true adds exactly one Pn_SELECT line per requested player and changes nothing else",
            run: () => CTGTest.init("select difference")
                .assert("only select lines differ", () => {
                    const without = controllerConfigFor({ players: 4, select: false });
                    const withSelect = controllerConfigFor({ players: 4, select: true });
                    const selectPorts = portsOf(withSelect).filter((entry) => entry.type.endsWith("_SELECT"));
                    const stripped = withSelect.split("\n").filter((line) => !line.includes("_SELECT\"")).join("\n");
                    return { selectPorts, strippedMatches: stripped === without };
                }, P.equals<unknown>({
                    selectPorts: [
                        { type: "P1_SELECT", code: "JOYCODE_1_BUTTON9" },
                        { type: "P2_SELECT", code: "JOYCODE_2_BUTTON9" },
                        { type: "P3_SELECT", code: "JOYCODE_3_BUTTON9" },
                        { type: "P4_SELECT", code: "JOYCODE_4_BUTTON9" },
                    ],
                    strippedMatches: true,
                }))
                .start(undefined),
        },
        {
            label: "every ArcadeControl variant has exactly the frozen port and joystick tokens, with two tilt ports",
            run: () => CTGTest.init("controller token vocabulary")
                .assert("token groups match §4.4", () => {
                    const ports = portsOf(controllerConfigFor({ players: 1, select: true }));
                    return {
                        directions: ports.filter((entry) => entry.type.startsWith("P1_JOYSTICK_")),
                        buttons: ports.filter((entry) => /^P1_BUTTON[1-6]$/.test(entry.type)),
                        coin: ports.filter((entry) => entry.type === "COIN1"),
                        start: ports.filter((entry) => entry.type === "START1"),
                        select: ports.filter((entry) => entry.type === "P1_SELECT"),
                        service: ports.filter((entry) => entry.type === "SERVICE1"),
                        test: ports.filter((entry) => entry.type === "SERVICE"),
                        tilt: ports.filter((entry) => entry.type === "TILT" || entry.type === "TILT1"),
                    };
                }, P.equals<unknown>({
                    directions: [
                        { type: "P1_JOYSTICK_UP", code: "JOYCODE_1_HAT1UP" },
                        { type: "P1_JOYSTICK_DOWN", code: "JOYCODE_1_HAT1DOWN" },
                        { type: "P1_JOYSTICK_LEFT", code: "JOYCODE_1_HAT1LEFT" },
                        { type: "P1_JOYSTICK_RIGHT", code: "JOYCODE_1_HAT1RIGHT" },
                    ],
                    buttons: [1, 2, 3, 4, 5, 6].map((button) => ({ type: `P1_BUTTON${button}`, code: `JOYCODE_1_BUTTON${button}` })),
                    coin: [{ type: "COIN1", code: "JOYCODE_1_BUTTON7" }],
                    start: [{ type: "START1", code: "JOYCODE_1_BUTTON8" }],
                    select: [{ type: "P1_SELECT", code: "JOYCODE_1_BUTTON9" }],
                    service: [{ type: "SERVICE1", code: "JOYCODE_1_BUTTON10" }],
                    test: [{ type: "SERVICE", code: "JOYCODE_1_BUTTON11" }],
                    tilt: [
                        { type: "TILT", code: "JOYCODE_1_BUTTON12" },
                        { type: "TILT1", code: "JOYCODE_1_BUTTON12" },
                    ],
                }))
                .start(undefined),
        },
        {
            label: "output is deterministic LF text with a final newline",
            run: () => CTGTest.init("controller config determinism")
                .assert("equal calls and newline policy", () => {
                    const first = controllerConfigFor({ players: 2, select: true });
                    const second = controllerConfigFor({ players: 2, select: true });
                    return { equal: first === second, hasCarriageReturn: first.includes("\r"), finalNewline: first.endsWith("\n") };
                }, P.equals<unknown>({ equal: true, hasCarriageReturn: false, finalNewline: true }))
                .start(undefined),
        },
        {
            label: "config predicate covers both fields and the generator rejects invalid config",
            run: () => CTGTest.init("controller config validation")
                .stage("inspect predicates and rejected generation", () => {
                    const rejected = { players: 0, select: "yes" } as unknown as ControllerConfig;
                    const thrown = thrownBy(() => controllerConfigFor(rejected));
                    return {
                        valid: isControllerConfig({ players: 4, select: false }),
                        missingPlayers: isControllerConfig({ select: true }),
                        badSelect: isControllerConfig({ players: 1, select: 1 }),
                        error: errorSnapshot(thrown, ArcadeRuntimeError),
                        dataMatches: ArcadeRuntimeError.is(thrown) && thrown.data === rejected,
                    };
                })
                .assert("predicate and INVALID_CONFIG behavior match", (state) => state.subject, P.equals<unknown>({
                    valid: true,
                    missingPlayers: false,
                    badSelect: false,
                    error: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" } satisfies ErrorSnapshot,
                    dataMatches: true,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
