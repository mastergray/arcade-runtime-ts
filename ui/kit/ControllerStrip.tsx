// realizes: docs/ui-design-language.md > §3.5 Controller strip

import { Card } from "./Card.js";
import { DPad } from "./DPad.js";
import { Pill } from "./Pill.js";
import { RedButton } from "./RedButton.js";

export interface ControllerStripProps {
    readonly pressedButton?: number;
    readonly pressedDirection?: "up" | "down" | "left" | "right";
    readonly onButton?: (number: number) => void;
    readonly onDirection?: (direction: "up" | "down" | "left" | "right") => void;
    readonly onCoin?: () => void;
    readonly onStart?: () => void;
}

export function ControllerStrip({ pressedButton, pressedDirection, onButton, onDirection, onCoin, onStart }: ControllerStripProps) {
    return <section className="controller-strip" data-component="controller-strip">
        <DPad pressed={pressedDirection} onPress={onDirection} />
        <div className="controller-centre">
            <Card seed="controller" />
            <div className="switch-row"><span>Cabinet</span><span>Operator</span></div>
            <div className="pill-row"><Pill label="COIN" onPress={onCoin} /><Pill label="START" onPress={onStart} /></div>
        </div>
        <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} pressed={number === pressedButton} onPress={() => onButton?.(number)} key={number} />)}</div>
    </section>;
}
