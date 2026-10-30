// realizes: docs/ui-spec.md > §3.5 and §7 Settings dialog

import { useEffect, useRef, useState } from "react";
import { Button, Confirm, FieldLine, Fieldset, KeyValue, Modal, Range, Tabs } from "../kit/index.js";
import { formatArchiveSize, type LibraryModel } from "../model/library.js";
import {
    DEFAULT_GLOBAL_PREFERENCES,
    type GlobalPreferences,
    type ImportPreferencesResult,
    type PreferenceStore,
} from "../model/preferences.js";
import type { SessionModel } from "../model/session.js";
import type { LibrarySnapshot, LocalSize } from "../model/types.js";

type SettingsTab = "general" | "video" | "audio" | "storage";

export interface SettingsModalProps {
    readonly preferences: PreferenceStore;
    readonly library: LibraryModel;
    readonly librarySnapshot: LibrarySnapshot;
    readonly session: SessionModel | null;
    readonly onClose: () => void;
    readonly onApplied: () => void;
    readonly onManageStored: () => void;
    readonly onManageGames: () => void;
}

const replace = <K extends keyof GlobalPreferences>(source: GlobalPreferences, key: K, value: GlobalPreferences[K]): GlobalPreferences =>
    ({ ...source, [key]: value });

const download = (json: string): void => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "arcade-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
};

