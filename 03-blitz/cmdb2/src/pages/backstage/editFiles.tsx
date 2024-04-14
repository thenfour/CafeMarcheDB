import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { useRouter } from "next/router";


const MainContent = () => {
    if (!useAuthorization("EditFilesPage", Permission.admin_files)) {
        throw new Error(`unauthorized`);
    }


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
        <DashboardLayout title="Files">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFilesPage;
