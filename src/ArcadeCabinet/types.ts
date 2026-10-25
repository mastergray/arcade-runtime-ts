// realizes: docs/arcade-runtime-spec.md > §10.6 ArcadeCabinet (controls, direct construction and init configuration)

// Dependencies:
import ArcadePlayer from "../ArcadePlayer/ArcadePlayer.js";       // Resolved player identity required by direct construction
import ArcadeRomStore from "../ArcadeRomStore/ArcadeRomStore.js";   // Optional local ROM store identity
import ArcadeStorage from "../ArcadeStorage/ArcadeStorage.js";   // Optional overlay storage identity
import {
    isArcadeAdapter,                                               // Guards init's resolved adapter choice
    isArcadeControl,                                               // Guards touch-control declarations reserved for M10
    isFiniteNumber,                                                // Guards dead zones, radii and thresholds
    isFrameScheduler,                                              // Guards the injected gamepad polling clock
    isInputSurface,                                                // Guards reserved touch-control surfaces
    isPlayerIndex,                                                 // Guards touch-control player assignments
} from "../shared.types.js";
import { isArcadeAdapterSelection, isArcadeGameConfig } from "../ArcadePlayer/types.js";   // Guards init's player inputs
import { isGamepadMapping, isGamepadProviderLike } from "../GamepadSource/types.js";   // Guards gamepad mapping and injected API boundary
import {
    isKeyboardEventTargetLike,                                    // Guards keyboard and blur targets
    isKeyboardMap,                                                // Guards physical-key mappings
    isKeyboardVisibilityTargetLike,                               // Guards the shared visibility boundary
} from "../KeyboardSource/types.js";

// Type dependencies:
import type {
    ArcadeAdapter,                                                 // Resolved player backend accepted by init
    ArcadeControl,                                                 // Target of keyboard and reserved touch controls
    FetchLike,                                                     // Player transport injection
    FrameScheduler,                                                // Gamepad polling injection
    InputSurface,                                                  // Reserved M10 touch surface
    PlayerIndex,                                                   // Reserved M10 touch player
} from "../shared.types.js";
import type { ArcadeAdapterSelection, ArcadeGameConfig } from "../ArcadePlayer/types.js";   // Player choices accepted by init
import type { GamepadMapping, GamepadProviderLike } from "../GamepadSource/types.js";   // Gamepad mapping and direct-construction provider
import type {
    KeyboardEventTargetLike,                                      // Direct-construction event boundary
    KeyboardMap,                                                  // Optional keyboard override
    KeyboardVisibilityTargetLike,                                 // Direct-construction visibility boundary
} from "../KeyboardSource/types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: optional keyboard, gamepad and reserved M10 touch control declarations
// Presence of keyboard or gamepads creates that source on every successful start.
export interface ArcadeControlsConfig {
    readonly keyboard?: {
        readonly enabled?: boolean;                                // Initial and restart-persistent source gate; true when omitted
        readonly map?: KeyboardMap;                                // init() supplies DEFAULT_KEYBOARD_MAP when omitted
        readonly preventDefault?: boolean;                         // Handled key default prevention; true when omitted
    };
    readonly gamepads?: {
        readonly enabled?: boolean;                                // Initial and restart-persistent source gate; true when omitted
        readonly deadZone?: number;                                // Axis threshold in [0, 1); source default when omitted
        readonly mapping?: GamepadMapping;                         // Physical layout and optional operator chords
    };
    readonly buttons?: ReadonlyArray<{
        readonly surface: InputSurface;                            // Reserved M10 button surface
        readonly control: ArcadeControl;                           // Control the future primitive will hold
    }>;
    readonly dpads?: ReadonlyArray<{
        readonly surface: InputSurface;                            // Reserved M10 d-pad surface
        readonly player: PlayerIndex;                              // Player driven by the future primitive
        readonly deadZone?: number;                                // Radial dead zone in [0, 1)
        readonly diagonals?: boolean;                              // Whether two directions may be held together
    }>;
    readonly sticks?: ReadonlyArray<{
        readonly surface: InputSurface;                            // Reserved M10 stick surface
        readonly player: PlayerIndex;                              // Player driven by the future primitive
        readonly deadZone?: number;                                // Radial dead zone in [0, 1)
        readonly radius?: number;                                  // Positive CSS-pixel radius
        readonly threshold?: number;                               // Digital direction threshold in (0, 1]
    }>;
}

