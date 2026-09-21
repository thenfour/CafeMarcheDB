import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { parseIntOrNull } from "shared/utils";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const songId: number | null = parseIntOrNull(urlParams.get('songId'));

    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xSongCredit,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            user: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, }),
            song: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, }),
            type: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, }),
        },
    });

    return <>
        <SettingMarkdown setting="EditSongCreditsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.songCreditEditorView}
            tableParams={{ songId }}
        />
    </>;
};


const EditSongCreditsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song credits">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongCreditsPage;
