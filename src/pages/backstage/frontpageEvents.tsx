import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { sortEvents } from "@/src/core/db3/shared/apiTypes";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from 'react';
import type { DateTimeRange } from "shared/time";
import { gQueryOptions } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { EventSearchItemContainer } from "src/core/components/event/EventComponents";
import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
import { EventFrontpageTabContent } from "src/core/components/event/EventFrontpageComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

// same thing but has a valid daterange
type ReadyEventFrontpageClient = db3.EventFrontpageClient & {
    dateRange: DateTimeRange;
};

const isEventFrontpageReady = (
    event: db3.EventFrontpageClient,
): event is ReadyEventFrontpageClient => (
    event.dateRange !== undefined
    // && event.name !== undefined
    // && event.locationDescription !== undefined
    // && event.tags !== undefined
    // && event.frontpageVisible !== undefined
    // && event.frontpageDate !== undefined
    // && event.frontpageTime !== undefined
    // && event.frontpageDetails !== undefined
    // && event.frontpageTitle !== undefined
    // && event.frontpageLocation !== undefined
    // && event.frontpageLocationURI !== undefined
    // && event.frontpageTags !== undefined
    // && event.frontpageDate_nl !== undefined
    // && event.frontpageTime_nl !== undefined
    // && event.frontpageDetails_nl !== undefined
    // && event.frontpageTitle_nl !== undefined
    // && event.frontpageLocation_nl !== undefined
    // && event.frontpageLocationURI_nl !== undefined
    // && event.frontpageTags_nl !== undefined
    // && event.frontpageDate_fr !== undefined
    // && event.frontpageTime_fr !== undefined
    // && event.frontpageDetails_fr !== undefined
    // && event.frontpageTitle_fr !== undefined
    // && event.frontpageLocation_fr !== undefined
    // && event.frontpageLocationURI_fr !== undefined
    // && event.frontpageTags_fr !== undefined
);

const EventsList = () => {

    const dashboardContext = useDashboardContext();


    const tableParams: db3.EventTableParams = {
        forFrontPageAgenda: true,
    };

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: DB3Client.defineTableClientSpec({
            view: db3.eventFrontpageView,
            columns: DB3Client.makeClientColumnSelection(EventTableClientColumns.id),
        }),
        filterModel: {
            tableParams,
        },
        paginationModel: {
            page: 0,
            pageSize: 20,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        queryOptions: gQueryOptions.liveData,
        referenceProvider: dashboardContext.referenceStore,
    });

    const readyEvents = eventsClient.items.filter(isEventFrontpageReady);
    const events = sortEvents(readyEvents.map(event => ({
        event,
        startsAt: event.dateRange.getSpec().startsAtDateTime,
    }))).map(item => item.event);

    const refetch = eventsClient.refetch;

    return <>{events.length < 1 ? "Nothing here!" : <>
        {events.map(event => {
            return <EventSearchItemContainer
                key={event.id}
                event={event}
                fadePastEvents={false}
                hideTagsWhenCancelled={false}
                showVisibility
                refetch={refetch}
            >
                <EventFrontpageTabContent
                    readonly={false}
                    refetch={refetch}
                    event={event}
                    dateRange={event.dateRange}
                />
            </EventSearchItemContainer>;
        }
        )}
    </>}
    </>;
};

const MainContent = () => {
    return <div>
        <Suspense>
            <SettingMarkdown setting="FrontpageAgendaPage_markdown"></SettingMarkdown>
        </Suspense>

        <Suspense>
            <EventsList />
        </Suspense>
    </div>;
};

const FrontpageAgendaPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Homepage Agenda">
            <AppContextMarker name="FrontpageAgendaPage">
                <MainContent />
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default FrontpageAgendaPage;
