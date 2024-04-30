import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button, Pagination } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { Timing } from "shared/time";
import { arraysContainSameValues, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { DebugCollapsibleAdminText, KeyValueDisplay } from "src/core/components/CMCoreComponents2";
import { SearchInput } from "src/core/components/CMTextField";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { EventDetailContainer } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getEventFilterInfo from "src/core/db3/queries/getEventFilterInfo";
import { GetEventFilterInfoChipInfo, GetEventFilterInfoRet, MakeGetEventFilterInfoRet, TimingFilter, gEventFilterTimingIDConstants } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.
interface EventsFilterSpec {
    pageSize: number;
    page: number;
    quickFilter: string;
    refreshSerial: number;

    tagFilter: number[];
    statusFilter: number[];
    typeFilter: number[];
    timingFilter: TimingFilter;

    orderBy: "StartAsc" | "StartDesc";
};

const gDefaultFilter: EventsFilterSpec = {
    pageSize: 20,
    page: 0,
    refreshSerial: 0,
    quickFilter: "",
    tagFilter: [],
    statusFilter: [],
    typeFilter: [],
    timingFilter: "relevant",
    orderBy: "StartAsc",
};// cannot be as const because the array is writable.

const HasExtraFilters = (val: EventsFilterSpec) => {
    if (val.pageSize != gDefaultFilter.pageSize) return true;
    if (val.quickFilter != gDefaultFilter.quickFilter) return true;
    if (!arraysContainSameValues(val.tagFilter, gDefaultFilter.tagFilter)) return true;
    if (!arraysContainSameValues(val.statusFilter, gDefaultFilter.statusFilter)) return true;
    if (!arraysContainSameValues(val.typeFilter, gDefaultFilter.typeFilter)) return true;
    if (val.timingFilter != gDefaultFilter.timingFilter) return true;
    if (val.orderBy != gDefaultFilter.orderBy) return true;
    return false;
};

const HasAnyFilters = (val: EventsFilterSpec) => {
    if (val.quickFilter != gDefaultFilter.quickFilter) return true;
    return HasExtraFilters(val);
};


interface EventsControlsProps {
    filterSpec: EventsFilterSpec;
    filterInfo: GetEventFilterInfoRet;
    onChange: (value: EventsFilterSpec) => void;
};

type EventsControlsValueProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
};

type EventsControlsDynProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
};

const EventsFilterControlsValue = ({ filterInfo, ...props }: EventsControlsValueProps) => {

    const toggleTag = (tagId: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    const toggleStatus = (id: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.statusFilter = toggleValueInArray(newSpec.statusFilter, id);
        props.onChange(newSpec);
    };

    const toggleType = (id: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.typeFilter = toggleValueInArray(newSpec.typeFilter, id);
        props.onChange(newSpec);
    };


    return <div className={`EventsFilterControlsValue`}>
        <div className="divider"></div>


        <div className="row">
            {/* <div className="caption cell">event type</div> */}
            <CMChipContainer className="cell">
                {(filterInfo.types).map(type => (
                    <CMChip
                        key={type.id}
                        variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.typeFilter.some(id => id === type.id) }}
                        onClick={() => toggleType(type.id)}
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
                            onClick={() => toggleStatus(status.id)}
                            color={status.color}
                            shape="rectangle"
                            variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.statusFilter.some(id => id === status.id) }}
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
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.some(id => id === tag.id) }}
                        onClick={() => toggleTag(tag.id)}
                        color={tag.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(tag.iconName)}{tag.label} ({tag.rowCount})
                    </CMChip>
                ))}
            </CMChipContainer>
        </div>

        <div className="divider"></div>

        <div className="row">
            <CMChipContainer className="cell">
                <CMChip
                    size="small"
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.orderBy === "StartAsc" }}
                    onClick={() => props.onChange({ ...props.filterSpec, orderBy: "StartAsc" })}
                >
                    old to new (chronological)
                </CMChip>
                <CMChip
                    size="small"
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.orderBy === "StartDesc" }}
                    onClick={() => props.onChange({ ...props.filterSpec, orderBy: "StartDesc" })}
                >
                    new to old
                </CMChip>
            </CMChipContainer>
        </div>
    </div>;
};


const EventsFilterControlsDyn = (props: EventsControlsDynProps) => {
    return <EventsFilterControlsValue {...props} />;
};


