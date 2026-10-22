// realizes: docs/arcade-runtime-spec.md > §9 ArcadePlayer (configuration, lifecycle status and events)

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Error-event payload identity
import {
    isArcadeAdapter,                                               // Guards the resolved constructor dependency
    isArcadeOptions,                                               // Guards emulator option values
    isMachineHints,                                                // Guards players/buttons expectations
    isNonEmptyString,                                              // Guards machine, BIOS and build URLs
    isRomSource,                                                   // Guards URL, byte and Blob ROM inputs
    isScalingMode,                                                 // Guards display scaling choices
} from "../shared.types.js";

// Type dependencies:
import type {
    ArcadeAdapter,                                                 // Resolved backend required by construction
    ArcadeOptions,                                                 // Adapter option map
    FetchLike,                                                     // Injected ROM and metadata transport
    MachineHints,                                                  // Expected player/button counts
    NonEmptyString,                                                // Runtime-validated strings
    RomSource,                                                     // URL, bytes or picked Blob
    ScalingMode,                                                   // Display scaling choice
} from "../shared.types.js";
import type { AuditStrictness } from "../RomSetAudit/types.js";     // Pre-start ROM-set policy

/**
 *
 * Type Declarations
 *
 */

// TYPE :: {type:"mame"?, buildUrl:nonEmptyString} | {type:"libretro", core:UNKNOWN, buildUrl:nonEmptyString}
// Programmatic backend choice accepted by init(); libretro remains a validated but unsupported M15 selection.
export type ArcadeAdapterSelection =
    | { readonly type?: "mame"; readonly buildUrl: NonEmptyString }
    | { readonly type: "libretro"; readonly core: unknown; readonly buildUrl: NonEmptyString };

// INTERFACE :: machine, hints, ROM sources, optional overlay/emulator/display choices
// Everything a page knows before an adapter discovers the running MachineInfo.
export interface ArcadeGameConfig {
    readonly machine: NonEmptyString;                              // MAME short name
    readonly machineHints: MachineHints;                           // Page's expected players and buttons
    readonly roms: ReadonlyArray<RomSource>;                       // User-supplied URL, byte or Blob archives
    readonly changes?: Uint8Array;                                 // Overlay restored on the first start
    readonly bios?: NonEmptyString;                                // Optional MAME BIOS value
    readonly dipswitches?: Readonly<Record<string, string>>;       // Port name to setting name
    readonly auditStrictness?: AuditStrictness;                    // Exact pinned set by default; optional PLD tolerance in mame mode
    readonly options?: ArcadeOptions;                              // Adapter-specific supported options
    readonly display?: {
        readonly scaling?: ScalingMode;                            // Fit, integer or vertical fill-height
        readonly imageRendering?: "pixelated" | "smooth";         // Canvas interpolation policy
    };
}

// INTERFACE :: deterministic ArcadePlayer construction dependencies
// The constructor requires a resolved adapter and fetch; init() supplies browser defaults and resolves selections.
export interface ArcadePlayerConfig {
    readonly canvas: HTMLCanvasElement;                            // Canvas owned by the reusable display
    readonly container: HTMLElement;                              // Layout, fullscreen and audio-gesture target
    readonly game: ArcadeGameConfig;                               // Machine and user ROM inputs
    readonly adapter: ArcadeAdapter;                               // Already-resolved backend
    readonly fetch: FetchLike;                                     // ROM and optional metadata transport
}

// TYPE :: "idle" | "starting" | "running" | "paused" | "destroyed"
// Closed player lifecycle state set.
export type ArcadePlayerStatus = "idle" | "starting" | "running" | "paused" | "destroyed";

// INTERFACE :: {status:arcadePlayerStatus, exit:VOID, error:arcadeRuntimeError}
// Event name to payload map consumed by ArcadePlayer.on().
export interface ArcadePlayerEvents {
    readonly status: ArcadePlayerStatus;                           // Every lifecycle transition
    readonly exit: void;                                           // Natural session termination only
    readonly error: ArcadeRuntimeError;                            // Startup, hard-reset or listener failure
}

