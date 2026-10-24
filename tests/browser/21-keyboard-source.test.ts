// realizes: docs/arcade-runtime-spec.md > §10.3 KeyboardSource (real Chromium keyboard, blur and visibility cases)

// Dependencies:
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline and predicates
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Shared page server with runtime-dependency resolution

// Type dependencies:
import type ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";   // Instance retained in page scratch
import type KeyboardSource from "../../src/KeyboardSource/KeyboardSource.ts";   // Instance retained in page scratch
import type { DEFAULT_KEYBOARD_MAP } from "../../src/KeyboardSource/KeyboardSource.ts";   // Runtime default-map shape
import type FakeArcadeSession from "../support/FakeArcadeSession.ts";   // Required W0 double loaded in-page
import type { TestFile } from "../run.ts";                         // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructors and constant loaded by the test-local browser page
interface BrowserRuntime {
    ArcadeInput: typeof ArcadeInput;                               // Production input class
    KeyboardSource: typeof KeyboardSource;                         // Production keyboard source class
    DEFAULT_KEYBOARD_MAP: typeof DEFAULT_KEYBOARD_MAP;             // Production frozen default map
    FakeArcadeSession: typeof FakeArcadeSession;                   // W0 recording session
}

// INTERFACE :: values retained on the page between pipeline stages
interface BrowserScratch {
    source: KeyboardSource;                                       // Attached source under test
    input: ArcadeInput;                                           // Input receiving mapped events
    session: FakeArcadeSession;                                   // Recording session under the input
}

// INTERFACE :: {method:STRING,args:[UNKNOWN]}
// Plain JSON view of one recorded session call.
interface CallSnapshot {
    readonly method: string;
    readonly args: ReadonlyArray<unknown>;
}

/**
 *
 * Constants
 *
 */

const TIMEOUT = 30_000;                                           // Per-case browser pipeline timeout
const PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <button id="focus">Keyboard focus</button>
  <script type="module">
    import ArcadeInput from "/src/ArcadeInput/ArcadeInput.js";
    import KeyboardSource, { DEFAULT_KEYBOARD_MAP } from "/src/KeyboardSource/KeyboardSource.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";
    window.keyboardRuntime = { ArcadeInput, KeyboardSource, DEFAULT_KEYBOARD_MAP, FakeArcadeSession };
  </script>
