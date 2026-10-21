// realizes: docs/arcade-runtime-spec.md > §1.4 Public package surface
//
// Runtime classes are added here as their work packages (§16.3) merge; the
// order below is the implementation order of §1.2.

// Classes:
export { default as ArcadeRuntimeError } from "./ArcadeRuntimeError/ArcadeRuntimeError.js";   // Base typed error and code registry

// Shared helpers:
export {
    arcadeControlKey,                                              // Canonical string key for an ArcadeControl
    romNameKey,                                                    // Case-folded comparison key for a ROM name
} from "./shared.types.js";

// Shared predicates:
export {
    isNonEmptyString,                                              // Guard for NonEmptyString
    isFiniteNumber,                                                // Guard for FiniteNumber
    isKeyCode,                                                     // Guard for KeyCode
    isVector2,                                                     // Guard for Vector2
    isRect,                                                        // Guard for Rect
    isPointerEventLike,                                            // Guard for PointerEventLike
    isInputSurface,                                                // Guard for InputSurface
    isFrameScheduler,                                              // Guard for FrameScheduler
    isTimerLike,                                                   // Guard for TimerLike
    isFetchResponseLike,                                           // Guard for FetchResponseLike
    isScalingMode,                                                 // Guard for ScalingMode
    isPlayerIndex,                                                 // Guard for PlayerIndex
    isPlayerCount,                                                 // Guard for PlayerCount
    isArcadeDirection,                                             // Guard for ArcadeDirection
    isArcadeButtonIndex,                                           // Guard for ArcadeButtonIndex
    isArcadeButtonCount,                                           // Guard for ArcadeButtonCount
    isArcadeControl,                                               // Guard for ArcadeControl
    isOrientation,                                                 // Guard for Orientation
    isBiosOption,                                                  // Guard for BiosOption
    isMachineInfo,                                                 // Guard for MachineInfo
    isFrameEvent,                                                  // Guard for FrameEvent
    isSoundEvent,                                                  // Guard for SoundEvent
    isRomRole,                                                     // Guard for RomRole
    isRomName,                                                     // Guard for RomName
    isRomFile,                                                     // Guard for RomFile
    isRomSource,                                                   // Guard for RomSource
    isMachineHints,                                                // Guard for MachineHints
    isArcadeOptions,                                               // Guard for ArcadeOptions
    isArcadeStartConfig,                                           // Guard for ArcadeStartConfig
    isArcadeSession,                                               // Guard for ArcadeSession
    isArcadeAdapter,                                               // Guard for ArcadeAdapter
    isBuildLicense,                                                // Guard for BuildLicense
    isBuildInfo,                                                   // Guard for BuildInfo
} from "./shared.types.js";

// Shared types:
export type {
    NonEmptyString,                                                // String with non-whitespace content
    FiniteNumber,                                                  // Finite number
    KeyCode,                                                       // DOM KeyboardEvent.code value
    Unsubscribe,                                                   // Subscription remover
    Listener,                                                      // Event subscriber
    Vector2,                                                       // 2-D vector
    Rect,                                                          // CSS-pixel rectangle
    PointerEventLike,                                              // Pointer event subset
    InputSurface,                                                  // Element a primitive attaches to
    FrameScheduler,                                                // requestAnimationFrame pair
    TimerLike,                                                     // setTimeout pair
    FetchResponseLike,                                             // Fetch response subset
    FetchLike,                                                     // Injectable fetch
    EmscriptenModuleFactory,                                       // Modularized Emscripten factory
    ModuleLoader,                                                  // Injectable build-script loader
    ScalingMode,                                                   // Display scaling literal
    PlayerIndex,                                                   // Player a control belongs to
    PlayerCount,                                                   // Number of players
    ArcadeDirection,                                               // Stick direction literal
    ArcadeButtonIndex,                                             // Action button number
    ArcadeButtonCount,                                             // Number of action buttons
    ArcadeControl,                                                 // Digital control union
    ArcadeControlKey,                                              // Canonical control string
    Orientation,                                                   // Cabinet monitor orientation
    BiosOption,                                                    // Selectable BIOS
    MachineInfo,                                                   // Discovered machine description
    FrameEvent,                                                    // Video frame
    SoundEvent,                                                    // Stereo sample chunk
    RomRole,                                                       // Archive role in a set
    RomName,                                                       // Archive basename
    RomFile,                                                       // Archive bytes
    RomSource,                                                     // URL, bytes or picked file
    MachineHints,                                                  // Page's expectation of players and buttons
    ArcadeOptions,                                                 // Emulator option map
    ArcadeStartConfig,                                             // What a session starts from
    ArcadeSession,                                                 // Running machine contract
    ArcadeAdapter,                                                 // Session starter contract
    BuildLicense,                                                  // Notice entry in build.json
    BuildInfo,                                                     // build.json shape
} from "./shared.types.js";

// Class-owned types and predicates:
export { isArcadeRuntimeErrorConfig, type ArcadeRuntimeErrorConfig } from "./ArcadeRuntimeError/types.js";   // Error construction config
