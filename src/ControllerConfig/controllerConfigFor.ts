// realizes: docs/arcade-runtime-spec.md > §4.4 Generated controller config

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed rejection for invalid generator config

// Type dependencies:
import { isControllerConfig, type ControllerConfig } from "./types.js";   // Generator choices and guard

/**
 *
 * Constants
 *
 */

const DIRECTIONS = [                                             // Port suffix and web-pad hat token suffix in canonical table order
    ["UP", "UP"],
    ["DOWN", "DOWN"],
    ["LEFT", "LEFT"],
    ["RIGHT", "RIGHT"],
] as const;

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, STRING -> STRING
// One 0.161 controller-config port line.
const port = (type: string, code: string): string =>
    `            <port type="${type}"><newseq type="standard">${code}</newseq></port>`;

// INSTANCE :: controllerConfig -> STRING
// Returns a complete deterministic MAME 0.161 web.cfg using the frozen web-pad token contract.
// NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isControllerConfig().
export function controllerConfigFor(config: ControllerConfig): string {
    if (!isControllerConfig(config)) throw new ArcadeRuntimeError({
        code: ArcadeRuntimeError.CODE.INVALID_CONFIG,
        message: "Controller config requires a PlayerCount and a boolean select choice.",
        data: config,
    });
    const lines = [
        "<?xml version=\"1.0\"?>",
        "<mameconfig version=\"10\">",
        "    <system name=\"default\">",
        "        <input>",
    ];
    for (let player = 1; player <= config.players; player++) {
        for (const [portDirection, codeDirection] of DIRECTIONS) {
            lines.push(port(`P${player}_JOYSTICK_${portDirection}`, `JOYCODE_${player}_HAT1${codeDirection}`));
        }
        for (let button = 1; button <= 6; button++) {
            lines.push(port(`P${player}_BUTTON${button}`, `JOYCODE_${player}_BUTTON${button}`));
        }
        lines.push(port(`COIN${player}`, `JOYCODE_${player}_BUTTON7`));
        lines.push(port(`START${player}`, `JOYCODE_${player}_BUTTON8`));
        if (config.select) lines.push(port(`P${player}_SELECT`, `JOYCODE_${player}_BUTTON9`));
    }
    lines.push(port("SERVICE1", "JOYCODE_1_BUTTON10"));
    lines.push(port("SERVICE", "JOYCODE_1_BUTTON11"));
    lines.push(port("TILT", "JOYCODE_1_BUTTON12"));
    lines.push(port("TILT1", "JOYCODE_1_BUTTON12"));
    lines.push("        </input>");
    lines.push("    </system>");
    lines.push("</mameconfig>");
    return `${lines.join("\n")}\n`;
}

export default controllerConfigFor;
