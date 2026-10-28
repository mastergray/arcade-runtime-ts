// realizes: docs/arcade-runtime-spec.md > §11.1 Preload config (validation, sanitisation and allowlisted serving)

// Dependencies:
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";   // Creates disposable synthetic preload inputs
import { request as httpsRequest } from "node:https";          // Fetches the tls server without trusting its self-signed certificate
import { tmpdir } from "node:os";                                  // Parent for test-only directories
import { join, relative } from "node:path";                        // Builds config-relative paths without recording local roots
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";     // Pipeline API and predicate builders
import {
    isPreloadConfig,                                               // Public structural predicate under test
    loadPages,                                                     // Extra-page allowlist resolver under test
    loadPreloadConfig,                                             // Path resolver and sanitizer under test
    startHarnessServer,                                            // Serves exactly the allowlisted extra pages
} from "../../scripts/serve-harness.ts";

// Type dependencies:
import type { PreloadConfig } from "../../scripts/serve-harness.ts";   // Valid predicate seed
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: path-free view of one resolved preload config
interface SanitizationSnapshot {
    readonly config: ReturnType<typeof loadPreloadConfig>["config"];
    readonly files: ReadonlyArray<{ readonly name: string; readonly relativePath: string; readonly url: string }>;
}

/**
 *
 * Constants
 *
 */

const VALID: PreloadConfig = {
    family: "example-family",
    machine: "example_machine",
    bios: "example-bios",
    roms: ["roms/example_machine.zip"],
    samples: ["samples/example_audio.zip"],
    dipswitches: { Mode: "Example" },
    autostart: true,
};

/**
 *
 * Functions
 *
 */

// HELPER :: VOID -> sanitizationSnapshot
// Resolves nested paths beside the config and returns no absolute path to the assertion.
const sanitizationSnapshot = (): SanitizationSnapshot => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-preload-config-"));
    try {
        mkdirSync(join(directory, "private", "roms"), { recursive: true });
        mkdirSync(join(directory, "private", "samples"), { recursive: true });
        writeFileSync(join(directory, "private", "roms", "Example_Game.ZIP"), new Uint8Array([1, 2, 3]));
        writeFileSync(join(directory, "private", "samples", "example_audio.zip"), new Uint8Array([4, 5]));
        const configPath = join(directory, "private", "preload.json");
        writeFileSync(configPath, JSON.stringify({
            family: "example-family",
            machine: "example_machine",
            roms: ["roms/Example_Game.ZIP"],
            samples: ["samples/example_audio.zip"],
            dipswitches: { Mode: "Example" },
            autostart: false,
        }));
        const loaded = loadPreloadConfig(configPath);
        return {
            config: loaded.config,
            files: loaded.files.map((file) => ({ name: file.name, relativePath: relative(directory, file.path), url: file.url })),
        };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
};

// HELPER :: VOID -> STRING
// Returns the duplicate-basename startup failure without retaining local paths.
const duplicateMessage = (): string => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-preload-duplicate-"));
    try {
        mkdirSync(join(directory, "one"));
        mkdirSync(join(directory, "two"));
        writeFileSync(join(directory, "one", "same.zip"), new Uint8Array());
        writeFileSync(join(directory, "two", "SAME.ZIP"), new Uint8Array());
        const configPath = join(directory, "preload.json");
        writeFileSync(configPath, JSON.stringify({
            family: "example-family",
            machine: "example_machine",
            roms: ["one/same.zip"],
            samples: ["two/SAME.ZIP"],
        }));
        try { loadPreloadConfig(configPath); }
        catch (error) { return error instanceof Error ? error.message : String(error); }
        return "no error";
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
};