const EventsControls = (props: EventsControlsProps) => {
    const [expanded, setExpanded] = React.useState<boolean>(false);
    const hasExtraFilters = HasExtraFilters(props.filterSpec);
    const hasAnyFilters = HasAnyFilters(props.filterSpec);

    const setFilterText = (quickFilter: string) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec, quickFilter };
        props.onChange(newSpec);
    };

    const handleClearFilter = () => {
        props.onChange({ ...gDefaultFilter });
    };

    const selectTiming = (t: TimingFilter) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.timingFilter = t;
        props.onChange(newSpec);
    };

    const timingChips: Record<TimingFilter, string> = {
        "past": "Search events that already ended",
        "relevant": "Search upcoming and recent events",
        "future": "Search upcoming events",
        "all": "Search all events",
    };

    return <div className="filterControlsContainer">
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={props.filterSpec.quickFilter}
                            autoFocus={true}
                        />
                        {(hasAnyFilters) && <Button onClick={handleClearFilter}>Reset filter</Button>}
                        <div className="freeButton headerExpandableButton" onClick={() => setExpanded(!expanded)}>
                            Filter {hasExtraFilters && "*"}
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </div>
                    </div>

                    <div className={`EventsFilterControlsValue`}>
                        <div className="row" style={{ display: "flex", alignItems: "center" }}>
                            {/* <div className="caption cell">event type</div> */}
                            <CMChipContainer className="cell">
                                {Object.keys(timingChips).map(k => <CMChip
                                    key={k}
                                    variation={{ fillOption: "hollow", selected: (k === props.filterSpec.timingFilter), enabled: true, variation: "weak" }}
                                    onClick={() => selectTiming(k as any)}
                                    shape="rectangle"
                                    size="small"
                                >
                                    {k}
                                </CMChip>)
                                }
                            </CMChipContainer>
                            <div className="tinyCaption">{timingChips[props.filterSpec.timingFilter]}</div>
                        </div>
                    </div>

                    {expanded && <EventsFilterControlsDyn {...props} filterInfo={props.filterInfo} />}
                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};

interface EventListItemProps {
    event: db3.EventClientPayload_Verbose;
    refetch: () => void;
    filterSpec: EventsFilterSpec;
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
        tableClient={null/*props.tableClient*/}
        showVisibility={true}
        highlightStatusId={props.filterSpec.statusFilter}
        highlightTypeId={props.filterSpec.typeFilter}
        highlightTagIds={props.filterSpec.tagFilter}
    >
        {eventData.eventTiming !== Timing.Past &&
            <EventAttendanceControl
                eventData={eventData}
                onRefetch={props.refetch}
            // onRefetch={() => {}props.tableClient.refetch}
            />
        }
    </EventDetailContainer>
    //</div>;

};

interface EventsListArgs {
    filterSpec: EventsFilterSpec,
    filterInfo: GetEventFilterInfoRet;
    setFilterSpec: (value: EventsFilterSpec) => void, // for pagination
    events: db3.EventClientPayload_Verbose[],
    refetch: () => void;
};

const EventsList = ({ filterSpec, filterInfo, events, refetch, ...props }: EventsListArgs) => {

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    return <div className="eventList searchResults">
        {events.map(event => <EventListItem key={event.id} event={event} filterSpec={filterSpec} refetch={refetch} />)}
        <div className="searchRecordCount">
            {filterInfo.rowCount === 0 ? "No items to show" : <>Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + events.length} of {filterInfo.rowCount} total</>}
        </div>
        <Pagination
            count={Math.ceil(filterInfo.rowCount / filterSpec.pageSize)}
            page={filterSpec.page + 1}
            onChange={(e, newPage) => {
                //console.log(`filterSpec.page: ${filterSpec.page} // setting to ${newPage - 1}`);
                props.setFilterSpec({ ...filterSpec, page: newPage - 1 });
            }} />
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface EventListQuerierProps {
    filterSpec: EventsFilterSpec;
    setFilterInfo: (v: GetEventFilterInfoRet) => void;
    setEventsQueryResult: (v: db3.EventClientPayload_Verbose[]) => void;
};

