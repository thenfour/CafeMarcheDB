import { BlitzPage, useParams } from "@blitzjs/next";
import db from "db";
import { GetServerSideProps } from 'next';
import React, { Suspense } from 'react';
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { DashboardContext, useRecordFeatureUse } from "src/core/components/DashboardContext";
import { EventBreadcrumbs, EventDetailFull, gEventDetailTabSlugIndices } from "src/core/components/event/EventComponents";
import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
import { NewEventButton } from "@/src/core/components/event/NewEventComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";

const MyComponent = ({ eventId }: { eventId: null | number }) => {
    const params = useParams();
    const [id__, slug, tab] = params.id_slug_tab as string[];
    const dashboardContext = React.useContext(DashboardContext);
    const [workflowRefreshTrigger, setWorkflowRefreshTrigger] = React.useState<number>(0);

    //if (!idOrSlug) return <div>no event specified</div>;
    if (!eventId) throw new Error(`song not found`);

    useRecordFeatureUse({ feature: ActivityFeature.event_view, eventId });

    const currentUser = dashboardContext.currentUser;
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser,
    };

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                EventTableClientColumns.id,
                EventTableClientColumns.name,
                EventTableClientColumns.locationDescription,
                EventTableClientColumns.type,
                EventTableClientColumns.status,
                EventTableClientColumns.tags,
                EventTableClientColumns.expectedAttendanceUserTag,
                EventTableClientColumns.visiblePermission,
                EventTableClientColumns.workflowDef,
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {}
        }
    };

    queryArgs.filterModel!.tableParams!.eventId = eventId;

    let initialTabIndex: string = "";
    if (!!tab && gEventDetailTabSlugIndices[tab]) {
        initialTabIndex = gEventDetailTabSlugIndices[tab];
    }

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    const eventRaw = tableClient.items[0]! as db3.EventClientPayload_Verbose;
    const event = eventRaw ? db3.enrichSearchResultEvent(eventRaw, dashboardContext) : null;

    const refetch = () => {
        tableClient.refetch();
    };

    React.useEffect(() => {
        setWorkflowRefreshTrigger(workflowRefreshTrigger + 1);
    }, [tableClient.queryResultInfo.resultId]);

    return <div className="eventDetailComponent">
        <NewEventButton />
        {event ? <>
            <EventBreadcrumbs event={event} />
            <EventDetailFull
                readonly={false}
                event={event}
                tableClient={tableClient}
                initialTabIndex={initialTabIndex}
                workflowRefreshTrigger={workflowRefreshTrigger}
                refetch={refetch}
            />
        </> : <>
            no event was found. some possibilities:
            <ul>
                <li>the event was deleted or you don't have permission to view it</li>
                <li>the event's slug (title) or ID changed.</li>
            </ul>
        </>}
    </div>;
};



interface PageProps {
    title: string,
    eventId: number | null,
};

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
    const [id__, slug, tab] = params!.id_slug_tab as string[];
    const id = CoerceToNumberOrNull(id__);
    if (!id) throw new Error(`no id`);

    const ret: { props: PageProps } = {
        props: {
            title: "Event",
            eventId: null,
        }
    };
    const event = await db.event.findFirst({
        select: {
            id: true,
            name: true,
            startsAt: true,
            segments: {
                select: {
                    startsAt: true,
                    statusId: true,
                }
            }
        },
        where: {
            id,
        }
    });

    const statuses = await db.eventStatus.findMany();
    const cancelledStatusIds = db3.getCancelledStatusIds(statuses);
    const isCancelled = (statusId: number | null) => {
        if (!statusId) return false;
        return cancelledStatusIds.includes(statusId);
    }

    if (event) {
        // Format the date using the user's locale
        const acceptLanguage = req.headers['accept-language'] || 'en-US'; // Default to 'en-US' if not specified
        const locale = acceptLanguage.split(',')[0]; // Get the first preferred language
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

        // skip cancelled segments
        const validSegmentsSorted = toSorted(
            event.segments
                .filter(s => !isCancelled(s.statusId)),
            (a, b) => db3.compareEventSegments(a, b, cancelledStatusIds));
        if (!validSegmentsSorted.length) {
            ret.props.title = `${event.name}`;
        } else {
            const seg = validSegmentsSorted[0]!;
            let formattedDate = seg.startsAt ? seg.startsAt.toLocaleDateString(locale, options) : "TBD";
            ret.props.title = `${event.name} | ${formattedDate}`;
        }

        ret.props.eventId = event.id;
    }

    return ret;
}



const EventDetailPage: BlitzPage = (props: PageProps) => {
    return (
        <DashboardLayout title={props.title} navRealm={NavRealm.events} basePermission={Permission.view_events_nonpublic}>
            <AppContextMarker name="event page" eventId={props.eventId || undefined}>
                <Suspense>
                    <MyComponent eventId={props.eventId}></MyComponent>
                </Suspense>
                {/* this helps prevent annoying scroll behavior when switching tabs */}
                <div style={{ height: "65vh" }}></div>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default EventDetailPage;
