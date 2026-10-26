// realizes: docs/ui-design-language.md > §3.2 Drop zone

export interface DropZoneProps { readonly dragOver?: boolean; }
export function DropZone({ dragOver = false }: DropZoneProps) {
    return <div className="drop-zone" data-component="drop-zone" data-drag-over={dragOver} data-state={dragOver ? "drag-over" : "default"}><div><div className="drop-primary">Import</div><div>Stored files</div></div></div>;
}
