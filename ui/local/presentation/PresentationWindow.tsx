// realizes: docs/ui-spec.md > §9.2 Presentation window

import { useEffect, useRef, useState } from "react";
import { ActionButton, Selector, Table, Window } from "../../kit/index.js";
import type { LibraryModel } from "../../model/library.js";
import type { PreferenceStore } from "../../model/preferences.js";
import type { SessionModel } from "../../model/session.js";
import type { LibrarySnapshot, LocalSize, LocalSlot, SessionSnapshot } from "../../model/types.js";
import { ControlsModal } from "../ControlsModal.js";

export interface PresentationWindowProps {
    readonly session: SessionModel;
    readonly state: SessionSnapshot;
    readonly library: LibraryModel;
    readonly snapshot: LibrarySnapshot;
    readonly preferences: PreferenceStore;
    readonly padStatus: string;
    readonly onPreferences: () => void;
}

const slots: LocalSlot[] = ["slot1", "slot2", "slot3"];
const SIZES: LocalSize[] = ["fit", "stretch", "integer"];
const sizeName = (size: LocalSize): string => size[0]!.toUpperCase() + size.slice(1);
const slotName = (slot: LocalSlot): string => slot.replace("slot", "slot ");

export function PresentationWindow({ session, state, library, snapshot, preferences, padStatus, onPreferences }: PresentationWindowProps) {
    const root = useRef<HTMLDivElement>(null);
    const [saveSlot, setSaveSlot] = useState<LocalSlot>("slot1");
    const [loadSlot, setLoadSlot] = useState<LocalSlot>("slot1");
    const selected = snapshot.cards.find((card) => card.key === snapshot.selectedKey);
    const active = snapshot.cards.find((card) => card.key === state.activeKey);
    const name = state.machine?.description ?? active?.metadata?.description ?? "no game";
    const running = state.activeKey !== null;
    const record = state.activeKey === null ? { slots: {} } : preferences.getGame(state.activeKey);
    const saveReason = !running ? "no game" : !state.machine?.supportsSave ? "driver cannot save" : undefined;
    const playSelected = state.windowView === "games" && selected !== undefined && selected.key !== state.activeKey && library.verdict(selected.key) === "ready";
    const resume = (): void => { void session.presentationFullscreen(); session.closeWindow(); };
    const play = (key: string): void => { if (key === state.activeKey) resume(); else void session.start(key); };
    const activate = (): void => { if (playSelected) play(selected.key); else resume(); };
    const applySize = (size: LocalSize): void => { session.setSize(size); onPreferences(); };
    const changeSize = (step: number): void => {
        const current = SIZES.indexOf(preferences.getGlobal().size);
        applySize(SIZES[(current + step + SIZES.length) % SIZES.length]!);
    };
    const slotAction = (kind: "save" | "load") => {
        const slot = kind === "save" ? saveSlot : loadSlot;
        const setSlot = kind === "save" ? setSaveSlot : setLoadSlot;
        const disabled = state.busy || saveReason !== undefined || kind === "load" && record.slots[slot] === undefined;
        const change = (step: number): void => setSlot(slots[(slots.indexOf(slot) + step + slots.length) % slots.length]!);
        const act = (): void => { if (!disabled) void (kind === "save" ? session.saveSlot(slot).finally(onPreferences) : session.loadSlot(slot)); };
        return <div className="presentation-slot" data-presentation-slot={kind}>
            <ActionButton glyph={kind === "save" ? "↓" : "↑"} label={kind === "save" ? "Save state" : "Load state"} disabled={disabled}
                title={saveReason} focusGroup="presentation-actions" focusLeft={() => change(-1)} focusRight={() => change(1)}
                data-presentation-action={kind} onClick={act} />
            <Selector id={`presentation-${kind}-slot`} group="presentation-actions" label={`${kind === "save" ? "Save" : "Load"} slot`} values={slots.map(slotName)} value={slotName(slot)}
                disabled={saveReason !== undefined || state.busy} small={saveReason ?? record.slots[slot]?.savedAt ?? "empty"}
                onChange={(value) => setSlot(value.replace(" ", "") as LocalSlot)} onActivate={act} />
        </div>;
    };
    const metadata = active?.metadata as { manufacturer?: string; year?: string | number } | null | undefined;
    const meta = [metadata?.manufacturer, metadata?.year, ...(state.machine === null ? [] : [
        `${state.machine.width} × ${state.machine.height}`, `${state.machine.players} players`, `${state.machine.buttons} buttons`,
    ])].filter((value) => value !== undefined).join(" · ");
    const times = Object.values(record.slots).map((slot) => slot.savedAt).sort();

    useEffect(() => {
        if (state.windowView === "controllers") return;
        const target = state.windowView === "games"
            ? root.current?.querySelector<HTMLElement>('[data-table-row][data-selected="true"], [data-table-row]')
            : root.current?.querySelector<HTMLElement>('[data-presentation-action="resume"]:not(:disabled)');
        (target ?? root.current?.querySelector<HTMLElement>('[data-presentation-action="games"]'))?.focus();
    }, [state.windowView]);

    return <div ref={root} className="presentation-overlay" data-presentation-window data-presentation-view={state.windowView}>
        <Window title="Arcade Library" secondary={`Presentation mode · ${running ? `${name} paused` : "no game"}`} className="presentation-window">
            <div className="presentation-columns">
                <nav className="presentation-actions" aria-label="Presentation actions">
                    <ActionButton glyph="▶" label={playSelected ? "Play" : "Resume"} data-presentation-action="resume" focusId="presentation-resume" focusGroup="presentation-actions" disabled={state.busy || !running && !playSelected} onClick={activate} />
                    <ActionButton glyph="▤" label="Games" trailing={<small>{snapshot.gamesFound}</small>} data-presentation-action="games" focusGroup="presentation-actions" onClick={() => session.openWindow("games")} />
                    {slotAction("save")}
                    {slotAction("load")}
                    <ActionButton glyph="↺" label="Reset" data-presentation-action="reset" focusGroup="presentation-actions" disabled={!running || state.busy} onClick={() => session.reset("soft")} />
                    <div className="presentation-slot" data-presentation-size>
                        <ActionButton glyph="▭" label="Size" focusGroup="presentation-actions" data-presentation-action="size" focusLeft={() => changeSize(-1)} focusRight={() => changeSize(1)} onClick={() => changeSize(1)} />
                        <Selector id="presentation-size" group="presentation-actions" label="Size" values={SIZES.map(sizeName)} value={sizeName(preferences.getGlobal().size)} onChange={(value) => applySize(value.toLowerCase() as LocalSize)} />
                    </div>
                    <ActionButton glyph="⚙" label="Controllers" trailing={<small>{padStatus}</small>} data-presentation-action="controllers" focusGroup="presentation-actions" onClick={() => session.openWindow("controllers")} />
                    <div className="presentation-mode-switch" data-mode-switch="local"><ActionButton glyph="▣" label="Play mode" data-presentation-action="play-mode" focusGroup="presentation-actions" onClick={() => { session.leavePresentation(); onPreferences(); }} /></div>
                </nav>
                <section className="presentation-content" aria-label={state.windowView === "games" ? "Games" : state.windowView === "controllers" ? "Controllers" : "Current game"}>
                    {state.windowView === "controllers" ? <ControlsModal inline preferences={preferences} session={session} gameKey={state.activeKey ?? snapshot.selectedKey}
                        gameName={running ? name : selected?.metadata?.description ?? null} machine={state.machine} onApplied={onPreferences} onClose={() => session.openWindow("game")} />
                        : state.windowView === "games" ? <div className="presentation-games" data-presentation-games>
                            <Table id="presentation-games" columns={["Game", "Status", ""]} rows={[
                                ...snapshot.cards.map((card) => {
                                    const playing = card.key === state.activeKey;
                                    const verdict = card.metadata === null ? "Bad file" : library.verdict(card.key);
                                    const playable = playing || verdict === "ready";
                                    return { id: card.key, className: playing ? "hl" : undefined, selected: snapshot.selectedKey === card.key,
                                        focusable: true, onFocus: () => { if (snapshot.selectedKey !== card.key) library.select(card.key); }, onActivate: () => { if (playable && !state.busy) play(card.key); },
                                        cells: [card.metadata?.description ?? card.indexed.machine,
                                            <span className={playing ? "presentation-playing" : playable ? "" : "presentation-bad"} key="status">{playing ? "playing" : verdict}</span>,
                                            playable ? <button type="button" className="btn" data-play="true" disabled={state.busy} data-presentation-play={card.key}
                                                onFocus={(event) => event.currentTarget.closest<HTMLElement>("tr")?.focus()} onClick={() => play(card.key)} key="play">{playing ? "Resume" : "Play"}</button> : null],
                                    };
                                }),
                                ...snapshot.unknown.map((archive) => ({ id: `unknown:${archive.name}`, focusable: true, cells: [archive.name, <span className="presentation-bad" key="status">Not a game</span>, null] })),
                            ]} />
                            <p className="list-foot">Import and file management are in Play mode.</p>
                        </div> : <div className="presentation-card" data-presentation-game>
                            <div className="presentation-frame sunken">{state.lastFrame === null ? null : <img src={state.lastFrame} alt="Last game frame" data-presentation-frame />}</div>
                            <h1>{name}</h1>
                            <p data-presentation-metadata>{meta}</p>
                            <p data-presentation-status>{running ? "Playing" : "Ready"} · {times.length === 0 ? "No progress saved in slots" : `Progress saved ${times.at(-1)}`}<br />
                                {slots.map((slot) => `${slotName(slot)}: ${record.slots[slot]?.savedAt ?? "empty"}`).join(" · ")}</p>
                        </div>}
                    <p className="presentation-message" role="status">{state.message}</p>
                </section>
            </div>
        </Window>
    </div>;
}
