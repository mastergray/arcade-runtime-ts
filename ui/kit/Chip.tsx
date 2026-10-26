// realizes: docs/ui-design-language.md > §3.2 Chip

export interface ChipProps { readonly label: string; readonly on?: boolean; }
export function Chip({ label, on = false }: ChipProps) {
    return <span className="chip" data-component="chip" data-on={on}>{label}</span>;
}
