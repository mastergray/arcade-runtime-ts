// realizes: docs/ui-spec.md > §3.4 key, pad, chord and menu-gesture capture

import {
    arcadeControlKey,
    type ArcadeControl,
    type GamepadLike,
    type GamepadMapping,
    type KeyboardMap,
} from "../../src/index.js";

export const UNBOUND_GAMEPAD_BUTTON = 65_535;

export type CaptureMode = "binding" | "chord" | "gesture";

export interface CaptureRequest {
    readonly id: string;
    readonly mode: CaptureMode;
    readonly modifier?: number;
}

export type CaptureResult =
    | { readonly device: "keyboard"; readonly code: string }
    | { readonly device: "gamepad"; readonly padId: string; readonly buttons: ReadonlyArray<number> };

export interface CaptureSnapshot {
    readonly request: CaptureRequest | null;
    readonly result: CaptureResult | null;
    readonly cancelled: boolean;
}

const pressedButtons = (pad: Pick<GamepadLike, "buttons">): number[] => pad.buttons.flatMap((button, index) =>
    button.pressed || button.value >= 0.5 ? [index] : []);

const sameButtons = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

export class BindingCapture {
    private requestValue: CaptureRequest | null = null;
    private resultValue: CaptureResult | null = null;
    private cancelledValue = false;
    private previous = new Map<string, ReadonlyArray<number>>();
    private gesturePad: string | null = null;
    private gestureButtons: ReadonlyArray<number> = [];

    get snapshot(): CaptureSnapshot {
        return { request: this.requestValue, result: this.resultValue, cancelled: this.cancelledValue };
    }

    begin(request: CaptureRequest, pads: ReadonlyArray<GamepadLike | null> = []): CaptureSnapshot {
        this.requestValue = { ...request };
        this.resultValue = null;
        this.cancelledValue = false;
        this.previous = new Map(pads.flatMap((pad) => pad === null ? [] : [[pad.id, pressedButtons(pad)] as const]));
        this.gesturePad = null;
        this.gestureButtons = [];
        return this.snapshot;
    }

    cancel(): CaptureSnapshot {
        this.requestValue = null;
        this.resultValue = null;
        this.cancelledValue = true;
        return this.snapshot;
    }

    key(code: string): CaptureSnapshot {
        if (this.requestValue === null) return this.snapshot;
        if (code === "Escape") return this.cancel();
        if (code.length === 0) return this.snapshot;
        return this.complete({ device: "keyboard", code });
    }

    sample(pads: ReadonlyArray<GamepadLike | null>): CaptureSnapshot {
        const request = this.requestValue;
        if (request === null) return this.snapshot;
        for (const pad of pads) {
            if (pad === null || !pad.connected) continue;
            const current = pressedButtons(pad);
            const before = this.previous.get(pad.id) ?? [];
            if (request.mode === "gesture") {
                if (this.gesturePad === null && current.length > 0 && !sameButtons(current, before)) {
                    this.gesturePad = pad.id;
                    this.gestureButtons = current;
                } else if (this.gesturePad === pad.id && current.length > 0) {
                    this.gestureButtons = current;
                } else if (this.gesturePad === pad.id && current.length === 0 && this.gestureButtons.length > 0) {
                    return this.complete({ device: "gamepad", padId: pad.id, buttons: this.gestureButtons });
                }
            } else {
                const rising = current.filter((button) => !before.includes(button));
                if (request.mode === "binding" && rising[0] !== undefined) {
                    return this.complete({ device: "gamepad", padId: pad.id, buttons: [rising[0]] });
                }
                const modifier = request.modifier ?? 8;
                const chordButton = rising.find((button) => button !== modifier);
                if (request.mode === "chord" && current.includes(modifier) && chordButton !== undefined) {
                    return this.complete({ device: "gamepad", padId: pad.id, buttons: [modifier, chordButton] });
                }
            }
            this.previous.set(pad.id, current);
        }
        return this.snapshot;
    }

    private complete(result: CaptureResult): CaptureSnapshot {
        this.resultValue = result.device === "keyboard" ? { ...result } : { ...result, buttons: Object.freeze([...result.buttons]) };
        this.requestValue = null;
        this.cancelledValue = false;
        return this.snapshot;
    }
}

const controlMatches = (left: ArcadeControl, right: ArcadeControl): boolean => arcadeControlKey(left) === arcadeControlKey(right);

export const keyboardCodeFor = (map: KeyboardMap, control: ArcadeControl): string | null =>
    Object.entries(map).find(([, candidate]) => controlMatches(candidate, control))?.[0] ?? null;

