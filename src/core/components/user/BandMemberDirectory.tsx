import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import db3paginatedQueries from "src/core/db3/queries/db3paginatedQueries";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserProfileView, type BandUserProfileDto } from "src/core/db3/shared/entities/user/bandUserProfile";
import { bandRoleListView, type BandRoleDto } from "src/core/db3/shared/entities/user/bandRoleViews";
import { bandMemberDirectoryQuery, type BandMemberDirectoryFilter } from "src/core/db3/shared/entities/user/bandUserDirectoryQuery";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMLink } from "../CMLink";
import { CMChip, CMChipContainer, CMStandardDBChip } from "../CMChip";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { bandMemberHref } from "./bandMemberLinks";

function BandMemberListItem({ member, roles }: { readonly member: BandUserProfileDto; readonly roles: readonly BandRoleDto[] }) {
    const dashboard = useDashboardContext();
    const context = useDB3QueryContext();
    const locale = useLocale();
    const role = roles.find(item => item.publicId === member.bandRoleId);
    return <Card variant="outlined"><CardContent>
        <Typography variant="h6"><CMLink href={bandMemberHref(member.user.publicId, context)}>{member.user.name}</CMLink></Typography>
        {member.user.email !== undefined && <Typography>{member.user.email}</Typography>}
        {member.user.phone !== undefined && <Typography>{member.user.phone}</Typography>}
        <CMChipContainer>
            <CMChip size="small" color={role?.color}>{role?.name ?? locale.getPlainString(member.bandRoleId ? "membership.roles.unavailable" : "membership.roles.unassigned")}</CMChip>
            {member.bandUserTagAssignments.map(assignment => {
                const tag = dashboard.userTag.getById(assignment.bandUserTagId);
                return tag && !tag.isHidden ? <CMStandardDBChip key={assignment.publicId} model={tag} size="small" />
                    : <CMChip key={assignment.publicId} size="small">{locale.getPlainString("membership.tags.unavailable")}</CMChip>;
            })}
        </CMChipContainer>
        <CMChipContainer>{member.bandUserInstruments.map(assignment => {
            const instrument = dashboard.instrument.getById(assignment.bandInstrumentId);
            return <CMChip key={assignment.publicId} size="small">{instrument && !instrument.isHidden ? instrument.name : locale.getPlainString("membership.instruments.unavailable")}
                {assignment.isPrimary && ` (${locale.getPlainString("membership.instruments.default")})`}</CMChip>;
        })}</CMChipContainer>
        {member.createdAt !== undefined && <Typography variant="caption">{locale.getPlainString("membership.directory.joinedAt", { joinedAt: member.createdAt })}</Typography>}
    </CardContent></Card>;
}

