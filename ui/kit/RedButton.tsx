// realizes: docs/ui-design-language.md > §3.2 Red button

export interface RedButtonProps { readonly number: number; readonly mini?: boolean; readonly off?: boolean; readonly pressed?: boolean; readonly onPress?: () => void; }
export function RedButton({ number, mini = false, off = false, pressed = false, onPress }: RedButtonProps) {
    return <button type="button" className="red-button" data-component="red-button" data-mini={mini} data-off={off} data-pressed={pressed} data-state={pressed ? "pressed" : off ? "off" : "default"} aria-label={`Button ${number}`} onClick={onPress}>{number}</button>;
}
