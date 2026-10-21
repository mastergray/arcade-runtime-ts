// realizes: docs/arcade-runtime-spec.md > §10.3 KeyboardSource (fake-target mapping, focus loss and lifecycle)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";   // Real channel owner under the source
import KeyboardSource, { DEFAULT_KEYBOARD_MAP } from "../../src/KeyboardSource/KeyboardSource.ts";   // Source and default map under test
import {
    isKeyboardEventTargetLike,                                    // Injected target guard
    isKeyboardMap,                                                // Page-map guard
    isKeyboardSourceConfig,                                       // Direct config guard
    isKeyboardSourceInitConfig,                                   // Browser-defaulting config guard
    isKeyboardVisibilityTargetLike,                               // Visibility target guard
} from "../../src/KeyboardSource/types.ts";
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed rejection identity
import { arcadeControlKey } from "../../src/shared.types.ts";     // Canonical default-map snapshots
import FakeArcadeSession, { type FakeSessionCall } from "../support/FakeArcadeSession.ts";   // Required W0 session double
import { errorSnapshot, thrownBy, type ErrorSnapshot } from "../support/fixtures.ts";   // Error capture helpers

// Type dependencies:
import type { ArcadeControl } from "../../src/shared.types.ts";   // Mapping fixtures
import type {
    KeyboardEventTargetLike,                                     // Fake target contract
    KeyboardMap,                                                 // Mapping fixture shape
    KeyboardSourceConfig,                                        // Rejected config casts
} from "../../src/KeyboardSource/types.ts";
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: event fields the source reads plus observable prevention state
// Cast to Event only at dispatch so the spec test never needs a DOM KeyboardEvent.
interface FakeKeyEvent {
    readonly code: string;                                       // Physical code
    readonly repeat: boolean;                                    // Auto-repeat flag
    defaultPrevented: boolean;                                   // Whether preventDefault ran
    preventDefault(): void;                                      // Marks defaultPrevented
}

/**
 *
 * Class
 *
 */

// Minimal add/remove/dispatch target used to prove all source target logic without a DOM.
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

    // INSTANCE :: STRING, event -> VOID
    // Delivers an event synchronously to a stable copy of the listeners.
    dispatch(type: string, event: Event = { preventDefault(): void {} } as Event): void {
        for (const listener of [...(this._listeners.get(type) ?? [])]) listener(event);
    }
}

/**
 *
 * Constants
 *
 */

const UP_1 = { kind: "direction", player: 1, direction: "up" } as const satisfies ArcadeControl;
const LEFT_1 = { kind: "direction", player: 1, direction: "left" } as const satisfies ArcadeControl;
const BUTTON_1 = { kind: "button", player: 1, button: 1 } as const satisfies ArcadeControl;
const TEST_MAP: KeyboardMap = Object.freeze({ ArrowUp: UP_1, ArrowLeft: LEFT_1, KeyA: BUTTON_1 });
const DESTROYED: ErrorSnapshot = { isRuntimeError: true, code: 10, label: "DESTROYED" };

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, BOOLEAN? -> fakeKeyEvent
// A keyboard-shaped event recording default prevention.
const keyEvent = (code: string, repeat = false): FakeKeyEvent => ({
    code,
    repeat,
    defaultPrevented: false,
    preventDefault(): void { this.defaultPrevented = true; },
});

// HELPER :: fakeEventTarget, STRING, BOOLEAN? -> fakeKeyEvent
// Dispatches one keyboard-shaped event and returns its prevention state.
const dispatchKey = (target: FakeEventTarget, type: "keydown" | "keyup", code: string, repeat = false): FakeKeyEvent => {
    const event = keyEvent(code, repeat);
    target.dispatch(type, event as unknown as Event);
    return event;
};

// HELPER :: arcadeControl, BOOLEAN -> fakeSessionCall
// One expected session control call.
const controlCall = (control: ArcadeControl, pressed: boolean): FakeSessionCall => ({ method: "setControl", args: [control, pressed] });

// HELPER :: UNKNOWN -> errorSnapshot
// Runtime-error identity for a thrown value.
const errorOf = (value: unknown): ErrorSnapshot => errorSnapshot(value, ArcadeRuntimeError);

