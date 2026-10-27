// realizes: docs/ui-design-language.md > §3.5 Controller strip

import { Button } from "./Button.js";
import { DPad } from "./DPad.js";
import { Pill } from "./Pill.js";
import { RedButton } from "./RedButton.js";

export interface StripSwitch {
    readonly id: string;
    readonly label: string;
}

export interface ControllerStripProps {
    readonly cabinet?: ReadonlyArray<StripSwitch>;                  // Cabinet switches the running game exposes (Service, Test, Tilt, Volume)
    readonly operator?: ReadonlyArray<StripSwitch>;                 // Operator keys the running game reports (W29)
    readonly idle?: boolean;                                        // No game running: the switch rows give way to a note
    readonly touch?: boolean;
    readonly pressedButton?: number;
    readonly pressedDirection?: "up" | "down" | "left" | "right";
    readonly buttons?: number;
    readonly onSwitch?: (id: string) => void;
    readonly onButton?: (number: number) => void;
    readonly onDirection?: (direction: "up" | "down" | "left" | "right") => void;
    readonly onButtonHold?: (number: number, pressed: boolean) => void;
    readonly onDirectionHold?: (direction: "up" | "down" | "left" | "right", pressed: boolean) => void;
    readonly onCoin?: () => void;
    readonly onStart?: () => void;
}

const DEFAULT_CABINET: ReadonlyArray<StripSwitch> = [
    { id: "service", label: "Service" }, { id: "test", label: "Test" }, { id: "volume-down", label: "Vol −" }, { id: "volume-up", label: "Vol +" },
];
const DEFAULT_OPERATOR: ReadonlyArray<StripSwitch> = [
    { id: "advance", label: "Advance" }, { id: "auto-up", label: "Auto Up" }, { id: "hs-reset", label: "HS Reset" },
];

export function SwitchRow({ label, switches, onSwitch }: { readonly label: string; readonly switches: ReadonlyArray<StripSwitch>; readonly onSwitch?: (id: string) => void }) {
    if (switches.length === 0) return null;
    return <div className="switch-row" data-row={label.toLowerCase()}>
        <span className="switch-label">{label}</span>
        {switches.map((item) => <Button size="sm" label={item.label} data-control={item.id} onClick={() => onSwitch?.(item.id)} key={item.id} />)}
    </div>;
}

export function ControllerStrip({
    cabinet = DEFAULT_CABINET, operator = DEFAULT_OPERATOR, idle = false, touch = false,
    pressedButton, pressedDirection, buttons = 6, onSwitch, onButton, onDirection, onButtonHold, onDirectionHold, onCoin, onStart,
}: ControllerStripProps) {
    return <section className="controller-strip" data-component="controller-strip" data-idle={idle || undefined}>
        <DPad touch={touch} pressed={pressedDirection} onPress={onDirection} onHold={onDirectionHold} />
        <div className="controller-centre">
            {idle
                ? <p className="note">Cabinet and operator switches appear here when a game runs.</p>
                : <><SwitchRow label="Cabinet" switches={cabinet} onSwitch={onSwitch} /><SwitchRow label="Operator" switches={operator} onSwitch={onSwitch} /></>}
            <div className="pill-row"><Pill label="COIN" onPress={onCoin} /><Pill label="START" onPress={onStart} /></div>
        </div>
        <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} off={number > buttons} pressed={number === pressedButton} onPress={() => onButton?.(number)} onHold={(held) => onButtonHold?.(number, held)} key={number} />)}</div>
    </section>;
}
