// realizes: docs/ui-design-language.md > §3.2 D-pad

export interface DPadProps {
    readonly mini?: boolean;
    readonly pressed?: "up" | "down" | "left" | "right";
    readonly onPress?: (direction: "up" | "down" | "left" | "right") => void;
    readonly onHold?: (direction: "up" | "down" | "left" | "right", pressed: boolean) => void;
}

const cells = ["", "up", "", "left", "centre", "right", "", "down", ""] as const;

export function DPad({ mini = false, pressed, onPress, onHold }: DPadProps) {
    return <div className="dpad" data-component="d-pad" data-mini={mini} data-state={pressed === undefined ? "default" : "pressed"}>{cells.map((cell, index) => cell === ""
        ? <span key={index} />
        : <button type="button" className="dpad-key" data-control={cell} data-centre={cell === "centre"} data-pressed={cell === pressed} disabled={cell === "centre"} aria-label={cell}
            onClick={cell === "centre" || onHold !== undefined ? undefined : () => onPress?.(cell)}
            onPointerDown={cell === "centre" ? undefined : (event) => { event.currentTarget.setPointerCapture(event.pointerId); onHold?.(cell, true); }}
            onPointerUp={cell === "centre" ? undefined : () => onHold?.(cell, false)}
            onPointerCancel={cell === "centre" ? undefined : () => onHold?.(cell, false)} key={cell} />)}</div>;
}
