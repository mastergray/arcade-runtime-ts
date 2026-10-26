// realizes: docs/arcade-runtime-spec.md > §7 ArcadeDisplay (pure layout and public predicates)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import {
    ArcadeDisplay,                                                // Class under test, via the public surface
    isArcadeDisplayConfig,                                        // Construction config predicate under test
    isDisplayCrop,                                                // Native-column crop predicate under test
    isLayoutEvent,                                                // Layout event predicate under test
} from "../../src/index.ts";

// Type dependencies:
import type { Rect, ScalingMode } from "../../src/index.ts";   // layoutFor arguments and result
import type { TestCase, TestFile } from "../run.ts";              // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {result:BOOLEAN}
// Snapshot of one predicate result.
interface PredicateSnapshot {
    readonly result: boolean;
}

/**
 *
 * Constants
 *
 */

const ORIGIN = { left: 0, top: 0 } as const;                       // Required cases use origin-zero containers
const NOOP = (): void => {};                                       // Structural method placeholder

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, rect, {width:NUMBER,height:NUMBER}, NUMBER, scalingMode, rect -> testCase
// Case: layoutFor returns the exact expected centered rectangle.
const layoutCase = (label: string, container: Rect, frame: { width: number; height: number }, aspectRatio: number, mode: ScalingMode, expected: Rect): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert("layout matches", () => ArcadeDisplay.layoutFor(container, frame, aspectRatio, mode), P.equals<Rect>(expected))
        .start(undefined),
});

// HELPER :: STRING, (UNKNOWN -> BOOLEAN), UNKNOWN, BOOLEAN -> testCase
// Case: a public structural predicate returns the expected verdict.
const predicateCase = (label: string, predicate: (value: unknown) => boolean, input: unknown, expected: boolean): TestCase => ({
    label,
    run: () => CTGTest.init(label)
        .assert(expected ? "returns true" : "returns false", () => ({ result: predicate(input) }), P.equals<PredicateSnapshot>({ result: expected }))
        .start(undefined),
});

// HELPER :: VOID -> {[STRING]:UNKNOWN}
// A fully populated structural ArcadeDisplayConfig with no DOM globals involved.
const configLike = (): Record<string, unknown> => ({
    canvas: { width: 300, height: 150, style: {}, getContext: NOOP },
    container: { getBoundingClientRect: NOOP },
    aspectRatio: 4 / 3,
    scaling: "integer",
    imageRendering: "smooth",
    crop: { left: 8, right: 12 },
    resizeObserver: class { observe(): void {} disconnect(): void {} },
    fullscreenTarget: {},
    document: { fullscreenElement: null, addEventListener: NOOP, removeEventListener: NOOP },
    requestFullscreen: async () => {},
    exitFullscreen: async () => {},
});

