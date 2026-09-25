import { CMButton } from "@/src/core/components/CMCoreComponents2";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "@components/dashboard/DashboardLayout";
import { EventTableClientColumns } from "@components/event/EventComponentsBase";
import { SettingMarkdown } from "@components/SettingMarkdown";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "@db3/components/db3DataGrid";
import * as db3 from "@db3/db3";
import * as DB3Client from "@db3/DB3Client";
import { useRouter } from "next/router";

type EventEditorClient = db3.ClientOf<typeof db3.eventEditorView>;

const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs<EventEditorClient> }) => {
    const router = useRouter(); return <>
        <CMButton onClick={() => {
            void router.push({
                pathname: '/backstage/editEventSegments',
                query: { eventId: gridArgs.row.publicId },
            });
        }}>Segments</CMButton>
        <CMButton onClick={() => {
            void router.push({
                pathname: '/backstage/editEventSongLists',
                query: { eventId: gridArgs.row.publicId },
            });
        }}>Song lists</CMButton>
    </>;
};

const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.eventEditorView,
        columns: DB3Client.makeClientColumnSelection(
            EventTableClientColumns.name,
            EventTableClientColumns.startsAt,
            //EventTableClientColumns.description,
            EventTableClientColumns.isDeleted,
            EventTableClientColumns.locationDescription,
            EventTableClientColumns.locationURL,
            EventTableClientColumns.createdAt,
            EventTableClientColumns.type,
            EventTableClientColumns.status,
            EventTableClientColumns.tags,
            EventTableClientColumns.segmentBehavior,
            EventTableClientColumns.expectedAttendanceUserTag,
            EventTableClientColumns.createdByUser,
            EventTableClientColumns.visiblePermission,
            EventTableClientColumns.frontpageVisible,
            EventTableClientColumns.frontpageDate,
            EventTableClientColumns.frontpageTime,
            EventTableClientColumns.frontpageDetails,
            EventTableClientColumns.frontpageTitle,
            EventTableClientColumns.frontpageLocation,
            EventTableClientColumns.frontpageLocationURI,
            EventTableClientColumns.frontpageTags,
        ),
    });

    return <>
        <SettingMarkdown setting="editEvents_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.eventEditorView}
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
