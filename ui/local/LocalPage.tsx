// realizes: docs/ui-spec.md > §7 Local desktop page

import { useEffect, useMemo, useRef, useState } from "react";
import { FocusProvider } from "../focus/FocusController.js";
import { Button, Confirm, Desk, Hint, Modal, StatusBar, Window } from "../kit/index.js";
import { LibraryModel } from "../model/library.js";
import { controllerVisible, IndexedDbSavedPlayStore, PreferenceStore } from "../model/preferences.js";
import { SessionModel } from "../model/session.js";
import type { LibrarySnapshot, LocalAdapterBoundary, LocalSlot, SessionSnapshot } from "../model/types.js";
import { FileCheckModal } from "./FileCheckModal.js";
import { GamesColumn } from "./GamesColumn.js";
import { ImportActions, ImportModal } from "./ImportModal.js";
import { LogModal } from "./LogModal.js";
import { LocalMenus, type LocalMenuActions } from "./menus.js";
import { PlaySurface } from "./PlaySurface.js";
import { Strip } from "./Strip.js";
import { SettingsModal } from "./SettingsModal.js";
import { ControlsModal } from "./ControlsModal.js";
import { PerGameModal } from "./PerGameModal.js";
import { PresentationWindow } from "./presentation/PresentationWindow.js";
import { PhoneLayoutContext } from "../kit/LayoutContext.js";
import { PhonePage } from "./phone/PhonePage.js";
import { MenuWindow } from "./phone/MenuWindow.js";
import { useLayout } from "./phone/useLayout.js";
import { usePresentation } from "./presentation/usePresentation.js";

interface LocalModels {
    readonly library: LibraryModel;
    readonly preferences: PreferenceStore;
}

type OpenModal = "import" | "settings" | "controls" | "per-game" | "log" | "file-check" | "clear-saved-play" | "restart" | null;

