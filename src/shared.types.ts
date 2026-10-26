// realizes: docs/arcade-runtime-spec.md > §2 Shared Types

/**
 *
 * Type Declarations: primitives
 *
 */

// TYPE :: STRING
// A string containing at least one non-whitespace character; isNonEmptyString is its meaning.
export type NonEmptyString = string;

// TYPE :: NUMBER
// A number that is neither NaN nor infinite; isFiniteNumber is its meaning.
export type FiniteNumber = number;

// TYPE :: STRING
// A DOM KeyboardEvent.code value such as "ArrowUp" or "ControlLeft"; what KeyboardSource maps from.
export type KeyCode = string;

// TYPE :: VOID -> VOID
// Removes a subscription made by an on* method.
export type Unsubscribe = () => void;

// TYPE :: T -> VOID
// A subscriber receiving one event of type T.
export type Listener<T> = (event: T) => void;

// INTERFACE :: {x:finiteNumber, y:finiteNumber}
// A 2-D vector or point.
export interface Vector2 {
    readonly x: FiniteNumber;                                      // Horizontal component
    readonly y: FiniteNumber;                                      // Vertical component
}

// INTERFACE :: {left:finiteNumber, top:finiteNumber, width:finiteNumber, height:finiteNumber}
// A rectangle in CSS pixels, as getBoundingClientRect() reports one.
export interface Rect {
    readonly left: FiniteNumber;                                   // Left edge
    readonly top: FiniteNumber;                                    // Top edge
    readonly width: FiniteNumber;                                  // Width
    readonly height: FiniteNumber;                                 // Height
}

// INTERFACE :: the subset of PointerEvent the primitives read
// What a pointer primitive depends on; a real PointerEvent satisfies it structurally.
export interface PointerEventLike {
    readonly type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "lostpointercapture";   // Event kind
    readonly pointerId: number;                                    // Identifies one finger, mouse or stylus contact
    readonly pointerType: "mouse" | "touch" | "pen";               // Physical source
    readonly clientX: FiniteNumber;                                // Viewport x
    readonly clientY: FiniteNumber;                                // Viewport y
    readonly button: number;                                       // Button that changed, or -1
    readonly buttons: number;                                      // Bitmask of buttons held
    readonly timeStamp: FiniteNumber;                              // Event time in ms
    preventDefault(): void;                                        // Suppresses the browser's default gesture
}

