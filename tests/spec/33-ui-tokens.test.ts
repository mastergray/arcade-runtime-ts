// realizes: docs/ui-design-language.md > §1 Tokens

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";

import type { TestFile } from "../run.ts";

interface TokenInspection {
    readonly coloursExact: boolean;
    readonly densityBlocksPresent: boolean;
    readonly densityRolesMatch: boolean;
    readonly kitHasNoLiteralColourOrPixels: boolean;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS_PATH = join(ROOT, "ui", "tokens.css");
const KIT_PATH = join(ROOT, "ui", "kit");
const COLOURS: Readonly<Record<string, string>> = {
    desk: "#3767C8",
    face: "#C0C0C0",
    light: "#FFFFFF",
    dark: "#404040",
    mid: "#808080",
    soft: "#DFDFDF",
    title: "#0A2A8C",
    ink: "#000000",
    ok: "#2F9E52",
    bad: "#D11F1F",
    warn: "#D9A400",
    "warn-text": "#8a6a00",
    "warn-note": "#8a4a00",
    panel: "#F3F3F3",
    "tab-off": "#B5B5B5",
    th: "#E4E4E4",
    rule: "#C8C8C8",
    "list-rule": "#DDD",
    active: "#E6ECFF",
    held: "#E6F4EA",
    "term-bg": "#0C0C0C",
    "term-fg": "#E8E8E8",
    stage: "#000",
    "canvas-empty": "#0E1326",
    "canvas-empty-text": "#9aa3c7",
    "icon-a": "#2A7BD8",
    "icon-b": "#3BA55D",
    "red-top": "#ff6b6b",
    "red-bottom": "#c41818",
    "red-border": "#6b0b0b",
    "red-drop": "#5a0a0a",
    "pill-fill": "#e9e9e9",
    "pill-border": "#777",
    "pill-drop": "#555",
};

const blockFor = (css: string, density: string): string | null => {
    const escaped = density === "desktop"
        ? String.raw`:root\s*,\s*:root\[data-density=["']desktop["']\]\s*\{([^}]*)\}`
        : String.raw`:root\[data-density=["']${density}["']\]\s*\{([^}]*)\}`;
    return new RegExp(escaped, "s").exec(css)?.[1] ?? null;
};

const roleNames = (block: string): string[] => [...block.matchAll(/--(role-[a-z-]+)\s*:/g)].map((match) => match[1]!).sort();

const inspect = (): TokenInspection => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const coloursExact = Object.entries(COLOURS).every(([name, value]) => new RegExp(`--${name}\\s*:\\s*${value.replace("#", "\\#")}\\s*;`, "i").test(css));
    const blocks = ["desktop", "phone", "tv"].map((density) => blockFor(css, density));
    const densityBlocksPresent = blocks.every((block) => block !== null);
    const roles = blocks.map((block) => block === null ? [] : roleNames(block));
    const densityRolesMatch = roles[0]!.length > 0 && roles.every((names) => JSON.stringify(names) === JSON.stringify(roles[0]));
    const kitHasNoLiteralColourOrPixels = readdirSync(KIT_PATH)
        .filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"))
        .every((name) => {
            const source = readFileSync(join(KIT_PATH, name), "utf8");
            return !/#[0-9a-f]{3,8}\b/i.test(source) && !/\b\d+(?:\.\d+)?px\b/i.test(source);
        });
    return { coloursExact, densityBlocksPresent, densityRolesMatch, kitHasNoLiteralColourOrPixels };
};

const testFile: TestFile = {
    label: "UI design-language tokens",
    cases: [{
        label: "documents exact colours, symmetric density roles and token-only kit measurements",
        run: () => CTGTest.init("UI tokens")
            .assert("the token contract is complete", inspect, P.equals<TokenInspection>({
                coloursExact: true,
                densityBlocksPresent: true,
                densityRolesMatch: true,
                kitHasNoLiteralColourOrPixels: true,
            }))
            .start(undefined),
    }],
};

export default testFile;
