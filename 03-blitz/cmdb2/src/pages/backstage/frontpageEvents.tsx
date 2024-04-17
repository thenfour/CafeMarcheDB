import { BlitzPage } from "@blitzjs/next";
import Link from "next/link";
import { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, gQueryOptions } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChipContainer, CMSinglePageSurfaceCard, CMStandardDBChip } from "src/core/components/CMCoreComponents";
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
        {events.map(event => <CMSinglePageSurfaceCard key={event.id}>
            <div className={`EventDetail contentSection event`}>
                <div className='header'>

                    <div className="date smallInfoBox">
                        {gIconMap.CalendarMonth()}
                        <span className="text">{API.events.getEventDateRange(event).toString()}</span>
                    </div>
                    <div className="location smallInfoBox">
                        {gIconMap.Place()}
                        <span className="text">{IsNullOrWhitespace(event.locationDescription) ? "Location TBD" : event.locationDescription}</span>
                    </div>
                    <div className='flex-spacer'></div>
                    <VisibilityValue permission={event.visiblePermission} variant='verbose' />
                </div>

                <div className='content'>
                    <div className='titleLine'>
                        <div className="titleText">
                            <Link href={API.events.getURIForEvent(event)} className="titleLink">
                                {event.name}
                            </Link>
                        </div>
                    </div>

                    {event.status && <CMStandardDBChip
                        variation={{ ...StandardVariationSpec.Strong, fillOption: 'hollow' }}
                        border='border'
                        shape="rectangle"
                        model={event.status} getTooltip={(_, c) => !!c ? `Status: ${c}` : `Status`}
                    />}

                    <CMChipContainer>
                        {event.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.eventTag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
                    </CMChipContainer>

                    <EventFrontpageTabContent readonly={false} refetch={eventsClient.refetch} event={event} />
                </div>
            </div>
        </CMSinglePageSurfaceCard>)}
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
