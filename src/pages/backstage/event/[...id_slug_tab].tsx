import { BlitzPage, useParams } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, IsEntirelyIntegral } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NavRealm } from "src/core/components/Dashboard2";
import { EventBreadcrumbs, EventDetailFull, EventTableClientColumns, gEventDetailTabSlugIndices } from "src/core/components/EventComponents";
import { NewEventButton } from "src/core/components/NewEventComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";

const MyComponent = ({ eventId }: { eventId: null | number }) => {
    const params = useParams();
    const [id__, slug, tab] = params.id_slug_tab as string[];
    const dashboardContext = React.useContext(DashboardContext);

    //if (!idOrSlug) return <div>no event specified</div>;
    if (!eventId) throw new Error(`song not found`);

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
                //EventTableClientColumns.segmentBehavior,
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

    queryArgs.filterModel!.tableParams!.eventId = eventId;

    let initialTabIndex: undefined | number = undefined;
    if (!!tab) {
        initialTabIndex = gEventDetailTabSlugIndices[tab] || 0;
    }

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    const eventRaw = tableClient.items[0]! as db3.EventClientPayload_Verbose;
    const event = db3.enrichSearchResultEvent(eventRaw, dashboardContext);

    return <div className="eventDetailComponent">
        <NewEventButton onOK={() => { }} />
        {event ? <>
            <EventBreadcrumbs event={event} />
            <EventDetailFull readonly={false} event={event} tableClient={tableClient} initialTabIndex={initialTabIndex} />
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

export const getServerSideProps = async ({ params }) => {
    const [id__, slug, tab] = params.id_slug_tab as string[];
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
        },
        where: {
            id,
        }
    });
    if (event) {
        ret.props.title = `${event.name}`;
        ret.props.eventId = event.id;
    }

    return ret;
}



const EventDetailPage: BlitzPage = (props: PageProps) => {
    return (
        <DashboardLayout title={props.title} navRealm={NavRealm.events} basePermission={Permission.view_events_nonpublic}>
            <Suspense>
                <MyComponent eventId={props.eventId}></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default EventDetailPage;