export function SettingsModal(props: SettingsModalProps) {
    const original = useRef(props.preferences.getGlobal());
    const picker = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<SettingsTab>("general");
    const [draft, setDraft] = useState(original.current);
    const [includeSavedPlay, setIncludeSavedPlay] = useState(false);
    const [savedPlayCount, setSavedPlayCount] = useState(0);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [importText, setImportText] = useState<string | null>(null);
    const [importReport, setImportReport] = useState<ImportPreferencesResult | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => { void props.preferences.savedPlayCount().then(setSavedPlayCount).catch(() => setSavedPlayCount(0)); }, [props.preferences]);

    const preview = (next: GlobalPreferences): void => {
        setDraft(next);
        props.session?.previewGlobal(next);
    };
    const close = (): void => {
        props.session?.previewGlobal(original.current);
        props.onClose();
    };
    const apply = (): void => {
        props.preferences.setGlobal(draft);
        void props.session?.applyPreferences();
        props.onApplied();
        props.onClose();
    };
    const importJson = async (json: string, overwrite: boolean): Promise<void> => {
        try {
            const result = await props.preferences.importPreferences(json, { overwrite });
            if (!result.applied) {
                setImportText(json);
                setImportReport(result);
                return;
            }
            setDraft(props.preferences.getGlobal());
            original.current = props.preferences.getGlobal();
            setImportText(null);
            setImportReport(null);
            setMessage(`Imported ${result.imported.length} preference ${result.imported.length === 1 ? "key" : "keys"}.`);
            await props.session?.applyPreferences();
            props.onApplied();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "The settings file could not be imported.");
        }
    };

    const general = <div className="settings-pane" data-settings-tab="general">
        <Fieldset legend="When a game starts">
            <FieldLine><input data-setting="fullscreen-on-start" type="checkbox" checked={draft.general.fullscreenOnStart} onChange={(event) => preview(replace(draft, "general", { ...draft.general, fullscreenOnStart: event.currentTarget.checked }))} /> Go fullscreen when a game starts</FieldLine>
            <FieldLine><input data-setting="mute-on-start" type="checkbox" checked={draft.general.muteOnStart} onChange={(event) => preview(replace(draft, "general", { ...draft.general, muteOnStart: event.currentTarget.checked }))} /> Mute when a game starts</FieldLine>
            <FieldLine><input data-setting="auto-save" type="checkbox" checked={draft.autoSave} onChange={(event) => preview({ ...draft, autoSave: event.currentTarget.checked })} /> Save changes automatically</FieldLine>
        </Fieldset>
        <p className="note">Start choices take effect with the next game. Auto-save is used by the next cabinet session.</p>
    </div>;

    const video = <div className="settings-pane" data-settings-tab="video">
        <KeyValue entries={[
            { label: "Size", value: <select data-setting="size" value={draft.size} onChange={(event) => preview({ ...draft, size: event.currentTarget.value as LocalSize })}><option value="fit">Fit</option><option value="stretch">Stretch</option><option value="integer">Integer</option></select> },
            { label: "Filter", value: <select data-setting="filter" value={draft.video.filter} onChange={(event) => preview(replace(draft, "video", { ...draft.video, filter: event.currentTarget.value as "pixelated" | "smooth" }))}><option value="pixelated">Pixelated</option><option value="smooth">Smooth</option></select> },
            { label: "Trim left", value: <input data-setting="crop-left" type="number" min={0} max={32} value={draft.video.crop.left} onChange={(event) => preview(replace(draft, "video", { ...draft.video, crop: { ...draft.video.crop, left: Math.max(0, Math.min(32, event.currentTarget.valueAsNumber || 0)) } }))} /> },
            { label: "Trim right", value: <input data-setting="crop-right" type="number" min={0} max={32} value={draft.video.crop.right} onChange={(event) => preview(replace(draft, "video", { ...draft.video, crop: { ...draft.video.crop, right: Math.max(0, Math.min(32, event.currentTarget.valueAsNumber || 0)) } }))} /> },
        ]} />
        <label className="settings-check"><input data-setting="show-fps" type="checkbox" checked={draft.showFps} onChange={(event) => preview({ ...draft, showFps: event.currentTarget.checked })} /> Show FPS</label>
        <p className="note">Side borders are native columns, 0–32 per side. Some Neo Geo boards include narrow unused bars.</p>
    </div>;

    const audio = <div className="settings-pane" data-settings-tab="audio">
        <Range data-setting="volume" label="Volume" min={0} max={100} step={1} value={Math.round(draft.audio.volume * 100)} valueLabel={`${Math.round(draft.audio.volume * 100)} %`} onChange={(value) => preview(replace(draft, "audio", { volume: value / 100 }))} />
        <p className="note">Volume applies live and remains independent of Mute.</p>
    </div>;

    const storedBytes = props.librarySnapshot.stored.reduce((sum, entry) => sum + entry.size, 0);
    const overrideCount = props.preferences.listOverrides().length;
    const storage = <div className="settings-pane storage-settings" data-settings-tab="storage">
        <KeyValue entries={[
            { label: "Stored files", value: <><span data-storage-count="files">{props.librarySnapshot.stored.length} · {formatArchiveSize(storedBytes)}</span> <Button size="sm" label="Manage" data-settings-manage="stored" onClick={props.onManageStored} /></> },
            { label: "Saved play", value: <span data-storage-count="saved-play">{savedPlayCount} games</span> },
            { label: "Per-game settings", value: <><span data-storage-count="overrides">{overrideCount}</span> <Button size="sm" label="Manage" data-settings-manage="per-game" onClick={props.onManageGames} /></> },
            { label: "File check policy", value: <select data-setting="strictness" value={draft.storage.strictness} onChange={(event) => preview(replace(draft, "storage", { strictness: event.currentTarget.value as "strict" | "mame" }))}><option value="strict">Strict: every file must match</option><option value="mame">As MAME: PLD files may be missing</option></select> },
        ]} />
        <Fieldset legend="Move settings">
            <FieldLine><input data-setting="include-saved-play" type="checkbox" checked={includeSavedPlay} onChange={(event) => setIncludeSavedPlay(event.currentTarget.checked)} /> Include saved play</FieldLine>
            <div className="settings-transfer">
                <Button label="Export settings…" data-settings-export onClick={() => { void props.preferences.exportPreferences({ includeSavedPlay }).then(download).catch((error) => setMessage(error instanceof Error ? error.message : "Settings could not be exported.")); }} />
                <Button label="Import settings…" data-settings-import onClick={() => picker.current?.click()} />
                <input ref={picker} className="visually-hidden" data-settings-import-picker type="file" accept="application/json,.json" onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file !== undefined) void file.text().then((json) => importJson(json, false));
                }} />
            </div>
        </Fieldset>
        <p className="note">Exports contain settings and optional saved play. ROM archives are never exported.</p>
        {message === null ? null : <p className="note" data-settings-message>{message}</p>}
    </div>;

    return <div data-modal="settings"><Modal title="Settings" onClose={close} foot={<>
        <Button label="Restore defaults" data-settings-restore onClick={() => setConfirmRestore(true)} />
        <Button label="OK" primary data-settings-ok onClick={apply} />
        <Button label="Cancel" data-settings-cancel onClick={close} />
    </>}>
        <Tabs id="settings-tabs" active={tab} onChange={(id) => setTab(id as SettingsTab)} tabs={[
            { id: "general", label: "General" }, { id: "video", label: "Video" },
            { id: "audio", label: "Audio" }, { id: "storage", label: "Storage" },
        ]} />
        {tab === "general" ? general : tab === "video" ? video : tab === "audio" ? audio : storage}
    </Modal>
    {confirmRestore ? <div data-modal="restore-settings"><Confirm veil question="Restore all settings to defaults?" consequence="Saved play and stored files are kept." confirmLabel="Restore defaults" onCancel={() => setConfirmRestore(false)} onConfirm={() => {
        setConfirmRestore(false);
        preview(DEFAULT_GLOBAL_PREFERENCES);
    }} /></div> : null}
    {importText !== null && importReport !== null ? <div data-modal="import-settings"><Confirm veil question="Import settings and replace existing values?" consequence={`The following keys will be overwritten: ${importReport.overwrites.join(", ")}. Stored game files are untouched.`} confirmLabel="Import settings" onCancel={() => { setImportText(null); setImportReport(null); }} onConfirm={() => { void importJson(importText, true); }} /></div> : null}
    </div>;
}
