// realizes: docs/arcade-runtime-spec.md > §10.3 KeyboardSource

// Dependencies:
import ArcadeInput from "../ArcadeInput/ArcadeInput.js";          // Input receiving mapped controls through an owned channel
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed config and lifecycle failures

// Type dependencies:
import { isKeyCode, type ArcadeControl, type ArcadeKeyName, type KeyCode } from "../shared.types.js";   // Event-code validation and default-map values
import type { ArcadeInputChannel } from "../ArcadeInput/types.js";   // Independently releasable source channel
import {
    isKeyboardSourceConfig,                                       // Guards direct construction
    isKeyboardSourceInitConfig,                                   // Guards init before reading browser globals
    type KeyboardEventTargetLike,                                 // Injected event boundary
    type KeyboardMap,                                             // Physical-code mapping
    type KeyboardSourceConfig,                                    // Direct construction config
    type KeyboardSourceInitConfig,                                // init config with optional browser targets
    type KeyboardVisibilityTargetLike,                            // Injected visibility boundary
} from "./types.js";

/**
 *
 * Constants
 *
 */

// HELPER :: arcadeControl -> arcadeControl
// Freezes one default-map value so the exported map is immutable at both levels.
const frozenControl = <T extends ArcadeControl>(control: T): T => Object.freeze(control);

const PASSTHROUGH_KEYS: Readonly<Record<string, ArcadeKeyName>> = Object.freeze({
    F1: "F1", F2: "F2", F5: "F5", F6: "F6",
    Digit0: "0", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4",
    Digit5: "5", Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9",
});                                                               // Browser codes whose field-level MAME meanings remain reachable

// MAME 0.161 src/emu/inpttype.h defaults are used for P2: R/F/D/G directions,
// A/S/Q/W buttons 1–4, Digit6 coin and Digit2 start. P2 buttons 5–6 have no
// keyboard defaults in that pinned file, so this map deliberately leaves them unbound.
export const DEFAULT_KEYBOARD_MAP: KeyboardMap = Object.freeze({
    ArrowUp: frozenControl({ kind: "direction", player: 1, direction: "up" }),
    ArrowDown: frozenControl({ kind: "direction", player: 1, direction: "down" }),
    ArrowLeft: frozenControl({ kind: "direction", player: 1, direction: "left" }),
    ArrowRight: frozenControl({ kind: "direction", player: 1, direction: "right" }),
    ControlLeft: frozenControl({ kind: "button", player: 1, button: 1 }),
    AltLeft: frozenControl({ kind: "button", player: 1, button: 2 }),
    Space: frozenControl({ kind: "button", player: 1, button: 3 }),
    ShiftLeft: frozenControl({ kind: "button", player: 1, button: 4 }),
    KeyZ: frozenControl({ kind: "button", player: 1, button: 5 }),
    KeyX: frozenControl({ kind: "button", player: 1, button: 6 }),
    KeyC: frozenControl({ kind: "pedal", player: 1, pedal: 1 }),
    KeyV: frozenControl({ kind: "pedal", player: 1, pedal: 2 }),
    Digit5: frozenControl({ kind: "coin", player: 1 }),
    Digit1: frozenControl({ kind: "start", player: 1 }),
    F2: frozenControl({ kind: "test" }),
    Digit9: frozenControl({ kind: "service" }),
    Equal: frozenControl({ kind: "volume", direction: "up" }),
    Minus: frozenControl({ kind: "volume", direction: "down" }),
    KeyR: frozenControl({ kind: "direction", player: 2, direction: "up" }),
    KeyF: frozenControl({ kind: "direction", player: 2, direction: "down" }),
    KeyD: frozenControl({ kind: "direction", player: 2, direction: "left" }),
    KeyG: frozenControl({ kind: "direction", player: 2, direction: "right" }),
    KeyA: frozenControl({ kind: "button", player: 2, button: 1 }),
    KeyS: frozenControl({ kind: "button", player: 2, button: 2 }),
    KeyQ: frozenControl({ kind: "button", player: 2, button: 3 }),
    KeyW: frozenControl({ kind: "button", player: 2, button: 4 }),
    Digit6: frozenControl({ kind: "coin", player: 2 }),
    Digit2: frozenControl({ kind: "start", player: 2 }),
});

/**
 *
 * Class
 *
 */

// Maps physical keyboard events to an independently owned ArcadeInput channel and releases it when page focus is lost
export default class KeyboardSource {

    /* Static Fields */
    static readonly DEFAULT_PREVENT_DEFAULT = true;               // Handled key events are prevented unless configured otherwise

    /* Instance Fields */
    private readonly _channel: ArcadeInputChannel;                 // This source's independently releasable input ownership
    private readonly _map: KeyboardMap;                            // Physical codes to arcade controls
    private readonly _target: KeyboardEventTargetLike;            // keydown, keyup and blur target
    private readonly _visibilityTarget: KeyboardVisibilityTargetLike;   // visibilitychange target
    private readonly _preventDefault: boolean;                     // Whether handled events suppress browser defaults
    private readonly _passthroughKeys: boolean;                    // Whether operator keys accompany page-map controls
    private readonly _onKeyDown: (event: Event) => void;           // Bound keydown listener
    private readonly _onKeyUp: (event: Event) => void;             // Bound keyup listener
    private readonly _onBlur: (event: Event) => void;              // Bound blur listener
    private readonly _onVisibilityChange: (event: Event) => void;  // Bound visibility listener
    private _attached = false;                                     // Whether listeners are installed
    private _enabled = true;                                       // Gate independent of attachment
    private _destroyed = false;                                    // Whether destroy() completed

