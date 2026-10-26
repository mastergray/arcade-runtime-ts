// realizes: docs/ui-spec.md > §7.2–§7.4 play surface, controller, state and runtime actions

import {
    ArcadeCabinet,
    ArcadeStorage,
    type ArcadeAdapter,
    type ArcadeControl,
    type ArcadeInputChannel,
    type ArcadeRomStore,
    type AnalogSettings,
    type GamepadDevice,
    type ScalingMode,
} from "../../src/index.js";
import { PreferenceStore, type GlobalPreferences } from "./preferences.js";
import type { LibraryModel } from "./library.js";
import type {
    HeldStripControl,
    LocalSize,
    LocalSlot,
    ModelListener,
    SessionSnapshot,
    StripControlState,
    Unsubscribe,
} from "./types.js";

export interface SessionModelConfig {
    readonly canvas: HTMLCanvasElement;
    readonly container: HTMLElement;
    readonly library: LibraryModel;
    readonly romStore: ArcadeRomStore;
    readonly preferences: PreferenceStore;
    readonly adapter: () => ArcadeAdapter | undefined;
    readonly now?: () => Date;
    readonly getGamepads?: () => ReadonlyArray<Gamepad | null>;
    readonly publishCabinet?: (cabinet: ArcadeCabinet | null) => void;
}

const displayScaling = (size: LocalSize): ScalingMode => size;
const messageFrom = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

export class SessionModel {
    private readonly canvas: HTMLCanvasElement;
    private readonly container: HTMLElement;
    private readonly library: LibraryModel;
    private readonly romStore: ArcadeRomStore;
    private readonly preferences: PreferenceStore;
    private readonly adapter: () => ArcadeAdapter | undefined;
    private readonly now: () => Date;
    private readonly getGamepads: () => ReadonlyArray<Gamepad | null>;
    private readonly publishCabinet: (cabinet: ArcadeCabinet | null) => void;
    private readonly listeners = new Set<ModelListener>();
    private cabinetValue: ArcadeCabinet | null = null;
    private stripChannel: ArcadeInputChannel | null = null;
    private snapshotValue: SessionSnapshot = {
        status: "idle", message: "Import a game archive to begin.", activeKey: null, machine: null,
        muted: false, fullscreen: false, layout: null, pads: [], log: [], busy: false,
    };

    constructor(config: SessionModelConfig) {
        this.canvas = config.canvas;
        this.container = config.container;
        this.library = config.library;
        this.romStore = config.romStore;
        this.preferences = config.preferences;
        this.adapter = config.adapter;
        this.now = config.now ?? (() => new Date());
        this.getGamepads = config.getGamepads ?? (() => []);
        this.publishCabinet = config.publishCabinet ?? (() => undefined);
    }

    get cabinet(): ArcadeCabinet | null { return this.cabinetValue; }

