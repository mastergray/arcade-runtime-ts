// realizes: package scaffold > public entry point

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import * as runtime from "../../src/index.ts";                   // Public package surface under test

// Type dependencies:
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

const testFile: TestFile = {
    label: "package scaffold",
    cases: [
        {
            label: "the public entry point loads as an ES module",
            run: () => CTGTest.init("public entry point")
                .assert("module loads", () => ({ loaded: typeof runtime === "object" }), P.equals<{ loaded: boolean }>({ loaded: true }))
                .start(undefined),
        },
    ],
};

export default testFile;
