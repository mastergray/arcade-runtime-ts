// realizes: docs/ui-design-language.md > §3.2 Drop zone

export interface DropZoneProps {
    readonly dragOver?: boolean;
    readonly primary?: string;                                    // Bold line: what to drop
    readonly secondary?: string;                                  // Sub-line: what happens
}
export function DropZone({ dragOver = false, primary = "Drop your game zip files here", secondary = "or choose them below; nothing leaves this browser" }: DropZoneProps) {
    return <div className="drop-zone" data-component="drop-zone" data-drag-over={dragOver} data-state={dragOver ? "drag-over" : "default"}><div><div className="drop-primary">{primary}</div><div>{secondary}</div></div></div>;
}
