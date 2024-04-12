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

const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
    const router = useRouter();
    return <>
        <Button onClick={() => {
            void router.push({
                pathname: '/backstage/editEventSegments',
                query: { eventId: gridArgs.row.id },
            });
        }}>Segments</Button>
        <Button onClick={() => {
            void router.push({
                pathname: '/backstage/editEventSongLists',
                query: { eventId: gridArgs.row.id },
            });
        }}>Song lists</Button>
    </>;
};

const MainContent = () => {

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150 }),
            new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
            new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 150 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150 }),
            new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
            new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ConstEnumStringFieldClient({ columnName: "segmentBehavior", cellWidth: 220 }),
            new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),

            new DB3Client.BoolColumnClient({ columnName: "frontpageVisible" }),
            new DB3Client.GenericStringColumnClient({ columnName: "frontpageDate", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "frontpageTime", cellWidth: 150 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "frontpageDetails", cellWidth: 150 }),

            new DB3Client.GenericStringColumnClient({ columnName: "frontpageTitle", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocation", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocationURI", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "frontpageTags", cellWidth: 150 }),

        ],
    });

    if (!useAuthorization("EditEventsPage", Permission.admin_events)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown setting="editEvents_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            renderExtraActions={(args) => {
                return <ExtraActions gridArgs={args} />
            }}
        />
    </>;
};


const EditEventsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventsPage;
