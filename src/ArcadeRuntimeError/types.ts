// realizes: docs/arcade-runtime-spec.md > §3 ArcadeRuntimeError

// Type dependencies:
import { isNonEmptyString, type NonEmptyString } from "../shared.types.js";   // Non-empty string type and its guard

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {code:NUMBER, message:nonEmptyString, data:UNKNOWN?}
// Construction config accepted by the constructor and init().
export interface ArcadeRuntimeErrorConfig {
    readonly code: number;                                         // Registry code; validated by the constructor
    readonly message: NonEmptyString;                              // Human-readable message; must say something
    readonly data?: unknown;                                       // Detail of any kind; null when omitted
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an object with a numeric code and a non-empty message; data carries no condition
export function isArcadeRuntimeErrorConfig(value: unknown): value is ArcadeRuntimeErrorConfig {
    return typeof value === "object" && value !== null
        && typeof (value as ArcadeRuntimeErrorConfig).code === "number"
        && isNonEmptyString((value as ArcadeRuntimeErrorConfig).message);
}
