// realizes: docs/ui-design-language.md > §4 Focus and input model

import {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
    type ButtonHTMLAttributes, type ReactNode,
} from "react";

export type FocusAction = "up" | "down" | "left" | "right" | "activate" | "back" | "tab-previous" | "tab-next" | "group-previous" | "group-next";

export interface FocusableOptions {
    readonly disabled?: boolean;
    readonly selector?: boolean;
    readonly onActivate?: () => void;
    readonly onBack?: () => void;
    readonly onLeft?: () => void;
    readonly onRight?: () => void;
}

interface FocusTarget extends FocusableOptions {
    readonly id: string;
    readonly group: string;
    readonly element: HTMLElement;
}

interface FocusContextValue {
    readonly focusedId: string | null;
    readonly register: (target: FocusTarget) => () => void;
    readonly focus: (id: string) => void;
}

export interface FocusProviderProps {
    readonly children: ReactNode;
    readonly initialId?: string;
    readonly onBack?: () => void;
    readonly onTabPrevious?: () => void;
    readonly onTabNext?: () => void;
    readonly gamepadEnabled?: boolean;
}

export interface FocusableProps {
    readonly ref: (element: HTMLElement | null) => void;
    readonly tabIndex: number;
    readonly "data-focus": boolean;
    readonly onFocus: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

const buttonAction = (button: number): FocusAction | null => {
    if (button === 0) return "activate";
    if (button === 1) return "back";
    if (button === 4) return "tab-previous";
    if (button === 5) return "tab-next";
    if (button === 12) return "up";
    if (button === 13) return "down";
    if (button === 14) return "left";
    if (button === 15) return "right";
    return null;
};

export function FocusProvider({ children, initialId, onBack, onTabPrevious, onTabNext, gamepadEnabled = true }: FocusProviderProps): ReactNode {
    const targets = useRef(new Map<string, FocusTarget>());
    const [focusedId, setFocusedId] = useState<string | null>(initialId ?? null);
    const focusedIdRef = useRef<string | null>(initialId ?? null);

    useEffect(() => { document.documentElement.dataset.input ??= "touch"; }, []);

    const focus = useCallback((id: string): void => {
        const target = targets.current.get(id);
        if (target === undefined || target.disabled) return;
        focusedIdRef.current = id;
        setFocusedId(id);
        target.element.focus();
    }, []);

    const register = useCallback((target: FocusTarget): (() => void) => {
        targets.current.set(target.id, target);
        if (focusedIdRef.current === null || focusedIdRef.current === target.id) focus(target.id);
        return () => { targets.current.delete(target.id); };
    }, [focus]);

    const dispatch = useCallback((action: FocusAction): void => {
        const available = [...targets.current.values()].filter((target) => !target.disabled);
        if (available.length === 0) return;
        const current = targets.current.get(focusedIdRef.current ?? "") ?? available[0]!;
        if (action === "activate") {
            if (current.onActivate === undefined) current.element.click();
            else current.onActivate();
            return;
        }
        if (action === "back") { (current.onBack ?? onBack)?.(); return; }
        if (action === "tab-previous") { onTabPrevious?.(); return; }
        if (action === "tab-next") { onTabNext?.(); return; }
        if (current.selector && action === "left") { current.onLeft?.(); return; }
        if (current.selector && action === "right") { current.onRight?.(); return; }

        const groups = [...new Set(available.map((target) => target.group))];
        if (action === "group-previous" || action === "group-next") {
            const groupIndex = Math.max(0, groups.indexOf(current.group));
            const step = action === "group-previous" ? -1 : 1;
            const nextGroup = groups[(groupIndex + step + groups.length) % groups.length];
            const next = available.find((target) => target.group === nextGroup);
            if (next !== undefined) focus(next.id);
            return;
        }

        const group = available.filter((target) => target.group === current.group);
        const currentIndex = Math.max(0, group.findIndex((target) => target.id === current.id));
        const step = action === "up" || action === "left" ? -1 : 1;
        const sameGroupNext = group[currentIndex + step];
        const groupIndex = Math.max(0, groups.indexOf(current.group));
        const adjacentGroup = groups[(groupIndex + step + groups.length) % groups.length];
        const adjacentTargets = available.filter((target) => target.group === adjacentGroup);
        const next = sameGroupNext ?? (step < 0 ? adjacentTargets.at(-1) : adjacentTargets[0]);
        if (next !== undefined) focus(next.id);
    }, [focus, onBack, onTabNext, onTabPrevious]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent): void => {
            document.documentElement.dataset.input = "keyboard";
            const action: FocusAction | null = event.key === "ArrowUp" ? "up"
                : event.key === "ArrowDown" ? "down"
                    : event.key === "ArrowLeft" ? "left"
                        : event.key === "ArrowRight" ? "right"
                            : event.key === "Enter" || event.key === " " ? "activate"
                                : event.key === "Escape" ? "back"
                                    : event.key === "PageUp" ? "tab-previous"
                                        : event.key === "PageDown" ? "tab-next"
                                            : event.key === "Tab" && document.documentElement.dataset.density === "desktop"
                                                ? event.shiftKey ? "group-previous" : "group-next"
                                                : null;
            if (action === null) return;
            event.preventDefault();
            dispatch(action);
        };
        const handlePointer = (): void => { document.documentElement.dataset.input = "touch"; };
        window.addEventListener("keydown", handleKey);
        window.addEventListener("pointerdown", handlePointer);
        return () => {
            window.removeEventListener("keydown", handleKey);
            window.removeEventListener("pointerdown", handlePointer);
        };
    }, [dispatch]);

    useEffect(() => {
        if (!gamepadEnabled) return;
        let frame = 0;
        let previous = new Set<string>();
        const poll = (): void => {
            const active = new Set<string>();
            for (const pad of navigator.getGamepads?.() ?? []) {
                if (pad === null || pad.mapping !== "standard") continue;
                pad.buttons.forEach((button, index) => {
                    const action = button.pressed ? buttonAction(index) : null;
                    if (action !== null) active.add(action);
                });
                const horizontal = pad.axes[0] ?? 0;
                const vertical = pad.axes[1] ?? 0;
                if (horizontal < -.55) active.add("left");
                if (horizontal > .55) active.add("right");
                if (vertical < -.55) active.add("up");
                if (vertical > .55) active.add("down");
            }
            for (const action of active) if (!previous.has(action)) {
                document.documentElement.dataset.input = "gamepad";
                dispatch(action as FocusAction);
            }
            previous = active;
            frame = requestAnimationFrame(poll);
        };
        frame = requestAnimationFrame(poll);
        return () => { cancelAnimationFrame(frame); };
    }, [dispatch, gamepadEnabled]);

    const value = useMemo<FocusContextValue>(() => ({ focusedId, register, focus }), [focus, focusedId, register]);
    return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocusable(id: string, group: string, options: FocusableOptions = {}): FocusableProps {
    const context = useContext(FocusContext);
    const element = useRef<HTMLElement | null>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        if (context === null || element.current === null) return;
        return context.register({
            id,
            group,
            element: element.current,
            disabled: optionsRef.current.disabled,
            selector: optionsRef.current.selector,
            onActivate: () => optionsRef.current.onActivate?.(),
            onBack: optionsRef.current.onBack === undefined ? undefined : () => optionsRef.current.onBack?.(),
            onLeft: optionsRef.current.onLeft === undefined ? undefined : () => optionsRef.current.onLeft?.(),
            onRight: optionsRef.current.onRight === undefined ? undefined : () => optionsRef.current.onRight?.(),
        });
    }, [context, group, id, options.disabled]);

    return {
        ref: (next) => { element.current = next; },
        tabIndex: options.disabled ? -1 : 0,
        "data-focus": context?.focusedId === id,
        onFocus: () => { context?.focus(id); },
    };
}

export const focusableButtonProps = (props: FocusableProps): Pick<ButtonHTMLAttributes<HTMLButtonElement>, "tabIndex" | "onFocus"> & { readonly "data-focus": boolean } => ({
    tabIndex: props.tabIndex,
    onFocus: props.onFocus,
    "data-focus": props["data-focus"],
});
