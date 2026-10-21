// realizes: docs/arcade-runtime-spec.md > §4.4 Generated controller config

// Type dependencies:
import { isPlayerCount, type PlayerCount } from "../shared.types.js";   // Supported player counts and guard

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {players:playerCount, select:BOOLEAN}
// Choices controlling the complete generated web.cfg document.
export interface ControllerConfig {
    readonly players: PlayerCount;                                // Emit player ports from one through this count
    readonly select: boolean;                                     // Whether each player receives a Pn_SELECT port
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value names a supported player count and a boolean select choice.
export function isControllerConfig(value: unknown): value is ControllerConfig {
    return typeof value === "object" && value !== null
        && isPlayerCount((value as ControllerConfig).players)
        && typeof (value as ControllerConfig).select === "boolean";
}
