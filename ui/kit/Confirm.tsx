// realizes: docs/ui-design-language.md > §3.3 Confirmation

import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

export interface ConfirmProps {
    readonly question: string;
    readonly consequence: string;
    readonly confirmLabel: string;
    readonly onConfirm?: () => void;
    readonly onCancel?: () => void;
    readonly veil?: boolean;
    readonly tone?: "warning" | "question";                        // The icon beside the text; warning is the default for anything destructive
}

export function Confirm({ question, consequence, confirmLabel, onConfirm, onCancel, veil = false, tone = "warning" }: ConfirmProps) {
    return <div data-component="confirmation" data-tone={tone}><Modal title="Confirm" veil={veil} onClose={onCancel} foot={<>
        <Button label={confirmLabel} data-confirm onClick={onConfirm} />
        <Button label="Cancel" data-cancel primary onClick={onCancel} />
    </>}>
        <div className="confirm-body">
            <span className="confirm-icon" aria-hidden="true">{tone === "warning" ? "⚠" : "?"}</span>
            <div><p className="confirm-question">{question}</p><p className="confirm-consequence">{consequence}</p></div>
        </div>
    </Modal></div>;
}
