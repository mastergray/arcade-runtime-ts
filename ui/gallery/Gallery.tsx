// realizes: docs/ui-design-language.md > §3 Components and §6.3 Gallery page

import { useEffect, useState, type ReactNode } from "react";
import { FocusProvider } from "../focus/FocusController.js";
import {
    ActionButton, Bar, Bevel, Button, CanvasFrame, Card, Chip, Confirm, ControllerStrip, ControlsPicture,
    DPad, Dot, DropZone, FieldLine, Fieldset, Hint, Icon, KeyValue, List, ListFoot, ListHead, MenuBar,
    MenuListRow, Modal, Pill, RedButton, Selector, StatusBar, Table, Tabs, Terminal, TitleBar, Window,
} from "../kit/index.js";

type Density = "desktop" | "phone" | "tv";

interface SampleProps {
    readonly component: string;
    readonly state?: string;
    readonly children: ReactNode;
}

const TAB_DEFINITIONS = [
    { id: "state", label: "State" },
    { id: "view", label: "View" },
    { id: "settings", label: "Settings" },
] as const;

function Sample({ component, state = "default", children }: SampleProps) {
    return <article className="bevel component-instance" data-component={component} data-state={state}>
        <div className="component-label"><span>{component}</span><span>{state}</span></div>
        {children}
    </article>;
}

function ChromeSection({ allStates }: { readonly allStates: boolean }) {
    const [openMenu, setOpenMenu] = useState<string | undefined>("settings");
    const menus = [{ id: "settings", label: <><u>S</u>ettings</>, entries: [
        { id: "presentation", label: "Presentation…" },
        { id: "controller", label: "Controller", checked: true },
        { id: "disabled", label: "Load state", disabled: true, small: "slot 1" },
        { id: "separator", label: "", separator: true },
        { id: "radio", label: "Fit", radio: true, small: "View" },
    ] }];
    return <section id="chrome" className="gallery-section" data-section="chrome">
        <h2>Chrome</h2>
        <div className="component-grid">
            <Sample component="title-bar"><TitleBar title="Arcade" secondary="playing" /></Sample>
            <Sample component="menu-bar" state="open"><MenuBar menus={menus} openId={openMenu} onOpen={(id) => setOpenMenu(openMenu === id ? undefined : id)} shortcuts={<><Button size="sm" label="Pause" /><Button size="sm" label="Mute" /><Button size="sm" label="Reset" /></>} /></Sample>
            {allStates ? <Sample component="menu-item" state="disabled"><MenuBar menus={menus} openId="settings" /></Sample> : null}
            <Sample component="pinned-shortcuts"><div className="pinned"><Button size="sm" label="Pause" /><Button size="sm" label="Mute" /><Button size="sm" label="Fullscreen" /><Button size="sm" label="Controller" /></div></Sample>
            <Sample component="status-bar" state="running"><StatusBar message="Game name" state="running" secondary="ready" /></Sample>
            {allStates ? <><Sample component="status-bar" state="paused"><StatusBar message="Game name" state="paused" /></Sample><Sample component="status-bar" state="idle"><StatusBar message="Games" state="idle" /></Sample></> : null}
            <Sample component="separator"><hr className="separator" /></Sample>
            <Sample component="bevel"><Bevel>Raised surface</Bevel><Bevel kind="sunken">Sunken surface</Bevel></Sample>
            <Sample component="window"><Window title="Arcade" status={<StatusBar message="Game name" state="running" />}><CanvasFrame /></Window></Sample>
        </div>
    </section>;
}

