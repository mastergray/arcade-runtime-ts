// realizes: docs/ui-spec.md > §1.1, §9.1 Presentation gestures and first-start hint

import { useEffect, useRef, useState, type RefObject } from "react";
import { gamepadChordLabel } from "../../model/bindings.js";
import { MenuGestureDetector } from "../../model/gesture.js";
import type { GlobalPreferences } from "../../model/preferences.js";
import type { SessionModel } from "../../model/session.js";
import type { SessionSnapshot } from "../../model/types.js";

export function usePresentation(session: SessionModel | null, state: SessionSnapshot, preferences: GlobalPreferences, canvas: RefObject<HTMLCanvasElement | null>) {
    const detector = useRef(new MenuGestureDetector(preferences.controls.menuGesture, [10, 11]));
    const [padHint, setPadHint] = useState("L3 + R3");
    const [padStatus, setPadStatus] = useState("0 pads");
    useEffect(() => { detector.current.update(preferences.controls.menuGesture); }, [preferences.controls.menuGesture]);

    useEffect(() => {
        if (session === null || state.mode !== "presentation") return;
        let frame = 0;
        const poll = (): void => {
            const pads = Array.from(navigator.getGamepads?.() ?? []).flatMap((pad) => pad === null ? [] : [{ id: pad.id, buttons: pad.buttons.map((button) => button.pressed) }]);
            const first = pads[0];
            const status = first === undefined ? null : detector.current.status(first);
            setPadStatus(pads.length === 1 && status !== null && "missing" in status ? "No menu gesture — set one in Controllers" : `${pads.length} pads`);
            setPadHint(status === null ? "L3 + R3" : "missing" in status ? "Set a pad gesture in Controllers" : gamepadChordLabel(status.buttons));
            const fired = detector.current.sample(pads);
            // Controls capture owns the same physical presses while recording a new gesture.
            if (fired.length > 0 && document.querySelector('[data-capturing="true"]') === null) session.toggleWindow();
            frame = requestAnimationFrame(poll);
        };
        const key = (event: KeyboardEvent): void => {
            if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;
            event.preventDefault();
            session.toggleWindow();
        };
        const touch = (event: TouchEvent): void => {
            if (event.touches.length !== 2) return;
            event.preventDefault();
            session.toggleWindow();
        };
        const target = canvas.current;
        frame = requestAnimationFrame(poll);
        window.addEventListener("keydown", key);
        target?.addEventListener("touchstart", touch, { passive: false });
        return () => {
            cancelAnimationFrame(frame);
            detector.current.sample([]);
            window.removeEventListener("keydown", key);
            target?.removeEventListener("touchstart", touch);
        };
    }, [session, state.mode, canvas]);

    useEffect(() => {
        if (!state.hintVisible || session === null) return;
        const timer = window.setTimeout(() => session.hidePresentationHint(), 3000);
        return () => window.clearTimeout(timer);
    }, [session, state.hintVisible]);
    return { padHint, padStatus };
}
