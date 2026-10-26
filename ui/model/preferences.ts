// realizes: docs/ui-spec.md > §3.4, §3.5 and §4.5 preference store v2

import {
    DEFAULT_KEYBOARD_MAP,
    isAnalogSettings,
    isGamepadMapping,
    isKeyboardMap,
    type AnalogSettings,
    type GamepadMapping,
    type KeyboardMap,
} from "../../src/index.js";
import type { LocalSize, LocalSlot } from "./types.js";

export interface PreferenceStorage {
    readonly length?: number;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key?(index: number): string | null;
}

export interface SavedPlayStore {
    list(): Promise<ReadonlyArray<{ readonly key: string; readonly bytes: Uint8Array }>>;
    put(key: string, bytes: Uint8Array): Promise<void>;
}

export type VideoFilter = "pixelated" | "smooth";
export type AuditPolicy = "strict" | "mame";

export interface DisplayCropPreference {
    readonly left: number;
    readonly right: number;
}

export interface GlobalPreferences {
    readonly controllerView: boolean;
    readonly size: LocalSize;
    readonly showFps: boolean;
    readonly autoSave: boolean;
    readonly general: {
        readonly fullscreenOnStart: boolean;
        readonly muteOnStart: boolean;
        readonly presentationHint: boolean;
        readonly mode: "local" | "presentation";
    };
    readonly video: {
        readonly filter: VideoFilter;
        readonly crop: DisplayCropPreference;
    };
    readonly audio: { readonly volume: number };
    readonly storage: { readonly strictness: AuditPolicy };
    readonly controls: {
        readonly keyboard: KeyboardMap | null;
        readonly gamepads: Readonly<Record<string, GamepadMapping>>;
        readonly menuGesture: Readonly<Record<string, ReadonlyArray<number>>>;
        readonly stickCentre: number;
    };
    readonly analog: AnalogSettings;
}

export interface SlotRecord {
    readonly savedAt: string;
    readonly thumbnail?: string;
}

export interface GamePreferences {
    readonly slots: Readonly<Partial<Record<LocalSlot, SlotRecord>>>;
    readonly controls?: {
        readonly keyboard?: KeyboardMap;
        readonly gamepads?: Readonly<Record<string, GamepadMapping>>;
    };
    readonly analog?: AnalogSettings;
    readonly video?: { readonly crop?: DisplayCropPreference };
}

export interface ResolvedGamePreferences extends GlobalPreferences {
    readonly controls: {
        readonly keyboard: KeyboardMap;
        readonly gamepads: Readonly<Record<string, GamepadMapping>>;
        readonly menuGesture: Readonly<Record<string, ReadonlyArray<number>>>;
        readonly stickCentre: number;
    };
}

export interface PreferenceOverride {
    readonly key: string;
    readonly descriptions: ReadonlyArray<string>;
}

export interface ExportedPreferencesV2 {
    readonly version: 2;
    readonly exportedAt: string;
    readonly global: GlobalPreferences;
    readonly games: Readonly<Record<string, GamePreferences>>;
    readonly savedPlay?: Readonly<Record<string, string>>;
}

export interface ImportPreferencesResult {
    readonly applied: boolean;
    readonly imported: ReadonlyArray<string>;
    readonly overwrites: ReadonlyArray<string>;
}

const EMPTY_MAP = Object.freeze({});
const DEFAULT_CROP = Object.freeze({ left: 0, right: 0 });

export const DEFAULT_GLOBAL_PREFERENCES: GlobalPreferences = Object.freeze({
    controllerView: false,
    size: "fit",
    showFps: false,
    autoSave: true,
    general: Object.freeze({ fullscreenOnStart: false, muteOnStart: false, presentationHint: true, mode: "local" }),
    video: Object.freeze({ filter: "pixelated", crop: DEFAULT_CROP }),
    audio: Object.freeze({ volume: 1 }),
    storage: Object.freeze({ strictness: "strict" }),
    controls: Object.freeze({ keyboard: null, gamepads: EMPTY_MAP, menuGesture: EMPTY_MAP, stickCentre: 0.25 }),
    analog: EMPTY_MAP,
});

