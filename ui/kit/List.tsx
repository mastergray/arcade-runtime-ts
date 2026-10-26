// realizes: docs/ui-design-language.md > §3.4 Lists

import type { ReactNode } from "react";
import { useFocusable } from "../focus/FocusController.js";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";

export type GameStatus = "ready" | "Missing files" | "Bad file" | "Not stored" | "Not a game";

export interface GameListRow {
    readonly id: string;
    readonly seed: string;
    readonly selected?: boolean;
    readonly active?: boolean;
    readonly status?: GameStatus;
    readonly open?: boolean;
    readonly detail?: ReactNode;
    readonly onPlay?: () => void;
    readonly onToggle?: () => void;
}

export interface ListProps {
    readonly id: string;
    readonly rows: ReadonlyArray<GameListRow>;
    readonly flat?: boolean;
}

function statusTone(status: GameStatus, active: boolean): "ok" | "bad" | "off" {
    if (active || status === "ready") return "ok";
    return status === "Missing files" || status === "Bad file" || status === "Not stored" || status === "Not a game" ? "bad" : "off";
}

function GameRow({ listId, row, flat }: { readonly listId: string; readonly row: GameListRow; readonly flat: boolean }) {
    const focusable = useFocusable(`${listId}-${row.id}`, listId, { onActivate: flat ? row.onPlay : row.onToggle });
    const status = row.active ? "playing" : row.status ?? "ready";
    return <article className="game-row" data-component="games-list-row" data-selected={row.selected ?? false} data-active={row.active ?? false} data-state={row.active ? "active" : row.selected ? "selected" : "default"}>
        <div
            ref={focusable.ref as never}
            className="game-row-main"
            data-focus={focusable["data-focus"]}
            tabIndex={focusable.tabIndex}
            onFocus={focusable.onFocus}
            onClick={flat ? row.onPlay : row.onToggle}
        >
            <Icon seed={row.seed} />
            <span className="game-name">Game name</span>
            <span className="game-status" data-tone={statusTone(row.status ?? "ready", row.active ?? false)}>{status}</span>
            <Button focusId={`${listId}-${row.id}-play`} focusGroup={listId} size="sm" play label={row.active ? "Resume" : row.status === "ready" || row.status === undefined ? "Play" : "File check"} disabled={row.status !== undefined && row.status !== "ready" && !row.active} onClick={row.onPlay} />
        </div>
        {flat || !row.open ? null : <div className="game-detail">
            {row.detail ?? <><strong>Game name</strong><div>ready</div></>}
            <div className="game-detail-actions"><Button size="sm" label="File check" /><Button size="sm" label="Remove" /><Button size="sm" label="Import" /></div>
        </div>}
    </article>;
}

export function List({ id, rows, flat = false }: ListProps) {
    return <div className="games-list" data-component="games-list">{rows.map((row) => <GameRow listId={id} row={row} flat={flat} key={row.id} />)}</div>;
}

export function ListHead({ count, action }: { readonly count: string; readonly action?: ReactNode }) {
    return <header className="list-head" data-component="list-head"><span>Games</span><span>{count}</span>{action}</header>;
}

export function ListFoot({ children }: { readonly children: ReactNode }) {
    return <footer className="list-foot" data-component="list-foot">{children}</footer>;
}

export function MenuListRow({ id, label, small, onSelect }: { readonly id: string; readonly label: string; readonly small?: string; readonly onSelect?: () => void }) {
    const focusable = useFocusable(id, "menu-list", { onActivate: onSelect });
    return <button ref={focusable.ref as never} className="menu-list-row" type="button" data-component="menu-list" data-focus={focusable["data-focus"]} tabIndex={focusable.tabIndex} onFocus={focusable.onFocus} onClick={onSelect}>{label}{small === undefined ? null : <small>{small}</small>}</button>;
}
