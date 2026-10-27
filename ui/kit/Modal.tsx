// realizes: docs/ui-design-language.md > §3.3 Modal

import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar.js";
import { usePhoneLayout } from "./LayoutContext.js";

export interface ModalProps {
    readonly title: string;
    readonly children: ReactNode;
    readonly foot?: ReactNode;
    readonly onClose?: () => void;
    readonly veil?: boolean;
}

export function Modal({ title, children, foot, onClose, veil = true }: ModalProps) {
    const phone = usePhoneLayout();
    const modal = <section className="window modal" role="dialog" aria-label={title} data-component="modal" data-state="default">
        <TitleBar title={title} onClose={onClose} />
        <div className="modal-body">{children}</div>
        {foot === undefined ? null : <footer className="modal-foot">{foot}</footer>}
    </section>;
    return veil ? <div className="veil" data-component="veil" onClick={phone ? (event) => { if (event.target === event.currentTarget) onClose?.(); } : undefined}>{modal}</div> : modal;
}
