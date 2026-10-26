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
}

export function Confirm({ question, consequence, confirmLabel, onConfirm, onCancel, veil = false }: ConfirmProps) {
    return <div data-component="confirmation"><Modal title="Confirm" veil={veil} onClose={onCancel} foot={<>
        <Button label={confirmLabel} data-confirm onClick={onConfirm} />
        <Button label="Cancel" data-cancel primary onClick={onCancel} />
    </>}>
        <p className="confirm-question">{question}</p>
        <p className="confirm-consequence">{consequence}</p>
    </Modal></div>;
}
