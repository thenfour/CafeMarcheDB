// Profile parity references: MIGRATION_RESTORE: member-profile in the backstage profile and user detail pages.
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Breadcrumbs, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserProfileCommand, bandUserProfileView, type BandUserProfileDto, type BandUserProfileEdit } from "src/core/db3/shared/entities/user/bandUserProfile";
import { bandRoleChoicesView, bandRoleListView } from "src/core/db3/shared/entities/user/bandRoleViews";
import { xUserMinimum } from "src/core/db3/shared/schema/user";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMLink } from "../CMLink";
import { AdminInspectObject, CMButton, CMButtonGroup, KeyValueTable } from "../CMCoreComponents2";
import { CMChip, CMChipContainer } from "../CMChip";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { BandUserInstrumentsEditor } from "./BandUserInstruments";
import { BandUserTagsEditor } from "./BandUserTags";
import { BandUserRoleEditor } from "./BandUserRoles";
import { BandUserLifecycleControl } from "./BandUserLifecycle";
import { withMemberPresentation } from "./bandMemberLinks";
import { useMemberAssignmentSave } from "./useMemberAssignmentSave";
import { UserDetail } from "./UserDetail";

export function BandMemberProfileEditor({ member, refetch }: {
    readonly member: BandUserProfileDto; readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const command = useDB3Command(bandUserProfileCommand);
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState(member.user.name ?? "");
    const [phone, setPhone] = React.useState(member.user.phone ?? "");
    const auth = presentation.data?.authorization;
    const canEdit = auth?.userPublicId === member.user.publicId || auth?.effectivePermissionNames.includes(Permission.manage_global_users);
    const { save, saving, error, isPending } = useMemberAssignmentSave<BandUserProfileEdit>({
        execute: command.invoke, refetch, refreshRelatedData: presentation.invalidate, onCommitted: () => setOpen(false),
        messages: { saved: "membership.profile.saved", failed: "membership.profile.failed", refreshFailed: "membership.profile.refreshFailed" },
    });
    return <Stack spacing={1} alignItems="flex-start">
        {error && !open && <Alert severity="error">{error}</Alert>}
        {canEdit && <CMButton disabled={saving} onClick={() => {
            setName(member.user.name ?? "");
            setPhone(member.user.phone ?? "");
            setOpen(true);
        }}>{locale.getPlainString("membership.profile.edit")}</CMButton>}
        <ResponsiveDialog open={open} onClose={() => {
            if (!isPending()) {
                setOpen(false);
            }
        }} fullWidth maxWidth="sm">
            <DialogTitle>{locale.getPlainString("membership.profile.edit")}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>{locale.getPlainString("membership.profile.shared")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField label={locale.getPlainString("membership.profile.name")} value={name} disabled={saving} inputProps={{ maxLength: xUserMinimum.fields.name.maxLength }} onChange={event => setName(event.target.value)} />
                {member.user.phone !== undefined && <TextField label={locale.getPlainString("membership.profile.phone")} value={phone} disabled={saving} inputProps={{ maxLength: xUserMinimum.fields.phone.maxLength }} onChange={event => setPhone(event.target.value)} />}
            </Stack></DialogContent>
            <DialogActions>
                <CMButton disabled={saving} onClick={() => setOpen(false)}>{locale.getPlainString("common.action.cancel")}</CMButton>
                <CMButton disabled={saving || !name.trim()} onClick={() => { void save({
                    membershipId: member.publicId, name,
                    ...(member.user.phone !== undefined ? { phone } : {}),
                }); }}>{locale.getPlainString("membership.profile.save")}</CMButton>
            </DialogActions>
        </ResponsiveDialog>
    </Stack>;
}

function MemberProfileRole({ member, refetch }: { readonly member: BandUserProfileDto; readonly refetch: () => Promise<unknown> }) {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const canAssign = presentation.data?.authorization.effectivePermissionNames.includes(Permission.assign_user_roles) ?? false;
    const options = { staleTime: 0, cacheTime: 0, keepPreviousData: false };
    const [roles] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleListView.tableID, tableName: bandRoleListView.tableName, viewID: bandRoleListView.viewID },
        filter: {}, cmdbQueryContext: "profile role labels",
    }, options);
    const [choices] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleChoicesView.tableID, tableName: bandRoleChoicesView.tableName, viewID: bandRoleChoicesView.viewID },
        filter: {}, cmdbQueryContext: "profile assignable roles",
    }, { ...options, enabled: canAssign });
    return <BandUserRoleEditor member={member} roles={roles.items.map(item => bandRoleListView.parseDto(item))}
        assignableRoleIds={canAssign ? (choices?.items ?? []).map(item => bandRoleChoicesView.parseDto(item).publicId) : []} refetch={refetch} />;
}

function LoadedMemberProfile({ personId }: { readonly personId: UserPublicId }) {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const locale = useLocale();
    const permissions = presentation.data?.authorization.effectivePermissionNames ?? [];
    const canOpenDirectory = permissions.includes(Permission.search_users) && permissions.includes(Permission.view_users_basic_info);
    const [result, { refetch }] = useQuery(db3queries, {
        ...context, table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
        filter: { tableParams: { personPublicId: personId } }, take: 1, cmdbQueryContext: "member profile",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const row = result.items[0];
    if (!row) {
        return <Alert severity="info">{locale.getPlainString("membership.profile.notFound")}</Alert>;
    }
    const member = bandUserProfileView.parseDto(row);
    return <>
        <Breadcrumbs>
            {canOpenDirectory && <CMLink href={withMemberPresentation("/backstage/users", context)}>{locale.getPlainString("membership.directory.title")}</CMLink>}
            <Typography>{member.user.name}</Typography>
        </Breadcrumbs>
        <div className="EventDetail contentSection event">
            <div className="content">
                <div className="titleLine">
                    <div className="titleText"><div className="titleLink"><span className="title">{member.user.name}</span></div></div>
                    <MemberProfileRole member={member} refetch={refetch} />
                    <div className="flex-spacer" />
                    <AdminInspectObject src={member} />
                </div>
                <BandUserTagsEditor member={member} refetch={refetch} />
                <BandUserInstrumentsEditor member={member} refetch={refetch} orientation="horizontal" />
                <CMButtonGroup>
                    <BandMemberProfileEditor member={member} refetch={refetch} />
                    <BandUserLifecycleControl member={member} refetch={refetch} />
                </CMButtonGroup>
                <KeyValueTable data={{
                    ...(member.user.phone !== undefined ? { [locale.getPlainString("membership.profile.phone")]:
                        <CMChipContainer>{member.user.phone ? <CMChip>{member.user.phone}</CMChip> : <span>—</span>}</CMChipContainer> } : {}),
                    ...(member.user.email !== undefined ? { [locale.getPlainString("membership.profile.email")]:
                        <CMChipContainer><CMChip>{member.user.email}</CMChip></CMChipContainer> } : {}),
                }} />
                <UserDetail person={member.user} />
            </div>
        </div>
    </>;
}

export function BandMemberProfile({ personId }: { readonly personId: UserPublicId }) {
    const presentation = usePresentation();
    const locale = useLocale();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noBand")}</Alert>;
    }
    const key = `${presentation.bandPublicId}/${personId}/${presentation.data?.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberProfile key={key} personId={personId} />;
}
