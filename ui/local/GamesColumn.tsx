// realizes: docs/ui-spec.md > §7.1 Games column

import type { ReactNode } from "react";
import { Button, Dot, List, ListFoot, ListHead, type GameListRow, type GameStatus } from "../kit/index.js";
import type { LibraryModel } from "../model/library.js";
import type { LibraryCard, LibrarySnapshot } from "../model/types.js";

export interface GamesColumnProps {
    readonly library: LibraryModel;
    readonly snapshot: LibrarySnapshot;
    readonly activeKey: string | null;
    readonly openRows: ReadonlySet<string>;
    readonly onToggle: (key: string) => void;
    readonly onImport: () => void;
    readonly onStored: () => void;
    readonly onPlay: (key: string) => void;
    readonly onResume: () => void;
    readonly onFileCheck: (key: string) => void;
}

const gameStatus = (library: LibraryModel, card: LibraryCard): GameStatus => {
    const verdict = library.verdict(card.key);
    return verdict === "ready" ? "ready" : verdict === "Bad file" ? "Bad file" : verdict === "Not stored" ? "Not stored" : "Missing files";
};

const archiveState = (library: LibraryModel, card: LibraryCard, name: string): { readonly label: string; readonly tone: "ok" | "bad" | "warn" | "off" } => {
    const availability = library.archiveAvailability(name);
    if (availability === "pending") return { label: "chosen, not stored", tone: "warn" };
    const archive = card.report?.archives.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const bad = card.report?.problems.some((item) => item.archive.toLowerCase() === name.toLowerCase()) === true
        || card.report?.files.some((item) => item.archive.toLowerCase() === name.toLowerCase() && (item.status === "wrong-crc" || item.status === "wrong-size")) === true;
    if (bad) return { label: "Bad file", tone: "bad" };
    if (archive?.present) return { label: "stored and checked", tone: "ok" };
    if (archive?.required === false) return { label: "optional, not stored", tone: "off" };
    if (availability === "preloaded") return { label: "preloaded", tone: "ok" };
    if (availability === "stored") return { label: "stored, not checked", tone: "warn" };
    return { label: "Missing files", tone: "bad" };
};

function CardDetail({ card, library, onImport, onFileCheck }: {
    readonly card: LibraryCard;
    readonly library: LibraryModel;
    readonly onImport: () => void;
    readonly onFileCheck: () => void;
}) {
    const metadata = card.metadata;
    if (metadata === null) return <p>{card.metadataError ?? "Game details are unavailable."}</p>;
    const primary = metadata.archives.find((archive) => archive.role === "game") ?? metadata.archives[0];
    return <div data-game-detail={card.key}>
        <p><strong>Runs with the {card.indexed.family} build</strong></p>
        <ul className="archive-detail-list">
            {metadata.archives.map((archive) => {
                const state = archiveState(library, card, archive.name);
                return <li data-archive={archive.name} key={archive.name}><Dot label={`${archive.name} — ${state.label}`} tone={state.tone} /></li>;
            })}
        </ul>
        <p className="game-verdict">{library.verdict(card.key) === "ready" ? "Ready to play." : card.checkError ?? "Add the required archives, then check them."}</p>
        <dl className="game-info">
            <dt>Family</dt><dd>{card.indexed.family}</dd>
            <dt>Machine</dt><dd>{metadata.machine}</dd>
            <dt>Build</dt><dd>{card.indexed.build.emulatorVersion}</dd>
            <dt>Archives</dt><dd>{metadata.archives.length}</dd>
            <dt>System versions</dt><dd>{metadata.bios.length}</dd>
            <dt>Game settings</dt><dd>{metadata.dipswitches?.length ?? 0}</dd>
        </dl>
        <div className="game-detail-actions">
            <span data-card-action="file-check"><Button size="sm" label="File check" disabled={card.report === null} onClick={onFileCheck} /></span>
            {primary === undefined ? null : <span data-card-action="remove"><Button size="sm" label="Remove" onClick={() => { void library.removeArchive(primary.name); }} /></span>}
            {library.verdict(card.key) === "ready" ? null : <span data-card-action="import"><Button size="sm" label="Import" onClick={onImport} /></span>}
        </div>
    </div>;
}

const rowForCard = (props: GamesColumnProps, card: LibraryCard): GameListRow => {
    const status = gameStatus(props.library, card);
    const pending = props.library.pendingFor(card.key) > 0;
    const ready = status === "ready";
    const primaryAction = ready ? "Play" : pending ? "Check" : null;
    return {
        id: card.key,
        seed: card.key,
        name: card.metadata?.description ?? card.indexed.machine,
        selected: props.snapshot.selectedKey === card.key,
        active: props.activeKey === card.key,
        status,
        open: props.openRows.has(card.key),
        detail: <CardDetail card={card} library={props.library} onImport={props.onImport} onFileCheck={() => props.onFileCheck(card.key)} />,
        detailActions: false,
        actionLabel: props.activeKey === card.key ? "Resume" : primaryAction,
        actionDisabled: false,
        onAction: () => {
            if (props.activeKey === card.key) { props.onResume(); return; }
            if (ready) props.onPlay(card.key);
            else if (pending) void props.library.storeAndCheck(card.key);
        },
        onToggle: () => props.onToggle(card.key),
    };
};

const rows = (props: GamesColumnProps): ReadonlyArray<GameListRow> => [
    ...props.snapshot.cards.map((card) => rowForCard(props, card)),
    ...props.snapshot.unknown.map((archive): GameListRow => ({
        id: `unknown:${archive.name}`,
        seed: archive.name,
        name: archive.name,
        status: "Not a game",
        open: props.openRows.has(`unknown:${archive.name}`),
        detail: <p>{archive.name} is not a game in any available build.</p>,
        detailActions: false,
        actionLabel: "Remove",
        actionDisabled: false,
        onAction: () => { void props.library.removeArchive(archive.name); },
        onToggle: () => props.onToggle(`unknown:${archive.name}`),
    })),
];

export function GamesColumn(props: GamesColumnProps) {
    const summary: ReactNode = <>
        <span data-library-count="games">{props.snapshot.gamesFound} games found</span>
        <span data-library-count="ready">{props.snapshot.readyCount} ready</span>
        <span data-library-count="files">{props.snapshot.filesSaved} files saved</span>
        <button type="button" className="link-button" data-open-stored-files onClick={props.onStored}>Stored files</button>
    </>;
    return <aside className="games-column" data-region="games">
        <ListHead count={String(props.snapshot.gamesFound)} action={<Button size="sm" label="Import" data-import-open onClick={props.onImport} />} />
        {props.snapshot.warnings.length === 0 ? null : <ul className="build-warnings">{props.snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        <List id="local-games" rows={rows(props)} />
        {props.snapshot.cards.length + props.snapshot.unknown.length === 0 ? <p className="empty-library">Drop or choose a game zip to begin.</p> : null}
        <ListFoot>{summary}</ListFoot>
    </aside>;
}
