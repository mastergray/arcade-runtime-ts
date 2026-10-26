// realizes: docs/arcade-runtime-spec.md > §10.4 GamepadSource (mapping, assignment, polling and lifecycle)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";   // Real channel owner under the source
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed rejection identity
import GamepadSource, { DEFAULT_GAMEPAD_CHORDS } from "../../src/GamepadSource/GamepadSource.ts";   // Source and default chords under test
import {
    controlsFor,                                                  // Pure full-control mapper
    directionsFor,                                                // Pure directional mapper
    isGamepadDevice,                                               // Public device snapshot guard
    isGamepadLike,                                                // Pad subset guard
    isGamepadMapping,                                             // Physical mapping guard
    isGamepadProviderLike,                                        // Provider guard
    isGamepadSourceConfig,                                        // Direct config guard
    isGamepadSourceInitConfig,                                    // Browser-defaulting config guard
} from "../../src/GamepadSource/types.ts";
import FakeArcadeSession, { type FakeSessionCall } from "../support/FakeArcadeSession.ts";   // Required W0 session double
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts";   // Required W0 polling-clock double
import { errorSnapshot, thrownBy, validMachineInfo, type ErrorSnapshot } from "../support/fixtures.ts";   // Error capture helpers

// Type dependencies:
import type { ArcadeAxis, ArcadeControl, MachineInputs } from "../../src/shared.types.ts";   // Expected input-call values
import type {
    GamepadLike,                                                  // Scripted pad snapshots
    GamepadMapping,                                               // Mapping fixtures
    GamepadProviderLike,                                         // Fake provider contract
    GamepadSourceConfig,                                         // Rejected config casts
} from "../../src/GamepadSource/types.ts";
import type { KeyboardEventTargetLike } from "../../src/KeyboardSource/types.ts";   // Fake event boundary contract
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Class
 *
 */

// Minimal add/remove/dispatch target used to prove focus lifecycle without a DOM.
class FakeEventTarget implements KeyboardEventTargetLike {
    visibilityState = "visible";                                 // Mutable fake Document state
    readonly added: string[] = [];                                // Listener types installed, in order
    readonly removed: string[] = [];                              // Listener types removed, in order
    private readonly _listeners = new Map<string, Set<(event: Event) => void>>();   // Active listeners by type

    // INSTANCE :: STRING, (event -> VOID) -> VOID
    // Adds one listener idempotently as EventTarget does.
    addEventListener(type: string, listener: (event: Event) => void): void {
        this.added.push(type);
        const listeners = this._listeners.get(type) ?? new Set();
        listeners.add(listener);
        this._listeners.set(type, listeners);
    }

    // INSTANCE :: STRING, (event -> VOID) -> VOID
    // Removes one listener when present.
    removeEventListener(type: string, listener: (event: Event) => void): void {
        this.removed.push(type);
        this._listeners.get(type)?.delete(listener);
    }

    // INSTANCE :: STRING -> VOID
    // Delivers a plain event synchronously to a stable listener copy.
    dispatch(type: string): void {
        const event = { type } as Event;
        for (const listener of [...(this._listeners.get(type) ?? [])]) listener(event);
    }
}

// Mutable provider whose sparse list is replaced between fake scheduler ticks.
class FakeGamepadProvider implements GamepadProviderLike {
    pads: ReadonlyArray<GamepadLike | null> = [];                  // Snapshot returned by the next poll

    // INSTANCE :: VOID -> [gamepadLike?]
    // Returns the currently scripted snapshot.
    getGamepads(): ReadonlyArray<GamepadLike | null> {
        return this.pads;
    }
}

/**
 *
 * Constants
 *
 */

