// realizes: docs/ui-design-language.md > §3.2 D-pad

export interface DPadProps { readonly mini?: boolean; readonly pressed?: "up" | "down" | "left" | "right"; readonly onPress?: (direction: "up" | "down" | "left" | "right") => void; }

const cells = ["", "up", "", "left", "centre", "right", "", "down", ""] as const;

export function DPad({ mini = false, pressed, onPress }: DPadProps) {
    return <div className="dpad" data-component="d-pad" data-mini={mini} data-state={pressed === undefined ? "default" : "pressed"}>{cells.map((cell, index) => cell === ""
        ? <span key={index} />
        : <button type="button" className="dpad-key" data-centre={cell === "centre"} data-pressed={cell === pressed} disabled={cell === "centre"} aria-label={cell} onClick={cell === "centre" ? undefined : () => onPress?.(cell)} key={cell} />)}</div>;
}
