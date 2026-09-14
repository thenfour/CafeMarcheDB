import { TAnyModel } from "@/shared/rootroot";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext, useFeatureRecorder, useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { ProfilePageIdentityControl } from "@/src/core/components/user/UserIdentityIndicator";
import { OwnInstrumentsControl } from "@/src/core/components/user/UserInstruments";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "src/core/db3/components/IconMap";
import { DB3EditRowButton, DB3EditRowButtonAPI, DB3RowViewer } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";



const MainContent = () => {
    const dashboardContext = useDashboardContext();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();

    useRecordFeatureUse({
        feature: ActivityFeature.profile_view,
    });

    const spec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const client = DB3Client.useTableRenderContext({
        tableSpec: spec,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        filterModel: {
            items: [{ field: "id", value: dashboardContext.currentUser?.id || -1, operator: "equals" }]
        },
    });

    const value = client.items[0]! as db3.UserPayload;

    const handleSave = (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.profile_edit,
        });
        client.doUpdateMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating" });
        }).finally(async () => {
            client.refetch();
            dashboardContext.refetchDashboardData();
            api.closeDialog();
        });
    };

    return <>
        <SettingMarkdown setting="profile_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard className="surface2">
            <div className="header">
                <h1>
                    {gIconMap.Person()} Your profile
                </h1>
            </div>

            <div className="content">
                <SettingMarkdown setting="profile_description_markdown" />

                <NameValuePair isReadOnly={false} name="Your instruments" value={<OwnInstrumentsControl />} />

                {client.items.length === 1 && (
                    <>
                        <DB3EditRowButton row={client.items[0]!} tableRenderClient={client} onSave={handleSave} label={"Edit your profile"} />
                        <DB3RowViewer tableRenderClient={client} row={client.items[0]!} />
                    </>
                )}

                <Suspense>
                    {dashboardContext.currentUser?.id && <ProfilePageIdentityControl userId={dashboardContext.currentUser.id} />}
                </Suspense>

            </div>
        </CMSinglePageSurfaceCard>
        <CMSinglePageSurfaceCard className="surface2">
            <div className="header"><h2>Preferences</h2></div>
            <div className="content"><CalendarUserSettingsControl /></div>
        </CMSinglePageSurfaceCard>
    </>;
};



const ProfilePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Your profile">
            <AppContextMarker name="profile page">
                <MainContent />
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default ProfilePage;
