import { BlitzPage, useParams } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Breadcrumbs, Link, Typography } from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';
import { EventBreadcrumbs, EventDetail, gEventDetailTabSlugIndices } from "src/core/components/EventComponents";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { IsEntirelyIntegral } from "shared/utils";
import { Suspense } from "react";

const MyComponent = () => {
    const params = useParams();
    const [idOrSlug, tabIdOrSlug] = params.idOrSlug_tab as string[];

    if (!idOrSlug) return <div>not found</div>;

    if (!useAuthorization(`event page: ${idOrSlug}`, Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
        clientIntention: { intention: "user", mode: 'primary' },
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {}
        }
    };

    if (IsEntirelyIntegral(idOrSlug)) {
        queryArgs.filterModel!.tableParams!.eventId = parseInt(idOrSlug);
    } else {
        queryArgs.filterModel!.tableParams!.eventSlug = params.idOrSlug;
    }

    let initialTabIndex: undefined | number = undefined;
    if (tabIdOrSlug) {
        if (IsEntirelyIntegral(tabIdOrSlug)) {
            initialTabIndex = parseInt(tabIdOrSlug);
        } else {
            initialTabIndex = gEventDetailTabSlugIndices[tabIdOrSlug];
        }
    }

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    const event = tableClient.items[0]! as db3.EventClientPayload_Verbose;

    return <div>
        {event && <>
            <EventBreadcrumbs event={event} />
            <EventDetail verbosity="verbose" event={event} tableClient={tableClient} initialTabIndex={initialTabIndex} allowRouterPush={true} />
        </>}
    </div>;
};


const EventDetailPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event">
            <Suspense>
                <MyComponent></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default EventDetailPage;