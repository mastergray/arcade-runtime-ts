#!/usr/bin/env -S node --import tsx

// realizes: docs/ui-design-language.md > §6.3 Gallery build

import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

export interface UiBuildResult {
    readonly outDir: string;
    readonly bundleBytes: number;
    readonly galleryBundleBytes: number;
    readonly localBundleBytes: number;
}

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildUi(outDir = resolve(WORKSPACE, "dist/ui")): Promise<UiBuildResult> {
    const output = resolve(outDir);
    await mkdir(output, { recursive: true });
    const common = { bundle: true, format: "esm" as const, target: "es2022", minify: false, sourcemap: true, jsx: "automatic" as const };
    await Promise.all([
        build({ ...common, entryPoints: [resolve(WORKSPACE, "ui/gallery/main.tsx")], outfile: join(output, "gallery.js") }),
        build({ ...common, entryPoints: [resolve(WORKSPACE, "ui/local/main.tsx")], outfile: join(output, "local.js") }),
    ]);
    await Promise.all([
        copyFile(resolve(WORKSPACE, "ui/gallery/index.html"), join(output, "index.html")),
        copyFile(resolve(WORKSPACE, "ui/local/index.html"), join(output, "local.html")),
        copyFile(resolve(WORKSPACE, "ui/local/local.css"), join(output, "local.css")),
        copyFile(resolve(WORKSPACE, "ui/tokens.css"), join(output, "tokens.css")),
    ]);
    const [galleryBundleBytes, localBundleBytes] = await Promise.all([
        stat(join(output, "gallery.js")).then((value) => value.size),
        stat(join(output, "local.js")).then((value) => value.size),
    ]);
    return { outDir: output, bundleBytes: galleryBundleBytes, galleryBundleBytes, localBundleBytes };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
    const result = await buildUi();
    console.log(`UI built at ${result.outDir} (gallery ${result.galleryBundleBytes} bytes; local ${result.localBundleBytes} bytes).`);
}