export const DEFAULT_GAME_PREFERENCES: GamePreferences = Object.freeze({ slots: Object.freeze({}) });

const PREFIX = "arcade-runtime:ui:";
const GLOBAL_KEY = `${PREFIX}global`;
const GAME_INDEX_KEY = `${PREFIX}games`;
const GAME_PREFIX = `${PREFIX}game:`;
const GAME_KEY = (key: string): string => `${GAME_PREFIX}${key}`;
const SIZES: ReadonlyArray<LocalSize> = ["fit", "stretch", "integer"];
const SLOTS: ReadonlyArray<LocalSlot> = ["slot1", "slot2", "slot3"];

const record = (value: unknown): Record<string, unknown> | null => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const parsedRecord = (storage: PreferenceStorage, key: string): Record<string, unknown> | null => {
    try {
        const source = storage.getItem(key);
        return source === null ? null : record(JSON.parse(source));
    } catch {
        return null;
    }
};

const finiteRange = (value: unknown, minimum: number, maximum: number): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;

const cropRecord = (value: unknown): DisplayCropPreference | null => {
    const candidate = record(value);
    if (candidate === null || !Number.isInteger(candidate.left) || !Number.isInteger(candidate.right)) return null;
    const left = candidate.left as number;
    const right = candidate.right as number;
    return left >= 0 && left <= 32 && right >= 0 && right <= 32 ? Object.freeze({ left, right }) : null;
};

const slotRecord = (value: unknown): SlotRecord | null => {
    const candidate = record(value);
    if (candidate === null || typeof candidate.savedAt !== "string" || Number.isNaN(Date.parse(candidate.savedAt))) return null;
    if (candidate.thumbnail !== undefined && typeof candidate.thumbnail !== "string") return null;
    return Object.freeze({ savedAt: candidate.savedAt, ...(candidate.thumbnail === undefined ? {} : { thumbnail: candidate.thumbnail }) });
};

const keyboardMap = (value: unknown): KeyboardMap | null => isKeyboardMap(value) ? Object.freeze({ ...value }) : null;

const gamepadMappings = (value: unknown): Readonly<Record<string, GamepadMapping>> => {
    const source = record(value);
    if (source === null) return EMPTY_MAP;
    const result: Record<string, GamepadMapping> = {};
    for (const [id, mapping] of Object.entries(source)) {
        if (id.length > 0 && isGamepadMapping(mapping)) result[id] = Object.freeze({ ...mapping, id });
    }
    return Object.freeze(result);
};

const menuGestures = (value: unknown): Readonly<Record<string, ReadonlyArray<number>>> => {
    const source = record(value);
    if (source === null) return EMPTY_MAP;
    const result: Record<string, ReadonlyArray<number>> = {};
    for (const [id, buttons] of Object.entries(source)) {
        if (id.length === 0 || !Array.isArray(buttons) || buttons.length === 0
            || !buttons.every((button) => Number.isInteger(button) && button >= 0)) continue;
        result[id] = Object.freeze([...new Set(buttons as number[])].sort((left, right) => left - right));
    }
    return Object.freeze(result);
};

const analogSettings = (value: unknown): AnalogSettings => isAnalogSettings(value)
    ? Object.freeze(Object.fromEntries(Object.entries(value).map(([key, setting]) => [key, Object.freeze({ ...setting })])) as AnalogSettings)
    : EMPTY_MAP;

