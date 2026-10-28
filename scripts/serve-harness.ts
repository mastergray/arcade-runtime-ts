#!/usr/bin/env -S node --import tsx

// realizes: docs/arcade-runtime-spec.md > §11 Developer harness and §11.1 Preload config

// Dependencies:
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";   // Loads and validates the explicitly named preload files; writes the --tls certificate
import { readFile, readdir, realpath, stat } from "node:fs/promises";   // Serves harness, source, UI and family-build resources
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";   // Loopback development server
import { createServer as createTlsServer } from "node:https";   // --tls: a secure context for phones on the LAN (Web Crypto needs one)
import { networkInterfaces } from "node:os";                   // LAN addresses for the self-signed certificate
import { spawnSync } from "node:child_process";                // openssl generates the development certificate once
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";   // Resolves and confines served paths
import { fileURLToPath, pathToFileURL } from "node:url";           // Locates repository resources and detects command execution
import ts from "typescript";                                       // Transpiles the consumer page and library source in memory

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: local preload choices and config-relative archive paths
// This file is private developer input; only SanitizedPreloadConfig crosses the HTTP boundary.
export interface PreloadConfig {
    readonly family: string;                                       // Family build directory under the configured build root
    readonly machine: string;                                      // MAME short name
    readonly bios?: string;                                        // Optional MAME -bios choice
    readonly roms: ReadonlyArray<string>;                          // Game, parent and BIOS zip paths relative to this config
    readonly samples?: ReadonlyArray<string>;                      // Optional sample-set zip paths relative to this config
    readonly dipswitches?: Readonly<Record<string, string>>;       // Optional port name to setting name map
    readonly autostart?: boolean;                                  // Wait for one page gesture, then start
}

// INTERFACE :: privacy-safe config served at /preload.json
// Local paths have become basenames, and romUrls is the complete ordered URL list consumed by ArcadePlayer.
export interface SanitizedPreloadConfig {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
    readonly roms: ReadonlyArray<string>;
    readonly samples?: ReadonlyArray<string>;
    readonly dipswitches?: Readonly<Record<string, string>>;
    readonly autostart?: boolean;
    readonly romUrls: ReadonlyArray<string>;
}

// INTERFACE :: one local file's internal route mapping
export interface ResolvedPreloadFile {
    readonly name: string;                                         // Sanitized basename
    readonly path: string;                                         // Absolute local path, retained only in the server process
    readonly url: string;                                          // Exact URL exposed for this one file
}

// INTERFACE :: validated public config plus its private server-only file map
export interface ResolvedPreloadConfig {
    readonly config: SanitizedPreloadConfig;
    readonly files: ReadonlyArray<ResolvedPreloadFile>;
}

// INTERFACE :: arguments accepted by startHarnessServer
export interface HarnessServerConfig {
    readonly host?: string;                                        // Defaults to loopback
    readonly port?: number;                                        // Defaults to 8787; zero requests an ephemeral test port
    readonly buildRoot?: string;                                   // Defaults to dist/mame from the invoking directory
    readonly uiRoot?: string;                                      // Defaults to dist/ui from the invoking directory
    readonly preload?: string;                                     // Optional private preload config
    readonly pages?: ReadonlyArray<string>;                        // Optional extra local HTML pages, served at /<basename without .html>
    readonly tls?: string;                                         // Optional directory holding cert.pem and key.pem; generated with openssl when absent
}

// INTERFACE :: listening server and its browser URL
export interface HarnessServer {
    readonly server: Server;
    readonly url: string;
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "..");   // Repository root; never exposed in a response
const HARNESS_ROOT = resolve(WORKSPACE, "harness");                // Committed consumer page
const SOURCE_ROOT = resolve(WORKSPACE, "src");                    // In-memory-transpiled package source
const FFLATE_FILE = resolve(WORKSPACE, "node_modules/fflate/esm/browser.js");   // Browser ESM dependency
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8_787;
const DEFAULT_BUILD_ROOT = "dist/mame";
const DEFAULT_UI_ROOT = "dist/ui";
const FAMILY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MACHINE_PATTERN = /^[a-z0-9][a-z0-9_]*$/;

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN -> BOOLEAN
// True for a non-empty string with no NUL byte.
const isText = (value: unknown): value is string => typeof value === "string" && /\S/.test(value) && !value.includes("\0");

