import React from "react";
import { Alert, Checkbox, FormControlLabel } from "@mui/material";
import { Permission } from "shared/permissions";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

const continuityLabels: Partial<Record<Permission, LocalizedPlainStringKey>> = {
    [Permission.assign_user_roles]: "membership.roles.permission.assignRoles",
    [Permission.deactivate_users]: "membership.roles.permission.deactivate",
};

/** Role changes and offboarding describe the same loss of band administration. */
export function BandMemberContinuityWarning({ permissions, acknowledged, saving, onAcknowledge }: {
    readonly permissions: readonly Permission[];
    readonly acknowledged: boolean;
    readonly saving: boolean;
    readonly onAcknowledge: (acknowledged: boolean) => void;
}) {
    const locale = useLocale();
    return <Alert severity="warning">
        {locale.getPlainString("membership.roles.continuity")}
        <ul>{permissions.map(permission => <li key={permission}>{locale.getPlainString(continuityLabels[permission] ?? "membership.roles.permission.other")}</li>)}</ul>
        <FormControlLabel label={locale.getPlainString("membership.roles.acknowledge")} control={<Checkbox checked={acknowledged} disabled={saving}
            onChange={(_, checked) => onAcknowledge(checked)} />} />
    </Alert>;
}