    // CONSTRUCTOR :: keyboardSourceConfig -> this
    // Creates a detached source entirely from injected dependencies; call attach() to begin forwarding.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isKeyboardSourceConfig().
    constructor(config: KeyboardSourceConfig) {
        if (!isKeyboardSourceConfig(config)) throw KeyboardSource.invalidConfig("KeyboardSource config is invalid.", config);
        this._channel = config.input.createChannel();
        this._map = config.map;
        this._target = config.target;
        this._visibilityTarget = config.visibilityTarget ?? config.target;
        this._preventDefault = config.preventDefault ?? KeyboardSource.DEFAULT_PREVENT_DEFAULT;
        this._passthroughKeys = config.passthroughKeys ?? true;
        this._onKeyDown = (event) => this.handleKey(event, true);
        this._onKeyUp = (event) => this.handleKey(event, false);
        this._onBlur = () => this.releaseHeld();
        this._onVisibilityChange = () => {
            if (this._visibilityTarget.visibilityState === undefined || this._visibilityTarget.visibilityState === "hidden") this.releaseHeld();
        };
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> BOOLEAN
    // Whether this source's listeners are currently installed.
    get isAttached(): boolean {
        return this._attached;
    }

    // GETTER :: VOID -> BOOLEAN
    // Whether attached key events are forwarded.
    get enabled(): boolean {
        return this._enabled;
    }

    // SETTER :: BOOLEAN -> VOID
    // Opens or closes the event gate; closing releases this source's controls.
    // NOTE: Throws INVALID_CONFIG for a non-boolean and DESTROYED after destroy().
    set enabled(value: boolean) {
        this.assertLive();
        if (typeof value !== "boolean") throw KeyboardSource.invalidConfig("KeyboardSource enabled must be a boolean.", value);
        this._enabled = value;
        if (!value) this._channel.releaseAll();
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> VOID
    // Installs keydown, keyup, blur and visibilitychange listeners; idempotent.
    // NOTE: Throws ArcadeRuntimeError DESTROYED after destroy().
    attach(): void {
        this.assertLive();
        if (this._attached) return;
        this._target.addEventListener("keydown", this._onKeyDown);
        this._target.addEventListener("keyup", this._onKeyUp);
        this._target.addEventListener("blur", this._onBlur);
        this._visibilityTarget.addEventListener("visibilitychange", this._onVisibilityChange);
        this._attached = true;
    }

    // INSTANCE :: VOID -> VOID
    // Removes installed listeners and releases this source's controls; idempotent.
    detach(): void {
        if (!this._attached) return;
        this._target.removeEventListener("keydown", this._onKeyDown);
        this._target.removeEventListener("keyup", this._onKeyUp);
        this._target.removeEventListener("blur", this._onBlur);
        this._visibilityTarget.removeEventListener("visibilitychange", this._onVisibilityChange);
        this._attached = false;
        this._channel.releaseAll();
    }

    // INSTANCE :: VOID -> VOID
    // Detaches, releases and destroys this source's channel; idempotent.
    destroy(): void {
        if (this._destroyed) return;
        this.detach();
        this._channel.destroy();
        this._destroyed = true;
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: event, BOOLEAN -> VOID
    // Forwards mapped and field-level pass-through controls for one non-repeating key event.
    private handleKey(event: Event, pressed: boolean): void {
        if (this._destroyed || !this._enabled) return;
        const keyboard = event as KeyboardEvent;
        if (!isKeyCode(keyboard.code)) return;
        const mapped = Object.prototype.hasOwnProperty.call(this._map, keyboard.code)
            ? this._map[keyboard.code as KeyCode]
            : undefined;
        const key = this._passthroughKeys ? PASSTHROUGH_KEYS[keyboard.code] : undefined;
        if (mapped === undefined && key === undefined) return;
        if (pressed && keyboard.repeat) return;
        const forward = (control: ArcadeControl): void => {
            if (pressed) this._channel.press(control);
            else this._channel.release(control);
        };
        if (mapped !== undefined) forward(mapped);
        if (key !== undefined) forward({ kind: "key", key });
        if (this._preventDefault) event.preventDefault();
    }

    // PRIVATE :: VOID -> VOID
    // Releases this source's channel while live; event callbacks after destruction are ignored.
    private releaseHeld(): void {
        if (this._destroyed) return;
        this._channel.releaseAll();
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after destroy() has completed.
    private assertLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "KeyboardSource has been destroyed.",
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: keyboardSourceInitConfig -> keyboardSource
    // Supplies window and document only when their corresponding targets are omitted.
    static init(config: KeyboardSourceInitConfig): KeyboardSource {
        if (!isKeyboardSourceInitConfig(config)) return new KeyboardSource(config as KeyboardSourceConfig);
        const browserWindow = typeof globalThis.window === "undefined" ? undefined : globalThis.window;
        const target = config.target ?? browserWindow;
        const browserDocument = typeof globalThis.document === "undefined" ? undefined : globalThis.document;
        const visibilityTarget = config.visibilityTarget ?? (config.target === undefined ? browserDocument ?? target : target);
        return new KeyboardSource({ ...config, target, visibilityTarget } as KeyboardSourceConfig);
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected value.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