// HELPER :: UNKNOWN -> BOOLEAN
// True for an array of non-empty local path strings.
const isPathList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

// HELPER :: UNKNOWN -> BOOLEAN
// True for a plain record whose port and setting names are non-empty strings.
const isDipswitches = (value: unknown): value is Readonly<Record<string, string>> => typeof value === "object" && value !== null
    && !Array.isArray(value)
    && Object.entries(value).every(([port, setting]) => isText(port) && isText(setting));

// PREDICATE :: UNKNOWN -> BOOLEAN
// True when value has the complete preload shape and every optional field meets its declared condition.
export function isPreloadConfig(value: unknown): value is PreloadConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as PreloadConfig;
    return typeof config.family === "string" && FAMILY_PATTERN.test(config.family)
        && typeof config.machine === "string" && MACHINE_PATTERN.test(config.machine)
        && isPathList(config.roms) && config.roms.length > 0
        && (config.samples === undefined || isPathList(config.samples))
        && (config.bios === undefined || isText(config.bios))
        && (config.dipswitches === undefined || isDipswitches(config.dipswitches))
        && (config.autostart === undefined || typeof config.autostart === "boolean");
}

// HELPER :: STRING -> STRING
// Maps one archive basename to its only public preload URL.
const preloadUrl = (name: string): string => `/preload/${encodeURIComponent(name)}`;

// Routes the server reserves for itself; an extra page may not shadow any of them.
const RESERVED_PAGE_ROUTES = new Set(["/", "/builds.json", "/preload.json", "/harness.js", "/src", "/mame", "/preload", "/ui", "/-"]);

