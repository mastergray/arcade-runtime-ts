// realizes: docs/ui-design-language.md > §3.3 Table

import type { ReactNode } from "react";
import { useFocusable } from "../focus/FocusController.js";
import { usePhoneLayout } from "./LayoutContext.js";

export interface TableRow {
    readonly id: string;
    readonly cells: ReadonlyArray<ReactNode>;
    readonly section?: boolean;
    readonly selected?: boolean;
    readonly dim?: boolean;
    readonly held?: boolean;
    readonly focusable?: boolean;
    readonly onActivate?: () => void;
    readonly onFocus?: () => void;
    readonly className?: string;
}

export interface TableProps {
    readonly id: string;
    readonly columns: ReadonlyArray<string>;
    readonly rows: ReadonlyArray<TableRow>;
    readonly phoneGroups?: ReadonlyArray<{ readonly label: string; readonly columns: ReadonlyArray<number> }>;
    readonly phoneStacked?: boolean;
}

function BodyRow({ tableId, row, columnCount }: { readonly tableId: string; readonly row: TableRow; readonly columnCount: number }) {
    const focusable = useFocusable(`${tableId}-${row.id}`, tableId, { disabled: !row.focusable, onActivate: row.onActivate });
    if (row.section) return <tr className="section-row" data-section-row="true"><td colSpan={columnCount}>{row.cells[0]}</td></tr>;
    return <tr
        data-table-row={row.id}
        className={row.className}
        ref={row.focusable ? focusable.ref as never : undefined}
        data-selected={row.selected ?? false}
        data-dim={row.dim ?? false}
        data-held={row.held ?? false}
        data-focus={row.focusable ? focusable["data-focus"] : undefined}
        data-state={row.held ? "held" : row.selected ? "selected" : row.dim ? "dim" : row.focusable && focusable["data-focus"] ? "focus" : "default"}
        tabIndex={row.focusable ? focusable.tabIndex : undefined}
        onFocus={row.focusable ? (event) => { if (event.target === event.currentTarget) focusable.onFocus(); row.onFocus?.(); } : undefined}
    >{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>;
}

export function Table({ id, columns, rows, phoneGroups, phoneStacked = false }: TableProps) {
    const phone = usePhoneLayout();
    if (phone && phoneStacked) return <div className="phone-table-boxes" data-component="table">{rows.map((row) => <fieldset data-table-row={row.id} key={row.id}>
        <legend>{row.cells[0]}</legend>{row.cells.slice(1).map((cell, index) => <div className="phone-table-field" key={index}><span>{columns[index + 1]}</span>{cell}</div>)}
    </fieldset>)}</div>;
    if (phone && columns.length > 3) {
        const groups = phoneGroups ?? [{ label: columns[0]!, columns: [0] }, { label: columns[1]!, columns: [1] }, { label: columns.slice(2).join(" / "), columns: columns.slice(2).map((_, index) => index + 2) }];
        rows = rows.map((row) => row.section ? row : { ...row, cells: groups.map((group) => <>{group.columns.map((index) => <div key={index}>{row.cells[index]}</div>)}</>) });
        columns = groups.map((group) => group.label);
    }
    return <div className="table-wrap" data-component="table"><table className="table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <BodyRow tableId={id} row={row} columnCount={columns.length} key={row.id} />)}</tbody>
    </table></div>;
}
