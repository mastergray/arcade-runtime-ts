// realizes: docs/ui-spec.md > §8.1–§8.3 phone chrome around the shared PlaySurface

import { Button, DPad, Pill, RedButton } from "../../kit/index.js";
import { PhoneBar, SidePanel, SwitchesRow } from "../../kit/PhoneChrome.js";
import type { ArcadeButtonIndex, ArcadeKeyName } from "../../../src/index.js";
import type { SessionModel } from "../../model/session.js";
import type { SessionSnapshot } from "../../model/types.js";
import type { LocalMenuActions } from "../menus.js";

export interface PhonePageProps {
    readonly model: SessionModel;
    readonly state: SessionSnapshot;
    readonly landscape: boolean;
    readonly controller: boolean;
    readonly swapSides: boolean;
    readonly actions: LocalMenuActions;
    readonly onGames: () => void;
    readonly onMenu: () => void;
    readonly bar?: boolean;   // false in presentation mode: the window is the menu, nothing else on screen
}

export function PhonePage({ model, state, landscape, controller, swapSides, actions, onGames, onMenu, bar = true }: PhonePageProps) {
    const controls = model.stripControls();
    const running = state.machine !== null;
    const tapSwitch = (id: string): void => {
        if (id === "service" || id === "test") model.tap({ kind: id });
        else if (id === "volume-down" || id === "volume-up") model.tap({ kind: "volume", direction: id.endsWith("down") ? "down" : "up" });
        else if (id.startsWith("key:")) model.tap({ kind: "key", key: id.slice(4) as ArcadeKeyName });
    };
    return <>
        {bar ? <PhoneBar>
            <Button label="Games" data-phone-action="games" onClick={onGames} />
            <Button label={state.status === "paused" ? "Resume" : "Pause"} data-phone-action="pause" disabled={!running} onClick={actions.pauseResume} />
            <Button label="Mute" aria-pressed={state.muted} data-phone-action="mute" disabled={!running} onClick={actions.mute} />
            <Button label="Reset" data-phone-action="reset" disabled={!running} onClick={actions.reset} />
            {landscape ? <><span data-phone-bar-status>{state.status}</span><Button label="⛶" aria-label="Fullscreen" data-phone-action="fullscreen" onClick={() => actions.fullscreen(false)} /></> : null}
            <Button label="☰" aria-label="Menu" data-phone-action="menu" onClick={onMenu} />
        </PhoneBar> : null}
        {/* The switches belong to the controller: off hides them too (2026-10-28). */}
        {!landscape && running && controller ? <SwitchesRow cabinet={controls.cabinet} operator={controls.operator} onSwitch={tapSwitch} /> : null}
        {controller ? <div className="phone-controller" data-phone-controller data-swap-sides={swapSides}>
            <SidePanel side="directions">
                {landscape && running ? <SwitchesRow cabinet={controls.cabinet} onSwitch={tapSwitch} /> : null}
                <DPad touch onHold={(direction, pressed) => model.hold({ kind: "direction", direction }, pressed)} />
                <Pill label="COIN" onPress={() => model.tap({ kind: "coin", player: 1 })} />
            </SidePanel>
            <SidePanel side="buttons">
                {landscape && running ? <SwitchesRow operator={controls.operator} onSwitch={tapSwitch} /> : null}
                <div className="button-bank">{[1, 2, 3, 4, 5, 6].map((number) => <RedButton number={number} off={number > controls.buttons}
                    onHold={(pressed) => model.hold({ kind: "button", button: number as ArcadeButtonIndex }, pressed)} key={number} />)}</div>
                <Pill label="START" onPress={() => model.tap({ kind: "start", player: 1 })} />
            </SidePanel>
        </div> : null}
    </>;
}
