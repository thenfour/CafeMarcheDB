
// in total there are the following variations:
// - strong - disabled - not selected
// - strong - disabled - selected
// - strong - enabled - not selected
// - strong - enabled - selected
// - weak - disabled - not selected
// - weak - disabled - selected
// - weak - enabled - not selected
// - weak - enabled - selected

import { ColorPaletteEntry, ColorPaletteEntryVariation, ColorVariationSpec, CreateNullPaletteEntry, GetColorPaletteEntryWithVariation, gGeneralPaletteList } from "./palette";

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
