// realizes: docs/arcade-runtime-spec.md > §10.4 GamepadSource

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed config and lifecycle failures

// Type dependencies:
import {
    arcadeControlKey,
    type ArcadeControl,
    type ArcadeControlKey,
    type ArcadeDirection,
    type MachineAnalogKind,
    type PlayerIndex,
} from "../shared.types.js";                                     // Transition identity, machine declarations and player slots
import type { ArcadeInputChannel } from "../ArcadeInput/types.js";   // Independently releasable per-pad channel
import type {
    KeyboardEventTargetLike,                                     // Injected blur boundary
    KeyboardVisibilityTargetLike,                                // Injected visibility boundary
} from "../KeyboardSource/types.js";
import {
    controlsFor,                                                  // Pure pad-snapshot conversion
    isGamepadLike,                                                // Ignores malformed provider entries safely
    isGamepadSourceConfig,                                        // Guards direct construction
    isGamepadSourceInitConfig,                                    // Guards init before reading browser globals
    type GamepadLike,                                             // Provider snapshot entry
    type GamepadChord,                                            // One operator-layer physical binding
    type GamepadChords,                                           // Modifier and binding configuration
    type GamepadMapping,                                          // Physical-index overrides
    type GamepadProviderLike,                                     // Injectable Gamepad API boundary
    type GamepadSourceConfig,                                     // Direct construction config
    type GamepadSourceInitConfig,                                 // init config with optional browser dependencies
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: one connected pad's stable player slot, channel and last physical snapshot
// The active map deduplicates both held controls and edge-triggered coin/start taps.
interface AssignedPad {
    readonly index: number;                                       // Gamepad API connection index
    readonly id: string;                                          // Detects replacement at a reused index
    readonly player: PlayerIndex;                                 // Lowest free slot at assignment time
    readonly channel: ArcadeInputChannel;                         // Exactly one independently owned channel
    readonly active: Map<ArcadeControlKey, ArcadeControl>;        // Controls down on the previous poll
    readonly suppressedChordButtons: Set<number>;                 // Buttons already down before the modifier engaged
    readonly previousChordButtons: Set<number>;                   // Chord buttons down on the previous poll
    modifierHeld: boolean;                                        // Previous physical modifier state
    chordFired: boolean;                                          // Suppresses the deferred coin tap for this hold
}

// INTERFACE :: validated provider entry with the mapping applicable to this pad
interface PollablePad {
    readonly pad: GamepadLike;                                    // Current connected snapshot
    readonly mapping: GamepadMapping;                             // Default/override indices selected for it
}

/**
 *
 * Constants
 *
 */

const PLAYER_SLOTS = [1, 2, 3, 4] as const;                       // Assignment order and hard v1 player limit
const DEFAULT_MAPPING: GamepadMapping = Object.freeze({});        // Empty overrides mean W3C standard indices
const DEFAULT_DPAD = Object.freeze({ up: 12, down: 13, left: 14, right: 15 });   // W3C standard buttons
const DEFAULT_BUTTONS = Object.freeze([0, 1, 2, 3, 4, 5] as const);   // W3C face and shoulder buttons
const DEFAULT_COIN = 8;                                           // W3C Select/Back button
const DEFAULT_START = 9;                                          // W3C Start button
const DEFAULT_LEFT_AXES = Object.freeze([0, 1] as const);          // W3C standard left stick
const DEFAULT_RIGHT_AXES = Object.freeze([2, 3] as const);         // W3C standard right stick
const DEFAULT_PEDALS = Object.freeze([7, 6] as const);             // Right then left trigger
const DIRECTIONS = ["up", "down", "left", "right"] as const;   // Stable directional order
const SPIN_PIXELS_PER_POLL = 20;                                  // Full deflection; matches the 20–30 px key delta the pinned dial and trackball drivers declare

// HELPER :: NUMBER, arcadeControl -> gamepadChord
// Deep-freezes one public default binding.
const frozenChord = (button: number, control: ArcadeControl): GamepadChord => Object.freeze({
    button,
    control: Object.freeze(control),
});

// Default W3C-layout operator layer. Runtime defaults resolve these logical positions through mapping overrides.
export const DEFAULT_GAMEPAD_CHORDS: GamepadChords = Object.freeze({
    modifier: DEFAULT_COIN,
    bindings: Object.freeze([
        frozenChord(DEFAULT_START, { kind: "key", key: "F2" }),
        frozenChord(DEFAULT_DPAD.up, { kind: "key", key: "F1" }),
        frozenChord(DEFAULT_DPAD.down, { kind: "key", key: "9" }),
        frozenChord(DEFAULT_DPAD.left, { kind: "key", key: "F5" }),
        frozenChord(DEFAULT_DPAD.right, { kind: "key", key: "F6" }),
        frozenChord(DEFAULT_BUTTONS[0], { kind: "test" }),
        frozenChord(DEFAULT_BUTTONS[1], { kind: "service" }),
        frozenChord(DEFAULT_BUTTONS[2], { kind: "tilt" }),
        frozenChord(DEFAULT_BUTTONS[4], { kind: "volume", direction: "down" }),
        frozenChord(DEFAULT_BUTTONS[5], { kind: "volume", direction: "up" }),
    ]),
});

// HELPER :: gamepadLike, NUMBER -> BOOLEAN
// Digital/analog button threshold used for d-pad-only snapshots.
const pressed = (pad: GamepadLike, index: number): boolean => {
    const button = pad.buttons[index];
    return button !== undefined && (button.pressed || button.value >= 0.5);
};

// HELPER :: gamepadLike, NUMBER -> gamepadLike
// Masks one physical button from only the digital layer; analogue reads continue using the original snapshot.
const withoutDigitalButton = (pad: GamepadLike, index: number): GamepadLike => ({
    ...pad,
    buttons: pad.buttons.map((button, offset) => offset === index ? { pressed: false, value: 0 } : button),
});

// HELPER :: gamepadMapping -> [gamepadChord]
// Uses custom bindings verbatim or resolves the standard logical positions through the pad mapping.
const chordBindingsFor = (mapping: GamepadMapping): ReadonlyArray<GamepadChord> => {
    if (mapping.chords !== false && mapping.chords?.bindings !== undefined) return mapping.chords.bindings;
    const dpad = mapping.dpad ?? DEFAULT_DPAD;
    const buttons = mapping.buttons ?? DEFAULT_BUTTONS;
    const physical = [
        mapping.start ?? DEFAULT_START,
        dpad.up, dpad.down, dpad.left, dpad.right,
        buttons[0], buttons[1], buttons[2], buttons[4], buttons[5],
    ];
    return (DEFAULT_GAMEPAD_CHORDS.bindings ?? []).map((binding, index) => ({
        button: physical[index] ?? binding.button,
        control: binding.control,
    }));
};

// HELPER :: gamepadLike, gamepadMapping -> Set<arcadeDirection>
// Reads only the d-pad, leaving analog sticks available for machine-declared axes.
const dpadDirections = (pad: GamepadLike, mapping: GamepadMapping): Set<ArcadeDirection> => {
    const indices = mapping.dpad ?? DEFAULT_DPAD;
    const result = new Set<ArcadeDirection>();
    for (const direction of DIRECTIONS) if (pressed(pad, indices[direction])) result.add(direction);
    return result;
};

// HELPER :: gamepadLike, [NUMBER,NUMBER], NUMBER -> Set<arcadeDirection>
// Applies the existing independent-axis direction quantizer to one physical stick.
const stickDirections = (pad: GamepadLike, axes: readonly [number, number], deadZone: number): Set<ArcadeDirection> => {
    const horizontal = pad.axes[axes[0]] ?? 0;
    const vertical = pad.axes[axes[1]] ?? 0;
    const result = new Set<ArcadeDirection>();
    if (vertical < 0 && Math.abs(vertical) >= deadZone) result.add("up");
    if (vertical > 0 && Math.abs(vertical) >= deadZone) result.add("down");
    if (horizontal < 0 && Math.abs(horizontal) >= deadZone) result.add("left");
    if (horizontal > 0 && Math.abs(horizontal) >= deadZone) result.add("right");
    return result;
};

// HELPER :: NUMBER, NUMBER -> NUMBER
// Removes the dead zone and rescales the remaining physical travel to the full normalized range.
const rescaledAxis = (value: number, deadZone: number): number => {
    const magnitude = Math.abs(value);
    if (magnitude <= deadZone) return 0;
    return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone));
};

