import React from "react";
import { type ColorPaletteEntry, type ColorVariationSpec, CreateNullPaletteEntry, gGeneralPaletteList, StandardVariationSpec } from "./palette";
import { GetStyleVariablesForColor } from "./ColorClientUtils";

export interface ColorSwatchProps {
    color: ColorPaletteEntry | null | string;
    isSpacer?: boolean;
    variation?: ColorVariationSpec;
    hoverVariation?: ColorVariationSpec;
    onDrop?: (e: ColorPaletteEntry) => void;
    size?: "normal" | "small";
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    className?: string;
};

// this is the cmdb color swatch, rounded corners using internal palette.
export const ColorSwatch = ({ size = "normal", className, ...props }: ColorSwatchProps) => {
    const [hovering, setHovering] = React.useState<boolean>(false);

    if (typeof props.color === 'string') {
        props.color = gGeneralPaletteList.findEntry(props.color);
    }
    if (!props.variation) {
        props.variation = StandardVariationSpec.Strong;
    }

    const entry = !!props.color ? props.color : CreateNullPaletteEntry();
    const style = GetStyleVariablesForColor({
        color: props.color,
        ...(hovering ? (props.hoverVariation || props.variation) : props.variation),
    });

    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData('application/json', JSON.stringify(entry));
        //event.dataTransfer.setData('text/plain', props.color.cssColor);
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        // Allow dropping by preventing the default behavior
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        // Prevent default behavior to avoid unwanted actions
        event.preventDefault();
        // Get the data that was set during the drag
        const droppedData = event.dataTransfer.getData('application/json');
        try {
            const droppedEntry = JSON.parse(droppedData) as ColorPaletteEntry;
            // sanity check.
            if (!droppedEntry.strong) throw new Error(`appears to be incorrect format; strong missing`);
            if (!droppedEntry.strongDisabledSelected) throw new Error(`appears to be incorrect format; strongDisabledSelected missing`);
            if (!droppedEntry.weak) throw new Error(`appears to be incorrect format; weak missing`);
            if (!droppedEntry.weakDisabledSelected) throw new Error(`appears to be incorrect format; weakDisabledSelected missing`);
            if (!droppedEntry.id) throw new Error(`appears to be incorrect format; id missing`);
            // ok that should be enough.
            props.onDrop!(droppedEntry);
        } catch (e) {
            console.error(e);
            alert(`failed to drop; see console`);
        }
    };

    return <div
        draggable
        onDragStart={onDragStart} // Event when drag starts
        onDragOver={props.onDrop && onDragOver} // Event when something is dragged over
        onDrop={props.onDrop && onDrop} // Event when something is dropped
        className={`${props.variation.selected ? "selected" : ""} ${className} colorSwatchRoot ${props.onClick ? "interactable" : ""} applyColor ${style.cssClass} ${props.isSpacer ? "spacer" : ""} size_${size}`}
        style={style.style}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={props.onClick}
    >
        {size === "normal" && entry.label}
    </div>;
};