const globalRecord = (value: unknown): GlobalPreferences => {
    const source = record(value);
    const general = record(source?.general);
    const video = record(source?.video);
    const audio = record(source?.audio);
    const storage = record(source?.storage);
    const controls = record(source?.controls);
    return Object.freeze({
        controllerView: typeof source?.controllerView === "boolean" ? source.controllerView : false,
        size: SIZES.includes(source?.size as LocalSize) ? source!.size as LocalSize : "fit",
        showFps: typeof source?.showFps === "boolean" ? source.showFps : false,
        autoSave: typeof source?.autoSave === "boolean" ? source.autoSave : true,
        general: Object.freeze({
            fullscreenOnStart: typeof general?.fullscreenOnStart === "boolean" ? general.fullscreenOnStart : false,
            muteOnStart: typeof general?.muteOnStart === "boolean" ? general.muteOnStart : false,
            presentationHint: typeof general?.presentationHint === "boolean" ? general.presentationHint : true,
            mode: general?.mode === "presentation" ? "presentation" : "local",
        }),
        video: Object.freeze({
            filter: video?.filter === "smooth" || video?.filter === "pixelated" ? video.filter : "pixelated",
            crop: cropRecord(video?.crop) ?? DEFAULT_CROP,
        }),
        audio: Object.freeze({ volume: finiteRange(audio?.volume, 0, 1) ? audio.volume : 1 }),
        storage: Object.freeze({ strictness: storage?.strictness === "mame" ? "mame" : "strict" }),
        controls: Object.freeze({
            keyboard: controls?.keyboard === null ? null : keyboardMap(controls?.keyboard),
            gamepads: gamepadMappings(controls?.gamepads),
            menuGesture: menuGestures(controls?.menuGesture),
            stickCentre: finiteRange(controls?.stickCentre, 0, 0.9) ? controls.stickCentre : 0.25,
        }),
        analog: analogSettings(source?.analog),
    });
};

const gameRecord = (value: unknown): GamePreferences => {
    const source = record(value);
    const slotsSource = record(source?.slots);
    const slots: Partial<Record<LocalSlot, SlotRecord>> = {};
    for (const slot of SLOTS) {
        const item = slotRecord(slotsSource?.[slot]);
        if (item !== null) slots[slot] = item;
    }
    const controlsSource = record(source?.controls);
    const keyboard = controlsSource?.keyboard === undefined ? null : keyboardMap(controlsSource.keyboard);
    const pads = gamepadMappings(controlsSource?.gamepads);
    const analog = analogSettings(source?.analog);
    const videoSource = record(source?.video);
    const crop = cropRecord(videoSource?.crop);
    const controls = keyboard === null && Object.keys(pads).length === 0
        ? undefined
        : Object.freeze({ ...(keyboard === null ? {} : { keyboard }), ...(Object.keys(pads).length === 0 ? {} : { gamepads: pads }) });
    return Object.freeze({
        slots: Object.freeze(slots),
        ...(controls === undefined ? {} : { controls }),
        ...(Object.keys(analog).length === 0 ? {} : { analog }),
        ...(crop === null ? {} : { video: Object.freeze({ crop }) }),
    });
};

const stableJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    const source = record(value);
    if (source !== null) return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${stableJson(source[key])}`).join(",")}}`;
    return JSON.stringify(value);
};
const jsonEqual = (left: unknown, right: unknown): boolean => stableJson(left) === stableJson(right);
const validGameKey = (key: unknown): key is string => typeof key === "string" && /^[^/\s]+\/[^/\s]+$/.test(key);

const settingName = (key: string): string => {
    const kind = key.slice(key.indexOf(":") + 1);
    if (kind === "paddle") return "Steering";
    if (kind === "paddle-v") return "Vertical paddle";
    if (kind === "stick-x") return "Horizontal stick";
    if (kind === "stick-y") return "Vertical stick";
    if (kind.startsWith("pedal-")) return `Pedal ${kind.slice(-1)}`;
    return kind.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
};

const descriptionsFor = (game: GamePreferences): string[] => {
    const descriptions: string[] = [];
    if (game.controls?.keyboard !== undefined) descriptions.push("Controls (keyboard)");
    if (game.controls?.gamepads !== undefined && Object.keys(game.controls.gamepads).length > 0) descriptions.push("Controls (gamepad)");
    for (const [key, setting] of Object.entries(game.analog ?? {})) {
        const name = settingName(key);
        if (setting?.keySpeed !== undefined) descriptions.push(`${name} keyboard speed`);
        if (setting?.centreSpeed !== undefined) descriptions.push(`${name} centring`);
        if (setting?.travel !== undefined) descriptions.push(`${name} travel`);
        if (setting?.invert !== undefined) descriptions.push(`Invert ${name.toLowerCase()}`);
    }
    if (game.video?.crop !== undefined) descriptions.push("Side borders");
    return descriptions;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
};

