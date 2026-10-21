// realizes: docs/arcade-runtime-spec.md > §7 ArcadeDisplay (drawing, resize, placeholder and fullscreen browser cases)

// Dependencies:
import { readFile } from "node:fs/promises";                       // Reads source modules for the test-local page
import { createServer, type Server } from "node:http";            // Serves one self-contained test page per case
import { fileURLToPath } from "node:url";                          // Resolves the workspace without a harness dependency
import { dirname, extname, resolve } from "node:path";             // Resolves and constrains served module paths
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline and predicates
import ts from "typescript";                                       // Transpiles the source modules requested by the page

// Type dependencies:
import type ArcadeDisplay from "../../src/ArcadeDisplay/ArcadeDisplay.ts";      // Instance retained between page assertions
import type ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Error constructor exposed to the page
import type { DisplayDocumentLike, LayoutEvent } from "../../src/ArcadeDisplay/types.ts";   // Fullscreen injection and layout snapshots
import type FakeArcadeSession from "../support/FakeArcadeSession.ts";             // Required W0 session double
import type { ErrorSnapshot } from "../support/fixtures.ts";                      // Plain typed-error identity
import type { TestFile } from "../run.ts";                                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructors loaded by the test-local browser page
// The page imports production source and the W0 session double directly.
interface BrowserRuntime {
    ArcadeDisplay: typeof ArcadeDisplay;
    ArcadeRuntimeError: typeof ArcadeRuntimeError;
    FakeArcadeSession: typeof FakeArcadeSession;
}

// INTERFACE :: scratch values retained on the page between pipeline stages
interface BrowserScratch {
    display?: ArcadeDisplay;
    session?: FakeArcadeSession;
    layouts?: LayoutEvent[];
}

// INTERFACE :: server handle and URL for one browser case
interface TestPageServer {
    readonly server: Server;
    readonly url: string;
}

/**
 *
 * Constants
 *
 */

const TIMEOUT = 30_000;                                           // Per-case browser pipeline timeout
const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root served read-only
const PAGE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; }
    #container { position: relative; width: 640px; height: 480px; }
    #canvas { display: block; }
    #placeholder { position: absolute; inset: 0; }
  </style>
</head>
<body>
  <div id="container"><canvas id="canvas"></canvas><div id="placeholder" hidden>Starting</div></div>
  <script type="module">
    import ArcadeDisplay from "/src/ArcadeDisplay/ArcadeDisplay.js";
    import ArcadeRuntimeError from "/src/ArcadeRuntimeError/ArcadeRuntimeError.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";
    window.displayRuntime = { ArcadeDisplay, ArcadeRuntimeError, FakeArcadeSession };
  </script>
</body>
</html>`;                                                         // Page built in this test; no shared browser harness

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> PROMISE(testPageServer)
// Starts an ephemeral server that serves this test's page and transpiles requested repository TypeScript modules in memory.
const startTestPageServer = async (): Promise<TestPageServer> => {
    const server = createServer((request, response) => {
        void (async () => {
            const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
            if (pathname === "/") {
                response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
                response.end(PAGE);
                return;
            }
            const decoded = decodeURIComponent(pathname);
            let path = resolve(WORKSPACE, `.${decoded}`);
            if (path !== WORKSPACE && !path.startsWith(`${WORKSPACE}/`)) {
                response.writeHead(403).end();
                return;
            }
            if (extname(path) === ".js") path = `${path.slice(0, -3)}.ts`;
            if (extname(path) !== ".ts") {
                response.writeHead(404).end();
                return;
            }
            const source = await readFile(path, "utf8");
            const javascript = ts.transpileModule(source, {
                compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
                fileName: path,
            }).outputText;
            response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
            response.end(javascript);
        })().catch((error: unknown) => {
            response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            response.end(error instanceof Error ? error.message : "not found");
        });
    });
    await new Promise<void>((resolveListening, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolveListening();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("test page server did not bind a TCP port");
    return { server, url: `http://127.0.0.1:${address.port}/` };
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against a fresh page server and always releases the socket.
const withTestPage = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const page = await startTestPageServer();
    try {
        return await run(page.url);
    } finally {
        page.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => page.server.close(() => resolveClosed()));
    }
};

