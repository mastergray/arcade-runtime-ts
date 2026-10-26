// realizes: docs/ui-spec.md > §7.4 Technical log

import { Button, Modal, Terminal } from "../kit/index.js";

export function LogModal({ lines, onCopy, onClose }: { readonly lines: ReadonlyArray<string>; readonly onCopy: () => void; readonly onClose: () => void }) {
    return <div data-modal="technical-log"><Modal title="Technical log" onClose={onClose} foot={<>
        <Button label="Copy log" data-copy-log onClick={onCopy} />
    </>}><Terminal lines={lines.length === 0 ? ["No technical messages yet."] : lines} /></Modal></div>;
}

