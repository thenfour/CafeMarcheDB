import { BlitzPage } from "@blitzjs/next";
import React from 'react';
import { Permission } from "shared/permissions";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFile,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "fileLeafName", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "storedLeafName", cellWidth: 150 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
            new DB3Client.CreatedAtColumn({ columnName: "uploadedAt", cellWidth: 150 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sizeBytes", cellWidth: 80 }),
            new DB3Client.GenericStringColumnClient({ columnName: "customData", cellWidth: 150 }),

            new DB3Client.ForeignSingleFieldClient({ columnName: "uploadedByUser", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, }),

            new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName: "taggedUsers", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName: "taggedSongs", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName: "taggedEvents", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({ columnName: "taggedInstruments", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileWikiPageTagPayload>({ columnName: "taggedWikiPages", cellWidth: 150, allowDeleteFromCell: false }),
        ],
    });

    return <>
        <SettingMarkdown setting="EditFilesPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
        />
    </>;
};


const EditFilesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Files" basePermission={Permission.admin_files}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFilesPage;
