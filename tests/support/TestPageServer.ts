// Dependencies:
import { readFile } from "node:fs/promises";                       // Reads source modules for the test-local page
import { createServer, type Server } from "node:http";            // Serves one self-contained test page per case
import { dirname, extname, resolve } from "node:path";             // Resolves and constrains served module paths
import { fileURLToPath } from "node:url";                          // Resolves the workspace without a harness dependency
import ts from "typescript";                                       // Transpiles the source modules requested by the page

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {server:Server, url:STRING}
// A listening page server and the URL of its page.
export interface TestPageServer {
    readonly server: Server;                                       // Node HTTP server to close after the case
    readonly url: string;                                          // http://127.0.0.1:<port>/
}

/**
 *
 * Constants
 *
 */

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");   // Repository root served read-only

// Bare specifiers the browser cannot resolve, mapped to the dependency's ESM browser build under node_modules.
// Transpiled output has its `from "fflate"` rewritten to the served path; add a row per runtime dependency.
const BARE_IMPORTS: ReadonlyArray<{ readonly specifier: string; readonly served: string; readonly file: string }> = [
    { specifier: "fflate", served: "/-/fflate.js", file: "node_modules/fflate/esm/browser.js" },
];

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Rewrites bare imports of known runtime dependencies to their served paths.
const rewriteBareImports = (javascript: string): string => BARE_IMPORTS.reduce(
    (output, { specifier, served }) => output.replace(new RegExp(`from\\s+["']${specifier}["']`, "g"), `from "${served}"`),
    javascript,
);

// HELPER :: STRING -> PROMISE(testPageServer)
// Starts an ephemeral loopback server that serves pageHtml at "/", transpiles requested repository TypeScript
// modules in memory (".js" requests resolve to ".ts" sources), and serves known runtime dependencies as ESM.
export const startTestPageServer = async (pageHtml: string): Promise<TestPageServer> => {
    const server = createServer((request, response) => {
        void (async () => {
            const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
            if (pathname === "/") {
                response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
                response.end(pageHtml);
                return;
            }
            const bare = BARE_IMPORTS.find((entry) => entry.served === pathname);
            if (bare !== undefined) {
                const javascript = await readFile(resolve(WORKSPACE, bare.file), "utf8");
                response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
                response.end(javascript);
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
            response.end(rewriteBareImports(javascript));
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

// HELPER :: STRING, (STRING -> PROMISE(T)) -> PROMISE(T)
// Runs one browser pipeline against a fresh page server for pageHtml and always releases the socket.
export const withTestPage = async <T>(pageHtml: string, run: (url: string) => Promise<T>): Promise<T> => {
    const page = await startTestPageServer(pageHtml);
    try {
        return await run(page.url);
    } finally {
        page.server.closeAllConnections();
        await new Promise<void>((resolveClosed) => page.server.close(() => resolveClosed()));
    }
};
