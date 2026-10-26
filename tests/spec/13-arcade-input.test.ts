// realizes: docs/arcade-runtime-spec.md > §6 ArcadeInput (channels, taps, SOCD, ordering and lifecycle)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";   // Class under test before integrator root export
import {
    isArcadeInputChannel,                                         // Public channel structural predicate
    isArcadeInputConfig,                                          // Public config structural predicate
    isArcadeInputHoldListener,                                    // Public effective-hold observer predicate
} from "../../src/ArcadeInput/types.ts";
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed rejection identity
import FakeArcadeSession, { type FakeSessionCall } from "../support/FakeArcadeSession.ts";   // Required W0 session double
import { errorSnapshot, thrownBy, type ErrorSnapshot } from "../support/fixtures.ts";   // Error capture helpers

// Type dependencies:
import type { ArcadeAxis, ArcadeControl } from "../../src/shared.types.ts";   // Control and axis fixtures
import type { ArcadeInputConfig } from "../../src/ArcadeInput/types.ts";   // Invalid construction casts
import type { TestCase, TestFile } from "../run.ts";              // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {input:arcadeInput, session:fakeArcadeSession}
// Fresh subject and its recording session.
interface Rig {
    readonly input: ArcadeInput;
    readonly session: FakeArcadeSession;
}

/**
 *
 * Constants
 *
 */

const UP_1 = { kind: "direction", player: 1, direction: "up" } as const satisfies ArcadeControl;
const DOWN_1 = { kind: "direction", player: 1, direction: "down" } as const satisfies ArcadeControl;
const LEFT_1 = { kind: "direction", player: 1, direction: "left" } as const satisfies ArcadeControl;
const RIGHT_1 = { kind: "direction", player: 1, direction: "right" } as const satisfies ArcadeControl;
const BUTTON_1 = { kind: "button", player: 1, button: 1 } as const satisfies ArcadeControl;
const BUTTON_2 = { kind: "button", player: 2, button: 6 } as const satisfies ArcadeControl;
const COIN_1 = { kind: "coin", player: 1 } as const satisfies ArcadeControl;
const START_2 = { kind: "start", player: 2 } as const satisfies ArcadeControl;
const SERVICE = { kind: "service" } as const satisfies ArcadeControl;
const KEY_F1 = { kind: "key", key: "F1" } as const satisfies ArcadeControl;
const VOLUME_DOWN = { kind: "volume", direction: "down" } as const satisfies ArcadeControl;
const STICK_X_1 = { player: 1, kind: "stick-x" } as const satisfies ArcadeAxis;
const PEDAL_1 = { player: 1, kind: "pedal-1" } as const satisfies ArcadeAxis;
const SPIN_X_1 = { player: 1, kind: "spin-x" } as const satisfies ArcadeAxis;
const DESTROYED: ErrorSnapshot = { isRuntimeError: true, code: 10, label: "DESTROYED" };

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> rig
// A fresh input over the required fake session.
const rig = (): Rig => {
    const session = new FakeArcadeSession();
    return { input: new ArcadeInput({ session }), session };
};

// HELPER :: arcadeControl, BOOLEAN -> fakeSessionCall
// One expected session control call.
const controlCall = (control: ArcadeControl, pressed: boolean): FakeSessionCall => ({ method: "setControl", args: [control, pressed] });

// HELPER :: arcadeAxis, NUMBER -> fakeSessionCall
// One expected session axis call.
const axisCall = (axis: ArcadeAxis, value: number): FakeSessionCall => ({ method: "setAxis", args: [axis, value] });

// HELPER :: UNKNOWN -> errorSnapshot
// Runtime-error identity for a thrown value.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

// HELPER :: STRING, (arcadeInput -> VOID) -> testCase
// Case: an input operation throws DESTROYED after terminal destruction.
const destroyedCase = (label: string, operation: (input: ArcadeInput) => void): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .stage("destroy then operate", () => { const { input } = rig(); input.destroy(); return errorOf(thrownBy(() => operation(input))); })
        .assert("throws DESTROYED", (state) => state.subject, P.equals<ErrorSnapshot>(DESTROYED))
        .start(undefined),
});