/**
 *
 * Class
 *
 */

// Polls connected gamepads into one independently owned ArcadeInput channel per assigned player slot
export default class GamepadSource {

    /* Static Fields */
    static readonly DEFAULT_DEAD_ZONE = 0.25;                     // Same threshold on each left-stick axis

    /* Instance Fields */
    private readonly _input: GamepadSourceConfig["input"];        // Creates a channel only when a pad receives a slot
    private readonly _provider: GamepadProviderLike;              // Current sparse Gamepad API list
    private readonly _scheduler: GamepadSourceConfig["scheduler"];   // One request per attached, enabled tick
    private readonly _target: KeyboardEventTargetLike;            // blur target
    private readonly _visibilityTarget: KeyboardVisibilityTargetLike;   // visibilitychange target
    private readonly _deadZone: number;                           // Validated axis threshold
    private readonly _mapping: GamepadMapping | undefined;        // Optional standard override/non-standard opt-in
    private readonly _assignments = new Map<number, AssignedPad>();   // Assigned pads keyed by Gamepad index
    private readonly _onFrame: (time: number) => void;            // Bound scheduler callback
    private readonly _onBlur: (event: Event) => void;             // Bound blur listener
    private readonly _onVisibilityChange: (event: Event) => void; // Bound visibility listener
    private _frameHandle: number | null = null;                   // Outstanding scheduler request
    private _attached = false;                                    // Whether listeners and polling are installed
    private _enabled = true;                                      // Polling gate independent of attachment
    private _destroyed = false;                                   // Whether destroy() completed