function LoadedMemberDirectory() {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const canManage = presentation.data?.authorization.effectivePermissionNames.includes(Permission.manage_users) ?? false;
    const [filter, setFilter] = React.useState<BandMemberDirectoryFilter>({ search: "", tagId: "", instrumentId: "", roleId: "", order: "nameAsc", page: 0 });
    const updateFilter = (change: Partial<BandMemberDirectoryFilter>) => setFilter(current => ({ ...current, ...change, page: 0 }));
    const options = { staleTime: 0, cacheTime: 0, keepPreviousData: false };
    const [roleResult] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleListView.tableID, tableName: bandRoleListView.tableName, viewID: bandRoleListView.viewID },
        filter: {}, cmdbQueryContext: "directory role labels",
    }, options);
    const roles = roleResult.items.map(item => bandRoleListView.parseDto(item));
    const [result, status] = useQuery(db3paginatedQueries, bandMemberDirectoryQuery(filter, context, canManage),
        { ...options, suspense: false, useErrorBoundary: false });
    return <Stack spacing={2}>
        <TextField label={locale.getPlainString("membership.directory.search")} value={filter.search} onChange={event => updateFilter({ search: event.target.value })} inputProps={{ maxLength: 500 }} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField select fullWidth label={locale.getPlainString("membership.tags.title")} value={filter.tagId} onChange={event => updateFilter({ tagId: event.target.value })}>
                <MenuItem value="">{locale.getPlainString("membership.directory.all")}</MenuItem>
                {dashboard.userTag.items.filter(tag => !tag.isHidden).map(tag => <MenuItem key={tag.publicId} value={tag.publicId}>{tag.name}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label={locale.getPlainString("membership.instruments.title")} value={filter.instrumentId} onChange={event => updateFilter({ instrumentId: event.target.value })}>
                <MenuItem value="">{locale.getPlainString("membership.directory.all")}</MenuItem>
                {dashboard.instrument.items.filter(instrument => !instrument.isHidden).map(instrument => <MenuItem key={instrument.publicId} value={instrument.publicId}>{instrument.name}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label={locale.getPlainString("membership.roles.role")} value={filter.roleId} onChange={event => updateFilter({ roleId: event.target.value })}>
                <MenuItem value="">{locale.getPlainString("membership.directory.all")}</MenuItem>
                <MenuItem value="unassigned">{locale.getPlainString("membership.roles.unassigned")}</MenuItem>
                {roles.map(role => <MenuItem key={role.publicId} value={role.publicId}>{role.name}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label={locale.getPlainString("membership.directory.order")} value={filter.order} onChange={event => {
                const value = event.target.value;
                if (value === "nameAsc" || value === "nameDesc" || value === "joinedAsc" || value === "joinedDesc") {
                    updateFilter({ order: value });
                }
            }}>
                <MenuItem value="nameAsc">{locale.getPlainString("membership.directory.nameAsc")}</MenuItem>
                <MenuItem value="nameDesc">{locale.getPlainString("membership.directory.nameDesc")}</MenuItem>
                {canManage && <MenuItem value="joinedDesc">{locale.getPlainString("membership.directory.joinedDesc")}</MenuItem>}
                {canManage && <MenuItem value="joinedAsc">{locale.getPlainString("membership.directory.joinedAsc")}</MenuItem>}
            </TextField>
        </Stack>
        {status.isFetching && <Typography role="status">{locale.getPlainString("membership.directory.loading")}</Typography>}
        {Boolean(status.error) && <Alert severity="error">{locale.getPlainString("membership.directory.failed")}</Alert>}
        {result && <>
            <Typography>{locale.getPlainString("common.items.count", { count: result.count })}</Typography>
            {result.items.length === 0 && <Typography>{locale.getPlainString("membership.directory.empty")}</Typography>}
            {result.items.map(item => {
                const member = bandUserProfileView.parseDto(item);
                return <BandMemberListItem key={member.publicId} member={member} roles={roles} />;
            })}
        </>}
        <Stack direction="row" spacing={2}>
            <Button disabled={status.isFetching || filter.page === 0} onClick={() => setFilter(current => ({ ...current, page: current.page - 1 }))}>{locale.getPlainString("membership.directory.previous")}</Button>
            <Button disabled={status.isFetching || !result?.hasMore} onClick={() => setFilter(current => ({ ...current, page: current.page + 1 }))}>{locale.getPlainString("membership.directory.next")}</Button>
            <Button disabled={status.isFetching} onClick={() => { void status.refetch(); }}>{locale.getPlainString("membership.directory.refresh")}</Button>
        </Stack>
    </Stack>;
}

export function BandMemberDirectory() {
    const presentation = usePresentation();
    const locale = useLocale();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noBand")}</Alert>;
    }
    if (!presentation.data?.authorization.effectivePermissionNames.includes(Permission.view_users_basic_info)) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noAccess")}</Alert>;
    }
    const key = `${presentation.bandPublicId}/${presentation.data.authorization.userPublicId}/${presentation.data.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberDirectory key={key} />;
}
