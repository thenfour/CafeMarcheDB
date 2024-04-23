import { BlitzPage } from "@blitzjs/next";
import {
    Search as SearchIcon
} from '@mui/icons-material';
import { InputBase, Pagination } from "@mui/material";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { EventDetailContainer } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.
interface EventsControlsSpec {
    recordCount: number;
    quickFilter: string;
    tagFilter: number[];
    statusFilter: number[];
    typeFilter: number[];
    //verbosity: EventDetailVerbosity;
    refreshSerial: number; // increment this in order to trigger a refetch
};

interface EventsControlsProps {
    spec: EventsControlsSpec;
    onChange: (value: EventsControlsSpec) => void;
};
const EventsControls = (props: EventsControlsProps) => {

    const [popularTags, { refetch }] = API.events.usePopularEventTagsQuery();

    const statusesClient = API.events.getEventStatusesClient();
    const typesClient = API.events.getEventTypesClient();

    const setFilterText = (quickFilter: string) => {
        const newSpec: EventsControlsSpec = { ...props.spec, quickFilter };
        props.onChange(newSpec);
    };

    const setRecordCount = (recordCount: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec, recordCount };
        props.onChange(newSpec);
    };

    const toggleTag = (tagId: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    const toggleStatus = (id: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.statusFilter = toggleValueInArray(newSpec.statusFilter, id);
        props.onChange(newSpec);
    };

    const toggleType = (id: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.typeFilter = toggleValueInArray(newSpec.typeFilter, id);
        props.onChange(newSpec);
    };


    // FILTER: [upcoming] [past] [concert] [rehearsals] [majorettes] [__________________]
    // SHOW:   [compact] [default] [full] [verbose]
    // 20 100 all
    return <div className="filterControlsContainer">
        {/* <div className="header">FILTER</div> */}
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <InputBase
                            size="small"
                            placeholder="Filter"
                            autoFocus={true}
                            sx={{
                                backgroundColor: "#f0f0f0",
                                borderRadius: 3,
                            }}
                            value={props.spec.quickFilter}
                            onChange={(e) => setFilterText(e.target.value)}
                            startAdornment={<SearchIcon />}
                        />
                    </div>

                    <div className="row">
                        {/* <div className="caption cell">status</div> */}
                        <CMChipContainer className="cell">
                            {(statusesClient.items as db3.EventStatusPayload[]).filter(i => i.events.length > 0).map(status => (
                                <CMChip
                                    key={status.id}
                                    //selected={props.spec.statusFilter.some(id => id === status.id)}
                                    onClick={() => toggleStatus(status.id)}
                                    color={status.color}
                                    shape="rectangle"
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.statusFilter.some(id => id === status.id) }}
                                >
                                    {RenderMuiIcon(status.iconName)}{status.label} ({status.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>

                    <div className="row">
                        {/* <div className="caption cell">event type</div> */}
                        <CMChipContainer className="cell">
                            {(typesClient.items as db3.EventTypePayload[]).filter(i => i.events.length > 0).map(type => (
                                <CMChip
                                    key={type.id}
                                    //selected={props.spec.typeFilter.some(id => id === type.id)}
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.typeFilter.some(id => id === type.id) }}
                                    onClick={() => toggleType(type.id)}
                                    color={type.color}
                                >
                                    {RenderMuiIcon(type.iconName)}{type.text} ({type.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>

                    <div className="row">
                        {/* <div className="caption cell">tags</div> */}
                        <CMChipContainer className="cell">
                            {popularTags.filter(t => t.events.length > 0).map(tag => (
                                <CMChip
                                    key={tag.id}
                                    //selected={props.spec.tagFilter.some(id => id === tag.id)}
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.tagFilter.some(id => id === tag.id) }}
                                    onClick={() => toggleTag(tag.id)}
                                    color={tag.color}
                                >
                                    {tag.text} ({tag.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>


                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};

interface EventListItemProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
};

const EventListItem = (props: EventListItemProps) => {

    const eventData = CalculateEventMetadata(props.event);

    return <EventDetailContainer eventData={eventData} fadePastEvents={true} readonly={true} tableClient={props.tableClient} showVisibility={true}>
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.tableClient.refetch}
        />
    </EventDetailContainer>;

};

interface EventsListArgs {
    // in order for callers to be able to tell this to refetch, just increment a value in the filter
    filterSpec: EventsControlsSpec,
};

const EventsList = ({ filterSpec }: EventsListArgs) => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;
    const [page, setPage] = React.useState<number>(0);

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        filterModel: {
            quickFilterValues: filterSpec.quickFilter.split(/\s+/).filter(token => token.length > 0),
            items: [],
            tagIds: filterSpec.tagFilter,
            tableParams: {
                eventTypeIds: filterSpec.typeFilter,
                eventStatusIds: filterSpec.statusFilter,
            }
        },
        paginationModel: {
            page: page,
            pageSize: filterSpec.recordCount,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,// | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    React.useEffect(() => {
        eventsClient.refetch();
    }, [filterSpec]);

    const items = eventsClient.items as db3.EventClientPayload_Verbose[];
    const itemBaseOrdinal = page * filterSpec.recordCount;

    return <div className="eventList searchResults">
        {items.map(event => <EventListItem key={event.id} event={event} tableClient={eventsClient} />)}
        <div className="searchRecordCount">
            Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + items.length} of {eventsClient.rowCount} total
        </div>
        <Pagination
            count={Math.ceil(eventsClient.rowCount / filterSpec.recordCount)}
            page={page + 1}
            onChange={(e, newPage) => {
                setPage(newPage - 1);
                eventsClient.refetch();
            }} />
    </div>;
};

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events_nonpublic)) {
        throw new Error(`unauthorized`);
    }

    const [controlSpec, setControlSpec] = React.useState<EventsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        statusFilter: [],
        typeFilter: [],
        refreshSerial: 0,
    });

    const handleSpecChange = (value: EventsControlsSpec) => {
        setControlSpec(value);
    };

    return <div className="eventsMainContent">

        <Suspense>
            <SettingMarkdown setting="events_markdown"></SettingMarkdown>
        </Suspense>

        <NewEventButton onOK={() => {
            setControlSpec({ ...controlSpec, refreshSerial: controlSpec.refreshSerial + 1 });
        }} />

        <Suspense>
            <CMSinglePageSurfaceCard className="filterControls">
                {/* showing {eventsClient.items.length} events */}
                <div className="header">
                    Search & filter events
                </div>
                <div className="content">
                    <EventsControls onChange={handleSpecChange} spec={controlSpec} />
                </div>
            </CMSinglePageSurfaceCard>
        </Suspense>

        <Suspense>
            <EventsList filterSpec={controlSpec} />
        </Suspense>
    </div>;
};

const ViewEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;
