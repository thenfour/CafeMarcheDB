////////////////////////////////////////////////////////////////
// rethinking "variant"... for component coloring variations, there are
// strong / weak
// selected / notselected
// disabled / enabled
// (hover)
// (focus)

import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec } from "shared/color";
import { GetStyleVariablesForColor } from "./Color";
import { IsNullOrWhitespace } from "shared/utils";
import { Tooltip } from "@mui/material";
import { gIconMap, RenderMuiIcon } from "../db3/components/IconMap";
import { TAnyModel } from "../db3/shared/apiTypes";

// but it means having a lot of color variations:
// - main / contrast
// - faded main / contrast, for disabled/enabled
// - for selected, something else? maybe we're OK as is

export type CMChipShapeOptions = "rounded" | "rectangle";

export type CMChipSizeOptions = "small" | "big";

export type CMChipBorderOption = "default" | "border" | "noBorder";

export interface CMChipProps {
    chipRef?: React.Ref<HTMLDivElement>;
    color?: ColorPaletteEntry | string | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    className?: string;
    tooltip?: string | null;

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

    const chipNode = <div className={wrapperClasses.join(" ")} style={style.style} onClick={props.onClick} ref={props.chipRef}>
        <div className={chipClasses.join(" ")}>
            <div className='content'>
                {props.onDelete && <span className="CMChipDeleteButton interactable" onClick={props.onDelete}>{gIconMap.Cancel()}</span>}
                {props.children}
            </div>
        </div>
    </div>;

    if (IsNullOrWhitespace(props.tooltip)) return chipNode;

    return <Tooltip title={props.tooltip} disableInteractive>{chipNode}</Tooltip>;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CMChipContainer = (props: React.PropsWithChildren<{ className?: string, orientation?: "vertical" | "horizontal", margins?: "tightMargins" | "defaultMargins" }>) => {
    return <div className={`CMChipContainer ${props.className || ""} ${props.orientation} ${props.margins}`}>{props.children}</div>
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMStandardDBChipModel {
    color?: null | string | ColorPaletteEntry;
    iconName?: string | null;

    text?: string | null;
    label?: string | null;

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
};

export const CMStandardDBChip = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    const dbText = props.model?.label || props.model?.text || null;
    const tooltip: string | null | undefined = props.getTooltip ? props.getTooltip(props.model, dbText) : (props.model?.description);
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
        {RenderMuiIcon(props.model?.iconName)}{props.getText ? props.getText(props.model, dbText) : dbText || "--"}
    </CMChip>;
};

