// Replaced by band membership profiles/directory. Retain the full legacy behavior below until parity is verified.
export {};

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
