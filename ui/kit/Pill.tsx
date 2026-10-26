// realizes: docs/ui-design-language.md > §3.2 Pill

export interface PillProps { readonly label: string; readonly mini?: boolean; readonly pressed?: boolean; readonly onPress?: () => void; }
export function Pill({ label, mini = false, pressed = false, onPress }: PillProps) {
    return <button type="button" className="pill" data-component="pill" data-mini={mini} data-pressed={pressed} data-state={pressed ? "pressed" : "default"} onClick={onPress}>{label}</button>;
}
