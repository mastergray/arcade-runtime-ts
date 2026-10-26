// realizes: docs/arcade-runtime-spec.md > §10.3 Analogue settings driver

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed config and lifecycle failures
import {
    DEFAULT_ANALOG_SETTING,                                       // Shared UI/runtime defaults
    arcadeControlKey,                                             // Stable effective-hold identity
    isAnalogSettings,                                             // Guards live replacements
} from "../shared.types.js";
import { isAnalogDriverConfig } from "./types.js";               // Guards deterministic construction

// Type dependencies:
import type {
    AnalogSetting,                                                // Resolved per-port setting source
    AnalogSettings,                                               // Live settings map
    ArcadeAxis,                                                   // Axis filter and channel output
    ArcadeControl,                                                // Effective hold edges
    ArcadeControlKey,                                             // Held-control identities
    MachineAnalogKind,                                            // Discovered port kind
    PlayerIndex,                                                  // Port player
    Unsubscribe,                                                  // Hold observer remover
} from "../shared.types.js";
import type { ArcadeInputChannel } from "../ArcadeInput/types.js";   // Driver-owned output channel
import type { AnalogDriverConfig } from "./types.js";            // Construction config

/**
 *
 * Type Declarations
 *
 */

// TYPE :: centre | hold | relative
// Default return policy for one discovered analogue kind.
type AnalogMode = "centre" | "hold" | "relative";

// INTERFACE :: one bound machine port and its retained keyboard integration value
interface DrivenPort {
    readonly player: PlayerIndex;
    readonly kind: MachineAnalogKind;
    readonly axis: ArcadeAxis;
    readonly mode: AnalogMode;
    value: number;
}

/**
 *
 * Constants
 *
 */

const HORIZONTAL_KINDS: ReadonlySet<MachineAnalogKind> = new Set([
    "stick-x", "paddle", "positional", "lightgun-x", "dial", "trackball-x", "mouse-x",
]);
const VERTICAL_KINDS: ReadonlySet<MachineAnalogKind> = new Set([
    "stick-y", "paddle-v", "positional-v", "lightgun-y", "dial-v", "trackball-y", "mouse-y",
]);
const HOLD_KINDS: ReadonlySet<MachineAnalogKind> = new Set([
    "paddle", "paddle-v", "positional", "positional-v", "lightgun-x", "lightgun-y",
]);
const RELATIVE_KINDS: ReadonlySet<MachineAnalogKind> = new Set([
    "dial", "dial-v", "trackball-x", "trackball-y", "mouse-x", "mouse-y",
]);

/**
 *
 * Functions
 *
 */

// HELPER :: analogSettings -> analogSettings
// Deep-copies and freezes a settings snapshot so caller mutation cannot change live behavior.
const settingsCopy = (settings: AnalogSettings = {}): AnalogSettings => Object.freeze(Object.fromEntries(
    Object.entries(settings).map(([key, setting]) => [key, Object.freeze({ ...setting })]),
) as AnalogSettings);

// HELPER :: machineAnalogKind -> arcadeAxisKind?
// Maps discovered kinds onto the seven W26 bridge slots. Pedal 3 has no slot.
const axisKindFor = (kind: MachineAnalogKind): ArcadeAxis["kind"] | null => {
    if (kind === "stick-x" || kind === "paddle" || kind === "positional" || kind === "lightgun-x") return "stick-x";
    if (kind === "stick-y" || kind === "paddle-v" || kind === "positional-v" || kind === "lightgun-y") return "stick-y";
    if (kind === "stick-z") return "stick-z";
    if (kind === "pedal-1" || kind === "pedal-2") return kind;
    if (kind === "dial" || kind === "trackball-x" || kind === "mouse-x") return "spin-x";
    if (kind === "dial-v" || kind === "trackball-y" || kind === "mouse-y") return "spin-y";
    return null;
};

// HELPER :: machineAnalogKind -> analogMode
// Resolves the default return policy named by the W23a contract.
const modeFor = (kind: MachineAnalogKind): AnalogMode => RELATIVE_KINDS.has(kind)
    ? "relative"
    : HOLD_KINDS.has(kind) ? "hold" : "centre";

