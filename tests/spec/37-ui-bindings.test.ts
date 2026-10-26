// realizes: docs/ui-spec.md > §3.4 controls capture and binding labels

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import type { GamepadLike } from "../../src/index.ts";
import {
    BindingCapture,
    UNBOUND_GAMEPAD_BUTTON,
    gamepadButtonFor,
    gamepadButtonLabel,
    gamepadChordLabel,
    keyLabel,
    keyboardCodeFor,
    moveGamepadBinding,
    moveKeyboardBinding,
} from "../../ui/model/bindings.ts";
import type { TestFile } from "../run.ts";

const pad = (down: ReadonlyArray<number>): GamepadLike => ({
    id: "Synthetic standard pad",
    index: 0,
    connected: true,
    mapping: "standard",
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: down.includes(index), value: down.includes(index) ? 1 : 0 })),
    axes: [0, 0, 0, 0],
});

interface BindingResult {
    readonly cancelled: boolean;
    readonly keyCaptured: boolean;
    readonly padCaptured: boolean;
    readonly chordCaptured: boolean;
    readonly gestureCaptured: boolean;
    readonly keyMoved: boolean;
    readonly padMoved: boolean;
    readonly labels: boolean;
}

const inspectBindings = (): BindingResult => {
    const capture = new BindingCapture();
    capture.begin({ id: "button-1", mode: "binding" });
    const cancelled = capture.key("Escape").cancelled;
    capture.begin({ id: "button-1", mode: "binding" });
    const keyCaptured = capture.key("KeyT").result?.device === "keyboard";

    capture.begin({ id: "button-1", mode: "binding" }, [pad([])]);
    const padResult = capture.sample([pad([2])]).result;
    const padCaptured = padResult?.device === "gamepad" && padResult.buttons[0] === 2;

    capture.begin({ id: "service", mode: "chord", modifier: 8 }, [pad([])]);
    const chordResult = capture.sample([pad([8, 3])]).result;
    const chordCaptured = chordResult?.device === "gamepad" && gamepadChordLabel(chordResult.buttons) === "Select + Y";

    capture.begin({ id: "menu", mode: "gesture" }, [pad([])]);
    capture.sample([pad([10, 11])]);
    capture.sample([pad([11])]);
    const gestureResult = capture.sample([pad([])]).result;
    const gestureCaptured = gestureResult?.device === "gamepad" && gamepadChordLabel(gestureResult.buttons) === "L3 + R3";

    const first = { kind: "button" as const, player: 1 as const, button: 1 as const };
    const second = { kind: "button" as const, player: 1 as const, button: 2 as const };
    const keyboard = moveKeyboardBinding({ KeyA: first, KeyB: second }, second, "KeyA");
    const keyMoved = keyboardCodeFor(keyboard, first) === null && keyboardCodeFor(keyboard, second) === "KeyA";
    const mapping = moveGamepadBinding({}, second, 0);
    const padMoved = gamepadButtonFor(mapping, first) === UNBOUND_GAMEPAD_BUTTON && gamepadButtonFor(mapping, second) === 0;
    const labels = keyLabel("ControlLeft") === "Left Ctrl" && keyLabel(null) === "unbound"
        && gamepadButtonLabel(0) === "A" && gamepadButtonLabel(UNBOUND_GAMEPAD_BUTTON) === "unbound";
    return { cancelled, keyCaptured, padCaptured, chordCaptured, gestureCaptured, keyMoved, padMoved, labels };
};

const testFile: TestFile = {
    label: "local controls binding editor",
    cases: [{
        label: "capture cancels, moves duplicate bindings, records chords and formats device labels",
        run: () => CTGTest.init("controls binding capture")
            .assert("capture and mapping state is deterministic", inspectBindings, P.equals<BindingResult>({
                cancelled: true,
                keyCaptured: true,
                padCaptured: true,
                chordCaptured: true,
                gestureCaptured: true,
                keyMoved: true,
                padMoved: true,
                labels: true,
            }))
            .start(undefined),
    }],
};

export default testFile;
