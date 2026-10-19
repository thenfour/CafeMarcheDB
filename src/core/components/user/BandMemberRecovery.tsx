import { permissionNamesSatisfyRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import db3paginatedQueries from "src/core/db3/queries/db3paginatedQueries";
import db3queries from "src/core/db3/queries/db3queries";
import { bandRoleListView } from "src/core/db3/shared/entities/user/bandRoleViews";
import { bandMemberRecoveryQuery, bandUserLifecycleView } from "src/core/db3/shared/entities/user/bandUserLifecycle";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { BandUserLifecycleControl } from "./BandUserLifecycle";

function LoadedMemberRecovery() {
    const context = useDB3QueryContext();
    const locale = useLocale();
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [roleResult] = useQuery(db3queries, {
        ...context, table: { tableID: bandRoleListView.tableID, tableName: bandRoleListView.tableName, viewID: bandRoleListView.viewID },
        filter: {}, cmdbQueryContext: "recovery role labels",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const roles = roleResult.items.map(item => bandRoleListView.parseDto(item));
    const [result, status] = useQuery(db3paginatedQueries, bandMemberRecoveryQuery(search, page, context),
        { staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
    return <Stack spacing={2}>
        <Typography>{locale.getPlainString("membership.lifecycle.recoveryDescription")}</Typography>
        <TextField label={locale.getPlainString("membership.directory.search")} value={search} inputProps={{ maxLength: 500 }} onChange={event => {
            setSearch(event.target.value);
            setPage(0);
        }} />
        {status.isFetching && <Typography role="status">{locale.getPlainString("membership.directory.loading")}</Typography>}
        {Boolean(status.error) && <Alert severity="error">{locale.getPlainString("membership.directory.failed")}</Alert>}
        {result && <>
            <Typography>{locale.getPlainString("common.items.count", { count: result.count })}</Typography>
            {result.items.length === 0 && <Typography>{locale.getPlainString("membership.lifecycle.empty")}</Typography>}
            {result.items.map(item => {
                const member = bandUserLifecycleView.parseDto(item);
                const roleLabel = member.bandRoleId === null ? locale.getPlainString("membership.roles.unassigned")
                    : roles.find(role => role.publicId === member.bandRoleId)?.name ?? locale.getPlainString("membership.roles.unavailable");
                return <Card key={member.publicId} variant="outlined"><CardContent>
                    <Typography variant="h6">{member.user.name}</Typography>
                    <Typography>{locale.getPlainString("membership.roles.role")}: {roleLabel}</Typography>
                    <BandUserLifecycleControl member={member} refetch={async () => {
                        await status.refetch();
                        setPage(0);
                    }} />
                </CardContent></Card>;
            })}
        </>}
        <Stack direction="row" spacing={2}>
            <Button disabled={status.isFetching || page === 0} onClick={() => setPage(current => current - 1)}>{locale.getPlainString("membership.directory.previous")}</Button>
            <Button disabled={status.isFetching || !result?.hasMore} onClick={() => setPage(current => current + 1)}>{locale.getPlainString("membership.directory.next")}</Button>
            <Button disabled={status.isFetching} onClick={() => { void status.refetch(); }}>{locale.getPlainString("membership.directory.refresh")}</Button>
        </Stack>
    </Stack>;
}

export function BandMemberRecovery() {
    const presentation = usePresentation();
    const locale = useLocale();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noBand")}</Alert>;
    }
    const permissions = presentation.data?.authorization.effectivePermissionNames ?? [];
    if (!permissionNamesSatisfyRequirement(permissions, BandPermission.recover_users, Boolean(presentation.bandPublicId)) || !permissionNamesSatisfyRequirement(permissions, BandPermission.view_users_basic_info, Boolean(presentation.bandPublicId))) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noAccess")}</Alert>;
    }
    const key = `${presentation.bandPublicId}/${presentation.data?.authorization.userPublicId}/${presentation.data?.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberRecovery key={key} />;
}
