// realizes: docs/ui-spec.md > §3.5 and §4.5 preference store v2

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { DEFAULT_KEYBOARD_MAP } from "../../src/index.ts";
import {
    PreferenceStore,
    preferenceRecordKeys,
    type PreferenceStorage,
    type SavedPlayStore,
} from "../../ui/model/preferences.ts";
import type { TestFile } from "../run.ts";

class MemoryStorage implements PreferenceStorage {
    readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    setItem(key: string, value: string): void { this.values.set(key, value); }
    removeItem(key: string): void { this.values.delete(key); }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
}

class MemorySavedPlay implements SavedPlayStore {
    readonly values = new Map<string, Uint8Array>();
    async list(): Promise<ReadonlyArray<{ readonly key: string; readonly bytes: Uint8Array }>> {
        return [...this.values].map(([key, bytes]) => ({ key, bytes: bytes.slice() }));
    }
    async put(key: string, bytes: Uint8Array): Promise<void> { this.values.set(key, bytes.slice()); }
}

interface PreferenceV2Result {
    readonly fallbacks: boolean;
    readonly presentationFallbacks: boolean;
    readonly presentationTransfer: boolean;
    readonly olderExport: boolean;
    readonly resolved: boolean;
    readonly listed: boolean;
    readonly roundTrip: boolean;
    readonly overwritePreview: boolean;
    readonly overwritten: boolean;
    readonly savedPlay: boolean;
}

const inspectV2 = async (): Promise<PreferenceV2Result> => {
    const storage = new MemoryStorage();
    const saved = new MemorySavedPlay();
    const preferences = new PreferenceStore(storage, saved, () => new Date("2026-10-25T12:00:00.000Z"));
    storage.setItem(preferenceRecordKeys.global, JSON.stringify({
        controllerView: true,
        general: { fullscreenOnStart: true, muteOnStart: "invalid" },
        video: { filter: "smooth", crop: { left: 4, right: 80 } },
        audio: { volume: 0.4 },
        storage: { strictness: "mame" },
        controls: { stickCentre: 0.3, keyboard: null },
    }));
    const global = preferences.getGlobal();
    const fallbacks = global.controllerView && global.general.fullscreenOnStart && !global.general.muteOnStart
        && global.video.filter === "smooth" && global.video.crop.left === 0 && global.video.crop.right === 0
        && global.audio.volume === 0.4 && global.storage.strictness === "mame" && global.controls.stickCentre === 0.3;

    const presentationDefault = global.general.presentationHint && global.general.mode === "local";
    storage.setItem(preferenceRecordKeys.global, JSON.stringify({ ...global, general: { ...global.general, mode: "invalid", presentationHint: "invalid" } }));
    const invalid = preferences.getGlobal();
    const presentationFallbacks = presentationDefault && invalid.general.mode === "local" && invalid.general.presentationHint;

    const key = "sample-family/sample_machine";
    const keyboard = { ...DEFAULT_KEYBOARD_MAP, KeyT: { kind: "button" as const, player: 1 as const, button: 1 as const } };
    preferences.setGlobal({
        ...global,
        general: { ...global.general, mode: "presentation", presentationHint: false },
        controls: { ...global.controls, keyboard: DEFAULT_KEYBOARD_MAP, gamepads: { "Sample pad": { id: "Sample pad", start: 7 } } },
        analog: { "p1:paddle": { travel: 1.5 } },
    });
    preferences.setGame(key, {
        slots: {},
        controls: { keyboard, gamepads: { "Sample pad": { id: "Sample pad", start: 9 } } },
        analog: { "p1:paddle": { travel: 2, invert: true } },
        video: { crop: { left: 6, right: 2 } },
    });
    const resolved = preferences.resolveGame(key);
    const resolvedOk = resolved.controls.keyboard.KeyT?.kind === "button"
        && resolved.controls.gamepads["Sample pad"]?.start === 9
        && resolved.analog["p1:paddle"]?.invert === true
        && resolved.video.crop.left === 6;
    const override = preferences.listOverrides()[0];
    const listed = override?.key === key
        && override.descriptions.includes("Controls (keyboard)")
        && override.descriptions.includes("Steering travel")
        && override.descriptions.includes("Invert steering")
        && override.descriptions.includes("Side borders");

    saved.values.set(key, new Uint8Array([1, 3, 5, 7]));
    const exported = await preferences.exportPreferences({ includeSavedPlay: true });
    const importedStorage = new MemoryStorage();
    const importedSaved = new MemorySavedPlay();
    const imported = new PreferenceStore(importedStorage, importedSaved);
    const first = await imported.importPreferences(exported, { overwrite: false });
    const roundTrip = first.applied && imported.resolveGame(key).video.crop.left === 6
        && imported.listOverrides().length === 1;
    const presentationTransfer = imported.getGlobal().general.mode === "presentation" && !imported.getGlobal().general.presentationHint;
    const oldDocument = JSON.parse(exported) as { global: { general: { mode?: string; presentationHint?: boolean } } };
    delete oldDocument.global.general.mode;
    delete oldDocument.global.general.presentationHint;
    const oldImport = new PreferenceStore(new MemoryStorage(), new MemorySavedPlay());
    const oldResult = await oldImport.importPreferences(JSON.stringify(oldDocument), { overwrite: false });
    const olderExport = oldResult.applied && oldImport.getGlobal().general.mode === "local" && oldImport.getGlobal().general.presentationHint;
    const savedPlay = JSON.stringify([...(importedSaved.values.get(key) ?? [])]) === JSON.stringify([1, 3, 5, 7]);

    imported.updateGlobal({ audio: { volume: 0.9 } });
    const preview = await imported.importPreferences(exported, { overwrite: false });
    const overwritePreview = !preview.applied && preview.overwrites.includes("global") && imported.getGlobal().audio.volume === 0.9;
    const replacement = await imported.importPreferences(exported, { overwrite: true });
    const overwritten = replacement.applied && imported.getGlobal().audio.volume === 0.4;
    return { fallbacks, presentationFallbacks, presentationTransfer, olderExport, resolved: resolvedOk, listed, roundTrip, overwritePreview, overwritten, savedPlay };
};

const testFile: TestFile = {
    label: "local UI preference records version 2",
    cases: [{
        label: "field fallbacks, game resolution, override listing and export import preserve independent records",
        run: () => CTGTest.init("local UI preferences version 2")
            .stage("exercise the complete store", inspectV2)
            .assert("the version 2 contract is stable", (state) => state.subject, P.equals<PreferenceV2Result>({
                fallbacks: true,
                presentationFallbacks: true,
                presentationTransfer: true,
                olderExport: true,
                resolved: true,
                listed: true,
                roundTrip: true,
                overwritePreview: true,
                overwritten: true,
                savedPlay: true,
            }))
            .start(undefined),
    }],
};

export default testFile;
