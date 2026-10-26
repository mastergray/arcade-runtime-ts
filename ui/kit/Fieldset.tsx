// realizes: docs/ui-design-language.md > §3.3 Fieldset

import type { ReactNode } from "react";
export interface FieldsetProps { readonly legend: string; readonly children: ReactNode; }
export function Fieldset({ legend, children }: FieldsetProps) {
    return <fieldset className="fieldset" data-component="fieldset"><legend>{legend}</legend>{children}</fieldset>;
}
export function FieldLine({ children }: { readonly children: ReactNode }) { return <label className="fieldset-line">{children}</label>; }