const testFile: TestFile = {
    label: "ArcadeDisplay browser behavior",
    cases: [
        {
            label: "attach draws native RGBA frames, resizes the backing store when dimensions change, and detach stops drawing",
            run: () => withTestPage((url) => CTGBrowserTest.init("native frame drawing and detach")
                .assertPage("two differently sized frames draw and a post-detach frame is ignored", (page) => page.evaluate(() => {
                    const { ArcadeDisplay, ArcadeRuntimeError, FakeArcadeSession } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    const session = new FakeArcadeSession();
                    const display = ArcadeDisplay.init({ canvas, container });
                    const detach = display.attach(session);
                    let twice: unknown;
                    try { display.attach(session); } catch (error) { twice = error; }
                    const first = new Uint8ClampedArray(2 * 1 * 4);
                    first.set([10, 20, 30, 255], 0);
                    session.emitFrame({ width: 2, height: 1, rgba: first });
                    const second = new Uint8ClampedArray(3 * 2 * 4);
                    second.set([40, 50, 60, 255], 4 * 5);
                    session.emitFrame({ width: 3, height: 2, rgba: second });
                    const pixel = Array.from(canvas.getContext("2d")!.getImageData(2, 1, 1, 1).data);
                    detach();
                    session.emitFrame({ width: 1, height: 1, rgba: new Uint8ClampedArray([1, 2, 3, 255]) });
                    display.attach(session);
                    display.detach();
                    return {
                        width: canvas.width,
                        height: canvas.height,
                        pixel,
                        twice: ArcadeRuntimeError.is(twice) ? { isRuntimeError: true, code: twice.code, label: twice.label } : { isRuntimeError: false, code: null, label: null },
                    };
                }), P.equals<{ width: number; height: number; pixel: number[]; twice: ErrorSnapshot }>({
                    width: 3,
                    height: 2,
                    pixel: [40, 50, 60, 255],
                    twice: { isRuntimeError: true, code: 3, label: "INTERNAL_ERROR" },
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "attach adopts machine aspect and automatic vertical scaling while config overrides both defaults",
            run: () => withTestPage((url) => CTGBrowserTest.init("machine display defaults")
                .assertPage("vertical landscape is fill-height, portrait becomes fit, and explicit values persist", (page) => page.evaluate(() => {
                    const { ArcadeDisplay, FakeArcadeSession } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    container.style.width = "844px";
                    container.style.height = "390px";
                    const base = new FakeArcadeSession().machine;
                    const machine = { ...base, width: 224, height: 288, orientation: "vertical" as const, aspectRatio: 3 / 4 };
                    const automatic = new ArcadeDisplay({ canvas: document.querySelector<HTMLCanvasElement>("#canvas")!, container });
                    automatic.attach(new FakeArcadeSession(machine));
                    const landscape = { aspectRatio: automatic.aspectRatio, scaling: automatic.scaling, layout: automatic.layout };
                    automatic.resize({ left: 0, top: 0, width: 390, height: 844 });
                    const portrait = { scaling: automatic.scaling, layout: automatic.layout };

                    const overrideCanvas = document.createElement("canvas");
                    const overridden = new ArcadeDisplay({ canvas: overrideCanvas, container, aspectRatio: 1, scaling: "fit", imageRendering: "smooth" });
                    overridden.attach(new FakeArcadeSession(machine));
                    overridden.resize({ left: 0, top: 0, width: 844, height: 390 });
                    return {
                        landscape,
                        portrait,
                        overridden: { aspectRatio: overridden.aspectRatio, scaling: overridden.scaling, layout: overridden.layout, imageRendering: overrideCanvas.style.imageRendering },
                    };
                }), P.equals<{
                    landscape: { aspectRatio: number; scaling: string; layout: LayoutEvent };
                    portrait: { scaling: string; layout: LayoutEvent };
                    overridden: { aspectRatio: number; scaling: string; layout: LayoutEvent; imageRendering: string };
                }>({
                    landscape: { aspectRatio: 0.75, scaling: "fill-height", layout: { left: 275.75, top: 0, width: 292.5, height: 390, scale: 292.5 / 224 } },
                    portrait: { scaling: "fit", layout: { left: 0, top: 162, width: 390, height: 520, scale: 390 / 224 } },
                    overridden: { aspectRatio: 1, scaling: "fit", layout: { left: 227, top: 0, width: 390, height: 390, scale: 390 / 224 }, imageRendering: "auto" },
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "init supplies Chromium ResizeObserver and follows real container resizes",
            run: () => withTestPage((url) => CTGBrowserTest.init("real resize observation")
                .interact("construct in a half-viewport-width container", async ({ page }) => {
                    await page.setViewportSize({ width: 1280, height: 720 });
                    await page.evaluate(() => {
                        const { ArcadeDisplay } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                        const container = document.querySelector<HTMLElement>("#container")!;
                        container.style.width = "50vw";
                        container.style.height = "480px";
                        const scratch: BrowserScratch = { display: ArcadeDisplay.init({ canvas: document.querySelector<HTMLCanvasElement>("#canvas")!, container }) };
                        (window as unknown as { displayScratch: BrowserScratch }).displayScratch = scratch;
                    });
                    await page.waitForFunction(() => (window as unknown as { displayScratch: BrowserScratch }).displayScratch.display?.layout.width === 640);
                })
                .interact("shrink the viewport", async ({ page }) => {
                    await page.setViewportSize({ width: 800, height: 720 });
                    await page.waitForFunction(() => (window as unknown as { displayScratch: BrowserScratch }).displayScratch.display?.layout.width === 400);
                })
                .assertPage("layout follows the 400x480 content box as a centred 400x300 rect", (page) => page.evaluate(() => {
                    const layout = (window as unknown as { displayScratch: BrowserScratch }).displayScratch.display!.layout;
                    return { left: layout.left, top: layout.top, width: layout.width, height: layout.height, scale: layout.scale };
                }), P.equals<LayoutEvent>({ left: 0, top: 90, width: 400, height: 300, scale: 1.25 }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "onLayout emits changed rectangles from resize and setters and its unsubscribe stops later emissions",
            run: () => withTestPage((url) => CTGBrowserTest.init("layout events")
                .assertPage("same-size resize is silent and unsubscribe prevents the final event", (page) => page.evaluate(() => {
                    const { ArcadeDisplay, FakeArcadeSession } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    container.style.width = "1000px";
                    container.style.height = "500px";
                    const display = new ArcadeDisplay({ canvas: document.querySelector<HTMLCanvasElement>("#canvas")!, container });
                    display.attach(new FakeArcadeSession());
                    const layouts: LayoutEvent[] = [];
                    const unsubscribe = display.onLayout((layout) => layouts.push({ ...layout }));
                    display.resize({ left: 0, top: 0, width: 640, height: 480 });
                    display.resize({ left: 0, top: 0, width: 640, height: 480 });
                    display.aspectRatio = 16 / 9;
                    unsubscribe();
                    display.scaling = "integer";
                    return layouts;
                }), P.equals<LayoutEvent[]>([
                    { left: 0, top: 0, width: 640, height: 480, scale: 640 / 384 },
                    { left: 0, top: 60, width: 640, height: 360, scale: 640 / 384 },
                ]))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "fullscreen and exitFullscreen use injected functions and normalize unsupported and rejected operations",
            run: () => withTestPage((url) => CTGBrowserTest.init("injected fullscreen operations")
                .assertPage("injected targets are forwarded and failures use the specified runtime codes", (page) => page.evaluate(async () => {
                    const { ArcadeDisplay } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    const unsupported = new ArcadeDisplay({ canvas, container });
                    let unsupportedError: unknown;
                    try { await unsupported.fullscreen(); } catch (error) { unsupportedError = error; }

                    const target = document.createElement("div");
                    const fakeDocument = {
                        fullscreenElement: target as Element | null,
                        addEventListener: document.addEventListener.bind(document) as (type: string, listener: () => void) => void,
                        removeEventListener: document.removeEventListener.bind(document) as (type: string, listener: () => void) => void,
                    };
                    let requestTargetMatches = false;
                    let exitDocumentMatches = false;
                    const requestFullscreen = eval("(async (given) => { requestTargetMatches = given === target; })") as (given: Element) => Promise<void>;
                    const exitFullscreen = eval("(async (given) => { exitDocumentMatches = given === fakeDocument; })") as (given: DisplayDocumentLike) => Promise<void>;
                    const forwarded = new ArcadeDisplay({
                        canvas, container, fullscreenTarget: target, document: fakeDocument,
                        requestFullscreen,
                        exitFullscreen,
                    });
                    await forwarded.fullscreen();
                    await forwarded.exitFullscreen();

                    const rejecting = new ArcadeDisplay({
                        canvas, container, document: fakeDocument,
                        requestFullscreen: Promise.reject.bind(Promise, new Error("denied")) as unknown as (target: Element) => Promise<void>,
                        exitFullscreen: Promise.reject.bind(Promise, new Error("denied")) as unknown as (given: DisplayDocumentLike) => Promise<void>,
                    });
                    let requestError: unknown;
                    let exitError: unknown;
                    try { await rejecting.fullscreen(); } catch (error) { requestError = error; }
                    try { await rejecting.exitFullscreen(); } catch (error) { exitError = error; }
                    const { ArcadeRuntimeError } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    return {
                        unsupported: ArcadeRuntimeError.is(unsupportedError)
                            ? { isRuntimeError: true, code: unsupportedError.code, label: unsupportedError.label }
                            : { isRuntimeError: false, code: null, label: null },
                        request: ArcadeRuntimeError.is(requestError)
                            ? { isRuntimeError: true, code: requestError.code, label: requestError.label }
                            : { isRuntimeError: false, code: null, label: null },
                        exit: ArcadeRuntimeError.is(exitError)
                            ? { isRuntimeError: true, code: exitError.code, label: exitError.label }
                            : { isRuntimeError: false, code: null, label: null },
                        requestTargetMatches,
                        exitDocumentMatches,
                        isFullscreen: forwarded.isFullscreen,
                    };
                }), P.equals<{ unsupported: ErrorSnapshot; request: ErrorSnapshot; exit: ErrorSnapshot; requestTargetMatches: boolean; exitDocumentMatches: boolean; isFullscreen: boolean }>({
                    unsupported: { isRuntimeError: true, code: 15, label: "UNSUPPORTED" },
                    request: { isRuntimeError: true, code: 11, label: "FULLSCREEN_FAILED" },
                    exit: { isRuntimeError: true, code: 11, label: "FULLSCREEN_FAILED" },
                    requestTargetMatches: true,
                    exitDocumentMatches: true,
                    isFullscreen: true,
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "showPlaceholder toggles a supplied starting element without changing canvas backing or CSS sizing",
            run: () => withTestPage((url) => CTGBrowserTest.init("starting placeholder")
                .assertPage("element and blank-canvas states preserve all dimensions", (page) => page.evaluate(() => {
                    const { ArcadeDisplay, FakeArcadeSession } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    const placeholder = document.querySelector<HTMLElement>("#placeholder")!;
                    const display = ArcadeDisplay.init({ canvas, container });
                    const session = new FakeArcadeSession();
                    display.attach(session);
                    const rgba = new Uint8ClampedArray(4 * 3 * 4);
                    rgba.set([255, 0, 0, 255], 0);
                    session.emitFrame({ width: 4, height: 3, rgba });
                    const before = { width: canvas.width, height: canvas.height, styleWidth: canvas.style.width, styleHeight: canvas.style.height };
                    display.showPlaceholder(placeholder);
                    const shown = {
                        width: canvas.width, height: canvas.height, styleWidth: canvas.style.width, styleHeight: canvas.style.height,
                        placeholderHidden: placeholder.hidden, canvasVisibility: canvas.style.visibility,
                    };
                    display.showPlaceholder(null);
                    const blank = {
                        width: canvas.width, height: canvas.height, styleWidth: canvas.style.width, styleHeight: canvas.style.height,
                        placeholderHidden: placeholder.hidden, canvasVisibility: canvas.style.visibility,
                        pixel: Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data),
                    };
                    return { before, shown, blank };
                }), P.equals({
                    before: { width: 4, height: 3, styleWidth: "640px", styleHeight: "480px" },
                    shown: { width: 4, height: 3, styleWidth: "640px", styleHeight: "480px", placeholderHidden: false, canvasVisibility: "hidden" },
                    blank: { width: 4, height: 3, styleWidth: "640px", styleHeight: "480px", placeholderHidden: true, canvasVisibility: "", pixel: [0, 0, 0, 0] },
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "destroy unsubscribes, disconnects observation, removes fullscreen watching and clears the canvas exactly once",
            run: () => withTestPage((url) => CTGBrowserTest.init("display destruction")
                .assertPage("destroy is idempotent and later frames do not resize or redraw", (page) => page.evaluate(() => {
                    const { ArcadeDisplay, FakeArcadeSession } = (window as unknown as { displayRuntime: BrowserRuntime }).displayRuntime;
                    const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
                    const container = document.querySelector<HTMLElement>("#container")!;
                    const counts = { observe: 0, disconnect: 0, add: 0, remove: 0 };
                    const Observer = eval(`(class {
                        constructor(callback) { this.callback = callback; }
                        observe(target) { counts.observe++; this.target = target; }
                        disconnect() { counts.disconnect++; }
                    })`) as { new (callback: (entries: ResizeObserverEntry[]) => void): ResizeObserver };
                    const fakeDocument = {
                        fullscreenElement: null,
                        addEventListener: eval("((type, listener) => { counts.add++; })") as (type: string, listener: () => void) => void,
                        removeEventListener: eval("((type, listener) => { counts.remove++; })") as (type: string, listener: () => void) => void,
                    };
                    const session = new FakeArcadeSession();
                    const display = new ArcadeDisplay({ canvas, container, resizeObserver: Observer, document: fakeDocument });
                    display.attach(session);
                    session.emitFrame({ width: 2, height: 2, rgba: new Uint8ClampedArray([255, 0, 0, 255, ...new Array(12).fill(0)]) });
                    display.destroy();
                    display.destroy();
                    session.emitFrame({ width: 1, height: 1, rgba: new Uint8ClampedArray([0, 255, 0, 255]) });
                    const pixel = Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data);
                    return { counts, width: canvas.width, height: canvas.height, pixel };
                }), P.equals({ counts: { observe: 1, disconnect: 1, add: 1, remove: 1 }, width: 2, height: 2, pixel: [0, 0, 0, 0] }))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
