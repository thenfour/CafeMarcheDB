import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import { useRouter } from "next/router";
import db from "db";
import type { EventPublicId } from "shared/publicId";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { gSSP } from "src/blitz-server";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { useDashboardContext, useRecordFeatureUse } from "src/core/components/dashboardContext/DashboardContext";
import { AppContextMarker } from "src/core/components/AppContext";
import { EventBreadcrumbs, EventDetailFull } from "src/core/components/event/EventComponents";
import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
import { NewEventButton } from "src/core/components/event/NewEventComponents";
import { ActivityFeature } from "src/core/components/featureReports/activityTracking";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { readEventDetailPage } from "src/core/db3/server/eventDetailPage";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { useLocale } from "src/locale/components/useLocale";

interface PageProps { readonly title: string; readonly eventId: EventPublicId }

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = pagePresentationInput(query, req.headers["accept-language"]);
    if (!db3.xEvent.isIdentity(identity) || !input.bandPublicId) {
        return { notFound: true };
    }
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    const result = await readEventDetailPage(db, auth, input, db3.xEvent.parseIdentity(identity));
    return result ? { props: result } : { notFound: true };
});

const EventDetailContent = ({ eventId }: Pick<PageProps, "eventId">) => {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const router = useRouter();
    const path = router.query.id_slug_tab;
    const tab = Array.isArray(path) ? path[2] : undefined;
    useRecordFeatureUse({ feature: ActivityFeature.event_view, eventId });

    const tableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: DB3Client.defineTableClientSpec({
            view: db3.eventDetailView,
            columns: DB3Client.makeClientColumnSelection(
                EventTableClientColumns.name,
                EventTableClientColumns.locationDescription,
                EventTableClientColumns.locationURL,
                EventTableClientColumns.type,
                EventTableClientColumns.status,
                EventTableClientColumns.tags,
                EventTableClientColumns.expectedAttendanceUserTag,
                EventTableClientColumns.visiblePermission,
            ),
        }),
        filterModel: { tableParams: { eventId } },
        referenceProvider: dashboard.referenceStore,
        queryOptions: { staleTime: 0, cacheTime: 0, keepPreviousData: false },
    });
    const event = tableClient.items[0];
    return <div className="eventDetailComponent">
        <NewEventButton />
        {event ? <>
            <EventBreadcrumbs event={event} />
            <EventDetailFull
                event={event}
                tableClient={tableClient}
                readonly={false}
                initialTabIndex={tab}
                refetch={tableClient.refetch}
            />
        </> : <p>{locale.getPlainString("events.detailUnavailable")}</p>}
    </div>;
};

const EventDetailPage: BlitzPage<PageProps> = ({ title, eventId }) => {
    return <DashboardLayout title={title} navRealm={NavRealm.events}>
        <AppContextMarker name="event page" eventId={eventId}>
            <Suspense><EventDetailScope eventId={eventId} /></Suspense>
            <div style={{ height: "65vh" }} />
        </AppContextMarker>
    </DashboardLayout>;
};
const EventDetailScope = ({ eventId }: Pick<PageProps, "eventId">) => {
    const dashboard = useDashboardContext();
    return <EventDetailContent key={`${dashboard.authorizationContext?.bandPublicId}:${eventId}`} eventId={eventId} />;
};
export default EventDetailPage;
