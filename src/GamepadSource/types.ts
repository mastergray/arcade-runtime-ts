// realizes: docs/arcade-runtime-spec.md > §10.4 GamepadSource (provider, mapping and configuration)

// Dependencies:
import ArcadeInput from "../ArcadeInput/ArcadeInput.js";          // Runtime identity required by source configs

// Type dependencies:
import {
    isArcadeControl,                                              // Guards every helper result during development and tests
    isArcadeKeyName,                                              // Validates field-level operator-key chord controls
    isFiniteNumber,                                               // Guards button, axis and dead-zone numbers
    isFrameScheduler,                                             // Guards the injected polling clock
    type ArcadeButtonIndex,                                       // Logical action-button number
    type ArcadeAxis,                                              // Logical axis passed through live settings
    type ArcadeControl,                                           // Active controls returned by controlsFor
    type ArcadeDirection,                                         // Active directions returned by directionsFor
    type FrameScheduler,                                          // Injectable requestAnimationFrame boundary
    type PlayerIndex,                                             // Slot assigned to a connected pad
} from "../shared.types.js";
import {
    isKeyboardEventTargetLike,                                    // Reuses the sibling source's injected event boundary
    isKeyboardVisibilityTargetLike,                               // Reuses its visibility boundary
    type KeyboardEventTargetLike,                                 // blur listener target
    type KeyboardVisibilityTargetLike,                            // visibilitychange listener target
} from "../KeyboardSource/types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: the subset of Gamepad read by GamepadSource
// Native Gamepad objects and small test fixtures satisfy this structurally.
export interface GamepadLike {
    readonly id: string;                                          // Browser-reported device identity
    readonly index: number;                                       // Stable connection slot while this pad is present
    readonly connected: boolean;                                  // False makes an assigned pad disconnect immediately
    readonly mapping: string;                                     // "standard" receives the default layout
    readonly buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number }>;   // Digital and analog button state
    readonly axes: ReadonlyArray<number>;                         // Normalized stick axes
}

// INTERFACE :: navigator.getGamepads subset
// The method is bound or wrapped by init() so providers never depend on a call-site receiver.
export interface GamepadProviderLike {
    getGamepads(): ReadonlyArray<GamepadLike | null>;              // Current sparse pad list
}

// INTERFACE :: one connected physical device reported by the provider
// player is null when the device is visible but not assigned to a runtime seat.
export interface GamepadDevice {
    readonly index: number;
    readonly id: string;
    readonly standard: boolean;
    readonly player: PlayerIndex | null;
}

// INTERFACE :: one physical button and the operator control it holds while the chord modifier is down
export interface GamepadChord {
    readonly button: number;                                      // Physical button index pressed with the modifier
    readonly control: ArcadeControl;                              // Operator key, volume or cabinet switch control
}

// INTERFACE :: optional modifier and replacement bindings for the gamepad operator layer
export interface GamepadChords {
    readonly modifier?: number;                                   // Defaults to the mapping's coin button
    readonly bindings?: ReadonlyArray<GamepadChord>;              // Replaces the standard operator bindings when supplied
}

// INTERFACE :: optional physical-index overrides, optionally scoped to one browser-reported id
// Omitting a field retains the standard index; id is required to opt a non-standard pad into polling.
export interface GamepadMapping {
    readonly id?: string;                                         // Exact pad id this mapping names; absent means all standard pads
    readonly dpad?: Readonly<{                                    // Physical d-pad button indices
        readonly up: number;
        readonly down: number;
        readonly left: number;
        readonly right: number;
    }>;
    readonly axes?: readonly [number, number];                     // Left-stick [horizontal, vertical] axis indices
    readonly rightAxes?: readonly [number, number];                // Right-stick [horizontal, vertical] axis indices
    readonly pedals?: readonly [number, number];                   // Analog button indices for pedals 1 and 2
    readonly buttons?: readonly [number, number, number, number, number, number];   // Physical indices for logical buttons 1–6
    readonly coin?: number;                                       // Physical coin/select button index
    readonly start?: number;                                      // Physical start button index
    readonly chords?: GamepadChords | false;                      // false restores the original digital layer and coin timing
}

