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

// HELPER :: STRING, STRING, STRING? -> STRING
// One 0.161 controller-config port line.
const port = (type: string, code: string, sequence = "standard"): string =>
    `            <port type="${type}"><newseq type="${sequence}">${code}</newseq></port>`;

// HELPER :: NUMBER -> [STRING]
// Unconditional analog ramp, relative-axis and dual-stick mappings for one virtual pad.
// Light-gun X/Y ports ride the same absolute axes and hat ramps as sticks (M34 step one; pointer input comes later).
const extendedPorts = (player: number): string[] => {
    const prefix = `P${player}_`;
    const joy = `JOYCODE_${player}_`;
    const lines: string[] = [];
    for (const [type, code] of [
        ["AD_STICK_X", "XAXIS"], ["PADDLE", "XAXIS"], ["LIGHTGUN_X", "XAXIS"],
        ["AD_STICK_Y", "YAXIS"], ["PADDLE_V", "YAXIS"], ["LIGHTGUN_Y", "YAXIS"],
        ["AD_STICK_Z", "ZAXIS"], ["PEDAL", "RXAXIS"], ["PEDAL2", "RYAXIS"],
        ["DIAL", "ADDREL1"], ["TRACKBALL_X", "ADDREL1"],
        ["DIAL_V", "ADDREL2"], ["TRACKBALL_Y", "ADDREL2"],
    ] as const) lines.push(port(`${prefix}${type}`, `${joy}${code}`));

    for (const type of ["AD_STICK_X", "PADDLE", "LIGHTGUN_X", "DIAL", "TRACKBALL_X", "POSITIONAL"] as const) {
        lines.push(port(`${prefix}${type}`, `${joy}HAT1LEFT`, "decrement"));
        lines.push(port(`${prefix}${type}`, `${joy}HAT1RIGHT`, "increment"));
    }
    for (const type of ["AD_STICK_Y", "PADDLE_V", "LIGHTGUN_Y", "DIAL_V", "TRACKBALL_Y", "POSITIONAL_V"] as const) {
        lines.push(port(`${prefix}${type}`, `${joy}HAT1UP`, "decrement"));
        lines.push(port(`${prefix}${type}`, `${joy}HAT1DOWN`, "increment"));
    }
    lines.push(port(`${prefix}AD_STICK_Z`, `${joy}BUTTON14`, "decrement"));
    lines.push(port(`${prefix}AD_STICK_Z`, `${joy}BUTTON13`, "increment"));
    lines.push(port(`${prefix}PEDAL`, `${joy}BUTTON13`, "increment"));
    lines.push(port(`${prefix}PEDAL2`, `${joy}BUTTON14`, "increment"));
    lines.push(port(`${prefix}PEDAL3`, `${joy}BUTTON15`, "increment"));

    lines.push(port(`${prefix}JOYSTICKLEFT_UP`, `${joy}HAT1UP OR ${joy}HAT1RIGHT OR ${joy}HAT3UP`));
    lines.push(port(`${prefix}JOYSTICKLEFT_DOWN`, `${joy}HAT1DOWN OR ${joy}HAT1LEFT OR ${joy}HAT3DOWN`));
    lines.push(port(`${prefix}JOYSTICKRIGHT_UP`, `${joy}HAT1UP OR ${joy}HAT1LEFT OR ${joy}HAT2UP`));
    lines.push(port(`${prefix}JOYSTICKRIGHT_DOWN`, `${joy}HAT1DOWN OR ${joy}HAT1RIGHT OR ${joy}HAT2DOWN`));
    lines.push(port(`${prefix}JOYSTICKLEFT_LEFT`, `${joy}HAT3LEFT`));
    lines.push(port(`${prefix}JOYSTICKLEFT_RIGHT`, `${joy}HAT3RIGHT`));
    lines.push(port(`${prefix}JOYSTICKRIGHT_LEFT`, `${joy}HAT2LEFT`));
    lines.push(port(`${prefix}JOYSTICKRIGHT_RIGHT`, `${joy}HAT2RIGHT`));
    return lines;
};

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
        lines.push(...extendedPorts(player));
    }
    lines.push(port("SERVICE1", "JOYCODE_1_BUTTON10"));
    lines.push(port("SERVICE", "JOYCODE_1_BUTTON11"));
    lines.push(port("TILT", "JOYCODE_1_BUTTON12"));
    lines.push(port("TILT1", "JOYCODE_1_BUTTON12"));
    lines.push(port("VOLUME_UP", "JOYCODE_1_BUTTON16"));
    lines.push(port("VOLUME_DOWN", "JOYCODE_1_BUTTON17"));
    lines.push("        </input>");
    lines.push("    </system>");
    lines.push("</mameconfig>");
    return `${lines.join("\n")}\n`;
}

export default controllerConfigFor;
