// realizes: docs/ui-design-language.md > §3.2 Drop zone

import type { ReactNode } from "react";

export interface DropZoneProps {
    readonly children?: ReactNode;                                // Controls under the two lines, such as a Choose files button
    readonly dragOver?: boolean;
    readonly primary?: string;                                    // Bold line: what to drop
    readonly secondary?: string;                                  // Sub-line: what happens
}
export function DropZone({ children, dragOver = false, primary = "Drop your game zip files here", secondary = "or choose them below; nothing leaves this browser" }: DropZoneProps) {
    return <div className="drop-zone" data-component="drop-zone" data-drag-over={dragOver} data-state={dragOver ? "drag-over" : "default"}><div><div className="drop-primary">{primary}</div><div>{secondary}</div>{children === undefined ? null : <div className="drop-actions">{children}</div>}</div></div>;
}
