// realizes: docs/ui-spec.md > §1.1 Presentation menu gesture edges

import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";
import { MenuGestureDetector, type GestureSample } from "../../ui/model/gesture.ts";
import type { TestFile } from "../run.ts";

const pad = (down: number[], id = "Synthetic pad", length = 16): GestureSample => ({
    id, buttons: Array.from({ length }, (_, button) => down.includes(button)),
});

const testFile: TestFile = {
    label: "presentation menu gestures",
    cases: [{
        label: "only the rising edge of the complete set fires, including release of just one button",
        run: () => CTGTest.init("full-set edges")
            .assert("partial presses, holds and releases are distinct", () => {
                const detector = new MenuGestureDetector({}, [10, 11]);
                return [[], [10], [10], [10, 11], [10, 11], [11], [10, 11], [], [10, 11]]
                    .map((down) => detector.sample([pad(down)]).length);
            }, P.equals([0, 0, 0, 1, 0, 0, 1, 0, 1])).start(undefined),
    }, {
        label: "pad identities choose independent overrides and fallback sets",
        run: () => CTGTest.init("per-pad gestures")
            .assert("one-button overrides and fallback fire independently", () => {
                const detector = new MenuGestureDetector({ custom: [3] }, [10, 11]);
                return [
                    detector.sample([pad([3], "custom"), pad([10], "fallback")]),
                    detector.sample([pad([3], "custom"), pad([10, 11], "fallback")]),
                    detector.sample([pad([], "custom"), pad([10, 11], "fallback")]),
                    detector.sample([pad([3], "custom"), pad([10, 11], "fallback")]),
                ];
            }, P.equals<ReadonlyArray<ReadonlyArray<string>>>([["custom"], ["fallback"], [], ["custom"]])).start(undefined),
    }, {
        label: "short pads have no gesture until a fitting set is configured",
        run: () => CTGTest.init("missing gesture")
            .assert("missing status and live reconfiguration agree", () => {
                const detector = new MenuGestureDetector({}, [10, 11]);
                const short = pad([0, 1], "short", 2);
                const missing = "missing" in detector.status(short) && detector.sample([short]).length === 0;
                detector.update({ short: [1] });
                const heldDoesNotFire = detector.sample([short]).length === 0;
                detector.sample([pad([], "short", 2)]);
                return { missing, heldDoesNotFire, status: detector.status(short), fired: detector.sample([short]) };
            }, P.equals<{ missing: boolean; heldDoesNotFire: boolean; status: ReturnType<MenuGestureDetector["status"]>; fired: ReadonlyArray<string> }>({ missing: true, heldDoesNotFire: true, status: { buttons: [1] }, fired: ["short"] })).start(undefined),
    }, {
        label: "update swaps sets live, preserves held edges and disconnect rearms the pad",
        run: () => CTGTest.init("gesture update")
            .assert("the old set stops firing immediately", () => {
                const detector = new MenuGestureDetector({}, [10, 11]);
                detector.sample([pad([])]);
                detector.update({ "Synthetic pad": [2, 3] });
                const results = [detector.sample([pad([10, 11])]), detector.sample([pad([2])]), detector.sample([pad([2, 3])])];
                detector.update({});
                results.push(detector.sample([pad([2, 3])]), detector.sample([pad([10, 11])]));
                detector.sample([]);
                results.push(detector.sample([pad([10, 11])]));
                return results;
            }, P.equals<ReadonlyArray<ReadonlyArray<string>>>([[], [], ["Synthetic pad"], [], ["Synthetic pad"], ["Synthetic pad"]])).start(undefined),
    }],
};

export default testFile;
