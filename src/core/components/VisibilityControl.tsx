
import { Tooltip } from "@mui/material";
import React from 'react';
import * as db3 from "src/core/db3/db3";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";
import { ChoiceEditCell } from "./select/ChooseItemDialog";
import { SettingMarkdown } from "./SettingMarkdown";
import { StandardVariationSpec } from "./color/palette";
import { useDashboardContext } from "./dashboardContext/DashboardContext";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type VisibilityControlValue = (db3.PermissionPayload | null);

export interface VisibilityValueProps {
    permission?: db3.PermissionPayloadMinimum | null;
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
    onChange: (value: VisibilityControlValue) => void;
    selectDialogTitle?: React.ReactNode;
};
export const VisibilityControl = (props: VisibilityControlProps) => {
    const dashboardContext = useDashboardContext();

    const variant = props.variant || "verbose";
    const visibilityChoices = [null, ...(dashboardContext.permission.items).filter(p => {
        return p.isVisibility && dashboardContext.isAuthorized(p.name);
    })];

    const heavyValue = typeof props.value === "number" ? dashboardContext.permission.getById(props.value) : props.value;

    return <div className={`VisibilityControl`}>
        <ChoiceEditCell
            isEqual={(a: db3.PermissionPayload, b: db3.PermissionPayload) => a.id === b.id}
            items={visibilityChoices}
            readonly={false} // todo!
            validationError={null}
            selectDialogTitle={props.selectDialogTitle || "Select who can see this"}
            //selectButtonLabel='change visibility'
            value={heavyValue}
            //dialogDescription={<>dialog description her99ee</>}
            dialogDescription={<SettingMarkdown setting="VisibilityControlSelectDialogDescription" />}
            renderAsListItem={(chprops, value: db3.PermissionPayload | null, selected: boolean) => {
                return <li {...chprops}>
                    <VisibilityValue permission={value} variant={"verbose"} />
                </li>;
            }}
            renderValue={(args) => {
                return <VisibilityValue permission={args.value} variant={variant} onClick={args.handleEnterEdit} />;
            }}
            onChange={props.onChange}
        />
    </div>;
};