    // CONSTRUCTOR :: gamepadSourceConfig -> this
    // Creates a detached source entirely from injected dependencies; call attach() to begin polling.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isGamepadSourceConfig().
    constructor(config: GamepadSourceConfig) {
        if (!isGamepadSourceConfig(config)) throw GamepadSource.invalidConfig("GamepadSource config is invalid.", config);
        this._input = config.input;
        this._provider = config.provider;
        this._scheduler = config.scheduler;
        this._target = config.target;
        this._visibilityTarget = config.visibilityTarget ?? config.target;
        this._deadZone = config.deadZone ?? GamepadSource.DEFAULT_DEAD_ZONE;
        this._mapping = config.mapping;
        this._onFrame = () => {
            this._frameHandle = null;
            if (this._destroyed || !this._attached || !this._enabled) return;
            this.poll();
            this.schedule();
        };
        this._onBlur = () => this.releaseHeld();
        this._onVisibilityChange = () => {
            if (this._visibilityTarget.visibilityState === undefined || this._visibilityTarget.visibilityState === "hidden") this.releaseHeld();
        };
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> BOOLEAN
    // Whether this source's listeners and polling lifecycle are installed.
    get isAttached(): boolean {
        return this._attached;
    }

    // GETTER :: VOID -> BOOLEAN
    // Whether an attached source polls and forwards pad snapshots.
    get enabled(): boolean {
        return this._enabled;
    }

    // SETTER :: BOOLEAN -> VOID
    // Opens or closes the polling gate; closing cancels the request and releases every pad channel.
    // NOTE: Throws INVALID_CONFIG for a non-boolean and DESTROYED after destroy().
    set enabled(value: boolean) {
        this.assertLive();
        if (typeof value !== "boolean") throw GamepadSource.invalidConfig("GamepadSource enabled must be a boolean.", value);
        this._enabled = value;
        if (!value) {
            this.cancelPolling();
            this.releaseHeld();
        } else if (this._attached) {
            this.schedule();
        }
    }

    // GETTER :: VOID -> [{player:playerIndex,id:STRING}]
    // Returns a stable player-sorted snapshot suitable for page connection displays.
    get players(): ReadonlyArray<{ readonly player: PlayerIndex; readonly id: string }> {
        return [...this._assignments.values()]
            .sort((left, right) => left.player - right.player)
            .map(({ player, id }) => ({ player, id }));
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> VOID
    // Installs blur and visibilitychange listeners and starts polling when enabled; idempotent.
    // NOTE: Throws ArcadeRuntimeError DESTROYED after destroy().
    attach(): void {
        this.assertLive();
        if (this._attached) return;
        this._target.addEventListener("blur", this._onBlur);
        this._visibilityTarget.addEventListener("visibilitychange", this._onVisibilityChange);
        this._attached = true;
        if (this._enabled) this.schedule();
    }

    // INSTANCE :: VOID -> VOID
    // Stops polling, removes installed listeners and releases every pad channel; idempotent.
    detach(): void {
        if (!this._attached) return;
        this.cancelPolling();
        this._target.removeEventListener("blur", this._onBlur);
        this._visibilityTarget.removeEventListener("visibilitychange", this._onVisibilityChange);
        this._attached = false;
        this.releaseHeld();
    }

    // INSTANCE :: VOID -> VOID
    // Detaches, releases and destroys every assigned pad channel; idempotent.
    destroy(): void {
        if (this._destroyed) return;
        this.detach();
        for (const assignment of this._assignments.values()) assignment.channel.destroy();
        this._assignments.clear();
        this._destroyed = true;
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> VOID
    // Requests the next poll only when no request is already pending.
    private schedule(): void {
        if (this._frameHandle !== null || this._destroyed || !this._attached || !this._enabled) return;
        this._frameHandle = this._scheduler.request(this._onFrame);
    }

    // PRIVATE :: VOID -> VOID
    // Cancels the outstanding poll when one exists.
    private cancelPolling(): void {
        if (this._frameHandle === null) return;
        this._scheduler.cancel(this._frameHandle);
        this._frameHandle = null;
    }

    // PRIVATE :: VOID -> VOID
    // Reconciles disconnects before assigning new pads, then forwards each assigned snapshot once.
    private poll(): void {
        const pollable: PollablePad[] = [];
        const byIndex = new Map<number, PollablePad>();
        for (const candidate of this._provider.getGamepads()) {
            if (!isGamepadLike(candidate) || !candidate.connected || byIndex.has(candidate.index)) continue;
            const mapping = this.mappingFor(candidate);
            if (mapping === null) continue;
            const entry = { pad: candidate, mapping };
            pollable.push(entry);
            byIndex.set(candidate.index, entry);
        }

        for (const assignment of [...this._assignments.values()]) {
            const current = byIndex.get(assignment.index);
            if (current === undefined || current.pad.id !== assignment.id) this.disconnect(assignment);
        }

        for (const entry of pollable) {
            if (this._assignments.has(entry.pad.index)) continue;
            const player = this.lowestFreePlayer();
            if (player === null) break;
            this._assignments.set(entry.pad.index, {
                index: entry.pad.index,
                id: entry.pad.id,
                player,
                channel: this._input.createChannel(),
                active: new Map(),
                suppressedChordButtons: new Set(),
                previousChordButtons: new Set(),
                modifierHeld: false,
                chordFired: false,
            });
        }

        for (const entry of pollable) {
            const assignment = this._assignments.get(entry.pad.index);
            if (assignment !== undefined) this.forward(assignment, entry.pad, entry.mapping);
        }
    }

    // PRIVATE :: gamepadLike -> gamepadMapping?
    // Standard pads receive defaults or an applicable override; non-standard pads require an exact id-scoped mapping.
    private mappingFor(pad: GamepadLike): GamepadMapping | null {
        if (pad.mapping === "standard") {
            if (this._mapping === undefined) return DEFAULT_MAPPING;
            return this._mapping.id === undefined || this._mapping.id === pad.id ? this._mapping : DEFAULT_MAPPING;
        }
        return this._mapping?.id === pad.id ? this._mapping : null;
    }

    // PRIVATE :: VOID -> playerIndex?
    // Finds the first player slot not held by an assignment.
    private lowestFreePlayer(): PlayerIndex | null {
        const used = new Set([...this._assignments.values()].map(({ player }) => player));
        return PLAYER_SLOTS.find((player) => !used.has(player)) ?? null;
    }

    // PRIVATE :: assignedPad, gamepadLike, gamepadMapping -> VOID
    // Builds machine-aware digital controls, reconciles their edges, then writes declared analog axes.
    private forward(assignment: AssignedPad, pad: GamepadLike, mapping: GamepadMapping): void {
        const inputs = this._input.machine.inputs;
        const declared = new Set<MachineAnalogKind>(inputs.analog
            .filter((input) => input.player === assignment.player)
            .map((input) => input.kind));
        const leftAnalog = ["stick-x", "stick-y", "paddle", "paddle-v", "lightgun-x", "lightgun-y", "dial", "dial-v", "trackball-x", "trackball-y"]
            .some((kind) => declared.has(kind as MachineAnalogKind));
        const chordLayer = mapping.chords !== false;
        const modifier = mapping.chords !== false ? mapping.chords?.modifier ?? mapping.coin ?? DEFAULT_COIN : -1;
        const modifierDown = chordLayer && pressed(pad, modifier);
        let coinOnRelease = false;
        let controls: ArcadeControl[];
        const bindings = chordLayer ? chordBindingsFor(mapping) : [];
        if (modifierDown) {
            if (!assignment.modifierHeld) {
                assignment.chordFired = false;
                assignment.suppressedChordButtons.clear();
                for (const binding of bindings)
                    if (pressed(pad, binding.button) && assignment.previousChordButtons.has(binding.button))
                        assignment.suppressedChordButtons.add(binding.button);
            }
            controls = [];
            for (const binding of bindings) {
                if (!pressed(pad, binding.button)) {
                    assignment.suppressedChordButtons.delete(binding.button);
                    continue;
                }
                if (!assignment.suppressedChordButtons.has(binding.button)) controls.push(binding.control);
            }
            if (controls.length > 0) assignment.chordFired = true;
            assignment.modifierHeld = true;
        } else {
            coinOnRelease = chordLayer && assignment.modifierHeld && !assignment.chordFired && modifier === (mapping.coin ?? DEFAULT_COIN);
            assignment.modifierHeld = false;
            assignment.chordFired = false;
            assignment.suppressedChordButtons.clear();
            const digitalPad = chordLayer ? withoutDigitalButton(pad, modifier) : pad;
            const base = controlsFor(digitalPad, assignment.player, this._deadZone, mapping);
            controls = [...base];
            if (leftAnalog || inputs.dualStick) {
                controls = [];
                const ordinaryDirections = dpadDirections(digitalPad, mapping);
                for (const direction of DIRECTIONS)
                    if (ordinaryDirections.has(direction)) controls.push({ kind: "direction", player: assignment.player, direction });
                if (inputs.dualStick) {
                    for (const direction of DIRECTIONS)
                        if (stickDirections(digitalPad, mapping.axes ?? DEFAULT_LEFT_AXES, this._deadZone).has(direction))
                            controls.push({ kind: "stick", player: assignment.player, stick: 1, direction });
                    for (const direction of DIRECTIONS)
                        if (stickDirections(digitalPad, mapping.rightAxes ?? DEFAULT_RIGHT_AXES, this._deadZone).has(direction))
                            controls.push({ kind: "stick", player: assignment.player, stick: 2, direction });
                }
                controls.push(...base.filter((control) => control.kind !== "direction"));
            }
        }
        assignment.previousChordButtons.clear();
        for (const binding of bindings) if (pressed(pad, binding.button)) assignment.previousChordButtons.add(binding.button);
        this.forwardControls(assignment, controls);
        if (coinOnRelease) assignment.channel.tap({ kind: "coin", player: assignment.player });
        this.forwardAxes(assignment, pad, mapping, declared);
    }

    // PRIVATE :: assignedPad, [arcadeControl] -> VOID
    // Applies falling edges before rising edges, with tap semantics for coin and start.
    private forwardControls(assignment: AssignedPad, controls: ReadonlyArray<ArcadeControl>): void {
        const next = new Map(controls.map((control) => [arcadeControlKey(control), control]));
        for (const [key, control] of assignment.active) {
            if (next.has(key)) continue;
            if (control.kind !== "coin" && control.kind !== "start") assignment.channel.release(control);
        }
        for (const [key, control] of next) {
            if (assignment.active.has(key)) continue;
            if (control.kind === "coin" || control.kind === "start") assignment.channel.tap(control);
            else assignment.channel.press(control);
        }
        assignment.active.clear();
        for (const [key, control] of next) assignment.active.set(key, control);
    }

    // PRIVATE :: assignedPad, gamepadLike, gamepadMapping, Set<machineAnalogKind> -> VOID
    // Writes only axes declared for this pad's player; relative axes emit one finite per-poll pixel delta.
    private forwardAxes(assignment: AssignedPad, pad: GamepadLike, mapping: GamepadMapping, declared: ReadonlySet<MachineAnalogKind>): void {
        const left = mapping.axes ?? DEFAULT_LEFT_AXES;
        const right = mapping.rightAxes ?? DEFAULT_RIGHT_AXES;
        const pedals = mapping.pedals ?? DEFAULT_PEDALS;
        const horizontal = rescaledAxis(pad.axes[left[0]] ?? 0, this._deadZone);
        const vertical = rescaledAxis(pad.axes[left[1]] ?? 0, this._deadZone);
        if (declared.has("stick-x") || declared.has("paddle") || declared.has("lightgun-x")) assignment.channel.setAxis({ player: assignment.player, kind: "stick-x" }, horizontal);
        if (declared.has("stick-y") || declared.has("paddle-v") || declared.has("lightgun-y")) assignment.channel.setAxis({ player: assignment.player, kind: "stick-y" }, vertical);
        if ((declared.has("dial") || declared.has("trackball-x")) && horizontal !== 0)
            assignment.channel.setAxis({ player: assignment.player, kind: "spin-x" }, horizontal * SPIN_PIXELS_PER_POLL);
        if ((declared.has("dial-v") || declared.has("trackball-y")) && vertical !== 0)
            assignment.channel.setAxis({ player: assignment.player, kind: "spin-y" }, vertical * SPIN_PIXELS_PER_POLL);
        if (declared.has("stick-z"))
            assignment.channel.setAxis({ player: assignment.player, kind: "stick-z" }, rescaledAxis(pad.axes[right[1]] ?? 0, this._deadZone));
        if (declared.has("pedal-1"))
            assignment.channel.setAxis({ player: assignment.player, kind: "pedal-1" }, (pad.buttons[pedals[0]]?.value ?? 0) * 2 - 1);
        if (declared.has("pedal-2"))
            assignment.channel.setAxis({ player: assignment.player, kind: "pedal-2" }, (pad.buttons[pedals[1]]?.value ?? 0) * 2 - 1);
    }

    // PRIVATE :: assignedPad -> VOID
    // Releases and destroys one pad channel before freeing its player slot.
    private disconnect(assignment: AssignedPad): void {
        assignment.channel.releaseAll();
        assignment.active.clear();
        assignment.suppressedChordButtons.clear();
        assignment.previousChordButtons.clear();
        assignment.modifierHeld = false;
        assignment.chordFired = false;
        assignment.channel.destroy();
        this._assignments.delete(assignment.index);
    }

    // PRIVATE :: VOID -> VOID
    // Releases every assigned channel and resets edge state so held inputs can rise again after polling resumes.
    private releaseHeld(): void {
        if (this._destroyed) return;
        for (const assignment of this._assignments.values()) {
            assignment.channel.releaseAll();
            assignment.active.clear();
            assignment.suppressedChordButtons.clear();
            assignment.previousChordButtons.clear();
            assignment.modifierHeld = false;
            assignment.chordFired = false;
        }
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after destroy() has completed.
    private assertLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "GamepadSource has been destroyed.",
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: gamepadSourceInitConfig -> gamepadSource
    // Supplies navigator, requestAnimationFrame, window and document only when their corresponding dependencies are omitted.
    static init(config: GamepadSourceInitConfig): GamepadSource {
        if (!isGamepadSourceInitConfig(config)) return new GamepadSource(config as GamepadSourceConfig);
        const browserWindow = typeof globalThis.window === "undefined" ? undefined : globalThis.window;
        const browserDocument = typeof globalThis.document === "undefined" ? undefined : globalThis.document;
        const browserNavigator = typeof globalThis.navigator === "undefined" ? undefined : globalThis.navigator;
        const provider = config.provider ?? (browserNavigator !== undefined && typeof browserNavigator.getGamepads === "function"
            ? { getGamepads: () => browserNavigator.getGamepads() }
            : undefined);
        const scheduler = config.scheduler ?? (browserWindow !== undefined
            && typeof browserWindow.requestAnimationFrame === "function"
            && typeof browserWindow.cancelAnimationFrame === "function"
            ? {
                request: (callback: (time: number) => void) => browserWindow.requestAnimationFrame(callback),
                cancel: (handle: number) => browserWindow.cancelAnimationFrame(handle),
            }
            : undefined);
        const target = config.target ?? browserWindow;
        const visibilityTarget = config.visibilityTarget ?? (config.target === undefined ? browserDocument ?? target : target);
        return new GamepadSource({ ...config, provider, scheduler, target, visibilityTarget } as GamepadSourceConfig);
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected value.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
