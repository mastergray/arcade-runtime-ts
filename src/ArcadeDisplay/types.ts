// realizes: docs/arcade-runtime-spec.md > §7 ArcadeDisplay (configuration and layout event)

// Type dependencies:
import {
    isFiniteNumber,                                                // Guards aspect ratios and layout coordinates
    isRect,                                                        // Guards the Rect part of LayoutEvent
    isScalingMode,                                                 // Guards the shared scaling literal
    type FiniteNumber,                                             // Numeric fields that must not be NaN or infinite
    type Rect,                                                     // Centered canvas rectangle in viewport coordinates
    type ScalingMode,                                              // fit, integer or fill-height
} from "../shared.types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {observe:(Element -> VOID), disconnect:(VOID -> VOID)}
// The subset of ResizeObserver an ArcadeDisplay drives.
export interface ResizeObserverLike {
    observe(target: Element): void;                                // Starts observing the container
    disconnect(): void;                                            // Stops every observation
}

// INTERFACE :: CONSTRUCTOR((resizeObserverEntry[] -> VOID) -> resizeObserverLike)
// Injectable ResizeObserver constructor; init() supplies the browser implementation when available.
export interface ResizeObserverConstructorLike {
    new (callback: (entries: ReadonlyArray<ResizeObserverEntry>) => void): ResizeObserverLike;
}

// INTERFACE :: document fields ArcadeDisplay reads
// Injectable document boundary used for fullscreen state and fullscreenchange observation.
export interface DisplayDocumentLike {
    readonly fullscreenElement?: Element | null;                   // Current fullscreen element, when supported
    addEventListener(type: string, listener: () => void): void;    // Subscribes to fullscreenchange
    removeEventListener(type: string, listener: () => void): void; // Removes that subscription
}

// TYPE :: Element -> PROMISE(VOID)
// Injectable requestFullscreen operation.
export type RequestFullscreen = (target: Element) => Promise<void>;

// TYPE :: displayDocumentLike -> PROMISE(VOID)
// Injectable exitFullscreen operation.
export type ExitFullscreen = (document: DisplayDocumentLike) => Promise<void>;

// INTERFACE :: ArcadeDisplay construction dependencies and page choices
// Direct construction reads no browser globals; init() fills the optional environment fields.
export interface ArcadeDisplayConfig {
    readonly canvas: HTMLCanvasElement;                            // Canvas receiving native RGBA frames
    readonly container: HTMLElement;                              // Element whose content rectangle the canvas fits
    readonly aspectRatio?: FiniteNumber;                           // Page override; otherwise taken from the attached machine
    readonly scaling?: ScalingMode;                                // Page override; otherwise selected from machine orientation and container shape
    readonly imageRendering?: "pixelated" | "smooth";             // Pixel policy; smooth maps to the interoperable CSS value auto
    readonly resizeObserver?: ResizeObserverConstructorLike;       // Observer constructor supplied by init() in a browser
    readonly fullscreenTarget?: Element;                           // Element passed to requestFullscreen; defaults to container
    readonly document?: DisplayDocumentLike;                       // Fullscreen document supplied by init() in a browser
    readonly requestFullscreen?: RequestFullscreen;                // Fullscreen entry operation supplied by init() when supported
    readonly exitFullscreen?: ExitFullscreen;                      // Fullscreen exit operation supplied by init() when supported
}

// INTERFACE :: rect & {scale:finiteNumber}
// A newly applied canvas rectangle and its horizontal CSS-pixels-per-native-pixel scale.
export interface LayoutEvent extends Rect {
    readonly scale: FiniteNumber;                                  // CSS width / native frame width
}

/**
 *
 * Type Predicates
 *
 */

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value structurally supplies the canvas fields ArcadeDisplay uses.
const isCanvasLike = (value: unknown): value is HTMLCanvasElement => typeof value === "object" && value !== null
    && typeof (value as HTMLCanvasElement).width === "number"
    && typeof (value as HTMLCanvasElement).height === "number"
    && typeof (value as HTMLCanvasElement).style === "object" && (value as HTMLCanvasElement).style !== null
    && typeof (value as HTMLCanvasElement).getContext === "function";

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value structurally supplies the container fields ArcadeDisplay uses.
const isContainerLike = (value: unknown): value is HTMLElement => typeof value === "object" && value !== null
    && typeof (value as HTMLElement).getBoundingClientRect === "function";

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a structurally usable ResizeObserver constructor.
export function isResizeObserverConstructorLike(value: unknown): value is ResizeObserverConstructorLike {
    return typeof value === "function";
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value can report fullscreen state and add and remove the fullscreenchange listener.
export function isDisplayDocumentLike(value: unknown): value is DisplayDocumentLike {
    return typeof value === "object" && value !== null
        && typeof (value as DisplayDocumentLike).addEventListener === "function"
        && typeof (value as DisplayDocumentLike).removeEventListener === "function"
        && ((value as DisplayDocumentLike).fullscreenElement === undefined
            || (value as DisplayDocumentLike).fullscreenElement === null
            || typeof (value as DisplayDocumentLike).fullscreenElement === "object");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has a canvas and container and every optional construction field passes its condition.
// NOTE: DOM globals are deliberately not read here, so the constructor remains usable with injected structural doubles.
export function isArcadeDisplayConfig(value: unknown): value is ArcadeDisplayConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as ArcadeDisplayConfig;
    return isCanvasLike(config.canvas)
        && isContainerLike(config.container)
        && (config.aspectRatio === undefined || (isFiniteNumber(config.aspectRatio) && config.aspectRatio > 0))
        && (config.scaling === undefined || isScalingMode(config.scaling))
        && (config.imageRendering === undefined || config.imageRendering === "pixelated" || config.imageRendering === "smooth")
        && (config.resizeObserver === undefined || isResizeObserverConstructorLike(config.resizeObserver))
        && (config.fullscreenTarget === undefined || (typeof config.fullscreenTarget === "object" && config.fullscreenTarget !== null))
        && (config.document === undefined || isDisplayDocumentLike(config.document))
        && (config.requestFullscreen === undefined || typeof config.requestFullscreen === "function")
        && (config.exitFullscreen === undefined || typeof config.exitFullscreen === "function");
}

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value is a non-negative rectangle with a non-negative finite horizontal scale.
export function isLayoutEvent(value: unknown): value is LayoutEvent {
    return isRect(value)
        && value.width >= 0
        && value.height >= 0
        && isFiniteNumber((value as LayoutEvent).scale)
        && (value as LayoutEvent).scale >= 0;
}
