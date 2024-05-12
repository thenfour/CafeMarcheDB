import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from 'react';


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEventStatus,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "label", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 120 }),
        new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120 }),
    ],
});


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);
    return <>
        <SettingMarkdown setting="EditEventStatusesPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};


const EditEventStatusesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Statuses" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventStatusesPage;
