// realizes: docs/ui-spec.md > §4.5 Preference store and §7 State/View preferences

import type { LocalSize, LocalSlot } from "./types.js";

export interface PreferenceStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface GlobalPreferences {
    readonly controllerView: boolean;
    readonly size: LocalSize;
    readonly showFps: boolean;
    readonly autoSave: boolean;
}

export interface SlotRecord {
    readonly savedAt: string;
    readonly thumbnail?: string;
}

export interface GamePreferences {
    readonly slots: Readonly<Partial<Record<LocalSlot, SlotRecord>>>;
}

export const DEFAULT_GLOBAL_PREFERENCES: GlobalPreferences = Object.freeze({
    controllerView: false,
    size: "fit",
    showFps: false,
    autoSave: true,
});

export const DEFAULT_GAME_PREFERENCES: GamePreferences = Object.freeze({ slots: Object.freeze({}) });

const PREFIX = "arcade-runtime:ui:";
const GLOBAL_KEY = `${PREFIX}global`;
const GAME_KEY = (key: string): string => `${PREFIX}game:${key}`;
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

const slotRecord = (value: unknown): SlotRecord | null => {
    const candidate = record(value);
    if (candidate === null || typeof candidate.savedAt !== "string" || Number.isNaN(Date.parse(candidate.savedAt))) return null;
    if (candidate.thumbnail !== undefined && typeof candidate.thumbnail !== "string") return null;
    return Object.freeze({ savedAt: candidate.savedAt, ...(candidate.thumbnail === undefined ? {} : { thumbnail: candidate.thumbnail }) });
};

export class PreferenceStore {
    constructor(private readonly storage: PreferenceStorage) {}

    hasGlobalRecord(): boolean {
        try { return this.storage.getItem(GLOBAL_KEY) !== null; }
        catch { return false; }
    }

    getGlobal(): GlobalPreferences {
        const value = parsedRecord(this.storage, GLOBAL_KEY);
        return Object.freeze({
            controllerView: typeof value?.controllerView === "boolean" ? value.controllerView : DEFAULT_GLOBAL_PREFERENCES.controllerView,
            size: SIZES.includes(value?.size as LocalSize) ? value!.size as LocalSize : DEFAULT_GLOBAL_PREFERENCES.size,
            showFps: typeof value?.showFps === "boolean" ? value.showFps : DEFAULT_GLOBAL_PREFERENCES.showFps,
            autoSave: typeof value?.autoSave === "boolean" ? value.autoSave : DEFAULT_GLOBAL_PREFERENCES.autoSave,
        });
    }

    setGlobal(next: GlobalPreferences): GlobalPreferences {
        const value = Object.freeze({ ...next });
        this.storage.setItem(GLOBAL_KEY, JSON.stringify(value));
        return value;
    }

    updateGlobal(changes: Partial<GlobalPreferences>): GlobalPreferences {
        return this.setGlobal({ ...this.getGlobal(), ...changes });
    }

    getGame(key: string): GamePreferences {
        const value = parsedRecord(this.storage, GAME_KEY(key));
        const source = record(value?.slots);
        const slots: Partial<Record<LocalSlot, SlotRecord>> = {};
        for (const slot of SLOTS) {
            const item = slotRecord(source?.[slot]);
            if (item !== null) slots[slot] = item;
        }
        return Object.freeze({ slots: Object.freeze(slots) });
    }

    setSlot(key: string, slot: LocalSlot, value: SlotRecord): GamePreferences {
        const current = this.getGame(key);
        const validated = slotRecord(value);
        if (validated === null) throw new TypeError("Slot record requires an ISO timestamp and optional thumbnail string.");
        const next = Object.freeze({ slots: Object.freeze({ ...current.slots, [slot]: validated }) });
        this.storage.setItem(GAME_KEY(key), JSON.stringify(next));
        return next;
    }

    clearSlots(key: string): void {
        this.storage.removeItem(GAME_KEY(key));
    }
}

export const preferenceRecordKeys = Object.freeze({ global: GLOBAL_KEY, game: GAME_KEY });

