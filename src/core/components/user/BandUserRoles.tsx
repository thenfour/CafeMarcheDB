import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Box, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { CMButton } from "../CMCoreComponents2";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { Permission } from "shared/permissions";
import type { BandRolePublicId } from "shared/publicId";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import db3queries from "src/core/db3/queries/db3queries";
import { bandRoleChoicesView, bandRoleListView, xBandRole, type BandRoleDto } from "src/core/db3/shared/entities/user/bandRoleViews";
import { bandUserRoleCommand, bandUserRolesView, type BandUserRolesDto } from "src/core/db3/shared/entities/user/bandUserRoles";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";
import { BandMemberContinuityWarning } from "./BandMemberContinuityWarning";

export function BandUserRoleEditor({ member, roles, assignableRoleIds, refetch }: {
    readonly member: BandUserRolesDto;
    readonly roles: readonly BandRoleDto[];
    readonly assignableRoleIds: readonly BandRolePublicId[];
    readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const snackbar = useSnackbar();
    const command = useDB3Command(bandUserRoleCommand);
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState<BandRolePublicId | null>(member.bandRoleId);
    const [warnings, setWarnings] = React.useState<readonly Permission[]>([]);
    const [acknowledged, setAcknowledged] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const pending = React.useRef(false);
    const canEdit = scopedAuthorizationSatisfiesRequirement(presentation.data?.authorization, BandPermission.assign_user_roles) ?? false;
    const roleLabel = (roleId: BandRolePublicId | null) => roleId === null
        ? locale.getPlainString("membership.roles.unassigned")
        : roles.find(role => role.publicId === roleId)?.name ?? locale.getPlainString("membership.roles.unavailable");
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
            const result = await command.invoke({ membershipId: member.publicId, roleId: draft, acknowledgeContinuityRisk: acknowledged });
            if (result.status === "confirmationRequired") {
                setWarnings(result.permissions);
                setAcknowledged(false);
                return;
            }
            didSave = true;
            setOpen(false);
            await Promise.all([refetch(), dashboard.refreshCachedData(), presentation.invalidate()]);
            snackbar.showMessage({ severity: "success", children: locale.getPlainString("membership.roles.saved") });
        } catch (reason) {
            setError(locale.getPlainString(didSave ? "membership.roles.refreshFailed" : "membership.roles.failed"));
            console.error(reason);
        } finally {
            pending.current = false;
            setSaving(false);
        }
    };
    return <Stack spacing={1} alignItems="flex-start" aria-busy={saving}>
        <Typography>{roleLabel(member.bandRoleId)}</Typography>
        {error && !open && <Alert severity="error">{error}</Alert>}
        {canEdit && <CMButton disabled={saving} onClick={() => {
            setDraft(member.bandRoleId);
            setWarnings([]);
            setAcknowledged(false);
            setError(null);
            setOpen(true);
        }}>{locale.getPlainString("membership.roles.edit")}</CMButton>}
        {saving && <Typography role="status">{locale.getPlainString("membership.roles.saving")}</Typography>}
        <ResponsiveDialog open={open} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>{locale.getPlainString("membership.roles.edit")}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>{locale.getPlainString("membership.roles.description")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField select label={locale.getPlainString("membership.roles.role")} value={draft ?? ""} disabled={saving} onChange={event => {
                    setDraft(event.target.value === "" ? null : xBandRole.parseIdentity(event.target.value));
                    setWarnings([]);
                    setAcknowledged(false);
                    setError(null);
                }}>
                    <MenuItem value="">{roleLabel(null)}</MenuItem>
                    {member.bandRoleId !== null && !assignableRoleIds.includes(member.bandRoleId)
                        && <MenuItem value={member.bandRoleId} disabled>{roleLabel(member.bandRoleId)}</MenuItem>}
                    {roles.filter(role => assignableRoleIds.includes(role.publicId)).map(role => <MenuItem key={role.publicId} value={role.publicId}>{roleLabel(role.publicId)}</MenuItem>)}
                </TextField>
                {warnings.length > 0 && <BandMemberContinuityWarning permissions={warnings} acknowledged={acknowledged} saving={saving} onAcknowledge={setAcknowledged} />}
            </Stack></DialogContent>
            <DialogActions>
                <CMButton disabled={saving} onClick={close}>{locale.getPlainString("membership.roles.cancel")}</CMButton>
                <CMButton disabled={saving || (warnings.length > 0 && !acknowledged)} onClick={() => { void save(); }}>{locale.getPlainString("membership.roles.save")}</CMButton>
            </DialogActions>
        </ResponsiveDialog>
    </Stack>;
}

function LoadedMemberRoles() {
    const context = useDB3QueryContext();
    const locale = useLocale();
    const options = { staleTime: 0, cacheTime: 0, keepPreviousData: false };
    const [members, { refetch: refetchMembers }] = useQuery(db3queries, {
        ...context, table: { tableID: bandUserRolesView.tableID, tableName: bandUserRolesView.tableName, viewID: bandUserRolesView.viewID },
        filter: {}, cmdbQueryContext: "member roles",
    }, options);
    const [roles, { refetch: refetchRoles }] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleListView.tableID, tableName: bandRoleListView.tableName, viewID: bandRoleListView.viewID },
        filter: {}, cmdbQueryContext: "member role labels",
    }, options);
    const [choices, { refetch: refetchChoices }] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleChoicesView.tableID, tableName: bandRoleChoicesView.tableName, viewID: bandRoleChoicesView.viewID },
        filter: {}, cmdbQueryContext: "assignable band roles",
    }, options);
    const roleRows = roles.items.map(item => bandRoleListView.parseDto(item));
    const assignableRoleIds = choices.items.map(item => bandRoleChoicesView.parseDto(item).publicId);
    const refetch = () => Promise.all([refetchMembers(), refetchRoles(), refetchChoices()]);
    return <Stack spacing={3}>
        {members.items.length === 0 && <Typography>{locale.getPlainString("membership.roles.empty")}</Typography>}
        {members.items.map(item => {
            const member = bandUserRolesView.parseDto(item);
            return <Box key={member.publicId}>
                <Typography variant="h6">{member.user.name}</Typography>
                <BandUserRoleEditor member={member} roles={roleRows} assignableRoleIds={assignableRoleIds} refetch={refetch} />
            </Box>;
        })}
    </Stack>;
}

export function MemberRolesControl() {
    const locale = useLocale();
    const presentation = usePresentation();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.roles.noBand")}</Alert>;
    }
    const contextKey = `${presentation.bandPublicId}/${presentation.data?.authorization.bandUserPublicId ?? "members"}/${presentation.data?.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberRoles key={contextKey} />;
}
