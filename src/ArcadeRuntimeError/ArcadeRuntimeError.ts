// realizes: docs/arcade-runtime-spec.md > §3 ArcadeRuntimeError

// Type dependencies:
import type { NonEmptyString } from "../shared.types.js";        // Type of a message that says something
import {
    isArcadeRuntimeErrorConfig,                                    // Guards the construction config
    type ArcadeRuntimeErrorConfig,                                 // Construction config shape
} from "./types.js";

/**
 *
 * Class
 *
 */

// Base typed error for the runtime; every error the package raises is one of these
export default class ArcadeRuntimeError extends Error {

    /* Static Fields */
    static readonly CODE = {                                       // Label-to-code registry; call sites use these, never raw values
        INVALID_CODE: -1,
        INVALID_CONFIG: 1,
        INVALID_MESSAGE: 2,
        INTERNAL_ERROR: 3,
        ADAPTER_FAILED: 4,
        ROM_LOAD_FAILED: 5,
        ROM_SET_INVALID: 6,
        MACHINE_NOT_IN_BUILD: 7,
        NOT_STARTED: 8,
        ALREADY_STARTED: 9,
        DESTROYED: 10,
        FULLSCREEN_FAILED: 11,
        AUDIO_FAILED: 12,
        STORAGE_FAILED: 13,
        STATE_FAILED: 14,
        UNSUPPORTED: 15,
        OVERLAY_INCOMPATIBLE: 16,
        MEMORY_EXCEEDED: 17,
    } as const;

    /* Instance Fields */
    readonly code: number;                                         // Stable code drawn from CODE
    readonly data: unknown;                                        // Payload of any kind; null when omitted
    declare readonly message: NonEmptyString;                      // Inherited from Error, narrowed: always says something

    // CONSTRUCTOR :: ArcadeRuntimeErrorConfig -> this
    // Creates an error from a config with a registry code, a non-empty message and optional data
    // NOTE: Throws ArcadeRuntimeError with code -1 (INVALID_CODE) when config is not an object with a numeric code, or the code is not constructible
    // NOTE: Throws ArcadeRuntimeError with code INVALID_MESSAGE when the message is not a non-empty string
    // NOTE: A thrown error is always a plain ArcadeRuntimeError, never an instance of the subclass being constructed
    constructor(config: ArcadeRuntimeErrorConfig) {
        super(isArcadeRuntimeErrorConfig(config) ? config.message : "");
        // The -1 instance cannot come from this constructor, which would reject it again; it is assembled
        // directly on ArcadeRuntimeError.prototype, so it is a plain ArcadeRuntimeError whatever class was being constructed.
        const invalidCode = (data: unknown): ArcadeRuntimeError => Object.assign(Object.create(ArcadeRuntimeError.prototype) as ArcadeRuntimeError, {
            name: "ArcadeRuntimeError",
            message: "Error code is not a constructible registry code.",
            code: ArcadeRuntimeError.CODE.INVALID_CODE,
            data,
        });
        const given = config as unknown;
        const code = typeof given === "object" && given !== null ? (given as { code?: unknown }).code : undefined;
        if (typeof code !== "number") throw invalidCode(null);
        if (!isArcadeRuntimeErrorConfig(config)) {
            const message = (given as { message?: unknown }).message;
            throw new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_MESSAGE, message: "Error message must be a non-empty string.", data: message });
        }
        if (code === ArcadeRuntimeError.CODE.INVALID_CODE || !(Object.values(ArcadeRuntimeError.CODE) as number[]).includes(code)) throw invalidCode(code);
        this.name = "ArcadeRuntimeError";
        this.code = code;
        this.data = config.data ?? null;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    // Readable label for code, derived from CODE
    get label(): string {
        return ArcadeRuntimeError.labelOf(this.code);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: ArcadeRuntimeErrorConfig -> arcadeRuntimeError
    // Mirrors the constructor
    // NOTE: Constructs with the receiving class, so a subclass that inherits init returns its own instances
    static init<T extends ArcadeRuntimeError, C>(this: new (config: C) => T, config: C): T {
        return new this(config);
    }

    // STATIC :: UNKNOWN -> BOOLEAN
    // Narrows an unknown thrown value to ArcadeRuntimeError
    static is(value: unknown): value is ArcadeRuntimeError {
        return value instanceof ArcadeRuntimeError;
    }

    // STATIC :: NUMBER -> STRING
    // Returns the CODE label for a code; "INVALID_CODE" for -1 and for any unregistered number
    static labelOf(code: number): string {
        const entry = Object.entries(ArcadeRuntimeError.CODE).find(([, value]) => value === code);
        return entry === undefined || code === ArcadeRuntimeError.CODE.INVALID_CODE ? "INVALID_CODE" : entry[0];
    }

}
