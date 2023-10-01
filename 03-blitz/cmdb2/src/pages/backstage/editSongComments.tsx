import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";



// new PKField({ columnName: "id" }),
// new GenericStringField({
//     columnName: "text",
//     allowNull: false,
//     format: "plain",
// }),
// new ForeignSingleField<Prisma.UserGetPayload<{}>>({
//     columnName: "user",
//     fkMember: "userId",
//     allowNull: false,
//     foreignTableSpec: xUser,
//     getQuickFilterWhereClause: (query: string) => false,
// }),

// new ForeignSingleField<Prisma.PermissionGetPayload<{}>>({
//     columnName: "visiblePermission",
//     fkMember: "visiblePermissionId",
//     allowNull: true,
//     foreignTableSpec: xPermission,
//     getQuickFilterWhereClause: (query) => false,
// }),

// new ForeignSingleField<Prisma.SongGetPayload<{}>>({
//     columnName: "song",
//     fkMember: "songId",
//     allowNull: false,
//     foreignTableSpec: xSong,
//     getQuickFilterWhereClause: (query: string) => false,
// }),
// MakeCreatedAtField("createdAt"),
// new DateTimeField({
//     columnName: "updatedAt",
//     allowNull: true,
//     granularity: "minute",
// }),

const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xSongComment,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "text", cellWidth: 200 }),
        new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 180 }),
        new DB3Client.DateTimeColumn({ columnName: "updatedAt", cellWidth: 180 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "song", cellWidth: 120 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
    ],
});

const MainContent = () => {
    if (!useAuthorization("EditSongCommentsPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));
    return <>
        <SettingMarkdown settingName="EditSongCommentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
        />
    </>;
};


const EditSongCommentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song Comments">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongCommentsPage;
