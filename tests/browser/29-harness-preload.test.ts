// realizes: docs/arcade-runtime-spec.md > §11 Developer harness and §11.1 Preload config (browser acceptance)

// Dependencies:
import { randomBytes } from "node:crypto";                         // Creates non-ROM synthetic archive content
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";   // Builds disposable preload and romsets trees
import { tmpdir } from "node:os";                                  // Parent for disposable browser inputs
import { dirname, join, resolve } from "node:path";                // Resolves the worktree and config-relative test paths
import { fileURLToPath } from "node:url";                          // Locates the production family build without recording it
import CTGBrowserTest, { CTGTestPredicates as P } from "ctg-js-browser-test";   // Chromium pipeline
import { zipSync } from "fflate";                                  // Creates a synthetic zip consumed by the real audit
import { startHarnessServer } from "../../scripts/serve-harness.ts";   // Production harness server under test

// Type dependencies:
import type { Server } from "node:http";                           // Listener cleanup boundary
import type { RomSetMetadata } from "../../src/index.ts";         // Synthetic metadata must match the public format
import type { TestCase, TestFile } from "../run.ts";               // Test manifest shapes

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: privacy-safe observation of the synthetic preload page
interface SyntheticResult {
    readonly familySelected: boolean;
    readonly machineFilled: boolean;
    readonly biosEmpty: boolean;
    readonly auditStatus: string | undefined;
    readonly auditRendered: boolean;
    readonly startEnabled: boolean;
    readonly sanitized: boolean;
    readonly listedFile: boolean;
    readonly unlistedFileStatus: number;
    readonly resStatus: number;
    readonly wasmType: string | null;
}