// INTERFACE :: direct-construction dependencies and source choices
// Constructors read no globals: provider, scheduler and target are required here.
export interface GamepadSourceConfig {
    readonly input: ArcadeInput;                                  // Input creating one independent channel per assigned pad
    readonly provider: GamepadProviderLike;                       // Current Gamepad API snapshot supplier
    readonly scheduler: FrameScheduler;                           // Polling clock
    readonly target: KeyboardEventTargetLike;                     // blur target
    readonly visibilityTarget?: KeyboardVisibilityTargetLike;     // visibilitychange target; defaults to target
    readonly deadZone?: number;                                   // Axis threshold in [0, 1); defaults to 0.25
    readonly mapping?: GamepadMapping;                            // Standard-layout overrides and non-standard opt-in
    readonly axisFilter?: (axis: ArcadeAxis, value: number) => number;   // Live scaling/inversion supplied by AnalogDriver
}

// INTERFACE :: gamepadSourceConfig with optional browser dependencies
// init() supplies navigator, requestAnimationFrame, Window and Document when their fields are omitted.
export interface GamepadSourceInitConfig {
    readonly input: ArcadeInput;                                  // Input creating one independent channel per assigned pad
    readonly provider?: GamepadProviderLike;                      // Defaults to navigator.getGamepads in init()
    readonly scheduler?: FrameScheduler;                          // Defaults to requestAnimationFrame in init()
    readonly target?: KeyboardEventTargetLike;                    // Defaults to window in init()
    readonly visibilityTarget?: KeyboardVisibilityTargetLike;     // Defaults to document with the default window
    readonly deadZone?: number;                                   // Axis threshold in [0, 1); defaults to 0.25
    readonly mapping?: GamepadMapping;                            // Standard-layout overrides and non-standard opt-in
    readonly axisFilter?: (axis: ArcadeAxis, value: number) => number;   // Live scaling/inversion supplied by AnalogDriver
}

/**
 *
 * Constants
 *
 */

const DEFAULT_DPAD = Object.freeze({ up: 12, down: 13, left: 14, right: 15 });   // W3C standard d-pad indices
const DEFAULT_AXES = Object.freeze([0, 1] as const);               // W3C standard left-stick axes
const DEFAULT_BUTTONS = Object.freeze([0, 1, 2, 3, 4, 5] as const);   // A, B, X, Y, LB and RB
const DEFAULT_COIN = 8;                                           // Select/Back
const DEFAULT_START = 9;                                          // Start
const DIRECTIONS = ["up", "down", "left", "right"] as const;  // Stable helper and transition order

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a non-negative integer usable as a button or axis index.
const isPhysicalIndex = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0;

// PREDICATE :: UNKNOWN -> BOOLEAN
// True only for controls the operator chord layer is allowed to emit.
const isChordControl = (value: unknown): value is ArcadeControl => {
    if (!isArcadeControl(value)) return false;
    switch (value.kind) {
        case "key": return isArcadeKeyName(value.key);
        case "volume":
        case "test":
        case "service":
        case "tilt": return true;
        default: return false;
    }
};

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when one chord binding has a physical index and an allowed operator control.
const isGamepadChord = (value: unknown): value is GamepadChord => typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && isPhysicalIndex((value as GamepadChord).button)
    && isChordControl((value as GamepadChord).control);

// HELPER :: gamepadMapping -> [NUMBER]
// Resolves the physical indices used by the standard chord set through ordinary mapping overrides.
const defaultChordButtons = (mapping: GamepadMapping): ReadonlyArray<number> => {
    const dpad = mapping.dpad ?? DEFAULT_DPAD;
    const buttons = mapping.buttons ?? DEFAULT_BUTTONS;
    return [
        mapping.start ?? DEFAULT_START,
        dpad.up, dpad.down, dpad.left, dpad.right,
        buttons[0], buttons[1], buttons[2], buttons[4], buttons[5],
    ];
};