// PUBLIC :: [STRING] -> MAP(STRING, STRING)
// Resolves each explicitly named local HTML page to its one public route, /<basename without extension>. Only these
// files are reachable; the directory holding them is never listed or served, and folded route collisions are rejected.
export const loadPages = (arguments_: ReadonlyArray<string>): Map<string, string> => {
    const routes = new Map<string, string>();
    const folded = new Set<string>();
    for (const argument of arguments_) {
        if (!isText(argument)) throw new Error("--page requires a file path.");
        const path = resolve(argument);
        if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Page ${basename(path)} is not a readable file.`);
        const extension = extname(path);
        if (![".html", ".htm"].includes(extension.toLowerCase())) throw new Error(`Page ${basename(path)} is not an HTML file.`);
        const name = basename(path, extension);
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`Page name ${name} must use letters, digits, dot, underscore or hyphen.`);
        const route = `/${name}`;
        if (RESERVED_PAGE_ROUTES.has(route)) throw new Error(`Page route ${route} is reserved by the harness.`);
        const key = route.toLowerCase();
        if (folded.has(key)) throw new Error(`Page route ${route} is duplicated after case folding.`);
        folded.add(key);
        routes.set(route, path);
    }
    return routes;
};

// PUBLIC :: STRING -> resolvedPreloadConfig
// Parses one explicit config, resolves its paths relative to that file, rejects folded basename collisions,
// and returns a path-free config for the browser plus the exact allowlisted file routes for the server.
export const loadPreloadConfig = (argument: string): ResolvedPreloadConfig => {
    if (!isText(argument)) throw new Error("--preload requires a config path.");
    const configPath = resolve(argument);
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
        throw new Error("The preload config could not be read as JSON.");
    }
    if (!isPreloadConfig(parsed)) throw new Error("The preload config is invalid.");

    const directory = dirname(configPath);
    const paths = [...parsed.roms, ...(parsed.samples ?? [])];
    const files = paths.map((path): ResolvedPreloadFile => {
        const resolvedPath = resolve(directory, path);
        const name = basename(resolvedPath);
        if (!/\.zip$/i.test(name)) throw new Error("Every preload file must be a zip archive.");
        return { name, path: resolvedPath, url: preloadUrl(name) };
    });
    const seen = new Set<string>();
    for (const file of files) {
        const folded = file.name.toLowerCase();
        if (seen.has(folded)) throw new Error(`The preload config contains duplicate basename ${file.name} after case folding.`);
        seen.add(folded);
        if (!existsSync(file.path) || !statSync(file.path).isFile()) throw new Error(`The configured preload file ${file.name} is unavailable.`);
    }

    const romNames = files.slice(0, parsed.roms.length).map((file) => file.name);
    const sampleNames = files.slice(parsed.roms.length).map((file) => file.name);
    const config: SanitizedPreloadConfig = {
        family: parsed.family,
        machine: parsed.machine,
        ...(parsed.bios === undefined ? {} : { bios: parsed.bios }),
        roms: romNames,
        ...(parsed.samples === undefined ? {} : { samples: sampleNames }),
        ...(parsed.dipswitches === undefined ? {} : { dipswitches: { ...parsed.dipswitches } }),
        ...(parsed.autostart === undefined ? {} : { autostart: parsed.autostart }),
        romUrls: files.map((file) => file.url),
    };
    return { config, files };
};

// HELPER :: STRING, STRING -> BOOLEAN
// True when candidate is root itself or a lexical/real descendant, never a sibling reached through "..".
const isWithin = (root: string, candidate: string): boolean => {
    const path = relative(root, candidate);
    return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};

// HELPER :: STRING, STRING -> PROMISE(STRING?)
// Resolves an existing regular file beneath root and rejects both traversal and escaping symlinks.
const confinedFile = async (root: string, requested: string): Promise<string | null> => {
    const candidate = resolve(root, requested);
    if (!isWithin(root, candidate)) return null;
    try {
        const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
        if (!isWithin(realRoot, realCandidate) || !(await stat(realCandidate)).isFile()) return null;
        return realCandidate;
    } catch {
        return null;
    }
};

// HELPER :: STRING -> STRING
// MIME types needed by the harness, package modules and family build artifacts.
const contentTypeFor = (path: string): string => {
    switch (extname(path).toLowerCase()) {
        case ".html": return "text/html; charset=utf-8";
        case ".js": return "text/javascript; charset=utf-8";
        case ".css": return "text/css; charset=utf-8";
        case ".map": return "application/json; charset=utf-8";
        case ".json": return "application/json; charset=utf-8";
        case ".wasm": return "application/wasm";
        case ".zip": return "application/zip";
        case ".txt": case ".md": return "text/plain; charset=utf-8";
        default: return "application/octet-stream";
    }
};

// HELPER :: serverResponse, NUMBER, STRING, STRING, BOOLEAN -> VOID
// Writes a no-store response and omits the body for HEAD.
const send = (response: ServerResponse, status: number, contentType: string, body: string | Uint8Array, head: boolean): void => {
    response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
    response.end(head ? undefined : body);
};

// HELPER :: serverResponse, BOOLEAN -> VOID
// Stable response for every route outside the explicit harness/build/preload surface.
const notFound = (response: ServerResponse, head: boolean): void => send(response, 404, "text/plain; charset=utf-8", "not found\n", head);

// HELPER :: STRING -> STRING
// Applies the same browser-dependency mapping as TestPageServer without exposing a second filesystem route.
const rewriteBareImports = (javascript: string): string => javascript.replace(/from\s+["']fflate["']/g, "from \"/-/fflate.js\"");

// HELPER :: STRING -> PROMISE(STRING?)
// Transpiles one .js module request from the corresponding repository .ts source.
const transpileSource = async (pathname: string): Promise<string | null> => {
    let sourceFile: string | null = null;
    if (pathname === "/harness.js") sourceFile = await confinedFile(HARNESS_ROOT, "harness.ts");
    else if (pathname.startsWith("/src/") && pathname.endsWith(".js")) {
        let decoded: string;
        try { decoded = decodeURIComponent(pathname.slice("/src/".length)); }
        catch { return null; }
        sourceFile = await confinedFile(SOURCE_ROOT, `${decoded.slice(0, -3)}.ts`);
    }
    if (sourceFile === null) return null;
    const source = await readFile(sourceFile, "utf8");
    return rewriteBareImports(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
        fileName: sourceFile,
    }).outputText);
};

// HELPER :: STRING -> PROMISE([STRING])
// Lists only direct child directories that contain a regular build.json.
const availableBuilds = async (buildRoot: string): Promise<string[]> => {
    try {
        const entries = await readdir(buildRoot, { withFileTypes: true });
        const builds = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
            const build = await confinedFile(buildRoot, `${entry.name}/build.json`);
            return build === null ? null : entry.name;
        }));
        return builds.filter((name): name is string => name !== null).sort((left, right) => left.localeCompare(right));
    } catch {
        return [];
    }
};

// HELPER :: STRING -> STRING
// Formats IPv6 listener addresses without changing ordinary hostnames or IPv4 addresses.
const hostForUrl = (host: string): string => host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

// PUBLIC :: harnessServerConfig -> PROMISE(harnessServer)
// Starts the development server. It exposes repository source only as transpiled modules, the configured build and UI
// roots only beneath their reserved prefixes, and private files only through the exact allowlist derived from --preload.
export const startHarnessServer = async (config: HarnessServerConfig = {}): Promise<HarnessServer> => {
    const host = config.host ?? DEFAULT_HOST;
    const port = config.port ?? DEFAULT_PORT;
    if (!isText(host) || !Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("Harness host or port is invalid.");
    const buildRoot = resolve(config.buildRoot ?? DEFAULT_BUILD_ROOT);
    const uiRoot = resolve(config.uiRoot ?? DEFAULT_UI_ROOT);
    const preload = config.preload === undefined ? null : loadPreloadConfig(config.preload);
    const preloadFiles = new Map(preload?.files.map((file) => [file.url, file.path]));
    const pageFiles = loadPages(config.pages ?? []);

    const handler = (request: IncomingMessage, response: ServerResponse): void => {
        void (async () => {
            const head = request.method === "HEAD";
            if (request.method !== "GET" && !head) {
                response.writeHead(405, { allow: "GET, HEAD", "cache-control": "no-store" }).end();
                return;
            }
            const pathname = new URL(request.url ?? "/", `http://${hostForUrl(host)}`).pathname;
            if (pathname === "/") {
                const file = await confinedFile(HARNESS_ROOT, "index.html");
                if (file === null) { notFound(response, head); return; }
                send(response, 200, contentTypeFor(file), await readFile(file), head);
                return;
            }
            if (pathname === "/builds.json") {
                send(response, 200, "application/json; charset=utf-8", `${JSON.stringify(await availableBuilds(buildRoot))}\n`, head);
                return;
            }
            if (pathname === "/preload.json") {
                if (preload === null) { notFound(response, head); return; }
                send(response, 200, "application/json; charset=utf-8", `${JSON.stringify(preload.config)}\n`, head);
                return;
            }
            if (pathname === "/ui/gallery" || pathname === "/ui/gallery/") {
                const file = await confinedFile(uiRoot, "index.html");
                if (file === null) { notFound(response, head); return; }
                send(response, 200, contentTypeFor(file), await readFile(file), head);
                return;
            }
            if (pathname === "/ui/local" || pathname === "/ui/local/") {
                const file = await confinedFile(uiRoot, "local.html");
                if (file === null) { notFound(response, head); return; }
                send(response, 200, contentTypeFor(file), await readFile(file), head);
                return;
            }
            if (pathname.startsWith("/ui/")) {
                let requested: string;
                try { requested = decodeURIComponent(pathname.slice("/ui/".length)); }
                catch { notFound(response, head); return; }
                if (![".js", ".css", ".html", ".map"].includes(extname(requested).toLowerCase())) { notFound(response, head); return; }
                const file = await confinedFile(uiRoot, requested);
                if (file === null) { notFound(response, head); return; }
                send(response, 200, contentTypeFor(file), await readFile(file), head);
                return;
            }
            const preloadPath = preloadFiles.get(pathname);
            if (preloadPath !== undefined) {
                send(response, 200, contentTypeFor(preloadPath), await readFile(preloadPath), head);
                return;
            }
            const pagePath = pageFiles.get(pathname);
            if (pagePath !== undefined) {
                send(response, 200, contentTypeFor(pagePath), await readFile(pagePath), head);
                return;
            }
            if (pathname === "/-/fflate.js") {
                const file = await confinedFile(dirname(FFLATE_FILE), basename(FFLATE_FILE));
                if (file === null) { notFound(response, head); return; }
                send(response, 200, "text/javascript; charset=utf-8", await readFile(file), head);
                return;
            }
            const javascript = await transpileSource(pathname);
            if (javascript !== null) {
                send(response, 200, "text/javascript; charset=utf-8", javascript, head);
                return;
            }
            if (pathname.startsWith("/mame/")) {
                let requested: string;
                try { requested = decodeURIComponent(pathname.slice("/mame/".length)); }
                catch { notFound(response, head); return; }
                const file = await confinedFile(buildRoot, requested);
                if (file === null) { notFound(response, head); return; }
                send(response, 200, contentTypeFor(file), await readFile(file), head);
                return;
            }
            notFound(response, head);
        })().catch(() => {
            if (!response.headersSent) send(response, 500, "text/plain; charset=utf-8", "internal server error\n", request.method === "HEAD");
            else response.destroy();
        });
    };
    const server: Server = config.tls === undefined ? createServer(handler) : createTlsServer(developmentCertificate(resolve(config.tls), host), handler);

    await new Promise<void>((resolveListening, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.off("error", reject);
            resolveListening();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Harness server did not bind a TCP port.");
    return { server, url: `${config.tls === undefined ? "http" : "https"}://${hostForUrl(host)}:${address.port}/` };
};

// HELPER :: STRING, STRING -> { cert, key }
// Reads cert.pem and key.pem from the directory, generating a self-signed pair with openssl on first use. The
// certificate names localhost, the loopback address, the bound host and every IPv4 address of this machine, so a
// phone on the LAN gets a secure context (Web Crypto, and so the ROM audit, need one) once it trusts the certificate.
export const developmentCertificate = (directory: string, host: string): { readonly cert: Buffer; readonly key: Buffer } => {
    const certPath = join(directory, "cert.pem");
    const keyPath = join(directory, "key.pem");
    if (!existsSync(certPath) || !existsSync(keyPath)) {
        mkdirSync(directory, { recursive: true });
        const addresses = new Set<string>(["127.0.0.1"]);
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && host !== "0.0.0.0") addresses.add(host);
        for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) if (entry.family === "IPv4" && !entry.internal) addresses.add(entry.address);
        const names = ["DNS:localhost", ...[...addresses].map((address) => `IP:${address}`)].join(",");
        const result = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "825",
            "-subj", "/CN=arcade-runtime development", "-addext", `subjectAltName=${names}`], { encoding: "utf8" });
        if (result.status !== 0) throw new Error(`--tls could not generate a certificate with openssl: ${result.stderr?.trim() || result.error?.message || "unknown failure"}`);
    }
    return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
};