// INTERFACE :: privacy-safe observation of a started production build
interface ProductionResult {
    readonly running: boolean;
    readonly firstFrame: boolean;
    readonly keyboardAttached: boolean;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Resolved only at run time
const CONFIG_ARGUMENT = process.env.ARCADE_PRELOAD_CONFIG;         // Sole route to ignored private inputs
const TIMEOUT = 90_000;

/**
 *
 * Functions
 *
 */

// HELPER :: UINT8ARRAY -> STRING
// Computes the canonical CRC32 text required by synthetic romsets metadata.
const crc32 = (bytes: Uint8Array): string => {
    let crc = 0xffff_ffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
    return ((crc ^ 0xffff_ffff) >>> 0).toString(16).padStart(8, "0");
};

// HELPER :: server -> PROMISE(VOID)
// Drops browser keep-alive connections before awaiting listener close.
const closeServer = async (server: Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Builds a complete synthetic family/preload tree, runs the real server and always removes both.
const withSyntheticHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-harness-browser-"));
    let server: Server | undefined;
    try {
        const family = "example-family";
        const machine = "example_machine";
        const archiveName = "example_machine.zip";
        const entryName = "example_program.bin";
        const entry = new Uint8Array(randomBytes(32));
        const archive = zipSync({ [entryName]: entry }, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
        const buildRoot = join(directory, "builds");
        const buildDirectory = join(buildRoot, family);
        const inputDirectory = join(directory, "inputs");
        mkdirSync(join(buildDirectory, "romsets"), { recursive: true });
        mkdirSync(inputDirectory);

        writeFileSync(join(inputDirectory, archiveName), archive);
        writeFileSync(join(inputDirectory, "unlisted.zip"), new Uint8Array([1, 2, 3]));
        writeFileSync(join(buildDirectory, "build.json"), `${JSON.stringify({
            formatVersion: 1,
            buildId: "0".repeat(64),
            adapter: "mame",
            engine: family,
            emulatorVersion: "mame0161",
            emsdkVersion: "1.38.31",
            machines: [machine],
            artifacts: ["mameexample-family.js", "mameexample-family.wasm"],
            romsetsUrl: "romsets/",
            memoryPages: 4096,
            licenses: [],
            pthreads: false,
        }, null, 2)}\n`);
        writeFileSync(join(buildDirectory, "mameexample-family.wasm"), new Uint8Array([0, 97, 115, 109]));
        const metadata: RomSetMetadata = {
            machine,
            family,
            description: "Synthetic example machine",
            cloneof: null,
            romof: null,
            bios: [],
            sampleof: null,
            archives: [{ name: archiveName, role: "game" }],
            roms: [{ name: entryName, size: entry.length, crc: crc32(entry), sha1: null, archive: archiveName, optional: false }],
            samples: [],
        };
        writeFileSync(join(buildDirectory, "romsets", `${machine}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
        const configPath = join(directory, "preload.json");
        writeFileSync(configPath, `${JSON.stringify({ family, machine, roms: [`inputs/${archiveName}`], autostart: false }, null, 2)}\n`);

        const harness = await startHarnessServer({ port: 0, buildRoot, preload: configPath });
        server = harness.server;
        return await run(harness.url);
    } finally {
        if (server !== undefined) await closeServer(server);
        rmSync(directory, { recursive: true, force: true });
    }
};

// HELPER :: (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs the same page and server against the environment-gated production build and private preload config.
const withProductionHarness = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
    if (CONFIG_ARGUMENT === undefined) throw new Error("production preload config is unavailable");
    const harness = await startHarnessServer({
        port: 0,
        buildRoot: resolve(WORKSPACE, "dist", "mame"),
        preload: CONFIG_ARGUMENT,
    });
    try {
        return await run(harness.url);
    } finally {
        await closeServer(harness.server);
    }
};

const cases: TestCase[] = [
    {
        label: "a synthetic preload is sanitized, audited and rendered without exposing unlisted files",
        run: () => withSyntheticHarness((url) => CTGBrowserTest.init("harness synthetic preload")
            .interact("wait for the real page audit", async ({ page }) => {
                await page.waitForFunction(() => document.querySelector<HTMLElement>("#audit")?.dataset.status === "ok");
            })
            .assertPage("page controls, audit and HTTP allowlist are complete", (page) => page.evaluate(async (): Promise<SyntheticResult> => {
                const family = document.querySelector<HTMLSelectElement>("#family");
                const machine = document.querySelector<HTMLInputElement>("#machine");
                const bios = document.querySelector<HTMLInputElement>("#bios");
                const audit = document.querySelector<HTMLElement>("#audit");
                const start = document.querySelector<HTMLButtonElement>("#start");
                const config = await fetch("/preload.json").then((response) => response.json()) as {
                    roms: string[];
                    romUrls: string[];
                };
                const [listed, unlisted, res, wasm] = await Promise.all([
                    fetch(config.romUrls[0]!),
                    fetch("/preload/unlisted.zip"),
                    fetch("/res/"),
                    fetch("/mame/example-family/mameexample-family.wasm"),
                ]);
                return {
                    familySelected: family?.value === "example-family",
                    machineFilled: machine?.value === "example_machine",
                    biosEmpty: bios?.value === "",
                    auditStatus: audit?.dataset.status,
                    auditRendered: audit?.textContent?.includes("Audit: ok") === true && audit.textContent.includes("example_program.bin"),
                    startEnabled: start?.disabled === false,
                    sanitized: config.roms.length === 1 && config.roms[0] === "example_machine.zip"
                        && config.romUrls[0] === "/preload/example_machine.zip",
                    listedFile: listed.ok && (await listed.arrayBuffer()).byteLength > 0,
                    unlistedFileStatus: unlisted.status,
                    resStatus: res.status,
                    wasmType: wasm.headers.get("content-type"),
                };
            }), P.equals<SyntheticResult>({
                familySelected: true,
                machineFilled: true,
                biosEmpty: true,
                auditStatus: "ok",
                auditRendered: true,
                startEnabled: true,
                sanitized: true,
                listedFile: true,
                unlistedFileStatus: 404,
                resStatus: 404,
                wasmType: "application/wasm",
            }))
            .start(url, { headless: true, timeout: TIMEOUT })),
    },
];

if (CONFIG_ARGUMENT !== undefined) cases.push({
    label: "the environment-gated production preload starts a real machine and renders its first frame",
    run: () => withProductionHarness((url) => CTGBrowserTest.init("harness production preload")
        .interact("wait for audit, provide the one gesture and wait for a frame", async ({ page }) => {
            await page.waitForFunction(() => document.querySelector<HTMLElement>("#status")?.dataset.state === "ready");
            await page.locator("#start").click();
            await page.waitForFunction(() => {
                const status = document.querySelector<HTMLElement>("#status");
                const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
                return status?.dataset.state === "running" && (canvas?.width ?? 0) > 0 && (canvas?.height ?? 0) > 0;
            });
        })
        .assertPage("the page is running with keyboard input and a real frame", (page) => page.evaluate((): ProductionResult => {
            const status = document.querySelector<HTMLElement>("#status");
            const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
            return {
                running: status?.dataset.state === "running",
                firstFrame: (canvas?.width ?? 0) > 0 && (canvas?.height ?? 0) > 0,
                keyboardAttached: status?.textContent?.includes("Keyboard controls are attached") === true,
            };
        }), P.equals<ProductionResult>({ running: true, firstFrame: true, keyboardAttached: true }))
        .start(url, { headless: true, timeout: TIMEOUT })),
});

const testFile: TestFile = {
    label: "developer harness preload page",
    cases,
};

export default testFile;
