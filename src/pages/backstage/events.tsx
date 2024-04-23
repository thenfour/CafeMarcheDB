import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Pagination } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SplitQuickFilter, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SearchInput } from "src/core/components/CMTextField";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { EventDetailContainer } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { RenderMuiIcon } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getEventFilterInfo from "src/core/db3/queries/getEventFilterInfo";
import { GetEventFilterInfoRet } from "src/core/db3/shared/apiTypes";
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

    refreshSerial: number; // increment this in order to trigger a refetch
};

interface EventsControlsProps {
    spec: EventsControlsSpec;
    onChange: (value: EventsControlsSpec) => void;
};

type EventsControlsValueProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
    readonly: boolean;
};

type EventsControlsDynProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
    onFilterInfoChanged: (value: GetEventFilterInfoRet) => void;
};

const EventsFilterControlsValue = ({ filterInfo, ...props }: EventsControlsValueProps) => {

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

    return <div className={`EventsFilterControlsValue ${props.readonly && "HalfOpacity"}`}>

        <div className="row">
            {/* <div className="caption cell">event type</div> */}
            <CMChipContainer className="cell">
                {(filterInfo.types).map(type => (
                    <CMChip
                        key={type.id}
                        variation={{ ...StandardVariationSpec.Strong, selected: props.spec.typeFilter.some(id => id === type.id) }}
                        onClick={props.readonly ? undefined : (() => toggleType(type.id))}
                        color={type.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(type.iconName)}{type.label} ({type.rowCount})
                    </CMChip>
                ))}

            </CMChipContainer>
        </div>

        <div className="row">
            <CMChipContainer className="cell">
                {
                    filterInfo.statuses.map(status => (
                        <CMChip
                            key={status.id}
                            onClick={props.readonly ? undefined : (() => toggleStatus(status.id))}
                            color={status.color}
                            shape="rectangle"
                            variation={{ ...StandardVariationSpec.Strong, selected: props.spec.statusFilter.some(id => id === status.id) }}
                        //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                        >
                            {RenderMuiIcon(status.iconName)}{status.label} ({status.rowCount})
                        </CMChip>
                    ))}
            </CMChipContainer>
        </div >

        <div className="row">
            {/* <div className="caption cell">tags</div> */}
            <CMChipContainer className="cell">
                {filterInfo.tags.map(tag => (
                    <CMChip
                        key={tag.id}
                        size="small"
                        variation={{ ...StandardVariationSpec.Weak, selected: props.spec.tagFilter.some(id => id === tag.id) }}
                        onClick={props.readonly ? undefined : (() => toggleTag(tag.id))}
                        color={tag.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(tag.iconName)}{tag.label} ({tag.rowCount})
                    </CMChip>
                ))}
            </CMChipContainer>
        </div>
    </div>;
};


const EventsFilterControlsDyn = (props: EventsControlsDynProps) => {

    const [filterInfo, filterInfoExtra] = useQuery(getEventFilterInfo, {
        filterSpec: {
            quickFilter: props.spec.quickFilter,
            statusIds: props.spec.statusFilter,
            tagIds: props.spec.tagFilter,
            typeIds: props.spec.typeFilter,
        }
    });

    React.useEffect(() => {
        props.onFilterInfoChanged(filterInfo);
    }, [filterInfo]);

    return <EventsFilterControlsValue {...props} readonly={false} />;
};


const EventsControls = (props: EventsControlsProps) => {
    const [filterInfo, setFilterInfo] = React.useState<GetEventFilterInfoRet>(
        {
            statuses: [],
            tags: [],
            types: [],
            typesQuery: "",
            statusesQuery: "",
            tagsQuery: "",
        }
    );

    const setFilterText = (quickFilter: string) => {
        const newSpec: EventsControlsSpec = { ...props.spec, quickFilter };
        props.onChange(newSpec);
    };

    return <div className="filterControlsContainer">
        {/* <div className="header">FILTER</div> */}
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={props.spec.quickFilter}
                            autoFocus={true}
                        />
                    </div>

                    {/* The way we store the filter results here allows the suspense to be less flickry, rendering the same content during fallback. */}
                    <Suspense fallback={<EventsFilterControlsValue {...props} filterInfo={filterInfo} readonly={true} />}>
                        <EventsFilterControlsDyn {...props} filterInfo={filterInfo} onFilterInfoChanged={(v) => setFilterInfo(v)} />
                    </Suspense>

                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};

interface EventListItemProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    filterSpec: EventsControlsSpec;
};

const EventListItem = (props: EventListItemProps) => {
    const router = useRouter();
    const eventData = CalculateEventMetadata(props.event);

    // can't make these items a link because they contain interactable attendance control
    // return <div className="searchListItem" onClick={() => router.push(API.events.getURIForEvent(props.event.id, props.event.slug))}>
    return <EventDetailContainer
        eventData={eventData}
        fadePastEvents={true}
        readonly={true}
        tableClient={props.tableClient}
        showVisibility={true}
        highlightStatusId={props.filterSpec.statusFilter}
        highlightTypeId={props.filterSpec.typeFilter}
        highlightTagIds={props.filterSpec.tagFilter}
    >
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.tableClient.refetch}
        />
    </EventDetailContainer>
    //</div>;

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
            quickFilterValues: SplitQuickFilter(filterSpec.quickFilter),
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
        {items.map(event => <EventListItem key={event.id} event={event} tableClient={eventsClient} filterSpec={filterSpec} />)}
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
