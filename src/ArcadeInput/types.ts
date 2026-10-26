// realizes: docs/arcade-runtime-spec.md > §6 ArcadeInput (configuration and channels)

// Type dependencies:
import {
    isArcadeSession,                                               // Guards the session receiving control changes
    type ArcadeAxis,                                              // Axis accepted by a channel
    type ArcadeControl,                                           // Control accepted by a channel
    type ArcadeSession,                                           // Session receiving control changes
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {session:arcadeSession}
// Construction config: the running session every control change is forwarded to.
export interface ArcadeInputConfig {
    readonly session: ArcadeSession;                              // Running session receiving control changes
}

// INTERFACE :: one independently owned set of held arcade controls
// A source uses its own channel so releasing it cannot cancel another source's hold.
export interface ArcadeInputChannel {
    press(control: ArcadeControl): void;                           // Holds a control idempotently
    release(control: ArcadeControl): void;                         // Releases this channel's hold
    tap(control: ArcadeControl, holdFrames?: number): void;        // Holds through a number of emulated ticks
    setAxis(axis: ArcadeAxis, value: number): void;                // Last-writer-wins absolute value or relative delta
    releaseAll(): void;                                           // Releases this channel's controls
    destroy(): void;                                              // Releases this channel and makes it unusable
}

// TYPE :: (arcadeControl, BOOLEAN) -> BOOLEAN | VOID
// Reports effective first-press and last-release edges. Returning true consumes
// the session's digital edge, which lets AnalogDriver replace it with setAxis.
export type ArcadeInputHoldListener = (control: ArcadeControl, pressed: boolean) => boolean | void;

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an object whose session passes isArcadeSession.
export function isArcadeInputConfig(value: unknown): value is ArcadeInputConfig {
    return typeof value === "object" && value !== null
        && isArcadeSession((value as ArcadeInputConfig).session);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value structurally supplies every ArcadeInputChannel operation.
export function isArcadeInputChannel(value: unknown): value is ArcadeInputChannel {
    if (typeof value !== "object" || value === null) return false;
    const channel = value as ArcadeInputChannel;
    return typeof channel.press === "function"
        && typeof channel.release === "function"
        && typeof channel.tap === "function"
        && typeof channel.setAxis === "function"
        && typeof channel.releaseAll === "function"
        && typeof channel.destroy === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value can observe effective ArcadeInput hold edges.
export function isArcadeInputHoldListener(value: unknown): value is ArcadeInputHoldListener {
    return typeof value === "function";
}
