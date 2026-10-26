// realizes: docs/ui-design-language.md > §3.5 Controller strip

import { Card } from "./Card.js";
import { DPad } from "./DPad.js";
import { Pill } from "./Pill.js";
import { RedButton } from "./RedButton.js";

export interface ControllerStripProps { readonly pressedButton?: number; readonly pressedDirection?: "up" | "down" | "left" | "right"; }

export function ControllerStrip({ pressedButton, pressedDirection }: ControllerStripProps) {
    return <section className="controller-strip" data-component="controller-strip">
        <DPad pressed={pressedDirection} />
        <div className="controller-centre">
            <Card seed="controller" />
            <div className="switch-row"><span>Cabinet</span><span>Operator</span></div>
            <div className="pill-row"><Pill label="COIN" /><Pill label="START" /></div>
        </div>
        <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} pressed={number === pressedButton} key={number} />)}</div>
    </section>;
}
