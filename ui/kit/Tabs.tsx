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
}

function Tab({ stripId, tab, active, onChange }: { readonly stripId: string; readonly tab: TabDefinition; readonly active: boolean; readonly onChange: (id: string) => void }) {
    const focusable = useFocusable(`${stripId}-${tab.id}`, stripId, { disabled: tab.disabled, onActivate: () => onChange(tab.id) });
    return <button
        ref={focusable.ref as never}
        type="button"
        role="tab"
        className="tab"
        disabled={tab.disabled}
        data-component="tab"
        data-on={active}
        data-disabled={tab.disabled ?? false}
        data-focus={focusable["data-focus"]}
        aria-selected={active}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
        onClick={() => onChange(tab.id)}
    >{tab.label}</button>;
}

export function Tabs({ id, tabs, active, onChange }: TabsProps) {
    return <div className="tabs" role="tablist" data-component="tabs">
        {tabs.map((tab) => <Tab stripId={id} tab={tab} active={tab.id === active} onChange={onChange} key={tab.id} />)}
    </div>;
}
