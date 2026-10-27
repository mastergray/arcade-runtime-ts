// realizes: docs/ui-spec.md > §8 layouts and automatic phone controller

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { layoutFor } from "../../ui/model/layout.ts";
import { controllerVisible, PreferenceStore, preferenceRecordKeys, type PreferenceStorage } from "../../ui/model/preferences.ts";
import type { TestFile } from "../run.ts";

class MemoryStorage implements PreferenceStorage {
    readonly values = new Map<string, string>();
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    setItem(key: string, value: string): void { this.values.set(key, value); }
    removeItem(key: string): void { this.values.delete(key); }
}

const testFile: TestFile = {
    label: "phone layout and preferences",
    cases: [{
        label: "portrait, tablet, landscape and square boundaries depend on geometry, including non-touch windows",
        run: () => CTGTest.init("layout breakpoints").assert("both input capabilities select the same geometric layout", () => [false, true].map((touch) => [
            [390, 844], [699, 900], [700, 900], [1100, 1200], [1101, 1200],
            [844, 390], [900, 499], [900, 500], [1200, 800], [500, 500], [700, 700],
        ].map(([width, height]) => layoutFor({ width: width!, height: height!, touch }))), P.equals([
            ["phone-portrait", "phone-portrait", "phone-portrait", "phone-portrait", "desktop", "phone-landscape", "phone-landscape", "desktop", "desktop", "desktop", "desktop"],
            ["phone-portrait", "phone-portrait", "phone-portrait", "phone-portrait", "desktop", "phone-landscape", "phone-landscape", "desktop", "desktop", "desktop", "desktop"],
        ])).start(undefined),
    }, {
        label: "auto follows touch and connected pads, while explicit Controller choices win",
        run: () => CTGTest.init("controller resolution").assert("connect, override and disconnect", () => [
            controllerVisible("auto", false, 0), controllerVisible("auto", true, 0),
            controllerVisible("auto", true, 1), controllerVisible("auto", true, 2),
            controllerVisible(true, true, 1), controllerVisible(true, false, 0),
            controllerVisible(false, true, 0), controllerVisible("auto", true, 0),
        ], P.equals([false, true, false, false, true, true, false, true])).start(undefined),
    }, {
        label: "missing or invalid fields fall back independently and retain older explicit booleans",
        run: () => CTGTest.init("phone preference fallback").assert("auto and unswapped are the defaults", () => {
            const storage = new MemoryStorage();
            const preferences = new PreferenceStore(storage);
            return [{}, { controllerView: "invalid", swapSides: "yes", size: "integer" }, { controllerView: true, swapSides: true }, { controllerView: false }].map((value) => {
                storage.setItem(preferenceRecordKeys.global, JSON.stringify(value));
                const result = preferences.getGlobal();
                return [result.controllerView, result.swapSides, result.size];
            });
        }, P.equals<unknown[]>([["auto", false, "fit"], ["auto", false, "integer"], [true, true, "fit"], [false, false, "fit"]])).start(undefined),
    }, {
        label: "export and import carry both fields, accept older records and reject malformed new fields",
        run: () => CTGTest.init("phone preference transfer").assert("round trips do not discard phone settings", async () => {
            const source = new PreferenceStore(new MemoryStorage());
            const target = new PreferenceStore(new MemoryStorage());
            const results: boolean[] = [];
            for (const controllerView of ["auto", true, false] as const) {
                source.updateGlobal({ controllerView, swapSides: true });
                const json = await source.exportPreferences({ includeSavedPlay: false });
                await target.importPreferences(json, { overwrite: true });
                results.push(target.getGlobal().controllerView === controllerView && target.getGlobal().swapSides);
            }
            const old = JSON.parse(await source.exportPreferences({ includeSavedPlay: false }));
            delete old.global.swapSides;
            await target.importPreferences(JSON.stringify(old), { overwrite: true });
            results.push(target.getGlobal().controllerView === false && !target.getGlobal().swapSides);
            delete old.global.controllerView;
            await target.importPreferences(JSON.stringify(old), { overwrite: true });
            results.push(target.getGlobal().controllerView === "auto");
            for (const invalid of [{ controllerView: "invalid" }, { swapSides: "yes" }]) {
                try { await target.importPreferences(JSON.stringify({ ...old, global: { ...old.global, ...invalid } }), { overwrite: true }); results.push(false); }
                catch { results.push(true); }
            }
            return results;
        }, P.equals<boolean[]>([true, true, true, true, true, true, true])).start(undefined),
    }],
};
export default testFile;
