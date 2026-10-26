// realizes: docs/ui-spec.md > §7 Local desktop page

import { useEffect, useMemo, useRef, useState } from "react";
import { FocusProvider } from "../focus/FocusController.js";
import { Button, Confirm, Desk, StatusBar, Window } from "../kit/index.js";
import { LibraryModel } from "../model/library.js";
import { PreferenceStore } from "../model/preferences.js";
import { SessionModel } from "../model/session.js";
import type { LibrarySnapshot, LocalAdapterBoundary, LocalSlot, SessionSnapshot } from "../model/types.js";
import { FileCheckModal } from "./FileCheckModal.js";
import { GamesColumn } from "./GamesColumn.js";
import { ImportModal } from "./ImportModal.js";
import { LogModal } from "./LogModal.js";
import { LocalMenus, type LocalMenuActions } from "./menus.js";
import { PlaySurface } from "./PlaySurface.js";
import { Strip } from "./Strip.js";

interface LocalModels {
    readonly library: LibraryModel;
    readonly preferences: PreferenceStore;
}

type OpenModal = "import" | "log" | "file-check" | "clear-saved-play" | "restart" | null;

const EMPTY_SESSION: SessionSnapshot = {
    status: "idle", message: "Loading the arcade library…", activeKey: null, machine: null,
    muted: false, fullscreen: false, layout: null, pads: [], log: [], busy: false,
};

function useLibrarySnapshot(library: LibraryModel): LibrarySnapshot {
    const [, render] = useState(0);
    useEffect(() => library.subscribe(() => render((value) => value + 1)), [library]);
    return library.snapshot();
}

function useSessionSnapshot(session: SessionModel | null): SessionSnapshot {
    const [, render] = useState(0);
    useEffect(() => session?.subscribe(() => render((value) => value + 1)), [session]);
    return session?.snapshot() ?? EMPTY_SESSION;
}

const statusState = (status: SessionSnapshot["status"]): "running" | "paused" | "idle" => status === "running" ? "running" : status === "paused" ? "paused" : "idle";

