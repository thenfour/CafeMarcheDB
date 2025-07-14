import React from "react";
import * as palette from "./palette";
import { ColorSwatch } from "./ColorSwatch";
//import { ReactiveInputDialog } from "./ReactiveInputDialog";


export interface ColorPaletteGridProps {
    palette: palette.ColorPalette;
    showNull: boolean;
    onClick: (value: palette.ColorPaletteEntry | null) => void;
    variation: palette.ColorVariationSpec;
    hoverVariation: palette.ColorVariationSpec;
    onDrop?: (droppedEntry: palette.ColorPaletteEntry, targetEntry: palette.ColorPaletteEntry) => void;
    showHiddenSwatches?: boolean;
    selectedColor?: palette.ColorPaletteEntry | string | null;
};

export const ColorPaletteGrid = (props: ColorPaletteGridProps) => {
    const hiddenIds = Object.keys(palette.gHiddenColorIds);
    const selectedColorId = (typeof props.selectedColor === 'string') ? props.selectedColor : (props.selectedColor ? props.selectedColor.id : null);
    return <div className="colorPaletteGridRoot">
        {
            props.palette.getAllRowsAndEntries().map((row, rowIndex) => {
                return <div className="row" key={rowIndex}>
                    {
                        // spacers
                        props.showNull && (
                            (rowIndex === 0) ? (<ColorSwatch
                                color={null}
                                isSpacer={false}
                                variation={props.variation}
                                hoverVariation={props.hoverVariation}
                                onClick={() => { props.onClick(null) }}
                                className={!props.selectedColor ? "selectedOutline" : ""}
                            />
                            )
                                : (<ColorSwatch color={null} isSpacer={true} variation={props.variation} hoverVariation={props.hoverVariation} />)
                        )
                    }
                    {row.map((e, i) => {
                        return <ColorSwatch
                            key={i}
                            color={e}
                            variation={props.variation}
                            hoverVariation={props.hoverVariation}
                            isSpacer={!props.showHiddenSwatches && hiddenIds.some(k => k === e.id)}
                            onDrop={props.onDrop && ((dropped) => props.onDrop!(dropped, e))}
                            onClick={() => { props.onClick(e) }}
                            className={props.selectedColor && selectedColorId === e.id ? "selectedOutline" : ""}
                        />;

                    })}
                </div>;
            })
        }
    </div>;
};
