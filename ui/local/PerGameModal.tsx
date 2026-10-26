// realizes: docs/ui-spec.md > §3.5 per-game settings list

import { useState } from "react";
import { Button, Confirm, Modal, Table } from "../kit/index.js";
import type { PreferenceStore } from "../model/preferences.js";

export interface PerGameModalProps {
    readonly preferences: PreferenceStore;
    readonly gameName: (key: string) => string;
    readonly onClose: () => void;
    readonly onChanged: () => void;
}

export function PerGameModal({ preferences, gameName, onClose, onChanged }: PerGameModalProps) {
    const [version, setVersion] = useState(0);
    const [reset, setReset] = useState<string | "*" | null>(null);
    const overrides = preferences.listOverrides();
    const changed = (): void => { setVersion((value) => value + 1); onChanged(); };
    void version;
    return <div data-modal="per-game-settings"><Modal title="Per-game settings" onClose={onClose} foot={<>
        <Button label="Reset all…" data-per-game-reset-all disabled={overrides.length === 0} onClick={() => setReset("*")} />
    </>}>
        <Table id="per-game-settings" columns={["Game", "Overrides", "Action"]} rows={overrides.map((entry) => ({
            id: entry.key,
            cells: [
                <span data-per-game-setting={entry.key} key="game">{gameName(entry.key)}</span>,
                entry.descriptions.join(" · "),
                <Button size="sm" label="Reset…" data-per-game-reset={entry.key} onClick={() => setReset(entry.key)} key="reset" />,
            ],
        }))} />
        {overrides.length === 0 ? <p className="note">No games have settings that differ from the defaults.</p> : null}
    </Modal>
    {reset === null ? null : <div data-modal="reset-per-game"><Confirm veil
        question={reset === "*" ? "Reset per-game settings for every game?" : `Reset settings for ${gameName(reset)}?`}
        consequence="Control, analogue and video overrides are cleared. Saved play and stored files are untouched."
        confirmLabel={reset === "*" ? "Reset all" : "Reset"}
        onCancel={() => setReset(null)}
        onConfirm={() => {
            const target = reset;
            setReset(null);
            if (target === "*") preferences.clearAllGameOverrides(); else preferences.clearGameOverrides(target);
            changed();
        }} />
    </div>}
    </div>;
}
