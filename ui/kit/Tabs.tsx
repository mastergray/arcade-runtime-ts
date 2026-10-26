// realizes: docs/ui-design-language.md > §3.3 Tabs

import { useFocusable } from "../focus/FocusController.js";

export interface TabDefinition {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
}

export interface TabsProps {
    readonly id: string;
    readonly tabs: ReadonlyArray<TabDefinition>;
    readonly active: string;
    readonly onChange: (id: string) => void;
    readonly arrowSelect?: boolean;
}

function Tab({ stripId, tab, active, onChange, onStep }: { readonly stripId: string; readonly tab: TabDefinition; readonly active: boolean; readonly onChange: (id: string) => void; readonly onStep?: (step: number) => void }) {
    const focusable = useFocusable(`${stripId}-${tab.id}`, stripId, { disabled: tab.disabled, onActivate: () => onChange(tab.id), selector: onStep !== undefined, onLeft: () => onStep?.(-1), onRight: () => onStep?.(1) });
    return <button
        ref={focusable.ref as never}
        type="button"
        role="tab"
        className="tab"
        disabled={tab.disabled}
        data-component="tab"
        data-tab={tab.id}
        data-on={active}
        data-disabled={tab.disabled ?? false}
        data-focus={focusable["data-focus"]}
        data-state={tab.disabled ? "disabled" : focusable["data-focus"] ? "focus" : active ? "on" : "off"}
        aria-selected={active}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
        onClick={() => onChange(tab.id)}
    >{tab.label}</button>;
}

export function Tabs({ id, tabs, active, onChange, arrowSelect = false }: TabsProps) {
    const step = (offset: number): void => {
        const available = tabs.filter((tab) => !tab.disabled);
        const next = available[(available.findIndex((tab) => tab.id === active) + offset + available.length) % available.length];
        if (next !== undefined) onChange(next.id);
    };
    return <div className="tabs" role="tablist" data-component="tabs">
        {tabs.map((tab) => <Tab stripId={id} tab={tab} active={tab.id === active} onChange={onChange} onStep={arrowSelect ? step : undefined} key={tab.id} />)}
    </div>;
}
