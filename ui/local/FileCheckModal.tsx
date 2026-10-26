// realizes: docs/ui-spec.md > §3.2 and §7.4 Detailed file check

import { Modal, Table } from "../kit/index.js";
import type { LibraryCard } from "../model/types.js";

export function FileCheckModal({ card, onClose }: { readonly card: LibraryCard; readonly onClose: () => void }) {
    const report = card.report;
    const rows = report === null ? [] : [
        ...report.archives.map((archive) => ({
            id: `archive:${archive.name}`,
            cells: [archive.name, archive.present ? "ok" : "missing", `${archive.role}; ${archive.required ? "required" : "optional"}`],
            dim: !archive.required,
        })),
        ...report.files.map((file) => ({
            id: `file:${file.archive}:${file.name}`,
            cells: [file.name, file.status, file.archive],
            dim: file.status === "optional-missing",
        })),
        ...report.problems.map((problem) => ({ id: `problem:${problem.archive}`, cells: [problem.archive, "Bad file", problem.reason] })),
    ];
    return <div data-modal="file-check"><Modal title="Detailed file check" onClose={onClose}>
        <p><strong>{card.metadata?.description ?? card.indexed.machine}</strong> — {report?.status ?? card.checkState}</p>
        <Table id="file-check-report" columns={["File", "Status", "Details"]} rows={rows} />
        {report?.warnings.length ? <p className="note" data-file-check-warnings>{report.warnings.length} file differences are accepted by the selected policy.</p> : null}
    </Modal></div>;
}