const base64ToBytes = (source: string): Uint8Array => {
    const binary = atob(source);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    if (bytesToBase64(bytes).replace(/=+$/, "") !== source.replace(/=+$/, "")) throw new TypeError("Saved play must be valid base64.");
    return bytes;
};

export class PreferenceStore {
    constructor(
        private readonly storage: PreferenceStorage,
        private readonly savedPlay: SavedPlayStore | null = null,
        private readonly now: () => Date = () => new Date(),
    ) {}

    hasGlobalRecord(): boolean {
        try { return this.storage.getItem(GLOBAL_KEY) !== null; }
        catch { return false; }
    }

    getGlobal(): GlobalPreferences { return globalRecord(parsedRecord(this.storage, GLOBAL_KEY)); }

    setGlobal(next: GlobalPreferences): GlobalPreferences {
        const value = globalRecord(next);
        this.storage.setItem(GLOBAL_KEY, JSON.stringify(value));
        return value;
    }

    updateGlobal(changes: Partial<GlobalPreferences>): GlobalPreferences {
        return this.setGlobal({ ...this.getGlobal(), ...changes });
    }

    resetGlobal(): GlobalPreferences {
        this.storage.removeItem(GLOBAL_KEY);
        return this.getGlobal();
    }

    getGame(key: string): GamePreferences { return gameRecord(parsedRecord(this.storage, GAME_KEY(key))); }

    setGame(key: string, next: GamePreferences): GamePreferences {
        if (!validGameKey(key)) throw new TypeError("A game preference key must be family/machine.");
        const value = gameRecord(next);
        this.storage.setItem(GAME_KEY(key), JSON.stringify(value));
        this.rememberGame(key);
        return value;
    }

    updateGame(key: string, changes: Partial<GamePreferences>): GamePreferences {
        return this.setGame(key, { ...this.getGame(key), ...changes });
    }

    setSlot(key: string, slot: LocalSlot, value: SlotRecord): GamePreferences {
        const current = this.getGame(key);
        const validated = slotRecord(value);
        if (validated === null) throw new TypeError("Slot record requires an ISO timestamp and optional thumbnail string.");
        return this.setGame(key, { ...current, slots: { ...current.slots, [slot]: validated } });
    }

    clearSlots(key: string): void {
        const current = this.getGame(key);
        const next = gameRecord({ ...current, slots: {} });
        if (descriptionsFor(next).length === 0) this.removeGame(key);
        else this.setGame(key, next);
    }

    clearGameOverrides(key: string): void {
        const slots = this.getGame(key).slots;
        if (Object.keys(slots).length === 0) this.removeGame(key);
        else this.setGame(key, { slots });
    }

    clearAllGameOverrides(): void { for (const key of this.gameKeys()) this.clearGameOverrides(key); }

    resolveGame(key: string): ResolvedGamePreferences {
        const global = this.getGlobal();
        const game = this.getGame(key);
        const padIds = new Set([...Object.keys(global.controls.gamepads), ...Object.keys(game.controls?.gamepads ?? {})]);
        const gamepads = Object.fromEntries([...padIds].map((id) => [id, Object.freeze({
            ...global.controls.gamepads[id],
            ...game.controls?.gamepads?.[id],
            id,
        })]));
        const analogKeys = new Set([...Object.keys(global.analog), ...Object.keys(game.analog ?? {})]);
        const analog = Object.fromEntries([...analogKeys].map((analogKey) => [analogKey, Object.freeze({
            ...global.analog[analogKey as keyof AnalogSettings],
            ...game.analog?.[analogKey as keyof AnalogSettings],
        })])) as AnalogSettings;
        return Object.freeze({
            ...global,
            video: Object.freeze({ ...global.video, crop: game.video?.crop ?? global.video.crop }),
            controls: Object.freeze({
                ...global.controls,
                keyboard: game.controls?.keyboard ?? global.controls.keyboard ?? DEFAULT_KEYBOARD_MAP,
                gamepads: Object.freeze(gamepads),
            }),
            analog: Object.freeze(analog),
        });
    }

