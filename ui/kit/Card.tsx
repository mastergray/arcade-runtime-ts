// realizes: docs/ui-design-language.md > §3.5 Game card

import { Icon } from "./Icon.js";

export interface CardProps {
    readonly seed: string;
    readonly name?: string;
    readonly meta?: string;
    readonly status?: string;
}

export function Card({ seed, name = "Game name", meta = "Manufacturer · Year · Resolution at Hz · players · buttons", status = "Save progress · three slots" }: CardProps) {
    return <article className="card" data-component="game-card">
        <Icon seed={seed} />
        <div className="card-copy">
            <div className="card-name">{name}</div>
            <div className="card-meta">{meta}</div>
            <div className="card-status">{status}</div>
        </div>
    </article>;
}
