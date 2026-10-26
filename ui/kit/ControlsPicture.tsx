// realizes: docs/ui-design-language.md > §3.5 Controls picture

import { DPad } from "./DPad.js";
import { Pill } from "./Pill.js";
import { RedButton } from "./RedButton.js";

export function ControlsPicture() {
    return <figure className="controls-picture" data-component="controls-picture">
        <DPad mini />
        <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} mini off={number > 4} key={number} />)}</div>
        <div className="pill-row"><Pill label="COIN" mini /><Pill label="START" mini /></div>
        <figcaption className="controls-note">Controls · Player 1</figcaption>
    </figure>;
}
