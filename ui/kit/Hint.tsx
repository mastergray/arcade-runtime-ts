// realizes: docs/ui-design-language.md > §3.5 Start hint

import type { ReactNode } from "react";
export interface HintProps { readonly children: ReactNode; }
export function Hint({ children }: HintProps) { return <div className="start-hint" data-component="start-hint">{children}</div>; }
