
import React from "react";
import { z } from "zod";

// was ParsedPaletteEntry, but trying to decouple...
// todo: adapt to be more generic.
const ZBaseColor = z.object({
    cssColor: z.string(),
    r: z.object({
        cssContrastColor: z.string().nullable(),
    }),
});
type BaseColor = z.infer<typeof ZBaseColor>;

export interface SwatchProps<T extends BaseColor> {
    color: T;

    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onClick?: (e: T) => void;
    onDroppedColor?: (c: T) => void;
    text?: string;
    className?: string;
    selected?: boolean;
    //bundle?: ColorBlenderParamsBundle; // when copying/dragging the color, this will be attached to it.
}

// the square raw color swatch used in the color editor.
export const Swatch = <T extends BaseColor,>(props: SwatchProps<T>) => {
    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData('application/json', JSON.stringify(props.color));
        event.dataTransfer.setData('text/plain', props.color.cssColor);
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
            const droppedEntry = JSON.parse(droppedData) as T;
            ZBaseColor.parse(droppedEntry); // validate the dropped data against the schema
            // sanity check.
            //if (!droppedEntry.r) throw new Error(`appears to be incorrect format; r missing`);
            //if (!droppedEntry.r.cmykValues) throw new Error(`appears to be incorrect format; r.cmykValues missing`);
            props.onDroppedColor!(droppedEntry);
        } catch (e) {
            console.error(e);
            alert(`failed to drop; see console`);
        }
    };

    return <div
        draggable
        onDragStart={onDragStart}
        onDragOver={props.onDroppedColor && onDragOver}
        onDrop={props.onDroppedColor && onDrop}
        className={`paletteSwatch ${props.onClick && "interactable"} ${props.className || ""} ${props.selected && "selected"}`}
        style={{
            "--swatch-color": props.color.cssColor,
            "--selected-border-color": props.color.r.cssContrastColor || "black",
        } as any}
        onClick={() => { props.onClick && props.onClick(props.color) }}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
    >
        {props.text || props.color.cssColor}
    </div>;
};
