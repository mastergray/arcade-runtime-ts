// realizes: docs/ui-design-language.md > §3.2 Bar

export interface BarProps { readonly value: 0 | 25 | 50 | 75 | 100; readonly label?: string; }
export function Bar({ value, label = "Input level" }: BarProps) {
    return <span className="bar" data-component="bar" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span className="bar-fill" data-value={value} /></span>;
}
