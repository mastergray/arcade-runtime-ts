// realizes: docs/arcade-runtime-spec.md > §10.3 KeyboardSource (mapping and configuration)

// Dependencies:
import ArcadeInput from "../ArcadeInput/ArcadeInput.js";          // Runtime identity required by source configs

// Type dependencies:
import {
    isArcadeControl,                                              // Guards every map value
    isKeyCode,                                                    // Guards every map key
    type ArcadeControl,                                           // Physical-key mapping target
    type KeyCode,                                                 // DOM KeyboardEvent.code vocabulary
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// TYPE :: {keyCode:arcadeControl}
// Page-supplied physical keyboard mapping.
export type KeyboardMap = Readonly<Record<KeyCode, ArcadeControl>>;

// INTERFACE :: the EventTarget operations KeyboardSource uses
// A Window, Document, Element or minimal test double can satisfy this structurally.
export interface KeyboardEventTargetLike {
    addEventListener(type: string, listener: (event: Event) => void): void;      // Installs one source listener
    removeEventListener(type: string, listener: (event: Event) => void): void;   // Removes one source listener
}

// INTERFACE :: keyboardEventTargetLike & {visibilityState:STRING?}
// The visibilitychange target; real Document supplies visibilityState, while a generic injected target may omit it.
export interface KeyboardVisibilityTargetLike extends KeyboardEventTargetLike {
    readonly visibilityState?: string;                            // "hidden" causes held controls to release
}

// INTERFACE :: direct-construction dependencies and source choices
// Constructors read no globals: target is required here and visibilityTarget defaults to that injected target.
export interface KeyboardSourceConfig {
    readonly input: ArcadeInput;                                  // Input whose independently owned channel receives controls
    readonly map: KeyboardMap;                                    // Physical code to arcade control mapping
    readonly target: KeyboardEventTargetLike;                     // keydown, keyup and blur target
    readonly visibilityTarget?: KeyboardVisibilityTargetLike;     // visibilitychange target; defaults to target
    readonly preventDefault?: boolean;                            // Prevent handled events; true when omitted
}

// INTERFACE :: keyboardSourceConfig with optional browser targets
// init() accepts this shape and supplies Window plus Document when targets are omitted.
export interface KeyboardSourceInitConfig {
    readonly input: ArcadeInput;                                  // Input whose independently owned channel receives controls
    readonly map: KeyboardMap;                                    // Physical code to arcade control mapping
    readonly target?: KeyboardEventTargetLike;                    // Defaults to window in init()
    readonly visibilityTarget?: KeyboardVisibilityTargetLike;     // Defaults to document with the default window
    readonly preventDefault?: boolean;                            // Prevent handled events; true when omitted
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every own key is a KeyCode and every value is an ArcadeControl.
export function isKeyboardMap(value: unknown): value is KeyboardMap {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        && Object.entries(value).every(([code, control]) => isKeyCode(code) && isArcadeControl(control));
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value can add and remove event listeners.
export function isKeyboardEventTargetLike(value: unknown): value is KeyboardEventTargetLike {
    return typeof value === "object" && value !== null
        && typeof (value as KeyboardEventTargetLike).addEventListener === "function"
        && typeof (value as KeyboardEventTargetLike).removeEventListener === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an event target with absent or string visibilityState.
export function isKeyboardVisibilityTargetLike(value: unknown): value is KeyboardVisibilityTargetLike {
    return isKeyboardEventTargetLike(value)
        && ((value as KeyboardVisibilityTargetLike).visibilityState === undefined
            || typeof (value as KeyboardVisibilityTargetLike).visibilityState === "string");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when direct construction has an ArcadeInput, valid map and injected target, plus valid optional fields.
export function isKeyboardSourceConfig(value: unknown): value is KeyboardSourceConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as KeyboardSourceConfig;
    return config.input instanceof ArcadeInput
        && isKeyboardMap(config.map)
        && isKeyboardEventTargetLike(config.target)
        && (config.visibilityTarget === undefined || isKeyboardVisibilityTargetLike(config.visibilityTarget))
        && (config.preventDefault === undefined || typeof config.preventDefault === "boolean");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when init construction has valid source fields and optional injected browser targets.
export function isKeyboardSourceInitConfig(value: unknown): value is KeyboardSourceInitConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as KeyboardSourceInitConfig;
    return config.input instanceof ArcadeInput
        && isKeyboardMap(config.map)
        && (config.target === undefined || isKeyboardEventTargetLike(config.target))
        && (config.visibilityTarget === undefined || isKeyboardVisibilityTargetLike(config.visibilityTarget))
        && (config.preventDefault === undefined || typeof config.preventDefault === "boolean");
}
