// realizes: docs/ui-design-language.md > §3.2 Selector

import { useFocusable } from "../focus/FocusController.js";

export interface SelectorProps {
    readonly id: string;
    readonly group?: string;
    readonly values: ReadonlyArray<string>;
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly onChange: (value: string) => void;
    readonly onActivate?: () => void;
    readonly small?: string;
}

export function Selector({ id, group = "selectors", values, value, label, disabled = false, onChange, onActivate, small }: SelectorProps) {
    const change = (step: number): void => {
        const current = Math.max(0, values.indexOf(value));
        const next = values[(current + step + values.length) % values.length];
        if (next !== undefined) onChange(next);
    };
    const focusable = useFocusable(id, group, { selector: true, disabled, onActivate, onLeft: () => change(-1), onRight: () => change(1) });
    return <div
        id={id}
        ref={focusable.ref as never}
        className="selector"
        role="group"
        aria-label={label}
        data-component="selector"
        data-disabled={disabled}
        data-focus={focusable["data-focus"]}
        data-state={disabled ? "disabled" : focusable["data-focus"] ? "focus" : "default"}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
    >
        <button className="btn selector-arrow" type="button" disabled={disabled} tabIndex={-1} aria-label="Previous" onClick={() => change(-1)}>◀</button>
        <span className="selector-value" data-selector-value>{value}{small === undefined ? null : <small>{small}</small>}</span>
        <button className="btn selector-arrow" type="button" disabled={disabled} tabIndex={-1} aria-label="Next" onClick={() => change(1)}>▶</button>
    </div>;
}
