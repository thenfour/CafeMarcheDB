import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { Alert, Breadcrumbs, Stack, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import getUserManagementCapabilities from "src/auth/queries/getUserManagementCapabilities";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import db3queries from "src/core/db3/queries/db3queries";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMLink } from "@/src/route/CMLink";
import { CMButtonGroup, KeyValueTable } from "../CMCoreComponents2";
import { useDashboardContext, useRecordFeatureUse } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { AccountRoleControl } from "./AccountRoleControl";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { UserAdminPanel } from "./UserAdminPanel";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { UserSignInMethodsButton } from "./UserSignInMethodsButton";
import { UserProfileFieldsEditor } from "./UserProfileFieldsEditor";
import { UserMassAnalysisTabContent } from "./UserAnalyticTables";
import { portalHref } from "src/route/portalRouting";

function LoadedAccountProfile({ personId, mode }: {
    readonly personId: UserPublicId;
    readonly mode: "controls" | "page";
}) {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const router = useRouter();
    const command = useDB3Command(platformUserEditorView.crud.operations.update.command, { bandPublicId: null });
    const [result, { refetch }] = useQuery(db3queries, {
        ...context, bandPublicId: null,
        table: { tableID: platformUserEditorView.tableID, tableName: platformUserEditorView.tableName, viewID: platformUserEditorView.viewID },
        filter: { publicIds: [personId] }, take: 1, includeDeleted: true, cmdbQueryContext: "account profile controls",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const { bandPublicId: _band, ...preferences } = context;
    const [capabilities, { refetch: refetchCapabilities }] = useQuery(getUserManagementCapabilities,
        { ...preferences, userId: personId }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const row = result.items[0];
    if (!row) {
        return <Alert severity="info">{locale.getPlainString("membership.profile.accountNotFound")}</Alert>;
    }
    const user = platformUserEditorView.hydrate(platformUserEditorView.parseDto(row), dashboard.referenceStore);
    const refresh = () => Promise.all([refetch(), refetchCapabilities()]);
    const controls = <>
        {user.isDeleted && <Alert severity="warning">{capabilities.mergedIntoUserId
            ? <>{locale.getPlainString("membership.profile.merged")} <CMLink href={portalHref(
                `/backstage/platform-user/${capabilities.mergedIntoUserId}`, { ...context, bandPublicId: null }, dashboard.portalHosting)}>
                {locale.getPlainString("membership.profile.remainingAccount")}</CMLink></>
            : locale.getPlainString("membership.profile.deactivated")}</Alert>}
        <Stack spacing={1} alignItems="flex-start">
            {capabilities.canAssignRole && <AccountRoleControl userId={personId} capabilities={capabilities} onChanged={refresh} />}
            <CMButtonGroup>
                <UserAdminPanel user={user} capabilities={capabilities} refetch={refresh}
                    onDeactivated={mode === "controls" ? () => router.replace(portalHref(
                        `/backstage/platform-user/${personId}`, { ...context, bandPublicId: null }, dashboard.portalHosting)) : refresh} />
                {dashboard.isAuthorized(Permission.sysadmin) && <UserIdentityIndicator user={user} />}
                {capabilities.canResetPassword && <AdminResetPasswordButton user={user} />}
                {capabilities.canManageSignInMethods && <UserSignInMethodsButton user={user} onChanged={refresh} />}
            </CMButtonGroup>
        </Stack>
    </>;
    if (mode === "controls") {
        return controls;
    }
    return <>
        <Breadcrumbs>
            <CMLink href={portalHref("/backstage/platform-adminUsers", { ...context, bandPublicId: null }, dashboard.portalHosting)}>
                {locale.getPlainString("platformUser.title")}</CMLink>
            <Typography>{user.name}</Typography>
        </Breadcrumbs>
        <div className="EventDetail contentSection event"><div className="content">
            <div className="titleLine">
                <div className="titleText"><div className="titleLink"><span className="title">{user.name}</span></div></div>
            </div>
            {controls}
            <UserProfileFieldsEditor person={user} canEdit={!user.isDeleted && capabilities.mergedIntoUserId === null} refetch={refresh}
                saveProfile={patch => command.invoke({ identity: personId, patch })} />
            <KeyValueTable data={{
                [locale.getPlainString("membership.profile.phone")]: user.phone || "—",
                [locale.getPlainString("membership.profile.email")]: user.email
            }} />
            {dashboard.isAuthorized(Permission.sysadmin) && <UserMassAnalysisTabContent user={user} />}
        </div></div>
    </>;
}

/** Omitted band context is explicit account administration; it never recovers a band profile. */
export function AccountProfile({ personId, mode }: { readonly personId: UserPublicId; readonly mode: "controls" | "page" }) {
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    if (!dashboard.isAuthorized(Permission.manage_global_users)) {
        return null;
    }
    const key = `${personId}/${presentation.bandPublicId}/${presentation.data?.authorization.userPublicId}/${presentation.data?.input.clientRequestId}`;
    return <LoadedAccountProfile key={key} personId={personId} mode={mode} />;
}

export function AccountProfilePageContent({ personId }: { readonly personId: UserPublicId }) {
    useRecordFeatureUse({ feature: ActivityFeature.profile_view, context: `profile/${personId}` });
    return <AccountProfile personId={personId} mode="page" />;
}
