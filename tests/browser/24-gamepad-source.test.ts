// realizes: docs/arcade-runtime-spec.md > §10.4 GamepadSource (Chromium init wiring with no physical gamepads)

// Dependencies:
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline and predicates
import { withTestPage as withSharedTestPage } from "../support/TestPageServer.ts";   // Shared page server with runtime-module transpilation

// Type dependencies:
import type ArcadeInput from "../../src/ArcadeInput/ArcadeInput.ts";   // Instance retained in page scratch
import type GamepadSource from "../../src/GamepadSource/GamepadSource.ts";   // Instance retained in page scratch
import type { GamepadLike } from "../../src/GamepadSource/types.ts";   // Scripted navigator snapshot
import type FakeArcadeSession from "../support/FakeArcadeSession.ts";   // Required W0 double loaded in-page
import type { TestFile } from "../run.ts";                         // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: constructors loaded by the test-local browser page
interface BrowserRuntime {
    ArcadeInput: typeof ArcadeInput;                               // Production input class
    GamepadSource: typeof GamepadSource;                           // Production gamepad source class
    FakeArcadeSession: typeof FakeArcadeSession;                   // W0 recording session
}

// INTERFACE :: values retained on the page between pipeline stages
interface BrowserScratch {
    readonly source: GamepadSource;                               // Attached source under test
    readonly input: ArcadeInput;                                  // Input receiving pad controls
    readonly session: FakeArcadeSession;                          // Recording session under the input
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
  <script type="module">
    import ArcadeInput from "/src/ArcadeInput/ArcadeInput.js";
    import GamepadSource from "/src/GamepadSource/GamepadSource.js";
    import FakeArcadeSession from "/tests/support/FakeArcadeSession.js";
    window.gamepadRuntime = { ArcadeInput, GamepadSource, FakeArcadeSession };
  </script>
</body>
</html>`;                                                         // Page built for this test; Chromium supplies the actual browser defaults

/**
 *
 * Functions
 *
 */

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against a fresh shared test page.
const withTestPage = <T>(run: (url: string) => Promise<T>): Promise<T> => withSharedTestPage(PAGE, run);

// HELPER :: VOID -> VOID
// Uses init() without browser dependencies, proving navigator, rAF, window and document are supplied there.
const setupNativeSource = (): void => {
    const runtime = (window as unknown as { gamepadRuntime: BrowserRuntime }).gamepadRuntime;
    const session = new runtime.FakeArcadeSession();
    const input = new runtime.ArcadeInput({ session });
    const source = runtime.GamepadSource.init({ input });
    source.attach();
    (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch = { source, input, session };
};

// HELPER :: VOID -> VOID
// Replaces only navigator.getGamepads with a mutable standard-pad script, then uses every other init() browser default.
const setupScriptedNavigatorSource = (): void => {
    const buttons: Array<{ pressed: boolean; value: number }> = [];
    for (let index = 0; index < 16; index++) {
        const pressed = index === 0 || index === 12;
        buttons.push({ pressed, value: pressed ? 1 : 0 });
    }
    const scripted: { pads: ReadonlyArray<GamepadLike | null> } = {
        pads: [{ id: "scripted browser pad", index: 0, connected: true, mapping: "standard", buttons, axes: [0, 0] }],
    };
    (window as unknown as { scriptedGamepads: typeof scripted }).scriptedGamepads = scripted;
    Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: new Function("return window.scriptedGamepads.pads"),
    });
    const runtime = (window as unknown as { gamepadRuntime: BrowserRuntime }).gamepadRuntime;
    const session = new runtime.FakeArcadeSession();
    const input = new runtime.ArcadeInput({ session });
    const source = runtime.GamepadSource.init({ input });
    source.attach();
    (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch = { source, input, session };
};

const testFile: TestFile = {
    label: "GamepadSource browser behavior",
    cases: [
        {
            label: "init wires the real Chromium navigator and animation scheduler when no physical pads are present",
            run: () => withTestPage((url) => CTGBrowserTest.init("native empty gamepad provider")
                .interact("construct from browser defaults and allow polling", async ({ page }) => {
                    await page.evaluate(setupNativeSource);
                    await page.waitForTimeout(50);
                })
                .assertPage("Chromium exposes no connected physical pad and the source remains attached", (page) => page.evaluate(() => {
                    let connected = 0;
                    for (const candidate of navigator.getGamepads()) if (candidate !== null) connected++;
                    const scratch = (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch;
                    return {
                        hasProvider: typeof navigator.getGamepads === "function",
                        connected,
                        players: scratch.source.players,
                        snapshot: scratch.input.snapshot,
                        attached: scratch.source.isAttached,
                    };
                }), P.equals<unknown>({
                    hasProvider: true,
                    connected: 0,
                    players: [],
                    snapshot: [],
                    attached: true,
                }))
                .start(url, { timeout: TIMEOUT })),
        },
        {
            label: "init calls a scripted navigator.getGamepads provider and reconciles its disconnect on real animation frames",
            run: () => withTestPage((url) => CTGBrowserTest.init("scripted browser gamepad provider")
                .interact("install the provider, construct from init defaults and allow polling", async ({ page }) => {
                    await page.evaluate(setupScriptedNavigatorSource);
                    await page.waitForTimeout(50);
                })
                .assertPage("the scripted d-pad and face button drive player 1", (page) => page.evaluate(() => ({
                    players: (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch.source.players,
                    snapshot: (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch.input.snapshot,
                })), P.equals<unknown>({
                    players: [{ player: 1, id: "scripted browser pad" }],
                    snapshot: [
                        { kind: "button", player: 1, button: 1 },
                        { kind: "direction", player: 1, direction: "up" },
                    ],
                }))
                .interact("drop the scripted connected pad and allow another poll", async ({ page }) => {
                    await page.evaluate(() => {
                        (window as unknown as { scriptedGamepads: { pads: ReadonlyArray<GamepadLike | null> } }).scriptedGamepads.pads = [];
                    });
                    await page.waitForTimeout(50);
                })
                .assertPage("disconnect releases the channel and frees its player slot", (page) => page.evaluate(() => ({
                    players: (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch.source.players,
                    snapshot: (window as unknown as { gamepadScratch: BrowserScratch }).gamepadScratch.input.snapshot,
                })), P.equals<unknown>({ players: [], snapshot: [] }))
                .start(url, { timeout: TIMEOUT })),
        },
    ],
};

export default testFile;
