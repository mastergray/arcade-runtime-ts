// realizes: docs/ui-spec.md > §7.2 Play surface

import type { RefObject } from "react";
import { CanvasFrame } from "../kit/index.js";
import type { SessionSnapshot } from "../model/types.js";

export interface PlaySurfaceProps {
    readonly canvasRef: RefObject<HTMLCanvasElement | null>;
    readonly containerRef: RefObject<HTMLDivElement | null>;
    readonly session: SessionSnapshot;
    readonly showFps: boolean;
}

export function PlaySurface({ canvasRef, containerRef, session, showFps }: PlaySurfaceProps) {
    const running = session.status === "running" || session.status === "paused" || session.status === "loading" && session.activeKey !== null;
    const machine = session.machine;
    return <section className="play-surface" data-region="play" data-running={running}>
        <div className="play-stage" ref={containerRef} data-play-stage><CanvasFrame paused={session.status === "paused"}>
            <canvas ref={canvasRef} data-play-canvas aria-label="Arcade display" />
            {running ? null : <p className="idle-prompt">Select a ready game and choose Play.</p>}
        </CanvasFrame></div>
        {session.fullscreen ? null : <div className="play-meta" data-play-meta>
            <span data-video-size>{machine === null ? "No video" : `${machine.width} × ${machine.height}`}</span>
            {machine === null ? null : <span data-video-rate>{machine.refreshHz.toFixed(2)} Hz</span>}
            {showFps && machine !== null ? <span data-fps>{machine.refreshHz.toFixed(1)} FPS</span> : null}
        </div>}
    </section>;
}

