// realizes: docs/ui-design-language.md > §3.2 Range

import type { InputHTMLAttributes } from "react";

export interface RangeProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
    readonly label: string;
    readonly value: number;
    readonly valueLabel?: string;
    readonly onChange: (value: number) => void;
}

export function Range({ label, value, valueLabel = String(value), onChange, className = "", ...props }: RangeProps) {
    return <label className={`range ${className}`.trim()} data-component="range">
        <span>{label}</span>
        <input {...props} type="range" value={value} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} />
        <output>{valueLabel}</output>
    </label>;
}
