// realizes: docs/ui-design-language.md > §2 Main window

import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar.js";

export interface WindowProps {
    readonly title: string;
    readonly secondary?: ReactNode;
    readonly menu?: ReactNode;
    readonly children: ReactNode;
    readonly status?: ReactNode;
    readonly className?: string;
}

export function Window({ title, secondary, menu, children, status, className = "" }: WindowProps) {
    return <section className={`window ${className}`.trim()} data-component="window" data-menu={menu !== undefined}>
        <TitleBar title={title} secondary={secondary} />
        {menu}
        <main className="window-main">{children}</main>
        {status}
    </section>;
}
