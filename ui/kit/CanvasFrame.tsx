// realizes: docs/ui-design-language.md > §3.5 Canvas frame

import type { ReactNode } from "react";

export interface CanvasFrameProps { readonly paused?: boolean; readonly children?: ReactNode; readonly idleText?: string; }
export function CanvasFrame({ paused = false, children, idleText = "ready" }: CanvasFrameProps) {
    return <div className="canvas-frame" data-component="canvas-frame" data-state={paused ? "paused" : children === undefined ? "empty" : "running"}>{children ?? <div className="canvas-empty">{idleText}</div>}{paused ? <div className="paused-overlay">PAUSED</div> : null}</div>;
}
