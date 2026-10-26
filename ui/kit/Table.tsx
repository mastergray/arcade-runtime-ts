// realizes: docs/ui-design-language.md > §3.3 Table

import type { ReactNode } from "react";
import { useFocusable } from "../focus/FocusController.js";

export interface TableRow {
    readonly id: string;
    readonly cells: ReadonlyArray<ReactNode>;
    readonly section?: boolean;
    readonly selected?: boolean;
    readonly dim?: boolean;
    readonly held?: boolean;
    readonly focusable?: boolean;
    readonly onActivate?: () => void;
}

export interface TableProps {
    readonly id: string;
    readonly columns: ReadonlyArray<string>;
    readonly rows: ReadonlyArray<TableRow>;
}

function BodyRow({ tableId, row, columnCount }: { readonly tableId: string; readonly row: TableRow; readonly columnCount: number }) {
    const focusable = useFocusable(`${tableId}-${row.id}`, tableId, { disabled: !row.focusable, onActivate: row.onActivate });
    if (row.section) return <tr className="section-row" data-section-row="true"><td colSpan={columnCount}>{row.cells[0]}</td></tr>;
    return <tr
        ref={row.focusable ? focusable.ref as never : undefined}
        data-selected={row.selected ?? false}
        data-dim={row.dim ?? false}
        data-held={row.held ?? false}
        data-focus={row.focusable ? focusable["data-focus"] : undefined}
        data-state={row.held ? "held" : row.selected ? "selected" : row.dim ? "dim" : row.focusable && focusable["data-focus"] ? "focus" : "default"}
        tabIndex={row.focusable ? focusable.tabIndex : undefined}
        onFocus={row.focusable ? focusable.onFocus : undefined}
    >{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>;
}

export function Table({ id, columns, rows }: TableProps) {
    return <div className="table-wrap" data-component="table"><table className="table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <BodyRow tableId={id} row={row} columnCount={columns.length} key={row.id} />)}</tbody>
    </table></div>;
}
