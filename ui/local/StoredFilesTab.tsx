// realizes: docs/ui-spec.md > §7.1 Stored files tab

import { Button, Table } from "../kit/index.js";
import { formatArchiveSize, type LibraryModel } from "../model/library.js";
import type { LibrarySnapshot } from "../model/types.js";

export function StoredFilesTab({ library, snapshot }: { readonly library: LibraryModel; readonly snapshot: LibrarySnapshot }) {
    return <div data-stored-files-tab>
        <Table id="stored-files" columns={["File", "Size", "Used by", "Action"]} rows={snapshot.stored.map((entry) => ({
            id: entry.name,
            cells: [
                <span className="technical" data-stored-file={entry.name} key="name">{entry.name}</span>,
                formatArchiveSize(entry.size),
                library.gamesUsing(entry.name).join(", ") || "Not a game",
                <Button size="sm" label="Remove" data-remove-stored={entry.name} disabled={snapshot.busy} onClick={() => { void library.removeStored(entry.name); }} key="remove" />,
            ],
        }))} />
        {snapshot.stored.length === 0 ? <p className="note">No files are saved in this browser.</p> : null}
        <div className="pane-actions"><Button label="Remove all" data-remove-all-stored disabled={snapshot.stored.length === 0 || snapshot.busy} onClick={() => { void library.clearStored(); }} /></div>
    </div>;
}

