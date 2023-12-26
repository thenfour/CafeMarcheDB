import { BlitzPage, useParam, useParams } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    if (!useAuthorization("EditSongCreditsPage", Permission.admin_songs)) {
        throw new Error(`unauthorized`);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const songId: number | null = parseIntOrNull(urlParams.get('songId'));

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSongCredit,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "song", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "type", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    return <>
        <SettingMarkdown settingName="EditSongCreditsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
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
