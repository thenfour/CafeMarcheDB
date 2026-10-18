// this is used to wrap a component -- specifically CMChip -- in an interaction-friendly input container.
// the <input> is invisible and but allows browser-provided keyboard nav / focus / interaction.
// it could be done directly on the CMChip component but this simplifies

import React from "react";

export interface ChoiceInteraction {
    selectionMode: "single" | "multiple";
    name: string;
    value: string;
    onActivate: () => void;
}

export interface ChoiceControlProps extends React.HTMLAttributes<HTMLElement> {
    selected: boolean;
    disabled: boolean;
    label: string;
    // Null explicitly requests a display without an interactive control.
    interaction: ChoiceInteraction | null;
}

// The native input keeps radio navigation and keyboard activation inside the item.
export const ChoiceControl = React.forwardRef<HTMLElement, React.PropsWithChildren<ChoiceControlProps>>(function ChoiceControl(
    { selected, disabled, label, interaction, className, style, children, ...elementProps }, ref,
) {
    const inputId = React.useId();
    const classes = ["CMChoice", selected ? "selected" : "notselected", disabled ? "disabled" : "enabled", className].filter(Boolean).join(" ");
    // Both roots forward tooltip refs and event handlers to their actual DOM element.
    const setElement = React.useCallback((element: HTMLElement | null) => {
        if (typeof ref === "function") {
            ref(element);
        } else if (ref) {
            ref.current = element;
        }
    }, [ref]);
    if (!interaction) {
        return <div {...elementProps} ref={setElement} className={classes} style={style}>{children}</div>;
    }
    return <label {...elementProps} ref={setElement} htmlFor={inputId} className={classes} style={style}>
        <input
            id={inputId}
            className="CMChoiceInput"
            type={interaction.selectionMode === "single" ? "radio" : "checkbox"}
            name={interaction.name}
            value={interaction.value}
            checked={selected}
            disabled={disabled}
            aria-label={label}
            onChange={() => {
                if (!disabled) {
                    interaction.onActivate();
                }
            }}
        />
        {children}
    </label>;
});
