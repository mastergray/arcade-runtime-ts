// realizes: docs/ui-design-language.md > §3.5 Canvas frame

export interface CanvasFrameProps { readonly paused?: boolean; }
export function CanvasFrame({ paused = false }: CanvasFrameProps) {
    return <div className="canvas-frame" data-component="canvas-frame"><div className="canvas-empty">ready</div>{paused ? <div className="paused-overlay">PAUSED</div> : null}</div>;
}
