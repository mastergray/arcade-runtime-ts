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

// HELPER :: STRING, STRING, STRING? -> STRING
// One exact expected controller-config row.
const expectedPort = (type: string, code: string, sequence = "standard"): string =>
    `            <port type="${type}"><newseq type="${sequence}">${code}</newseq></port>`;

// HELPER :: NUMBER -> [STRING]
// Every W26 row for one player, independent of the production generator.
const expectedExtended = (player: number): string[] => {
    const p = `P${player}_`;
    const j = `JOYCODE_${player}_`;
    const lines = [
        expectedPort(`${p}AD_STICK_X`, `${j}XAXIS`),
        expectedPort(`${p}PADDLE`, `${j}XAXIS`),
        expectedPort(`${p}AD_STICK_Y`, `${j}YAXIS`),
        expectedPort(`${p}PADDLE_V`, `${j}YAXIS`),
        expectedPort(`${p}AD_STICK_Z`, `${j}ZAXIS`),
        expectedPort(`${p}PEDAL`, `${j}RXAXIS`),
        expectedPort(`${p}PEDAL2`, `${j}RYAXIS`),
        expectedPort(`${p}DIAL`, `${j}ADDREL1`),
        expectedPort(`${p}TRACKBALL_X`, `${j}ADDREL1`),
        expectedPort(`${p}DIAL_V`, `${j}ADDREL2`),
        expectedPort(`${p}TRACKBALL_Y`, `${j}ADDREL2`),
    ];
    for (const type of ["AD_STICK_X", "PADDLE", "DIAL", "TRACKBALL_X", "POSITIONAL"]) {
        lines.push(expectedPort(`${p}${type}`, `${j}HAT1LEFT`, "decrement"));
        lines.push(expectedPort(`${p}${type}`, `${j}HAT1RIGHT`, "increment"));
    }
    for (const type of ["AD_STICK_Y", "PADDLE_V", "DIAL_V", "TRACKBALL_Y", "POSITIONAL_V"]) {
        lines.push(expectedPort(`${p}${type}`, `${j}HAT1UP`, "decrement"));
        lines.push(expectedPort(`${p}${type}`, `${j}HAT1DOWN`, "increment"));
    }
    lines.push(
        expectedPort(`${p}AD_STICK_Z`, `${j}BUTTON14`, "decrement"),
        expectedPort(`${p}AD_STICK_Z`, `${j}BUTTON13`, "increment"),
        expectedPort(`${p}PEDAL`, `${j}BUTTON13`, "increment"),
        expectedPort(`${p}PEDAL2`, `${j}BUTTON14`, "increment"),
        expectedPort(`${p}PEDAL3`, `${j}BUTTON15`, "increment"),
        expectedPort(`${p}JOYSTICKLEFT_UP`, `${j}HAT1UP OR ${j}HAT1RIGHT OR ${j}HAT3UP`),
        expectedPort(`${p}JOYSTICKLEFT_DOWN`, `${j}HAT1DOWN OR ${j}HAT1LEFT OR ${j}HAT3DOWN`),
        expectedPort(`${p}JOYSTICKRIGHT_UP`, `${j}HAT1UP OR ${j}HAT1LEFT OR ${j}HAT2UP`),
        expectedPort(`${p}JOYSTICKRIGHT_DOWN`, `${j}HAT1DOWN OR ${j}HAT1RIGHT OR ${j}HAT2DOWN`),
        expectedPort(`${p}JOYSTICKLEFT_LEFT`, `${j}HAT3LEFT`),
        expectedPort(`${p}JOYSTICKLEFT_RIGHT`, `${j}HAT3RIGHT`),
        expectedPort(`${p}JOYSTICKRIGHT_LEFT`, `${j}HAT2LEFT`),
        expectedPort(`${p}JOYSTICKRIGHT_RIGHT`, `${j}HAT2RIGHT`),
    );
    return lines;
};

// HELPER :: NUMBER, BOOLEAN -> STRING
// Exact complete expected XML for the requested player count.
const expectedConfig = (players: number, select: boolean): string => {
    const lines = ["<?xml version=\"1.0\"?>", "<mameconfig version=\"10\">", "    <system name=\"default\">", "        <input>"];
    for (let player = 1; player <= players; player++) {
        for (const direction of ["UP", "DOWN", "LEFT", "RIGHT"]) lines.push(expectedPort(`P${player}_JOYSTICK_${direction}`, `JOYCODE_${player}_HAT1${direction}`));
        for (let button = 1; button <= 6; button++) lines.push(expectedPort(`P${player}_BUTTON${button}`, `JOYCODE_${player}_BUTTON${button}`));
        lines.push(expectedPort(`COIN${player}`, `JOYCODE_${player}_BUTTON7`));
        lines.push(expectedPort(`START${player}`, `JOYCODE_${player}_BUTTON8`));
        if (select) lines.push(expectedPort(`P${player}_SELECT`, `JOYCODE_${player}_BUTTON9`));
        lines.push(...expectedExtended(player));
    }
    lines.push(
        expectedPort("SERVICE1", "JOYCODE_1_BUTTON10"),
        expectedPort("SERVICE", "JOYCODE_1_BUTTON11"),
        expectedPort("TILT", "JOYCODE_1_BUTTON12"),
        expectedPort("TILT1", "JOYCODE_1_BUTTON12"),
        "        </input>", "    </system>", "</mameconfig>",
    );
    return `${lines.join("\n")}\n`;
};

const ONE_PLAYER = expectedConfig(1, true);                       // Exact one-player output with select
const FOUR_PLAYERS = expectedConfig(4, false);                    // Exact four-player output without select

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

// HELPER :: STRING -> [{type:STRING,sequence:STRING,code:STRING}]
// Extracts all three 0.161 sequence types without losing repeated port rows.
const sequencesOf = (xml: string): Array<{ type: string; sequence: string; code: string }> =>
    [...xml.matchAll(/<port type="([^"]+)"><newseq type="([^"]+)">([^<]+)<\/newseq><\/port>/g)]
        .map((match) => ({ type: match[1] ?? "", sequence: match[2] ?? "", code: match[3] ?? "" }));

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
            label: "every analogue ramp, relative token and dual-stick sequence matches the W26 contract",
            run: () => CTGTest.init("extended controller token vocabulary")
                .assert("all W26 rows match in order", () => {
                    const actual = sequencesOf(controllerConfigFor({ players: 1, select: false }));
                    const oldTypes = new Set([
                        "P1_JOYSTICK_UP", "P1_JOYSTICK_DOWN", "P1_JOYSTICK_LEFT", "P1_JOYSTICK_RIGHT",
                        "P1_BUTTON1", "P1_BUTTON2", "P1_BUTTON3", "P1_BUTTON4", "P1_BUTTON5", "P1_BUTTON6",
                        "COIN1", "START1", "SERVICE1", "SERVICE", "TILT", "TILT1",
                    ]);
                    return actual.filter((entry) => !oldTypes.has(entry.type));
                }, P.equals<unknown>(sequencesOf(expectedExtended(1).join("\n"))))
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