// HELPER :: {[STRING]:UNKNOWN}, STRING, UNKNOWN -> {[STRING]:UNKNOWN}
// Copies an object with one field replaced.
const replacing = (object: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> => ({ ...object, [key]: value });

const undersizedWidth = 200 * (4 / 3);                             // Mirrors fit's operation order for exact floating-point equality

const testFile: TestFile = {
    label: "ArcadeDisplay layout and predicates",
    cases: [
        layoutCase("384x224 at 4:3 in 800x600 fit fills the exact-ratio container",
            { ...ORIGIN, width: 800, height: 600 }, { width: 384, height: 224 }, 4 / 3, "fit",
            { ...ORIGIN, width: 800, height: 600 }),
        layoutCase("384x224 at 4:3 in 1000x600 fit is 800x600 centred",
            { ...ORIGIN, width: 1000, height: 600 }, { width: 384, height: 224 }, 4 / 3, "fit",
            { left: 100, top: 0, width: 800, height: 600 }),
        layoutCase("384x224 at 4:3 in 1000x600 stretch is the whole container",
            { ...ORIGIN, width: 1000, height: 600 }, { width: 384, height: 224 }, 4 / 3, "stretch",
            { ...ORIGIN, width: 1000, height: 600 }),
        layoutCase("224x288 at 3:4 in an 844x390 landscape phone fill-height is 292.5x390 centred",
            { ...ORIGIN, width: 844, height: 390 }, { width: 224, height: 288 }, 3 / 4, "fill-height",
            { left: 275.75, top: 0, width: 292.5, height: 390 }),
        layoutCase("224x288 at 3:4 in a 390x844 portrait phone fit is 390x520 centred",
            { ...ORIGIN, width: 390, height: 844 }, { width: 224, height: 288 }, 3 / 4, "fit",
            { left: 0, top: 162, width: 390, height: 520 }),
        layoutCase("320x224 at 4:3 in 1920x1080 integer uses 4x the 320x240 display-corrected size",
            { ...ORIGIN, width: 1920, height: 1080 }, { width: 320, height: 224 }, 4 / 3, "integer",
            { left: 320, top: 60, width: 1280, height: 960 }),
        layoutCase("integer in a container smaller than one frame matches DosDisplay by falling back to centred fit",
            { ...ORIGIN, width: 300, height: 200 }, { width: 384, height: 224 }, 4 / 3, "integer",
            { left: (300 - undersizedWidth) / 2, top: 0, width: undersizedWidth, height: 200 }),
        layoutCase("fill-height may overflow horizontally and remains centred",
            { left: 10, top: 20, width: 300, height: 400 }, { width: 384, height: 224 }, 4 / 3, "fill-height",
            { left: 10 + (300 - 400 * (4 / 3)) / 2, top: 20, width: 400 * (4 / 3), height: 400 }),

        predicateCase("isArcadeDisplayConfig accepts every optional field when each is valid", isArcadeDisplayConfig, configLike(), true),
        predicateCase("isArcadeDisplayConfig rejects a non-object", isArcadeDisplayConfig, null, false),
        predicateCase("isArcadeDisplayConfig rejects a canvas without getContext", isArcadeDisplayConfig, replacing(configLike(), "canvas", { width: 1, height: 1, style: {} }), false),
        predicateCase("isArcadeDisplayConfig rejects a container without getBoundingClientRect", isArcadeDisplayConfig, replacing(configLike(), "container", {}), false),
        predicateCase("isArcadeDisplayConfig rejects a non-positive aspectRatio", isArcadeDisplayConfig, replacing(configLike(), "aspectRatio", 0), false),
        predicateCase("isArcadeDisplayConfig rejects an unknown scaling mode", isArcadeDisplayConfig, replacing(configLike(), "scaling", "zoom"), false),
        predicateCase("isArcadeDisplayConfig rejects an unknown imageRendering value", isArcadeDisplayConfig, replacing(configLike(), "imageRendering", "crisp-edges"), false),
        predicateCase("isDisplayCrop accepts non-negative whole native columns", isDisplayCrop, { left: 8, right: 12 }, true),
        predicateCase("isDisplayCrop rejects fractional native columns", isDisplayCrop, { left: 0.5, right: 0 }, false),
        predicateCase("isArcadeDisplayConfig rejects a negative crop edge", isArcadeDisplayConfig, replacing(configLike(), "crop", { left: -1, right: 0 }), false),
        predicateCase("isArcadeDisplayConfig rejects a non-constructor resizeObserver", isArcadeDisplayConfig, replacing(configLike(), "resizeObserver", {}), false),
        predicateCase("isArcadeDisplayConfig rejects a null fullscreenTarget", isArcadeDisplayConfig, replacing(configLike(), "fullscreenTarget", null), false),
        predicateCase("isArcadeDisplayConfig rejects a document without removeEventListener", isArcadeDisplayConfig, replacing(configLike(), "document", { fullscreenElement: null, addEventListener: NOOP }), false),
        predicateCase("isArcadeDisplayConfig rejects a non-function requestFullscreen", isArcadeDisplayConfig, replacing(configLike(), "requestFullscreen", true), false),
        predicateCase("isArcadeDisplayConfig rejects a non-function exitFullscreen", isArcadeDisplayConfig, replacing(configLike(), "exitFullscreen", true), false),

        predicateCase("isLayoutEvent accepts a non-negative centred rect and scale", isLayoutEvent, { left: 100, top: 0, width: 800, height: 600, scale: 800 / 384 }, true),
        predicateCase("isLayoutEvent rejects a non-object", isLayoutEvent, null, false),
        predicateCase("isLayoutEvent rejects a non-finite left", isLayoutEvent, { left: NaN, top: 0, width: 800, height: 600, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a non-finite top", isLayoutEvent, { left: 0, top: Infinity, width: 800, height: 600, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a non-finite width", isLayoutEvent, { left: 0, top: 0, width: NaN, height: 600, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a negative width", isLayoutEvent, { left: 0, top: 0, width: -1, height: 600, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a non-finite height", isLayoutEvent, { left: 0, top: 0, width: 800, height: Infinity, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a negative height", isLayoutEvent, { left: 0, top: 0, width: 800, height: -1, scale: 1 }, false),
        predicateCase("isLayoutEvent rejects a non-finite scale", isLayoutEvent, { left: 0, top: 0, width: 800, height: 600, scale: NaN }, false),
        predicateCase("isLayoutEvent rejects a negative scale", isLayoutEvent, { left: 0, top: 0, width: 800, height: 600, scale: -1 }, false),
        {
            label: "side crop preserves the visible aspect and fills the laid-out rectangle with CSS clipping and scale",
            run: () => CTGTest.init("display crop layout")
                .stage("construct and update a cropped display", () => {
                    const style: Record<string, string> = {};
                    const display = new ArcadeDisplay({
                        canvas: { width: 320, height: 240, style, getContext: () => null } as unknown as HTMLCanvasElement,
                        container: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as unknown as HTMLElement,
                        aspectRatio: 4 / 3,
                        crop: { left: 40, right: 40 },
                    });
                    const first = { crop: display.crop, layout: display.layout, style: { ...style } };
                    display.crop = { left: 20, right: 20 };
                    return { first, second: { crop: display.crop, layout: display.layout, style: { ...style } } };
                })
                .assert("clip percentages, transform and cropped aspect update together", (state) => state.subject, P.equals<unknown>({
                    first: {
                        crop: { left: 40, right: 40 },
                        layout: { left: 100, top: 0, width: 600, height: 600, scale: 2.5 },
                        style: {
                            imageRendering: "pixelated", width: "600px", height: "600px",
                            clipPath: "inset(0 12.5% 0 12.5%)", transform: "scaleX(1.3333333333333333)", transformOrigin: "50% 50%",
                        },
                    },
                    second: {
                        crop: { left: 20, right: 20 },
                        layout: { left: 50.00000000000006, top: 0, width: 699.9999999999999, height: 600, scale: 2.4999999999999996 },
                        style: {
                            imageRendering: "pixelated", width: "699.9999999999999px", height: "600px",
                            clipPath: "inset(0 6.25% 0 6.25%)", transform: "scaleX(1.1428571428571428)", transformOrigin: "50% 50%",
                        },
                    },
                }))
                .start(undefined),
        },
        {
            label: "image rendering changes live without rebuilding the display",
            run: () => CTGTest.init("display live filtering")
                .stage("toggle the public rendering setter", () => {
                    const style: Record<string, string> = {};
                    const display = new ArcadeDisplay({
                        canvas: { width: 320, height: 240, style, getContext: () => null } as unknown as HTMLCanvasElement,
                        container: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as unknown as HTMLElement,
                    });
                    display.imageRendering = "smooth";
                    const smooth = { value: display.imageRendering, css: style.imageRendering };
                    display.imageRendering = "pixelated";
                    return { smooth, pixelated: { value: display.imageRendering, css: style.imageRendering } };
                })
                .assert("both public and CSS values follow each live change", (state) => state.subject, P.equals<unknown>({
                    smooth: { value: "smooth", css: "auto" },
                    pixelated: { value: "pixelated", css: "pixelated" },
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
