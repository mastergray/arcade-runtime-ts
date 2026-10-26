// realizes: docs/ui-design-language.md > §1.1 Generated game icon

export interface IconProps {
    readonly seed: string;
    readonly label?: string;
}

const hashSeed = (seed: string): number => [...seed].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);

export function Icon({ seed, label = "G" }: IconProps) {
    return <span className="generated-icon" data-component="icon" data-tone={String(hashSeed(seed) % 4)} aria-label="Generated icon">{label.slice(0, 2)}</span>;
}