/**
 *
 * Type Predicates
 *
 */

// HELPER :: UNKNOWN -> BOOLEAN
// True when value has the canvas subset ArcadeDisplay consumes without consulting DOM globals.
const isCanvasLike = (value: unknown): value is HTMLCanvasElement => typeof value === "object" && value !== null
    && typeof (value as HTMLCanvasElement).width === "number"
    && typeof (value as HTMLCanvasElement).height === "number"
    && typeof (value as HTMLCanvasElement).style === "object" && (value as HTMLCanvasElement).style !== null
    && typeof (value as HTMLCanvasElement).getContext === "function";

// HELPER :: UNKNOWN -> BOOLEAN
// True when value can be measured and can host ArcadeAudio gesture listeners.
const isContainerLike = (value: unknown): value is HTMLElement => typeof value === "object" && value !== null
    && typeof (value as HTMLElement).getBoundingClientRect === "function"
    && typeof (value as HTMLElement).addEventListener === "function"
    && typeof (value as HTMLElement).removeEventListener === "function";

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value selects a MAME build or carries the reserved libretro selection shape.
export function isArcadeAdapterSelection(value: unknown): value is ArcadeAdapterSelection {
    if (typeof value !== "object" || value === null) return false;
    const selection = value as Record<string, unknown>;
    if (!isNonEmptyString(selection.buildUrl)) return false;
    if (selection.type === undefined || selection.type === "mame") return true;
    return selection.type === "libretro" && Object.prototype.hasOwnProperty.call(selection, "core");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies every required game field and every optional field meets its declared condition.
export function isArcadeGameConfig(value: unknown): value is ArcadeGameConfig {
    if (typeof value !== "object" || value === null) return false;
    const game = value as ArcadeGameConfig;
    if (!isNonEmptyString(game.machine)
        || !isMachineHints(game.machineHints)
        || !Array.isArray(game.roms) || !game.roms.every(isRomSource)
        || (game.changes !== undefined && !(game.changes instanceof Uint8Array))
        || (game.bios !== undefined && !isNonEmptyString(game.bios))
        || (game.dipswitches !== undefined && (typeof game.dipswitches !== "object" || game.dipswitches === null
            || !Object.values(game.dipswitches).every((setting) => typeof setting === "string")))
        || (game.auditStrictness !== undefined && game.auditStrictness !== "strict" && game.auditStrictness !== "mame")
        || (game.options !== undefined && !isArcadeOptions(game.options))) return false;
    if (game.display === undefined) return true;
    return typeof game.display === "object" && game.display !== null
        && (game.display.scaling === undefined || isScalingMode(game.display.scaling))
        && (game.display.imageRendering === undefined || game.display.imageRendering === "pixelated" || game.display.imageRendering === "smooth");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value carries the deterministic constructor dependencies; no browser globals are read.
export function isArcadePlayerConfig(value: unknown): value is ArcadePlayerConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as ArcadePlayerConfig;
    return isCanvasLike(config.canvas)
        && isContainerLike(config.container)
        && isArcadeGameConfig(config.game)
        && isArcadeAdapter(config.adapter)
        && typeof config.fetch === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the five lifecycle literals.
export function isArcadePlayerStatus(value: unknown): value is ArcadePlayerStatus {
    return value === "idle" || value === "starting" || value === "running" || value === "paused" || value === "destroyed";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a concrete payload map for the three player events.
export function isArcadePlayerEvents(value: unknown): value is ArcadePlayerEvents {
    if (typeof value !== "object" || value === null) return false;
    const events = value as ArcadePlayerEvents;
    return isArcadePlayerStatus(events.status)
        && events.exit === undefined
        && ArcadeRuntimeError.is(events.error);
}
