// realizes: docs/ui-design-language.md > §3.2 Red button

export interface RedButtonProps { readonly number: number; readonly mini?: boolean; readonly off?: boolean; readonly pressed?: boolean; readonly onPress?: () => void; readonly onHold?: (pressed: boolean) => void; }
export function RedButton({ number, mini = false, off = false, pressed = false, onPress, onHold }: RedButtonProps) {
    return <button type="button" className="red-button" data-component="red-button" data-control={`button-${number}`} data-mini={mini} data-off={off} data-pressed={pressed} data-state={pressed ? "pressed" : off ? "off" : "default"} aria-label={`Button ${number}`} onClick={onHold === undefined ? onPress : undefined}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onHold?.(true); }} onPointerUp={() => onHold?.(false)} onPointerCancel={() => onHold?.(false)}>{number}</button>;
}
