
import { Tooltip } from "@mui/material";
import { StandardVariationSpec } from 'shared/color';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { ChoiceEditCell } from "./ChooseItemDialog";
import { SettingMarkdown } from "./SettingMarkdown";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type VisibilityControlValue = (db3.PermissionPayload | null);

export interface VisibilityValueProps {
    permission: db3.PermissionPayload | null;
    variant: "minimal" | "verbose";
    onClick?: () => void;
};

export const VisibilityValue = ({ permission, variant, onClick }: VisibilityValueProps) => {
    const visInfo = API.users.getVisibilityInfo({ visiblePermission: permission, visiblePermissionId: permission?.id || null });
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

    return <Tooltip title={tooltipTitle}><div className={classes.join(" ")} style={style.style} onClick={onClick}>
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
    value: VisibilityControlValue;
    variant?: "minimal" | "verbose";
    onChange: (value: VisibilityControlValue) => void;
    selectDialogTitle?: React.ReactNode;
};
export const VisibilityControl = (props: VisibilityControlProps) => {
    const permissions = API.users.getAllPermissions();
    const variant = props.variant || "verbose";
    const [currentUser] = useCurrentUser();
    const visibilityChoices = [null, ...(permissions.items as db3.PermissionPayload[]).filter(p => {
        return p.isVisibility && p.roles.some(r => r.roleId === currentUser?.roleId);
    })];

    // value type is PermissionPayload
    return <div className={`VisibilityControl`}>
        <ChoiceEditCell
            isEqual={(a: db3.PermissionPayload, b: db3.PermissionPayload) => a.id === b.id}
            items={visibilityChoices}
            readonly={false} // todo!
            validationError={null}
            selectDialogTitle={props.selectDialogTitle || "Select who can see this"}
            //selectButtonLabel='change visibility'
            value={props.value}
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