const testFile: TestFile = {
    label: "KeyboardSource",
    cases: [
        {
            label: "isKeyboardMap accepts empty and complete maps and rejects a bad code or control",
            run: () => CTGTest.init("keyboard map predicate")
                .assert("predicate verdicts match", () => ({
                    empty: isKeyboardMap({}),
                    full: isKeyboardMap(TEST_MAP),
                    badCode: isKeyboardMap({ "Arrow-Up": UP_1 }),
                    badControl: isKeyboardMap({ ArrowUp: { kind: "direction", player: 0, direction: "up" } }),
                    array: isKeyboardMap([]),
                    absent: isKeyboardMap(null),
                }), P.equals<unknown>({ empty: true, full: true, badCode: false, badControl: false, array: false, absent: false }))
                .start(undefined),
        },
        {
            label: "DEFAULT_KEYBOARD_MAP is deeply frozen and matches the required P1 and pinned 0.161 P2 layout exactly",
            run: () => CTGTest.init("default keyboard map")
                .assert("canonical entries and freezing match", () => ({
                    entries: Object.entries(DEFAULT_KEYBOARD_MAP).map(([code, control]) => [code, arcadeControlKey(control)]),
                    frozen: Object.isFrozen(DEFAULT_KEYBOARD_MAP),
                    valuesFrozen: Object.values(DEFAULT_KEYBOARD_MAP).every(Object.isFrozen),
                    hasKeyE: Object.prototype.hasOwnProperty.call(DEFAULT_KEYBOARD_MAP, "KeyE"),
                }), P.equals<unknown>({
                    entries: [
                        ["ArrowUp", "p1:direction:up"],
                        ["ArrowDown", "p1:direction:down"],
                        ["ArrowLeft", "p1:direction:left"],
                        ["ArrowRight", "p1:direction:right"],
                        ["ControlLeft", "p1:button:1"],
                        ["AltLeft", "p1:button:2"],
                        ["Space", "p1:button:3"],
                        ["ShiftLeft", "p1:button:4"],
                        ["KeyZ", "p1:button:5"],
                        ["KeyX", "p1:button:6"],
                        ["Digit5", "p1:coin"],
                        ["Digit1", "p1:start"],
                        ["F2", "test"],
                        ["Digit9", "service"],
                        ["KeyR", "p2:direction:up"],
                        ["KeyF", "p2:direction:down"],
                        ["KeyD", "p2:direction:left"],
                        ["KeyG", "p2:direction:right"],
                        ["KeyA", "p2:button:1"],
                        ["KeyS", "p2:button:2"],
                        ["KeyQ", "p2:button:3"],
                        ["KeyW", "p2:button:4"],
                        ["Digit6", "p2:coin"],
                        ["Digit2", "p2:start"],
                    ],
                    frozen: true,
                    valuesFrozen: true,
                    hasKeyE: false,
                }))
                .start(undefined),
        },
        {
            label: "target, visibility and source config predicates cover every required and optional field",
            run: () => CTGTest.init("KeyboardSource predicates")
                .assert("predicate verdicts match", () => {
                    const target = new FakeEventTarget();
                    const input = new ArcadeInput({ session: new FakeArcadeSession() });
                    const full = { input, map: TEST_MAP, target, visibilityTarget: target, preventDefault: false };
                    return {
                        target: isKeyboardEventTargetLike(target),
                        badTarget: isKeyboardEventTargetLike({ addEventListener(): void {} }),
                        visibility: isKeyboardVisibilityTargetLike(target),
                        badVisibility: isKeyboardVisibilityTargetLike({ ...target, visibilityState: 1 }),
                        config: isKeyboardSourceConfig(full),
                        missingTarget: isKeyboardSourceConfig({ input, map: TEST_MAP }),
                        initWithoutTargets: isKeyboardSourceInitConfig({ input, map: TEST_MAP }),
                        initBadPrevent: isKeyboardSourceInitConfig({ input, map: TEST_MAP, preventDefault: "no" }),
                    };
                }, P.equals<unknown>({
                    target: true,
                    badTarget: false,
                    visibility: true,
                    badVisibility: false,
                    config: true,
                    missingTarget: false,
                    initWithoutTargets: true,
                    initBadPrevent: false,
                }))
                .start(undefined),
        },
        {
            label: "attach forwards mapped down and up, ignores repeat and unmapped codes, and prevents only handled events",
            run: () => CTGTest.init("keyboard forwarding")
                .stage("attach and dispatch mapped, repeat and unmapped events", () => {
                    const target = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const source = new KeyboardSource({ input: new ArcadeInput({ session }), map: TEST_MAP, target });
                    source.attach();
                    const down = dispatchKey(target, "keydown", "ArrowUp");
                    const repeat = dispatchKey(target, "keydown", "KeyA", true);
                    const unmapped = dispatchKey(target, "keydown", "KeyB");
                    const malformed = dispatchKey(target, "keydown", "Arrow-Up");
                    const up = dispatchKey(target, "keyup", "ArrowUp");
                    return {
                        calls: session.calls,
                        prevented: { down: down.defaultPrevented, repeat: repeat.defaultPrevented, unmapped: unmapped.defaultPrevented, malformed: malformed.defaultPrevented, up: up.defaultPrevented },
                    };
                })
                .assert("only the mapped non-repeat pair is handled", (state) => state.subject, P.equals<unknown>({
                    calls: [controlCall(UP_1, true), controlCall(UP_1, false)],
                    prevented: { down: true, repeat: false, unmapped: false, malformed: false, up: true },
                }))
                .start(undefined),
        },
        {
            label: "two keyboard sources use separate channels so one keyup cannot cancel the other's hold",
            run: () => CTGTest.init("keyboard channel isolation")
                .stage("hold the same mapping through two targets", () => {
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const firstTarget = new FakeEventTarget();
                    const secondTarget = new FakeEventTarget();
                    const first = new KeyboardSource({ input, map: TEST_MAP, target: firstTarget });
                    const second = new KeyboardSource({ input, map: TEST_MAP, target: secondTarget });
                    first.attach();
                    second.attach();
                    dispatchKey(firstTarget, "keydown", "ArrowUp");
                    dispatchKey(secondTarget, "keydown", "ArrowUp");
                    dispatchKey(firstTarget, "keyup", "ArrowUp");
                    const afterFirst = { snapshot: input.snapshot, calls: session.calls.length };
                    dispatchKey(secondTarget, "keyup", "ArrowUp");
                    return { afterFirst, final: input.snapshot, calls: session.calls };
                })
                .assert("the session sees only first press and last release", (state) => state.subject, P.equals<unknown>({
                    afterFirst: { snapshot: [UP_1], calls: 1 },
                    final: [],
                    calls: [controlCall(UP_1, true), controlCall(UP_1, false)],
                }))
                .start(undefined),
        },
        {
            label: "enabled false releases this source, gates without preventing, and enabled true resumes forwarding",
            run: () => CTGTest.init("keyboard enabled gate")
                .stage("hold, close the gate, dispatch, then reopen", () => {
                    const target = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const source = new KeyboardSource({ input, map: TEST_MAP, target });
                    source.attach();
                    dispatchKey(target, "keydown", "KeyA");
                    dispatchKey(target, "keydown", "ArrowLeft");
                    source.enabled = false;
                    const gated = dispatchKey(target, "keydown", "ArrowUp");
                    const afterClose = { snapshot: input.snapshot, enabled: source.enabled };
                    source.enabled = true;
                    dispatchKey(target, "keydown", "ArrowUp");
                    return { afterClose, gatedPrevented: gated.defaultPrevented, final: input.snapshot, calls: session.calls };
                })
                .assert("closing releases canonically and reopening works", (state) => state.subject, P.equals<unknown>({
                    afterClose: { snapshot: [], enabled: false },
                    gatedPrevented: false,
                    final: [UP_1],
                    calls: [
                        controlCall(BUTTON_1, true), controlCall(LEFT_1, true),
                        controlCall(BUTTON_1, false), controlCall(LEFT_1, false),
                        controlCall(UP_1, true),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "blur and hidden visibility release held controls while visible visibilitychange does not",
            run: () => CTGTest.init("keyboard focus loss")
                .stage("dispatch visibility changes and blur through separate fake targets", () => {
                    const target = new FakeEventTarget();
                    const visibility = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const source = new KeyboardSource({ input, map: TEST_MAP, target, visibilityTarget: visibility });
                    source.attach();
                    dispatchKey(target, "keydown", "ArrowUp");
                    visibility.dispatch("visibilitychange");
                    const visible = input.snapshot;
                    visibility.visibilityState = "hidden";
                    visibility.dispatch("visibilitychange");
                    dispatchKey(target, "keydown", "KeyA");
                    target.dispatch("blur");
                    return { visible, final: input.snapshot, calls: session.calls };
                })
                .assert("only hidden and blur release", (state) => state.subject, P.equals<unknown>({
                    visible: [UP_1],
                    final: [],
                    calls: [
                        controlCall(UP_1, true), controlCall(UP_1, false),
                        controlCall(BUTTON_1, true), controlCall(BUTTON_1, false),
                    ],
                }))
                .start(undefined),
        },
        {
            label: "preventDefault false still forwards mapped events without preventing them",
            run: () => CTGTest.init("keyboard preventDefault option")
                .stage("dispatch with prevention disabled", () => {
                    const target = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const source = new KeyboardSource({ input: new ArcadeInput({ session }), map: TEST_MAP, target, preventDefault: false });
                    source.attach();
                    const event = dispatchKey(target, "keydown", "KeyA");
                    return { prevented: event.defaultPrevented, calls: session.calls };
                })
                .assert("event is forwarded but not prevented", (state) => state.subject, P.equals<unknown>({
                    prevented: false, calls: [controlCall(BUTTON_1, true)],
                }))
                .start(undefined),
        },
        {
            label: "attach, detach and destroy manage listeners and holds exactly once",
            run: () => CTGTest.init("keyboard listener lifecycle")
                .stage("attach twice, detach twice, reattach and destroy twice", () => {
                    const target = new FakeEventTarget();
                    const visibility = new FakeEventTarget();
                    const session = new FakeArcadeSession();
                    const input = new ArcadeInput({ session });
                    const source = new KeyboardSource({ input, map: TEST_MAP, target, visibilityTarget: visibility });
                    source.attach();
                    source.attach();
                    dispatchKey(target, "keydown", "KeyA");
                    source.detach();
                    source.detach();
                    const ignored = dispatchKey(target, "keydown", "ArrowUp");
                    source.attach();
                    dispatchKey(target, "keydown", "ArrowUp");
                    source.destroy();
                    source.destroy();
                    return {
                        added: { target: target.added, visibility: visibility.added },
                        removed: { target: target.removed, visibility: visibility.removed },
                        ignoredPrevented: ignored.defaultPrevented,
                        attached: source.isAttached,
                        snapshot: input.snapshot,
                        calls: session.calls,
                        attachError: errorOf(thrownBy(() => source.attach())),
                        enabledError: errorOf(thrownBy(() => { source.enabled = false; })),
                    };
                })
                .assert("listeners, releases and terminal errors match", (state) => state.subject, P.equals<unknown>({
                    added: {
                        target: ["keydown", "keyup", "blur", "keydown", "keyup", "blur"],
                        visibility: ["visibilitychange", "visibilitychange"],
                    },
                    removed: {
                        target: ["keydown", "keyup", "blur", "keydown", "keyup", "blur"],
                        visibility: ["visibilitychange", "visibilitychange"],
                    },
                    ignoredPrevented: false,
                    attached: false,
                    snapshot: [],
                    calls: [
                        controlCall(BUTTON_1, true), controlCall(BUTTON_1, false),
                        controlCall(UP_1, true), controlCall(UP_1, false),
                    ],
                    attachError: DESTROYED,
                    enabledError: DESTROYED,
                }))
                .start(undefined),
        },
        {
            label: "init honors injected targets, while constructor and enabled reject invalid values with INVALID_CONFIG",
            run: () => CTGTest.init("KeyboardSource validation")
                .stage("construct through init and attempt rejected values", () => {
                    const target = new FakeEventTarget();
                    const input = new ArcadeInput({ session: new FakeArcadeSession() });
                    const source = KeyboardSource.init({ input, map: TEST_MAP, target });
                    const config = { input, map: TEST_MAP, target: null } as unknown as KeyboardSourceConfig;
                    const constructorError = thrownBy(() => new KeyboardSource(config));
                    const enabledError = thrownBy(() => { source.enabled = "yes" as unknown as boolean; });
                    return {
                        instance: source instanceof KeyboardSource,
                        attached: source.isAttached,
                        constructorError: errorOf(constructorError),
                        configDataMatches: ArcadeRuntimeError.is(constructorError) && constructorError.data === config,
                        enabledError: errorOf(enabledError),
                        enabled: source.enabled,
                    };
                })
                .assert("init is detached and rejections are typed", (state) => state.subject, P.equals<unknown>({
                    instance: true,
                    attached: false,
                    constructorError: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    configDataMatches: true,
                    enabledError: { isRuntimeError: true, code: 1, label: "INVALID_CONFIG" },
                    enabled: true,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