// INTERFACE :: resolved player plus fully injected optional composition dependencies
// Constructors read no globals; a configured source requires its matching injected boundaries.
export interface ArcadeCabinetConfig {
    readonly player: ArcadePlayer;                                // Already-resolved player owned by this cabinet
    readonly storage?: ArcadeStorage;                              // Overlay persistence, or page-managed when absent
    readonly romStore?: ArcadeRomStore;                            // User-local ROM archive store, or null when absent
    readonly controls?: ArcadeControlsConfig;                     // Sources built after each player start
    readonly keyboardTarget?: KeyboardEventTargetLike;             // Keyboard key/blur target, required with keyboard controls
    readonly eventTarget?: KeyboardEventTargetLike;                // Gamepad blur target, required with gamepad controls
    readonly visibilityTarget?: KeyboardVisibilityTargetLike;      // Shared visibility and autosave target
    readonly gamepadProvider?: GamepadProviderLike;                // Required with gamepad controls
    readonly frameScheduler?: FrameScheduler;                      // Required with gamepad controls
    readonly autosave?: boolean;                                   // Save on hidden visibility while running
}

// INTERFACE :: page-level inputs from which init() resolves a player and browser source dependencies
// Exactly one of adapter and adapterConfig is required.
export interface ArcadeCabinetInitConfig {
    readonly canvas: HTMLCanvasElement;                            // Player display canvas
    readonly container: HTMLElement;                              // Player layout, fullscreen and gesture container
    readonly game: ArcadeGameConfig;                              // Machine and user ROM inputs
    readonly controls?: ArcadeControlsConfig;                     // Sources built after each start
    readonly keyboardTarget?: KeyboardEventTargetLike;             // Defaults to window
    readonly adapter?: ArcadeAdapter;                              // Already-resolved backend
    readonly adapterConfig?: ArcadeAdapterSelection;               // Backend selection resolved by ArcadePlayer.init
    readonly fetch?: FetchLike;                                    // Defaults to global fetch through ArcadePlayer.init
    readonly storage?: ArcadeStorage;                              // Restored only when game.changes is absent
    readonly romStore?: ArcadeRomStore;                            // Resolves bare basenames and receives picked blobs
    readonly autosave?: boolean;                                   // Defaults false
}

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN -> BOOLEAN
// True when value is a non-null object.
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// HELPER :: UNKNOWN, (UNKNOWN -> BOOLEAN) -> BOOLEAN
// True when value is absent or is an array whose every item passes predicate.
const isOptionalArrayOf = (value: unknown, predicate: (item: unknown) => boolean): boolean =>
    value === undefined || (Array.isArray(value) && value.every(predicate));

// HELPER :: UNKNOWN -> BOOLEAN
// True when value is an optional finite number in [0, 1).
const isOptionalDeadZone = (value: unknown): boolean => value === undefined
    || (isFiniteNumber(value) && value >= 0 && value < 1);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a valid optional keyboard source declaration.
const isKeyboardControl = (value: unknown): boolean => isObject(value)
    && (value.enabled === undefined || typeof value.enabled === "boolean")
    && (value.map === undefined || isKeyboardMap(value.map))
    && (value.preventDefault === undefined || typeof value.preventDefault === "boolean");

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a valid optional gamepad source declaration.
const isGamepadControl = (value: unknown): boolean => isObject(value)
    && (value.enabled === undefined || typeof value.enabled === "boolean")
    && isOptionalDeadZone(value.deadZone)
    && (value.mapping === undefined || isGamepadMapping(value.mapping));

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one structurally valid reserved M10 button declaration.
const isButtonControl = (value: unknown): boolean => isObject(value)
    && isInputSurface(value.surface)
    && isArcadeControl(value.control);

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one structurally valid reserved M10 d-pad declaration.
const isDPadControl = (value: unknown): boolean => isObject(value)
    && isInputSurface(value.surface)
    && isPlayerIndex(value.player)
    && isOptionalDeadZone(value.deadZone)
    && (value.diagonals === undefined || typeof value.diagonals === "boolean");

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one structurally valid reserved M10 stick declaration.
const isStickControl = (value: unknown): boolean => isObject(value)
    && isInputSurface(value.surface)
    && isPlayerIndex(value.player)
    && isOptionalDeadZone(value.deadZone)
    && (value.radius === undefined || (isFiniteNumber(value.radius) && value.radius > 0))
    && (value.threshold === undefined || (isFiniteNumber(value.threshold) && value.threshold > 0 && value.threshold <= 1));

