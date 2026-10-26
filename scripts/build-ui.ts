#!/usr/bin/env -S node --import tsx

// realizes: docs/ui-design-language.md > §6.3 Gallery build

import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

export interface UiBuildResult {
    readonly outDir: string;
    readonly bundleBytes: number;
}

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildUi(outDir = resolve(WORKSPACE, "dist/ui")): Promise<UiBuildResult> {
    const output = resolve(outDir);
    await mkdir(output, { recursive: true });
    await build({
        entryPoints: [resolve(WORKSPACE, "ui/gallery/main.tsx")],
        outfile: join(output, "gallery.js"),
        bundle: true,
        format: "esm",
        target: "es2022",
        minify: false,
        sourcemap: true,
        jsx: "automatic",
    });
    await Promise.all([
        copyFile(resolve(WORKSPACE, "ui/gallery/index.html"), join(output, "index.html")),
        copyFile(resolve(WORKSPACE, "ui/tokens.css"), join(output, "tokens.css")),
    ]);
    const bundleBytes = (await stat(join(output, "gallery.js"))).size;
    return { outDir: output, bundleBytes };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    const result = await buildUi();
    console.log(`UI gallery built at ${result.outDir} (${result.bundleBytes} bytes).`);
}
