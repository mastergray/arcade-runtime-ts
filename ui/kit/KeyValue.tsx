// realizes: docs/ui-design-language.md > §3.3 Key-value grid

import type { ReactNode } from "react";
export interface KeyValueProps { readonly entries: ReadonlyArray<{ readonly label: string; readonly value: ReactNode }>; }
export function KeyValue({ entries }: KeyValueProps) {
    return <div className="kv2" data-component="key-value">{entries.flatMap((entry) => [<span key={`${entry.label}-label`}>{entry.label}</span>, <span key={`${entry.label}-value`}>{entry.value}</span>])}</div>;
}
