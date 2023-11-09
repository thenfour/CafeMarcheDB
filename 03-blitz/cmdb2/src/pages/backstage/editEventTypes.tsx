import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MainContent = () => {
    if (!useAuthorization("EditEventTypesPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventType,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "text", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 120 }),
            new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120 }),
        ],
    });

    return <>
        <SettingMarkdown settingName="EditEventTypesPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};


const EditEventTypesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Types">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventTypesPage;
