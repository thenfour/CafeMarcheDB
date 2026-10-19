import { scopedAuthorizationSatisfiesRequirement, permissionNamesSatisfyRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Breadcrumbs, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserProfileCommand, bandUserProfileView, type BandUserProfileDto } from "src/core/db3/shared/entities/user/bandUserProfile";
import { bandRoleChoicesView, bandRoleListView } from "src/core/db3/shared/entities/user/bandRoleViews";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMLink } from "@/src/route/CMLink";
import { AdminInspectObject, CMButtonGroup, KeyValueTable } from "../CMCoreComponents2";
import { CMChip, CMChipContainer } from "../CMChip";
import { BandUserInstrumentsEditor } from "./BandUserInstruments";
import { BandUserTagsEditor } from "./BandUserTags";
import { BandUserRoleEditor } from "./BandUserRoles";
import { BandUserLifecycleControl } from "./BandUserLifecycle";
import { portalHref } from "src/route/portalRouting";
import { UserProfileFieldsEditor } from "./UserProfileFieldsEditor";
import { UserDetail } from "./UserDetail";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";

export function BandMemberProfileEditor({ member, refetch }: {
    readonly member: BandUserProfileDto; readonly refetch: () => Promise<unknown>;
}) {
    const presentation = usePresentation();
    const command = useDB3Command(bandUserProfileCommand);
    const auth = presentation.data?.authorization;
    const canEdit = auth?.userPublicId === member.user.publicId
        || (auth?.effectivePermissionNames.includes(Permission.manage_global_users) ?? false);
    return <UserProfileFieldsEditor person={member.user} canEdit={canEdit} refetch={refetch}
        saveProfile={fields => command.invoke({ membershipId: member.publicId, ...fields })} />;
}

function MemberProfileRole({ member, refetch }: { readonly member: BandUserProfileDto; readonly refetch: () => Promise<unknown> }) {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const canAssign = scopedAuthorizationSatisfiesRequirement(presentation.data?.authorization, BandPermission.assign_user_roles) ?? false;
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
    const router = useCmdbRouter();
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const locale = useLocale();
    const permissions = presentation.data?.authorization.effectivePermissionNames ?? [];
    const canOpenDirectory = permissionNamesSatisfyRequirement(permissions, BandPermission.search_users, Boolean(presentation.bandPublicId)) && permissionNamesSatisfyRequirement(permissions, BandPermission.view_users_basic_info, Boolean(presentation.bandPublicId));
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
            {canOpenDirectory && <CMLink href={portalHref("/backstage/users", context, router.hosting)}>{locale.getPlainString("membership.directory.title")}</CMLink>}
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
                    ...(member.user.phone !== undefined ? {
                        [locale.getPlainString("membership.profile.phone")]:
                            <CMChipContainer>{member.user.phone ? <CMChip>{member.user.phone}</CMChip> : <span>—</span>}</CMChipContainer>
                    } : {}),
                    ...(member.user.email !== undefined ? {
                        [locale.getPlainString("membership.profile.email")]:
                            <CMChipContainer><CMChip>{member.user.email}</CMChip></CMChipContainer>
                    } : {}),
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
