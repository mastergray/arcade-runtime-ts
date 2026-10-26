// realizes: docs/ui-design-language.md > §3.2 Pill

export interface PillProps { readonly label: string; readonly mini?: boolean; readonly pressed?: boolean; }
export function Pill({ label, mini = false, pressed = false }: PillProps) {
    return <span className="pill" data-component="pill" data-mini={mini} data-pressed={pressed}>{label}</span>;
}