// HELPER :: NUMBER, NUMBER -> NUMBER
// Moves a scalar toward zero without overshooting.
const towardZero = (value: number, step: number): number => Math.abs(value) <= step ? 0 : value - Math.sign(value) * step;

/**
 *
 * Class
 *
 */

// Integrates effective keyboard holds into W26 axes and filters live gamepad axis values.
export default class AnalogDriver {

    /* Instance Fields */
    private readonly _scheduler: AnalogDriverConfig["scheduler"];
    private readonly _channel: ArcadeInputChannel;
    private readonly _ports: DrivenPort[];
    private readonly _held = new Set<ArcadeControlKey>();
    private readonly _unsubscribeHold: Unsubscribe;
    private _settings: AnalogSettings;
    private _frameHandle: number | null = null;
    private _destroyed = false;

    // CONSTRUCTOR :: analogDriverConfig -> this
    // Starts one frame request chain when at least one declared kind has a W26 axis slot.
    // Relative keySpeed is a delta per frame in axis units; the default represents
    // 0.02 of a port's full scale because port-specific native scales are not served.
    constructor(config: AnalogDriverConfig) {
        if (!isAnalogDriverConfig(config)) throw AnalogDriver.invalidConfig("AnalogDriver config is invalid.", config);
        this._scheduler = config.scheduler;
        this._channel = config.input.createChannel();
        this._settings = settingsCopy(config.settings);
        const seenAxes = new Set<string>();
        this._ports = config.inputs.flatMap(({ player, kind }) => {
            const axisKind = axisKindFor(kind);
            if (axisKind === null) return [];
            const axisKey = `p${player}:${axisKind}`;
            if (seenAxes.has(axisKey)) return [];                 // Conditional alternatives sharing one bridge slot use the first row.
            seenAxes.add(axisKey);
            return [{ player, kind, axis: Object.freeze({ player, kind: axisKind }), mode: modeFor(kind), value: 0 }];
        });
        this._unsubscribeHold = config.input.onHold((control, pressed) => {
            const key = arcadeControlKey(control);
            if (pressed) this._held.add(key);
            else this._held.delete(key);
            return this.consumesDigital(control);
        });
        if (this._ports.length > 0) this.schedule();
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> analogSettings
    // Current immutable settings snapshot.
    get settings(): AnalogSettings { return this._settings; }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: analogSettings -> VOID
    // Replaces live tuning without restarting the driver or resetting integrated positions.
    update(settings: AnalogSettings): void {
        this.assertLive();
        if (!isAnalogSettings(settings)) throw AnalogDriver.invalidConfig("AnalogDriver settings are invalid.", settings);
        this._settings = settingsCopy(settings);
    }

    // INSTANCE :: arcadeAxis, NUMBER -> NUMBER
    // Applies the declared port's travel and inversion to a gamepad value.
    // Absolute values clamp after scaling; relative deltas remain unbounded.
    axisFilter(axis: ArcadeAxis, value: number): number {
        this.assertLive();
        if (!Number.isFinite(value)) throw AnalogDriver.invalidConfig("AnalogDriver axisFilter requires a finite value.", value);
        const port = this._ports.find((candidate) => candidate.axis.player === axis.player && candidate.axis.kind === axis.kind);
        if (port === undefined) return value;
        const setting = this.settingFor(port);
        const scaled = value * setting.travel * (setting.invert ? -1 : 1);
        return port.mode === "relative" ? scaled : Math.max(-1, Math.min(1, scaled));
    }

    // INSTANCE :: VOID -> VOID
    // Stops integration, removes hold observation and destroys the owned channel; idempotent.
    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        if (this._frameHandle !== null) this._scheduler.cancel(this._frameHandle);
        this._frameHandle = null;
        this._unsubscribeHold();
        this._held.clear();
        this._channel.destroy();
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Requests one integration callback when none is outstanding.
    private schedule(): void {
        if (this._destroyed || this._frameHandle !== null) return;
        this._frameHandle = this._scheduler.request(() => {
            this._frameHandle = null;
            if (this._destroyed) return;
            this.step();
            this.schedule();
        });
    }

    // PRIVATE :: VOID -> VOID
    // Advances every bound port exactly once and writes its resulting absolute value or relative delta.
    private step(): void {
        for (const port of this._ports) {
            const setting = this.settingFor(port);
            const direction = this.directionFor(port);
            if (port.mode === "relative") {
                if (direction !== 0) this._channel.setAxis(port.axis, direction * setting.keySpeed * (setting.invert ? -1 : 1));
                continue;
            }
            if (port.kind === "pedal-1" || port.kind === "pedal-2") {
                port.value = direction > 0
                    ? Math.min(1, port.value + setting.keySpeed)
                    : Math.max(0, port.value - setting.centreSpeed);
            } else if (direction !== 0) {
                port.value = Math.max(-1, Math.min(1, port.value + direction * setting.keySpeed));
            } else {
                port.value = towardZero(port.value, setting.centreSpeed);
            }
            this._channel.setAxis(port.axis, port.value * (setting.invert ? -1 : 1));
        }
    }

    // PRIVATE :: drivenPort -> Required<analogSetting>
    // Resolves per-kind centre defaults: centring kinds use keySpeed, hold kinds use zero, relative kinds ignore it.
    private settingFor(port: DrivenPort): Required<AnalogSetting> {
        const configured = this._settings[`p${port.player}:${port.kind}`] ?? {};
        const keySpeed = configured.keySpeed ?? DEFAULT_ANALOG_SETTING.keySpeed;
        return {
            keySpeed,
            centreSpeed: configured.centreSpeed ?? (port.mode === "centre" ? keySpeed : 0),
            travel: configured.travel ?? DEFAULT_ANALOG_SETTING.travel,
            invert: configured.invert ?? DEFAULT_ANALOG_SETTING.invert,
        };
    }

    // PRIVATE :: drivenPort -> -1 | 0 | 1
    // Resolves effective held controls into the sign for one port.
    private directionFor(port: DrivenPort): -1 | 0 | 1 {
        if (port.kind === "pedal-1" || port.kind === "pedal-2") {
            const pedal = port.kind === "pedal-1" ? 1 : 2;
            return this._held.has(`p${port.player}:pedal:${pedal}`) ? 1 : 0;
        }
        if (port.kind === "stick-z") {
            const positive = this._held.has(`p${port.player}:pedal:1`) || this.hasStickDirection(port.player, "down");
            const negative = this._held.has(`p${port.player}:pedal:2`) || this.hasStickDirection(port.player, "up");
            return positive === negative ? 0 : positive ? 1 : -1;
        }
        const horizontal = HORIZONTAL_KINDS.has(port.kind);
        const positive = this.hasStickDirection(port.player, horizontal ? "right" : "down");
        const negative = this.hasStickDirection(port.player, horizontal ? "left" : "up");
        return positive === negative ? 0 : positive ? 1 : -1;
    }

    // PRIVATE :: playerIndex, arcadeDirection -> BOOLEAN
    // Reads stick-1 controls only; ordinary direction controls remain exclusively digital.
    private hasStickDirection(player: PlayerIndex, direction: "up" | "down" | "left" | "right"): boolean {
        return this._held.has(`p${player}:stick:1:${direction}`);
    }

    // PRIVATE :: arcadeControl -> BOOLEAN
    // Consumes only digital stick/pedal paths backed by a declared driver axis; direction controls remain digital.
    private consumesDigital(control: ArcadeControl): boolean {
        if (control.kind === "pedal") {
            if (control.pedal === 3) return false;
            return this._ports.some((port) => port.player === control.player
                && (port.kind === `pedal-${control.pedal}` || port.kind === "stick-z"));
        }
        if (control.kind !== "stick" || control.stick !== 1) return false;
        return this._ports.some((port) => port.player === control.player
            && port.kind !== "pedal-1" && port.kind !== "pedal-2");
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after terminal teardown.
    private assertLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "AnalogDriver has been destroyed.",
        });
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds a typed invalid-configuration failure.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