const EventListQuerier = (props: EventListQuerierProps) => {

    // QUERY: filtered results & info
    const [queriedFilterInfo, getFilterInfoExtra] = useQuery(getEventFilterInfo, {
        filterSpec: {
            quickFilter: props.filterSpec.quickFilter,
            statusIds: props.filterSpec.statusFilter,
            tagIds: props.filterSpec.tagFilter,
            typeIds: props.filterSpec.typeFilter,
            orderBy: props.filterSpec.orderBy,
            pageSize: props.filterSpec.pageSize,
            timingFilter: props.filterSpec.timingFilter,
            page: props.filterSpec.page,
            refreshSerial: props.filterSpec.refreshSerial,
        }
    });

    React.useEffect(() => {
        if (getFilterInfoExtra.isSuccess) {
            props.setFilterInfo({ ...queriedFilterInfo });
        }
    }, [getFilterInfoExtra.dataUpdatedAt]);

    // QUERY: event details
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const tableParams: db3.EventTableParams = {
        eventIds: queriedFilterInfo.eventIds.length === 0 ? [-1] : queriedFilterInfo.eventIds, // prevent fetching the entire table!
        refreshSerial: props.filterSpec.refreshSerial,
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
            pageSize: props.filterSpec.pageSize, // not usually needed because the eventid list is there. so for sanity.
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    React.useEffect(() => {
        if (eventsClient.remainingQueryStatus.isSuccess) {
            const items = eventsClient.items as db3.EventClientPayload_Verbose[];
            // the db3 query doesn't retain the same order as the filter info ret, put in correct order.
            const eventsWithPossibleNulls = queriedFilterInfo.eventIds.map(id => items.find(e => e.id === id));
            const events = eventsWithPossibleNulls.filter(e => !!e) as db3.EventClientPayload_Verbose[]; // in case of any desync.

            props.setEventsQueryResult(events);
        }
    }, [eventsClient.remainingQueryStatus.dataUpdatedAt]);

    return <div className="queryProgressLine idle"></div>;
};









//////////////////////////////////////////////////////////////////////////////////////////////////
interface EventListOuterProps {
};

const EventListOuter = (props: EventListOuterProps) => {
    const [filterSpec, setFilterSpec] = React.useState<EventsFilterSpec>({ ...gDefaultFilter });
    const [filterInfo, setFilterInfo] = React.useState<GetEventFilterInfoRet>(MakeGetEventFilterInfoRet());
    const [eventsQueryResult, setEventsQueryResult] = React.useState<db3.EventClientPayload_Verbose[]>([]);


    // # when filter spec (other than page change), reset page to 0.
    const { page, ...everythingButPage } = filterSpec;

    const specHash = JSON.stringify(everythingButPage);
    React.useEffect(() => {
        setFilterSpec({ ...filterSpec, page: 0 });
    }, [specHash]);

    return <>
        <NewEventButton onOK={() => { }} />

        <DebugCollapsibleAdminText obj={filterSpec} caption={"filterSpec"} />
        <DebugCollapsibleAdminText obj={filterSpec} caption={"filterSpec"} />
        <DebugCollapsibleAdminText text={filterInfo.statusesQuery} caption={"statusesQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.tagsQuery} caption={"tagsQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.typesQuery} caption={"typesQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.paginatedEventQuery} caption={"paginatedEventQuery"} />

        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                <EventsControls onChange={setFilterSpec} filterSpec={filterSpec} filterInfo={filterInfo} />
            </div>

            <Suspense fallback={<div className="queryProgressLine loading"></div>}>
                <EventListQuerier filterSpec={filterSpec} setEventsQueryResult={setEventsQueryResult} setFilterInfo={setFilterInfo} />
            </Suspense>
        </CMSinglePageSurfaceCard>
        <EventsList
            filterSpec={filterSpec}
            setFilterSpec={setFilterSpec}
            events={eventsQueryResult}
            filterInfo={filterInfo}
            refetch={() => setFilterSpec({ ...filterSpec, refreshSerial: filterSpec.refreshSerial + 1 })}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListPageContent = () => {
    if (!useAuthorization("events page", Permission.view_events_nonpublic)) {
        throw new Error(`unauthorized`);
    }

    return <div className="eventsMainContent searchPage">

        <Suspense>
            <SettingMarkdown setting="events_markdown"></SettingMarkdown>
        </Suspense>

        <EventListOuter />
    </div>;
};

const ViewEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events">
            <EventListPageContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;
