// realizes: docs/arcade-runtime-spec.md > §10.3 Analogue settings driver (construction)

// Dependencies:
import ArcadeInput from "../ArcadeInput/ArcadeInput.js";          // Hold observation and owned axis channel
import {
    isAnalogSettings,                                             // Guards live analogue settings
    isFrameScheduler,                                             // Guards the per-frame integration clock
    isMachineAnalogKind,                                          // Guards declared port rows
    isPlayerIndex,                                                // Guards declared port players
    type AnalogSettings,                                          // Initial live tuning map
    type FrameScheduler,                                          // Injected animation-frame boundary
    type MachineInputs,                                           // Declared analogue rows
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: declared ports, settings, scheduler and input ownership
// The driver creates one channel from input and observes effective digital holds.
export interface AnalogDriverConfig {
    readonly inputs: MachineInputs["analog"];                    // Machine-declared analogue player/kind rows
    readonly settings?: AnalogSettings;                           // Initial per-port live tuning
    readonly scheduler: FrameScheduler;                           // One integration step per requested frame
    readonly input: ArcadeInput;                                  // Hold source and axis-channel owner
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value supplies valid declared rows, settings and injected runtime dependencies.
export function isAnalogDriverConfig(value: unknown): value is AnalogDriverConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as AnalogDriverConfig;
    return Array.isArray(config.inputs)
        && config.inputs.every((row) => typeof row === "object" && row !== null
            && isPlayerIndex(row.player) && isMachineAnalogKind(row.kind))
        && new Set(config.inputs.map((row) => `p${row.player}:${row.kind}`)).size === config.inputs.length
        && (config.settings === undefined || isAnalogSettings(config.settings))
        && isFrameScheduler(config.scheduler)
        && config.input instanceof ArcadeInput;
}
