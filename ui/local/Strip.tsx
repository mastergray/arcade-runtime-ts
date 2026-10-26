// realizes: docs/ui-spec.md > §7.3 Controller view

import { ControllerStrip } from "../kit/index.js";
import type { SessionModel } from "../model/session.js";
import type { SessionSnapshot } from "../model/types.js";
import type { ArcadeButtonIndex, ArcadeDirection, ArcadeKeyName } from "../../src/index.js";

export function Strip({ model, session }: { readonly model: SessionModel; readonly session: SessionSnapshot }) {
    const controls = model.stripControls();
    const running = session.machine !== null;
    const tapSwitch = (id: string): void => {
        if (id === "service" || id === "test") model.tap({ kind: id });
        else if (id === "volume-down" || id === "volume-up") model.tap({ kind: "volume", direction: id.endsWith("down") ? "down" : "up" });
        else if (id.startsWith("key:")) model.tap({ kind: "key", key: id.slice(4) as ArcadeKeyName });
    };
    return <div data-region="controller" data-controller-strip>
        <ControllerStrip
            idle={!running}
            buttons={controls.buttons}
            cabinet={controls.cabinet}
            operator={controls.operator}
            onSwitch={tapSwitch}
            onCoin={() => model.tap({ kind: "coin", player: 1 })}
            onStart={() => model.tap({ kind: "start", player: 1 })}
            onDirectionHold={(direction, pressed) => model.hold({ kind: "direction", direction: direction as ArcadeDirection }, pressed)}
            onButtonHold={(button, pressed) => {
                if (button <= controls.buttons) model.hold({ kind: "button", button: button as ArcadeButtonIndex }, pressed);
            }}
        />
    </div>;
}
