// realizes: docs/arcade-runtime-spec.md > §7 ArcadeDisplay

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed config, attachment and fullscreen failures

// Type dependencies:
import {
    isFiniteNumber,                                                // Guards mutable aspect ratios and explicit resize dimensions
    isRect,                                                        // Guards explicit Rect resize calls
    isScalingMode,                                                 // Guards mutable scaling modes
    type ArcadeSession,                                            // Session whose frames attach() draws
    type FrameEvent,                                               // Native upright RGBA frame
    type Listener,                                                 // Subscriber shape for onLayout
    type Rect,                                                     // Container and canvas rectangles
    type ScalingMode,                                              // fit, integer or fill-height
    type Unsubscribe,                                              // Returned by attach and onLayout
} from "../shared.types.js";
import {
    isArcadeDisplayConfig,                                         // Runtime guard for construction config
    type ArcadeDisplayConfig,                                      // Construction dependencies and page options
    type DisplayDocumentLike,                                      // Injected fullscreen document boundary
    type ExitFullscreen,                                           // Injected fullscreen exit operation
    type LayoutEvent,                                              // Applied rectangle plus scale
    type RequestFullscreen,                                        // Injected fullscreen entry operation
    type ResizeObserverLike,                                       // Observer owned by this display
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {width:NUMBER, height:NUMBER}
// Native frame dimensions used by layoutFor.
interface FrameSize {
    readonly width: number;                                        // Native pixel width
    readonly height: number;                                       // Native pixel height
}

// INTERFACE :: event target subset used by watchFullscreen
// Anything able to add and remove a no-argument fullscreenchange listener.
interface FullscreenEventTargetLike {
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
}

/**
 *
 * Class
 *
 */

// Owns native frame drawing and the CSS rectangle the page uses to present one arcade machine.
export default class ArcadeDisplay {

    /* Static Fields */
    static readonly DEFAULT_ASPECT_RATIO = 4 / 3;                  // Temporary aspect before a session supplies machine metadata
    static readonly DEFAULT_SCALING: ScalingMode = "fit";          // Default for horizontal machines and portrait containers
    static readonly DEFAULT_FRAME: FrameSize = { width: 320, height: 240 };   // Layout size before a machine is attached
    static readonly DEFAULT_IMAGE_RENDERING = "pixelated" as const;           // Crisp native pixels unless the page asks for smoothing

    /* Instance Fields */
    private readonly _canvas: HTMLCanvasElement;                   // Canvas frames are drawn into
    private readonly _container: HTMLElement;                      // Element whose content rectangle the canvas fits
    private readonly _resizeObserver: ResizeObserverLike | null;   // Injected observer, or null when unavailable
    private readonly _fullscreenTarget: Element;                   // Element passed to requestFullscreen
    private readonly _document: DisplayDocumentLike | null;        // Injected document used for fullscreen state and events
    private readonly _requestFullscreen: RequestFullscreen | null; // Injected fullscreen entry operation
    private readonly _exitFullscreen: ExitFullscreen | null;       // Injected fullscreen exit operation
    private _aspectRatioOverride: boolean;                         // Whether machine metadata may replace the aspect ratio
    private _scalingOverride: boolean;                             // Whether orientation and container shape may select the mode
    private _aspectRatio: number;                                  // Display aspect preserved by layout
    private _scaling: ScalingMode;                                 // Current effective scaling mode
    private _machineOrientation: "horizontal" | "vertical" | null = null;   // Attached machine orientation
    private _containerRect: Rect;                                  // Last measured container rectangle
    private _frameSize: FrameSize = { width: 0, height: 0 };        // Native dimensions, 0×0 before attach
    private _layout: LayoutEvent;                                  // Last applied rectangle and scale
    private _unsubscribe: Unsubscribe | null = null;               // Current session frame subscription
    private readonly _layoutListeners = new Set<Listener<LayoutEvent>>();     // onLayout subscribers
    private _unwatchFullscreen: Unsubscribe | null = null;         // Removes the current fullscreenchange listener
    private _placeholder: HTMLElement | null = null;               // Page-supplied starting placeholder currently shown
    private _destroyed = false;                                    // Whether destroy() completed

    // CONSTRUCTOR :: arcadeDisplayConfig -> this
    // Creates a display entirely from supplied values, observes its container and applies its initial layout
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isArcadeDisplayConfig()
    constructor(config: ArcadeDisplayConfig) {
        if (!isArcadeDisplayConfig(config)) throw ArcadeDisplay.invalidConfig("ArcadeDisplay config is invalid.", config);
        this._canvas = config.canvas;
        this._container = config.container;
        this._fullscreenTarget = config.fullscreenTarget ?? config.container;
        this._document = config.document ?? null;
        this._requestFullscreen = config.requestFullscreen ?? null;
        this._exitFullscreen = config.exitFullscreen ?? null;
        this._aspectRatioOverride = config.aspectRatio !== undefined;
        this._scalingOverride = config.scaling !== undefined;
        this._aspectRatio = config.aspectRatio ?? ArcadeDisplay.DEFAULT_ASPECT_RATIO;
        this._scaling = config.scaling ?? ArcadeDisplay.DEFAULT_SCALING;
        this._containerRect = ArcadeDisplay.contentRectOf(config.container);
        this._canvas.style.imageRendering = config.imageRendering === "smooth"
            ? "auto"
            : ArcadeDisplay.DEFAULT_IMAGE_RENDERING;
        this._layout = this.applyLayout();
        this._resizeObserver = config.resizeObserver === undefined
            ? null
            : new config.resizeObserver((entries) => {
                const entry = entries[entries.length - 1];
                if (entry === undefined || this._destroyed) return;
                const measured = ArcadeDisplay.contentRectOf(this._container);
                this.resize({ left: measured.left, top: measured.top, width: entry.contentRect.width, height: entry.contentRect.height });
            });
        if (this._resizeObserver !== null) this._resizeObserver.observe(this._container);
        if (this._document !== null) this.watchFullscreen(this._document);
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> finiteNumber
    // Display aspect ratio currently preserved by layout
    get aspectRatio(): number {
        return this._aspectRatio;
    }

    // SETTER :: finiteNumber -> VOID
    // Overrides the machine aspect ratio and re-lays out
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG unless value is positive and finite
    set aspectRatio(value: number) {
        if (!isFiniteNumber(value) || value <= 0) throw ArcadeDisplay.invalidConfig("aspectRatio must be a positive finite number.", value);
        this._aspectRatioOverride = true;
        this._aspectRatio = value;
        this.updateLayout();
    }

    // GETTER :: VOID -> scalingMode
    // Current effective scaling mode
    get scaling(): ScalingMode {
        return this._scaling;
    }

    // SETTER :: scalingMode -> VOID
    // Overrides automatic scaling and re-lays out
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG unless value is a ScalingMode
    set scaling(value: ScalingMode) {
        if (!isScalingMode(value)) throw ArcadeDisplay.invalidConfig("scaling must be \"fit\", \"integer\" or \"fill-height\".", value);
        this._scalingOverride = true;
        this._scaling = value;
        this.updateLayout();
    }

    // GETTER :: VOID -> layoutEvent
    // Last applied centered rectangle and native horizontal scale
    get layout(): LayoutEvent {
        return this._layout;
    }

    // GETTER :: VOID -> BOOLEAN
    // Whether the injected document reports the target as its fullscreen element
    get isFullscreen(): boolean {
        return this._document !== null && this._document.fullscreenElement === this._fullscreenTarget;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: arcadeSession -> unsubscribe
    // Adopts machine layout metadata, subscribes to frames and returns a function that detaches that subscription
    // NOTE: Throws ArcadeRuntimeError INTERNAL_ERROR when already attached
    attach(session: ArcadeSession): Unsubscribe {
        if (this._unsubscribe !== null) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.INTERNAL_ERROR,
            message: "ArcadeDisplay is already attached to a session.",
        });
        this._machineOrientation = session.machine.orientation;
        this._frameSize = { width: session.machine.width, height: session.machine.height };
        if (!this._aspectRatioOverride) this._aspectRatio = session.machine.aspectRatio;
        this.selectDefaultScaling();
        this.updateLayout();
        const unsubscribe = session.onFrame((frame) => this.draw(frame));
        this._unsubscribe = unsubscribe;
        return () => {
            if (this._unsubscribe !== unsubscribe) return;
            this.detach();
        };
    }

    // INSTANCE :: VOID -> VOID
    // Stops drawing frames from the attached session; a second call is a no-op
    detach(): void {
        const unsubscribe = this._unsubscribe;
        if (unsubscribe === null) return;
        this._unsubscribe = null;
        unsubscribe();
    }

    // INSTANCE :: finiteNumber, finiteNumber -> layoutEvent
    // Re-lays out using explicit container dimensions while preserving its last measured origin
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when either dimension is not a non-negative finite number
    resize(containerWidth: number, containerHeight: number): LayoutEvent;

    // INSTANCE :: rect -> layoutEvent
    // Re-lays out using an explicit container rectangle
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when the rectangle is invalid or has negative dimensions
    resize(container: Rect): LayoutEvent;

    resize(containerOrWidth: Rect | number, containerHeight?: number): LayoutEvent {
        if (typeof containerOrWidth === "number") {
            if (!isFiniteNumber(containerOrWidth) || containerOrWidth < 0) throw ArcadeDisplay.invalidConfig("resize requires a non-negative finite container width.", containerOrWidth);
            if (!isFiniteNumber(containerHeight) || containerHeight < 0) throw ArcadeDisplay.invalidConfig("resize requires a non-negative finite container height.", containerHeight);
            this._containerRect = { ...this._containerRect, width: containerOrWidth, height: containerHeight };
        } else {
            if (!isRect(containerOrWidth) || containerOrWidth.width < 0 || containerOrWidth.height < 0) throw ArcadeDisplay.invalidConfig("resize requires a Rect with non-negative dimensions.", containerOrWidth);
            this._containerRect = containerOrWidth;
        }
        this.selectDefaultScaling();
        this.updateLayout();
        return this._layout;
    }

    // INSTANCE :: (layoutEvent -> VOID) -> unsubscribe
    // Subscribes to layouts that differ from the preceding event
    onLayout(listener: Listener<LayoutEvent>): Unsubscribe {
        this._layoutListeners.add(listener);
        return () => { this._layoutListeners.delete(listener); };
    }

    // INSTANCE :: fullscreenEventTargetLike -> VOID
    // Re-lays out from the current container rectangle on fullscreenchange; a second watch replaces the first
    watchFullscreen(target: FullscreenEventTargetLike): void {
        if (this._unwatchFullscreen !== null) this._unwatchFullscreen();
        const listener = (): void => {
            if (this._destroyed) return;
            this.resize(ArcadeDisplay.contentRectOf(this._container));
        };
        target.addEventListener("fullscreenchange", listener);
        this._unwatchFullscreen = () => target.removeEventListener("fullscreenchange", listener);
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Requests fullscreen through the injected function
    // NOTE: Throws UNSUPPORTED when none was supplied and FULLSCREEN_FAILED when it rejects
    async fullscreen(): Promise<void> {
        if (this._requestFullscreen === null) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "Fullscreen is not supported by this environment.",
        });
        try {
            await this._requestFullscreen(this._fullscreenTarget);
        } catch (error) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.FULLSCREEN_FAILED,
                message: "The fullscreen request was rejected.",
                data: error,
            });
        }
    }

    // INSTANCE :: VOID -> PROMISE(VOID)
    // Leaves fullscreen through the injected function and document
    // NOTE: Throws UNSUPPORTED when either dependency is absent and FULLSCREEN_FAILED when it rejects
    async exitFullscreen(): Promise<void> {
        if (this._exitFullscreen === null || this._document === null) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.UNSUPPORTED,
            message: "Exiting fullscreen is not supported by this environment.",
        });
        try {
            await this._exitFullscreen(this._document);
        } catch (error) {
            throw new ArcadeRuntimeError({
                code: ArcadeRuntimeError.CODE.FULLSCREEN_FAILED,
                message: "Exiting fullscreen was rejected.",
                data: error,
            });
        }
    }

    // INSTANCE :: HTMLElement? -> VOID
    // Shows a page-supplied starting placeholder, or a blank correctly-sized canvas when null
    // NOTE: Toggling visibility never changes canvas width, height or CSS dimensions
    showPlaceholder(element: HTMLElement | null): void {
        if (element !== null && (typeof element !== "object" || typeof element.hidden !== "boolean")) {
            throw ArcadeDisplay.invalidConfig("placeholder must be an HTMLElement or null.", element);
        }
        if (this._placeholder !== null && this._placeholder !== element) this._placeholder.hidden = true;
        this._placeholder = element;
        this._canvas.style.visibility = element === null ? "" : "hidden";
        if (element !== null) {
            element.hidden = false;
            return;
        }
        const context = this._canvas.getContext("2d");
        if (context !== null) context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    // INSTANCE :: VOID -> VOID
    // Detaches, disconnects browser observation, removes listeners, hides the placeholder and clears the canvas; idempotent
    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this.detach();
        if (this._unwatchFullscreen !== null) {
            this._unwatchFullscreen();
            this._unwatchFullscreen = null;
        }
        this._layoutListeners.clear();
        if (this._resizeObserver !== null) this._resizeObserver.disconnect();
        if (this._placeholder !== null) {
            this._placeholder.hidden = true;
            this._placeholder = null;
        }
        this._canvas.style.visibility = "";
        const context = this._canvas.getContext("2d");
        if (context !== null) context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Selects fill-height for a vertical machine in a landscape container, otherwise fit, unless config supplied a mode
    private selectDefaultScaling(): void {
        if (this._scalingOverride) return;
        this._scaling = this._machineOrientation === "vertical" && this._containerRect.width > this._containerRect.height
            ? "fill-height"
            : ArcadeDisplay.DEFAULT_SCALING;
    }

    // PRIVATE :: frameEvent -> VOID
    // Updates native dimensions and the canvas backing store when needed, then draws a copied ImageData object
    private draw(frame: FrameEvent): void {
        if (frame.width !== this._frameSize.width || frame.height !== this._frameSize.height
            || this._canvas.width !== frame.width || this._canvas.height !== frame.height) {
            this._frameSize = { width: frame.width, height: frame.height };
            this._canvas.width = frame.width;
            this._canvas.height = frame.height;
            this.updateLayout();
        }
        const context = this._canvas.getContext("2d");
        if (context === null) return;
        const image = context.createImageData(frame.width, frame.height);
        image.data.set(frame.rgba);
        context.putImageData(image, 0, 0);
    }

    // PRIVATE :: VOID -> VOID
    // Applies the current layout and emits it when any field changed
    private updateLayout(): void {
        const previous = this._layout;
        const next = this.applyLayout();
        this._layout = next;
        if (ArcadeDisplay.sameLayout(previous, next)) return;
        for (const listener of this._layoutListeners) listener(next);
    }

    // PRIVATE :: VOID -> layoutEvent
    // Computes the centered rectangle and applies its dimensions to the canvas CSS
    private applyLayout(): LayoutEvent {
        const rect = ArcadeDisplay.layoutFor(this._containerRect, this._frameSize, this._aspectRatio, this._scaling);
        const nativeWidth = this._frameSize.width > 0 && this._frameSize.height > 0
            ? this._frameSize.width
            : ArcadeDisplay.DEFAULT_FRAME.width;
        const layout: LayoutEvent = { ...rect, scale: rect.width / nativeWidth };
        this._canvas.style.width = `${layout.width}px`;
        this._canvas.style.height = `${layout.height}px`;
        return layout;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: arcadeDisplayConfig -> arcadeDisplay
    // Fills browser observer, document and fullscreen functions, then delegates to the constructor
    static init(config: ArcadeDisplayConfig): ArcadeDisplay {
        if (!isArcadeDisplayConfig(config)) return new ArcadeDisplay(config);
        const filled: { -readonly [K in keyof ArcadeDisplayConfig]: ArcadeDisplayConfig[K] } = { ...config };
        const target = config.fullscreenTarget ?? config.container;
        const ownerDocument = (config.container as { ownerDocument?: Document }).ownerDocument;
        const browserDocument = typeof globalThis.document === "undefined" ? undefined : globalThis.document;
        const document = config.document ?? ownerDocument ?? browserDocument;
        const ResizeObserverImplementation = typeof globalThis.ResizeObserver === "undefined" ? undefined : globalThis.ResizeObserver;
        if (filled.resizeObserver === undefined && ResizeObserverImplementation !== undefined) filled.resizeObserver = ResizeObserverImplementation;
        if (filled.fullscreenTarget === undefined) filled.fullscreenTarget = target;
        if (filled.document === undefined && document !== undefined) filled.document = document;
        if (filled.requestFullscreen === undefined && typeof (target as Partial<Element>).requestFullscreen === "function") {
            filled.requestFullscreen = async (element) => { await (element as Element).requestFullscreen(); };
        }
        if (filled.exitFullscreen === undefined && document !== undefined && "exitFullscreen" in document
            && typeof (document as Document).exitFullscreen === "function") {
            filled.exitFullscreen = async (injectedDocument) => { await (injectedDocument as Document).exitFullscreen(); };
        }
        return new ArcadeDisplay(filled);
    }

    // STATIC :: rect, {width:NUMBER,height:NUMBER}, finiteNumber, scalingMode -> rect
    // Pure layout arithmetic returning the centered CSS rectangle for the selected mode
    // NOTE: integer uses display-corrected native height and falls back to fit when even 1× does not fit
    static layoutFor(container: Rect, frame: FrameSize, aspectRatio: number, mode: ScalingMode): Rect {
        const frameWidth = frame.width > 0 && frame.height > 0 ? frame.width : ArcadeDisplay.DEFAULT_FRAME.width;
        const correctedHeight = frameWidth / aspectRatio;
        const centered = (width: number, height: number): Rect => ({
            left: container.left + (container.width - width) / 2,
            top: container.top + (container.height - height) / 2,
            width,
            height,
        });
        const fit = (): Rect => {
            const availableWidth = Math.max(0, container.width);
            const availableHeight = Math.max(0, container.height);
            if (availableWidth <= availableHeight * aspectRatio) return centered(availableWidth, availableWidth / aspectRatio);
            return centered(availableHeight * aspectRatio, availableHeight);
        };
        if (mode === "fit") return fit();
        if (mode === "fill-height") {
            const height = Math.max(0, container.height);
            return centered(height * aspectRatio, height);
        }
        const multiple = Math.floor(Math.min(container.width / frameWidth, container.height / correctedHeight));
        if (!Number.isFinite(multiple) || multiple < 1) return fit();
        return centered(frameWidth * multiple, correctedHeight * multiple);
    }

    // STATIC :: HTMLElement -> rect
    // Reads the current container rectangle, or returns a zero rectangle when unavailable
    private static contentRectOf(element: HTMLElement): Rect {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    // STATIC :: layoutEvent, layoutEvent -> BOOLEAN
    // True when all observable layout fields are equal
    private static sameLayout(left: LayoutEvent, right: LayoutEvent): boolean {
        return left.left === right.left
            && left.top === right.top
            && left.width === right.width
            && left.height === right.height
            && left.scale === right.scale;
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected value
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
