
import React from "react";
import { CoalesceBool, generateFibonacci } from "shared/utils";

const FIBONACCI_SEQUENCE = [0, ...generateFibonacci(100)];

//////////////////////////////////////////////////////////////////////////////////////////////////
// specific input control which
// - allows null values (appears empty)
// - clicking in the field selects all of its text, for 1-keypress single-digit entry.
// - up/down arrow keys will incrument / decrement the value to the nearest fibonnaci number.

// i'm thinking:
// 1 point = just playing through a song once, probably 8 minutes total
// 2 points = playing through a song twice, or needing some brush up. ~16 minutes
// 3 points = a pretty quick runthrough, 24 minutes
// 5 points = a strong rehearsal, 40 minutes
// 8 points = a long rehearsal, 64 minutes
// 13 = effectively an entire rehearsal, 104 minutes. (1 hour 44 minutes).

// a 2-hour rehearsal supports about 15 points

type NumberFieldProps = {
    value?: number | null;
    initialValue?: number | null;
    onChange?: (e: React.ChangeEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, newValue: number | null) => void;
    className?: string;
    readonly?: boolean;
    inert?: boolean;
    style?: React.CSSProperties;
    showPositiveSign?: boolean;
};

export const NumberField = ({ inert = false, ...props }: NumberFieldProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [controlledValue, setControlledValue] = React.useState<number | null>(props.initialValue || null);

    // if you specify initial value, then we keep the live value internally.
    const weControlValue = props.initialValue !== undefined;

    const useValue = weControlValue ? controlledValue : props.value;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // If there's no numeric value, treat it like 0 for arrow handling
        const currentValue = useValue ?? 0;

        if (e.key === "ArrowUp") {
            e.preventDefault();
            // Find first Fibonacci number that is strictly greater than currentValue
            const nextFib = FIBONACCI_SEQUENCE.find((fib) => fib > currentValue);
            if (nextFib != null && props.onChange) {
                if (weControlValue) {
                    setControlledValue(nextFib);
                }
                props.onChange(e, nextFib);
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            // Find the largest Fibonacci <= currentValue (previous Fib)
            const idx = FIBONACCI_SEQUENCE.findIndex((fib) => fib >= currentValue);
            if (idx > 0 && props.onChange) {
                const prevFib = FIBONACCI_SEQUENCE[idx - 1]!;
                if (weControlValue) {
                    setControlledValue(prevFib);
                }
                props.onChange(e, prevFib);
            }
        }
    };

    // Standard onChange text -> number (or null) logic
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value ? parseInt(e.target.value) : null;
        const finalValue = isNaN(newValue as number) ? null : newValue;

        if (weControlValue) {
            setControlledValue(finalValue);
        }

        props.onChange && props.onChange(e, finalValue);
    };

    const valueAsText = useValue == null ? "" : (props.showPositiveSign && useValue > 0 ? `+${useValue}` : useValue.toString());

    return (
        <input
            type="text"
            ref={inputRef}
            value={valueAsText}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={`NumberField ${props.readonly ? "readonly" : "editable"} ${inert ? "inert" : "notinert"} ${props.className}`}
            //inert={(!!props.inert).toString() as any} // weird error about non-boolean attribute `inert`.
            readOnly={props.readonly}
            disabled={inert}

            // Warning: Received `true` for a non-boolean attribute `inert`.
            // If you want to write it to the DOM, pass a string instead: inert="true" or inert={value.toString()}. Error Component Stack
            //inert={inert}
            style={props.style}
        />
    );
};



//////////////////////////////////////////////////////////////////////////////////////////////////
type AutoSelectingNumberFieldProps = {
    value: number | null;
    onChange?: (e: React.ChangeEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, newValue: number | null) => void;
    className?: string;
    readonly?: boolean;
    inert?: boolean;
    style?: React.CSSProperties;
};

export const AutoSelectingNumberField = (props: AutoSelectingNumberFieldProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [internalValue, setInternalValue] = React.useState<string>(props.value == null ? "" : props.value.toString());

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
        const newValue = e.target.value ? parseFloat(e.target.value) : null;
        props.onChange && props.onChange(e, isNaN(newValue as number) ? null : newValue);
    };

    return <div className="AutoSelectingNumberField">
        <input
            type="text"
            ref={inputRef}
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            className={`NumberField ${props.readonly ? "readonly" : "editable"} ${props.inert ? "inert" : "notinert"} ${props.className}`}
            inert={props.inert}
            readOnly={props.readonly}
            disabled={props.inert}
            style={props.style}
        />
        <span>{props.value}</span>
    </div>;
};