const EMPTY_SESSION: SessionSnapshot = {
    mode: "local", windowOpen: false, windowView: "game", lastFrame: null, hintVisible: false,
    status: "idle", message: "Loading the arcade library…", activeKey: null, machine: null,
    muted: false, fullscreen: false, touchDevice: false, layout: null, pads: [], log: [], busy: false,
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
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [session, setSession] = useState<SessionModel | null>(null);
    const library = useLibrarySnapshot(models.library);
    const sessionState = useSessionSnapshot(session);
    const [preferenceVersion, setPreferenceVersion] = useState(0);
    const preferences = useMemo(() => models.preferences.getGlobal(), [models.preferences, preferenceVersion]);
    const presentation = sessionState.mode === "presentation";
    const layout = useLayout(sessionState.touchDevice);
    const phone = layout !== "desktop";
    const landscape = layout === "phone-landscape";
    const controller = controllerVisible(preferences.controllerView, sessionState.touchDevice, sessionState.pads.length);
    const [phoneWindow, setPhoneWindow] = useState<"games" | "menu" | null>(null);
    const [barVisible, setBarVisible] = useState(true);
    const [activity, setActivity] = useState(0);
    const { padHint, padStatus } = usePresentation(session, sessionState, preferences, canvasRef, phone ? () => setPhoneWindow((current) => current === "menu" ? null : "menu") : undefined);
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
            presentationRoot: rootRef.current ?? undefined,
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
        window.addEventListener("gamepadconnected", refresh);
        window.addEventListener("gamepaddisconnected", refresh);
        refresh();
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("fullscreenchange", refresh);
            window.removeEventListener("pagehide", refresh);
            window.removeEventListener("gamepadconnected", refresh);
            window.removeEventListener("gamepaddisconnected", refresh);
        };
    }, [session]);

    useEffect(() => {
        if (session === null) return;
        session.setInputPaused(modal !== null || removal !== null || phone && phoneWindow !== null);
        return () => session.setInputPaused(false);
    }, [modal, removal, phone, phoneWindow, session]);

    useEffect(() => {
        document.documentElement.dataset.density = phone ? "phone" : presentation ? "tv" : "desktop";
        document.documentElement.dataset.layout = layout;
        document.documentElement.dataset.mode = sessionState.mode;
    }, [phone, layout, presentation, sessionState.mode]);

    useEffect(() => {
        setBarVisible(true);
        if (!phone || presentation || controller || (!landscape && !sessionState.fullscreen) || phoneWindow !== null || modal !== null) return;
        const timer = window.setTimeout(() => setBarVisible(false), 3000);
        return () => window.clearTimeout(timer);
    }, [phone, presentation, controller, landscape, sessionState.fullscreen, phoneWindow, modal, activity]);

    useEffect(() => { if (!phone || presentation) setPhoneWindow(null); }, [phone, presentation]);

    useEffect(() => {
        if (presentation) return;
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
    }, [models.library, presentation]);

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
        setPhoneWindow(null);
        setOpenMenu(undefined);
    };
    const toggleController = (): void => {
        models.preferences.updateGlobal({ controllerView: !controller });
        refreshPreferences();
        setOpenMenu(undefined);
    };

    const actions: LocalMenuActions = {
        presentation: closeMenu(() => { session?.enterPresentation(); refreshPreferences(); }),
        menuHint: closeMenu(() => { models.preferences.updateGlobal({ general: { ...preferences.general, presentationHint: !preferences.general.presentationHint } }); refreshPreferences(); }),
        settings: closeMenu(() => setModal("settings")),
        controls: closeMenu(() => setModal("controls")),
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
        controllerView={controller}
        showFps={preferences.showFps}
        menuHint={preferences.general.presentationHint}
        size={preferences.size}
        selectedSlot={selectedSlot}
        onSelectedSlot={setSelectedSlot}
        gamePreferences={gamePreferences}
        hasFileCheck={selectedCard?.report !== null && selectedCard !== null}
        actions={actions}
    />;

    const status = <StatusBar message={statusMessage} state={statusState(sessionState.status)}>
        <span className="status-cell" data-status-cell="video">{sessionState.machine === null ? "No video" : `${sessionState.machine.width} × ${sessionState.machine.height} · ${sessionState.machine.refreshHz.toFixed(2)} Hz`}</span>
        <span className="status-cell" data-status-cell="input">{sessionState.touchDevice ? "touch" : "Keyboard"} · {sessionState.pads.length === 0 ? "no pads" : sessionState.pads.map((pad) => `P${pad.player}`).join(", ")}</span>
        <span className="status-cell" data-status-cell="autosave">Auto-save {preferences.autoSave ? "on" : "off"}</span>
    </StatusBar>;

    const closeTop = (): void => {
        if (presentation && session !== null) {
            if (sessionState.windowView !== "game") session.openWindow("game");
            else session.closeWindow();
        } else if (modal !== null) setModal(null);
        else if (phoneWindow !== null) setPhoneWindow(null);
        else if (phone) setPhoneWindow("menu");
        else if (openMenu !== undefined) setOpenMenu(undefined);
        else if (openRows.size > 0) setOpenRows(new Set());
    };

    const games = <GamesColumn
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
        onPlay={(key) => { if (session !== null) void session.start(key); setPhoneWindow(null); setModal(null); }}
        onResume={() => { if (paused) session?.pauseResume(); setPhoneWindow(null); }}
        onFileCheck={openFileCheck}
    />;

    const presentationFocus = presentation && sessionState.windowOpen && sessionState.windowView !== "controllers";
    const phoneDialog = phone && (modal !== null || removal !== null);
    const acceptPhonePad = (pad: Gamepad): boolean => document.querySelector('[data-capturing="true"]') === null
        && !(preferences.controls.menuGesture[pad.id] ?? [10, 11]).every((button) => pad.buttons[button]?.pressed);
    return <PhoneLayoutContext.Provider value={phone}><div ref={rootRef} className="local-page" data-mode={sessionState.mode} data-layout={layout} data-density={phone ? "phone" : presentation ? "tv" : "desktop"} data-fullscreen={sessionState.fullscreen} data-bar-visible={barVisible} data-swap-sides={preferences.swapSides}
        onPointerDownCapture={() => { setBarVisible(true); setActivity((value) => value + 1); }}>
    <FocusProvider onBack={closeTop} gamepadEnabled={presentation ? presentationFocus : !running && phoneWindow === null && !phoneDialog} keyboardEnabled={presentation ? presentationFocus : phoneWindow === null && !phoneDialog} escapeEnabled={!presentation && phoneWindow === null && !phoneDialog} columns={presentation}
        acceptGamepad={presentation ? (pad) => session?.snapshot().windowOpen === true
            && !(preferences.controls.menuGesture[pad.id] ?? [10, 11]).every((button) => pad.buttons[button]?.pressed) : undefined}>
        <Desk>
            <Window className="local-window" hideTitle={presentation || phone && sessionState.fullscreen} title={phone ? "Arcade Library" : `Arcade Library — ${titleGame}`} secondary={phone ? titleGame : "Play mode"} menu={presentation || phone ? undefined : menus} status={presentation || phone && (landscape || sessionState.fullscreen) ? undefined : status}>
                <div className="local-layout">
                    {presentation || phone ? null : games}
                    <div className="play-region" data-region="play-and-controller" data-controller-visible={controller}>
                        <PlaySurface canvasRef={canvasRef} containerRef={containerRef} session={sessionState} showFps={preferences.showFps} presentation={presentation} />
                        {presentation || session === null ? null : phone ? <PhonePage model={session} state={sessionState} landscape={landscape} controller={controller} swapSides={preferences.swapSides} actions={actions}
                            onGames={() => { setModal(null); setPhoneWindow("games"); }} onMenu={() => setPhoneWindow("menu")} /> : controller ? <Strip model={session} session={sessionState} /> : null}
                    </div>
                </div>
            </Window>
        </Desk>
        {presentation && sessionState.hintVisible ? <div data-presentation-hint><Hint><b>{padHint}</b> · <b>Esc</b> · <b>two-finger tap</b> to open the menu</Hint></div> : null}
        {presentation && sessionState.windowOpen && session !== null ? <PresentationWindow session={session} state={sessionState} library={models.library} snapshot={library} preferences={models.preferences} padStatus={padStatus} onPreferences={refreshPreferences} /> : null}
        {!phone && modal === "import" ? <ImportModal library={models.library} snapshot={library} tab={importTab} onTab={setImportTab} onClose={() => { setModal(null); models.library.dismissImports(); }} dragOver={dragOver} onRemove={(name) => setRemoval({ name })} onRemoveAll={() => setRemoval({ all: true })} onPlay={(key) => { if (session !== null) void session.start(key); }} /> : null}
        {phone && !presentation && (phoneWindow === "games" || modal === "import") ? <FocusProvider acceptGamepad={acceptPhonePad} keyboardEnabled={removal === null} gamepadEnabled={removal === null} onBack={() => { if (modal === "import") { setModal(null); setPhoneWindow("games"); models.library.dismissImports(); } else setPhoneWindow(null); }}>
            <div data-modal="phone-games" data-phone-games data-phone-games-state={modal === "import" ? importTab : "games"}>
                <Modal title={modal === "import" ? importTab === "import" ? "Import" : "Stored files" : "Games"} onClose={() => { setPhoneWindow(null); setModal(null); models.library.dismissImports(); }}
                    foot={modal === "import" && importTab === "import" ? <ImportActions library={models.library} snapshot={library} onClose={() => { setModal(null); setPhoneWindow(null); models.library.dismissImports(); }} onPlay={(key) => { void session?.start(key); }} /> : undefined}>
                    {modal === "import" ? <>
                        <Button label="‹ Games" data-phone-games-back onClick={() => { setModal(null); setPhoneWindow("games"); models.library.dismissImports(); }} />
                        <ImportModal inline library={models.library} snapshot={library} tab={importTab} onTab={setImportTab} onClose={() => { setModal(null); setPhoneWindow(null); models.library.dismissImports(); }} dragOver={dragOver} onRemove={(name) => setRemoval({ name })} onRemoveAll={() => setRemoval({ all: true })} onPlay={(key) => { void session?.start(key); }} />
                    </> : games}
                </Modal>
            </div>
        </FocusProvider> : null}
        {phone && !presentation && phoneWindow === "menu" && modal === null ? <MenuWindow acceptGamepad={acceptPhonePad} title={titleGame} status={sessionState.status} running={running} supportsSave={supportsSave} controllerView={controller} size={preferences.size} selectedSlot={selectedSlot} onSelectedSlot={setSelectedSlot} gamePreferences={gamePreferences} hasFileCheck={selectedCard?.report !== null && selectedCard !== null} actions={actions} landscape={landscape} swapSides={preferences.swapSides}
            onSwapSides={() => { models.preferences.updateGlobal({ swapSides: !preferences.swapSides }); refreshPreferences(); }} onClose={() => setPhoneWindow(null)} /> : null}
        <PhoneDialogScope acceptGamepad={acceptPhonePad} enabled={phoneDialog && modal !== "import" || phone && removal !== null} onBack={() => {
            if (removal !== null) { setRemoval(null); return; }
            // Use each dialog's own cancellation path so staged previews are restored.
            Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-modal] [data-modal-close]') ?? []).at(-1)?.click();
        }}>
        {modal === "settings" ? <SettingsModal
            preferences={models.preferences}
            library={models.library}
            librarySnapshot={library}
            session={session}
            onClose={() => setModal(null)}
            onApplied={refreshPreferences}
            onManageStored={() => { session?.previewGlobal(models.preferences.getGlobal()); setImportTab("stored"); setModal("import"); }}
            onManageGames={() => { session?.previewGlobal(models.preferences.getGlobal()); setModal("per-game"); }}
        /> : null}
        {modal === "controls" ? <ControlsModal
            preferences={models.preferences}
            session={session}
            gameKey={selectedKey}
            gameName={selectedCard?.metadata?.description ?? null}
            machine={sessionState.machine}
            onClose={() => setModal(null)}
            onApplied={refreshPreferences}
        /> : null}
        {modal === "per-game" ? <PerGameModal
            preferences={models.preferences}
            gameName={(key) => models.library.card(key)?.metadata?.description ?? key}
            onClose={() => setModal(null)}
            onChanged={() => { refreshPreferences(); void session?.applyPreferences(); }}
        /> : null}
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
        </PhoneDialogScope>
    </FocusProvider></div></PhoneLayoutContext.Provider>;
}

function PhoneDialogScope({ enabled, onBack, acceptGamepad, children }: { readonly enabled: boolean; readonly onBack: () => void; readonly acceptGamepad: (pad: Gamepad) => boolean; readonly children: import("react").ReactNode }) {
    return enabled ? <FocusProvider onBack={onBack} acceptGamepad={acceptGamepad}>{children}</FocusProvider> : children;
}

export function LocalPage() {
    const [models, setModels] = useState<LocalModels | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const preferences = new PreferenceStore(localStorage, new IndexedDbSavedPlayStore(indexedDB));
                const library = await LibraryModel.init({
                    fetch: window.fetch.bind(window),
                    baseUrl: location.href,
                    search: location.search,
                    strictness: preferences.getGlobal().storage.strictness,
                });
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
