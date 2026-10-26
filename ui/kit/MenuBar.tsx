// realizes: docs/ui-design-language.md > §3.1 Menu bar and pinned shortcuts

import { useEffect, useRef, type ReactNode } from "react";
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
    readonly onDismiss?: () => void;                               // A click outside the bar or Escape while a menu is open
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
        data-menu-item={entry.id}
        data-disabled={entry.disabled ?? false}
        data-checked={entry.checked ?? false}
        data-radio={entry.radio ?? false}
        data-focus={focusable["data-focus"]}
        data-state={entry.disabled ? "disabled" : entry.checked ? "checked" : entry.radio ? "radio" : focusable["data-focus"] ? "focus" : "default"}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
        onClick={entry.onSelect}
    >
        <span className="menu-mark">{entry.checked ? "✓" : ""}</span>
        <span className="menu-item-label">{entry.label}</span>
        {entry.small === undefined ? null : <small className="menu-item-small">{entry.small}</small>}
    </button>;
}

function MenuTitle({ menu, open, onOpen }: { readonly menu: MenuDefinition; readonly open: boolean; readonly onOpen?: (id: string) => void }) {
    const focusable = useFocusable(`menu-title-${menu.id}`, "menu-titles", { onActivate: () => onOpen?.(menu.id) });
    return <button ref={focusable.ref as never} type="button" className="menu-title" data-menu-title={menu.id} data-focus={focusable["data-focus"]}
        tabIndex={focusable.tabIndex} onFocus={focusable.onFocus} onClick={() => onOpen?.(menu.id)} aria-expanded={open}>{menu.label}</button>;
}

export function MenuBar({ menus, openId, onOpen, onDismiss, shortcuts }: MenuBarProps) {
    const bar = useRef<HTMLElement>(null);
    useEffect(() => {
        if (openId === undefined || onDismiss === undefined) return;
        const onPointer = (event: PointerEvent): void => { if (bar.current !== null && !bar.current.contains(event.target as Node)) onDismiss(); };
        const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") onDismiss(); };
        document.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("keydown", onKey, true);
        return () => { document.removeEventListener("pointerdown", onPointer, true); document.removeEventListener("keydown", onKey, true); };
    }, [openId, onDismiss]);
    return <nav ref={bar} className="menu-bar" data-component="menu-bar">
        {menus.map((menu) => <div className="menu" data-menu={menu.id} data-open={menu.id === openId} key={menu.id}>
            <MenuTitle menu={menu} open={menu.id === openId} onOpen={onOpen} />
            {menu.id !== openId ? null : <div className="menu-dropdown">
                {menu.entries.map((entry) => <MenuItem entry={entry} menuId={menu.id} key={entry.id} />)}
            </div>}
        </div>)}
        {shortcuts === undefined ? null : <div className="pinned" data-component="pinned-shortcuts">{shortcuts}</div>}
    </nav>;
}
