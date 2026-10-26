// realizes: docs/ui-spec.md > §7.4 Menu bar and fixed shortcuts

import type { ReactNode } from "react";
import { Button, MenuBar, type MenuDefinition } from "../kit/index.js";
import type { GamePreferences } from "../model/preferences.js";
import type { LocalSize, LocalSlot } from "../model/types.js";

export interface LocalMenuActions {
    readonly settings: () => void;
    readonly controls: () => void;
    readonly storedFiles: () => void;
    readonly saveSlot: (slot: LocalSlot) => void;
    readonly loadSlot: (slot: LocalSlot) => void;
    readonly saveChanges: () => void;
    readonly clearSavedPlay: () => void;
    readonly reset: () => void;
    readonly restart: () => void;
    readonly controller: () => void;
    readonly showFps: () => void;
    readonly size: (size: LocalSize) => void;
    readonly fullscreen: (stretched: boolean) => void;
    readonly technicalLog: () => void;
    readonly fileCheck: () => void;
    readonly copyLog: () => void;
    readonly pauseResume: () => void;
    readonly mute: () => void;
}

export interface LocalMenusProps {
    readonly openId?: string;
    readonly onOpen: (id: string) => void;
    readonly running: boolean;
    readonly paused: boolean;
    readonly muted: boolean;
    readonly supportsSave: boolean;
    readonly controllerView: boolean;
    readonly showFps: boolean;
    readonly size: LocalSize;
    readonly selectedSlot: LocalSlot;
    readonly onSelectedSlot: (slot: LocalSlot) => void;
    readonly gamePreferences: GamePreferences;
    readonly hasFileCheck: boolean;
    readonly actions: LocalMenuActions;
}

const slotLabel = (slot: LocalSlot): string => slot.replace("slot", "slot ");
const slotTime = (preferences: GamePreferences, slot: LocalSlot): string => preferences.slots[slot]?.savedAt ?? "empty";
const disabledReason = (running: boolean, supportsSave: boolean): string | undefined => !running ? "no game" : !supportsSave ? "driver cannot save" : undefined;

export function menuDefinitions(props: LocalMenusProps): ReadonlyArray<MenuDefinition> {
    const saveDisabled = disabledReason(props.running, props.supportsSave);
    const slotEntries = (["slot1", "slot2", "slot3"] as const).flatMap((slot) => [
        { id: `save-${slot}`, label: `Save to ${slotLabel(slot)}`, small: saveDisabled ?? slotTime(props.gamePreferences, slot), disabled: saveDisabled !== undefined, onSelect: () => props.actions.saveSlot(slot) },
        { id: `load-${slot}`, label: `Load ${slotLabel(slot)}`, small: saveDisabled ?? slotTime(props.gamePreferences, slot), disabled: saveDisabled !== undefined || props.gamePreferences.slots[slot] === undefined, onSelect: () => props.actions.loadSlot(slot) },
    ]);
    return [
        { id: "configure", label: <><u>C</u>onfigure</>, entries: [
            { id: "settings", label: "Settings…", small: "next package", disabled: true, onSelect: props.actions.settings },
            { id: "controls", label: "Controls…", small: "next package", disabled: true, onSelect: props.actions.controls },
            { id: "settings-separator", label: "", separator: true },
            { id: "stored-files", label: "Stored files…", onSelect: props.actions.storedFiles },
        ] },
        { id: "state", label: <><u>S</u>tate</>, entries: [
            ...slotEntries,
            { id: "state-separator-1", label: "", separator: true },
            { id: "save-changes", label: "Save changes", disabled: !props.running, small: props.running ? undefined : "no game", onSelect: props.actions.saveChanges },
            { id: "clear-saved-play", label: "Clear saved play for this game…", disabled: !props.running, onSelect: props.actions.clearSavedPlay },
            { id: "state-separator-2", label: "", separator: true },
            { id: "reset", label: "Reset", disabled: !props.running, onSelect: props.actions.reset },
            { id: "restart", label: "Restart from power-on…", disabled: !props.running, onSelect: props.actions.restart },
        ] },
        { id: "view", label: <><u>V</u>iew</>, entries: [
            { id: "controller-view", label: "Controller view", checked: props.controllerView, onSelect: props.actions.controller },
            { id: "show-fps", label: "Show FPS", checked: props.showFps, onSelect: props.actions.showFps },
            { id: "view-separator-1", label: "", separator: true },
            { id: "size-fit", label: "Size: Fit", radio: props.size === "fit", onSelect: () => props.actions.size("fit") },
            { id: "size-stretch", label: "Size: Stretch", radio: props.size === "stretch", onSelect: () => props.actions.size("stretch") },
            { id: "size-integer", label: "Size: Integer", radio: props.size === "integer", onSelect: () => props.actions.size("integer") },
            { id: "view-separator-2", label: "", separator: true },
            { id: "fullscreen", label: "Fullscreen", disabled: !props.running, onSelect: () => props.actions.fullscreen(false) },
            { id: "fullscreen-stretched", label: "Fullscreen, stretched", disabled: !props.running, onSelect: () => props.actions.fullscreen(true) },
            { id: "view-separator-3", label: "", separator: true },
            { id: "mode-play", label: "Mode: Play", checked: true },
            { id: "mode-presentation", label: "Mode: Presentation…", small: "next package", disabled: true },
        ] },
        { id: "log", label: <><u>L</u>og</>, entries: [
            { id: "technical-log", label: "Technical log…", onSelect: props.actions.technicalLog },
            { id: "file-check", label: "Detailed file check…", disabled: !props.hasFileCheck, onSelect: props.actions.fileCheck },
            { id: "copy-log", label: "Copy log", onSelect: props.actions.copyLog },
        ] },
    ];
}

