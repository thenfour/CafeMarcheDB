import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import React from "react";
import { Alert, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { CMButton } from "../CMCoreComponents2";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { Permission } from "shared/permissions";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import { bandUserLifecycleCommand, type BandUserLifecycleDto } from "src/core/db3/shared/entities/user/bandUserLifecycle";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";
import { BandMemberContinuityWarning } from "./BandMemberContinuityWarning";

export function BandUserLifecycleControl({ member, refetch }: {
    readonly member: Pick<BandUserLifecycleDto, "publicId" | "user" | "isDeleted">;
    readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const snackbar = useSnackbar();
    const command = useDB3Command(bandUserLifecycleCommand);
    const [open, setOpen] = React.useState(false);
    const [warnings, setWarnings] = React.useState<readonly Permission[]>([]);
    const [acknowledged, setAcknowledged] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const pending = React.useRef(false);
    const action = member.isDeleted ? "reactivate" : "deactivate";
    const canEdit = scopedAuthorizationSatisfiesRequirement(presentation.data?.authorization, member.isDeleted ? BandPermission.recover_users : BandPermission.deactivate_users) ?? false;
    const actionLabel = locale.getPlainString(member.isDeleted ? "membership.lifecycle.reactivate" : "membership.lifecycle.deactivate");
    const close = () => {
        if (!pending.current) {
            setOpen(false);
        }
    };
    const save = async () => {
        if (pending.current || (warnings.length > 0 && !acknowledged)) {
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        let didSave = false;
        try {
            const result = await command.invoke({ membershipId: member.publicId, action, acknowledgeContinuityRisk: acknowledged });
            if (result.status === "confirmationRequired") {
                setWarnings(result.permissions);
                setAcknowledged(false);
                return;
            }
            didSave = true;
            setOpen(false);
            await Promise.all([refetch(), dashboard.refreshCachedData(), presentation.invalidate()]);
            snackbar.showMessage({ severity: "success", children: locale.getPlainString("membership.lifecycle.saved") });
        } catch (reason) {
            setError(locale.getPlainString(didSave ? "membership.lifecycle.refreshFailed" : "membership.lifecycle.failed"));
            console.error(reason);
        } finally {
            pending.current = false;
            setSaving(false);
        }
    };
    return <Stack spacing={1} aria-busy={saving}>
        {error && !open && <Alert severity="error">{error}</Alert>}
        {canEdit && <CMButton color={member.isDeleted ? "primary" : "warning"} disabled={saving} onClick={() => {
            setWarnings([]);
            setAcknowledged(false);
            setError(null);
            setOpen(true);
        }}>{actionLabel}</CMButton>}
        {saving && <Typography role="status">{locale.getPlainString("membership.lifecycle.saving")}</Typography>}
        <ResponsiveDialog open={open} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>{member.user.name}</Typography>
                <Typography>{locale.getPlainString(member.isDeleted ? "membership.lifecycle.reactivateDescription" : "membership.lifecycle.deactivateDescription")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {warnings.length > 0 && <BandMemberContinuityWarning permissions={warnings} acknowledged={acknowledged} saving={saving} onAcknowledge={setAcknowledged} />}
            </Stack></DialogContent>
            <DialogActions>
                <CMButton disabled={saving} onClick={close}>{locale.getPlainString("common.action.cancel")}</CMButton>
                <CMButton disabled={saving || (warnings.length > 0 && !acknowledged)} onClick={() => { void save(); }}>{locale.getPlainString("membership.lifecycle.confirm")}</CMButton>
            </DialogActions>
        </ResponsiveDialog>
    </Stack>;
}
