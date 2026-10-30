// realizes: docs/ui-spec.md > §8.1 Menu window

import { useState } from "react";
import { FocusProvider } from "../../focus/FocusController.js";
import { Modal, Selector, Tabs } from "../../kit/index.js";
import { MenuListItem } from "../../kit/PhoneChrome.js";
import type { LocalMenusProps } from "../menus.js";
import type { LocalSize, LocalSlot } from "../../model/types.js";

interface MenuWindowProps extends Pick<LocalMenusProps, "running" | "supportsSave" | "controllerView" | "size" | "selectedSlot" | "onSelectedSlot" | "gamePreferences" | "hasFileCheck" | "actions"> {
    readonly title: string;
    readonly status: string;
    readonly landscape: boolean;
    readonly swapSides: boolean;
    readonly onSwapSides: () => void;
    readonly onClose: () => void;
    readonly acceptGamepad: (pad: Gamepad) => boolean;
}

export function MenuWindow(props: MenuWindowProps) {
    const [tab, setTab] = useState("view");   // View · Configure · State (order decided 2026-10-29)
    const { actions } = props;
    const saveReason = !props.running ? "no game" : !props.supportsSave ? "driver cannot save" : undefined;
    const saved = props.gamePreferences.slots[props.selectedSlot]?.savedAt;
    const close = (action: () => void): (() => void) => () => { props.onClose(); action(); };
    const step = (offset: number): void => setTab((current) => ["view", "configure", "state"][(["view", "configure", "state"].indexOf(current) + offset + 3) % 3]!);
    return <FocusProvider acceptGamepad={props.acceptGamepad} onBack={props.onClose} onTabPrevious={() => step(-1)} onTabNext={() => step(1)}>
        <div data-modal="phone-menu" data-phone-menu data-phone-menu-tab={tab}><Modal title="Menu" onClose={props.onClose}>
            <Tabs arrowSelect id="phone-menu-tabs" tabs={[{ id: "view", label: "View" }, { id: "configure", label: "Configure" }, { id: "state", label: "State" }]} active={tab} onChange={setTab} />
            <div className="phone-menu-list">
                {tab === "state" ? <>
                    <div className="phone-game-card"><strong>{props.title}</strong><small>{props.status}</small></div>
                    <Selector id="phone-slot" label="Slot" values={["slot 1", "slot 2", "slot 3"]} value={props.selectedSlot.replace("slot", "slot ")} onChange={(value) => props.onSelectedSlot(value.replace(" ", "") as LocalSlot)} small={saved ?? "empty"} />
                    <MenuListItem id="save-slot" label="Save state" small={saveReason ?? props.selectedSlot.replace("slot", "slot ")} disabled={saveReason !== undefined} onSelect={() => actions.saveSlot(props.selectedSlot)} />
                    <MenuListItem id="load-slot" label="Load state" small={saveReason ?? saved ?? "empty"} disabled={saveReason !== undefined || saved === undefined} onSelect={() => actions.loadSlot(props.selectedSlot)} />
                    <MenuListItem id="save-progress" label="Save progress" disabled={!props.running} onSelect={actions.saveChanges} />
                    <MenuListItem id="clear-saved-play" label="Clear saved play for this game…" disabled={!props.running} onSelect={close(actions.clearSavedPlay)} />
                    <MenuListItem id="reset" label="Reset" disabled={!props.running} onSelect={close(actions.reset)} />
                    <MenuListItem id="restart" label="Restart from power-on…" disabled={!props.running} onSelect={close(actions.restart)} />
                </> : tab === "view" ? <>
                    <MenuListItem id="controller" label="Controller" small={props.controllerView ? "on" : "off"} onSelect={actions.controller} />
                    <MenuListItem id="fullscreen" label="Fullscreen" onSelect={close(() => actions.fullscreen(false))} />
                    <div className="phone-menu-selector"><span>Size</span><Selector id="phone-size" label="Size" values={["Fit", "Stretch", "Integer"]} value={props.size[0]!.toUpperCase() + props.size.slice(1)} onChange={(value) => actions.size(value.toLowerCase() as LocalSize)} /></div>
                    {props.landscape ? <MenuListItem id="swap-sides" label="Swap sides" small={props.swapSides ? "on" : "off"} onSelect={props.onSwapSides} /> : null}
                    <MenuListItem id="presentation" label="Presentation…" onSelect={close(actions.presentation)} />
                </> : <>
                    <MenuListItem id="settings" label="Settings…" onSelect={close(actions.settings)} />
                    <MenuListItem id="controls" label="Controls…" onSelect={close(actions.controls)} />
                    <MenuListItem id="stored-files" label="Stored files…" onSelect={close(actions.storedFiles)} />
                    <MenuListItem id="technical-log" label="Technical log…" onSelect={close(actions.technicalLog)} />
                    <MenuListItem id="file-check" label="File check…" disabled={!props.hasFileCheck} onSelect={close(actions.fileCheck)} />
                </>}
            </div>
        </Modal></div>
    </FocusProvider>;
}
