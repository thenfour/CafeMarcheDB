
import { Box, Tooltip } from "@mui/material";
import React from 'react';
import * as db3 from "src/core/db3/db3";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";
import { CMSelectDisplayStyle, SelectionField } from "./select/SelectionField";
import { CMSelectNullBehavior, makeLocalSelectionSource, withNullSelection } from "./select/selectionSource";
import { SettingMarkdown } from "./SettingMarkdown";
import { type ColorPaletteEntry, StandardVariationSpec } from "./color/palette";
import { useDashboardContext } from "./dashboardContext/DashboardContext";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type VisibilityPermission = Omit<db3.PermissionPayloadMinimum, "color"> & {
    color: string | ColorPaletteEntry | null;
};
export type VisibilityControlValue = VisibilityPermission | null;

export interface VisibilityValueProps {
    permission?: VisibilityPermission | null;
    permissionId?: number | null;
    variant: "minimal" | "verbose";
    onClick?: () => void;
};

export const VisibilityValue = ({ variant, onClick, ...props }: VisibilityValueProps) => {
    const dashboardContext = useDashboardContext();

    let permission = props.permission || null;
    if (!permission && props.permissionId) {
        permission = dashboardContext.permission.getById(props.permissionId);
    }

    const visInfo = dashboardContext.getVisibilityInfo({ visiblePermission: permission, visiblePermissionId: permission?.id || null });
    const style = visInfo.getStyleVariablesForColor(StandardVariationSpec.Strong);
    const classes: string[] = [
        "visibilityValue applyColor",
        onClick ? "interactable" : "",
        variant,
        visInfo.className,
        style.cssClass,
    ];

    let tooltipTitle = "?";
    if (!permission) {
        tooltipTitle = "Private visibility: Only you can see this. You'll have to change this in order for others to view.";
    }
    else {
        tooltipTitle = permission!.description || "";
    }

    return <Tooltip title={tooltipTitle} disableInteractive ><div className={classes.join(" ")} style={style.style} onClick={onClick}>
        {variant === "minimal" ? (
            permission === null ? <>{gIconMap.Lock()}</> : RenderMuiIcon(permission?.iconName)
        ) : (
            permission === null ? <>{gIconMap.Lock()} private</> : <>{RenderMuiIcon(permission.iconName)} {permission.name}</>
        )}
        {/*permission === null ? "(private)" : `${permission.name}-nam`*/}
    </div></Tooltip>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface VisibilityControlProps {
    value: VisibilityControlValue | number | null;
    variant?: "minimal" | "verbose";
    readonly?: boolean;
    onChange: (value: VisibilityControlValue) => void;
    selectDialogTitle?: React.ReactNode;
};
export const VisibilityControl = (props: VisibilityControlProps) => {
    const dashboardContext = useDashboardContext();

    const variant = props.variant || "verbose";
    const visibilityChoices: VisibilityPermission[] = dashboardContext.permission.items.filter(p => {
        return p.isVisibility && dashboardContext.isAuthorized(p.name);
    });

    const heavyValue = typeof props.value === "number" ? dashboardContext.permission.getById(props.value) : props.value;

    const source = withNullSelection(makeLocalSelectionSource({
        items: visibilityChoices,
        getKey: permission => permission.id,
        getLabel: permission => permission.name,
        renderValue: permission => <VisibilityValue permission={permission} variant={variant} />,
    }), CMSelectNullBehavior.AllowNull, () => <VisibilityValue permission={null} variant={variant} />, "Private");
    source.renderOption = permission => <Box sx={{ display: "inline-flex", maxWidth: "100%" }}><VisibilityValue permission={permission} variant="verbose" /></Box>;

    return <SelectionField className="VisibilityControl" source={source} value={[heavyValue ?? null]}
        readonly={props.readonly} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        dialogTitle={props.selectDialogTitle || "Who can see this"}
        dialogDescription={<SettingMarkdown setting="VisibilityControlSelectDialogDescription" />}
        onChange={values => props.onChange(values[0]!)} />;
};


