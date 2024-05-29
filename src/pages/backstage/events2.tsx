import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { ListItemIcon, Menu, MenuItem, Pagination, Tooltip } from "@mui/material";
import Link from "next/link";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { Timing } from "shared/time";
import { IsNullOrWhitespace, arrayToTSV } from "shared/utils";
import { CMChipContainer, CMSinglePageSurfaceCard, CMStandardDBChip, InspectObject } from "src/core/components/CMCoreComponents";
import { CMSmallButton, EventDateField, NameValuePair, useURLState } from "src/core/components/CMCoreComponents2";
import { GetStyleVariablesForColor } from "src/core/components/Color";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { ChipFilterGroup, FilterControls, ForeignSingleFilterGroup, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { API } from "src/core/db3/clientAPI";
import { getURIForEvent } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import getSearchResults from "src/core/db3/queries/getSearchResults";
import { DiscreteCriterion, DiscreteCriterionFilterType, GetICalRelativeURIForUserAndEvent, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

enum OrderByColumnOptions {
    id = "id",
    startsAt = "startsAt",
    name = "name",
};

type OrderByColumnOption = keyof typeof OrderByColumnOptions;// "startsAt" | "name";

interface EventsFilterSpec {
    pageSize: number;
    page: number;
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: OrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
    statusFilter: DiscreteCriterion;
};


export interface EventSearchItemContainerProps {
    event: db3.EventSearch_Event;

    highlightTagIds?: number[];
    highlightStatusIds?: number[];
    highlightTypeIds?: number[];
}

export const EventSearchItemContainer = ({ ...props }: React.PropsWithChildren<EventSearchItemContainerProps>) => {
    const dashboardContext = React.useContext(DashboardContext);
    const event = db3.enrichSearchResultEvent(props.event, dashboardContext);

    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusIds || [];
    const highlightTypeIds = props.highlightTypeIds || [];

    const eventURI = API.events.getURIForEvent(event.id, event.slug);
    const dateRange = API.events.getEventDateRange(event);
    const eventTiming = dateRange.hitTestDateTime();

    const visInfo = dashboardContext.getVisibilityInfo(event);

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

            {!IsNullOrWhitespace(event.locationDescription) &&
                <div className='titleLine'>
                    <div className="location smallInfoBox">
                        {gIconMap.Place()}
                        <span className="text">{event.locationDescription}</span>
                    </div>
                </div>}

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


interface EventListItemProps {
    event: db3.EnrichedSearchEventPayload;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: EventsFilterSpec;
};

const EventListItem = ({ event, ...props }: EventListItemProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const userMap: db3.UserInstrumentList = [dashboardContext.currentUser!];
    const customData = props.results.customData as db3.EventSearchCustomData;
    const userTags = (customData ? customData.userTags : []) as db3.EventResponses_ExpectedUserTag[];
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

    return <EventSearchItemContainer
        event={event}
        highlightTagIds={props.filterSpec.tagFilter.options as number[]}
        highlightStatusIds={props.filterSpec.statusFilter.options as number[]}
    >
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.refetch}
            userMap={userMap}
            alertOnly={true}
        />
    </EventSearchItemContainer>;
};




async function CopyEventListCSV(snackbarContext: SnackbarContextType, value: db3.EnrichedSearchEventPayload[]) {
    const obj = value.map((e, i) => ({
        Order: (i + 1).toString(),
        ID: e.id.toString(),
        Name: e.name,
        Type: e.type?.text || "",
        Status: e.status?.label || "",
        StartsAt: e.startsAt?.toISOString() || "TBD",
        IsAllDay: e.isAllDay ? "yes" : "no",
        DurationMinutes: (new Number(e.durationMillis).valueOf() / 60000).toString(),
        Location: e.locationDescription,
        LocationURL: e.locationURL,
        URL: getURIForEvent(e.id),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}




interface EventsListArgs {
    filterSpec: EventsFilterSpec,
    results: SearchResultsRet;
    setFilterSpec: (value: EventsFilterSpec) => void, // for pagination
    events: db3.EnrichedSearchEventPayload[],
    refetch: () => void;
};

const EventsList = ({ filterSpec, results, events, refetch, ...props }: EventsListArgs) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    const handleCopy = async () => {
        await CopyEventListCSV(snackbarContext, events);
    };

    return <div className="eventList searchResults">
        <div className="searchRecordCount">
            {results.rowCount === 0 ? "No items to show" : <>Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + events.length} of {results.rowCount} total</>}
            <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
            <Menu
                id="menu-searchResults"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={async () => { await handleCopy(); setAnchorEl(null); }}>
                    <ListItemIcon>
                        {gIconMap.ContentCopy()}
                    </ListItemIcon>
                    Copy CSV
                </MenuItem>
            </Menu>
        </div>
        {events.map(event => <EventListItem key={event.id} event={event} filterSpec={filterSpec} refetch={refetch} results={results} />)}
        <Pagination
            count={Math.ceil(results.rowCount / filterSpec.pageSize)}
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
    setResults: (v: SearchResultsRet) => void;
};

const EventListQuerier = (props: EventListQuerierProps) => {
    //const dashboardContext = React.useContext(DashboardContext);

    const [searchResult, queryExtra] = useQuery(getSearchResults, {
        page: props.filterSpec.page,
        pageSize: props.filterSpec.pageSize,
        tableID: db3.xEvent.tableID,
        sort: [{
            db3Column: props.filterSpec.orderByColumn,
            direction: props.filterSpec.orderByDirection,
        }],

        quickFilter: props.filterSpec.quickFilter,
        discreteCriteria: [
            props.filterSpec.statusFilter,
            props.filterSpec.tagFilter,
        ],
        dateCriteria: [],
    });

    React.useEffect(() => {
        if (queryExtra.isSuccess) {
            console.log(searchResult);
            props.setResults({ ...searchResult });
        }
    }, [queryExtra.dataUpdatedAt]);

    return <div className="queryProgressLine idle"></div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListOuter = () => {
    const [page, setPage] = useURLState<number>("p", 0);
    const [quickFilter, setQuickFilter] = useURLState<string>("qf", "");
    const [tagFilter, setTagFilter] = React.useState<DiscreteCriterion>({ db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] });
    const [statusFilter, setStatusFilter] = React.useState<DiscreteCriterion>({ db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] });
    const [sortModel, setSortModel] = React.useState<SortBySpec>({
        columnName: OrderByColumnOptions.startsAt,
        direction: "asc",
    });
    //const [orderByDirection, setOrderByDirection] = React.useState<SortDirection>("asc");

    const filterSpec: EventsFilterSpec = {
        pageSize: 20,
        refreshSerial: 0,
        page,
        quickFilter,
        tagFilter,
        statusFilter,
        orderByColumn: sortModel.columnName as any,
        orderByDirection: sortModel.direction,
    };

    const setFilterSpec = (x: EventsFilterSpec) => {
        setPage(x.page);
        setQuickFilter(x.quickFilter);
        setTagFilter(x.tagFilter);
        setStatusFilter(x.statusFilter);
        setSortModel({
            columnName: x.orderByColumn,
            direction: x.orderByDirection,
        });
    };

    const [results, setResults] = React.useState<SearchResultsRet>({
        facets: [],
        results: [],
        rowCount: 0,
        customData: null,
        queryMetrics: [],
    });
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

    const enrichedEvents = results.results.map(e => db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext));

    return <>
        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                {/* <EventsControls onChange={setFilterSpec} filterSpec={filterSpec} filterInfo={filterInfo} /> */}
                <FilterControls
                    inCard={false}
                    onQuickFilterChange={(v) => setQuickFilter(v)}
                    onResetFilter={() => { }}
                    hasAnyFilters={false}
                    hasExtraFilters={false}
                    quickFilterText={filterSpec.quickFilter}
                    primaryFilter={<div>
                        <ForeignSingleFilterGroup
                            label={"Status"}
                            value={filterSpec.statusFilter}
                            onChange={(n) => setStatusFilter(n)}
                            items={results.facets.find(f => f.db3Column === "status")?.items || []}
                        />
                        <div className="divider" />
                        <TagsFilterGroup
                            label={"Tags"}
                            value={filterSpec.tagFilter}
                            onChange={(n) => setTagFilter(n)}
                            items={results.facets.find(f => f.db3Column === "tags")?.items || []}
                        />
                        <div className="divider" />

                        <SortByGroup
                            columnOptions={Object.keys(OrderByColumnOptions)}
                            setValue={setSortModel}
                            value={sortModel}
                        />

                    </div>}
                    extraFilter={<div>x</div>}
                />
            </div>

            <Suspense fallback={<div className="queryProgressLine loading"></div>}>
                <EventListQuerier filterSpec={filterSpec} setResults={setResults} />
            </Suspense>
        </CMSinglePageSurfaceCard >
        <EventsList
            filterSpec={filterSpec}
            setFilterSpec={setFilterSpec}
            events={enrichedEvents}
            results={results}
            refetch={() => setFilterSpec({ ...filterSpec, refreshSerial: filterSpec.refreshSerial + 1 })}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const SearchEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events" basePermission={Permission.view_events_nonpublic}>
            <div className="eventsMainContent searchPage">
                <Suspense>
                    <SettingMarkdown setting="events_markdown"></SettingMarkdown>
                </Suspense>

                <EventListOuter />
            </div>
        </DashboardLayout>
    )
}

export default SearchEventsPage;
