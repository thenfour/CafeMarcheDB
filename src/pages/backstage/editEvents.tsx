import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { useRouter } from "next/router";
import { pickFromObject } from "shared/utils";
import { EventTableClientColumns } from "src/core/components/EventComponents";
import React from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";

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
    const dashboardContext = React.useContext(DashboardContext);
    if (!dashboardContext.isAuthorized(Permission.admin_events)) {
        throw new Error(`unauthorized`);
    }

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            EventTableClientColumns.id,
            EventTableClientColumns.name,
            EventTableClientColumns.dateRange,
            EventTableClientColumns.slug,
            EventTableClientColumns.description,
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
        ],
    });

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
