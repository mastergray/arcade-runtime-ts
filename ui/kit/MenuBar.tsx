// realizes: docs/ui-design-language.md > §3.1 Menu bar and pinned shortcuts

import type { ReactNode } from "react";
import { useFocusable } from "../focus/FocusController.js";

export interface MenuEntry {
    readonly id: string;
    readonly label: ReactNode;
    readonly small?: ReactNode;
    readonly disabled?: boolean;
    readonly checked?: boolean;
    readonly radio?: boolean;
    readonly separator?: boolean;
    readonly onSelect?: () => void;
}

export interface MenuDefinition {
    readonly id: string;
    readonly label: ReactNode;
    readonly entries: ReadonlyArray<MenuEntry>;
}

export interface MenuBarProps {
    readonly menus: ReadonlyArray<MenuDefinition>;
    readonly openId?: string;
    readonly onOpen?: (id: string) => void;
    readonly shortcuts?: ReactNode;
}

function MenuItem({ entry, menuId }: { readonly entry: MenuEntry; readonly menuId: string }) {
    const focusable = useFocusable(`menu-${menuId}-${entry.id}`, `menu-${menuId}`, { disabled: entry.disabled, onActivate: entry.onSelect });
    if (entry.separator) return <hr className="separator" />;
    return <button
        ref={focusable.ref as never}
        type="button"
        className="menu-item"
        disabled={entry.disabled}
        data-component="menu-item"
        data-disabled={entry.disabled ?? false}
        data-checked={entry.checked ?? false}
        data-radio={entry.radio ?? false}
        data-focus={focusable["data-focus"]}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
        onClick={entry.onSelect}
    >
        <span className="menu-mark">{entry.checked ? "✓" : ""}</span>
        <span className="menu-item-label">{entry.label}</span>
        {entry.small === undefined ? null : <small className="menu-item-small">{entry.small}</small>}
    </button>;
}

export function MenuBar({ menus, openId, onOpen, shortcuts }: MenuBarProps) {
    return <nav className="menu-bar" data-component="menu-bar">
        {menus.map((menu) => <div className="menu" data-open={menu.id === openId} key={menu.id}>
            <button type="button" className="menu-title" onClick={() => onOpen?.(menu.id)}>{menu.label}</button>
            {menu.id !== openId ? null : <div className="menu-dropdown">
                {menu.entries.map((entry) => <MenuItem entry={entry} menuId={menu.id} key={entry.id} />)}
            </div>}
        </div>)}
        {shortcuts === undefined ? null : <div className="pinned" data-component="pinned-shortcuts">{shortcuts}</div>}
    </nav>;
}
