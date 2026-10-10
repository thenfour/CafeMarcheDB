import { Suspense } from "react";
import { Permission } from "shared/permissions";
import type { BandUserSearchClient } from "src/core/db3/db3";
import { localizedText } from "src/core/db3/shared/columnTypes/localizedString";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip, CMChipContainer, CMStandardDBChip, CMDivider } from "../CMChip";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { GenericSearchListItem } from "../search/SearchListItem";
import { useLocale } from "src/locale/components/useLocale";
import type { UsersFilterSpec } from "./UserClientBaseTypes";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { bandMemberHref } from "./bandMemberLinks";

export function UserListItem({ user, index, refetch, filterSpec }: {
    readonly user: BandUserSearchClient; readonly index: number;
    readonly refetch: () => void; readonly filterSpec: UsersFilterSpec;
}) {
    const dashboard = useDashboardContext();
    const context = useDB3QueryContext();
    const locale = useLocale();
    const canManage = dashboard.isAuthorized(Permission.manage_users);
    const joinedAt = user.createdAt;
    return <GenericSearchListItem index={index} item={user} refetch={refetch} icon={gIconMap.Person()}
        href={bandMemberHref(user.user.publicId, context)} title={user.user.name ?? ""}
        titleExtra={canManage && user.isDeleted && <CMChip color="warning" size="small">Deactivated</CMChip>}
        credits={dashboard.isAuthorized(Permission.view_user_contact_info) ? [user.user.email, user.user.phone] : []}
        bodyContent={<>
            <CMChipContainer className="songTags">
                {user.bandUserTagAssignments.map(assignment => {
                    const tag = dashboard.userTag.getById(assignment.bandUserTagId);
                    if (!tag || tag.isHidden) {
                        return null;
                    }
                    return <CMStandardDBChip key={assignment.publicId} model={tag} size="small"
                        getTooltip={() => tag.description}
                        variation={{ ...StandardVariationSpec.Weak, selected: filterSpec.tagFilter.options.includes(tag.publicId) }} />;
                })}
                {canManage && user.bandRole && <CMChip size="small" shape="rectangle" color={user.bandRole.color}
                    variation={{ ...StandardVariationSpec.Strong, selected: filterSpec.roleFilter.options.includes(user.bandRole.publicId) }}>{localizedText(user.bandRole.name)}</CMChip>}
                {dashboard.isAuthorized(Permission.sysadmin) && <Suspense><CMDivider /><UserIdentityIndicator userId={user.user.publicId} /></Suspense>}
            </CMChipContainer>
            <CMChipContainer className="instruments">
                {user.bandUserInstruments.map(assignment => {
                    const instrument = dashboard.instrument.getById(assignment.bandInstrumentId);
                    if (!instrument || instrument.isHidden || instrument.functionalGroup.isHidden) {
                        return null;
                    }
                    return <CMStandardDBChip key={assignment.publicId} model={instrument} size="small"
                        getTooltip={() => instrument.description}
                        variation={{ ...StandardVariationSpec.Weak, selected: filterSpec.instrumentFilter.options.includes(instrument.publicId) }} />;
                })}
            </CMChipContainer>
        </>}
        footerContent={canManage && joinedAt && <DateValue value={joinedAt}
            format={() => locale.getPlainString("membership.directory.joinedAt", { joinedAt })} style={{ opacity: .5 }} />} />;
}

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/components/user/UserListItem.tsx:1-84
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 00ec01e4f0cc6bef1574d62a4c0736c227574152dee03b63caca19bb5246e2d7
// MIGRATION_REFERENCE_BEGIN
// import { Suspense } from "react";
// import * as db3 from "src/core/db3/db3";
// import { gIconMap } from "../../db3/components/IconMap";
// import { SearchResultsRet } from "../../db3/shared/apiTypes";
// import { EnrichedUser } from "../../db3/shared/schema/enrichedUserTypes";
// import { CMChip, CMChipContainer, CMDivider, CMStandardDBChip } from "../CMChip";
// import { StandardVariationSpec } from "../color/palette";
// import { useDashboardContext } from "../dashboardContext/DashboardContext";
// import { DateValue } from "../DateTime/DateTimeComponents";
// import { GenericSearchListItem } from "../search/SearchListItem";
// import { UsersFilterSpec } from "./UserClientBaseTypes";
// import { UserIdentityIndicator } from "./UserIdentityIndicator";
// import { Permission } from "@/shared/permissions";
//
// export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;
//
// type UserListItemProps = {
//     index: number;
//     user: EnrichedVerboseUser;
//     results: SearchResultsRet;
//     refetch: () => void;
//     filterSpec: UsersFilterSpec;
// };
//
// export const UserListItem = (props: UserListItemProps) => {
//     const dashboardContext = useDashboardContext();
//     const canViewContactInfo = dashboardContext.isAuthorized(Permission.view_user_contact_info);
//     const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);
//     const canViewSignInMethods = dashboardContext.isAuthorized(Permission.sysadmin);
//     return <GenericSearchListItem<EnrichedVerboseUser>
//         index={props.index}
//         item={props.user}
//         icon={gIconMap.Person()}
//         refetch={props.refetch}
//         href={dashboardContext.routingApi.getURIForUser(props.user)}
//         title={props.user.name}
//         titleExtra={canManageUsers && props.user.isDeleted && <CMChip color="warning" size="small">Deactivated</CMChip>}
//         credits={canViewContactInfo ? [
//             props.user.email,
//             props.user.phone,
//         ] : []}
//         bodyContent={
//             <>
//                 <CMChipContainer className="songTags">
//                     {props.user.tags.map(tag => <CMStandardDBChip
//                         key={db3.xUserTagAssignment.getIdentity(tag)}
//                         size='small'
//                         model={tag.userTag}
//                         variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.userTagId) }}
//                         getTooltip={(_) => tag.userTag.description}
//                     />)}
//                     {canManageUsers && props.user.role &&
//                         <CMChip
//                             color={props.user.role.color}
//                             shape={"rectangle"}
//                             size="small"
//                             variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.roleFilter.options.includes(db3.xRole.getIdentity(props.user.role)) }}
//                         >
//                             {props.user.role.name}
//                         </CMChip>}
//                     {canViewSignInMethods && <Suspense>
//                         <CMDivider />
//                         <UserIdentityIndicator userId={props.user.publicId} />
//                     </Suspense>}
//                 </CMChipContainer>
//
//                 <CMChipContainer className="instruments">
//                     {props.user.instruments.map(tag => <CMStandardDBChip
//                         key={db3.xUserInstrument.getIdentity(tag)}
//                         size='small'
//                         model={tag.instrument}
//                         variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.instrumentFilter.options.includes(tag.instrumentId) }}
//                         getTooltip={(_) => tag.instrument.description}
//                     />)}
//                 </CMChipContainer>
//             </>
//         }
//         footerContent={canManageUsers &&
//             <>
//                 <DateValue value={props.user.createdAt} format={(dateStr) => `Created at ${dateStr}`} style={{ opacity: .5 }} />
//             </>
//         }
//     />;
// }
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: directory-search
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/core/components/user/UserListItem.tsx:1-75
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore multi-value filter operators, presets, URL state, contact search policy, and CSV export for the selected band.
// Verification: Test filter combinations, permission restrictions, pagination, URL round trips, and exported rows; exercise the built directory.
// SHA256: bf39f72e5fd602995aa25981a4395e5964e6a84b1c7b4f8252e0b3fb9d0ef93c
// MIGRATION_REFERENCE_BEGIN
// import { Suspense } from "react";
// import * as db3 from "src/core/db3/db3";
// import { gIconMap } from "../../db3/components/IconMap";
// import { SearchResultsRet } from "../../db3/shared/apiTypes";
// import { EnrichedUser } from "../../db3/shared/schema/enrichedUserTypes";
// import { CMChip, CMChipContainer, CMDivider, CMStandardDBChip } from "../CMChip";
// import { StandardVariationSpec } from "../color/palette";
// import { useDashboardContext } from "../dashboardContext/DashboardContext";
// import { DateValue } from "../DateTime/DateTimeComponents";
// import { GenericSearchListItem } from "../search/SearchListItem";
// import { UsersFilterSpec } from "./UserClientBaseTypes";
// import { UserIdentityIndicator } from "./UserIdentityIndicator";
// import { Permission } from "@/shared/permissions";
//
// export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;
//
// type UserListItemProps = {
//     index: number;
//     user: EnrichedVerboseUser;
//     results: SearchResultsRet;
//     refetch: () => void;
//     filterSpec: UsersFilterSpec;
// };
//
// export const UserListItem = (props: UserListItemProps) => {
//     const dashboardContext = useDashboardContext();
//     const canViewContactInfo = dashboardContext.isAuthorized(Permission.view_user_contact_info);
//     const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);
//     const canViewSignInMethods = dashboardContext.isAuthorized(Permission.sysadmin);
//     return <GenericSearchListItem<EnrichedVerboseUser>
//         index={props.index}
//         item={props.user}
//         icon={gIconMap.Person()}
//         refetch={props.refetch}
//         href={dashboardContext.routingApi.getURIForUser(props.user)}
//         title={props.user.name}
//         titleExtra={canManageUsers && props.user.isDeleted && <CMChip color="warning" size="small">Deactivated</CMChip>}
//         credits={canViewContactInfo ? [
//             props.user.email,
//             props.user.phone,
//         ] : []}
//         bodyContent={
//             <>
//                 <CMChipContainer className="songTags">
//                     {props.user.tags.map(tag => <CMStandardDBChip
//                         key={db3.xUserTagAssignment.getIdentity(tag)}
//                         size='small'
//                         model={tag.userTag}
//                         variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.userTagId) }}
//                         getTooltip={(_) => tag.userTag.description}
//                     />)}
//                     {canViewSignInMethods && <Suspense>
//                         <CMDivider />
//                         <UserIdentityIndicator userId={props.user.publicId} />
//                     </Suspense>}
//                 </CMChipContainer>
//
//                 <CMChipContainer className="instruments">
//                     {props.user.instruments.map(tag => <CMStandardDBChip
//                         key={db3.xUserInstrument.getIdentity(tag)}
//                         size='small'
//                         model={tag.instrument}
//                         variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.instrumentFilter.options.includes(tag.instrumentId) }}
//                         getTooltip={(_) => tag.instrument.description}
//                     />)}
//                 </CMChipContainer>
//             </>
//         }
//         footerContent={canManageUsers &&
//             <>
//                 <DateValue value={props.user.createdAt} format={(dateStr) => `Created at ${dateStr}`} style={{ opacity: .5 }} />
//             </>
//         }
//     />;
// }
// MIGRATION_REFERENCE_END
