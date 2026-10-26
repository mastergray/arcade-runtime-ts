// realizes: docs/arcade-runtime-spec.md > §10.3 Analogue settings driver

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import AnalogDriver from "../../src/AnalogDriver/AnalogDriver.ts";
import { isAnalogDriverConfig } from "../../src/AnalogDriver/types.ts";
import ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";
import {
    DEFAULT_ANALOG_SETTING,
    isAnalogSetting,
    isAnalogSettings,
} from "../../src/shared.types.ts";
import FakeArcadeSession from "../support/FakeArcadeSession.ts";
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts";

// Type dependencies:
import type { ArcadeAxis, ArcadeControl, MachineInputs } from "../../src/shared.types.ts";
import type { TestFile } from "../run.ts";

const STICK_RIGHT = { kind: "stick", player: 1, stick: 1, direction: "right" } as const satisfies ArcadeControl;
const PADDLE_RIGHT = { kind: "stick", player: 2, stick: 1, direction: "right" } as const satisfies ArcadeControl;
const PEDAL = { kind: "pedal", player: 3, pedal: 1 } as const satisfies ArcadeControl;
const DIAL_UP = { kind: "stick", player: 4, stick: 1, direction: "up" } as const satisfies ArcadeControl;
const DIRECTION_RIGHT = { kind: "direction", player: 1, direction: "right" } as const satisfies ArcadeControl;
const DIRECTION_UP = { kind: "direction", player: 1, direction: "up" } as const satisfies ArcadeControl;
const STICK_X = { player: 1, kind: "stick-x" } as const satisfies ArcadeAxis;
const SPIN_Y = { player: 4, kind: "spin-y" } as const satisfies ArcadeAxis;
const INPUTS = Object.freeze([
    { player: 1, kind: "stick-x" },
    { player: 2, kind: "positional" },
    { player: 3, kind: "pedal-1" },
    { player: 4, kind: "dial-v" },
] as const) satisfies MachineInputs["analog"];

const valueFor = (session: FakeArcadeSession, player: number, kind: ArcadeAxis["kind"]): number | null =>
    session.axes.find((entry) => entry.axis.player === player && entry.axis.kind === kind)?.value ?? null;

