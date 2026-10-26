// realizes: docs/ui-design-language.md > §3.2 D-pad

export interface DPadProps { readonly mini?: boolean; readonly pressed?: "up" | "down" | "left" | "right"; }

const cells = ["", "up", "", "left", "centre", "right", "", "down", ""] as const;

export function DPad({ mini = false, pressed }: DPadProps) {
    return <div className="dpad" data-component="d-pad" data-mini={mini}>{cells.map((cell, index) => cell === ""
        ? <span key={index} />
        : <button type="button" className="dpad-key" data-centre={cell === "centre"} data-pressed={cell === pressed} aria-label={cell} key={cell} />)}</div>;
}
