// realizes: docs/arcade-runtime-spec.md > §4.5 Generated DIP-switch cfg

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";    // Pipeline API and predicate builders
import ArcadeRuntimeError from "../../src/ArcadeRuntimeError/ArcadeRuntimeError.ts";   // Typed generator failures
import dipConfigFor from "../../src/DipConfig/dipConfigFor.ts";  // Pure cfg generator under test
import { isRomSetMetadata } from "../../src/RomSetAudit/types.ts";   // DIP metadata invariants
import { thrownBy } from "../support/fixtures.ts";                // Synchronous failure capture

// Type dependencies:
import type { RomSetMetadata } from "../../src/RomSetAudit/types.ts";   // Synthetic metadata shape
import type { TestFile } from "../run.ts";                        // Manifest contract consumed by the runner

/**
 *
 * Constants and Helpers
 *
 */

const DIPSWITCHES: NonNullable<RomSetMetadata["dipswitches"]> = [
    {
        name: "Difficulty",
        tag: "DSWA",
        mask: 3,
        values: [
            { name: "Easy", value: 3, default: true },
            { name: "Medium", value: 0, default: false },
            { name: "Hard", value: 1, default: false },
        ],
    },
    {
        name: "Lives",
        tag: "DSWB",
        mask: 192,
        values: [
            { name: "3", value: 128, default: true },
            { name: "5", value: 192, default: false },
        ],
    },
];

const metadata = (dipswitches: RomSetMetadata["dipswitches"] = DIPSWITCHES): RomSetMetadata => ({
    machine: "fake",
    family: "fake-family",
    description: "Synthetic Machine",
    cloneof: null,
    romof: null,
    bios: [],
    defaultBios: null,
    sampleof: null,
    archives: [{ name: "fake.zip", role: "game" }],
    roms: [],
    samples: [],
    ...(dipswitches === undefined ? {} : { dipswitches }),
});

const ONE_SWITCH_CFG = `<?xml version="1.0"?>
<mameconfig version="10">
    <system name="fake">
        <input>
            <port tag=":DSWA" type="DIPSWITCH" mask="3" defvalue="3" value="0"/>
        </input>
    </system>
</mameconfig>
`;

const testFile: TestFile = {
    label: "DIP cfg generation",
    cases: [
        {
            label: "emits exact MAME 0.161 cfg text with a rooted tag and omits unmentioned switches",
            run: () => CTGTest.init("one DIP selection")
                .assert("exact cfg", () => dipConfigFor("fake", DIPSWITCHES, { Difficulty: "Medium" }), P.equals(ONE_SWITCH_CFG))
                .start(undefined),
        },
        {
            label: "orders selected fields by metadata rather than record insertion order and terminates with one newline",
            run: () => CTGTest.init("deterministic DIP order")
                .assert("ordered ports", () => dipConfigFor("fake", DIPSWITCHES, { Lives: "5", Difficulty: "Hard" }), P.equals(`<?xml version="1.0"?>
<mameconfig version="10">
    <system name="fake">
        <input>
            <port tag=":DSWA" type="DIPSWITCH" mask="3" defvalue="3" value="1"/>
            <port tag=":DSWB" type="DIPSWITCH" mask="192" defvalue="128" value="192"/>
        </input>
    </system>
</mameconfig>
`))
                .start(undefined),
        },
        {
            label: "unknown switch and setting names throw INVALID_CONFIG and name the rejected selection",
            run: () => CTGTest.init("unknown DIP selections")
                .assert("typed errors", () => {
                    const unknownSwitch = thrownBy(() => dipConfigFor("fake", DIPSWITCHES, { Cabinet: "Upright" }));
                    const unknownSetting = thrownBy(() => dipConfigFor("fake", DIPSWITCHES, { Difficulty: "Impossible" }));
                    return [unknownSwitch, unknownSetting].map((error) => ({
                        runtime: ArcadeRuntimeError.is(error),
                        code: ArcadeRuntimeError.is(error) ? error.code : null,
                        message: error instanceof Error ? error.message : "",
                    }));
                }, P.equals<unknown>([
                    { runtime: true, code: 1, message: "Unknown DIP switch \"Cabinet\"." },
                    { runtime: true, code: 1, message: "Unknown setting \"Impossible\" for DIP switch \"Difficulty\"." },
                ]))
                .start(undefined),
        },
        {
            label: "RomSetMetadata accepts optional valid DIP fields and rejects every DIP-specific invariant violation",
            run: () => CTGTest.init("DIP metadata predicate")
                .assert("predicate snapshot", () => ({
                    omitted: isRomSetMetadata(metadata(undefined)),
                    valid: isRomSetMetadata(metadata()),
                    duplicateNames: isRomSetMetadata(metadata([DIPSWITCHES[0]!, { ...DIPSWITCHES[1]!, name: "difficulty" }])),
                    noDefault: isRomSetMetadata(metadata([{ ...DIPSWITCHES[0]!, values: DIPSWITCHES[0]!.values.map((setting) => ({ ...setting, default: false })) }])),
                    twoDefaults: isRomSetMetadata(metadata([{ ...DIPSWITCHES[0]!, values: DIPSWITCHES[0]!.values.map((setting) => ({ ...setting, default: true })) }])),
                    outsideMask: isRomSetMetadata(metadata([{ ...DIPSWITCHES[0]!, values: [{ name: "Invalid", value: 4, default: true }] }])),
                }), P.equals<unknown>({
                    omitted: true,
                    valid: true,
                    duplicateNames: false,
                    noDefault: false,
                    twoDefaults: false,
                    outsideMask: false,
                }))
                .start(undefined),
        },
    ],
};

export default testFile;
