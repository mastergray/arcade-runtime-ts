// realizes: docs/ui-design-language.md > §3.2 Dot

export interface DotProps { readonly label: string; readonly tone?: "ok" | "bad" | "warn" | "off"; }
export function Dot({ label, tone = "off" }: DotProps) {
    return <span data-component="dot"><span className="dot" data-tone={tone} aria-hidden="true" />{label}</span>;
}