// HELPER :: VOID -> PROMISE(RECORD)
// Serves one explicitly named page and checks that only its route, not its neighbour or a reserved route, is reachable.
const pageServing = async (): Promise<Record<string, unknown>> => {
    const directory = mkdtempSync(join(tmpdir(), "arcade-harness-pages-"));
    try {
        writeFileSync(join(directory, "device-test.html"), "<!doctype html><title>Device Test</title>");
        writeFileSync(join(directory, "neighbour.html"), "<!doctype html><title>neighbour</title>");
        writeFileSync(join(directory, "NEIGHBOUR.html"), "<!doctype html><title>neighbour</title>");
        writeFileSync(join(directory, "mame.html"), "<!doctype html><title>reserved</title>");
        const routes = [...loadPages([join(directory, "device-test.html")]).keys()];
        const failures: string[] = [];
        for (const names of [["neighbour.html", "NEIGHBOUR.html"], ["mame.html"]]) {
            try { loadPages(names.map((name) => join(directory, name))); failures.push("no error"); }
            catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
        }
        const harness = await startHarnessServer({ port: 0, buildRoot: directory, pages: [join(directory, "device-test.html")] });
        try {
            const served = await fetch(new URL("/device-test", harness.url));
            const neighbour = await fetch(new URL("/neighbour", harness.url));
            return { routes, failures, status: served.status, type: served.headers.get("content-type"), body: await served.text(), neighbour: neighbour.status };
        } finally {
            await new Promise<void>((done) => harness.server.close(() => done()));
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
};

const testFile: TestFile = {
    label: "harness preload config",
    cases: [
        {
            label: "--tls serves the same routes over https with a generated self-signed certificate",
            run: () => CTGTest.init("harness tls")
                .stage("start a tls server and fetch over https", async () => {
                    const directory = mkdtempSync(join(tmpdir(), "arcade-harness-tls-"));
                    writeFileSync(join(directory, "builds.json"), JSON.stringify({ families: [] }));
                    const harness = await startHarnessServer({ port: 0, buildRoot: directory, tls: join(directory, "tls") });
                    try {
                        const status = await new Promise<number>((resolveStatus, reject) => {
                            const request = httpsRequest(new URL("/builds.json", harness.url), { rejectUnauthorized: false }, (response) => { response.resume(); resolveStatus(response.statusCode ?? 0); });
                            request.on("error", reject);
                            request.end();
                        });
                        return { scheme: new URL(harness.url).protocol, status, files: readdirSync(join(directory, "tls")).sort() };
                    } finally {
                        harness.server.closeAllConnections();
                        await new Promise<void>((closed) => harness.server.close(() => closed()));
                        rmSync(directory, { recursive: true, force: true });
                    }
                })
                .assert("https answers and the certificate pair was written", (state) => state.subject, P.equals<unknown>({ scheme: "https:", status: 200, files: ["cert.pem", "key.pem"] }))
                .start(undefined),
        },
        {
            label: "isPreloadConfig accepts the complete shape and rejects every invalid required or optional field",
            run: () => CTGTest.init("preload predicate")
                .assert("predicate verdicts", () => ({
                    valid: isPreloadConfig(VALID),
                    null: isPreloadConfig(null),
                    family: isPreloadConfig({ ...VALID, family: "Example Family" }),
                    machine: isPreloadConfig({ ...VALID, machine: "example-machine" }),
                    missingRoms: isPreloadConfig({ ...VALID, roms: undefined }),
                    emptyRoms: isPreloadConfig({ ...VALID, roms: [] }),
                    badRomPath: isPreloadConfig({ ...VALID, roms: [""] }),
                    badSamples: isPreloadConfig({ ...VALID, samples: [1] }),
                    badBios: isPreloadConfig({ ...VALID, bios: " " }),
                    badDipswitches: isPreloadConfig({ ...VALID, dipswitches: { Mode: "" } }),
                    arrayDipswitches: isPreloadConfig({ ...VALID, dipswitches: [] }),
                    badAutostart: isPreloadConfig({ ...VALID, autostart: "yes" }),
                }), P.equals<Record<string, boolean>>({
                    valid: true,
                    null: false,
                    family: false,
                    machine: false,
                    missingRoms: false,
                    emptyRoms: false,
                    badRomPath: false,
                    badSamples: false,
                    badBios: false,
                    badDipswitches: false,
                    arrayDipswitches: false,
                    badAutostart: false,
                }))
                .start(undefined),
        },
        {
            label: "config-relative paths become basenames and encoded /preload URLs with no local root in the browser config",
            run: () => CTGTest.init("preload sanitisation")
                .assert("sanitized mapping", sanitizationSnapshot, P.equals<SanitizationSnapshot>({
                    config: {
                        family: "example-family",
                        machine: "example_machine",
                        roms: ["Example_Game.ZIP"],
                        samples: ["example_audio.zip"],
                        dipswitches: { Mode: "Example" },
                        autostart: false,
                        romUrls: ["/preload/Example_Game.ZIP", "/preload/example_audio.zip"],
                    },
                    files: [
                        { name: "Example_Game.ZIP", relativePath: "private/roms/Example_Game.ZIP", url: "/preload/Example_Game.ZIP" },
                        { name: "example_audio.zip", relativePath: "private/samples/example_audio.zip", url: "/preload/example_audio.zip" },
                    ],
                }))
                .assert("folded duplicate message", duplicateMessage, P.equals("The preload config contains duplicate basename SAME.ZIP after case folding."))
                .start(undefined),
        },
        {
            label: "--page serves exactly the named HTML file at /<name>, rejects reserved and folded-duplicate routes, and serves nothing beside it",
            run: () => CTGTest.init("extra pages")
                .assert("served page", pageServing, P.equals<Record<string, unknown>>({
                    routes: ["/device-test"],
                    failures: ["Page route /NEIGHBOUR is duplicated after case folding.", "Page route /mame is reserved by the harness."],
                    status: 200,
                    type: "text/html; charset=utf-8",
                    body: "<!doctype html><title>Device Test</title>",
                    neighbour: 404,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
