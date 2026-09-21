import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";

const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
    column.editable = false;
    column.renderForNewDialog = undefined;
    column.ApplyClientToPostClient = () => { };
    return column;
};

const MainContent = () => {
    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xFile,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            fileLeafName: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
            storedLeafName: columnName => makeDisplayOnlyColumn(new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 })),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 150 }),
            uploadedAt: columnName => makeDisplayOnlyColumn(new DB3Client.CreatedAtColumn({ columnName, cellWidth: 150 })),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
            sizeBytes: columnName => makeDisplayOnlyColumn(new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 })),
            customData: columnName => makeDisplayOnlyColumn(new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 })),

            uploadedByUser: columnName => makeDisplayOnlyColumn(new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, })),
            visiblePermission: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, }),

            tags: columnName => new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedUsers: columnName => new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedSongs: columnName => new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedEvents: columnName => new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedInstruments: columnName => new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedWikiPages: columnName => new DB3Client.TagsFieldClient<db3.FileWikiPageTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
        },
    });

    return <>
        <SettingMarkdown setting="EditFilesPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.fileEditorView}
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