function ControlsSection({ allStates }: { readonly allStates: boolean }) {
    const [selector, setSelector] = useState("slot 1");
    return <section id="buttons-controls" className="gallery-section" data-section="buttons-controls">
        <h2>Buttons and controls</h2>
        <div className="component-grid">
            <Sample component="button"><div className="demo-row"><Button focusId="button-default" label="Pause" /><Button label="Save progress" primary /><Button label="Play" play glyph="▶" /></div></Sample>
            {allStates ? <><Sample component="button" state="focus"><Button focusId="button-focus" label="Mute" /></Sample><Sample component="button" state="disabled"><Button label="Load state" disabled /></Sample></> : null}
            <Sample component="action-button"><ActionButton focusId="action-sample" focusGroup="action-sample" glyph="▶" label="Play" trailing="ready" /></Sample>
            {allStates ? <Sample component="action-button" state="disabled"><ActionButton glyph="▶" label="Play" disabled /></Sample> : null}
            <Sample component="selector"><Selector id="gallery-selector" values={["slot 1", "slot 2", "slot 3"]} value={selector} label="Load state slot" onChange={setSelector} /></Sample>
            <Sample component="select"><label>Slot <select defaultValue="slot 1"><option>slot 1</option><option>slot 2</option><option>slot 3</option></select></label></Sample>
            <Sample component="checkbox-radio"><div className="demo-stack"><label><input type="checkbox" defaultChecked /> Controller</label><label><input type="radio" defaultChecked /> Fit</label></div></Sample>
            <Sample component="range"><label>Analogue <input type="range" aria-label="Analogue" /> 50</label></Sample>
            <Sample component="chip"><div className="demo-row"><Chip label="Now" />{allStates ? <Chip label="Now" on /> : null}</div></Sample>
            <Sample component="bar"><Bar value={75} /></Sample>
            <Sample component="dot"><div className="demo-stack"><Dot label="ready" tone="ok" />{allStates ? <><Dot label="Missing files" tone="bad" /><Dot label="Pending" tone="warn" /><Dot label="Skip" /></> : null}</div></Sample>
            <Sample component="pill"><div className="demo-row"><Pill label="COIN" /><Pill label="START" pressed={allStates} /></div></Sample>
            <Sample component="red-button"><div className="demo-row"><RedButton number={1} />{allStates ? <><RedButton number={2} pressed /><RedButton number={3} off /></> : null}</div></Sample>
            <Sample component="d-pad"><div className="demo-row"><DPad />{allStates ? <DPad pressed="right" /> : null}</div></Sample>
            <Sample component="drop-zone"><div className="demo-stack"><DropZone />{allStates ? <DropZone dragOver /> : null}</div></Sample>
        </div>
    </section>;
}

function ContainersSection({ allStates }: { readonly allStates: boolean }) {
    const [tab, setTab] = useState("state");
    return <section id="containers" className="gallery-section" data-section="containers">
        <h2>Containers</h2>
        <div className="component-grid">
            <Sample component="modal"><Modal title="Settings" veil={false} foot={<><Button label="Cancel" /><Button label="Save progress" primary /></>}><p className="note">Settings</p></Modal></Sample>
            <Sample component="tabs"><Tabs id="gallery-tabs" tabs={TAB_DEFINITIONS} active={tab} onChange={setTab} /></Sample>
            <Sample component="pane"><div className="pane" data-component="pane"><p className="note">Controls</p>{allStates ? <p className="note" data-warn="true">Restart from power-on…</p> : null}</div></Sample>
            <Sample component="fieldset"><Fieldset legend="Settings"><FieldLine><input type="checkbox" defaultChecked /> Mute</FieldLine><FieldLine><input type="radio" defaultChecked /> Fit</FieldLine></Fieldset></Sample>
            <Sample component="key-value"><KeyValue entries={[{ label: "Size", value: "Fit" }, { label: "Controller", value: "On" }]} /></Sample>
            <Sample component="table"><Table id="gallery-table" columns={["Input", "Control", "Now"]} rows={[
                { id: "section", cells: ["Player 1"], section: true },
                { id: "selected", cells: ["Up", "Arrow up", <Chip label="Now" />], selected: allStates, focusable: true },
                { id: "held", cells: ["Button 1", "Control", <Chip label="Now" on />], held: allStates },
                { id: "dim", cells: ["Button 6", "Not stored", "Skip"], dim: allStates },
            ]} /></Sample>
            <Sample component="terminal"><Terminal lines={["Technical log", "ready", "playing"]} /></Sample>
            <Sample component="confirmation"><Confirm question="Restart from power-on?" consequence="Saved play remains available." confirmLabel="Restart from power-on…" /></Sample>
        </div>
    </section>;
}

function ListsSection({ allStates }: { readonly allStates: boolean }) {
    return <section id="lists" className="gallery-section" data-section="lists">
        <h2>Lists</h2>
        <div className="component-grid">
            <Sample component="games-list"><ListHead count="3" action={<Button size="sm" label="Import" />} /><List id="games" rows={[
                { id: "default", seed: "list-one", status: "ready", open: allStates },
                ...(allStates ? [
                    { id: "selected", seed: "list-two", status: "ready" as const, selected: true },
                    { id: "active", seed: "list-three", status: "ready" as const, active: true },
                    { id: "missing", seed: "list-four", status: "Missing files" as const },
                ] : []),
            ]} /><ListFoot>Import · Stored files</ListFoot></Sample>
            <Sample component="list-head-foot"><ListHead count="3" /><ListFoot>3 games · ready</ListFoot></Sample>
            <Sample component="stored-files-list"><List id="stored" flat rows={[{ id: "stored", seed: "stored", status: "ready" }, { id: "pending", seed: "pending", status: "Not stored" }]} /></Sample>
            <Sample component="menu-list"><div className="demo-stack"><MenuListRow id="menu-state" label="State" small="slot 1" /><MenuListRow id="menu-view" label="View" small="Fit" /><MenuListRow id="menu-settings" label="Settings" /></div></Sample>
        </div>
    </section>;
}

