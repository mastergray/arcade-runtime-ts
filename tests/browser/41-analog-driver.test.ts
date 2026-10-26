// realizes: docs/arcade-runtime-spec.md > §10.3 and §12 M32 production acceptance

// Dependencies:
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";
import { startHarnessServer } from "../../scripts/serve-harness.ts";

// Type dependencies:
import type { Server } from "node:http";
import type { TestFile } from "../run.ts";

interface AnalogVerdict {
    readonly declared: boolean;
    readonly slowPositive: boolean;
    readonly liveSlopeChanged: boolean;
    readonly invertChangedSign: boolean;
}

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;
const TIMEOUT = 300_000;

const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((closed) => server.close(() => closed()));
};

const withHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    if (CONFIG_ARGUMENT === undefined) throw new Error("ARCADE_PRELOAD_CONFIG is required");
    const harness = await startHarnessServer({
        port: 0,
        buildRoot: resolve(WORKSPACE, "dist", "mame"),
        preload: resolve(CONFIG_ARGUMENT),
    });
    try { return await run(harness.url); }
    finally { await closeServer(harness.server); }
};

const exerciseAnalogDriver = async (): Promise<AnalogVerdict> => {
    const modulePath = "/src/index.js";
    const runtime = await import(modulePath) as typeof import("../../src/index.ts");
    const preload = await (await fetch("/preload.json")).json() as {
        family: string;
        machine: string;
        bios?: string;
        romUrls: string[];
    };
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    container.style.width = "640px";
    container.style.height = "480px";
    container.append(canvas);
    document.body.append(container);
    const cabinet = await runtime.ArcadeCabinet.init({
        canvas,
        container,
        game: {
            machine: preload.machine,
            machineHints: { players: 2, buttons: 6 },
            roms: preload.romUrls,
            ...(preload.bios === undefined ? {} : { bios: preload.bios }),
        },
        adapterConfig: { buildUrl: `/mame/${preload.family}/` },
        controls: {
            analog: {},
            keyboard: { map: {
                KeyQ: { kind: "stick", player: 1, stick: 1, direction: "right" },
                KeyE: { kind: "stick", player: 1, stick: 1, direction: "down" },
            } },
        },
    });
    await cabinet.start();
    const row = cabinet.player.machine.inputs.analog.find((candidate) => candidate.player === 1
        && ["stick-x", "stick-y", "paddle", "paddle-v", "positional", "positional-v"].includes(candidate.kind));
    if (row === undefined) {
        await cabinet.destroy();
        return { declared: false, slowPositive: false, liveSlopeChanged: false, invertChangedSign: false };
    }
    const vertical = row.kind === "stick-y" || row.kind === "paddle-v" || row.kind === "positional-v";
    const axisKind = vertical ? "stick-y" : "stick-x";
    const code = vertical ? "KeyE" : "KeyQ";
    const settingsKey = `p1:${row.kind}` as const;
    const frames = (count: number): Promise<void> => new Promise((done) => {
        const next = (): void => { if (--count <= 0) done(); else requestAnimationFrame(next); };
        requestAnimationFrame(next);
    });
    const key = (pressed: boolean): void => { window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true })); };
    const axisValue = (): number => cabinet.player.input.axes.find((entry) => entry.axis.player === 1 && entry.axis.kind === axisKind)?.value ?? 0;
    const measure = async (keySpeed: number, invert: boolean): Promise<number> => {
        cabinet.setAnalogSettings({ [settingsKey]: { keySpeed, centreSpeed: 1, invert } });
        key(false);
        await frames(2);
        cabinet.setAnalogSettings({ [settingsKey]: { keySpeed, centreSpeed: 0, invert } });
        key(true);
        await frames(6);
        const value = axisValue();
        key(false);
        return value;
    };
    const slow = await measure(0.01, false);
    const fast = await measure(0.06, false);
    const inverted = await measure(0.06, true);
    await cabinet.destroy();
    return {
        declared: true,
        slowPositive: slow > 0,
        liveSlopeChanged: fast > slow * 2,
        invertChangedSign: inverted < 0 && Math.abs(inverted) >= Math.abs(fast) * 0.8,
    };
};

const testFile: TestFile = {
    label: "AnalogDriver production surface",
    skip: CONFIG_ARGUMENT === undefined ? "set ARCADE_PRELOAD_CONFIG to an ignored preload config for a built family with a declared paddle or stick" : undefined,
    cases: [{
        label: "a declared absolute port changes slope on a live update and changes sign when inverted",
        run: () => withHarness((url) => CTGBrowserTest.init("analogue live settings")
            .interact("start and measure three keyboard ramps", async ({ page }) => {
                await page.evaluate("globalThis.__name = (value) => value");   // tsx wraps nested functions in a __name helper the page lacks
                const verdict = await page.evaluate(exerciseAnalogDriver);
                await page.evaluate((result) => { (window as unknown as { analogVerdict: AnalogVerdict }).analogVerdict = result; }, verdict);
            })
            .assertPage("the production cabinet exposes the live driver result", (page) => page.evaluate(() =>
                (window as unknown as { analogVerdict: AnalogVerdict }).analogVerdict), P.equals<AnalogVerdict>({
                    declared: true,
                    slowPositive: true,
                    liveSlopeChanged: true,
                    invertChangedSign: true,
                }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    }],
};

export default testFile;
