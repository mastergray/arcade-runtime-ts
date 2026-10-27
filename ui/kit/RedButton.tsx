// realizes: docs/ui-design-language.md > §3.2 Red button

import { useEffect, useRef, useState } from "react";

export interface RedButtonProps { readonly number: number; readonly mini?: boolean; readonly off?: boolean; readonly pressed?: boolean; readonly onPress?: () => void; readonly onHold?: (pressed: boolean) => void; }
export function RedButton({ number, mini = false, off = false, pressed = false, onPress, onHold }: RedButtonProps) {
    const pointers = useRef(new Set<number>());
    const callback = useRef(onHold);
    callback.current = onHold;
    const [held, setHeld] = useState(false);
    const release = (id: number): void => {
        if (!pointers.current.delete(id) || pointers.current.size > 0) return;
        setHeld(false);
        callback.current?.(false);
    };
    const press = (id: number): void => {
        if (off || pointers.current.has(id)) return;
        if (pointers.current.size === 0) callback.current?.(true);
        pointers.current.add(id);
        setHeld(true);
    };
    useEffect(() => () => { if (pointers.current.size > 0) callback.current?.(false); }, []);
    return <button type="button" className="red-button" data-component="red-button" data-control={`button-${number}`} data-mini={mini} data-off={off} data-pressed={pressed || held} data-state={pressed || held ? "pressed" : off ? "off" : "default"} aria-label={`Button ${number}`} disabled={off} onClick={onHold === undefined ? onPress : undefined}
        onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(event.pointerId); }}
        onPointerUp={(event) => release(event.pointerId)} onPointerCancel={(event) => release(event.pointerId)} onLostPointerCapture={(event) => release(event.pointerId)}
        onKeyDown={(event) => { if (onHold !== undefined && (event.key === " " || event.key === "Enter")) { event.preventDefault(); press(-1); } }}
        onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") release(-1); }} onBlur={() => release(-1)}>{number}</button>;
}