    subscribe(listener: ModelListener): Unsubscribe {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    snapshot(): SessionSnapshot { return { ...this.snapshotValue, pads: [...this.snapshotValue.pads], log: [...this.snapshotValue.log] }; }

    async start(key: string): Promise<void> {
        const card = this.library.card(key);
        if (card?.metadata === null || card === null || card.report?.status !== "ok" || this.snapshotValue.busy) return;
        this.update({ busy: true, status: "loading", message: `Starting ${card.metadata.description}…` });
        try {
            await this.stop();
            const preferences = this.preferences.resolveGame(key);
            const injected = this.adapter();
            const choices = this.library.startChoices(key);
            const common = {
                canvas: this.canvas,
                container: this.container,
                game: {
                    machine: card.indexed.machine,
                    machineHints: { players: 2 as const, buttons: 6 as const },
                    roms: this.library.startSources(key),
                    ...(choices.bios === undefined ? {} : { bios: choices.bios }),
                    dipswitches: choices.dipswitches,
                    auditStrictness: preferences.storage.strictness,
                    display: {
                        scaling: displayScaling(preferences.size),
                        imageRendering: preferences.video.filter,
                        crop: preferences.video.crop,
                    },
                },
                controls: {
                    analog: preferences.analog,
                    keyboard: { enabled: true, map: preferences.controls.keyboard },
                    gamepads: { enabled: true, mappings: preferences.controls.gamepads, deadZone: preferences.controls.stickCentre },
                },
                storage: ArcadeStorage.init({ key }),
                romStore: this.romStore,
                autosave: preferences.autoSave,
                audio: { volume: preferences.audio.volume },
            };
            const cabinet = injected === undefined
                ? await ArcadeCabinet.init({ ...common, adapterConfig: { buildUrl: card.indexed.buildUrl } })
                : await ArcadeCabinet.init({ ...common, adapter: injected });
            this.cabinetValue = cabinet;
            this.publishCabinet(cabinet);
            cabinet.player.on("status", (status) => {
                if (this.cabinetValue !== cabinet) return;
                this.appendLog(`Player status: ${status}.`);
                if (status === "running") this.update({ status: "running", message: "Running. Keyboard and gamepad controls are attached." });
                else if (status === "paused") this.update({ status: "paused", message: "Paused." });
            });
            cabinet.player.on("exit", () => {
                if (this.cabinetValue === cabinet) this.update({ status: "idle", message: "The game exited. Play it again whenever you are ready." });
            });
            cabinet.player.on("error", (error) => this.appendLog(`Player error: ${error.message}`));
            await cabinet.start();
            this.stripChannel = cabinet.player.input.createChannel();
            cabinet.player.display.onLayout((layout) => {
                if (this.cabinetValue === cabinet) this.update({ layout: { width: layout.width, height: layout.height, scale: layout.scale } });
            });
            try { await cabinet.player.audio.unlock(); }
            catch (error) { this.appendLog(`Audio unlock needs another gesture: ${messageFrom(error, "unknown audio failure")}`); }
            if (preferences.general.muteOnStart) cabinet.player.audio.mute();
            if (preferences.general.fullscreenOnStart) {
                try { await cabinet.fullscreen(); }
                catch (error) { this.appendLog(`Fullscreen on start was unavailable: ${messageFrom(error, "unknown fullscreen failure")}`); }
            }
            this.update({
                activeKey: key,
                machine: cabinet.player.machine,
                muted: cabinet.player.audio.isMuted,
                fullscreen: cabinet.player.display.isFullscreen,
                layout: { ...cabinet.player.display.layout },
                status: "running",
                message: "Running. Keyboard and gamepad controls are attached.",
            });
        } catch (error) {
            this.appendLog(`Start failed: ${messageFrom(error, "unknown start failure")}`);
            this.update({ status: "error", message: messageFrom(error, "The game could not start.") });
        } finally {
            this.update({ busy: false });
        }
    }

    async stop(): Promise<void> {
        const previous = this.cabinetValue;
        this.cabinetValue = null;
        this.publishCabinet(null);
        this.stripChannel?.destroy();
        this.stripChannel = null;
        if (previous !== null) {
            try { await previous.destroy(); }
            catch (error) { this.appendLog(`Cabinet cleanup failed: ${messageFrom(error, "unknown cleanup failure")}`); }
        }
        this.update({ activeKey: null, machine: null, layout: null, fullscreen: false });
    }

    pauseResume(): void {
        const cabinet = this.running();
        if (cabinet === null) return;
        if (cabinet.player.status === "paused") cabinet.player.resume();
        else cabinet.player.pause();
    }

    async toggleMute(): Promise<void> {
        await this.run("Sound could not be changed", async (cabinet) => {
            if (cabinet.player.audio.isMuted) {
                cabinet.player.audio.unmute();
                await cabinet.player.audio.unlock();
                this.update({ muted: false, message: "Sound is unmuted." });
            } else {
                cabinet.player.audio.mute();
                this.update({ muted: true, message: "Sound is muted." });
            }
        });
    }

    reset(kind: "soft" | "hard"): void {
        const cabinet = this.running();
        if (cabinet === null) return;
        cabinet.player.reset(kind);
        // A soft reset keeps the session running; a hard one restarts it and the player's status events follow.
        this.update({ message: kind === "soft" ? "Reset requested." : "Restart from power-on requested." });
    }

    async saveSlot(slot: LocalSlot): Promise<void> {
        await this.run("State could not be saved", async (cabinet) => {
            await cabinet.quickSave(slot);
            const thumbnail = this.thumbnail();
            this.preferences.setSlot(this.snapshotValue.activeKey!, slot, { savedAt: this.now().toISOString(), ...(thumbnail === undefined ? {} : { thumbnail }) });
            this.update({ message: `Saved to ${slot.replace("slot", "slot ")}.` });
        });
    }

    async loadSlot(slot: LocalSlot): Promise<void> {
        await this.run("State could not be loaded", async (cabinet) => {
            await cabinet.player.loadState(slot);
            this.update({ message: `Loaded ${slot.replace("slot", "slot ")}.` });
        });
    }

    async saveChanges(): Promise<void> {
        await this.run("Changes could not be saved", async (cabinet) => {
            const saved = await cabinet.save();
            this.update({ message: saved ? "Current changes were saved in this browser." : "There were no new changes to save." });
        });
    }

    async clearSavedPlay(): Promise<void> {
        await this.run("Saved play could not be cleared", async (cabinet) => {
            await cabinet.clearSaves();
            if (this.snapshotValue.activeKey !== null) this.preferences.clearSlots(this.snapshotValue.activeKey);
            this.update({ message: "Saved play was cleared. Game files were not changed." });
        });
    }

    setSize(size: LocalSize): void {
        this.preferences.updateGlobal({ size });
        if (this.cabinetValue !== null) this.cabinetValue.player.display.scaling = displayScaling(size);
        this.update({ message: `Size is ${size === "fit" ? "Fit" : size === "stretch" ? "Stretch" : "Integer"}.` });
    }

    async applyPreferences(): Promise<void> {
        const key = this.snapshotValue.activeKey;
        const global = this.preferences.getGlobal();
        if (key !== null && this.cabinetValue !== null) {
            const resolved = this.preferences.resolveGame(key);
            const cabinet = this.cabinetValue;
            cabinet.volume = resolved.audio.volume;
            cabinet.player.display.scaling = displayScaling(resolved.size);
            cabinet.player.display.imageRendering = resolved.video.filter;
            cabinet.player.display.crop = resolved.video.crop;
            cabinet.setControls({
                analog: resolved.analog,
                keyboard: { enabled: true, map: resolved.controls.keyboard },
                gamepads: { enabled: true, mappings: resolved.controls.gamepads, deadZone: resolved.controls.stickCentre },
            });
            this.update({ muted: cabinet.player.audio.isMuted, message: "Settings were applied." });
        }
        await this.library.setStrictness(global.storage.strictness);
    }

    previewGlobal(preferences: GlobalPreferences): void {
        const cabinet = this.cabinetValue;
        if (cabinet === null) return;
        cabinet.volume = preferences.audio.volume;
        cabinet.player.display.scaling = displayScaling(preferences.size);
        cabinet.player.display.imageRendering = preferences.video.filter;
        cabinet.player.display.crop = preferences.video.crop;
    }

    previewAnalog(settings: AnalogSettings): void { this.cabinetValue?.setAnalogSettings(settings); }

    setInputPaused(paused: boolean): void {
        const cabinet = this.cabinetValue;
        if (cabinet === null || !cabinet.isStarted) return;
        if (!paused) cabinet.player.input.releaseAll();
        cabinet.player.input.suspended = paused;
    }

    controlDevices(): ReadonlyArray<GamepadDevice> {
        if (this.cabinetValue?.gamepads !== null && this.cabinetValue?.gamepads !== undefined) return this.cabinetValue.gamepads.devices;
        return this.getGamepads().flatMap((pad) => pad === null ? [] : [{
            index: pad.index,
            id: pad.id,
            standard: pad.mapping === "standard",
            player: null,
        }]);
    }

    async fullscreen(stretched = false): Promise<void> {
        await this.run("Fullscreen could not be changed", async (cabinet) => {
            if (stretched) this.setSize("stretch");
            if (cabinet.player.display.isFullscreen) await cabinet.exitFullscreen();
            else await cabinet.fullscreen();
            this.update({ fullscreen: cabinet.player.display.isFullscreen, message: cabinet.player.display.isFullscreen ? "Fullscreen entered." : "Fullscreen exited." });
        });
    }

    tap(control: ArcadeControl): void { this.running()?.player.input.tap(control); }

    hold(control: HeldStripControl, pressed: boolean): void {
        const channel = this.stripChannel;
        if (channel === null) return;
        const mapped: ArcadeControl | null = control.kind === "direction" && control.direction !== undefined
            ? { kind: "direction", player: 1, direction: control.direction }
            : control.kind === "button" && control.button !== undefined
                ? { kind: "button", player: 1, button: control.button }
                : null;
        if (mapped === null) return;
        if (pressed) channel.press(mapped);
        else channel.release(mapped);
    }

    stripControls(): StripControlState {
        const machine = this.snapshotValue.machine;
        const cabinet = machine === null ? [] : [
            { id: "service", label: "Service" },
            { id: "test", label: "Test" },
            ...(machine.inputs.volume ? [{ id: "volume-down", label: "Vol −" }, { id: "volume-up", label: "Vol +" }] : []),
        ];
        return {
            buttons: machine?.buttons ?? 0,
            cabinet,
            operator: machine?.inputs.keys.map((key) => ({ id: `key:${key.key}`, label: `${key.name} (${key.key})`, key: key.key })) ?? [],
        };
    }

    refreshExternalState(): void {
        const pads = this.getGamepads().filter((pad): pad is Gamepad => pad !== null).map((pad, index) => ({ player: index + 1, id: pad.id }));
        const fullscreen = this.cabinetValue?.player.display.isFullscreen ?? false;
        this.update({ pads, fullscreen });
    }

    private running(): ArcadeCabinet | null { return this.cabinetValue?.isStarted === true ? this.cabinetValue : null; }

    private async run(fallback: string, action: (cabinet: ArcadeCabinet) => Promise<void>): Promise<void> {
        const cabinet = this.running();
        if (cabinet === null || this.snapshotValue.busy) return;
        this.update({ busy: true });
        try { await action(cabinet); }
        catch (error) {
            this.appendLog(`${fallback}: ${messageFrom(error, "unknown runtime failure")}`);
            this.update({ status: "error", message: messageFrom(error, fallback) });
        } finally { this.update({ busy: false }); }
    }

    private thumbnail(): string | undefined {
        try { return this.canvas.toDataURL("image/png"); }
        catch { return undefined; }
    }

    private appendLog(line: string): void {
        this.snapshotValue = { ...this.snapshotValue, log: [...this.snapshotValue.log, line].slice(-80) };
        this.emit();
    }

    private update(changes: Partial<SessionSnapshot>): void {
        this.snapshotValue = { ...this.snapshotValue, ...changes };
        this.emit();
    }

    private emit(): void { for (const listener of this.listeners) listener(); }
}
