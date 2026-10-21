// realizes: docs/arcade-runtime-spec.md > §6 ArcadeInput

// Dependencies:
import ArcadeRuntimeError from "../ArcadeRuntimeError/ArcadeRuntimeError.js";   // Typed argument and lifecycle failures

// Type dependencies:
import {
    arcadeControlKey,                                             // Canonical identity and release ordering
    isArcadeControl,                                              // Guards every public control argument
    type ArcadeControl,                                           // Digital arcade input vocabulary
    type ArcadeControlKey,                                        // Canonical key used by hold maps
    type ArcadeSession,                                           // Session receiving first-press and last-release changes
    type Unsubscribe,                                             // Tick subscription remover
} from "../shared.types.js";
import {
    isArcadeInputConfig,                                          // Guards construction
    type ArcadeInputChannel,                                      // Independently owned source channel
    type ArcadeInputConfig,                                       // Construction config
} from "./types.js";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: channel-local held controls, pending taps and lifecycle state
// Internal state captured by the structural ArcadeInputChannel methods.
interface ChannelState {
    readonly held: Map<ArcadeControlKey, ArcadeControl>;           // This channel's controls by canonical key
    readonly taps: Map<ArcadeControlKey, number>;                  // Emulated ticks remaining for tap-created holds
    destroyed: boolean;                                           // Whether channel destroy() completed
}

// INTERFACE :: {control:arcadeControl, holders:Set<channelState>}
// One globally held control and every channel contributing to its reference count.
interface HeldControl {
    readonly control: ArcadeControl;                               // Stable copied control sent to the session
    readonly holders: Set<ChannelState>;                           // Channels currently holding it
}

/**
 *
 * Class
 *
 */

// Reference-counted arcade controls over a session, with independently releasable source channels and frame-timed taps
export default class ArcadeInput {

    /* Static Fields */
    private static readonly DEFAULT_HOLD_FRAMES = 3;               // Tap duration when the caller omits it

    /* Instance Fields */
    private readonly _session: ArcadeSession;                      // Session receiving first presses and last releases
    private readonly _channels = new Set<ChannelState>();          // Every live channel, including the default
    private readonly _held = new Map<ArcadeControlKey, HeldControl>();   // Globally held controls and reference owners
    private readonly _defaultChannel: ArcadeInputChannel;          // Channel behind the instance convenience methods
    private readonly _unsubscribeTick: Unsubscribe;                // Removes the tap clock subscription
    private _destroyed = false;                                    // Whether destroy() completed

