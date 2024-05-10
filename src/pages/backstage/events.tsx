import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button, Pagination, Tooltip } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { CalcRelativeTiming, DateTimeRange, Timing } from "shared/time";
import { IsNullOrWhitespace, arraysContainSameValues, toggleValueInArray } from "shared/utils";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard, CMStandardDBChip, InspectObject, TimingChip } from "src/core/components/CMCoreComponents";
import { DebugCollapsibleAdminText, EventDateField, NameValuePair, useURLState } from "src/core/components/CMCoreComponents2";
import { SearchInput } from "src/core/components/CMTextField";
import { GetStyleVariablesForColor } from "src/core/components/Color";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { VisibilityValue } from "src/core/components/VisibilityControl";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getEventFilterInfo from "src/core/db3/queries/getEventFilterInfo";
import { GetEventFilterInfoRet, GetICalRelativeURIForUserAndEvent, MakeGetEventFilterInfoRet, TimingFilter } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

export interface EventSearchItemContainerProps {
    event: db3.EventSearch_Event;

    highlightTagIds?: number[];
    highlightStatusId?: number[];
    highlightTypeId?: number[];
}

export const EventSearchItemContainer = ({ ...props }: React.PropsWithChildren<EventSearchItemContainerProps>) => {
    const dashboardContext = React.useContext(DashboardContext);
    const event = db3.enrichSearchResultEvent(props.event, dashboardContext);

    //const [currentUser] = useCurrentUser()!;
    const router = useRouter();
    //const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    //const isShowingAdminControls = API.other.useIsShowingAdminControls();
    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusId || [];
    const highlightTypeIds = props.highlightTypeId || [];

    // const refetch = () => {
    //     tableClient?.refetch();
    // };
    const eventURI = API.events.getURIForEvent(event.id, event.slug);
    const dateRange = API.events.getEventDateRange(event);
    const eventTiming = dateRange.hitTestDateTime();
    const relativeTiming = CalcRelativeTiming(new Date(), dateRange);

    const visInfo = dashboardContext.getVisibilityInfo(event);

    const timingLabel: { [key in Timing]: string } = {
        [Timing.Past]: "Past event",
        [Timing.Present]: "Ongoing event",
        [Timing.Future]: "Future event",
    } as const;

    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Strong,
        color: event.type?.color || null,
    });

    const classes = [
        `EventDetail`,
        `contentSection`,
        `event`,
        `ApplyBorderLeftColor`,
        event.type?.text,
        visInfo.className,
        ((eventTiming === Timing.Past)) ? "past" : "notPast",
        `status_${event.status?.significance}`,
    ];

    return <div style={typeStyle.style} className={classes.join(" ")}>
        <div className='header'>
            <CMChipContainer>
                {event.type && //<EventTypeValue type={event.type} />
                    <CMStandardDBChip
                        model={event.type}
                        getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                        variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(event.typeId!) }}
                    />
                }

                {event.status && <CMStandardDBChip
                    variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(event.statusId!) }}
                    border='border'
                    shape="rectangle"
                    model={event.status}
                    getTooltip={(status, c) => `Status ${c}: ${status?.description}`}
                />}

                <TimingChip value={eventTiming} tooltip={dateRange.toString()}>
                    {gIconMap.CalendarMonth()}
                    {timingLabel[eventTiming]}
                </TimingChip>

            </CMChipContainer>

            <div className='flex-spacer'></div>

            {
                dashboardContext.isShowingAdminControls && <>
                    <NameValuePair
                        isReadOnly={true}
                        name={"eventId"}
                        value={event.id}
                    />
                    <NameValuePair
                        isReadOnly={true}
                        name={"revision"}
                        value={event.revision}
                    />
                    <InspectObject src={event} />
                </>
            }

            <Tooltip title="Add to your calendar (iCal)">
                <a href={GetICalRelativeURIForUserAndEvent({ userAccessToken: dashboardContext.currentUser?.accessToken || null, eventUid: event.uid })} target='_blank' rel="noreferrer" className='HalfOpacity interactable shareCalendarButton'>{gIconMap.Share()}</a>
            </Tooltip>

            <VisibilityValue permission={event.visiblePermission} variant='minimal' />

        </div>

        <div className='content'>

            {/* for search results it's really best if we allow the whole row to be clickable. */}
            <Link href={eventURI} className="titleLink">
                <div className='titleLine'>
                    <div className="titleText">
                        {event.name}
                    </div>
                </div>
            </Link>

            <div className='titleLine'>
                <EventDateField className="date smallInfoBox text" dateRange={dateRange} />
            </div>

            <div className='titleLine'>
                <div className="location smallInfoBox">
                    {gIconMap.Place()}
                    <span className="text">{IsNullOrWhitespace(event.locationDescription) ? "Location TBD" : event.locationDescription}</span>
                </div>
            </div>

            <CMChipContainer>
                {event.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    model={tag.eventTag}
                    size='small'
                    variation={{ ...StandardVariationSpec.Weak, selected: highlightTagIds.includes(tag.eventTagId) }}
                    getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`}
                />)}
            </CMChipContainer>

            {props.children}

        </div>

    </div>;
};



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
    event: db3.EnrichedSearchEventPayload;
    filterInfo: GetEventFilterInfoRet;
    refetch: () => void;
    filterSpec: EventsFilterSpec;
};

const EventListItem = ({ event, ...props }: EventListItemProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const userMap: db3.UserInstrumentList = [dashboardContext.currentUser!];
    const userTags = props.filterInfo.userTags as db3.EventResponses_ExpectedUserTag[];
    const expectedAttendanceUserTag = userTags.find(t => t.id === event.expectedAttendanceUserTagId) || null;

    const eventData = CalculateEventMetadata<
        db3.EnrichedSearchEventPayload,
        db3.EventSearch_EventUserResponse,
        db3.EventSearch_EventSegment,
        db3.EventSearch_EventSegmentUserResponse
    >(event, undefined, dashboardContext,
        userMap,
        expectedAttendanceUserTag,
        (segment, user) => {
            if (!user?.id) return null;
            return {
                attendanceId: null,
                eventSegmentId: segment.id,
                id: -1,
                userId: user.id,
            }
        },
        (event, user, isInvited) => {
            if (!user?.id) return null;
            return {
                userComment: "",
                eventId: event.id,
                id: -1,
                userId: user.id,
                instrumentId: null,
                isInvited,
            }
        },
    );

    return <EventSearchItemContainer event={event}>
        {eventData.eventTiming !== Timing.Past &&
            <EventAttendanceControl
                eventData={eventData}
                onRefetch={props.refetch}
                userMap={userMap}
            />
        }

    </EventSearchItemContainer>;
};


interface EventsListArgs {
    filterSpec: EventsFilterSpec,
    filterInfo: GetEventFilterInfoRet;
    setFilterSpec: (value: EventsFilterSpec) => void, // for pagination
    events: db3.EnrichedSearchEventPayload[],
    refetch: () => void;
};

const EventsList = ({ filterSpec, filterInfo, events, refetch, ...props }: EventsListArgs) => {

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    return <div className="eventList searchResults">
        <div className="searchRecordCount">
            {filterInfo.rowCount === 0 ? "No items to show" : <>Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + events.length} of {filterInfo.rowCount} total</>}
        </div>
        {events.map(event => <EventListItem key={event.id} event={event} filterSpec={filterSpec} refetch={refetch} filterInfo={filterInfo} />)}
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
    //setEventsQueryResult: (v: db3.EventClientPayload_Verbose[]) => void;
};

const EventListQuerier = (props: EventListQuerierProps) => {
    const dashboardContext = React.useContext(DashboardContext);

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

    return <div className="queryProgressLine idle"></div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface EventListOuterProps {
};

const EventListOuter = (props: EventListOuterProps) => {
    //const [filterSpec, setFilterSpec] = React.useState<EventsFilterSpec>({ ...gDefaultFilter });

    //const [pageSize, setPageSize] = useURLState<number>("pageSize", 20);
    const [page, setPage] = useURLState<number>("p", 0);
    const [quickFilter, setQuickFilter] = useURLState<string>("qf", "");
    const [refreshSerial, setRefreshSerial] = useURLState<number>("rs", 0);
    const [tagFilter, setTagFilter] = useURLState<number[]>("tags", []);
    const [statusFilter, setStatusFilter] = useURLState<number[]>("statuses", []);
    const [typeFilter, setTypeFilter] = useURLState<number[]>("types", []);
    const [timingFilter, setTimingFilter] = useURLState<TimingFilter>("timing", "relevant");
    const [orderBy, setOrderBy] = useURLState<"StartAsc" | "StartDesc">("sort", "StartDesc");

    const filterSpec: EventsFilterSpec = {
        pageSize: 20,
        page,
        quickFilter,
        refreshSerial,
        tagFilter,
        statusFilter,
        typeFilter,
        timingFilter,
        orderBy,
    };

    const setFilterSpec = (x: EventsFilterSpec) => {
        //setPageSize(x.pageSize);
        setPage(x.page);
        setQuickFilter(x.quickFilter);
        setRefreshSerial(x.refreshSerial);
        setTagFilter(x.tagFilter);
        setStatusFilter(x.statusFilter);
        setTypeFilter(x.typeFilter);
        setTimingFilter(x.timingFilter);
        setOrderBy(x.orderBy);
    };

    const [filterInfo, setFilterInfo] = React.useState<GetEventFilterInfoRet>(MakeGetEventFilterInfoRet());
    //const [eventsQueryResult, setEventsQueryResult] = React.useState<db3.EventClientPayload_Verbose[]>([]);
    const dashboardContext = React.useContext(DashboardContext);

    // # when filter spec (other than page change), reset page to 0.
    let everythingButPage: any = {};
    { // avoid collision with `page`
        const { page, ...everythingButPage__ } = filterSpec;
        everythingButPage = everythingButPage__;
    }

    const specHash = JSON.stringify(everythingButPage);
    React.useEffect(() => {
        setFilterSpec({ ...filterSpec, page: 0 });
    }, [specHash]);

    const enrichedEvents = filterInfo.fullEvents.map(e => db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext));

    return <>
        <NewEventButton onOK={() => { }} />

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
                <EventListQuerier filterSpec={filterSpec} setFilterInfo={setFilterInfo} />
            </Suspense>
        </CMSinglePageSurfaceCard>
        <EventsList
            filterSpec={filterSpec}
            setFilterSpec={setFilterSpec}
            events={enrichedEvents}
            filterInfo={filterInfo}
            refetch={() => setFilterSpec({ ...filterSpec, refreshSerial: filterSpec.refreshSerial + 1 })}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListPageContent = () => {
    return <div className="eventsMainContent searchPage">
        <Suspense>
            <SettingMarkdown setting="events_markdown"></SettingMarkdown>
        </Suspense>

        <EventListOuter />
    </div>;
};

const ViewEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events" basePermission={Permission.view_events_nonpublic}>
            <EventListPageContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;
