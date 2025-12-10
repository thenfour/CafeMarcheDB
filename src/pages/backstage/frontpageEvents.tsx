import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { sortEvents } from "@/src/core/db3/shared/apiTypes";
import { enrichSearchResultEvent } from "@/src/core/db3/shared/schema/enrichedEventTypes";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { gQueryOptions } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { AppContextMarker } from "src/core/components/AppContext";
import { EventDetailContainer } from "src/core/components/event/EventComponents";
import { CalculateEventMetadata_Verbose } from "src/core/components/event/EventComponentsBase";
import { EventFrontpageTabContent } from "src/core/components/event/EventFrontpageComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const EventsList = () => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const dashboardContext = useDashboardContext();
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const tableParams: db3.EventTableParams = {
        forFrontPageAgenda: true,
    };

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        filterModel: {
            items: [],
            tableParams,
        },
        paginationModel: {
            page: 0,
            pageSize: 20,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,// | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    const eventsRaw = eventsClient.items as db3.EventClientPayload_Verbose[];
    const eventsRich = eventsRaw.map(e => enrichSearchResultEvent(e, dashboardContext));

    const events = sortEvents(eventsRich);

    const refetch = eventsClient.refetch;

    return <>{events.length < 1 ? "Nothing here!" : <>
        {events.map(event => {
            const { eventData, userMap } = CalculateEventMetadata_Verbose({ event, tabSlug: undefined, dashboardContext });

            return <EventDetailContainer key={event.id} fadePastEvents={false} readonly={true} tableClient={eventsClient} eventData={eventData} showVisibility={true} refetch={refetch}>
                <EventFrontpageTabContent readonly={false} refetch={eventsClient.refetch} event={event} />
            </EventDetailContainer>;
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
        <DashboardLayout title="Homepage Agenda" basePermission={Permission.edit_public_homepage}>
            <AppContextMarker name="FrontpageAgendaPage">
                <MainContent />
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default FrontpageAgendaPage;
