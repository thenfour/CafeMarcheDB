import { BlitzPage } from "@blitzjs/next";
import Link from "next/link";
import { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, gQueryOptions } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChipContainer, CMSinglePageSurfaceCard, CMStandardDBChip } from "src/core/components/CMCoreComponents";
import { EventDetailContainer } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { EventFrontpageTabContent } from "src/core/components/EventFrontpageComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { VisibilityValue } from "src/core/components/VisibilityControl";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const EventsList = () => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
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
            pageSize: 100,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,// | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    const events = eventsClient.items as db3.EventClientPayload_Verbose[];

    return <>
        {events.map(event => {
            const eventData = CalculateEventMetadata(event);

            // return <CMSinglePageSurfaceCard>
            return <EventDetailContainer key={event.id} fadePastEvents={false} readonly={true} tableClient={eventsClient} eventData={eventData}>
                <EventFrontpageTabContent readonly={false} refetch={eventsClient.refetch} event={event} />
            </EventDetailContainer>;
            //</CMSinglePageSurfaceCard>
        }
        )}
    </>;
};

const MainContent = () => {
    if (!useAuthorization("FrontpageAgendaPage", Permission.edit_public_homepage)) {
        throw new Error(`unauthorized`);
    }

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
            <MainContent />
        </DashboardLayout>
    )
}

export default FrontpageAgendaPage;