const DESTROYED: ErrorSnapshot = { isRuntimeError: true, code: 10, label: "DESTROYED" };
const INVALID_CONFIG: ErrorSnapshot = { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" };
const CUSTOM_MAPPING: GamepadMapping = Object.freeze({
    id: "custom pad",
    dpad: Object.freeze({ up: 0, down: 1, left: 2, right: 3 }),
    axes: Object.freeze([2, 3] as const),
    rightAxes: Object.freeze([4, 5] as const),
    pedals: Object.freeze([12, 13] as const),
    buttons: Object.freeze([6, 7, 8, 9, 10, 11] as const),
    coin: 4,
    start: 5,
});

/**
 *
 * Functions
 *
 */

// CLASS :: pad snapshot whose fields live on the prototype, like a browser Gamepad
// An object spread of a real Gamepad copies nothing, so every fake exposes its fields the same way.
class PrototypePad implements GamepadLike {
    readonly #id: string;
    readonly #index: number;
    readonly #connected: boolean;
    readonly #mapping: string;
    readonly #buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number }>;
    readonly #axes: ReadonlyArray<number>;
    constructor(id: string, index: number, connected: boolean, mapping: string, buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number }>, axes: ReadonlyArray<number>) {
        this.#id = id; this.#index = index; this.#connected = connected; this.#mapping = mapping; this.#buttons = buttons; this.#axes = axes;
    }
    get id(): string { return this.#id; }
    get index(): number { return this.#index; }
    get connected(): boolean { return this.#connected; }
    get mapping(): string { return this.#mapping; }
    get buttons(): ReadonlyArray<{ readonly pressed: boolean; readonly value: number }> { return this.#buttons; }
    get axes(): ReadonlyArray<number> { return this.#axes; }
}

// HELPER :: STRING, NUMBER, [NUMBER]?, [NUMBER, NUMBER]?, STRING?, BOOLEAN? -> gamepadLike
// Builds a complete 16-button pad snapshot with selected buttons down.
const pad = (
    id: string,
    index: number,
    pressed: ReadonlyArray<number> = [],
    axes: ReadonlyArray<number> = [0, 0],
    mapping = "standard",
    connected = true,
): GamepadLike => new PrototypePad(
    id,
    index,
    connected,
    mapping,
    Array.from({ length: 16 }, (_, button) => ({ pressed: pressed.includes(button), value: pressed.includes(button) ? 1 : 0 })),
    axes,
);

// HELPER :: gamepadLike, [BUTTON] -> gamepadLike
// Copies a prototype pad with replaced buttons; a spread would copy nothing from it.
const withButtons = (base: GamepadLike, buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number }>): GamepadLike =>
    new PrototypePad(base.id, base.index, base.connected, base.mapping, buttons, base.axes);

// HELPER :: arcadeControl, BOOLEAN -> fakeSessionCall
// One expected session control call.
const controlCall = (control: ArcadeControl, pressed: boolean): FakeSessionCall => ({ method: "setControl", args: [control, pressed] });

// HELPER :: arcadeAxis, NUMBER -> fakeSessionCall
// One expected session axis call.
const axisCall = (axis: ArcadeAxis, value: number): FakeSessionCall => ({ method: "setAxis", args: [axis, value] });

// HELPER :: UNKNOWN -> errorSnapshot
// Runtime-error identity for a thrown value.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

// HELPER :: fakeGamepadProvider, fakeFrameScheduler, fakeEventTarget, gamepadMapping? -> {source,input,session}
// Creates and attaches one source over only the required W0 doubles.
const attachedSource = (
    provider: FakeGamepadProvider,
    scheduler: FakeFrameScheduler,
    target: FakeEventTarget,
    mapping?: GamepadMapping,
    inputs: MachineInputs = { analog: [], dualStick: false, keys: [], volume: false },
) => {
    const session = new FakeArcadeSession({ ...validMachineInfo(), inputs });
    const input = new ArcadeInput({ session });
    const source = new GamepadSource({ input, provider, scheduler, target, mapping });
    source.attach();
    return { source, input, session };
};

const testFile: TestFile = {
    label: "GamepadSource",
    cases: [
        {
            label: "GamepadLike and provider predicates accept the complete structural subset and reject each malformed field",
            run: () => CTGTest.init("gamepad and provider predicates")
                .assert("predicate verdicts match", () => {
                    const valid = pad("standard pad", 0);
                    return {
                        valid: isGamepadLike(valid),
                        badId: isGamepadLike({ ...valid, id: 1 }),
                        badIndex: isGamepadLike({ ...valid, index: -1 }),
                        fractionalIndex: isGamepadLike({ ...valid, index: 0.5 }),
                        badConnected: isGamepadLike({ ...valid, connected: "yes" }),
                        badMapping: isGamepadLike({ ...valid, mapping: null }),
                        badButtons: isGamepadLike({ ...valid, buttons: [{ pressed: 1, value: 1 }] }),
                        badButtonValue: isGamepadLike({ ...valid, buttons: [{ pressed: true, value: 2 }] }),
                        badAxes: isGamepadLike({ ...valid, axes: [Number.NaN] }),
                        outOfRangeAxis: isGamepadLike({ ...valid, axes: [1.1] }),
                        absent: isGamepadLike(null),
                        provider: isGamepadProviderLike(new FakeGamepadProvider()),
                        badProvider: isGamepadProviderLike({ getGamepads: [] }),
                    };
                }, P.equals<unknown>({
                    valid: true,
                    badId: false,
                    badIndex: false,
                    fractionalIndex: false,
                    badConnected: false,
                    badMapping: false,
                    badButtons: false,
                    badButtonValue: false,
                    badAxes: false,
                    outOfRangeAxis: false,
                    absent: false,
                    provider: true,
                    badProvider: false,
                }))
                .start(undefined),
        },
        {
            label: "GamepadMapping predicate accepts partial overrides and rejects every malformed override",
            run: () => CTGTest.init("gamepad mapping predicate")
                .assert("predicate verdicts match", () => ({
                    empty: isGamepadMapping({}),
                    complete: isGamepadMapping(CUSTOM_MAPPING),
                    emptyId: isGamepadMapping({ id: "" }),
                    badDpad: isGamepadMapping({ dpad: { up: 0, down: 1, left: 2, right: -1 } }),
                    shortAxes: isGamepadMapping({ axes: [0] }),
                    fractionalAxis: isGamepadMapping({ axes: [0, 1.5] }),
                    shortRightAxes: isGamepadMapping({ rightAxes: [2] }),
                    badPedals: isGamepadMapping({ pedals: [6, -1] }),
                    shortButtons: isGamepadMapping({ buttons: [0, 1, 2] }),
                    badCoin: isGamepadMapping({ coin: -1 }),
                    badStart: isGamepadMapping({ start: "9" }),
                    chordsOff: isGamepadMapping({ chords: false }),
                    customChord: isGamepadMapping({ chords: { modifier: 10, bindings: [{ button: 3, control: { kind: "volume", direction: "up" } }] } }),
                    badModifier: isGamepadMapping({ chords: { modifier: -1 } }),
                    bindingOnModifier: isGamepadMapping({ chords: { modifier: 10, bindings: [{ button: 10, control: { kind: "test" } }] } }),
                    bindingOnDefaultModifier: isGamepadMapping({ chords: { bindings: [{ button: 8, control: { kind: "test" } }] } }),
                    duplicateBinding: isGamepadMapping({ chords: { bindings: [{ button: 3, control: { kind: "test" } }, { button: 3, control: { kind: "service" } }] } }),
                    directionBinding: isGamepadMapping({ chords: { bindings: [{ button: 3, control: { kind: "direction", player: 1, direction: "up" } }] } }),
                    badKeyBinding: isGamepadMapping({ chords: { bindings: [{ button: 3, control: { kind: "key", key: "F3" } }] } }),
                    frozenDefaults: Object.isFrozen(DEFAULT_GAMEPAD_CHORDS)
                        && Object.isFrozen(DEFAULT_GAMEPAD_CHORDS.bindings)
                        && (DEFAULT_GAMEPAD_CHORDS.bindings ?? []).every((binding) => Object.isFrozen(binding) && Object.isFrozen(binding.control)),
                    array: isGamepadMapping([]),
                    absent: isGamepadMapping(null),
                }), P.equals<unknown>({
                    empty: true,
                    complete: true,
                    emptyId: false,
                    badDpad: false,
                    shortAxes: false,
                    fractionalAxis: false,
                    shortRightAxes: false,
                    badPedals: false,
                    shortButtons: false,
                    badCoin: false,
                    badStart: false,
                    chordsOff: true,
                    customChord: true,
                    badModifier: false,
                    bindingOnModifier: false,
                    bindingOnDefaultModifier: false,
                    duplicateBinding: false,
                    directionBinding: false,
                    badKeyBinding: false,
                    frozenDefaults: true,
                    array: false,
                    absent: false,
                }))
                .start(undefined),
        },
        {
            label: "source config predicates distinguish required direct dependencies from optional init browser defaults",
            run: () => CTGTest.init("GamepadSource config predicates")
                .assert("predicate verdicts match", () => {
                    const input = new ArcadeInput({ session: new FakeArcadeSession() });
                    const provider = new FakeGamepadProvider();
                    const scheduler = new FakeFrameScheduler();
                    const target = new FakeEventTarget();
                    const full = { input, provider, scheduler, target, visibilityTarget: target, deadZone: 0.5, mapping: CUSTOM_MAPPING };
                    return {
                        full: isGamepadSourceConfig(full),
                        missingInput: isGamepadSourceConfig({ provider, scheduler, target }),
                        missingProvider: isGamepadSourceConfig({ input, scheduler, target }),
                        missingScheduler: isGamepadSourceConfig({ input, provider, target }),
                        missingTarget: isGamepadSourceConfig({ input, provider, scheduler }),
                        badVisibility: isGamepadSourceConfig({ input, provider, scheduler, target, visibilityTarget: {} }),
                        negativeDeadZone: isGamepadSourceConfig({ input, provider, scheduler, target, deadZone: -0.1 }),
                        unitDeadZone: isGamepadSourceConfig({ input, provider, scheduler, target, deadZone: 1 }),
                        nanDeadZone: isGamepadSourceConfig({ input, provider, scheduler, target, deadZone: Number.NaN }),
                        badMapping: isGamepadSourceConfig({ input, provider, scheduler, target, mapping: { coin: -1 } }),
                        initMinimal: isGamepadSourceInitConfig({ input }),
                        initFull: isGamepadSourceInitConfig(full),
                        initBadProvider: isGamepadSourceInitConfig({ input, provider: {} }),
                        initBadScheduler: isGamepadSourceInitConfig({ input, scheduler: { request(): number { return 1; } } }),
                        initBadTarget: isGamepadSourceInitConfig({ input, target: {} }),
                    };
                }, P.equals<unknown>({
                    full: true,
                    missingInput: false,
                    missingProvider: false,
                    missingScheduler: false,
                    missingTarget: false,
                    badVisibility: false,
                    negativeDeadZone: false,
                    unitDeadZone: false,
                    nanDeadZone: false,
                    badMapping: false,
                    initMinimal: true,
                    initFull: true,
                    initBadProvider: false,
                    initBadScheduler: false,
                    initBadTarget: false,
                }))
                .start(undefined),
        },
        {
            label: "directionsFor gives the d-pad precedence and applies one dead zone independently to both stick axes",
            run: () => CTGTest.init("gamepad direction mapping")
                .assert("d-pad, dead-zone boundaries and diagonal behavior match", () => ({
                    dpadBeatsStick: [...directionsFor(pad("pad", 0, [12], [1, 1]), 0.25)],
                    inside: [...directionsFor(pad("pad", 0, [], [0.249, -0.249]), 0.25)],
                    boundary: [...directionsFor(pad("pad", 0, [], [-0.25, 0.25]), 0.25)],
                    diagonal: [...directionsFor(pad("pad", 0, [], [0.8, -0.9]), 0.25)],
                    zeroAtZeroThreshold: [...directionsFor(pad("pad", 0), 0)],
                    customDpad: [...directionsFor(pad("custom pad", 0, [2], [1, 1]), 0.25, CUSTOM_MAPPING)],
                }), P.equals<unknown>({
                    dpadBeatsStick: ["up"],
                    inside: [],
                    boundary: ["down", "left"],
                    diagonal: ["up", "right"],
                    zeroAtZeroThreshold: [],
                    customDpad: ["left"],
                }))
                .start(undefined),
        },
        {
            label: "controlsFor maps standard and custom buttons, coin and start onto the assigned player",
            run: () => CTGTest.init("gamepad control mapping")
                .assert("logical controls are complete and ordered", () => ({
                    standard: controlsFor(pad("pad", 0, [0, 1, 2, 3, 4, 5, 8, 9], [0, -1]), 3, 0.25),
                    custom: controlsFor(pad("custom pad", 0, [0, 4, 5, 6, 11]), 2, 0.25, CUSTOM_MAPPING),
                }), P.equals<unknown>({
                    standard: [
                        { kind: "direction", player: 3, direction: "up" },
                        { kind: "button", player: 3, button: 1 },
                        { kind: "button", player: 3, button: 2 },
                        { kind: "button", player: 3, button: 3 },
                        { kind: "button", player: 3, button: 4 },
                        { kind: "button", player: 3, button: 5 },
                        { kind: "button", player: 3, button: 6 },
                        { kind: "coin", player: 3 },
                        { kind: "start", player: 3 },
                    ],
                    custom: [
                        { kind: "direction", player: 2, direction: "up" },
                        { kind: "button", player: 2, button: 1 },
                        { kind: "button", player: 2, button: 6 },
                        { kind: "coin", player: 2 },
                        { kind: "start", player: 2 },
                    ],
                }))
                .start(undefined),
        },
        {
            label: "declared axes remain active under the chord modifier, use dead-zone rescaling and release neutrals",
            run: () => CTGTest.init("gamepad analogue bindings")
                .stage("poll every bound axis kind, then disconnect", () => {
                    const provider = new FakeGamepadProvider();
                    const base = pad("pad", 0, [8], [0.625, -1, 0, 0.625]);
                    provider.pads = [withButtons(base, base.buttons.map((button, index) => index === 7
                            ? { pressed: true, value: 0.75 }
                            : index === 6 ? { pressed: false, value: 0.25 } : button))];
                    const scheduler = new FakeFrameScheduler();
                    const inputs: MachineInputs = {
                        analog: [
                            { player: 1, kind: "stick-x" }, { player: 1, kind: "stick-y" }, { player: 1, kind: "stick-z" },
                            { player: 1, kind: "pedal-1" }, { player: 1, kind: "pedal-2" },
                            { player: 1, kind: "dial" }, { player: 1, kind: "trackball-y" },
                        ],
                        dualStick: false,
                        keys: [],
                        volume: false,
                    };
                    const { input, session } = attachedSource(provider, scheduler, new FakeEventTarget(), undefined, inputs);
                    scheduler.tick(16);
                    const active = input.axes;
                    provider.pads = [];
                    scheduler.tick(32);
                    return { active, final: input.axes, calls: session.calls };
                })
                .assert("axis calls and disconnect recentering match", (state) => state.subject, P.equals<unknown>({
                    active: [
                        { axis: { player: 1, kind: "pedal-1" }, value: 0.5 },
                        { axis: { player: 1, kind: "pedal-2" }, value: -0.5 },
                        { axis: { player: 1, kind: "spin-x" }, value: 10 },
                        { axis: { player: 1, kind: "spin-y" }, value: -20 },
                        { axis: { player: 1, kind: "stick-x" }, value: 0.5 },
                        { axis: { player: 1, kind: "stick-y" }, value: -1 },
                        { axis: { player: 1, kind: "stick-z" }, value: 0.5 },
                    ],
                    final: [],
                    calls: [
                        axisCall({ player: 1, kind: "stick-x" }, 0.5),
                        axisCall({ player: 1, kind: "stick-y" }, -1),
                        axisCall({ player: 1, kind: "spin-x" }, 10),
                        axisCall({ player: 1, kind: "spin-y" }, -20),
                        axisCall({ player: 1, kind: "stick-z" }, 0.5),
                        axisCall({ player: 1, kind: "pedal-1" }, 0.5),
                        axisCall({ player: 1, kind: "pedal-2" }, -0.5),
                        axisCall({ player: 1, kind: "pedal-1" }, -1),
                        axisCall({ player: 1, kind: "pedal-2" }, -1),
                        axisCall({ player: 1, kind: "stick-x" }, 0),
                        axisCall({ player: 1, kind: "stick-y" }, 0),
                        axisCall({ player: 1, kind: "stick-z" }, 0),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "right-stick and pedal overrides select the configured physical indices",
            run: () => CTGTest.init("gamepad analogue overrides")
                .stage("poll a custom-mapped standard pad", () => {
                    const provider = new FakeGamepadProvider();
                    const base = pad("custom pad", 0, [], [1, 1, 0.625, 0, -1, 0.625]);
                    provider.pads = [withButtons(base, base.buttons.map((button, index) => index === 12
                            ? { pressed: true, value: 0.75 }
                            : index === 13 ? { pressed: false, value: 0.25 } : button))];
                    const scheduler = new FakeFrameScheduler();
                    const inputs: MachineInputs = {
                        analog: [
                            { player: 1, kind: "stick-x" }, { player: 1, kind: "stick-z" },
                            { player: 1, kind: "pedal-1" }, { player: 1, kind: "pedal-2" },
                        ],
                        dualStick: false,
                        keys: [],
                        volume: false,
                    };
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget(), CUSTOM_MAPPING, inputs);
                    scheduler.tick(16);
                    return session.calls;
                })
                .assert("overridden indices drive all four axes", (state) => state.subject, P.equals<unknown>([
                    axisCall({ player: 1, kind: "stick-x" }, 0.5),
                    axisCall({ player: 1, kind: "stick-z" }, 0.5),
                    axisCall({ player: 1, kind: "pedal-1" }, 0.5),
                    axisCall({ player: 1, kind: "pedal-2" }, -0.5),
                ]))
                .start(undefined),
        },
        {
            label: "axisFilter transforms absolute values and relative deltas before ArcadeInput receives them",
            run: () => CTGTest.init("gamepad axis filter")
                .stage("poll a filtered stick and spinner", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [], [0.625, 0])];
                    const scheduler = new FakeFrameScheduler();
                    const target = new FakeEventTarget();
                    const session = new FakeArcadeSession({ ...validMachineInfo(), inputs: {
                        analog: [{ player: 1, kind: "stick-x" }, { player: 1, kind: "dial" }],
                        dualStick: false, keys: [], volume: false,
                    } });
                    const input = new ArcadeInput({ session });
                    const seen: unknown[] = [];
                    const source = new GamepadSource({
                        input, provider, scheduler, target,
                        axisFilter: (axis, value) => { seen.push([axis, value]); return value * -2; },
                    });
                    source.attach();
                    scheduler.tick(16);
                    return { seen, axes: input.axes };
                })
                .assert("the filter sees normalized source values and may scale relative output", (state) => state.subject, P.equals<unknown>({
                    seen: [
                        [{ player: 1, kind: "stick-x" }, 0.5],
                        [{ player: 1, kind: "spin-x" }, 10],
                    ],
                    axes: [
                        { axis: { player: 1, kind: "spin-x" }, value: -20 },
                        { axis: { player: 1, kind: "stick-x" }, value: -1 },
                    ],
                }))
                .start(undefined),
        },
        {
            label: "a relative kind beside a declared joystick yields the left stick to directions; without the flag it spins",
            run: () => CTGTest.init("gamepad dial beside a joystick")
                .stage("poll a right-deflected stick on both machine shapes", () => {
                    const run = (joystick: boolean | undefined) => {
                        const provider = new FakeGamepadProvider();
                        provider.pads = [pad("pad", 0, [], [1, 0])];
                        const scheduler = new FakeFrameScheduler();
                        const { session } = attachedSource(provider, scheduler, new FakeEventTarget(), undefined, {
                            analog: [{ player: 1, kind: "dial" }], dualStick: false, keys: [], volume: false, ...(joystick === undefined ? {} : { joystick }),
                        });
                        scheduler.tick(16);
                        return { held: session.held, spins: session.calls.filter((call) => call.method === "setAxis").length };
                    };
                    return { withJoystick: run(true), unknown: run(undefined), dialOnly: run(false) };
                })
                .assert("the joystick board gets a direction and no spin; the others spin and hold nothing", (state) => state.subject, P.equals<unknown>({
                    withJoystick: { held: ["p1:direction:right"], spins: 0 },
                    unknown: { held: [], spins: 1 },
                    dialOnly: { held: [], spins: 1 },
                }))
                .start(undefined),
        },
        {
            label: "dual-stick discovery maps both sticks separately while the d-pad remains ordinary",
            run: () => CTGTest.init("gamepad dual-stick binding")
                .stage("poll diagonal sticks and one d-pad direction", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [14], [-1, -1, 1, 1])];
                    const scheduler = new FakeFrameScheduler();
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget(), undefined, { analog: [], dualStick: true, keys: [], volume: false });
                    scheduler.tick(16);
                    return { held: session.held, calls: session.calls };
                })
                .assert("ordinary and separate-stick controls coexist", (state) => state.subject, P.equals<unknown>({
                    held: ["p1:direction:left", "p1:stick:1:up", "p1:stick:1:left", "p1:stick:2:down", "p1:stick:2:right"],
                    calls: [
                        controlCall({ kind: "direction", player: 1, direction: "left" }, true),
                        controlCall({ kind: "stick", player: 1, stick: 1, direction: "up" }, true),
                        controlCall({ kind: "stick", player: 1, stick: 1, direction: "left" }, true),
                        controlCall({ kind: "stick", player: 1, stick: 2, direction: "down" }, true),
                        controlCall({ kind: "stick", player: 1, stick: 2, direction: "right" }, true),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "a machine declaring no new inputs preserves the pre-W26 standard layout exactly",
            run: () => CTGTest.init("gamepad no-declaration invariance")
                .stage("poll a deflected standard pad", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [], [1, -1, 0, 1])];
                    const scheduler = new FakeFrameScheduler();
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget());
                    scheduler.tick(16);
                    return session.calls;
                })
                .assert("only the original digital directions are sent", (state) => state.subject, P.equals<unknown>([
                    controlCall({ kind: "direction", player: 1, direction: "up" }, true),
                    controlCall({ kind: "direction", player: 1, direction: "right" }, true),
                ]))
                .start(undefined),
        },
        {
            label: "three standard pads take players 1 through 3 in provider connection order and non-standard pads require a named mapping",
            run: () => CTGTest.init("gamepad slot assignment")
                .stage("poll three standard pads plus one ignored non-standard pad", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("second-index", 7), pad("first-index", 2), pad("third", 9), pad("ignored", 10, [], [0, 0], "")];
                    const scheduler = new FakeFrameScheduler();
                    const target = new FakeEventTarget();
                    const { source } = attachedSource(provider, scheduler, target);
                    scheduler.tick(16);
                    const standardPlayers = source.players;

                    const namedProvider = new FakeGamepadProvider();
                    namedProvider.pads = [pad("custom pad", 4, [6], [0, 0], "")];
                    const namedScheduler = new FakeFrameScheduler();
                    const named = attachedSource(namedProvider, namedScheduler, new FakeEventTarget(), CUSTOM_MAPPING);
                    namedScheduler.tick(16);
                    return { standardPlayers, namedPlayers: named.source.players, namedHeld: named.session.held };
                })
                .assert("slots and explicit non-standard opt-in match", (state) => state.subject, P.equals<unknown>({
                    standardPlayers: [
                        { player: 1, id: "second-index" },
                        { player: 2, id: "first-index" },
                        { player: 3, id: "third" },
                    ],
                    namedPlayers: [{ player: 1, id: "custom pad" }],
                    namedHeld: ["p1:button:1"],
                }))
                .start(undefined),
        },
        {
            label: "devices lists standard and non-standard provider entries with current seat assignment",
            run: () => CTGTest.init("gamepad device list")
                .stage("read devices before and after assignment", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("motion sensor", 6, [], [0, 0], ""), pad("standard pad", 2)];
                    const scheduler = new FakeFrameScheduler();
                    const { source } = attachedSource(provider, scheduler, new FakeEventTarget());
                    const before = source.devices;
                    scheduler.tick(16);
                    const after = source.devices;
                    return { before, after, valid: after.every(isGamepadDevice) };
                })
                .assert("both devices remain visible while only the assignable pad gets a player", (state) => state.subject, P.equals<unknown>({
                    before: [
                        { index: 2, id: "standard pad", standard: true, player: null },
                        { index: 6, id: "motion sensor", standard: false, player: null },
                    ],
                    after: [
                        { index: 2, id: "standard pad", standard: true, player: 1 },
                        { index: 6, id: "motion sensor", standard: false, player: null },
                    ],
                    valid: true,
                }))
                .start(undefined),
        },
        {
            label: "unplugging player 1 releases its holds before freeing slot 1 for the next connection",
            run: () => CTGTest.init("gamepad disconnect replacement")
                .stage("assign two pads, drop the first and add a replacement", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("first", 0, [0, 12]), pad("second", 1, [1])];
                    const scheduler = new FakeFrameScheduler();
                    const { source, session } = attachedSource(provider, scheduler, new FakeEventTarget());
                    scheduler.tick(16);
                    const before = { players: source.players, held: session.held };
                    provider.pads = [null, pad("second", 1, [1]), pad("replacement", 3, [2])];
                    scheduler.tick(16);
                    return { before, after: { players: source.players, held: session.held }, calls: session.calls };
                })
                .assert("the released slot and controls belong to the expected pads", (state) => state.subject, P.equals<unknown>({
                    before: {
                        players: [{ player: 1, id: "first" }, { player: 2, id: "second" }],
                        held: ["p1:direction:up", "p1:button:1", "p2:button:2"],
                    },
                    after: {
                        players: [{ player: 1, id: "replacement" }, { player: 2, id: "second" }],
                        held: ["p2:button:2", "p1:button:3"],
                    },
                    calls: [
                        controlCall({ kind: "direction", player: 1, direction: "up" }, true),
                        controlCall({ kind: "button", player: 1, button: 1 }, true),
                        controlCall({ kind: "button", player: 2, button: 2 }, true),
                        controlCall({ kind: "button", player: 1, button: 1 }, false),
                        controlCall({ kind: "direction", player: 1, direction: "up" }, false),
                        controlCall({ kind: "button", player: 1, button: 3 }, true),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "a pad whose connected flag drops is released and removed even while its provider entry remains",
            run: () => CTGTest.init("gamepad connected flag")
                .stage("press through a connected pad, then retain it as disconnected", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [0])];
                    const scheduler = new FakeFrameScheduler();
                    const { source, session } = attachedSource(provider, scheduler, new FakeEventTarget());
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [0], [0, 0], "standard", false)];
                    scheduler.tick(16);
                    return { players: source.players, held: session.held, calls: session.calls };
                })
                .assert("the assigned channel releases and its slot is freed", (state) => state.subject, P.equals<unknown>({
                    players: [],
                    held: [],
                    calls: [
                        controlCall({ kind: "button", player: 1, button: 1 }, true),
                        controlCall({ kind: "button", player: 1, button: 1 }, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "unchanged polls are deduplicated and changed snapshots release falling edges before pressing rising edges",
            run: () => CTGTest.init("gamepad transition deduplication")
                .stage("repeat one snapshot, then change direction and action button", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [0], [-1, 0])];
                    const scheduler = new FakeFrameScheduler();
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget());
                    scheduler.tick(16);
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [1], [1, 0])];
                    scheduler.tick(16);
                    return session.calls;
                })
                .assert("only four physical transitions reach the channel", (state) => state.subject, P.equals<unknown>([
                    controlCall({ kind: "direction", player: 1, direction: "left" }, true),
                    controlCall({ kind: "button", player: 1, button: 1 }, true),
                    controlCall({ kind: "direction", player: 1, direction: "left" }, false),
                    controlCall({ kind: "button", player: 1, button: 1 }, false),
                    controlCall({ kind: "direction", player: 1, direction: "right" }, true),
                    controlCall({ kind: "button", player: 1, button: 2 }, true),
                ]))
                .start(undefined),
        },
        {
            label: "chords false preserves the original coin and start rising-edge taps byte for byte",
            run: () => CTGTest.init("gamepad chords-disabled coin and start taps")
                .stage("hold both buttons across polls and advance emulated ticks", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [8, 9])];
                    const scheduler = new FakeFrameScheduler();
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget(), { chords: false });
                    scheduler.tick(16);
                    scheduler.tick(16);
                    const whileTapped = session.held;
                    session.emitTick(3);
                    const afterTap = session.held;
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [8, 9])];
                    scheduler.tick(16);
                    return { whileTapped, afterTap, final: session.held, calls: session.calls };
                })
                .assert("each physical rising edge starts exactly one tap", (state) => state.subject, P.equals<unknown>({
                    whileTapped: ["p1:coin", "p1:start"],
                    afterTap: [],
                    final: ["p1:coin", "p1:start"],
                    calls: [
                        controlCall({ kind: "coin", player: 1 }, true),
                        controlCall({ kind: "start", player: 1 }, true),
                        controlCall({ kind: "coin", player: 1 }, false),
                        controlCall({ kind: "start", player: 1 }, false),
                        controlCall({ kind: "coin", player: 1 }, true),
                        controlCall({ kind: "start", player: 1 }, true),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "the default modifier defers a plain coin tap and holds an Advance chord without repeats or a coin",
            run: () => CTGTest.init("gamepad default operator chords")
                .stage("release a plain modifier, then hold and release its Start binding", () => {
                    const provider = new FakeGamepadProvider();
                    const scheduler = new FakeFrameScheduler();
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget());

                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    const onModifierPress = session.held;
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);
                    const onPlainRelease = session.held;
                    session.emitTick(3);

                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [8, 9])];
                    scheduler.tick(16);
                    scheduler.tick(16);
                    scheduler.tick(16);
                    const whileHeld = session.held;
                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    const afterStartRelease = session.held;
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);
                    return { onModifierPress, onPlainRelease, whileHeld, afterStartRelease, final: session.held, calls: session.calls };
                })
                .assert("coin and held-key edges match", (state) => state.subject, P.equals<unknown>({
                    onModifierPress: [],
                    onPlainRelease: ["p1:coin"],
                    whileHeld: ["key:F2"],
                    afterStartRelease: [],
                    final: [],
                    calls: [
                        controlCall({ kind: "coin", player: 1 }, true),
                        controlCall({ kind: "coin", player: 1 }, false),
                        controlCall({ kind: "key", key: "F2" }, true),
                        controlCall({ kind: "key", key: "F2" }, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "switching layers releases ordinary controls, requires a fresh chord press unless the button arrived with the modifier, and releases chords on disable or disconnect",
            run: () => CTGTest.init("gamepad chord edge reconciliation")
                .stage("cross the layer boundary, disable one chord and disconnect another", () => {
                    const provider = new FakeGamepadProvider();
                    const scheduler = new FakeFrameScheduler();
                    const { source, session } = attachedSource(provider, scheduler, new FakeEventTarget());

                    provider.pads = [pad("pad", 0, [0])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [0, 8])];
                    scheduler.tick(16);
                    const enteredWithButtonHeld = session.held;
                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [0, 8])];
                    scheduler.tick(16);
                    const freshChord = session.held;
                    provider.pads = [pad("pad", 0, [0])];
                    scheduler.tick(16);
                    const ordinaryReturns = session.held;
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [8, 9])];
                    scheduler.tick(16);
                    const samePoll = session.held;
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);

                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [8, 9])];
                    scheduler.tick(16);
                    source.enabled = false;
                    const afterDisable = session.held;
                    source.enabled = true;
                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [8, 9])];
                    scheduler.tick(16);
                    provider.pads = [];
                    scheduler.tick(16);
                    return { enteredWithButtonHeld, freshChord, ordinaryReturns, samePoll, afterDisable, final: session.held, calls: session.calls };
                })
                .assert("every digital edge is released before its replacement", (state) => state.subject, P.equals<unknown>({
                    enteredWithButtonHeld: [],
                    freshChord: ["test"],
                    ordinaryReturns: ["p1:button:1"],
                    samePoll: ["key:F2"],
                    afterDisable: [],
                    final: [],
                    calls: [
                        controlCall({ kind: "button", player: 1, button: 1 }, true),
                        controlCall({ kind: "button", player: 1, button: 1 }, false),
                        controlCall({ kind: "test" }, true),
                        controlCall({ kind: "test" }, false),
                        controlCall({ kind: "button", player: 1, button: 1 }, true),
                        controlCall({ kind: "button", player: 1, button: 1 }, false),
                        controlCall({ kind: "key", key: "F2" }, true),
                        controlCall({ kind: "key", key: "F2" }, false),
                        controlCall({ kind: "key", key: "F2" }, true),
                        controlCall({ kind: "key", key: "F2" }, false),
                        controlCall({ kind: "key", key: "F2" }, true),
                        controlCall({ kind: "key", key: "F2" }, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "a custom modifier leaves coin on its rising edge and custom bindings replace the defaults",
            run: () => CTGTest.init("gamepad custom operator chords")
                .stage("use index 10 as the modifier, then use one replacement binding", () => {
                    const provider = new FakeGamepadProvider();
                    const scheduler = new FakeFrameScheduler();
                    const mapping: GamepadMapping = { chords: { modifier: 10 } };
                    const { session } = attachedSource(provider, scheduler, new FakeEventTarget(), mapping);
                    provider.pads = [pad("pad", 0, [8])];
                    scheduler.tick(16);
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);
                    session.emitTick(3);
                    provider.pads = [pad("pad", 0, [10])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0, [9, 10])];
                    scheduler.tick(16);
                    const customModifierHeld = session.held;
                    provider.pads = [pad("pad", 0, [10])];
                    scheduler.tick(16);
                    provider.pads = [pad("pad", 0)];
                    scheduler.tick(16);

                    const replacementProvider = new FakeGamepadProvider();
                    const replacementScheduler = new FakeFrameScheduler();
                    const replacement = attachedSource(replacementProvider, replacementScheduler, new FakeEventTarget(), {
                        chords: { bindings: [{ button: 3, control: { kind: "volume", direction: "up" } }] },
                    });
                    replacementProvider.pads = [pad("pad", 0, [8])];
                    replacementScheduler.tick(16);
                    replacementProvider.pads = [pad("pad", 0, [8, 9])];
                    replacementScheduler.tick(16);
                    const defaultMissing = replacement.session.held;
                    replacementProvider.pads = [pad("pad", 0, [8, 3])];
                    replacementScheduler.tick(16);
                    const replacementHeld = replacement.session.held;
                    replacementProvider.pads = [pad("pad", 0, [8])];
                    replacementScheduler.tick(16);
                    replacementProvider.pads = [pad("pad", 0)];
                    replacementScheduler.tick(16);
                    return { customModifierHeld, calls: session.calls, defaultMissing, replacementHeld, replacementCalls: replacement.session.calls };
                })
                .assert("coin timing, silent modifier and replacement set match", (state) => state.subject, P.equals<unknown>({
                    customModifierHeld: ["key:F2"],
                    calls: [
                        controlCall({ kind: "coin", player: 1 }, true),
                        controlCall({ kind: "coin", player: 1 }, false),
                        controlCall({ kind: "key", key: "F2" }, true),
                        controlCall({ kind: "key", key: "F2" }, false),
                    ],
                    defaultMissing: [],
                    replacementHeld: ["volume:up"],
                    replacementCalls: [
                        controlCall({ kind: "volume", direction: "up" }, true),
                        controlCall({ kind: "volume", direction: "up" }, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "blur, hidden visibility, disable and detach release holds while the polling gate and listeners remain exact",
            run: () => CTGTest.init("gamepad focus and attachment lifecycle")
                .stage("exercise every non-terminal release boundary", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [0])];
                    const scheduler = new FakeFrameScheduler();
                    const target = new FakeEventTarget();
                    const visibility = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const source = new GamepadSource({ input, provider, scheduler, target, visibilityTarget: visibility });
                    source.attach();
                    source.attach();
                    scheduler.tick(16);
                    target.dispatch("blur");
                    const afterBlur = session.held;
                    scheduler.tick(16);
                    visibility.dispatch("visibilitychange");
                    const whileVisible = session.held;
                    visibility.visibilityState = "hidden";
                    visibility.dispatch("visibilitychange");
                    const afterHidden = session.held;
                    scheduler.tick(16);
                    source.enabled = false;
                    const disabled = { held: session.held, pending: scheduler.pending, enabled: source.enabled };
                    source.enabled = true;
                    scheduler.tick(16);
                    source.detach();
                    source.detach();
                    return {
                        afterBlur,
                        whileVisible,
                        afterHidden,
                        disabled,
                        final: { held: session.held, pending: scheduler.pending, attached: source.isAttached },
                        added: { target: target.added, visibility: visibility.added },
                        removed: { target: target.removed, visibility: visibility.removed },
                    };
                })
                .assert("every release and lifecycle boundary matches", (state) => state.subject, P.equals<unknown>({
                    afterBlur: [],
                    whileVisible: ["p1:button:1"],
                    afterHidden: [],
                    disabled: { held: [], pending: 0, enabled: false },
                    final: { held: [], pending: 0, attached: false },
                    added: { target: ["blur"], visibility: ["visibilitychange"] },
                    removed: { target: ["blur"], visibility: ["visibilitychange"] },
                }))
                .start(undefined),
        },
        {
            label: "init honors injected dependencies and destroy is terminal with typed config and lifecycle failures",
            run: () => CTGTest.init("GamepadSource validation and destroy")
                .stage("construct through init, reject bad values and destroy twice", () => {
                    const provider = new FakeGamepadProvider();
                    provider.pads = [pad("pad", 0, [0])];
                    const scheduler = new FakeFrameScheduler();
                    const target = new FakeEventTarget();
                    const input = new ArcadeInput({ session: new FakeArcadeSession() });
                    const source = GamepadSource.init({ input, provider, scheduler, target });
                    const config = { input, provider, scheduler, target, deadZone: 1 } as unknown as GamepadSourceConfig;
                    const constructorError = thrownBy(() => new GamepadSource(config));
                    const enabledError = thrownBy(() => { source.enabled = "yes" as unknown as boolean; });
                    source.attach();
                    scheduler.tick(16);
                    source.destroy();
                    source.destroy();
                    return {
                        instance: source instanceof GamepadSource,
                        constructorError: errorOf(constructorError),
                        configDataMatches: ArcadeRuntimeError.is(constructorError) && constructorError.data === config,
                        enabledError: errorOf(enabledError),
                        destroyed: {
                            attached: source.isAttached,
                            players: source.players,
                            pending: scheduler.pending,
                            attachError: errorOf(thrownBy(() => source.attach())),
                            enableError: errorOf(thrownBy(() => { source.enabled = true; })),
                        },
                    };
                })
                .assert("validation and terminal state match", (state) => state.subject, P.equals<unknown>({
                    instance: true,
                    constructorError: INVALID_CONFIG,
                    configDataMatches: true,
                    enabledError: INVALID_CONFIG,
                    destroyed: {
                        attached: false,
                        players: [],
                        pending: 0,
                        attachError: DESTROYED,
                        enableError: DESTROYED,
                    },
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
