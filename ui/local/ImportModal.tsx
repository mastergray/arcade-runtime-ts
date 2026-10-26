// realizes: docs/ui-spec.md > §3.2 and §7.1 Import modal

import { useRef } from "react";
import { Button, DropZone, Modal, Table, Tabs } from "../kit/index.js";
import type { LibraryModel } from "../model/library.js";
import type { LibrarySnapshot } from "../model/types.js";
import { StoredFilesTab } from "./StoredFilesTab.js";

export interface ImportModalProps {
    readonly library: LibraryModel;
    readonly snapshot: LibrarySnapshot;
    readonly tab: "import" | "stored";
    readonly onTab: (tab: "import" | "stored") => void;
    readonly onClose: () => void;
    readonly dragOver: boolean;
    readonly onRemove: (name: string) => void;
    readonly onRemoveAll: () => void;
}

export function ImportModal({ library, snapshot, tab, onTab, onClose, dragOver, onRemove, onRemoveAll }: ImportModalProps) {
    const picker = useRef<HTMLInputElement>(null);
    const companion = library.companionNotice();
    const importPane = <div className="import-pane" data-import-tab>
        <div data-import-drop-zone><DropZone dragOver={dragOver}><Button label="Choose files" data-choose-files onClick={() => picker.current?.click()} /></DropZone></div>
        <input ref={picker} className="visually-hidden" data-import-picker type="file" accept=".zip,application/zip" multiple onChange={(event) => {
            void library.chooseFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
        }} />
        <Table id="import-files" columns={["File", "Identified as", "Status", "Details"]} rows={snapshot.importRows.map((row) => ({
            id: row.key,
            dim: row.status === "Skip",
            cells: [
                <span className="technical" data-import-file={row.file} key="file">{row.file}</span>,
                row.identifiedAs,
                <strong data-import-status={row.status} key="status">{row.status}</strong>,
                <span className="import-details" data-tone={row.detailsTone} key="details">{row.details}</span>,
            ],
        }))} />
        <p className="note">{snapshot.importRows.length === 0 ? "Choose or drop one or more zip files." : "Files added since this page was opened. Everything stored in this browser is under Stored files."}</p>
        {companion === null ? null : <p className="note" data-companion-notice>{companion}</p>}
    </div>;
    return <div data-modal="import">
        <Modal title="Import" onClose={onClose} foot={tab !== "import" ? undefined : <>
            {tab === "import" ? <Button label="Store all and check" primary data-store-all-check disabled={snapshot.busy || !snapshot.importRows.some((row) => row.status === "Ready")} onClick={() => { void library.storeAllAndCheck(); }} /> : null}
        </>}>
            <Tabs id="import-tabs" tabs={[{ id: "import", label: "Import" }, { id: "stored", label: "Stored files" }]} active={tab} onChange={(id) => onTab(id as "import" | "stored")} />
            {tab === "import" ? importPane : <StoredFilesTab library={library} snapshot={snapshot} onRemove={onRemove} onRemoveAll={onRemoveAll} />}
        </Modal>
    </div>;
}
