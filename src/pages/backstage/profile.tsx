import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { BandMemberProfile } from "src/core/components/user/BandMemberProfile";
import { ProfilePageIdentityControl } from "src/core/components/user/UserIdentityIndicator";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

function ProfileContent() {
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const personId = presentation.data?.authorization.userPublicId;
    return <>
        <LocalizedMarkdown setting="profile_markdown" />
        <LocalizedMarkdown setting="profile_description_markdown" />
        {personId && <BandMemberProfile personId={personId} />}
        {dashboard.isAuthorized(Permission.sysadmin) && personId && <ProfilePageIdentityControl userId={personId} />}
        <CalendarUserSettingsControl />
    </>;
}

const ProfilePage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.profile.title")}>
        <Suspense><ProfileContent /></Suspense>
    </DashboardLayout>;
};
export default ProfilePage;


// MIGRATION_RESTORE: member-profile
// Source: 1768352278c2ac37768c8bd2c2cc0ad5ffd4324a:src/pages/backstage/profile.tsx:1-125
// Reason: The basic membership profile no longer routes through the complete user-detail workflow.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 5680d80100e1e2e1b4f1cc1677ba41bf9c4be0a4c40fc224f895db52a055bfd0
// MIGRATION_REFERENCE_BEGIN
// import { TAnyModel } from "@/shared/rootroot";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext, useFeatureRecorder, useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// import { ProfilePageIdentityControl } from "@/src/core/components/user/UserIdentityIndicator";
// import { Permission } from "@/shared/permissions";
// import { OwnInstrumentsControl } from "@/src/core/components/user/UserInstruments";
// import { BlitzPage } from "@blitzjs/next";
// import React, { Suspense } from "react";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
// import { NameValuePair } from "src/core/components/CMCoreComponents2";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { SnackbarContext } from "src/core/components/SnackbarContext";
// import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
// import * as DB3Client from "src/core/db3/DB3Client";
// import { gIconMap } from "src/core/db3/components/IconMap";
// import { DB3EditRowButton, DB3EditRowButtonAPI, DB3RowViewer } from "src/core/db3/components/db3NewObjectDialog";
// import * as db3 from "src/core/db3/db3";
//
//
//
// const MainContent = () => {
//     const dashboardContext = useDashboardContext();
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
//     const recordFeature = useFeatureRecorder();
//
//     useRecordFeatureUse({
//         feature: ActivityFeature.profile_view,
//     });
//
//     const spec = DB3Client.defineTableClientSpec({
//         view: db3.userEditorView,
//         columns: {
//             name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 160 }),
//             email: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
//             phone: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
//             tags: columnName => new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false, selectionView: db3.userTagEditorView }),
//             publicId: DB3Client.publicIdFieldGen(),
//         },
//     });
//
//     const client = DB3Client.useCrudTableRenderContext({
//         view: db3.userEditorView,
//         tableSpec: spec,
//         filterModel: {
//             publicIds: dashboardContext.currentUser ? [dashboardContext.currentUser.publicId] : []
//         },
//     });
//     const editCommands = DB3Client.useCrudViewCommands({
//         view: db3.userEditorView,
//         tableClient: client,
//     });
//
//     //const value = client.items[0]! as db3.UserPayload;
//
//     const handleSave = async (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
//         void recordFeature({
//             feature: ActivityFeature.profile_edit,
//         });
//         try {
//             // DB3EditRowButton still exposes a legacy untyped draft callback;
//             // the backing client/view prove the expected hydrated row type.
//             await editCommands.update(
//                 updateObj as db3.ClientOf<typeof db3.userEditorView>,
//                 client.items[0]!,
//             );
//             showSnackbar({ severity: "success", children: "updated" });
//         } catch (error) {
//             console.log(error);
//             showSnackbar({ severity: "error", children: "error updating" });
//         } finally {
//             await dashboardContext.refetchDashboardData();
//             api.closeDialog();
//         }
//     };
//
//     return <>
//         <LocalizedMarkdown setting="profile_markdown"></LocalizedMarkdown>
//         <CMSinglePageSurfaceCard className="surface2">
//             <div className="header">
//                 <h1>
//                     {gIconMap.Person()} Your profile
//                 </h1>
//             </div>
//
//             <div className="content">
//                 <LocalizedMarkdown setting="profile_description_markdown" />
//
//                 <NameValuePair isReadOnly={false} name="Your instruments" value={<OwnInstrumentsControl />} />
//
//                 {client.items.length === 1 && (
//                     <>
//                         <DB3EditRowButton row={client.items[0]!} tableRenderClient={client} onSave={handleSave} label={"Edit your profile"} />
//                         <DB3RowViewer tableRenderClient={client} row={client.items[0]!} />
//                     </>
//                 )}
//
//                 <Suspense>
//                     {dashboardContext.isAuthorized(Permission.sysadmin) && dashboardContext.currentUser?.publicId
//                         && <ProfilePageIdentityControl userId={dashboardContext.currentUser.publicId} />}
//                 </Suspense>
//
//             </div>
//         </CMSinglePageSurfaceCard>
//         <CMSinglePageSurfaceCard className="surface2">
//             <div className="header"><h2>Preferences</h2></div>
//             <div className="content"><CalendarUserSettingsControl /></div>
//         </CMSinglePageSurfaceCard>
//     </>;
// };
//
//
//
// const ProfilePage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Your profile">
//             <AppContextMarker name="profile page">
//                 <MainContent />
//             </AppContextMarker>
//         </DashboardLayout>
//     )
// }
//
// export default ProfilePage;
// MIGRATION_REFERENCE_END
