// realizes: docs/ui-design-language.md > §3.5 Controls picture

import { DPad } from "./DPad.js";
import { Pill } from "./Pill.js";
import { RedButton } from "./RedButton.js";
import type { ArcadeButtonCount, PlayerIndex } from "../../src/index.js";

export function ControlsPicture({ buttons = 4, player = 1 }: { readonly buttons?: ArcadeButtonCount; readonly player?: PlayerIndex }) {
    return <figure className="controls-picture" data-component="controls-picture">
        <DPad mini />
        <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} mini off={number > buttons} key={number} />)}</div>
        <div className="pill-row"><Pill label="COIN" mini /><Pill label="START" mini /></div>
        <figcaption className="controls-note">Controls · Player {player}</figcaption>
    </figure>;
}