// PREDICATE :: gamepadMapping -> BOOLEAN
// Validates the enabled chord layer after resolving its modifier and optional default bindings.
const hasValidChords = (mapping: GamepadMapping): boolean => {
    if (mapping.chords === false) return true;
    const chords = mapping.chords;
    if (chords !== undefined && (typeof chords !== "object" || chords === null || Array.isArray(chords))) return false;
    const modifier = chords?.modifier ?? mapping.coin ?? DEFAULT_COIN;
    if (!isPhysicalIndex(modifier)) return false;
    const bindings = chords?.bindings;
    if (bindings !== undefined && (!Array.isArray(bindings) || !bindings.every(isGamepadChord))) return false;
    const buttons = bindings?.map(({ button }) => button) ?? defaultChordButtons(mapping);
    return !buttons.includes(modifier) && new Set(buttons).size === buttons.length;
};

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has the pressed and normalized value fields GamepadSource reads.
const isGamepadButtonLike = (value: unknown): value is { readonly pressed: boolean; readonly value: number } =>
    typeof value === "object" && value !== null
    && typeof (value as { readonly pressed?: unknown }).pressed === "boolean"
    && isFiniteNumber((value as { readonly value?: unknown }).value)
    && (value as { readonly value: number }).value >= 0
    && (value as { readonly value: number }).value <= 1;

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies the complete, normalized Gamepad subset read by the source.
export function isGamepadLike(value: unknown): value is GamepadLike {
    if (typeof value !== "object" || value === null) return false;
    const pad = value as GamepadLike;
    return typeof pad.id === "string"
        && Number.isInteger(pad.index) && pad.index >= 0
        && typeof pad.connected === "boolean"
        && typeof pad.mapping === "string"
        && Array.isArray(pad.buttons) && pad.buttons.every(isGamepadButtonLike)
        && Array.isArray(pad.axes) && pad.axes.every((axis) => isFiniteNumber(axis) && axis >= -1 && axis <= 1);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies a callable getGamepads operation.
export function isGamepadProviderLike(value: unknown): value is GamepadProviderLike {
    return typeof value === "object" && value !== null
        && typeof (value as GamepadProviderLike).getGamepads === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a public connected-device snapshot.
export function isGamepadDevice(value: unknown): value is GamepadDevice {
    if (typeof value !== "object" || value === null) return false;
    const device = value as GamepadDevice;
    return Number.isInteger(device.index) && device.index >= 0
        && typeof device.id === "string"
        && typeof device.standard === "boolean"
        && (device.player === null || (Number.isInteger(device.player) && device.player >= 1 && device.player <= 4));
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every supplied mapping override is a usable physical index with the required arity.
export function isGamepadMapping(value: unknown): value is GamepadMapping {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const mapping = value as GamepadMapping;
    const dpad = mapping.dpad;
    const valid = (mapping.id === undefined || (typeof mapping.id === "string" && mapping.id.length > 0))
        && (dpad === undefined || (typeof dpad === "object" && dpad !== null
            && isPhysicalIndex(dpad.up) && isPhysicalIndex(dpad.down)
            && isPhysicalIndex(dpad.left) && isPhysicalIndex(dpad.right)))
        && (mapping.axes === undefined || (Array.isArray(mapping.axes) && mapping.axes.length === 2 && mapping.axes.every(isPhysicalIndex)))
        && (mapping.rightAxes === undefined || (Array.isArray(mapping.rightAxes) && mapping.rightAxes.length === 2 && mapping.rightAxes.every(isPhysicalIndex)))
        && (mapping.pedals === undefined || (Array.isArray(mapping.pedals) && mapping.pedals.length === 2 && mapping.pedals.every(isPhysicalIndex)))
        && (mapping.buttons === undefined || (Array.isArray(mapping.buttons) && mapping.buttons.length === 6 && mapping.buttons.every(isPhysicalIndex)))
        && (mapping.coin === undefined || isPhysicalIndex(mapping.coin))
        && (mapping.start === undefined || isPhysicalIndex(mapping.start));
    return valid && hasValidChords(mapping);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when direct construction has every injected dependency and valid optional choice.
export function isGamepadSourceConfig(value: unknown): value is GamepadSourceConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as GamepadSourceConfig;
    return config.input instanceof ArcadeInput
        && isGamepadProviderLike(config.provider)
        && isFrameScheduler(config.scheduler)
        && isKeyboardEventTargetLike(config.target)
        && (config.visibilityTarget === undefined || isKeyboardVisibilityTargetLike(config.visibilityTarget))
        && (config.deadZone === undefined || (isFiniteNumber(config.deadZone) && config.deadZone >= 0 && config.deadZone < 1))
        && (config.mapping === undefined || isGamepadMapping(config.mapping))
        && (config.axisFilter === undefined || typeof config.axisFilter === "function");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when init construction has valid source fields and optional injected browser dependencies.
export function isGamepadSourceInitConfig(value: unknown): value is GamepadSourceInitConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as GamepadSourceInitConfig;
    return config.input instanceof ArcadeInput
        && (config.provider === undefined || isGamepadProviderLike(config.provider))
        && (config.scheduler === undefined || isFrameScheduler(config.scheduler))
        && (config.target === undefined || isKeyboardEventTargetLike(config.target))
        && (config.visibilityTarget === undefined || isKeyboardVisibilityTargetLike(config.visibilityTarget))
        && (config.deadZone === undefined || (isFiniteNumber(config.deadZone) && config.deadZone >= 0 && config.deadZone < 1))
        && (config.mapping === undefined || isGamepadMapping(config.mapping))
        && (config.axisFilter === undefined || typeof config.axisFilter === "function");
}

/**
 *
 * Pure Mapping Functions
 *
 */

// HELPER :: gamepadLike, NUMBER -> BOOLEAN
// A button is active when its digital flag is set or its analog value reaches the conventional halfway threshold.
const buttonPressed = (pad: GamepadLike, index: number): boolean => {
    const button = pad.buttons[index];
    return button !== undefined && (button.pressed || button.value >= 0.5);
};

// FUNCTION :: gamepadLike, NUMBER, gamepadMapping -> Set<arcadeDirection>
// Returns d-pad directions when any are down; otherwise applies the same dead-zone threshold independently to both left-stick axes.
export function directionsFor(pad: GamepadLike, deadZone: number, mapping: GamepadMapping = {}): Set<ArcadeDirection> {
    const dpad = mapping.dpad ?? DEFAULT_DPAD;
    const digital = new Set<ArcadeDirection>();
    for (const direction of DIRECTIONS) if (buttonPressed(pad, dpad[direction])) digital.add(direction);
    if (digital.size > 0) return digital;

    const axes = mapping.axes ?? DEFAULT_AXES;
    const horizontal = pad.axes[axes[0]] ?? 0;
    const vertical = pad.axes[axes[1]] ?? 0;
    const directions = new Set<ArcadeDirection>();
    if (vertical < 0 && Math.abs(vertical) >= deadZone) directions.add("up");
    if (vertical > 0 && Math.abs(vertical) >= deadZone) directions.add("down");
    if (horizontal < 0 && Math.abs(horizontal) >= deadZone) directions.add("left");
    if (horizontal > 0 && Math.abs(horizontal) >= deadZone) directions.add("right");
    return directions;
}

// FUNCTION :: gamepadLike, playerIndex, NUMBER, gamepadMapping -> [arcadeControl]
// Converts one snapshot to directions, six action buttons, coin and start in stable logical order.
export function controlsFor(pad: GamepadLike, player: PlayerIndex, deadZone: number, mapping: GamepadMapping = {}): ReadonlyArray<ArcadeControl> {
    const controls: ArcadeControl[] = [];
    const directions = directionsFor(pad, deadZone, mapping);
    for (const direction of DIRECTIONS) if (directions.has(direction)) controls.push({ kind: "direction", player, direction });

    const buttons = mapping.buttons ?? DEFAULT_BUTTONS;
    for (let offset = 0; offset < buttons.length; offset++) {
        const physical = buttons[offset];
        if (physical === undefined || !buttonPressed(pad, physical)) continue;
        const button = (offset + 1) as ArcadeButtonIndex;
        controls.push({ kind: "button", player, button });
    }
    if (buttonPressed(pad, mapping.coin ?? DEFAULT_COIN)) controls.push({ kind: "coin", player });
    if (buttonPressed(pad, mapping.start ?? DEFAULT_START)) controls.push({ kind: "start", player });
    return controls.filter(isArcadeControl);
}
