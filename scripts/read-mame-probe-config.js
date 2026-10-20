import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [configArgument, kind] = process.argv.slice(2);

if (configArgument === undefined || !["family", "game", "native-parity"].includes(kind)) {
    throw new Error("Usage: read-mame-probe-config.js <config.json> <family|game|native-parity>");
}

const configPath = resolve(configArgument);
const configDirectory = dirname(configPath);
const parsed = JSON.parse(readFileSync(configPath, "utf8"));

if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("MAME probe config must contain a JSON object");
}

const stringValue = (name, fallback = "") => {
    const value = parsed[name] ?? fallback;
    if (typeof value !== "string") {
        throw new Error(`MAME probe config field ${name} must be a string`);
    }
    return value;
};

const pathValue = (name, fallback = "") => {
    const value = stringValue(name, fallback);
    return value.length === 0 ? "" : resolve(configDirectory, value);
};

const roms = parsed.roms ?? [];
if (!Array.isArray(roms) || roms.some((value) => typeof value !== "string")) {
    throw new Error("MAME probe config field roms must be an array of paths");
}

const values = [
    pathValue("source"),
    pathValue("emsdk", "emsdk"),
    stringValue("machine"),
    stringValue("parent"),
    stringValue("secondMachine"),
    stringValue("sound", "none"),
    pathValue("target", "mame-runtimeprobe.lua"),
    stringValue("output", kind === "family" ? "mamefamily-probe" : "mamegame-probe"),
    ...(kind === "native-parity"
        ? [pathValue("nativeResult", "../.cache/mame0161-source/mameparity-native.json")]
        : []),
    ...roms.map((value) => resolve(configDirectory, value)),
];

process.stdout.write(`${values.join("\0")}\0`);