// INTERFACE :: what a primitive attaches pointer listeners to
// A DOM element in production; pointer capture is optional because old browsers lack it.
export interface InputSurface {
    addEventListener(type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void;   // Subscribes
    removeEventListener(type: string, listener: (event: Event) => void, options?: EventListenerOptions): void;   // Unsubscribes
    getBoundingClientRect(): Rect;                                 // Current layout rectangle
    setPointerCapture?(pointerId: number): void;                   // Routes further events of that pointer here
    releasePointerCapture?(pointerId: number): void;               // Undoes setPointerCapture
}

// INTERFACE :: {request:((finiteNumber -> VOID) -> NUMBER), cancel:(NUMBER -> VOID)}
// requestAnimationFrame and cancelAnimationFrame, injectable so a test can drive frames by hand.
export interface FrameScheduler {
    request(callback: (time: FiniteNumber) => void): number;       // Schedules one callback before the next frame
    cancel(handle: number): void;                                  // Cancels a scheduled callback
}

// INTERFACE :: {setTimeout:((VOID -> VOID), finiteNumber -> NUMBER), clearTimeout:(NUMBER -> VOID)}
// setTimeout and clearTimeout, injectable so a test can advance time by hand.
export interface TimerLike {
    setTimeout(callback: () => void, ms: FiniteNumber): number;    // Schedules callback after ms; returns a handle
    clearTimeout(handle: number): void;                            // Cancels a scheduled callback
}

// INTERFACE :: {ok:BOOLEAN, status:NUMBER, arrayBuffer:(VOID -> PROMISE(ArrayBuffer))}
// The subset of a fetch Response the runtime reads.
export interface FetchResponseLike {
    readonly ok: boolean;                                          // 2xx status
    readonly status: number;                                       // HTTP status
    arrayBuffer(): Promise<ArrayBuffer>;                           // Body bytes
}

// TYPE :: STRING -> PROMISE(fetchResponseLike)
// Injectable fetch; init methods default it to the global fetch.
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

// TYPE :: {[STRING]:UNKNOWN} -> PROMISE(OBJECT)
// A modularized Emscripten factory; the module it resolves with is typed privately by each adapter.
export type EmscriptenModuleFactory = (options: Readonly<Record<string, unknown>>) => Promise<object>;

// TYPE :: STRING -> PROMISE(emscriptenModuleFactory)
// Injectable loader of a build's JavaScript; init methods default it to dynamic import.
export type ModuleLoader = (moduleUrl: string) => Promise<EmscriptenModuleFactory>;

// TYPE :: "fit" | "integer" | "fill-height" | "stretch"
// How ArcadeDisplay scales the native frame into its container; stretch fills both axes and ignores the aspect ratio.
export type ScalingMode = "fit" | "integer" | "fill-height" | "stretch";

/**
 *
 * Type Declarations: arcade input vocabulary (§2.1)
 *
 */

// TYPE :: 1 | 2 | 3 | 4
// Which player a control belongs to.
export type PlayerIndex = 1 | 2 | 3 | 4;

// TYPE :: 1 | 2 | 3 | 4
// How many players a machine or page supports.
export type PlayerCount = 1 | 2 | 3 | 4;

// TYPE :: "up" | "down" | "left" | "right"
// Digital stick directions.
export type ArcadeDirection = "up" | "down" | "left" | "right";

// TYPE :: 1 | 2 | 3 | 4 | 5 | 6
// Action button number.
export type ArcadeButtonIndex = 1 | 2 | 3 | 4 | 5 | 6;

// TYPE :: 0 | 1 | 2 | 3 | 4 | 5 | 6
// How many action buttons a machine has; 0 for boards with no action buttons.
export type ArcadeButtonCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// TYPE :: "F1" | "F2" | "F5" | "F6" | "0" ... "9"
// Field-level operator keys exposed without registering a MAME keyboard device.
export type ArcadeKeyName = "F1" | "F2" | "F5" | "F6"
    | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

// TYPE :: tagged union of every digital control the runtime speaks
// The vocabulary everything above the adapter uses; the bridge maps it onto MAME ports.
export type ArcadeControl =
    | { readonly kind: "direction"; readonly player: PlayerIndex; readonly direction: ArcadeDirection }
    | { readonly kind: "button"; readonly player: PlayerIndex; readonly button: ArcadeButtonIndex }
    | { readonly kind: "stick"; readonly player: PlayerIndex; readonly stick: 1 | 2; readonly direction: ArcadeDirection }
    | { readonly kind: "pedal"; readonly player: PlayerIndex; readonly pedal: 1 | 2 | 3 }
    | { readonly kind: "coin"; readonly player: PlayerIndex }
    | { readonly kind: "start"; readonly player: PlayerIndex }
    | { readonly kind: "select"; readonly player: PlayerIndex }
    | { readonly kind: "service" }
    | { readonly kind: "test" }
    | { readonly kind: "tilt" }
    | { readonly kind: "key"; readonly key: ArcadeKeyName }
    | { readonly kind: "volume"; readonly direction: "up" | "down" };

// TYPE :: STRING
// Canonical string form of an ArcadeControl, e.g. "p1:direction:up", "p2:coin", "service"; arcadeControlKey is its meaning.
export type ArcadeControlKey = string;

// TYPE :: "stick-x" | "stick-y" | "stick-z" | "pedal-1" | "pedal-2" | "spin-x" | "spin-y"
// Logical absolute and relative axes accepted by ArcadeInput and ArcadeSession.
export type ArcadeAxisKind = "stick-x" | "stick-y" | "stick-z" | "pedal-1" | "pedal-2" | "spin-x" | "spin-y";

// INTERFACE :: {player:playerIndex, kind:arcadeAxisKind}
// One player axis; absolute values are normalized while spin values are pixel deltas.
export interface ArcadeAxis {
    readonly player: PlayerIndex;                                 // Virtual pad receiving the value
    readonly kind: ArcadeAxisKind;                                // Native bridge axis role
}

// INTERFACE :: optional live tuning for one discovered analogue port
// Speeds are fractions of full travel per frame; travel applies to gamepad values only.
export interface AnalogSetting {
    readonly keySpeed?: number;                                   // Keyboard travel per frame; default 0.02
    readonly centreSpeed?: number;                                // Return travel per frame; defaults by port kind
    readonly travel?: number;                                     // Gamepad travel multiplier in [0.1, 4]
    readonly invert?: boolean;                                    // Negates the value after scaling
}

// TYPE :: partial p<player>:<machineAnalogKind> -> analogSetting map
// Keys address the rows reported by MachineInfo.inputs.analog.
export type AnalogSettings = Readonly<Partial<Record<`p${PlayerIndex}:${MachineAnalogKind}`, AnalogSetting>>>;

/**
 *
 * Type Declarations: machine description (§2.2)
 *
 */

// TYPE :: "horizontal" | "vertical"
// Monitor orientation of the original cabinet.
export type Orientation = "horizontal" | "vertical";

// INTERFACE :: {name:nonEmptyString, description:nonEmptyString, isDefault:BOOLEAN}
// One selectable BIOS of a machine.
export interface BiosOption {
    readonly name: NonEmptyString;                                 // MAME -bios value, e.g. "euro"
    readonly description: NonEmptyString;                          // Human-readable label
    readonly isDefault: boolean;                                   // Selected when ArcadeStartConfig.bios is omitted
}

// TYPE :: every analog port kind reported by the pinned MAME bridge
// Machine discovery vocabulary, including kinds that W26 reports but does not yet bind.
export type MachineAnalogKind =
    | "stick-x" | "stick-y" | "stick-z" | "paddle" | "paddle-v"
    | "pedal-1" | "pedal-2" | "pedal-3" | "dial" | "dial-v"
    | "trackball-x" | "trackball-y" | "lightgun-x" | "lightgun-y"
    | "mouse-x" | "mouse-y" | "positional" | "positional-v";

// INTERFACE :: discovered analog and dual-stick input capabilities
// One analog row is reported per distinct player/kind pair.
export interface MachineInputs {
    readonly analog: ReadonlyArray<{ readonly player: PlayerIndex; readonly kind: MachineAnalogKind }>;   // Declared analog ports
    readonly dualStick: boolean;                                  // Any JOYSTICKLEFT/JOYSTICKRIGHT field exists
    readonly joystick?: boolean;                                  // Any ordinary JOYSTICK_UP/DOWN/LEFT/RIGHT field exists; absent on builds before 2026-10-26
    readonly keys: ReadonlyArray<{ readonly name: string; readonly key: ArcadeKeyName; readonly player: PlayerIndex }>;   // Field-level operator keys in port order
    readonly volume: boolean;                                     // Whether cabinet volume up/down ports exist
}

// INTERFACE :: what the adapter learned about the machine at boot
// Width and height describe upright frames; rotation has already been applied.
export interface MachineInfo {
    readonly name: NonEmptyString;                                 // Short name, e.g. "sf2"
    readonly description: NonEmptyString;                          // Full title
    readonly family: NonEmptyString;                               // Family id of the build, e.g. "cps1"
    readonly width: number;                                        // Upright output width in pixels
    readonly height: number;                                       // Upright output height in pixels
    readonly refreshHz: FiniteNumber;                              // Native screen refresh
    readonly orientation: Orientation;                             // Cabinet monitor orientation
    readonly aspectRatio: FiniteNumber;                            // Display aspect after rotation; not width/height
    readonly players: PlayerCount;                                 // Players the machine supports
    readonly buttons: ArcadeButtonCount;                           // Action buttons per player
    readonly inputs: MachineInputs;                                // Discovered analog and dual-stick ports
    readonly bios: ReadonlyArray<BiosOption>;                      // Selectable BIOS options; empty when none
    readonly hasNvram: boolean;                                    // Whether the board persists anything itself
    readonly supportsSave: boolean;                               // Whether the driver declares GAME_SUPPORTS_SAVE
}

/**
 *
 * Type Declarations: session and adapter (§2.3)
 *
 */

// INTERFACE :: {width:NUMBER, height:NUMBER, rgba:Uint8ClampedArray}
// One upright video frame, ready for putImageData; the buffer is reused, copy if kept.
export interface FrameEvent {
    readonly width: number;                                        // Frame width in pixels
    readonly height: number;                                       // Frame height in pixels
    readonly rgba: Uint8ClampedArray;                              // width × height × 4 bytes, alpha 255
}

// INTERFACE :: {samples:Float32Array, frames:NUMBER}
// One chunk of interleaved stereo samples; the buffer is reused, copy if kept.
export interface SoundEvent {
    readonly samples: Float32Array;                                // Interleaved L/R
    readonly frames: number;                                       // samples.length / 2
}

// TYPE :: "game" | "parent" | "bios" | "samples" | "device"
// What part a ROM archive plays in a machine's set; "device" is a MAME device's own ROM set such as a Namco MCU program.
export type RomRole = "game" | "parent" | "bios" | "samples" | "device";

// TYPE :: STRING
// A unique archive basename such as "sf2.zip"; isRomName is its meaning.
export type RomName = string;

// INTERFACE :: {name:romName, bytes:Uint8Array}
// One ROM archive in memory.
export interface RomFile {
    readonly name: RomName;                                        // Unique basename
    readonly bytes: Uint8Array;                                    // Archive bytes
}

// TYPE :: STRING | romFile | {name:romName, blob:Blob}
// Where a page gets a ROM archive from: a URL, bytes, or a picked File.
export type RomSource = string | RomFile | { readonly name: RomName; readonly blob: Blob };

// INTERFACE :: {players:playerCount, buttons:arcadeButtonCount}
// What the page believes about the machine before it boots.
export interface MachineHints {
    readonly players: PlayerCount;                                 // Players the page lays out for
    readonly buttons: ArcadeButtonCount;                           // Buttons the page lays out for
}

// TYPE :: {[STRING]:STRING | finiteNumber | BOOLEAN}
// Adapter options passed through to the emulator.
export type ArcadeOptions = Readonly<Record<string, string | FiniteNumber | boolean>>;

// INTERFACE :: what a session starts from
// Machine, ROM archives, an optional overlay from a previous persist(), and emulator settings.
export interface ArcadeStartConfig {
    readonly machine: NonEmptyString;                              // MAME short name
    readonly machineHints: MachineHints;                           // Page's expectation, compared with discovery
    readonly roms: ReadonlyArray<RomFile>;                         // Every archive the machine needs
    readonly changes?: Uint8Array;                                 // Overlay from a previous persist()
    readonly bios?: NonEmptyString;                                // MAME -bios value
    readonly dipswitches?: Readonly<Record<string, string>>;       // Port name → setting name
    readonly options?: ArcadeOptions;                              // frameskip, samplerate, …
}

// INTERFACE :: a running machine
// The replacement boundary: everything above talks to this, never to the emulator.
export interface ArcadeSession {
    readonly machine: MachineInfo;                                 // Discovered at boot
    readonly sampleRate: number;                                   // Hz of onSound samples; 48000 unless overridden
    setControl(control: ArcadeControl, pressed: boolean): void;    // Presses or releases a control
    setAxis(axis: ArcadeAxis, value: number): void;                // Writes a normalized absolute axis or relative pixel delta
    pause(): void;                                                 // Stops emulation
    resume(): void;                                                // Continues emulation
    reset(kind: "soft" | "hard"): void;                            // Schedules a reset
    saveState(slot: string): Promise<void>;                        // Writes a named state
    loadState(slot: string): Promise<void>;                        // Restores a named state
    persist(): Promise<Uint8Array | null>;                         // Cumulative overlay, or null when unchanged
    exit(): Promise<void>;                                         // Stops the machine for good
    onTick(listener: Listener<void>): Unsubscribe;                 // Once per emulated frame, even when video is skipped
    onFrame(listener: Listener<FrameEvent>): Unsubscribe;          // Video frames
    onSound(listener: Listener<SoundEvent>): Unsubscribe;          // Stereo samples
    onExit(listener: Listener<void>): Unsubscribe;                 // The machine stopped
}

// INTERFACE :: {type:nonEmptyString, start:(arcadeStartConfig -> PROMISE(arcadeSession))}
// Starts sessions; one implementation per emulator backend.
export interface ArcadeAdapter {
    readonly type: NonEmptyString;                                 // Backend identity, e.g. "mame"
    start(config: ArcadeStartConfig): Promise<ArcadeSession>;      // Boots a session
}

// INTERFACE :: {id:nonEmptyString, notice:nonEmptyString}
// One licence or notice that must accompany a build's artifacts.
export interface BuildLicense {
    readonly id: NonEmptyString;                                   // Licence identifier
    readonly notice: NonEmptyString;                               // Notice text or filename
}

// INTERFACE :: build.json as served beside a family's artifacts
// Validated before any module JavaScript is imported.
export interface BuildInfo {
    readonly formatVersion: 1;                                     // Wire format version
    readonly buildId: NonEmptyString;                              // Deterministic SHA-256 fingerprint, 64 hex chars
    readonly adapter: "mame" | "libretro";                         // Which adapter drives it
    readonly engine: NonEmptyString;                               // Family id
    readonly emulatorVersion: NonEmptyString;                      // Pinned source tag or commit
    readonly emsdkVersion: NonEmptyString;                         // Pinned toolchain
    readonly machines: ReadonlyArray<NonEmptyString>;              // Every machine the build reports
    readonly artifacts: ReadonlyArray<NonEmptyString>;             // Artifact filenames relative to the build URL
    readonly romsetsUrl: NonEmptyString;                           // Directory of romsets/<machine>.json, relative to the build URL
    readonly memoryPages: number;                                  // Fixed Wasm memory in 64 KiB pages
    readonly licenses: ReadonlyArray<BuildLicense>;                // Notices to serve beside the artifacts
    readonly pthreads: boolean;                                    // Whether the build needs shared memory
}

/**
 *
 * Constants
 *
 */

const POINTER_TYPES = ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"] as const;   // PointerEventLike.type set
const POINTER_SOURCES = ["mouse", "touch", "pen"] as const;                                                         // PointerEventLike.pointerType set
const DIRECTIONS = ["up", "down", "left", "right"] as const;                                                         // ArcadeDirection set
const ARCADE_KEY_NAMES = ["F1", "F2", "F5", "F6", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;   // ArcadeKeyName set
const ARCADE_AXIS_KINDS = ["stick-x", "stick-y", "stick-z", "pedal-1", "pedal-2", "spin-x", "spin-y"] as const;   // ArcadeAxisKind set
const MACHINE_ANALOG_KINDS = [                                                                                     // MachineAnalogKind set
    "stick-x", "stick-y", "stick-z", "paddle", "paddle-v", "pedal-1", "pedal-2", "pedal-3",
    "dial", "dial-v", "trackball-x", "trackball-y", "lightgun-x", "lightgun-y", "mouse-x", "mouse-y",
    "positional", "positional-v",
] as const;
const PLAYER_KINDS = ["coin", "start", "select"] as const;                                                           // Control kinds carrying only a player
const GLOBAL_KINDS = ["service", "test", "tilt"] as const;                                                           // Control kinds carrying nothing
const SESSION_METHODS = [                                                                                            // Every ArcadeSession method
    "setControl", "setAxis", "pause", "resume", "reset", "saveState", "loadState", "persist", "exit", "onTick", "onFrame", "onSound", "onExit",
] as const;
const BUILD_ID_PATTERN = /^[0-9a-f]{64}$/;                                                                           // SHA-256 hex
const ROM_NAME_PATTERN = /^[^/\\\0]+$/;                                                                              // No separators or NUL

// Defaults shared by settings UIs and the runtime driver. Hold kinds resolve an
// omitted centreSpeed to zero in AnalogDriver; centring kinds retain 0.02.
export const DEFAULT_ANALOG_SETTING: Required<AnalogSetting> = Object.freeze({
    keySpeed: 0.02,
    centreSpeed: 0.02,
    travel: 1,
    invert: false,
});

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN -> BOOLEAN
// True when value is a non-null object
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// HELPER :: UNKNOWN, (UNKNOWN -> BOOLEAN) -> BOOLEAN
// True when value is an array whose every item passes the predicate
const isArrayOf = (value: unknown, predicate: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(predicate);

// HELPER :: UNKNOWN -> BOOLEAN
// True when value is a positive integer
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

// HELPER :: [STRING] -> BOOLEAN
// True when no two names are equal after case folding
const uniqueCaseFolded = (names: ReadonlyArray<string>): boolean => new Set(names.map((name) => name.toLowerCase())).size === names.length;

// HELPER :: arcadeControl -> arcadeControlKey
// Canonical string for a control, usable as a Map or Set key: "p1:direction:up", "p1:button:3", "p2:coin", "service"
export const arcadeControlKey = (control: ArcadeControl): ArcadeControlKey => {
    switch (control.kind) {
        case "direction": return `p${control.player}:direction:${control.direction}`;
        case "button": return `p${control.player}:button:${control.button}`;
        case "stick": return `p${control.player}:stick:${control.stick}:${control.direction}`;
        case "pedal": return `p${control.player}:pedal:${control.pedal}`;
        case "key": return `key:${control.key}`;
        case "volume": return `volume:${control.direction}`;
        case "coin":
        case "start":
        case "select": return `p${control.player}:${control.kind}`;
        default: return control.kind;
    }
};

// HELPER :: romName -> STRING
// Canonical comparison key for a ROM name: case folded
export const romNameKey = (name: RomName): string => name.toLowerCase();

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a string with at least one non-whitespace character
export function isNonEmptyString(value: unknown): value is NonEmptyString {
    return typeof value === "string" && /\S/.test(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a finite number
export function isFiniteNumber(value: unknown): value is FiniteNumber {
    return typeof value === "number" && Number.isFinite(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a non-empty string of ASCII letters and digits only, the shape of a DOM code
export function isKeyCode(value: unknown): value is KeyCode {
    return typeof value === "string" && /^[A-Za-z0-9]+$/.test(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an object whose x and y are finite numbers
export function isVector2(value: unknown): value is Vector2 {
    return isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an object whose left, top, width and height are finite numbers
export function isRect(value: unknown): value is Rect {
    return isObject(value) && isFiniteNumber(value.left) && isFiniteNumber(value.top) && isFiniteNumber(value.width) && isFiniteNumber(value.height);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value carries the pointer fields the primitives read, with a known type and pointerType
export function isPointerEventLike(value: unknown): value is PointerEventLike {
    if (!isObject(value)) return false;
    return (POINTER_TYPES as readonly unknown[]).includes(value.type)
        && typeof value.pointerId === "number"
        && (POINTER_SOURCES as readonly unknown[]).includes(value.pointerType)
        && isFiniteNumber(value.clientX)
        && isFiniteNumber(value.clientY)
        && typeof value.button === "number"
        && typeof value.buttons === "number"
        && isFiniteNumber(value.timeStamp)
        && typeof value.preventDefault === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has the listener and rect methods of an InputSurface; capture methods are optional
export function isInputSurface(value: unknown): value is InputSurface {
    if (!isObject(value)) return false;
    return typeof value.addEventListener === "function"
        && typeof value.removeEventListener === "function"
        && typeof value.getBoundingClientRect === "function"
        && (value.setPointerCapture === undefined || typeof value.setPointerCapture === "function")
        && (value.releasePointerCapture === undefined || typeof value.releasePointerCapture === "function");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has request and cancel functions
export function isFrameScheduler(value: unknown): value is FrameScheduler {
    return isObject(value) && typeof value.request === "function" && typeof value.cancel === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has setTimeout and clearTimeout functions
export function isTimerLike(value: unknown): value is TimerLike {
    return isObject(value) && typeof value.setTimeout === "function" && typeof value.clearTimeout === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a boolean ok, a numeric status and an arrayBuffer function
export function isFetchResponseLike(value: unknown): value is FetchResponseLike {
    return isObject(value) && typeof value.ok === "boolean" && typeof value.status === "number" && typeof value.arrayBuffer === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the ScalingMode literals
export function isScalingMode(value: unknown): value is ScalingMode {
    return value === "fit" || value === "integer" || value === "fill-height" || value === "stretch";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is 1, 2, 3 or 4
export function isPlayerIndex(value: unknown): value is PlayerIndex {
    return value === 1 || value === 2 || value === 3 || value === 4;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is 1, 2, 3 or 4
export function isPlayerCount(value: unknown): value is PlayerCount {
    return isPlayerIndex(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the ArcadeDirection literals
export function isArcadeDirection(value: unknown): value is ArcadeDirection {
    return (DIRECTIONS as readonly unknown[]).includes(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the logical absolute or relative axis kinds.
export function isArcadeAxisKind(value: unknown): value is ArcadeAxisKind {
    return (ARCADE_AXIS_KINDS as readonly unknown[]).includes(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value names a supported player and logical axis kind, with no extra fields.
export function isArcadeAxis(value: unknown): value is ArcadeAxis {
    return isObject(value)
        && Object.keys(value).sort().join() === "kind,player"
        && isPlayerIndex(value.player)
        && isArcadeAxisKind(value.kind);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an integer from 1 to 6
export function isArcadeButtonIndex(value: unknown): value is ArcadeButtonIndex {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an integer from 0 to 6
export function isArcadeButtonCount(value: unknown): value is ArcadeButtonCount {
    return value === 0 || isArcadeButtonIndex(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the field-level operator keys carried by the virtual pad.
export function isArcadeKeyName(value: unknown): value is ArcadeKeyName {
    return (ARCADE_KEY_NAMES as readonly unknown[]).includes(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one member of the ArcadeControl union with exactly the fields its kind carries
export function isArcadeControl(value: unknown): value is ArcadeControl {
    if (!isObject(value)) return false;
    const keys = Object.keys(value).sort();
    switch (value.kind) {
        case "direction": return keys.join() === "direction,kind,player" && isPlayerIndex(value.player) && isArcadeDirection(value.direction);
        case "button": return keys.join() === "button,kind,player" && isPlayerIndex(value.player) && isArcadeButtonIndex(value.button);
        case "stick": return keys.join() === "direction,kind,player,stick" && isPlayerIndex(value.player)
            && (value.stick === 1 || value.stick === 2) && isArcadeDirection(value.direction);
        case "pedal": return keys.join() === "kind,pedal,player" && isPlayerIndex(value.player)
            && (value.pedal === 1 || value.pedal === 2 || value.pedal === 3);
        case "key": return keys.join() === "key,kind" && isArcadeKeyName(value.key);
        case "volume": return keys.join() === "direction,kind" && (value.direction === "up" || value.direction === "down");
        default:
            if ((PLAYER_KINDS as readonly unknown[]).includes(value.kind)) return keys.join() === "kind,player" && isPlayerIndex(value.player);
            if ((GLOBAL_KINDS as readonly unknown[]).includes(value.kind)) return keys.join() === "kind";
            return false;
    }
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is "horizontal" or "vertical"
export function isOrientation(value: unknown): value is Orientation {
    return value === "horizontal" || value === "vertical";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has non-empty name and description strings and a boolean isDefault
export function isBiosOption(value: unknown): value is BiosOption {
    return isObject(value) && isNonEmptyString(value.name) && isNonEmptyString(value.description) && typeof value.isDefault === "boolean";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the analog kinds emitted by machine discovery.
export function isMachineAnalogKind(value: unknown): value is MachineAnalogKind {
    return (MACHINE_ANALOG_KINDS as readonly unknown[]).includes(value);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every supplied tuning field is within its documented live range.
export function isAnalogSetting(value: unknown): value is AnalogSetting {
    if (!isObject(value) || Array.isArray(value)) return false;
    return (value.keySpeed === undefined || (isFiniteNumber(value.keySpeed) && value.keySpeed >= 0 && value.keySpeed <= 1))
        && (value.centreSpeed === undefined || (isFiniteNumber(value.centreSpeed) && value.centreSpeed >= 0 && value.centreSpeed <= 1))
        && (value.travel === undefined || (isFiniteNumber(value.travel) && value.travel >= 0.1 && value.travel <= 4))
        && (value.invert === undefined || typeof value.invert === "boolean");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when every own key addresses one player/kind pair and every value is an AnalogSetting.
export function isAnalogSettings(value: unknown): value is AnalogSettings {
    if (!isObject(value) || Array.isArray(value)) return false;
    return Object.entries(value).every(([key, setting]) => {
        const match = /^p([1-4]):(.+)$/.exec(key);
        return match !== null && isPlayerIndex(Number(match[1])) && isMachineAnalogKind(match[2]) && isAnalogSetting(setting);
    });
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value carries a deduplicated array of player/kind rows and a dual-stick flag.
export function isMachineInputs(value: unknown): value is MachineInputs {
    if (!isObject(value) || !Array.isArray(value.analog) || typeof value.dualStick !== "boolean"
        || (value.joystick !== undefined && typeof value.joystick !== "boolean")
        || !Array.isArray(value.keys) || typeof value.volume !== "boolean") return false;
    const rows = value.analog as unknown[];
    if (!rows.every((row) => isObject(row)
        && Object.keys(row).sort().join() === "kind,player"
        && isPlayerIndex(row.player)
        && isMachineAnalogKind(row.kind))) return false;
    const keys = rows.map((row) => {
        const input = row as { readonly player: PlayerIndex; readonly kind: MachineAnalogKind };
        return `${input.player}:${input.kind}`;
    });
    if (new Set(keys).size !== keys.length) return false;
    const operatorRows = value.keys as unknown[];
    if (!operatorRows.every((row) => isObject(row)
        && Object.keys(row).sort().join() === "key,name,player"
        && isNonEmptyString(row.name)
        && isArcadeKeyName(row.key)
        && isPlayerIndex(row.player))) return false;
    const operatorKeys = operatorRows.map((row) => {
        const input = row as { readonly name: string; readonly key: ArcadeKeyName };
        return `${input.name}\0${input.key}`;
    });
    return new Set(operatorKeys).size === operatorKeys.length;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value meets every MachineInfo condition: positive integer size, positive finite refresh and aspect, valid counts, at most one default BIOS
export function isMachineInfo(value: unknown): value is MachineInfo {
    if (!isObject(value)) return false;
    return isNonEmptyString(value.name)
        && isNonEmptyString(value.description)
        && isNonEmptyString(value.family)
        && isPositiveInteger(value.width)
        && isPositiveInteger(value.height)
        && isFiniteNumber(value.refreshHz) && value.refreshHz > 0
        && isOrientation(value.orientation)
        && isFiniteNumber(value.aspectRatio) && value.aspectRatio > 0
        && isPlayerCount(value.players)
        && isArcadeButtonCount(value.buttons)
        && isMachineInputs(value.inputs)
        && isArrayOf(value.bios, isBiosOption)
        && (value.bios as BiosOption[]).filter((option) => option.isDefault).length <= 1
        && uniqueCaseFolded((value.bios as BiosOption[]).map((option) => option.name))
        && typeof value.hasNvram === "boolean"
        && typeof value.supportsSave === "boolean";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has positive integer width and height and an rgba buffer of exactly width × height × 4 bytes
export function isFrameEvent(value: unknown): value is FrameEvent {
    return isObject(value)
        && isPositiveInteger(value.width)
        && isPositiveInteger(value.height)
        && value.rgba instanceof Uint8ClampedArray
        && value.rgba.length === value.width * value.height * 4;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a Float32Array of even length and frames equal to half that length
export function isSoundEvent(value: unknown): value is SoundEvent {
    return isObject(value)
        && value.samples instanceof Float32Array
        && value.samples.length % 2 === 0
        && value.frames === value.samples.length / 2;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is one of the RomRole literals
export function isRomRole(value: unknown): value is RomRole {
    return value === "game" || value === "parent" || value === "bios" || value === "samples" || value === "device";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a non-empty basename: no path separators, no NUL, not "." or ".."
export function isRomName(value: unknown): value is RomName {
    return isNonEmptyString(value) && ROM_NAME_PATTERN.test(value) && value !== "." && value !== "..";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a valid ROM name and a Uint8Array of bytes
export function isRomFile(value: unknown): value is RomFile {
    return isObject(value) && isRomName(value.name) && value.bytes instanceof Uint8Array;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a non-empty URL string, a RomFile, or an object with a valid name and a Blob
export function isRomSource(value: unknown): value is RomSource {
    if (isNonEmptyString(value)) return true;
    if (isRomFile(value)) return true;
    return isObject(value) && isRomName(value.name) && typeof Blob !== "undefined" && value.blob instanceof Blob;
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a valid players count and buttons count
export function isMachineHints(value: unknown): value is MachineHints {
    return isObject(value) && isPlayerCount(value.players) && isArcadeButtonCount(value.buttons);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is an object whose every value is a string, finite number or boolean
export function isArcadeOptions(value: unknown): value is ArcadeOptions {
    return isObject(value) && Object.values(value).every((option) => typeof option === "string" || isFiniteNumber(option) || typeof option === "boolean");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value meets every ArcadeStartConfig condition, including unique case-folded ROM names
export function isArcadeStartConfig(value: unknown): value is ArcadeStartConfig {
    if (!isObject(value)) return false;
    return isNonEmptyString(value.machine)
        && isMachineHints(value.machineHints)
        && isArrayOf(value.roms, isRomFile)
        && uniqueCaseFolded((value.roms as RomFile[]).map((rom) => rom.name))
        && (value.changes === undefined || value.changes instanceof Uint8Array)
        && (value.bios === undefined || isNonEmptyString(value.bios))
        && (value.dipswitches === undefined || (isObject(value.dipswitches) && Object.values(value.dipswitches).every((setting) => typeof setting === "string")))
        && (value.options === undefined || isArcadeOptions(value.options));
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a valid machine, a positive sampleRate and every ArcadeSession method as a function
export function isArcadeSession(value: unknown): value is ArcadeSession {
    if (!isObject(value)) return false;
    return isMachineInfo(value.machine)
        && isPositiveInteger(value.sampleRate)
        && SESSION_METHODS.every((method) => typeof value[method] === "function");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a non-empty string type and a start function
export function isArcadeAdapter(value: unknown): value is ArcadeAdapter {
    return isObject(value) && isNonEmptyString(value.type) && typeof value.start === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has non-empty id and notice strings
export function isBuildLicense(value: unknown): value is BuildLicense {
    return isObject(value) && isNonEmptyString(value.id) && isNonEmptyString(value.notice);
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value meets every BuildInfo condition: format 1, 64-hex buildId, known adapter, non-empty unique machines and artifacts, positive memoryPages
export function isBuildInfo(value: unknown): value is BuildInfo {
    if (!isObject(value)) return false;
    return value.formatVersion === 1
        && typeof value.buildId === "string" && BUILD_ID_PATTERN.test(value.buildId)
        && (value.adapter === "mame" || value.adapter === "libretro")
        && isNonEmptyString(value.engine)
        && isNonEmptyString(value.emulatorVersion)
        && isNonEmptyString(value.emsdkVersion)
        && isArrayOf(value.machines, isNonEmptyString) && (value.machines as string[]).length > 0 && new Set(value.machines as string[]).size === (value.machines as string[]).length
        && isArrayOf(value.artifacts, isNonEmptyString) && (value.artifacts as string[]).length > 0
        && isNonEmptyString(value.romsetsUrl)
        && isPositiveInteger(value.memoryPages)
        && isArrayOf(value.licenses, isBuildLicense)
        && typeof value.pthreads === "boolean";
}
