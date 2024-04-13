import { BlitzPage, useParams } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { IsEntirelyIntegral } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NavRealm } from "src/core/components/Dashboard2";
import { EventBreadcrumbs, EventDetail, EventTableClientColumns, gEventDetailTabSlugIndices } from "src/core/components/EventComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

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
                EventTableClientColumns.id,
                EventTableClientColumns.name,
                EventTableClientColumns.slug,
                EventTableClientColumns.locationDescription,
                EventTableClientColumns.locationURL,
                EventTableClientColumns.segmentBehavior,
                EventTableClientColumns.type,
                EventTableClientColumns.status,
                EventTableClientColumns.tags,
                EventTableClientColumns.expectedAttendanceUserTag,
                EventTableClientColumns.visiblePermission,
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
            <EventDetail verbosity="verbose" readonly={false} event={event} tableClient={tableClient} initialTabIndex={initialTabIndex} isOnlyEventVisible={true} allowRouterPush={true} />
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
