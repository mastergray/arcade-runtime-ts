// realizes: docs/ui-design-language.md > §3.1 Status bar

import type { ReactNode } from "react";

export interface StatusBarProps {
    readonly message: string;
    readonly state: "running" | "paused" | "idle";
    readonly secondary?: string;
    readonly children?: ReactNode;
}

export function StatusBar({ message, state, secondary, children }: StatusBarProps) {
    const word = state === "running" ? "playing" : state === "paused" ? "paused" : "ready";
    return <footer className="status-bar" data-component="status-bar" data-state={state}>
        <span className="status-cell">{message}</span>
        <span className="status-cell status-word" data-state={state}>{word}</span>
        {secondary === undefined ? null : <span className="status-cell">{secondary}</span>}
        {children}
    </footer>;
}
