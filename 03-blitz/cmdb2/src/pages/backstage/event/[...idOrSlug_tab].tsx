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
import { InspectObject } from "src/core/components/CMCoreComponents";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NavRealm } from "src/core/components/Dashboard2";

const MyComponent = () => {
    const params = useParams();
    const [idOrSlug, tabIdOrSlug] = params.idOrSlug_tab as string[];

    if (!idOrSlug) return <div>no event specified</div>;

    if (!useAuthorization(`event page: ${idOrSlug}`, Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser: currentUser,
    };

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                // these fields are used by the edit dialog.
                new DB3Client.PKColumnClient({ columnName: "id" }),
                //new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
                new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150 }),
                new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 150 }),
                //new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
                //new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
                new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150 }),
                new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150 }),
                //new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
                new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
                new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
                //new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
                new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
                //new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
                new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
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
        queryArgs.filterModel!.tableParams!.eventSlug = idOrSlug;
    }

    let initialTabIndex: undefined | number = undefined;
    if (tabIdOrSlug) {
        if (IsEntirelyIntegral(tabIdOrSlug)) {
            initialTabIndex = parseInt(tabIdOrSlug);
        } else {
            initialTabIndex = gEventDetailTabSlugIndices[tabIdOrSlug];
        }
    }

    // const where = await db3.xEventVerbose.CalculateWhereClause({
    //     clientIntention,
    //     filterModel: queryArgs.filterModel!,
    // });

    //console.log(`[[[ calling calculateInclude`);
    // const include = db3.xEventVerbose.CalculateInclude(clientIntention);
    // console.log(`]]] calling calculateInclude`);

    //console.log(`filtermodel: ${JSON.stringify(queryArgs.filterModel)}, params:${JSON.stringify(params)}, idOrSlug:${idOrSlug}, tabIdOrSlug:${tabIdOrSlug}`);

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    const event = tableClient.items[0]! as db3.EventClientPayload_Verbose;

    return <div>
        {/* <InspectObject src={where || {}} tooltip="where" /> */}
        {/* <InspectObject src={include} tooltip="include" /> */}
        {event ? <>
            <EventBreadcrumbs event={event} />
            <EventDetail verbosity="verbose" event={event} tableClient={tableClient} initialTabIndex={initialTabIndex} allowRouterPush={true} />
        </> : <>
            no event was found. some possibilities:
            <ul>
                <li>the event was deleted or you don't have permission to view it</li>
                <li>the event's slug (title) or ID changed.</li>
            </ul>
        </>}
    </div>;
};


const EventDetailPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event" navRealm={NavRealm.events}>
            <Suspense>
                <MyComponent></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default EventDetailPage;
