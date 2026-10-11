import React, { Suspense } from "react";
import { useQuery } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import type { UserPublicId } from "shared/publicId";
import getUserManagementCapabilities from "src/auth/queries/getUserManagementCapabilities";
import db3queries from "src/core/db3/queries/db3queries";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { useLocale } from "src/locale/components/useLocale";
import { gIconMap } from "../../db3/components/IconMap";
import { CMButtonGroup } from "../CMCoreComponents2";
import { CMTab, CMTabPanel } from "../TabPanel";
import { useDashboardContext, useRecordFeatureUse } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { UserAdminPanel } from "./UserAdminPanel";
import { UserSignInMethodsButton } from "./UserSignInMethodsButton";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
import { withMemberPresentation } from "./bandMemberLinks";
import { AccountRoleControl } from "./AccountRoleControl";

interface ProfilePerson { readonly publicId: UserPublicId; readonly name?: string }
const tabs = ["attendance", "credits", "wiki", "massAnalysis"] as const;
function isProfileTab(value: unknown): value is typeof tabs[number] {
    return tabs.some(tab => tab === value);
}

function ProfileAccountControls({ person }: { readonly person: ProfilePerson }) {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const [result, { refetch }] = useQuery(db3queries, { ...context,
        table: { tableID: platformUserEditorView.tableID, tableName: platformUserEditorView.tableName, viewID: platformUserEditorView.viewID },
        filter: { publicIds: [person.publicId] }, take: 1, cmdbQueryContext: "profile account controls",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const { bandPublicId: _band, ...locale } = context;
    const [capabilities, { refetch: refetchCapabilities }] = useQuery(getUserManagementCapabilities, { ...locale, userId: person.publicId },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const row = result.items[0];
    if (!row) {
        return null;
    }
    const user = platformUserEditorView.hydrate(platformUserEditorView.parseDto(row), dashboard.referenceStore);
    const refresh = () => Promise.all([refetch(), refetchCapabilities()]);
    return <CMButtonGroup>
        {capabilities.canAssignRole && <AccountRoleControl key={`${person.publicId}:${context.bandPublicId}:${context.routeLocale}:${context.browserLanguages?.join(",")}`}
            userId={person.publicId} capabilities={capabilities} onChanged={refresh} />}
        <UserAdminPanel user={user} capabilities={capabilities} refetch={refresh} />
        {dashboard.isAuthorized(Permission.sysadmin) && <UserIdentityIndicator user={user} />}
        {capabilities.canResetPassword && <AdminResetPasswordButton user={user} />}
        {capabilities.canManageSignInMethods && <UserSignInMethodsButton user={user} onChanged={refresh} />}
    </CMButtonGroup>;
}

// Account authority is global; analytics retain the original sysadmin presentation gate.
export function UserDetail({ person }: { readonly person: ProfilePerson }) {
    const dashboard = useDashboardContext();
    const context = useDB3QueryContext();
    const router = useRouter();
    const locale = useLocale();
    useRecordFeatureUse({ feature: ActivityFeature.profile_view, context: `profile/${person.publicId}` });
    const path = router.query.id_slug_tab;
    const requested = Array.isArray(path) ? path[2] : undefined;
    const selected = isProfileTab(requested) ? requested : "attendance";
    return <>
        {dashboard.isAuthorized(Permission.manage_global_users) && <Suspense><ProfileAccountControls person={person} /></Suspense>}
        {dashboard.isAuthorized(Permission.sysadmin) && <CMTabPanel selectedTabId={selected} handleTabChange={(_, value) => {
            if (!isProfileTab(value)) {
                return;
            }
            const uri = `/backstage/user/${person.publicId}/${slugify(person.name || "member")}/${value}`;
            void router.push(withMemberPresentation(uri, context), undefined, { shallow: true });
        }}>
            <CMTab thisTabId="attendance" summaryTitle="Attendance" summaryIcon={gIconMap.Check()}><UserAttendanceTabContent user={person} /></CMTab>
            <CMTab thisTabId="credits" summaryTitle="Credits" summaryIcon={gIconMap.Comment()}><UserCreditsTabContent user={person} /></CMTab>
            <CMTab thisTabId="wiki" summaryTitle="Wiki Contributions" summaryIcon={gIconMap.Article()}><UserWikiContributionsTabContent user={person} /></CMTab>
            <CMTab thisTabId="massAnalysis" summaryTitle={locale.getPlainString("membership.profile.analysis")} summaryIcon={gIconMap.Info()}><UserMassAnalysisTabContent user={person} /></CMTab>
        </CMTabPanel>}
    </>;
}


// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/core/components/user/UserDetail.tsx:1-209
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 13d736adf749cfcc285f5911a29bef5a658572f4b123f5e5a604012f10301f0e
// MIGRATION_REFERENCE_BEGIN
// import { Permission } from "@/shared/permissions";
// import getUserManagementCapabilities from "@/src/auth/queries/getUserManagementCapabilities";
// import { useQuery } from "@blitzjs/rpc";
// import { Alert } from "@mui/material";
// import React, { Suspense } from "react";
// import { StringToEnumValue } from "shared/utils";
// import * as DB3Client from "src/core/db3/DB3Client";
// import * as db3 from "src/core/db3/db3";
// import { gIconMap } from "../../db3/components/IconMap";
// import { CMChip, CMChipContainer, CMStandardDBChip } from "../CMChip";
// import { AdminInspectObject, CMButtonGroup, KeyValueTable } from "../CMCoreComponents2";
// import { CMTab, CMTabPanel } from "../TabPanel";
// import { StandardVariationSpec } from "../color/palette";
// import { useDashboardContext } from "../dashboardContext/DashboardContext";
// import { SongsProvider } from "../song/SongsContext";
// import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
// import { EditUserProfileButton } from "./EditUserProfileButton";
// import { UserAdminPanel } from "./UserAdminPanel";
// import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
// import { UserIdentityIndicator } from "./UserIdentityIndicator";
// import { EnrichedVerboseUser } from "./UserListItem";
// import { UserSignInMethodsButton } from "./UserSignInMethodsButton";
//
// export enum UserDetailTabSlug {
//     credits = "credits",
//     attendance = "attendance",
//     wiki = "wiki",
//     massAnalysis = "massAnalysis",
// };
//
//
// ////////////////////////////////////////////////////////////////
// export interface UserDetailArgs {
//     user: EnrichedVerboseUser;
//     tableClient: DB3Client.xTableRenderClient<typeof db3.userEditorView>;
//     readonly: boolean;
//     initialTab?: UserDetailTabSlug;
// }
//
// export const UserDetail = ({ user, tableClient, ...props }: UserDetailArgs) => {
//
//     const [capabilities, { refetch: refetchCapabilities }] = useQuery(
//         getUserManagementCapabilities,
//         { userId: user.publicId },
//     );
//
//
//     const dashboardContext = useDashboardContext();
//     const canViewBasicInfo = dashboardContext.isAuthorized(Permission.view_users_basic_info);
//     const canViewContactInfo = dashboardContext.isAuthorized(Permission.view_user_contact_info);
//     const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);
//     const canViewSignInMethods = dashboardContext.isAuthorized(Permission.sysadmin);
//
//     const [selectedTab, setSelectedTab] = React.useState<UserDetailTabSlug>(props.initialTab || UserDetailTabSlug.attendance);
//
//     const refetch = async () => {
//         await tableClient.refetch();
//         await refetchCapabilities();
//     };
//
//     const handleTabChange = (newId: string) => {
//         const slug = StringToEnumValue(UserDetailTabSlug, (newId || "").toString()) || UserDetailTabSlug.attendance;
//         setSelectedTab(slug);
//     }
//
//     return <div className="EventDetail contentSection event">
//         <div className='content'>
//             {canManageUsers && user.isDeleted && <Alert severity="warning">
//                 {capabilities.mergedIntoUserId != null
//                     ? <>This account was merged into <a href={`/backstage/user/${capabilities.mergedIntoUserId}`}>account #{capabilities.mergedIntoUserId}</a> and cannot be reactivated.</>
//                     : "This user account is deactivated."}
//             </Alert>}
//
//             <div className='titleLine'>
//                 <div className="titleText">
//                     <div className="titleLink">
//                         <span className='title'>{user.name}</span>
//                     </div>
//                 </div>
//
//                 <div className='flex-spacer'></div>
//
//                 <AdminInspectObject src={user} />
//
//             </div>{/* /title line */}
//
//             {canViewBasicInfo &&
//                 <CMChipContainer>
//                     {user.tags.map(tag => <CMStandardDBChip
//                         key={db3.xUserTagAssignment.getIdentity(tag)}
//                         size='small'
//                         model={tag.userTag}
//                         variation={StandardVariationSpec.Weak}
//                         getTooltip={(_) => tag.userTag.description}
//                     />)}
//                 </CMChipContainer>
//             }
//             {canViewBasicInfo &&
//                 <CMChipContainer>
//                     {user.instruments.map(tag => <CMStandardDBChip
//                         key={db3.xUserInstrument.getIdentity(tag)}
//                         size='small'
//                         model={{ ...tag.instrument, color: tag.instrument.functionalGroup.color }}
//                         variation={StandardVariationSpec.Weak}
//                         getTooltip={(_) => tag.instrument.description}
//                     />)}
//                 </CMChipContainer>
//             }
//
//             <CMButtonGroup>
//
//                 {canManageUsers && (
//                     <EditUserProfileButton
//                         readonly={props.readonly}
//                         tableClient={tableClient}
//                         user={user}
//                         onOK={refetch}
//                     />
//                 )}
//
//                 <UserAdminPanel
//                     user={user}
//                     refetch={refetch}
//                     capabilities={capabilities}
//                 />
//             </CMButtonGroup>
//
//             {canViewContactInfo &&
//                 <KeyValueTable data={{
//                     Phone: <CMChipContainer>
//                         {user.phone && <CMChip>{user.phone}</CMChip>}
//                         {!user.phone && <span>-</span>}
//                     </CMChipContainer>,
//                     Email: <>
//                         <CMChipContainer>
//                             <CMChip>{user.email}</CMChip>
//                         </CMChipContainer>
//                     </>,
//                 }} />
//             }
//
//             {canViewSignInMethods &&
//                 <KeyValueTable data={{
//                     Identity: <Suspense>
//                         <CMChipContainer>
//                             <UserIdentityIndicator user={user} />
//
//                             <CMButtonGroup>
//                                 {capabilities.canResetPassword && <AdminResetPasswordButton user={user} />}
//                                 {capabilities.canManageSignInMethods && <UserSignInMethodsButton user={user} onChanged={refetch} />}
//                             </CMButtonGroup>
//                         </CMChipContainer>
//                     </Suspense>,
//                 }} />
//             }
//
//             {dashboardContext.isAuthorized(Permission.sysadmin) && (
//
//                 <CMTabPanel
//                     selectedTabId={selectedTab}
//                     handleTabChange={(e, newId) => handleTabChange(newId as string)}
//                 >
//                     <CMTab
//                         enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
//                         thisTabId={UserDetailTabSlug.attendance}
//                         summaryTitle={"Attendance"}
//                         summaryIcon={gIconMap.Check()}
//                     >
//                         <Suspense fallback={<div className="lds-dual-ring"></div>}>
//                             <UserAttendanceTabContent user={user} />
//                         </Suspense>
//                     </CMTab>
//                     <CMTab
//                         enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
//                         thisTabId={UserDetailTabSlug.credits}
//                         summaryTitle={"Credits"}
//                         summaryIcon={gIconMap.Comment()}
//                     >
//                         <Suspense fallback={<div className="lds-dual-ring"></div>}>
//                             <SongsProvider>
//                                 <UserCreditsTabContent user={user} />
//                             </SongsProvider>
//                         </Suspense>
//                     </CMTab>
//                     <CMTab
//                         enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
//                         thisTabId={UserDetailTabSlug.wiki}
//                         summaryTitle={"Wiki Contributions"}
//                         summaryIcon={gIconMap.Article()}
//                     >
//                         <Suspense fallback={<div className="lds-dual-ring"></div>}>
//                             <UserWikiContributionsTabContent user={user} />
//                         </Suspense>
//                     </CMTab>
//                     <CMTab
//                         enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
//                         thisTabId={UserDetailTabSlug.massAnalysis}
//                         summaryTitle={"Mass Analysis"}
//                         summaryIcon={gIconMap.Info()}
//                     >
//                         <Suspense fallback={<div className="lds-dual-ring"></div>}>
//                             <UserMassAnalysisTabContent user={user} />
//                         </Suspense>
//                     </CMTab>
//                 </CMTabPanel>
//             )}
//         </div>
//     </div>;
// };
// MIGRATION_REFERENCE_END
