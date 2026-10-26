// realizes: docs/ui-design-language.md > §3.3 Terminal

export interface TerminalProps { readonly lines: ReadonlyArray<string>; }
export function Terminal({ lines }: TerminalProps) {
    return <pre className="term" data-component="terminal">{lines.join("\n")}</pre>;
}