// HELPER :: UNKNOWN -> BOOLEAN
// True when value has the canvas subset ArcadePlayer.init consumes.
const isCanvasLike = (value: unknown): value is HTMLCanvasElement => isObject(value)
    && typeof (value as unknown as HTMLCanvasElement).width === "number"
    && typeof (value as unknown as HTMLCanvasElement).height === "number"
    && isObject((value as unknown as HTMLCanvasElement).style)
    && typeof (value as unknown as HTMLCanvasElement).getContext === "function";

// HELPER :: UNKNOWN -> BOOLEAN
// True when value has the container subset ArcadePlayer.init consumes.
const isContainerLike = (value: unknown): value is HTMLElement => isObject(value)
    && typeof (value as unknown as HTMLElement).getBoundingClientRect === "function"
    && typeof (value as unknown as HTMLElement).addEventListener === "function"
    && typeof (value as unknown as HTMLElement).removeEventListener === "function";

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every supplied source and reserved touch declaration is structurally valid.
export function isArcadeControlsConfig(value: unknown): value is ArcadeControlsConfig {
    if (!isObject(value)) return false;
    return (value.keyboard === undefined || isKeyboardControl(value.keyboard))
        && (value.gamepads === undefined || isGamepadControl(value.gamepads))
        && isOptionalArrayOf(value.buttons, isButtonControl)
        && isOptionalArrayOf(value.dpads, isDPadControl)
        && isOptionalArrayOf(value.sticks, isStickControl);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when direct construction has a resolved player, valid options and every dependency needed by configured sources.
export function isArcadeCabinetConfig(value: unknown): value is ArcadeCabinetConfig {
    if (!isObject(value)) return false;
    const config = value as unknown as ArcadeCabinetConfig;
    if (!(config.player instanceof ArcadePlayer)
        || (config.storage !== undefined && !(config.storage instanceof ArcadeStorage))
        || (config.romStore !== undefined && !(config.romStore instanceof ArcadeRomStore))
        || (config.controls !== undefined && !isArcadeControlsConfig(config.controls))
        || (config.keyboardTarget !== undefined && !isKeyboardEventTargetLike(config.keyboardTarget))
        || (config.eventTarget !== undefined && !isKeyboardEventTargetLike(config.eventTarget))
        || (config.visibilityTarget !== undefined && !isKeyboardVisibilityTargetLike(config.visibilityTarget))
        || (config.gamepadProvider !== undefined && !isGamepadProviderLike(config.gamepadProvider))
        || (config.frameScheduler !== undefined && !isFrameScheduler(config.frameScheduler))
        || (config.autosave !== undefined && typeof config.autosave !== "boolean")) return false;
    if (config.controls?.keyboard !== undefined && config.keyboardTarget === undefined) return false;
    if (config.controls?.gamepads !== undefined
        && (config.eventTarget === undefined || config.gamepadProvider === undefined || config.frameScheduler === undefined)) return false;
    return config.autosave !== true || config.visibilityTarget !== undefined;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when init has valid page/player options and exactly one adapter choice, without consulting browser globals.
export function isArcadeCabinetInitConfig(value: unknown): value is ArcadeCabinetInitConfig {
    if (!isObject(value)) return false;
    const config = value as unknown as ArcadeCabinetInitConfig;
    const hasAdapter = config.adapter !== undefined;
    const hasSelection = config.adapterConfig !== undefined;
    return isCanvasLike(config.canvas)
        && isContainerLike(config.container)
        && isArcadeGameConfig(config.game)
        && (config.controls === undefined || isArcadeControlsConfig(config.controls))
        && (config.keyboardTarget === undefined || isKeyboardEventTargetLike(config.keyboardTarget))
        && hasAdapter !== hasSelection
        && (config.adapter === undefined || isArcadeAdapter(config.adapter))
        && (config.adapterConfig === undefined || isArcadeAdapterSelection(config.adapterConfig))
        && (config.fetch === undefined || typeof config.fetch === "function")
        && (config.storage === undefined || config.storage instanceof ArcadeStorage)
        && (config.romStore === undefined || config.romStore instanceof ArcadeRomStore)
        && (config.autosave === undefined || typeof config.autosave === "boolean");
}
