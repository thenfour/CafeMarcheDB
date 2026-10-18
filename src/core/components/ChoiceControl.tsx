// Wraps item content, such as CMChip, in native selection or action controls.
// Selection inputs stay invisible while preserving browser keyboard navigation.

import React from "react";

export type ChoiceInteraction = {
    kind: "selection";
    selectionMode: "single" | "multiple";
    name: string;
    value: string;
    onActivate: () => void;
} | {
    kind: "action";
    onActivate: () => void;
    hasPopup?: React.AriaAttributes["aria-haspopup"];
    expanded?: boolean;
};

export interface ChoiceControlProps extends React.HTMLAttributes<HTMLElement> {
    selected: boolean;
    disabled: boolean;
    label: string;
    // Null explicitly requests a display without an interactive control.
    interaction: ChoiceInteraction | null;
}

// Native controls keep selection navigation and action activation inside the item.
export const ChoiceControl = React.forwardRef<HTMLElement, React.PropsWithChildren<ChoiceControlProps>>(function ChoiceControl(
    { selected, disabled, label, interaction, className, style, children, ...elementProps }, ref,
) {
    const inputId = React.useId();
    const classes = ["CMChoice", selected ? "selected" : "notselected", disabled ? "disabled" : "enabled", className].filter(Boolean).join(" ");
    // Every root forwards tooltip refs and event handlers to its actual DOM element.
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
    if (interaction.kind === "action") {
        return <button
            {...elementProps}
            ref={setElement}
            type="button"
            className={`${classes} CMChoiceAction`}
            style={style}
            disabled={disabled}
            aria-label={label}
            aria-haspopup={interaction.hasPopup}
            aria-expanded={interaction.expanded}
            onClick={() => {
                if (!disabled) {
                    interaction.onActivate();
                }
            }}
        >{children}</button>;
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
