// realizes: docs/arcade-runtime-spec.md > §4.1 step 6 (running a family build under Node for -listfull and -listxml)

// Dependencies:
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";    // Temporary CommonJS copy of the modularized build
import { createRequire } from "node:module";                    // Loads the 1.38.31 factory, which exports itself CommonJS-style
import { tmpdir } from "node:os";                               // Temporary directory root
import { basename, dirname, join } from "node:path";            // Artifact paths

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {stdout:STRING, stderr:STRING, exitCode:NUMBER}
// What one ROM-free MAME invocation produced.
export interface MameRun {
    readonly stdout: string;                                       // Joined print() lines
    readonly stderr: string;                                       // Joined printErr() lines
    readonly exitCode: number;                                     // Process exit status reported by the runtime, 0 when it simply returned
}

// TYPE :: the subset of the module factory and instance the runner touches
type ModuleFactory = (options: Record<string, unknown>) => { then?: (callback: () => void) => unknown };

/**
 *
 * Constants
 *
 */

const DEFAULT_TIMEOUT_MS = 120_000;                               // -listxml of a large family under Node

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, [STRING], NUMBER? -> PROMISE(mameRun)
// Runs a modularized family build under Node with the given MAME arguments and captures its output.
// NOTE: The build's JavaScript is copied beside itself as .cjs so Node loads it as CommonJS inside this ESM package;
// locateFile keeps the .wasm resolution on the original directory.
export const runMameUnderNode = async (javascriptPath: string, args: ReadonlyArray<string>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<MameRun> => {
    const directory = dirname(javascriptPath);
    const scratch = mkdtempSync(join(tmpdir(), "arcade-mame-run-"));
    const cjsPath = join(scratch, `${basename(javascriptPath, ".js")}.cjs`);
    copyFileSync(javascriptPath, cjsPath);
    try {
        const factory = createRequire(import.meta.url)(cjsPath) as ModuleFactory;
        const stdout: string[] = [];
        const stderr: string[] = [];
        return await new Promise<MameRun>((resolve, reject) => {
            let settled = false;
            let exitCode = 0;
            const finish = (): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve({ stdout: stdout.join("\n"), stderr: stderr.join("\n"), exitCode });
            };
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`MAME did not finish within ${timeoutMs} ms: ${args.join(" ")}`));
            }, timeoutMs);
            try {
                factory({
                    arguments: [...args],
                    print: (line: string) => { stdout.push(line); },
                    printErr: (line: string) => { stderr.push(line); },
                    locateFile: (file: string) => join(directory, file),
                    onExit: (status: number) => { exitCode = status; finish(); },
                    // The pinned runtime's Node environment calls process.exit through quit(); keep the pipeline alive.
                    quit: (status: number) => { exitCode = status; finish(); },
                    postRun: [finish],
                    onAbort: (reason: unknown) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        reject(new Error(`MAME aborted: ${String(reason)}`));
                    },
                });
            } catch (error) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
};
