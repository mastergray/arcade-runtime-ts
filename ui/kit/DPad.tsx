// realizes: docs/ui-design-language.md > §3.2 D-pad; docs/ui-spec.md > §8 touch controller

import { useEffect, useRef, useState, type PointerEvent } from "react";

type Direction = "up" | "down" | "left" | "right";
export interface DPadProps {
    readonly mini?: boolean;
    readonly touch?: boolean;
    readonly pressed?: Direction;
    readonly onPress?: (direction: Direction) => void;
    readonly onHold?: (direction: Direction, pressed: boolean) => void;
}

const cells = ["", "up", "", "left", "centre", "right", "", "down", ""] as const;
const glyphs = { up: "▲", down: "▼", left: "◀", right: "▶", centre: "" } as const;

export function DPad({ mini = false, touch = false, pressed, onPress, onHold }: DPadProps) {
    const pointer = useRef<number | null>(null);
    const held = useRef<ReadonlySet<Direction>>(new Set());
    const callback = useRef(onHold);
    callback.current = onHold;
    const [active, setActive] = useState<ReadonlySet<Direction>>(new Set());
    const change = (next: ReadonlySet<Direction>): void => {
        for (const direction of held.current) if (!next.has(direction)) callback.current?.(direction, false);
        for (const direction of next) if (!held.current.has(direction)) callback.current?.(direction, true);
        held.current = next;
        setActive(next);
    };
    const release = (): void => { pointer.current = null; change(new Set()); };
    useEffect(() => () => { for (const direction of held.current) callback.current?.(direction, false); }, []);
    const move = (event: PointerEvent<HTMLDivElement>): void => {
        if (pointer.current !== event.pointerId) return;
        // Measure the nine cells, not the element: a layout may stretch the element beyond its 3 × 3 grid (portrait
        // spans two grid rows), and the thirds must follow the cells the thumb sees.
        const cells = event.currentTarget.children;
        const first = cells[0]?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        const last = cells[8]?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - first.left) / (last.right - first.left);
        const y = (event.clientY - first.top) / (last.bottom - first.top);
        const next = new Set<Direction>();
        if (x < 0 || x >= 1 || y < 0 || y >= 1) { release(); return; }
        if (x < 1 / 3) next.add("left");
        if (x >= 2 / 3) next.add("right");
        if (y < 1 / 3) next.add("up");
        if (y >= 2 / 3) next.add("down");
        change(next);
    };
    return <div className="dpad" data-component="d-pad" data-touch={touch} data-mini={mini} data-state={active.size > 0 || pressed !== undefined ? "pressed" : "default"}
        onPointerDown={touch ? (event) => {
            if (pointer.current !== null) return;
            event.preventDefault();
            pointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            move(event);
        } : undefined}
        onPointerMove={touch ? move : undefined}
        onPointerUp={touch ? (event) => { if (pointer.current === event.pointerId) release(); } : undefined}
        onPointerCancel={touch ? (event) => { if (pointer.current === event.pointerId) release(); } : undefined}
        onLostPointerCapture={touch ? (event) => { if (pointer.current === event.pointerId) release(); } : undefined}>
        {cells.map((cell, index) => cell === ""
            ? <span data-pad-cell={index} key={index} />
            : <button type="button" className="dpad-key" data-pad-cell={index} data-control={cell} data-centre={cell === "centre"} data-pressed={cell === pressed || active.has(cell as Direction)} disabled={cell === "centre" && !touch} tabIndex={cell === "centre" ? -1 : undefined} aria-label={cell}
                onClick={cell === "centre" || onHold !== undefined ? undefined : () => onPress?.(cell)}
                onKeyDown={cell === "centre" || onHold === undefined ? undefined : (event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); change(new Set([cell])); } }}
                onKeyUp={cell === "centre" ? undefined : (event) => { if (event.key === " " || event.key === "Enter") release(); }}
                onBlur={touch ? undefined : release}
                onPointerDown={cell === "centre" || touch ? undefined : (event) => { event.currentTarget.setPointerCapture(event.pointerId); change(new Set([cell])); }}
                onPointerUp={touch ? undefined : release}
                onPointerCancel={touch ? undefined : release}
                onLostPointerCapture={touch ? undefined : release} key={cell}>{glyphs[cell]}</button>)}
    </div>;
}