    listOverrides(): ReadonlyArray<PreferenceOverride> {
        return this.gameKeys().flatMap((key) => {
            const descriptions = descriptionsFor(this.getGame(key));
            return descriptions.length === 0 ? [] : [{ key, descriptions: Object.freeze(descriptions) }];
        });
    }

    async savedPlayCount(): Promise<number> { return this.savedPlay === null ? 0 : (await this.savedPlay.list()).length; }

    async exportPreferences(options: { readonly includeSavedPlay: boolean }): Promise<string> {
        const games = Object.fromEntries(this.gameKeys().map((key) => [key, this.getGame(key)]));
        const document: ExportedPreferencesV2 = {
            version: 2,
            exportedAt: this.now().toISOString(),
            global: this.getGlobal(),
            games,
            ...(options.includeSavedPlay && this.savedPlay !== null ? {
                savedPlay: Object.fromEntries((await this.savedPlay.list()).map(({ key, bytes }) => [key, bytesToBase64(bytes)])),
            } : {}),
        };
        return JSON.stringify(document, null, 2);
    }

    async importPreferences(json: string, options: { readonly overwrite: boolean }): Promise<ImportPreferencesResult> {
        let parsed: unknown;
        try { parsed = JSON.parse(json); }
        catch { throw new TypeError("The settings file is not valid JSON."); }
        const source = record(parsed);
        if (source === null || source.version !== 2 || typeof source.exportedAt !== "string" || Number.isNaN(Date.parse(source.exportedAt))) {
            throw new TypeError("The settings file is not a version 2 preference document.");
        }
        if (record(source.global) === null || record(source.games) === null) throw new TypeError("The settings file is missing global or game records.");
        const global = globalRecord(source.global);
        // Older v2 exports predate these additive fields; still reject explicitly invalid values.
        const importedGlobal = source.global as Record<string, unknown>;
        const importedGeneral = record(importedGlobal.general);
        const compatibleGlobal = { ...importedGlobal, general: {
            presentationHint: true, mode: "local", ...importedGeneral,
        } };
        if (!jsonEqual(compatibleGlobal, global)) throw new TypeError("The settings file contains invalid global values.");
        const games: Record<string, GamePreferences> = {};
        for (const [key, value] of Object.entries(source.games as Record<string, unknown>)) {
            if (!validGameKey(key) || record(value) === null) throw new TypeError("The settings file contains an invalid game record.");
            games[key] = gameRecord(value);
            if (!jsonEqual(value, games[key])) throw new TypeError("The settings file contains an invalid game record.");
        }
        const savedSource = source.savedPlay === undefined ? null : record(source.savedPlay);
        if (source.savedPlay !== undefined && savedSource === null) throw new TypeError("The saved-play record is invalid.");
        const saved = savedSource === null ? {} : Object.fromEntries(Object.entries(savedSource).map(([key, value]) => {
            if (!validGameKey(key) || typeof value !== "string") throw new TypeError("The saved-play record is invalid.");
            return [key, base64ToBytes(value)];
        }));
        const imported = ["global", ...Object.keys(games).map((key) => `game:${key}`), ...Object.keys(saved).map((key) => `savedPlay:${key}`)];
        const overwrites: string[] = [];
        const currentGlobal = parsedRecord(this.storage, GLOBAL_KEY);
        if (currentGlobal !== null && !jsonEqual(globalRecord(currentGlobal), global)) overwrites.push("global");
        for (const [key, game] of Object.entries(games)) {
            const current = parsedRecord(this.storage, GAME_KEY(key));
            if (current !== null && !jsonEqual(gameRecord(current), game)) overwrites.push(`game:${key}`);
        }
        if (this.savedPlay !== null) {
            const currentSaved = new Map((await this.savedPlay.list()).map(({ key, bytes }) => [key, bytes]));
            for (const [key, bytes] of Object.entries(saved)) {
                const current = currentSaved.get(key);
                if (current !== undefined && !jsonEqual([...current], [...bytes])) overwrites.push(`savedPlay:${key}`);
            }
        } else if (Object.keys(saved).length > 0) throw new TypeError("This browser cannot import saved play.");
        if (overwrites.length > 0 && !options.overwrite) {
            return { applied: false, imported: Object.freeze(imported), overwrites: Object.freeze(overwrites) };
        }
        this.setGlobal(global);
        for (const [key, game] of Object.entries(games)) this.setGame(key, game);
        if (this.savedPlay !== null) for (const [key, bytes] of Object.entries(saved)) await this.savedPlay.put(key, bytes);
        return { applied: true, imported: Object.freeze(imported), overwrites: Object.freeze(overwrites) };
    }