const testFile: TestFile = {
    label: "AnalogDriver",
    cases: [
        {
            label: "public settings and construction predicates enforce the documented numeric ranges",
            run: () => CTGTest.init("analogue predicates")
                .assert("defaults and verdicts match", () => {
                    const input = new ArcadeInput({ session: new FakeArcadeSession() });
                    const scheduler = new FakeFrameScheduler();
                    return {
                        defaults: DEFAULT_ANALOG_SETTING,
                        setting: isAnalogSetting({ keySpeed: 0.1, centreSpeed: 0, travel: 4, invert: true }),
                        badTravel: isAnalogSetting({ travel: 4.1 }),
                        settings: isAnalogSettings({ "p1:stick-x": { keySpeed: 0.1 } }),
                        badKey: isAnalogSettings({ "p5:stick-x": {} }),
                        config: isAnalogDriverConfig({ input, scheduler, inputs: INPUTS }),
                    };
                }, P.equals<unknown>({
                    defaults: { keySpeed: 0.04, centreSpeed: 0.04, travel: 1, invert: false },
                    setting: true,
                    badTravel: false,
                    settings: true,
                    badKey: false,
                    config: true,
                }))
                .start(undefined),
        },
        {
            label: "keyboard integration ramps, centres, holds, bounds pedals and emits relative deltas",
            run: () => CTGTest.init("analogue keyboard arithmetic")
                .stage("drive four declared port policies", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const driver = new AnalogDriver({
                        input,
                        scheduler,
                        inputs: INPUTS,
                        settings: {
                            "p1:stick-x": { keySpeed: 0.1, centreSpeed: 0.05 },
                            "p2:positional": { keySpeed: 0.2 },
                            "p3:pedal-1": { keySpeed: 0.4, centreSpeed: 0.25 },
                            "p4:dial-v": { keySpeed: 0.03 },
                        },
                    });
                    keys.press(STICK_RIGHT);
                    keys.press(PADDLE_RIGHT);
                    keys.press(PEDAL);
                    keys.press(DIAL_UP);
                    scheduler.tick(16); scheduler.tick(16); scheduler.tick(16);
                    const held = {
                        stick: valueFor(session, 1, "stick-x"),
                        paddle: valueFor(session, 2, "stick-x"),
                        pedal: valueFor(session, 3, "pedal-1"),
                        relative: valueFor(session, 4, "spin-y"),
                        digital: session.held,
                    };
                    keys.release(STICK_RIGHT);
                    keys.release(PADDLE_RIGHT);
                    keys.release(PEDAL);
                    keys.release(DIAL_UP);
                    scheduler.tick(16);
                    const released = {
                        stick: valueFor(session, 1, "stick-x"),
                        paddle: valueFor(session, 2, "stick-x"),
                        pedal: valueFor(session, 3, "pedal-1"),
                        relative: valueFor(session, 4, "spin-y"),
                    };
                    driver.destroy();
                    return { held, released, pending: scheduler.pending };
                })
                .assert("each kind follows its centre, hold or relative policy", (state) => state.subject, P.equals<unknown>({
                    held: { stick: 0.30000000000000004, paddle: 0.6000000000000001, pedal: 1, relative: -0.03, digital: [] },
                    released: { stick: 0.25000000000000006, paddle: 0.6000000000000001, pedal: 0.5, relative: -0.03 },
                    pending: 0,
                }))
                .start(undefined),
        },
        {
            label: "a paddle centres after release like a stick, because MAME auto-centres paddles",
            run: () => CTGTest.init("paddle centring")
                .stage("hold then release a paddle", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const driver = new AnalogDriver({ input, scheduler, inputs: [{ player: 1, kind: "paddle" }], settings: { "p1:paddle": { keySpeed: 0.25 } } });
                    keys.press(STICK_RIGHT);
                    scheduler.tick(16); scheduler.tick(16);
                    const held = valueFor(session, 1, "stick-x");
                    keys.release(STICK_RIGHT);
                    scheduler.tick(16);
                    const afterOne = valueFor(session, 1, "stick-x");
                    scheduler.tick(16);
                    const afterTwo = valueFor(session, 1, "stick-x");
                    driver.destroy();
                    return { held, afterOne, afterTwo };
                })
                .assert("the paddle ramps to half and returns to centre in two frames", (state) => state.subject, P.equals<unknown>({ held: 0.5, afterOne: 0.25, afterTwo: 0 }))
                .start(undefined),
        },
        {
            label: "directions drive a covered axis, uncovered directions stay digital, and static values are not resent",
            run: () => CTGTest.init("analogue directions and silence")
                .stage("hold a direction on a horizontal-only board", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const pad = input.createChannel();
                    const driver = new AnalogDriver({
                        input, scheduler, inputs: [{ player: 1, kind: "stick-x" }],
                        settings: { "p1:stick-x": { keySpeed: 0.25, centreSpeed: 0.25, invert: true } },
                    });
                    scheduler.tick(16);
                    const writesAtRest = session.calls.filter((call) => call.method === "setAxis").length;
                    scheduler.tick(16); scheduler.tick(16);
                    const writesAfterIdle = session.calls.filter((call) => call.method === "setAxis").length;
                    pad.setAxis(STICK_X, 0.6);
                    scheduler.tick(16);
                    const padHeld = valueFor(session, 1, "stick-x");
                    keys.press(DIRECTION_RIGHT);
                    keys.press(DIRECTION_UP);
                    scheduler.tick(16); scheduler.tick(16);
                    const held = { axis: valueFor(session, 1, "stick-x"), digital: session.held };
                    keys.release(DIRECTION_RIGHT);
                    keys.release(DIRECTION_UP);
                    scheduler.tick(16); scheduler.tick(16);
                    const released = valueFor(session, 1, "stick-x");
                    driver.destroy();
                    return { writesAtRest, writesAfterIdle, padHeld, held, released };
                })
                .assert("right and left ramp the inverted axis, up stays a digital hold, a resting driver leaves the pad's value alone", (state) => state.subject, P.equals<unknown>({
                    writesAtRest: 1,
                    writesAfterIdle: 1,
                    padHeld: 0.6,
                    held: { axis: -0.5, digital: ["p1:direction:up"] },
                    released: 0,
                }))
                .start(undefined),
        },
        {
            label: "a relative port beside a joystick leaves the arrows digital while stick-1 keys still spin it",
            run: () => CTGTest.init("dial beside a joystick")
                .stage("hold a direction and a stick key on a dial board", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const driver = new AnalogDriver({ input, scheduler, inputs: [{ player: 1, kind: "dial" }], settings: {} });
                    keys.press(DIRECTION_RIGHT);
                    scheduler.tick(16); scheduler.tick(16);
                    const spinsFromArrow = session.calls.filter((call) => call.method === "setAxis").length;
                    const digital = [...session.held];
                    keys.release(DIRECTION_RIGHT);
                    keys.press(STICK_RIGHT);
                    scheduler.tick(16); scheduler.tick(16);
                    const spinsFromStick = session.calls.filter((call) => call.method === "setAxis").length - spinsFromArrow;
                    keys.release(STICK_RIGHT);
                    driver.destroy();
                    return { spinsFromArrow, digital, spinsFromStick };
                })
                .assert("the arrow reaches the machine digitally and never spins; the stick key spins", (state) => state.subject, P.equals<unknown>({
                    spinsFromArrow: 0,
                    digital: ["p1:direction:right"],
                    spinsFromStick: 2,
                }))
                .start(undefined),
        },
        {
            label: "a dial-only board (joystick false) takes the arrows into the driver at keySpeed",
            run: () => CTGTest.init("dial-only arrows")
                .stage("hold a direction with the joystick flag false", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const driver = new AnalogDriver({ input, scheduler, inputs: [{ player: 1, kind: "dial" }], joystick: false, settings: {} });
                    keys.press(DIRECTION_RIGHT);
                    scheduler.tick(16); scheduler.tick(16);
                    const result = { spins: session.calls.filter((call) => call.method === "setAxis").length, digital: [...session.held] };
                    keys.release(DIRECTION_RIGHT);
                    driver.destroy();
                    return result;
                })
                .assert("the arrow spins and never reaches the digital path", (state) => state.subject, P.equals<unknown>({ spins: 2, digital: [] }))
                .start(undefined),
        },
        {
            label: "live updates change keyboard slope and inversion while the gamepad filter applies travel",
            run: () => CTGTest.init("analogue live update and filter")
                .stage("update one running driver", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const scheduler = new FakeFrameScheduler();
                    const keys = input.createChannel();
                    const driver = new AnalogDriver({
                        input, scheduler, inputs: INPUTS,
                        settings: { "p1:stick-x": { keySpeed: 0.1, centreSpeed: 0 } },
                    });
                    keys.press(STICK_RIGHT);
                    scheduler.tick(16);
                    const initial = valueFor(session, 1, "stick-x");
                    driver.update({ "p1:stick-x": { keySpeed: 0.3, centreSpeed: 0, travel: 2, invert: true } });
                    scheduler.tick(16);
                    const updated = valueFor(session, 1, "stick-x");
                    const absolute = driver.axisFilter(STICK_X, 0.75);
                    const relative = driver.axisFilter(SPIN_Y, 12);
                    return { initial, updated, absolute, relative, retained: driver.settings };
                })
                .assert("new settings take effect on the next frame without a restart", (state) => state.subject, P.equals<unknown>({
                    initial: 0.1,
                    updated: -0.4,
                    absolute: -1,
                    relative: 12,
                    retained: { "p1:stick-x": { keySpeed: 0.3, centreSpeed: 0, travel: 2, invert: true } },
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
