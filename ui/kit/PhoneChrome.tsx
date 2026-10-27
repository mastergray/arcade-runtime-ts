// realizes: docs/ui-design-language.md > §3 phone bar, side panels, switches and Menu list

import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { SwitchRow, type StripSwitch } from "./ControllerStrip.js";

export function PhoneBar({ children }: { readonly children: ReactNode }) {
    return <nav className="phone-bar" data-phone-bar aria-label="Game actions">{children}</nav>;
}

export function SidePanel({ side, children }: { readonly side: "directions" | "buttons"; readonly children: ReactNode }) {
    return <section className="phone-side-panel" data-side-panel={side}>{children}</section>;
}

export function SwitchesRow({ cabinet = [], operator = [], onSwitch }: { readonly cabinet?: ReadonlyArray<StripSwitch>; readonly operator?: ReadonlyArray<StripSwitch>; readonly onSwitch: (id: string) => void }) {
    return <div className="phone-switches" data-switches-row>
        <SwitchRow label="Cabinet" switches={cabinet} onSwitch={onSwitch} />
        <SwitchRow label="Operator" switches={operator} onSwitch={onSwitch} />
    </div>;
}

export function MenuListItem({ id, label, small, disabled = false, onSelect }: { readonly id: string; readonly label: string; readonly small?: string; readonly disabled?: boolean; readonly onSelect: () => void }) {
    return <Button className="phone-menu-item" data-phone-menu-item={id} disabled={disabled} label={<><span>{label}</span><small>{small}</small></>} onClick={onSelect} />;
}