// HELPER :: [STRING] -> harnessServerConfig
// Parses the documented command-line options without accepting positional or unknown arguments.
const parseArguments = (args: string[]): HarnessServerConfig => {
    const config: { -readonly [K in keyof HarnessServerConfig]: HarnessServerConfig[K] } = {};
    const pages: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const option = args[index]!;
        const value = args[++index];
        if (value === undefined) throw new Error(`${option} requires a value.`);
        if (option === "--host") config.host = value;
        else if (option === "--port") {
            if (!/^\d+$/.test(value)) throw new Error("--port requires an integer from 0 through 65535.");
            config.port = Number(value);
        } else if (option === "--build-root") config.buildRoot = value;
        else if (option === "--ui-root") config.uiRoot = value;
        else if (option === "--preload") config.preload = value;
        else if (option === "--page") pages.push(value);
        else if (option === "--tls") config.tls = value;
        else throw new Error(`Unknown option ${option}.`);
    }
    if (pages.length > 0) config.pages = pages;
    return config;
};

// COMMAND :: [STRING] -> PROMISE(VOID)
// Starts until interrupted and prints the one URL a developer should open.
const main = async (args: string[]): Promise<void> => {
    try {
        const harness = await startHarnessServer(parseArguments(args));
        console.log(`Arcade harness listening at ${harness.url}`);
        for (const route of loadPages(parseArguments(args).pages ?? []).keys()) console.log(`Extra page at ${harness.url}${route.slice(1)}`);
    } catch (error) {
        console.error(`serve-harness: ${error instanceof Error ? error.message : "startup failed"}`);
        process.exitCode = 1;
    }
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    await main(process.argv.slice(2));
}
