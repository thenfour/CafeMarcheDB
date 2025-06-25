////////////////////////////////////////////////////////////////
// rethinking "variant"... for component coloring variations, there are
// strong / weak
// selected / notselected
// disabled / enabled
// (hover)
// (focus)

import { Tooltip } from "@mui/material";
import React from "react";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec } from "shared/color";
import { IsNullOrWhitespace } from "shared/utils";
import { gIconMap, RenderMuiIcon } from "../db3/components/IconMap";
import { GetStyleVariablesForColor } from "./Color";
import { CMLink } from "./CMLink";

// but it means having a lot of color variations:
// - main / contrast
// - faded main / contrast, for disabled/enabled
// - for selected, something else? maybe we're OK as is

export type CMChipShapeOptions = "rounded" | "rectangle";

export type CMChipSizeOptions = "small" | "big";

export type CMChipBorderOption = "default" | "border" | "noBorder";

export interface CMChipProps {
    color?: ColorPaletteEntry | string | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    className?: string;
    tooltip?: React.ReactNode;
    style?: React.CSSProperties | undefined;

    href?: string; // if provided, the chip will be a link

    onDelete?: () => void;
    onClick?: () => void;
};


export const CMChip = (props: React.PropsWithChildren<CMChipProps>) => {
    const variant = props.variation || StandardVariationSpec.Strong;
    const shape: CMChipShapeOptions = props.shape || "rounded";
    const style = GetStyleVariablesForColor({ color: props.color, ...variant });
    const size = props.size || "big";

    const wrapperClasses: string[] = [
        "CMChip",
        size,
        shape,
        variant.enabled ? "enabled" : "disabled",
        variant.selected ? "selected" : "notselected",
        ((props.onClick) && variant.enabled) ? "interactable" : "noninteractable",
    ];
    if (props.className) {
        wrapperClasses.push(props.className);
    }

    const chipClasses: string[] = [
        "chipMain applyColor",
        props.border === "border" ? "colorForceBorder" : (props.border === "noBorder" ? "colorForceNoBorder" : "colorForceDefaultBorder"),
        style.cssClass,
        size,
        variant.enabled ? "enabled" : "disabled",
        variant.selected ? "selected" : "notselected",
    ];

    const computedStyle: React.CSSProperties = { ...style.style, ...props.style };

    let chipNode = <div className={wrapperClasses.join(" ")} style={computedStyle} onClick={props.onClick}>
        <div className={chipClasses.join(" ")}>
            <div className='content'>
                {props.onDelete && <span className="CMChipDeleteButton interactable" onClick={props.onDelete}>{gIconMap.Cancel()}</span>}
                {props.children}
            </div>
        </div>
    </div >;

    if (!IsNullOrWhitespace(props.href)) {
        chipNode = <CMLink href={props.href || ""}>{chipNode}</CMLink>
    }

    if (IsNullOrWhitespace(props.tooltip)) return chipNode;

    return <Tooltip title={props.tooltip} disableInteractive>{chipNode}</Tooltip>;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CMChipContainerProps {
    className?: string,
    orientation?: "vertical" | "horizontal",
    margins?: "tightMargins" | "defaultMargins",
    style?: React.CSSProperties | undefined,
};
export const CMChipContainer = (props: React.PropsWithChildren<CMChipContainerProps>) => {
    return <div className={`CMChipContainer ${props.className || ""} ${props.orientation} ${props.margins}`} style={props.style}>
        {props.children}
    </div>
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMStandardDBChipModel {
    color?: null | string | ColorPaletteEntry;
    iconName?: string | null;

    text?: string | null;
    label?: string | null;
    name?: string | null;

    description?: string | null;
}

export interface CMStandardDBChipProps<T> {
    model: T | null;
    getText?: (value: T | null, coalescedValue: string | null) => string; // override the text getter
    getTooltip?: (value: T | null, coalescedValue: string | null) => string | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    onClick?: () => void;
    className?: string;
    iconOnly?: boolean; // if true, only the icon will be rendered, no text
};

export const CMStandardDBChip = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    const dbText = props.model?.label || props.model?.text || props.model?.name || null;
    const tooltip: string | null | undefined = props.getTooltip ? props.getTooltip(props.model, dbText) : (props.model?.description);
    const text = props.getText ? props.getText(props.model, dbText) : dbText || "--";
    return <CMChip
        color={props.model?.color}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        tooltip={tooltip}
        shape={props.shape}
        border={props.border}
    >
        {RenderMuiIcon(props.model?.iconName)}{props.iconOnly ? null : <span className="text">{text}</span>}
    </CMChip>;
};

