// realizes: docs/ui-design-language.md > §3.2 Red button

export interface RedButtonProps { readonly number: number; readonly mini?: boolean; readonly off?: boolean; readonly pressed?: boolean; }
export function RedButton({ number, mini = false, off = false, pressed = false }: RedButtonProps) {
    return <button type="button" className="red-button" data-component="red-button" data-mini={mini} data-off={off} data-pressed={pressed} aria-label={`Button ${number}`}>{number}</button>;
}