function Shortcut({ id, children }: { readonly id: string; readonly children: ReactNode }) {
    return <span data-shortcut={id}>{children}</span>;
}

export function LocalMenus(props: LocalMenusProps) {
    const saveReason = disabledReason(props.running, props.supportsSave);
    const saveDisabled = saveReason !== undefined;
    return <MenuBar menus={menuDefinitions(props)} openId={props.openId} onOpen={props.onOpen} shortcuts={<>
        <Shortcut id="pause"><Button size="sm" glyph={props.paused ? "▶" : "⏸"} label={props.paused ? "Resume" : "Pause"} disabled={!props.running} onClick={props.actions.pauseResume} /></Shortcut>
        <Shortcut id="mute"><Button size="sm" glyph={props.muted ? "🔊" : "🔇"} label={props.muted ? "Unmute" : "Mute"} disabled={!props.running} onClick={props.actions.mute} /></Shortcut>
        <Shortcut id="reset"><Button size="sm" glyph="↺" label="Reset" disabled={!props.running} onClick={props.actions.reset} /></Shortcut>
        <span className="slot-group" data-shortcut="slots">
            <label>Slot <select data-slot-picker value={props.selectedSlot} onChange={(event) => props.onSelectedSlot(event.target.value as LocalSlot)}>
                {(["slot1", "slot2", "slot3"] as const).map((slot) => <option value={slot} key={slot}>{slot.slice(-1)} — {slotTime(props.gamePreferences, slot)}</option>)}
            </select></label>
            <Button size="sm" glyph="💾" label="Save" title={saveReason} disabled={saveDisabled} onClick={() => props.actions.saveSlot(props.selectedSlot)} />
            <Button size="sm" glyph="📂" label="Load" title={saveReason} disabled={saveDisabled || props.gamePreferences.slots[props.selectedSlot] === undefined} onClick={() => props.actions.loadSlot(props.selectedSlot)} />
        </span>
        <Shortcut id="fullscreen"><Button size="sm" glyph="⛶" label="Fullscreen" disabled={!props.running} onClick={() => props.actions.fullscreen(false)} /></Shortcut>
        <Shortcut id="controller"><Button size="sm" glyph="🕹" label="Controller" onClick={props.actions.controller} /></Shortcut>
    </>} />;
}
