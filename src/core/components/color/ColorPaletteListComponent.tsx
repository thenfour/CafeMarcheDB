import React from "react";
import * as palette from "./palette";
import { ColorPaletteGrid } from "./ColorPaletteGrid";


export interface ColorPaletteListComponentProps {
    palettes?: palette.ColorPaletteList;
    onClick: (value: palette.ColorPaletteEntry | null) => void;
    allowNull: boolean;
    onDrop?: (droppedEntry: palette.ColorPaletteEntry, targetEntry: palette.ColorPaletteEntry) => void;
    showHiddenSwatches?: boolean;
    selectedColor?: palette.ColorPaletteEntry | string | null;
};

type TPreviewStyle = [string, string];


export const ColorPaletteListComponent = ({ palettes = palette.gGeneralPaletteList, ...props }: ColorPaletteListComponentProps) => {
    const [previewStyle, setPreviewStyle] = React.useState<TPreviewStyle>(["white", "black"]);
    const [variationSpec, setVariationSpec] = React.useState<palette.ColorVariationSpec>(palette.StandardVariationSpec.Strong);
    const [hoverVariationSpec, setHoverVariationSpec] = React.useState<palette.ColorVariationSpec>(palette.StandardVariationSpec.StrongSelected);
    const [variationSpecName, setVariationSpecName] = React.useState<keyof typeof palette.StandardVariationSpec>("Strong");
    const [hoverVariationSpecName, setHoverVariationSpecName] = React.useState<keyof typeof palette.StandardVariationSpec>("StrongSelected");

    const style = {
        "--preview-bg": previewStyle[0],
        "--preview-fg": previewStyle[1],
    } as React.CSSProperties;

    const previewStyleOptions: TPreviewStyle[] = [
        ["black", "white"],
        ["#444", "white"],
        ["#888", "white"],
        ["#ccc", "black"],
        ["#ddd", "black"],
        ["#eee", "black"],
        ["white", "black"],
    ];

    return <div className="colorPaletteListRoot" style={style}>
        <div className="">
            <select value={previewStyle[0]} onChange={e => setPreviewStyle(previewStyleOptions.find(o => o[0] === e.target.value)!)}>
                {previewStyleOptions.map(e => {
                    const style = {
                        backgroundColor: e[0],
                        color: e[1],
                    } as React.CSSProperties;

                    return <option key={e[0]} value={e[0]} style={style}>
                        {e[0]}
                    </option>;
                })}
            </select>

            <select value={variationSpecName} onChange={e => {
                setVariationSpec(palette.StandardVariationSpec[e.target.value]);
                setVariationSpecName(e.target.value as any);
            }}>
                {Object.entries(palette.StandardVariationSpec).map(e => {
                    return <option key={e[0]} value={e[0]}>
                        {e[0]}
                    </option>;
                })}
            </select>

            <select value={hoverVariationSpecName} onChange={e => {
                setHoverVariationSpec(palette.StandardVariationSpec[e.target.value]);
                setHoverVariationSpecName(e.target.value as any);
            }}>
                {Object.entries(palette.StandardVariationSpec).map(e => {
                    return <option key={e[0]} value={e[0]}>
                        {e[0]}
                    </option>;
                })}
            </select>

        </div>
        {
            palettes.palettes.map((palette, index) => {
                return <ColorPaletteGrid
                    onClick={props.onClick}
                    key={index}
                    palette={palette}
                    showNull={index === 0 && props.allowNull}
                    variation={variationSpec}
                    selectedColor={props.selectedColor}
                    hoverVariation={hoverVariationSpec}
                    onDrop={props.onDrop}
                    showHiddenSwatches={props.showHiddenSwatches}
                />;
            })
        }
    </div>;
};
