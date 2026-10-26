// realizes: docs/ui-design-language.md > §3.2 Button and action button

import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFocusable } from "../focus/FocusController.js";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    readonly label: ReactNode;
    readonly glyph?: ReactNode;
    readonly size?: "body" | "sm";
    readonly play?: boolean;
    readonly primary?: boolean;
    readonly focusId?: string;
    readonly focusGroup?: string;
}

export function Button({ label, glyph, size = "body", play = false, primary = false, disabled = false, focusId, focusGroup = "buttons", className = "", onClick, ...props }: ButtonProps) {
    const generatedId = useId();
    const focusable = useFocusable(focusId ?? `button-${generatedId}`, focusGroup, { disabled });
    return <button
        {...props}
        ref={focusable.ref as never}
        type={props.type ?? "button"}
        className={`btn ${className}`.trim()}
        disabled={disabled}
        data-component="button"
        data-size={size}
        data-play={play}
        data-primary={primary}
        data-disabled={disabled}
        data-focus={focusable["data-focus"]}
        data-state={disabled ? "disabled" : focusable["data-focus"] ? "focus" : primary ? "primary" : play ? "play" : "default"}
        tabIndex={focusable.tabIndex}
        onFocus={focusable.onFocus}
        onClick={onClick}
    >{glyph === undefined ? null : <span className="button-glyph">{glyph}</span>}{label}</button>;
}

export interface ActionButtonProps extends ButtonProps {
    readonly trailing?: ReactNode;
}

export function ActionButton({ glyph, label, trailing, ...props }: ActionButtonProps) {
    return <div data-component="action-button" data-state={props.disabled ? "disabled" : "default"}><Button {...props} className={`action-button ${props.className ?? ""}`.trim()} glyph={<span>{glyph}</span>} label={<><span>{label}</span><span className="action-trailing">{trailing}</span></>} /></div>;
}