function LocalWorkspace({ models }: { readonly models: LocalModels }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [session, setSession] = useState<SessionModel | null>(null);
    const library = useLibrarySnapshot(models.library);
    const sessionState = useSessionSnapshot(session);
    const [preferenceVersion, setPreferenceVersion] = useState(0);
    const preferences = useMemo(() => models.preferences.getGlobal(), [models.preferences, preferenceVersion]);
    const [openMenu, setOpenMenu] = useState<string>();
    const [modal, setModal] = useState<OpenModal>(null);
    const [importTab, setImportTab] = useState<"import" | "stored">("import");
    const [dragOver, setDragOver] = useState(false);
    const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
    const [selectedSlot, setSelectedSlot] = useState<LocalSlot>("slot1");
    const [removal, setRemoval] = useState<{ readonly name: string } | { readonly all: true } | null>(null);
    const [fileCheckKey, setFileCheckKey] = useState<string | null>(null);

    const refreshPreferences = (): void => setPreferenceVersion((value) => value + 1);

    useEffect(() => {
        if (canvasRef.current === null || containerRef.current === null) return;
        const created = new SessionModel({
            canvas: canvasRef.current,
            container: containerRef.current,
            library: models.library,
            romStore: models.library.store,
            preferences: models.preferences,
            adapter: () => (globalThis as unknown as LocalAdapterBoundary).__arcadeLocalAdapter,
            getGamepads: () => Array.from(navigator.getGamepads?.() ?? []),
            publishCabinet: (cabinet) => { (globalThis as unknown as LocalAdapterBoundary).__arcadeLocalCabinet = cabinet ?? undefined; },
        });
        setSession(created);
        return () => { void created.stop(); };
    }, [models]);

    useEffect(() => {
        if (session === null) return;
        const refresh = (): void => session.refreshExternalState();
        const timer = window.setInterval(refresh, 1000);
        document.addEventListener("fullscreenchange", refresh);
        window.addEventListener("pagehide", refresh);
        refresh();
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("fullscreenchange", refresh);
            window.removeEventListener("pagehide", refresh);
        };
    }, [session]);

    useEffect(() => {
        const drag = (event: DragEvent): void => { event.preventDefault(); setDragOver(true); setModal("import"); setImportTab("import"); };
        const leave = (event: DragEvent): void => { if (event.relatedTarget === null) setDragOver(false); };
        const drop = (event: DragEvent): void => {
            event.preventDefault();
            setDragOver(false);
            setModal("import");
            setImportTab("import");
            void models.library.chooseFiles(Array.from(event.dataTransfer?.files ?? []));
        };
        document.addEventListener("dragover", drag);
        document.addEventListener("dragleave", leave);
        document.addEventListener("drop", drop);
        return () => {
            document.removeEventListener("dragover", drag);
            document.removeEventListener("dragleave", leave);
            document.removeEventListener("drop", drop);
        };
    }, [models.library]);

    useEffect(() => {
        if (session === null || !library.preloadAutostart || library.selectedKey === null) return;
        const card = models.library.card(library.selectedKey);
        if (card?.report?.status !== "ok") return;
        const start = (): void => { void session.start(card.key); };
        document.addEventListener("click", start, { capture: true, once: true });
        return () => document.removeEventListener("click", start, { capture: true });
    }, [library.preloadAutostart, library.selectedKey, models.library, session]);

    const selectedKey = sessionState.activeKey ?? library.selectedKey;
    const selectedCard = selectedKey === null ? null : models.library.card(selectedKey);
    const fileCheckCard = fileCheckKey === null ? selectedCard : models.library.card(fileCheckKey);
    const gamePreferences = selectedKey === null ? { slots: {} } : models.preferences.getGame(selectedKey);
    const running = sessionState.status === "running" || sessionState.status === "paused";
    const paused = sessionState.status === "paused";
    const supportsSave = sessionState.machine?.supportsSave === true;
    const titleGame = sessionState.machine?.description ?? selectedCard?.metadata?.description ?? "no game";
    const idleMessage = !library.initialized ? "Loading the arcade library…"
        : selectedCard === null ? "Drop or choose your game zip files to begin."
            : models.library.verdict(selectedCard.key) === "ready" ? `${selectedCard.metadata?.description ?? "The selected game"} is ready to play.`
                : `${selectedCard.metadata?.description ?? "The selected game"}: ${models.library.verdict(selectedCard.key)}.`;
    const statusMessage = sessionState.status === "idle" ? idleMessage : sessionState.message;

    const closeMenu = (action: () => void): (() => void) => () => { setOpenMenu(undefined); action(); };
    const copyLog = (): void => {
        setOpenMenu(undefined);
        void navigator.clipboard?.writeText(sessionState.log.join("\n"));
    };
    const openFileCheck = (key = selectedKey): void => {
        if (key === null) return;
        setFileCheckKey(key);
        setModal("file-check");
        setOpenMenu(undefined);
    };
    const toggleController = (): void => {
        models.preferences.updateGlobal({ controllerView: !preferences.controllerView });
        refreshPreferences();
        setOpenMenu(undefined);
    };

    const actions: LocalMenuActions = {
        settings: () => undefined,
        controls: () => undefined,
        storedFiles: closeMenu(() => { setImportTab("stored"); setModal("import"); }),
        saveSlot: (slot) => { setOpenMenu(undefined); if (session !== null) void session.saveSlot(slot).finally(refreshPreferences); },
        loadSlot: (slot) => { setOpenMenu(undefined); if (session !== null) void session.loadSlot(slot); },
        saveChanges: closeMenu(() => { if (session !== null) void session.saveChanges(); }),
        clearSavedPlay: closeMenu(() => setModal("clear-saved-play")),
        reset: closeMenu(() => session?.reset("soft")),
        restart: closeMenu(() => setModal("restart")),
        controller: toggleController,
        showFps: closeMenu(() => { models.preferences.updateGlobal({ showFps: !preferences.showFps }); refreshPreferences(); }),
        size: (size) => { setOpenMenu(undefined); session?.setSize(size); if (session === null) models.preferences.updateGlobal({ size }); refreshPreferences(); },
        fullscreen: (stretched) => { setOpenMenu(undefined); if (session !== null) void session.fullscreen(stretched); },
        technicalLog: closeMenu(() => setModal("log")),
        fileCheck: closeMenu(() => openFileCheck()),
        copyLog,
        pauseResume: () => session?.pauseResume(),
        mute: () => { if (session !== null) void session.toggleMute(); },
    };
    const menus = <LocalMenus
        openId={openMenu}
        onOpen={(id) => setOpenMenu(openMenu === id ? undefined : id)}
        onDismiss={() => setOpenMenu(undefined)}
        running={running}
        paused={paused}
        muted={sessionState.muted}
        supportsSave={supportsSave}
        controllerView={preferences.controllerView}
        showFps={preferences.showFps}
        size={preferences.size}
        selectedSlot={selectedSlot}
        onSelectedSlot={setSelectedSlot}
        gamePreferences={gamePreferences}
        hasFileCheck={selectedCard?.report !== null && selectedCard !== null}
        actions={actions}
    />;

    const status = <StatusBar message={statusMessage} state={statusState(sessionState.status)}>
        <span className="status-cell" data-status-cell="video">{sessionState.machine === null ? "No video" : `${sessionState.machine.width} × ${sessionState.machine.height} · ${sessionState.machine.refreshHz.toFixed(2)} Hz`}</span>
        <span className="status-cell" data-status-cell="input">Keyboard · {sessionState.pads.length === 0 ? "no pads" : sessionState.pads.map((pad) => `P${pad.player}`).join(", ")}</span>
        <span className="status-cell" data-status-cell="autosave">Auto-save {preferences.autoSave ? "on" : "off"}</span>
    </StatusBar>;

    const closeTop = (): void => {
        if (modal !== null) setModal(null);
        else if (openMenu !== undefined) setOpenMenu(undefined);
        else if (openRows.size > 0) setOpenRows(new Set());
    };

    return <FocusProvider onBack={closeTop} gamepadEnabled={!running}>
        <Desk>
            <Window className="local-window" title={`Arcade Library — ${titleGame}`} secondary="Play mode" menu={menus} status={status}>
                <div className="local-layout">
                    <GamesColumn
                        library={models.library}
                        snapshot={library}
                        activeKey={sessionState.activeKey}
                        openRows={openRows}
                        onToggle={(key) => {
                            models.library.select(key.replace(/^unknown:/, ""));
                            setOpenRows((current) => {
                                const next = new Set(current);
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                            });
                        }}
                        onImport={() => { setImportTab("import"); setModal("import"); }}
                        onStored={() => { setImportTab("stored"); setModal("import"); }}
                        onRemove={(name) => setRemoval({ name })}
                        onPlay={(key) => { if (session !== null) void session.start(key); }}
                        onResume={() => { if (paused) session?.pauseResume(); }}
                        onFileCheck={openFileCheck}
                    />
                    <div className="play-region" data-region="play-and-controller" data-controller-visible={preferences.controllerView}>
                        <PlaySurface canvasRef={canvasRef} containerRef={containerRef} session={sessionState} showFps={preferences.showFps} />
                        {preferences.controllerView && session !== null ? <Strip model={session} session={sessionState} /> : null}
                    </div>
                </div>
            </Window>
        </Desk>
        {modal === "import" ? <ImportModal library={models.library} snapshot={library} tab={importTab} onTab={setImportTab} onClose={() => setModal(null)} dragOver={dragOver} onRemove={(name) => setRemoval({ name })} onRemoveAll={() => setRemoval({ all: true })} /> : null}
        {modal === "log" ? <LogModal lines={sessionState.log} onCopy={copyLog} onClose={() => setModal(null)} /> : null}
        {modal === "file-check" && fileCheckCard !== null ? <FileCheckModal card={fileCheckCard} onClose={() => setModal(null)} /> : null}
        {modal === "clear-saved-play" ? <div data-modal="clear-saved-play"><Confirm veil question="Clear saved play for this game?" consequence="NVRAM, configuration and all three slots will be removed. Game files stay." confirmLabel="Clear saved play for this game…" onCancel={() => setModal(null)} onConfirm={() => {
            setModal(null);
            if (session !== null) void session.clearSavedPlay().finally(refreshPreferences);
        }} /></div> : null}
        {removal === null ? null : <div data-modal="remove-file"><Confirm veil
            question={"all" in removal ? "Remove every stored file?" : `Remove ${removal.name}?`}
            consequence={"all" in removal ? "Every game archive saved in this browser is deleted. Saved play is kept." : "The archive is deleted from this browser; the game needs it again before it can play. Saved play is kept."}
            confirmLabel={"all" in removal ? "Remove all" : "Remove"}
            onCancel={() => setRemoval(null)}
            onConfirm={() => { const target = removal; setRemoval(null); void ("all" in target ? models.library.clearStored() : models.library.removeArchive(target.name)); }} /></div>}
        {modal === "restart" ? <div data-modal="restart"><Confirm veil question="Restart from power-on?" consequence="Current changes are saved, then the machine starts fresh." confirmLabel="Restart from power-on…" onCancel={() => setModal(null)} onConfirm={() => { setModal(null); session?.reset("hard"); }} /></div> : null}
    </FocusProvider>;
}

export function LocalPage() {
    const [models, setModels] = useState<LocalModels | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const preferences = new PreferenceStore(localStorage);
                if (!preferences.hasGlobalRecord() && navigator.maxTouchPoints > 0 && (navigator.getGamepads?.() ?? []).filter(Boolean).length === 0) {
                    preferences.updateGlobal({ controllerView: true });
                }
                const library = await LibraryModel.init({ fetch: window.fetch.bind(window), baseUrl: location.href, search: location.search });
                await library.initialize();
                if (!cancelled) setModels({ library, preferences });
            } catch (reason) {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "The arcade library could not be loaded.");
            }
        })();
        return () => { cancelled = true; };
    }, []);
    if (error !== null) return <Desk><Window title="Arcade Library — no game"><p data-local-error>{error}</p></Window></Desk>;
    if (models === null) return <Desk><Window title="Arcade Library — no game"><p data-local-loading>Loading the arcade library…</p></Window></Desk>;
    return <LocalWorkspace models={models} />;
}
