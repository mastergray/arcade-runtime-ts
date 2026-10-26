// realizes: docs/ui-design-language.md > §3.1 Title bar

import type { ReactNode } from "react";
import { Button } from "./Button.js";

export interface TitleBarProps {
    readonly title: string;
    readonly secondary?: ReactNode;
    readonly onClose?: () => void;
}

export function TitleBar({ title, secondary, onClose }: TitleBarProps) {
    return <header className="title-bar" data-component="title-bar">
        <span className="title-glyph" aria-hidden="true" />
        <span className="title-text">{title}</span>
        {secondary === undefined ? null : <span className="title-secondary">{secondary}</span>}
        {onClose === undefined ? null : <Button className="title-close" size="sm" glyph="×" label="Close" onClick={onClose} />}
    </header>;
}