export const moveKeyboardBinding = (map: KeyboardMap, control: ArcadeControl, code: string): KeyboardMap => {
    const next = Object.fromEntries(Object.entries(map).filter(([candidateCode, candidate]) =>
        candidateCode !== code && !controlMatches(candidate, control)));
    next[code] = Object.freeze({ ...control });
    return Object.freeze(next);
};

const DEFAULT_DPAD = Object.freeze({ up: 12, down: 13, left: 14, right: 15 });
const DEFAULT_BUTTONS = Object.freeze([0, 1, 2, 3, 4, 5] as const);

export const gamepadButtonFor = (mapping: GamepadMapping, control: ArcadeControl): number | null => {
    if (control.kind === "direction") return (mapping.dpad ?? DEFAULT_DPAD)[control.direction];
    if (control.kind === "button") return (mapping.buttons ?? DEFAULT_BUTTONS)[control.button - 1] ?? null;
    if (control.kind === "coin") return mapping.coin ?? 8;
    if (control.kind === "start") return mapping.start ?? 9;
    const chord = mapping.chords === false ? undefined : mapping.chords?.bindings?.find((binding) => controlMatches(binding.control, control));
    return chord?.button ?? null;
};

const clearDuplicate = (values: number[], button: number, except: number): void => {
    for (let index = 0; index < values.length; index++) if (index !== except && values[index] === button) values[index] = UNBOUND_GAMEPAD_BUTTON;
};

export const moveGamepadBinding = (mapping: GamepadMapping, control: ArcadeControl, button: number, chord = false): GamepadMapping => {
    if (chord || control.kind === "service" || control.kind === "test" || control.kind === "tilt"
        || control.kind === "volume" || control.kind === "key") {
        const modifier = mapping.chords === false ? mapping.coin ?? 8 : mapping.chords?.modifier ?? mapping.coin ?? 8;
        const bindings = (mapping.chords === false ? [] : [...mapping.chords?.bindings ?? []])
            .filter((binding) => !controlMatches(binding.control, control) && binding.button !== button);
        bindings.push({ button, control: Object.freeze({ ...control }) });
        return Object.freeze({ ...mapping, chords: Object.freeze({ modifier, bindings: Object.freeze(bindings) }) });
    }
    const dpad = { ...(mapping.dpad ?? DEFAULT_DPAD) };
    const buttons = [...(mapping.buttons ?? DEFAULT_BUTTONS)] as [number, number, number, number, number, number];
    const ordinary = [dpad.up, dpad.down, dpad.left, dpad.right, ...buttons, mapping.coin ?? 8, mapping.start ?? 9];
    const target = control.kind === "direction" ? ["up", "down", "left", "right"].indexOf(control.direction)
        : control.kind === "button" ? 4 + control.button - 1
            : control.kind === "coin" ? 10 : 11;
    clearDuplicate(ordinary, button, target);
    ordinary[target] = button;
    dpad.up = ordinary[0] ?? UNBOUND_GAMEPAD_BUTTON;
    dpad.down = ordinary[1] ?? UNBOUND_GAMEPAD_BUTTON;
    dpad.left = ordinary[2] ?? UNBOUND_GAMEPAD_BUTTON;
    dpad.right = ordinary[3] ?? UNBOUND_GAMEPAD_BUTTON;
    for (let index = 0; index < 6; index++) buttons[index] = ordinary[index + 4] ?? UNBOUND_GAMEPAD_BUTTON;
    return Object.freeze({ ...mapping, dpad: Object.freeze(dpad), buttons: Object.freeze(buttons), coin: ordinary[10], start: ordinary[11] });
};

const PAD_LABELS: Readonly<Record<number, string>> = Object.freeze({
    0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT",
    8: "Select", 9: "Start", 10: "L3", 11: "R3", 12: "D-pad up", 13: "D-pad down",
    14: "D-pad left", 15: "D-pad right",
});

export const keyLabel = (code: string | null): string => {
    if (code === null) return "unbound";
    const labels: Readonly<Record<string, string>> = {
        ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
        ControlLeft: "Left Ctrl", ControlRight: "Right Ctrl", ShiftLeft: "Left Shift", ShiftRight: "Right Shift",
        AltLeft: "Left Alt", AltRight: "Right Alt", Space: "Space", Enter: "Enter",
    };
    return labels[code] ?? code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Numpad ");
};

export const gamepadButtonLabel = (button: number | null): string => button === null || button === UNBOUND_GAMEPAD_BUTTON
    ? "unbound"
    : PAD_LABELS[button] ?? `Button ${button}`;

export const gamepadChordLabel = (buttons: ReadonlyArray<number>): string => buttons.length === 0
    ? "unbound"
    : buttons.map(gamepadButtonLabel).join(" + ");