const testFile: TestFile = {
    label: "ArcadeInput",
    cases: [
        {
            label: "config and channel predicates accept their full structures and reject missing requirements",
            run: () => CTGTest.init("ArcadeInput predicates")
                .assert("predicate verdicts match", () => {
                    const { input, session } = rig();
                    const channel = input.createChannel();
                    return {
                        config: isArcadeInputConfig({ session }),
                        noConfig: isArcadeInputConfig(null),
                        badSession: isArcadeInputConfig({ session: {} }),
                        channel: isArcadeInputChannel(channel),
                        missingChannelMethod: isArcadeInputChannel({ press(): void {}, release(): void {}, tap(): void {}, releaseAll(): void {} }),
                    };
                }, P.equals<unknown>({ config: true, noConfig: false, badSession: false, channel: true, missingChannelMethod: false }))
                .start(undefined),
        },
        {
            label: "constructor rejects a bad session with INVALID_CONFIG and carries the config",
            run: () => CTGTest.init("ArcadeInput constructor rejection")
                .stage("construct with a rejected config", () => {
                    const config = { session: {} } as unknown as ArcadeInputConfig;
                    const thrown = thrownBy(() => new ArcadeInput(config));
                    return { error: errorOf(thrown), dataMatches: ArcadeRuntimeError.is(thrown) && thrown.data === config };
                })
                .assert("typed rejection carries the config", (state) => state.subject, P.equals<unknown>({
                    error: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" }, dataMatches: true,
                }))
                .start(undefined),
        },
        {
            label: "default-channel holds are idempotent and init mirrors construction",
            run: () => CTGTest.init("default channel idempotency")
                .stage("init, press twice, release twice", () => {
                    const session = new FakeArcadeSession();
                    const input = ArcadeInput.init({ session });
                    input.press(BUTTON_1);
                    input.press(BUTTON_1);
                    const held = input.snapshot;
                    input.release(BUTTON_1);
                    input.release(BUTTON_1);
                    return { instance: input instanceof ArcadeInput, held, final: input.snapshot, calls: session.calls };
                })
                .assert("one press and one release are sent", (state) => state.subject, P.equals<unknown>({
                    instance: true,
                    held: [BUTTON_1],
                    final: [],
                    calls: [controlCall(BUTTON_1, true), controlCall(BUTTON_1, false)],
                }))
                .start(undefined),
        },
        {
            label: "two channels reference-count the same control and releases affect only their own holds",
            run: () => CTGTest.init("channel reference counting")
                .stage("hold through two channels and release in turn", () => {
                    const { input, session } = rig();
                    const first = input.createChannel();
                    const second = input.createChannel();
                    first.press(BUTTON_1);
                    first.press(BUTTON_1);
                    second.press(BUTTON_1);
                    first.release(BUTTON_1);
                    const afterFirst = { snapshot: input.snapshot, held: session.held };
                    second.release(BUTTON_1);
                    return { afterFirst, final: input.snapshot, calls: session.calls };
                })
                .assert("first press and last release alone reach the session", (state) => state.subject, P.equals<unknown>({
                    afterFirst: { snapshot: [BUTTON_1], held: ["p1:button:1"] },
                    final: [],
                    calls: [controlCall(BUTTON_1, true), controlCall(BUTTON_1, false)],
                }))
                .start(undefined),
        },
        {
            label: "hold observers receive effective edges and may keep a control off the digital session path",
            run: () => CTGTest.init("hold observation")
                .stage("consume one hold, unsubscribe, then forward another", () => {
                    const { input, session } = rig();
                    const edges: unknown[] = [];
                    const listener = (control: ArcadeControl, pressed: boolean): boolean => {
                        edges.push([control, pressed]);
                        return true;
                    };
                    const accepted = isArcadeInputHoldListener(listener);
                    const unsubscribe = input.onHold(listener);
                    input.press(BUTTON_1);
                    input.release(BUTTON_1);
                    unsubscribe();
                    input.press(COIN_1);
                    input.release(COIN_1);
                    return { accepted, edges, calls: session.calls };
                })
                .assert("only the observed control is consumed", (state) => state.subject, P.equals<unknown>({
                    accepted: true,
                    edges: [[BUTTON_1, true], [BUTTON_1, false]],
                    calls: [controlCall(COIN_1, true), controlCall(COIN_1, false)],
                }))
                .start(undefined),
        },
        {
            label: "destroying a channel releases its last holds and makes that channel reject every operation",
            run: () => CTGTest.init("channel destruction")
                .stage("hold, destroy twice, then call every operation", () => {
                    const { input, session } = rig();
                    const channel = input.createChannel();
                    channel.press(COIN_1);
                    channel.destroy();
                    channel.destroy();
                    const errors = [
                        thrownBy(() => channel.press(COIN_1)),
                        thrownBy(() => channel.release(COIN_1)),
                        thrownBy(() => channel.tap(COIN_1)),
                        thrownBy(() => channel.setAxis(STICK_X_1, 0)),
                        thrownBy(() => channel.releaseAll()),
                    ].map(errorOf);
                    return { calls: session.calls, snapshot: input.snapshot, errors };
                })
                .assert("one release and DESTROYED thereafter", (state) => state.subject, P.equals<unknown>({
                    calls: [controlCall(COIN_1, true), controlCall(COIN_1, false)],
                    snapshot: [],
                    errors: [DESTROYED, DESTROYED, DESTROYED, DESTROYED, DESTROYED],
                }))
                .start(undefined),
        },
        {
            label: "axes are last-writer-owned, clamp absolute values and recenter only the current owner",
            run: () => CTGTest.init("axis ownership")
                .stage("write absolute and relative axes through three channels", () => {
                    const { input, session } = rig();
                    const first = input.createChannel();
                    const second = input.createChannel();
                    const spinner = input.createChannel();
                    input.setAxis(STICK_X_1, 2);
                    first.setAxis(PEDAL_1, 0.5);
                    second.setAxis(PEDAL_1, 0.25);
                    const owned = input.axes;
                    first.releaseAll();
                    const afterOldOwner = input.axes;
                    second.releaseAll();
                    spinner.setAxis(SPIN_X_1, 3.5);
                    spinner.destroy();
                    const afterRelativeRelease = input.axes;
                    input.releaseAll();
                    return {
                        machineMatches: input.machine === session.machine,
                        owned,
                        afterOldOwner,
                        afterRelativeRelease,
                        final: input.axes,
                        calls: session.calls,
                    };
                })
                .assert("ownership transfer and neutral values match", (state) => state.subject, P.equals<unknown>({
                    machineMatches: true,
                    owned: [{ axis: PEDAL_1, value: 0.25 }, { axis: STICK_X_1, value: 1 }],
                    afterOldOwner: [{ axis: PEDAL_1, value: 0.25 }, { axis: STICK_X_1, value: 1 }],
                    afterRelativeRelease: [{ axis: STICK_X_1, value: 1 }],
                    final: [],
                    calls: [
                        axisCall(STICK_X_1, 1),
                        axisCall(PEDAL_1, 0.5),
                        axisCall(PEDAL_1, 0.25),
                        axisCall(PEDAL_1, -1),
                        axisCall(SPIN_X_1, 3.5),
                        axisCall(STICK_X_1, 0),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "axis writes reject malformed axes and non-finite values before reaching the session",
            run: () => CTGTest.init("axis validation")
                .stage("write two invalid axis arguments", () => {
                    const { input, session } = rig();
                    const malformed = { player: 1, kind: "paddle" } as unknown as ArcadeAxis;
                    return {
                        errors: [thrownBy(() => input.setAxis(malformed, 0)), thrownBy(() => input.setAxis(STICK_X_1, Number.NaN))].map(errorOf),
                        calls: session.calls,
                    };
                })
                .assert("both reject as INVALID_CONFIG", (state) => state.subject, P.equals<unknown>({
                    errors: [
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    ],
                    calls: [],
                }))
                .start(undefined),
        },
        {
            label: "suspension keeps input observable while isolating the session and restores current state",
            run: () => CTGTest.init("ArcadeInput suspension")
                .stage("hold controls and axes across the suspension gate", () => {
                    const { input, session } = rig();
                    input.press(BUTTON_1);
                    input.setAxis(STICK_X_1, 0.5);
                    input.suspended = true;
                    const isolatedAtOpen = session.calls.slice();
                    input.press(BUTTON_2);
                    input.setAxis(PEDAL_1, 0.75);
                    const observed = { suspended: input.suspended, snapshot: input.snapshot, axes: input.axes };
                    const isolatedDuring = session.calls.slice();
                    input.suspended = false;
                    return { isolatedAtOpen, isolatedDuring, observed, resumed: session.calls.slice() };
                })
                .assert("logical state remains visible and only resume forwards it", (state) => state.subject, P.equals<unknown>({
                    isolatedAtOpen: [
                        controlCall(BUTTON_1, true), axisCall(STICK_X_1, 0.5),
                        controlCall(BUTTON_1, false), axisCall(STICK_X_1, 0),
                    ],
                    isolatedDuring: [
                        controlCall(BUTTON_1, true), axisCall(STICK_X_1, 0.5),
                        controlCall(BUTTON_1, false), axisCall(STICK_X_1, 0),
                    ],
                    observed: {
                        suspended: true,
                        snapshot: [BUTTON_1, BUTTON_2],
                        axes: [{ axis: PEDAL_1, value: 0.75 }, { axis: STICK_X_1, value: 0.5 }],
                    },
                    resumed: [
                        controlCall(BUTTON_1, true), axisCall(STICK_X_1, 0.5),
                        controlCall(BUTTON_1, false), axisCall(STICK_X_1, 0),
                        controlCall(BUTTON_1, true), controlCall(BUTTON_2, true),
                        axisCall(STICK_X_1, 0.5), axisCall(PEDAL_1, 0.75),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "tap defaults to three session ticks and an explicit one-frame tap releases on the next tick",
            run: () => CTGTest.init("tap tick timing")
                .stage("drive default and explicit tap countdowns", () => {
                    const { input, session } = rig();
                    input.tap(COIN_1);
                    session.emitTick(2);
                    const beforeThird = { snapshot: input.snapshot, calls: session.calls.length };
                    session.emitTick();
                    input.tap(START_2, 1);
                    const beforeOne = input.snapshot;
                    session.emitTick();
                    return { beforeThird, beforeOne, final: input.snapshot, calls: session.calls };
                })
                .assert("releases occur at exactly the requested ticks", (state) => state.subject, P.equals<unknown>({
                    beforeThird: { snapshot: [COIN_1], calls: 1 },
                    beforeOne: [START_2],
                    final: [],
                    calls: [
                        controlCall(COIN_1, true), controlCall(COIN_1, false),
                        controlCall(START_2, true), controlCall(START_2, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "tap on this channel's existing hold is a no-op and never schedules its release",
            run: () => CTGTest.init("tap existing hold")
                .stage("hold, tap, tick well past the default", () => {
                    const { input, session } = rig();
                    const channel = input.createChannel();
                    channel.press(COIN_1);
                    channel.tap(COIN_1);
                    session.emitTick(10);
                    return { snapshot: input.snapshot, calls: session.calls };
                })
                .assert("original hold remains", (state) => state.subject, P.equals<unknown>({ snapshot: [COIN_1], calls: [controlCall(COIN_1, true)] }))
                .start(undefined),
        },
        {
            label: "a tap's expiry removes only its channel and cannot release another channel's hold",
            run: () => CTGTest.init("tap reference isolation")
                .stage("hold in one channel and tap in another", () => {
                    const { input, session } = rig();
                    const holding = input.createChannel();
                    const tapping = input.createChannel();
                    holding.press(COIN_1);
                    tapping.tap(COIN_1, 2);
                    session.emitTick(2);
                    const afterTap = { snapshot: input.snapshot, held: session.held, calls: session.calls.length };
                    holding.release(COIN_1);
                    return { afterTap, final: input.snapshot, calls: session.calls };
                })
                .assert("session release waits for the independent hold", (state) => state.subject, P.equals<unknown>({
                    afterTap: { snapshot: [COIN_1], held: ["p1:coin"], calls: 1 },
                    final: [],
                    calls: [controlCall(COIN_1, true), controlCall(COIN_1, false)],
                }))
                .start(undefined),
        },
        {
            label: "manual release cancels a pending tap and holdFrames rejects zero and non-integers",
            run: () => CTGTest.init("tap cancellation and validation")
                .stage("release one tap, then call with bad durations", () => {
                    const { input, session } = rig();
                    input.tap(COIN_1, 2);
                    input.release(COIN_1);
                    session.emitTick(3);
                    return {
                        calls: session.calls,
                        zero: errorOf(thrownBy(() => input.tap(COIN_1, 0))),
                        fraction: errorOf(thrownBy(() => input.tap(COIN_1, 1.5))),
                    };
                })
                .assert("release is not repeated and bad durations are INVALID_CONFIG", (state) => state.subject, P.equals<unknown>({
                    calls: [controlCall(COIN_1, true), controlCall(COIN_1, false)],
                    zero: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    fraction: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                }))
                .start(undefined),
        },
        {
            label: "cross-channel SOCD releases every old horizontal owner before pressing the last direction",
            run: () => CTGTest.init("horizontal SOCD")
                .stage("hold right twice, then press left and release stale owners", () => {
                    const { input, session } = rig();
                    const first = input.createChannel();
                    const second = input.createChannel();
                    const latest = input.createChannel();
                    first.press(RIGHT_1);
                    second.press(RIGHT_1);
                    latest.press(LEFT_1);
                    first.release(RIGHT_1);
                    second.release(RIGHT_1);
                    return { snapshot: input.snapshot, calls: session.calls };
                })
                .assert("right is released once before left and stale releases do nothing", (state) => state.subject, P.equals<unknown>({
                    snapshot: [LEFT_1],
                    calls: [controlCall(RIGHT_1, true), controlCall(RIGHT_1, false), controlCall(LEFT_1, true)],
                }))
                .start(undefined),
        },
        {
            label: "vertical SOCD also cancels a pending opposite-direction tap",
            run: () => CTGTest.init("vertical SOCD")
                .stage("tap down then press up", () => {
                    const { input, session } = rig();
                    const old = input.createChannel();
                    const latest = input.createChannel();
                    old.tap(DOWN_1, 1);
                    latest.press(UP_1);
                    session.emitTick();
                    old.release(DOWN_1);
                    return { snapshot: input.snapshot, calls: session.calls };
                })
                .assert("down is cleared exactly once and up remains", (state) => state.subject, P.equals<unknown>({
                    snapshot: [UP_1],
                    calls: [controlCall(DOWN_1, true), controlCall(DOWN_1, false), controlCall(UP_1, true)],
                }))
                .start(undefined),
        },
        {
            label: "operator keys and cabinet volume preserve their values through holds, taps and releaseAll",
            run: () => CTGTest.init("coded-field controls")
                .stage("hold a key, tap volume, then release everything", () => {
                    const { input, session } = rig();
                    input.press(KEY_F1);
                    input.tap(VOLUME_DOWN, 2);
                    const snapshot = input.snapshot;
                    session.emitTick();
                    const duringTap = input.snapshot;
                    session.emitTick();
                    input.releaseAll();
                    return { snapshot, duringTap, final: input.snapshot, calls: session.calls };
                })
                .assert("both new control kinds pass through unchanged", (state) => state.subject, P.equals<unknown>({
                    snapshot: [KEY_F1, VOLUME_DOWN],
                    duringTap: [KEY_F1, VOLUME_DOWN],
                    final: [],
                    calls: [
                        controlCall(KEY_F1, true), controlCall(VOLUME_DOWN, true),
                        controlCall(VOLUME_DOWN, false), controlCall(KEY_F1, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "snapshot and releaseAll use arcadeControlKey canonical order across every channel",
            run: () => CTGTest.init("canonical snapshot and releaseAll")
                .stage("press reverse-order controls through separate channels", () => {
                    const { input, session } = rig();
                    const first = input.createChannel();
                    const second = input.createChannel();
                    first.press(SERVICE);
                    first.press(START_2);
                    second.press(LEFT_1);
                    second.press(BUTTON_2);
                    const snapshot = input.snapshot;
                    session.calls.length = 0;
                    input.releaseAll();
                    return { snapshot, final: input.snapshot, held: session.held, releases: session.calls };
                })
                .assert("both observations are canonically ordered", (state) => state.subject, P.equals<unknown>({
                    snapshot: [LEFT_1, BUTTON_2, START_2, SERVICE],
                    final: [],
                    held: [],
                    releases: [
                        controlCall(LEFT_1, false),
                        controlCall(BUTTON_2, false),
                        controlCall(START_2, false),
                        controlCall(SERVICE, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "bad controls are rejected by press, release and tap without reaching the session",
            run: () => CTGTest.init("control validation")
                .stage("call every control-taking operation with a bad value", () => {
                    const { input, session } = rig();
                    const bad = { kind: "button", player: 1, button: 7 } as unknown as ArcadeControl;
                    return {
                        errors: [
                            thrownBy(() => input.press(bad)),
                            thrownBy(() => input.release(bad)),
                            thrownBy(() => input.tap(bad)),
                        ].map(errorOf),
                        calls: session.calls,
                    };
                })
                .assert("all are INVALID_CONFIG and no call is sent", (state) => state.subject, P.equals<unknown>({
                    errors: [
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                        { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    ],
                    calls: [],
                }))
                .start(undefined),
        },
        {
            label: "destroy releases in canonical order, unsubscribes taps, destroys channels and is idempotent",
            run: () => CTGTest.init("ArcadeInput destruction")
                .stage("hold through default and created channels, then destroy twice", () => {
                    const { input, session } = rig();
                    const channel = input.createChannel();
                    input.tap(SERVICE, 2);
                    channel.press(BUTTON_1);
                    session.calls.length = 0;
                    input.destroy();
                    input.destroy();
                    session.emitTick(4);
                    return {
                        calls: session.calls,
                        snapshot: input.snapshot,
                        channelError: errorOf(thrownBy(() => channel.press(BUTTON_1))),
                    };
                })
                .assert("one ordered release per control and no later tick work", (state) => state.subject, P.equals<unknown>({
                    calls: [controlCall(BUTTON_1, false), controlCall(SERVICE, false)],
                    snapshot: [],
                    channelError: DESTROYED,
                }))
                .start(undefined),
        },

        destroyedCase("createChannel throws DESTROYED after destroy", (input) => { input.createChannel(); }),
        destroyedCase("press throws DESTROYED after destroy", (input) => input.press(BUTTON_1)),
        destroyedCase("release throws DESTROYED after destroy", (input) => input.release(BUTTON_1)),
        destroyedCase("tap throws DESTROYED after destroy", (input) => input.tap(BUTTON_1)),
        destroyedCase("setAxis throws DESTROYED after destroy", (input) => input.setAxis(STICK_X_1, 0)),
        destroyedCase("releaseAll throws DESTROYED after destroy", (input) => input.releaseAll()),
    ],
};

export default testFile;
