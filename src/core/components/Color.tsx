import React from "react";
import { ColorPalette, ColorPaletteEntry, ColorPaletteEntryVariation, ColorPaletteList, ColorVariationSpec, CreateNullPaletteEntry, GetColorPaletteEntryWithVariation, StandardVariationSpec, gGeneralPaletteList, gHiddenColorIds } from "shared/color";
//import { ReactiveInputDialog } from "./ReactiveInputDialog";

// in total there are the following variations:
// - strong - disabled - not selected
// - strong - disabled - selected
// - strong - enabled - not selected
// - strong - enabled - selected
// - weak - disabled - not selected
// - weak - disabled - selected
// - weak - enabled - not selected
// - weak - enabled - selected

// each has a foreground and background color, and are known in code so all we need to emit is
// foreground / background / border stuff.

// interface ColorPaletteFieldArgs {
//     member: string,
//     label: string,
//     cellWidth: number,
//     allowNull: boolean,
//     palette: ColorPalette,
//     initialNewItemValue: string | null;
// };
interface GetStyleVariablesForColorResult {
    cssClass: string;
    style: React.CSSProperties;
}

export const GetStyleVariablesForColorVariation = (entry: ColorPaletteEntryVariation, variation: ColorVariationSpec, isNull?: boolean): GetStyleVariablesForColorResult => {
    const classes = [
        isNull ? "colorNull" : "colorNonNull",
        entry.showBorder ? "colorShowBorder" : "colorNoBorder",
        variation.enabled ? "colorEnabled" : "colorDisabled",
        variation.selected ? "colorSelected" : "colorNotSelected",
        variation.fillOption,
        variation.variation,
    ];
    return {
        style: {
            "--color-foreground": entry.foregroundColor,
            "--color-background": entry.backgroundColor,
            "--color-border-style": (!!isNull) ? "dotted" : (entry.showBorder ? "solid" : "hidden"),
        } as React.CSSProperties,
        cssClass: classes.join(" "),
    };
}

interface GetStyleVariablesForColorArgs extends ColorVariationSpec {
    color: ColorPaletteEntry | null | string | undefined;
}
// set this in an element to establish hierarchical color point.
// to apply them, components should just use these vars as needed.
// why not just have "color" var instead of "strong color" & "weak color"? so components can
// access both. might as well support both methods tbh.
export const GetStyleVariablesForColor = (args: GetStyleVariablesForColorArgs): GetStyleVariablesForColorResult => {
    let entry: ColorPaletteEntry | null = null;
    if (!args.enabled) {
        // #196: disabled states should be unified.
        entry = CreateNullPaletteEntry();
    } else if (typeof args.color === 'string') {
        entry = gGeneralPaletteList.findEntry(args.color);
    } else if (!!args.color) {
        entry = args.color; // implicitly this is a non-null entry.
    }

    if (!entry) {
        entry = CreateNullPaletteEntry();
    }

    const variation = GetColorPaletteEntryWithVariation({
        ...args,
        color: entry,
    });
    return GetStyleVariablesForColorVariation(variation, args, args.color == null);
}

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

// props.color can never be null.
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

export interface ColorPaletteGridProps {
    palette: ColorPalette;
    showNull: boolean;
    onClick: (value: ColorPaletteEntry | null) => void;
    variation: ColorVariationSpec;
    hoverVariation: ColorVariationSpec;
    onDrop?: (droppedEntry: ColorPaletteEntry, targetEntry: ColorPaletteEntry) => void;
    showHiddenSwatches?: boolean;
    selectedColor?: ColorPaletteEntry | string | null;
};

export const ColorPaletteGrid = (props: ColorPaletteGridProps) => {
    const hiddenIds = Object.keys(gHiddenColorIds);
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

export interface ColorPaletteListComponentProps {
    palettes?: ColorPaletteList;
    onClick: (value: ColorPaletteEntry | null) => void;
    allowNull: boolean;
    onDrop?: (droppedEntry: ColorPaletteEntry, targetEntry: ColorPaletteEntry) => void;
    showHiddenSwatches?: boolean;
    selectedColor?: ColorPaletteEntry | string | null;
};

type TPreviewStyle = [string, string];

export const ColorPaletteListComponent = ({ palettes = gGeneralPaletteList, ...props }: ColorPaletteListComponentProps) => {
    const [previewStyle, setPreviewStyle] = React.useState<TPreviewStyle>(["white", "black"]);
    const [variationSpec, setVariationSpec] = React.useState<ColorVariationSpec>(StandardVariationSpec.Strong);
    const [hoverVariationSpec, setHoverVariationSpec] = React.useState<ColorVariationSpec>(StandardVariationSpec.StrongSelected);
    const [variationSpecName, setVariationSpecName] = React.useState<keyof typeof StandardVariationSpec>("Strong");
    const [hoverVariationSpecName, setHoverVariationSpecName] = React.useState<keyof typeof StandardVariationSpec>("StrongSelected");

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
                setVariationSpec(StandardVariationSpec[e.target.value]);
                setVariationSpecName(e.target.value as any);
            }}>
                {Object.entries(StandardVariationSpec).map(e => {
                    return <option key={e[0]} value={e[0]}>
                        {e[0]}
                    </option>;
                })}
            </select>

            <select value={hoverVariationSpecName} onChange={e => {
                setHoverVariationSpec(StandardVariationSpec[e.target.value]);
                setHoverVariationSpecName(e.target.value as any);
            }}>
                {Object.entries(StandardVariationSpec).map(e => {
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