function GameSection({ allStates, view, setView, tvTab, setTvTab }: {
    readonly allStates: boolean;
    readonly view: string;
    readonly setView: (view: string) => void;
    readonly tvTab: string;
    readonly setTvTab: (tab: string) => void;
}) {
    const [slot, setSlot] = useState("slot 1");
    return <section id="game-specific" className="gallery-section" data-section="game-specific" data-view={view}>
        <h2>Game-specific and TV presentation</h2>
        <div className="component-grid">
            <Sample component="game-card"><Card seed="game-card" /></Sample>
            <Sample component="controller-strip"><ControllerStrip pressedButton={allStates ? 1 : undefined} pressedDirection={allStates ? "up" : undefined} /></Sample>
            <Sample component="controls-picture"><ControlsPicture /></Sample>
            <Sample component="canvas-frame"><div className="demo-stack"><CanvasFrame />{allStates ? <CanvasFrame paused /> : null}</div></Sample>
            <Sample component="start-hint"><Hint>Press <b>Esc</b> for Menu</Hint></Sample>
            <Sample component="presentation-window" state={view}>
                <Window title="Play mode" secondary={view === "controls" ? "Controllers" : "paused"}>
                    <div className="presentation-grid">
                        <div className="action-column" data-focus-column>
                            <ActionButton focusId="tv-play" focusGroup="tv-actions" glyph="▶" label="Play" trailing="ready" />
                            <ActionButton focusId="tv-save" focusGroup="tv-actions" glyph="■" label="Save state" trailing={slot} />
                            <ActionButton focusId="tv-load" focusGroup="tv-actions" glyph="▲" label="Load state" trailing={slot} />
                            <ActionButton focusId="tv-controllers" focusGroup="tv-actions" glyph="☰" label="Controllers" trailing="Controls…" onClick={() => setView("controls")} />
                            <Selector id="tv-slot" group="tv-actions" values={["slot 1", "slot 2", "slot 3"]} value={slot} label="Slot" onChange={setSlot} />
                            <ActionButton focusId="tv-mode" focusGroup="tv-actions" glyph="←" label="Play mode" />
                        </div>
                        <div className="demo-stack">{view === "controls" ? <><Tabs id="tv-tabs" tabs={TAB_DEFINITIONS} active={tvTab} onChange={setTvTab} /><ControlsPicture /></> : <><CanvasFrame /><Card seed="tv-card" /></>}</div>
                    </div>
                </Window>
            </Sample>
        </div>
    </section>;
}

export function Gallery() {
    const [density, setDensity] = useState<Density>("desktop");
    const [allStates, setAllStates] = useState(true);
    const [view, setView] = useState("menu");
    const [tvTab, setTvTab] = useState("state");

    useEffect(() => { document.documentElement.dataset.density = density; }, [density]);

    const contents = <div className="gallery" data-role="body" data-density-view={density}>
        <header className="bevel gallery-toolbar">
            <label>Density <select id="density" value={density} onChange={(event) => setDensity(event.target.value as Density)}><option value="desktop">desktop</option><option value="phone">phone</option><option value="tv">tv</option></select></label>
            <label><input id="all-states" type="checkbox" checked={allStates} onChange={(event) => setAllStates(event.target.checked)} /> show all states</label>
            <nav className="section-index" aria-label="Section index"><a href="#chrome">Chrome</a><a href="#buttons-controls">Buttons and controls</a><a href="#containers">Containers</a><a href="#lists">Lists</a><a href="#game-specific">Game-specific</a></nav>
        </header>
        <ChromeSection allStates={allStates} />
        <ControlsSection allStates={allStates} />
        <ContainersSection allStates={allStates} />
        <ListsSection allStates={allStates} />
        <GameSection allStates={allStates} view={view} setView={setView} tvTab={tvTab} setTvTab={setTvTab} />
    </div>;

    const cycleTab = (step: number): void => setTvTab((current) => {
        const index = Math.max(0, TAB_DEFINITIONS.findIndex((tab) => tab.id === current));
        return TAB_DEFINITIONS[(index + step + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length]!.id;
    });
    return <FocusProvider initialId="tv-play" onBack={() => setView("menu")} onTabPrevious={() => cycleTab(-1)} onTabNext={() => cycleTab(1)}>{density === "phone" ? <div className="bevel phone-frame">{contents}</div> : contents}</FocusProvider>;
}
