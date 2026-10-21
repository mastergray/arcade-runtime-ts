// realizes: docs/arcade-runtime-spec.md > §1.4 Public package surface
//
// Runtime classes are added here as their work packages (§16.3) merge; the
// order below is the implementation order of §1.2.

// Classes:
export { default as ArcadeRuntimeError } from "./ArcadeRuntimeError/ArcadeRuntimeError.js";   // Base typed error and code registry
export { default as MameEmulatorAdapter } from "./MameEmulatorAdapter/MameEmulatorAdapter.js";   // ArcadeAdapter over a direct-MAME family build
export { default as ArcadeDisplay } from "./ArcadeDisplay/ArcadeDisplay.js";                 // Canvas sizing, drawing, placeholder and fullscreen
export { default as ArcadeAudio } from "./ArcadeAudio/ArcadeAudio.js";                       // Stereo Web Audio playback, gesture unlock and bounded latency
export { default as ArcadeInput } from "./ArcadeInput/ArcadeInput.js";                       // Channelled, reference-counted control holds
export { DEFAULT_KEYBOARD_MAP, default as KeyboardSource } from "./KeyboardSource/KeyboardSource.js";   // Physical keyboard to ArcadeInput
export { default as GamepadSource } from "./GamepadSource/GamepadSource.js";                 // Polled Gamepad API to per-player ArcadeInput channels
export { default as ArcadeStorage } from "./ArcadeStorage/ArcadeStorage.js";                 // Browser-local save-overlay persistence
export { default as RomSetAudit } from "./RomSetAudit/RomSetAudit.js";                       // Pre-start audit of user zips against romsets metadata
export { default as ArcadeRomStore } from "./ArcadeRomStore/ArcadeRomStore.js";              // Browser-local user ROM archives

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
export {
    isMameEmulatorAdapterConfig,                                   // Guard for MameEmulatorAdapterConfig
    isMameEmulatorAdapterInitConfig,                               // Guard for MameEmulatorAdapterInitConfig
    type MameClock,                                                // Injected monotonic clock
    type MameEmulatorAdapterConfig,                                // Direct construction config
    type MameEmulatorAdapterInitConfig,                            // init() config with optional browser dependencies
} from "./MameEmulatorAdapter/types.js";
export {
    isArcadeDisplayConfig,                                         // Guard for ArcadeDisplayConfig
    isDisplayDocumentLike,                                         // Guard for DisplayDocumentLike
    isLayoutEvent,                                                 // Guard for LayoutEvent
    isResizeObserverConstructorLike,                               // Guard for ResizeObserverConstructorLike
    type ArcadeDisplayConfig,                                      // Display construction config
    type DisplayDocumentLike,                                      // Injected fullscreen document boundary
    type ExitFullscreen,                                           // Injected fullscreen exit operation
    type LayoutEvent,                                              // Applied rectangle plus scale
    type RequestFullscreen,                                        // Injected fullscreen entry operation
    type ResizeObserverConstructorLike,                            // Injected ResizeObserver constructor
    type ResizeObserverLike,                                       // Observer the display drives
} from "./ArcadeDisplay/types.js";
export {
    isArcadeAudioConfig,                                           // Guard for ArcadeAudioConfig
    isAudioContextLike,                                            // Guard for the injected Web Audio context
    isGestureSourceLike,                                           // Guard for the gesture listener target
    type ArcadeAudioConfig,                                        // ArcadeAudio construction config
    type AudioContextLike,                                         // Injected Web Audio context subset
    type GestureSourceLike,                                        // Gesture listener target subset
} from "./ArcadeAudio/types.js";
export {
    isArcadeInputChannel,                                          // Guard for ArcadeInputChannel
    isArcadeInputConfig,                                           // Guard for ArcadeInputConfig
    type ArcadeInputChannel,                                       // Independently releasable source channel
    type ArcadeInputConfig,                                        // ArcadeInput construction config
} from "./ArcadeInput/types.js";
export {
    isKeyboardEventTargetLike,                                     // Guard for KeyboardEventTargetLike
    isKeyboardMap,                                                 // Guard for KeyboardMap
    isKeyboardSourceConfig,                                        // Guard for KeyboardSourceConfig
    isKeyboardSourceInitConfig,                                    // Guard for KeyboardSourceInitConfig
    isKeyboardVisibilityTargetLike,                                // Guard for KeyboardVisibilityTargetLike
    type KeyboardEventTargetLike,                                  // Injected keyboard event boundary
    type KeyboardMap,                                              // KeyCode to ArcadeControl map
    type KeyboardSourceConfig,                                     // Direct construction config
    type KeyboardSourceInitConfig,                                 // init() config with optional browser targets
    type KeyboardVisibilityTargetLike,                             // Injected visibility boundary
} from "./KeyboardSource/types.js";
export {
    isGamepadLike,                                                 // Guard for GamepadLike
    isGamepadMapping,                                              // Guard for GamepadMapping
    isGamepadProviderLike,                                         // Guard for GamepadProviderLike
    isGamepadSourceConfig,                                         // Guard for GamepadSourceConfig
    isGamepadSourceInitConfig,                                     // Guard for GamepadSourceInitConfig
    type GamepadLike,                                              // Gamepad subset the source reads
    type GamepadMapping,                                           // Button and axis index overrides
    type GamepadProviderLike,                                      // Injected navigator.getGamepads boundary
    type GamepadSourceConfig,                                      // Direct construction config
    type GamepadSourceInitConfig,                                  // init() config with optional browser dependencies
} from "./GamepadSource/types.js";
export {
    isArcadeStorageConfig,                                         // Guard for ArcadeStorageConfig
    isArcadeStorageInitConfig,                                     // Guard for ArcadeStorageInitConfig
    isIDBFactoryLike,                                              // Guard for IDBFactoryLike
    type ArcadeStorageConfig,                                      // Injected storage construction config
    type ArcadeStorageInitConfig,                                  // init() config with optional factory
    type IDBFactoryLike,                                           // Minimal IndexedDB factory
} from "./ArcadeStorage/types.js";
export {
    isArcadeRomStoreConfig,                                        // Guard for ArcadeRomStoreConfig
    isArcadeRomStoreInitConfig,                                    // Guard for ArcadeRomStoreInitConfig
    isRomStoreEntry,                                               // Guard for RomStoreEntry
    isSubtleCryptoLike,                                            // Guard for SubtleCryptoLike
    type ArcadeRomStoreConfig,                                     // Injected ROM store construction config
    type ArcadeRomStoreInitConfig,                                 // init() config with optional dependencies
    type RomStoreEntry,                                            // Byte-free listing entry
    type SubtleCryptoLike,                                         // SHA-256 digest dependency
} from "./ArcadeRomStore/types.js";
export {
    isRomSetMetadata,                                              // Guard for RomSetMetadata
    isRomSetReport,                                                // Guard for RomSetReport
    type RomSetMetadata,                                           // Per-machine romsets/<machine>.json shape
    type RomSetReport,                                             // Byte-free audit result
} from "./RomSetAudit/types.js";
