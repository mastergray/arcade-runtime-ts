// realizes: docs/arcade-runtime-spec.md > §5 MameEmulatorAdapter

// Type dependencies:
import {
    isBuildInfo,                                                  // Guards build.json metadata
    isFrameScheduler,                                             // Guards the optional pacing dependency
    isNonEmptyString,                                             // Guards buildUrl
    type BuildInfo,                                               // Validated family-build metadata
    type FetchLike,                                               // Injectable metadata transport
    type FrameScheduler,                                          // Injectable animation-frame boundary
    type ModuleLoader,                                            // Injectable modularized build loader
    type NonEmptyString,                                          // Non-blank build URL
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// TYPE :: VOID -> finiteNumber
// Monotonic millisecond clock used by the session pacing accumulator.
export type MameClock = () => number;

// INTERFACE :: construction dependencies for one MAME family adapter
// scheduler, clock and fetch are injectable test/browser boundaries; init() supplies browser defaults.
export interface MameEmulatorAdapterConfig {
    readonly buildUrl: NonEmptyString;                            // Directory serving build.json and artifacts
    readonly build: BuildInfo;                                    // Already fetched and structurally validated metadata
    readonly loadModule: ModuleLoader;                            // Loads the family's modularized JavaScript
    readonly scheduler?: FrameScheduler;                          // Pacing boundary; required by start outside a browser
    readonly clock?: MameClock;                                   // Monotonic milliseconds; paired with scheduler
    readonly fetch?: FetchLike;                                   // Retained by init() for optional romsets metadata
}

// INTERFACE :: init() input before browser defaults and build.json have been supplied
export interface MameEmulatorAdapterInitConfig {
    readonly buildUrl: NonEmptyString;                            // Directory serving build.json and artifacts
    readonly fetch?: FetchLike;                                   // Defaults to global fetch
    readonly loadModule?: ModuleLoader;                           // Defaults to dynamic import
    readonly scheduler?: FrameScheduler;                          // Defaults to requestAnimationFrame
    readonly clock?: MameClock;                                   // Defaults to performance.now
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value carries validated build metadata, a loader and valid optional injected boundaries.
export function isMameEmulatorAdapterConfig(value: unknown): value is MameEmulatorAdapterConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as MameEmulatorAdapterConfig;
    return isNonEmptyString(config.buildUrl)
        && isBuildInfo(config.build)
        && typeof config.loadModule === "function"
        && (config.scheduler === undefined || isFrameScheduler(config.scheduler))
        && (config.clock === undefined || typeof config.clock === "function")
        && (config.fetch === undefined || typeof config.fetch === "function");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value names a build URL and every optional init dependency has the required shape.
export function isMameEmulatorAdapterInitConfig(value: unknown): value is MameEmulatorAdapterInitConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as MameEmulatorAdapterInitConfig;
    return isNonEmptyString(config.buildUrl)
        && (config.fetch === undefined || typeof config.fetch === "function")
        && (config.loadModule === undefined || typeof config.loadModule === "function")
        && (config.scheduler === undefined || isFrameScheduler(config.scheduler))
        && (config.clock === undefined || typeof config.clock === "function");
}
