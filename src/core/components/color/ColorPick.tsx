import { DialogContent } from "@mui/material";
import React from "react";
import { ColorPaletteEntry, ColorPaletteList, gGeneralPaletteList, StandardVariationSpec } from "./palette";
import { ColorSwatch } from "./ColorSwatch";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { ColorPaletteListComponent } from "./ColorPaletteListComponent";

export interface ColorPickProps {
    value: ColorPaletteEntry | null | string;
    readonly?: boolean;
    allowNull?: boolean;
    palettes?: ColorPaletteList;
    onChange: (value: ColorPaletteEntry | null) => void;
    size?: "normal" | "small";
    className?: string;
};

// props.color can never be null.
export const ColorPick = ({ allowNull = true, palettes = gGeneralPaletteList, className, ...props }: ColorPickProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const entry = palettes.findEntry(props.value);

    return <>
        <ColorSwatch color={entry} variation={StandardVariationSpec.Strong} size={props.size} className={className} onClick={() => setOpen(true)} />
        {open && (
            <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <ColorPaletteListComponent
                        allowNull={allowNull}
                        selectedColor={entry}
                        palettes={palettes}
                        onClick={(e: ColorPaletteEntry | null) => {
                            if (props.readonly) return;
                            props.onChange(e);
                            setOpen(false)
                        }}
                    />
                </DialogContent>
            </ReactiveInputDialog >
        )}
    </>;
};
