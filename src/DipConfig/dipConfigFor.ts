// realizes: docs/arcade-runtime-spec.md > §4.5 Generated DIP-switch cfg

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed rejection for unknown selections

// Type dependencies:
import type { RomSetMetadata } from "../RomSetAudit/types.js";    // Validated -listxml DIP fields

/**
 *
 * Functions
 *
 */

// HELPER :: UNKNOWN, STRING -> arcadeRuntimeError
// One INVALID_CONFIG failure that names the unrecognized selection.
const invalid = (data: unknown, message: string): ArcadeRuntimeError => new ArcadeRuntimeError({
    code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
    message,
    data,
});

// HELPER :: STRING -> STRING
// Escapes one XML attribute value without changing its user-facing selection key.
const attribute = (value: string): string => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// HELPER :: STRING -> STRING
// MAME's live ioport tag includes the root-device colon that -listxml deliberately removes.
const cfgTag = (tag: string): string => tag.startsWith(":") ? tag : `:${tag}`;

// INSTANCE :: STRING, romSetMetadata.dipswitches?, {[STRING]:STRING} -> STRING
// Returns a deterministic MAME 0.161 per-machine cfg containing only explicitly selected DIP fields.
// NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when a switch or setting name is absent from metadata.
export function dipConfigFor(
    machine: string,
    dipswitches: RomSetMetadata["dipswitches"],
    selections: Readonly<Record<string, string>>,
): string {
    const available = dipswitches ?? [];
    const chosen = new Map<string, NonNullable<RomSetMetadata["dipswitches"]>[number]["values"][number]>();
    for (const [switchName, settingName] of Object.entries(selections)) {
        const dipswitch = available.find((candidate) => candidate.name === switchName);
        if (dipswitch === undefined) throw invalid(switchName, `Unknown DIP switch "${switchName}".`);
        const setting = dipswitch.values.find((candidate) => candidate.name === settingName);
        if (setting === undefined) throw invalid(
            { switch: switchName, setting: settingName },
            `Unknown setting "${settingName}" for DIP switch "${switchName}".`,
        );
        chosen.set(switchName, setting);
    }

    const lines = [
        "<?xml version=\"1.0\"?>",
        "<mameconfig version=\"10\">",
        `    <system name="${attribute(machine)}">`,
        "        <input>",
    ];
    for (const dipswitch of available) {
        const setting = chosen.get(dipswitch.name);
        if (setting === undefined) continue;
        const defaultSetting = dipswitch.values.find((candidate) => candidate.default);
        if (defaultSetting === undefined) throw invalid(dipswitch.name, `DIP switch "${dipswitch.name}" has no default setting.`);
        lines.push(`            <port tag="${attribute(cfgTag(dipswitch.tag))}" type="DIPSWITCH" mask="${dipswitch.mask}" defvalue="${defaultSetting.value}" value="${setting.value}"/>`);
    }
    lines.push("        </input>");
    lines.push("    </system>");
    lines.push("</mameconfig>");
    return `${lines.join("\n")}\n`;
}

export default dipConfigFor;
