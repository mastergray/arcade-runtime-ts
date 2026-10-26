// realizes: docs/ui-spec.md > §4.5 Preference store and §7 save slots

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import {
    DEFAULT_GAME_PREFERENCES,
    DEFAULT_GLOBAL_PREFERENCES,
    PreferenceStore,
    preferenceRecordKeys,
    type PreferenceStorage,
} from "../../ui/model/preferences.ts";
import type { TestFile } from "../run.ts";

class MemoryStorage implements PreferenceStorage {
    readonly values = new Map<string, string>();
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    setItem(key: string, value: string): void { this.values.set(key, value); }
    removeItem(key: string): void { this.values.delete(key); }
}

interface PreferenceResult {
    readonly defaults: boolean;
    readonly fallback: boolean;
    readonly corruptFallback: boolean;
    readonly gamesIndependent: boolean;
    readonly slotRoundTrip: boolean;
}

const inspectPreferences = (): PreferenceResult => {
    const storage = new MemoryStorage();
    const preferences = new PreferenceStore(storage);
    const defaults = JSON.stringify(preferences.getGlobal()) === JSON.stringify(DEFAULT_GLOBAL_PREFERENCES)
        && JSON.stringify(preferences.getGame("sample-family/sample_machine")) === JSON.stringify(DEFAULT_GAME_PREFERENCES);

    storage.setItem(preferenceRecordKeys.global, JSON.stringify({ controllerView: true, size: "unknown", showFps: "yes" }));
    const partial = preferences.getGlobal();
    const fallback = partial.controllerView && partial.size === "fit" && !partial.showFps && partial.autoSave;

    storage.setItem(preferenceRecordKeys.global, "{");
    const corruptFallback = JSON.stringify(preferences.getGlobal()) === JSON.stringify(DEFAULT_GLOBAL_PREFERENCES);

    const savedAt = "2026-10-25T12:34:56.000Z";
    preferences.setSlot("sample-family/sample_machine", "slot1", { savedAt, thumbnail: "data:image/png;base64,c2FtcGxl" });
    preferences.setSlot("other-family/other_machine", "slot2", { savedAt });
    const first = preferences.getGame("sample-family/sample_machine");
    const second = preferences.getGame("other-family/other_machine");
    const gamesIndependent = first.slots.slot2 === undefined && second.slots.slot1 === undefined;
    const slotRoundTrip = first.slots.slot1?.savedAt === savedAt
        && first.slots.slot1.thumbnail === "data:image/png;base64,c2FtcGxl";
    return { defaults, fallback, corruptFallback, gamesIndependent, slotRoundTrip };
};

const testFile: TestFile = {
    label: "local UI preference records",
    cases: [{
        label: "defaults and field fallbacks preserve independent game slots and thumbnail timestamps",
        run: () => CTGTest.init("local UI preferences")
            .assert("the record contract is stable", inspectPreferences, P.equals<PreferenceResult>({
                defaults: true,
                fallback: true,
                corruptFallback: true,
                gamesIndependent: true,
                slotRoundTrip: true,
            }))
            .start(undefined),
    }],
};

export default testFile;