</body>
</html>`;                                                         // Page built in this test; no shared harness or emulator artifact

/**
 *
 * Functions
 *
 */

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against a fresh page server for this file's PAGE.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

// HELPER :: VOID -> VOID
// In-page setup using init() with no targets, proving it supplies window and document.
// NOTE: Serialized by Playwright and run in the page; it can reference only page globals.
const setupDefaultSource = (): void => {
    const runtime = (window as unknown as { keyboardRuntime: BrowserRuntime }).keyboardRuntime;
    const session = new runtime.FakeArcadeSession();
    const input = new runtime.ArcadeInput({ session });
    const source = runtime.KeyboardSource.init({ input, map: runtime.DEFAULT_KEYBOARD_MAP });
    source.attach();
    const scratch: BrowserScratch = { source, input, session };
    (window as unknown as { keyboardScratch: BrowserScratch }).keyboardScratch = scratch;
    (globalThis as unknown as { browserScratch: () => BrowserScratch }).browserScratch = () => scratch;
    (globalThis as unknown as { callSnapshots: () => CallSnapshot[] }).callSnapshots = () =>
        scratch.session.calls.map((call) => ({ method: call.method, args: [...call.args] }));
};

// HELPER :: VOID -> browserScratch
// Reads the in-page scratch values.
const browserScratch = (): BrowserScratch => (window as unknown as { keyboardScratch: BrowserScratch }).keyboardScratch;

// HELPER :: VOID -> [callSnapshot]
// Returns a plain-data view of recorded session calls in the page.
const callSnapshots = (): CallSnapshot[] => browserScratch().session.calls.map((call) => ({ method: call.method, args: [...call.args] }));

const testFile: TestFile = {
    label: "KeyboardSource browser behavior",
    cases: [
        {
            label: "init defaults to window and real Playwright key down/up map through DEFAULT_KEYBOARD_MAP",
            run: () => withTestPage((url) => CTGBrowserTest.init("real keyboard events")
                .interact("construct with browser defaults, focus and press ArrowUp", async ({ page }) => {
                    await page.evaluate(setupDefaultSource);
                    await page.click("#focus");
                    await page.keyboard.down("ArrowUp");
                    await page.keyboard.up("ArrowUp");
                })
                .assertPage("session saw the mapped P1 direction pair", (page) => page.evaluate(() => ({
                    calls: callSnapshots(),
                    snapshot: browserScratch().input.snapshot,
                    attached: browserScratch().source.isAttached,
                })), P.equals<unknown>({
                    calls: [
                        { method: "setControl", args: [{ kind: "direction", player: 1, direction: "up" }, true] },
                        { method: "setControl", args: [{ kind: "direction", player: 1, direction: "up" }, false] },
                    ],
                    snapshot: [],
                    attached: true,
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "real KeyboardEvents ignore repeat and unmapped codes and honor both preventDefault settings",
            run: () => withTestPage((url) => CTGBrowserTest.init("browser repeat and prevention")
                .interact("construct with browser defaults", async ({ page }) => { await page.evaluate(setupDefaultSource); })
                .assertPage("default source handles only mapped non-repeat events", (page) => page.evaluate(() => {
                    const repeat = new KeyboardEvent("keydown", { code: "KeyA", repeat: true, cancelable: true });
                    const unmapped = new KeyboardEvent("keydown", { code: "KeyB", cancelable: true });
                    const mapped = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
                    window.dispatchEvent(repeat);
                    window.dispatchEvent(unmapped);
                    window.dispatchEvent(mapped);
                    return {
                        prevented: { repeat: repeat.defaultPrevented, unmapped: unmapped.defaultPrevented, mapped: mapped.defaultPrevented },
                        calls: callSnapshots(),
                    };
                }), P.equals<unknown>({
                    prevented: { repeat: false, unmapped: false, mapped: true },
                    calls: [{ method: "setControl", args: [{ kind: "button", player: 1, button: 3 }, true] }],
                }))
                .assertPage("preventDefault false still forwards without suppression", (page) => page.evaluate(() => {
                    const runtime = (window as unknown as { keyboardRuntime: BrowserRuntime }).keyboardRuntime;
                    browserScratch().source.destroy();
                    browserScratch().session.calls.length = 0;
                    const source = runtime.KeyboardSource.init({
                        input: browserScratch().input,
                        map: runtime.DEFAULT_KEYBOARD_MAP,
                        preventDefault: false,
                    });
                    source.attach();
                    const event = new KeyboardEvent("keydown", { code: "F2", cancelable: true });
                    window.dispatchEvent(event);
                    return { prevented: event.defaultPrevented, calls: callSnapshots() };
                }), P.equals<unknown>({
                    prevented: false,
                    calls: [
                        { method: "setControl", args: [{ kind: "test" }, true] },
                        { method: "setControl", args: [{ kind: "key", key: "F2" }, true] },   // W29 pass-through rides beside the map
                    ],
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "window blur and hidden document visibilitychange release the source's real browser holds",
            run: () => withTestPage((url) => CTGBrowserTest.init("browser focus loss")
                .interact("construct with browser defaults", async ({ page }) => { await page.evaluate(setupDefaultSource); })
                .assertPage("blur releases all held controls in canonical order", (page) => page.evaluate(() => {
                    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", cancelable: true }));
                    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", cancelable: true }));
                    window.dispatchEvent(new Event("blur"));
                    return { calls: callSnapshots(), snapshot: browserScratch().input.snapshot };
                }), P.equals<unknown>({
                    calls: [
                        { method: "setControl", args: [{ kind: "direction", player: 1, direction: "left" }, true] },
                        { method: "setControl", args: [{ kind: "button", player: 1, button: 3 }, true] },
                        { method: "setControl", args: [{ kind: "button", player: 1, button: 3 }, false] },
                        { method: "setControl", args: [{ kind: "direction", player: 1, direction: "left" }, false] },
                    ],
                    snapshot: [],
                }))
                .assertPage("visibilitychange releases only after document becomes hidden", (page) => page.evaluate(() => {
                    browserScratch().session.calls.length = 0;
                    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", cancelable: true }));
                    document.dispatchEvent(new Event("visibilitychange"));
                    const whileVisible = browserScratch().input.snapshot;
                    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
                    document.dispatchEvent(new Event("visibilitychange"));
                    return { whileVisible, final: browserScratch().input.snapshot, calls: callSnapshots() };
                }), P.equals<unknown>({
                    whileVisible: [{ kind: "button", player: 2, button: 1 }],
                    final: [],
                    calls: [
                        { method: "setControl", args: [{ kind: "button", player: 2, button: 1 }, true] },
                        { method: "setControl", args: [{ kind: "button", player: 2, button: 1 }, false] },
                    ],
                }))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
