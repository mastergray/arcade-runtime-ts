// realizes: docs/ui-design-language.md > §1.4 The bevel

import type { HTMLAttributes, ReactNode } from "react";

export interface BevelProps extends HTMLAttributes<HTMLDivElement> {
    readonly children: ReactNode;
    readonly kind?: "raised" | "sunken";
}

export function Bevel({ children, kind = "raised", className = "", ...props }: BevelProps) {
    return <div {...props} className={`${kind === "raised" ? "bevel" : "sunken"} ${className}`.trim()} data-component="bevel" data-kind={kind}>{children}</div>;
}