    // CONSTRUCTOR :: arcadeInputConfig -> this
    // Creates one default channel and subscribes tap timing to the session's emulated-frame ticks.
    // NOTE: Throws ArcadeRuntimeError INVALID_CONFIG when config fails isArcadeInputConfig().
    constructor(config: ArcadeInputConfig) {
        if (!isArcadeInputConfig(config)) throw ArcadeInput.invalidConfig("ArcadeInput config must hold an ArcadeSession.", config);
        this._session = config.session;
        this._defaultChannel = this.newChannel();
        this._unsubscribeTick = this._session.onTick(() => this.tick());
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> [arcadeControl]
    // Returns every globally held control in canonical arcadeControlKey order.
    get snapshot(): ReadonlyArray<ArcadeControl> {
        return [...this._held.values()]
            .sort((left, right) => arcadeControlKey(left.control).localeCompare(arcadeControlKey(right.control)))
            .map((entry) => entry.control);
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: VOID -> arcadeInputChannel
    // Creates an independent channel whose releases affect only its own holds.
    // NOTE: Throws ArcadeRuntimeError DESTROYED after destroy().
    createChannel(): ArcadeInputChannel {
        this.assertLive();
        return this.newChannel();
    }

    // INSTANCE :: arcadeControl -> VOID
    // Presses through the default channel.
    // NOTE: Throws INVALID_CONFIG for a bad control and DESTROYED after destroy().
    press(control: ArcadeControl): void {
        this._defaultChannel.press(control);
    }

    // INSTANCE :: arcadeControl -> VOID
    // Releases through the default channel.
    // NOTE: Throws INVALID_CONFIG for a bad control and DESTROYED after destroy().
    release(control: ArcadeControl): void {
        this._defaultChannel.release(control);
    }

    // INSTANCE :: arcadeControl, NUMBER? -> VOID
    // Presses through the default channel and releases after holdFrames emulated ticks.
    // NOTE: holdFrames must be a positive integer; the default is three.
    // NOTE: Throws INVALID_CONFIG for a bad argument and DESTROYED after destroy().
    tap(control: ArcadeControl, holdFrames = ArcadeInput.DEFAULT_HOLD_FRAMES): void {
        this._defaultChannel.tap(control, holdFrames);
    }

    // INSTANCE :: VOID -> VOID
    // Releases every channel's holds in canonical order.
    // NOTE: Throws ArcadeRuntimeError DESTROYED after destroy().
    releaseAll(): void {
        this.assertLive();
        this.releaseEverything();
    }

    // INSTANCE :: VOID -> VOID
    // Releases all controls, removes the tick subscription and destroys every channel; idempotent.
    destroy(): void {
        if (this._destroyed) return;
        this.releaseEverything();
        this._unsubscribeTick();
        this._destroyed = true;
        for (const channel of this._channels) {
            channel.taps.clear();
            channel.destroyed = true;
        }
        this._channels.clear();
    }

    /**
     *
     * Private Methods
     *
     */

    // PRIVATE :: VOID -> arcadeInputChannel
    // Allocates one channel state and returns its closure-backed public operations.
    private newChannel(): ArcadeInputChannel {
        const channel: ChannelState = { held: new Map(), taps: new Map(), destroyed: false };
        this._channels.add(channel);
        return {
            press: (control) => this.pressFor(channel, control),
            release: (control) => this.releaseFor(channel, control),
            tap: (control, holdFrames = ArcadeInput.DEFAULT_HOLD_FRAMES) => this.tapFor(channel, control, holdFrames),
            releaseAll: () => this.releaseChannel(channel),
            destroy: () => this.destroyChannel(channel),
        };
    }

    // PRIVATE :: channelState, arcadeControl -> VOID
    // Adds one channel hold, first clearing an opposite direction globally for SOCD last-input-wins.
    private pressFor(channel: ChannelState, control: ArcadeControl): void {
        this.assertChannelLive(channel);
        const stable = ArcadeInput.controlCopy(control);
        const key = arcadeControlKey(stable);
        if (channel.held.has(key)) return;
        const opposite = ArcadeInput.oppositeKey(stable);
        if (opposite !== null && this._held.has(opposite)) this.releaseEveryHolder(opposite);
        const existing = this._held.get(key);
        if (existing === undefined) {
            this._session.setControl(stable, true);
            this._held.set(key, { control: stable, holders: new Set([channel]) });
        } else {
            existing.holders.add(channel);
        }
        channel.held.set(key, stable);
    }

    // PRIVATE :: channelState, arcadeControl -> VOID
    // Removes one channel hold and forwards a release only when it was the last owner.
    private releaseFor(channel: ChannelState, control: ArcadeControl): void {
        this.assertChannelLive(channel);
        if (!isArcadeControl(control)) throw ArcadeInput.invalidConfig("ArcadeInput release requires an ArcadeControl.", control);
        this.releaseKeyFor(channel, arcadeControlKey(control));
    }

    // PRIVATE :: channelState, arcadeControl, NUMBER -> VOID
    // Creates a hold with a frame countdown; tapping a control this channel already owns is a no-op.
    private tapFor(channel: ChannelState, control: ArcadeControl, holdFrames: number): void {
        this.assertChannelLive(channel);
        if (!isArcadeControl(control)) throw ArcadeInput.invalidConfig("ArcadeInput tap requires an ArcadeControl.", control);
        if (!Number.isInteger(holdFrames) || holdFrames <= 0) throw ArcadeInput.invalidConfig("ArcadeInput tap holdFrames must be a positive integer.", holdFrames);
        const key = arcadeControlKey(control);
        if (channel.held.has(key)) return;
        this.pressFor(channel, control);
        channel.taps.set(key, holdFrames);
    }

    // PRIVATE :: channelState -> VOID
    // Releases one channel's holds in canonical order.
    private releaseChannel(channel: ChannelState): void {
        this.assertChannelLive(channel);
        for (const key of [...channel.held.keys()].sort((left, right) => left.localeCompare(right))) this.releaseKeyFor(channel, key);
    }

    // PRIVATE :: channelState -> VOID
    // Releases and retires one channel; a second destroy is a no-op while the owning input remains live.
    private destroyChannel(channel: ChannelState): void {
        this.assertLive();
        if (channel.destroyed) return;
        this.releaseChannel(channel);
        channel.destroyed = true;
        channel.taps.clear();
        this._channels.delete(channel);
    }

    // PRIVATE :: channelState, arcadeControlKey -> VOID
    // Releases one known key for a channel without re-validating its already-stable control.
    private releaseKeyFor(channel: ChannelState, key: ArcadeControlKey): void {
        const control = channel.held.get(key);
        if (control === undefined) {
            channel.taps.delete(key);
            return;
        }
        const held = this._held.get(key);
        if (held === undefined) {
            channel.held.delete(key);
            channel.taps.delete(key);
            return;
        }
        if (held.holders.size === 1) {
            this._session.setControl(held.control, false);
            this._held.delete(key);
        } else {
            held.holders.delete(channel);
        }
        channel.held.delete(key);
        channel.taps.delete(key);
    }

    // PRIVATE :: arcadeControlKey -> VOID
    // Releases a control from the session and removes it from every owning channel, used by SOCD.
    private releaseEveryHolder(key: ArcadeControlKey): void {
        const held = this._held.get(key);
        if (held === undefined) return;
        this._session.setControl(held.control, false);
        this._held.delete(key);
        for (const channel of held.holders) {
            channel.held.delete(key);
            channel.taps.delete(key);
        }
    }

    // PRIVATE :: VOID -> VOID
    // Releases every globally held control in canonical order and clears all channel references.
    private releaseEverything(): void {
        for (const key of [...this._held.keys()].sort((left, right) => left.localeCompare(right))) this.releaseEveryHolder(key);
    }

    // PRIVATE :: VOID -> VOID
    // Advances every pending tap by one emulated frame and releases those reaching zero.
    private tick(): void {
        if (this._destroyed) return;
        for (const channel of this._channels) {
            for (const [key, remaining] of [...channel.taps]) {
                if (remaining > 1) {
                    channel.taps.set(key, remaining - 1);
                    continue;
                }
                this.releaseKeyFor(channel, key);
            }
        }
    }

    // PRIVATE :: VOID -> VOID
    // Throws DESTROYED after destroy() has completed.
    private assertLive(): void {
        if (this._destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "ArcadeInput has been destroyed.",
        });
    }

    // PRIVATE :: channelState -> VOID
    // Throws DESTROYED when either the input or this channel has been destroyed.
    private assertChannelLive(channel: ChannelState): void {
        this.assertLive();
        if (channel.destroyed) throw new ArcadeRuntimeError({
            code: ArcadeRuntimeError.CODE.DESTROYED,
            message: "ArcadeInput channel has been destroyed.",
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: arcadeInputConfig -> arcadeInput
    // Mirrors the constructor.
    static init(config: ArcadeInputConfig): ArcadeInput {
        return new ArcadeInput(config);
    }

    // STATIC :: arcadeControl -> arcadeControl
    // Validates and returns a frozen plain copy so caller mutation cannot corrupt canonical hold identity.
    private static controlCopy(control: ArcadeControl): ArcadeControl {
        if (!isArcadeControl(control)) throw ArcadeInput.invalidConfig("ArcadeInput press requires an ArcadeControl.", control);
        switch (control.kind) {
            case "direction": return Object.freeze({ kind: control.kind, player: control.player, direction: control.direction });
            case "button": return Object.freeze({ kind: control.kind, player: control.player, button: control.button });
            case "coin":
            case "start":
            case "select": return Object.freeze({ kind: control.kind, player: control.player });
            default: return Object.freeze({ kind: control.kind });
        }
    }

    // STATIC :: arcadeControl -> arcadeControlKey?
    // Returns the same-player opposite direction key, or null for non-direction controls.
    private static oppositeKey(control: ArcadeControl): ArcadeControlKey | null {
        if (control.kind !== "direction") return null;
        const opposites = { up: "down", down: "up", left: "right", right: "left" } as const;
        return arcadeControlKey({ kind: "direction", player: control.player, direction: opposites[control.direction] });
    }

    // STATIC :: STRING, UNKNOWN -> arcadeRuntimeError
    // Builds an INVALID_CONFIG error carrying the rejected value.
    private static invalidConfig(message: string, data: unknown): ArcadeRuntimeError {
        return new ArcadeRuntimeError({ code: ArcadeRuntimeError.CODE.INVALID_CONFIG, message, data });
    }
}