    private gameKeys(): string[] {
        const keys = new Set<string>();
        try {
            const index = JSON.parse(this.storage.getItem(GAME_INDEX_KEY) ?? "[]") as unknown;
            if (Array.isArray(index)) for (const key of index) if (validGameKey(key)) keys.add(key);
            if (typeof this.storage.length === "number" && this.storage.key !== undefined) {
                for (let offset = 0; offset < this.storage.length; offset++) {
                    const storageKey = this.storage.key(offset);
                    if (storageKey?.startsWith(GAME_PREFIX)) {
                        const key = storageKey.slice(GAME_PREFIX.length);
                        if (validGameKey(key)) keys.add(key);
                    }
                }
            }
        } catch { /* A corrupt index is rebuilt on the next write. */ }
        return [...keys].sort((left, right) => left.localeCompare(right));
    }

    private rememberGame(key: string): void {
        const keys = new Set(this.gameKeys());
        keys.add(key);
        this.storage.setItem(GAME_INDEX_KEY, JSON.stringify([...keys].sort((left, right) => left.localeCompare(right))));
    }

    private removeGame(key: string): void {
        this.storage.removeItem(GAME_KEY(key));
        const keys = this.gameKeys().filter((candidate) => candidate !== key);
        if (keys.length === 0) this.storage.removeItem(GAME_INDEX_KEY);
        else this.storage.setItem(GAME_INDEX_KEY, JSON.stringify(keys));
    }
}

export class IndexedDbSavedPlayStore implements SavedPlayStore {
    constructor(private readonly indexedDB: IDBFactory) {}

    async list(): Promise<ReadonlyArray<{ readonly key: string; readonly bytes: Uint8Array }>> {
        return this.withStore("readonly", (store) => new Promise((resolve, reject) => {
            const entries: Array<{ readonly key: string; readonly bytes: Uint8Array }> = [];
            const request = store.openCursor();
            request.onerror = () => reject(request.error ?? new Error("Saved play could not be read."));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor === null) { resolve(entries); return; }
                if (typeof cursor.key === "string" && cursor.value instanceof Uint8Array) entries.push({ key: cursor.key, bytes: cursor.value.slice() });
                cursor.continue();
            };
        }));
    }

    async put(key: string, bytes: Uint8Array): Promise<void> {
        await this.withStore("readwrite", (store) => new Promise<void>((resolve, reject) => {
            const request = store.put(bytes.slice(), key);
            request.onerror = () => reject(request.error ?? new Error("Saved play could not be imported."));
            request.onsuccess = () => resolve();
        }));
    }

    private withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const request = this.indexedDB.open("arcade-runtime", 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains("overlays")) request.result.createObjectStore("overlays");
            };
            request.onerror = () => reject(request.error ?? new Error("Saved play storage could not be opened."));
            request.onsuccess = () => {
                const database = request.result;
                let transaction: IDBTransaction;
                try { transaction = database.transaction("overlays", mode); }
                catch (error) { database.close(); reject(error); return; }
                operation(transaction.objectStore("overlays")).then(resolve, reject).finally(() => database.close());
            };
        });
    }
}

export const preferenceRecordKeys = Object.freeze({ global: GLOBAL_KEY, game: GAME_KEY });
