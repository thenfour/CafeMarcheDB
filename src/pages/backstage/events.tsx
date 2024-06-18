import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { ListItemIcon, Menu, MenuItem, Pagination, Tooltip } from "@mui/material";
import Link from "next/link";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { Timing } from "shared/time";
import { IsNullOrWhitespace, arrayToTSV, arraysContainSameValues } from "shared/utils";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard, CMStandardDBChip, InspectObject } from "src/core/components/CMCoreComponents";
import { CMSmallButton, EventDateField, NameValuePair, useURLState } from "src/core/components/CMCoreComponents2";
import { GetStyleVariablesForColor } from "src/core/components/Color";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { FilterControls, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
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

    typeFilter: DiscreteCriterion;
    tagFilter: DiscreteCriterion;
    statusFilter: DiscreteCriterion;
    dateFilter: DiscreteCriterion;
};

// // for serializing in compact querystring
interface CriterionStatic {
    o: number[];
    b: DiscreteCriterionFilterType;
}

// for serializing in compact querystring
interface EventsFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: OrderByColumnOption;
    orderByDirection: SortDirection;

    typeFilterEnabled: boolean;
    typeFilterBehavior: DiscreteCriterionFilterType;
    typeFilterOptions: number[];

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];

    statusFilterEnabled: boolean;
    statusFilterBehavior: DiscreteCriterionFilterType;
    statusFilterOptions: number[];

    dateFilterEnabled: boolean;
    dateFilterBehavior: DiscreteCriterionFilterType;
    dateFilterOptions: number[];
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
        ...StandardVariationSpec.Weak,
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
        <div className='header applyColor'>
            <CMChipContainer>
                {event.status && <CMStandardDBChip
                    variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(event.statusId!) }}
                    border='border'
                    shape="rectangle"
                    model={event.status}
                    getTooltip={(status, c) => `Status ${c}: ${status?.description}`}
                />}
            </CMChipContainer>

            <div className='flex-spacer'></div>

            <CMChipContainer>
                {event.type &&
                    <CMStandardDBChip
                        model={event.type}
                        getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                        variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(event.typeId!) }}
                        className='eventTypeChip'
                    />
                }

            </CMChipContainer>

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
        highlightTypeIds={props.filterSpec.typeFilter.options as number[]}
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
    //    setFilterSpec: (value: EventsFilterSpec) => void, // for pagination
    setPage: (n: number) => void,
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
                props.setPage(newPage - 1);
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
            props.filterSpec.dateFilter,
            props.filterSpec.typeFilter,
            props.filterSpec.statusFilter,
            props.filterSpec.tagFilter,
        ],
    });

    React.useEffect(() => {
        if (queryExtra.isSuccess) {
            props.setResults({ ...searchResult });
        }
    }, [queryExtra.dataUpdatedAt]);

    return <div className="queryProgressLine idle"></div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////

const gStaticFilters: EventsFilterSpecStatic[] = [
    {
        label: "All",
        helpText: "Searching all events",
        orderByColumn: OrderByColumnOptions.startsAt,
        orderByDirection: "asc",
        typeFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        typeFilterOptions: [],
        typeFilterEnabled: false,
        tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
        tagFilterOptions: [],
        tagFilterEnabled: false,
        statusFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        statusFilterOptions: [],
        statusFilterEnabled: false,
        dateFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        dateFilterOptions: [],
        dateFilterEnabled: false,
    },
    {
        label: "Relevant",
        helpText: "Searching all events no more than 1 week old",
        "orderByColumn": "startsAt",
        "orderByDirection": "asc",
        "statusFilterEnabled": false,
        "statusFilterBehavior": "hasNone" as any,
        "statusFilterOptions": [
            2
        ],
        "typeFilterEnabled": false,
        "typeFilterBehavior": "hasSomeOf" as any,
        "typeFilterOptions": [
            3
        ],
        "tagFilterEnabled": false,
        "tagFilterBehavior": "hasAllOf" as any,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": "hasAllOf" as any,
        "dateFilterOptions": [
            10002
        ]
    },
    {
        label: "Rehearsals since 60 days",
        helpText: "Searching rehearsals more recent than 60 days",
        "orderByColumn": "startsAt",
        "orderByDirection": "asc",
        "statusFilterEnabled": false,
        "statusFilterBehavior": "hasNone" as any,
        "statusFilterOptions": [
            2
        ],
        "typeFilterEnabled": true,
        "typeFilterBehavior": "hasSomeOf" as any,
        "typeFilterOptions": [
            3
        ],
        "tagFilterEnabled": false,
        "tagFilterBehavior": "hasAllOf" as any,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": "hasAllOf" as any,
        "dateFilterOptions": [
            10003
        ]
    },
];

const gDefaultStaticFilterName = "Relevant" as const;
const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;


//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const snackbarContext = React.useContext(SnackbarContext);

    const [page, setPage] = useURLState<number>("p", 0);
    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);

    const [quickFilter, setQuickFilter] = useURLState<string>("qf", "");

    const [sortColumn, setSortColumn] = useURLState<string>("sc", gDefaultStaticFilterValue.orderByColumn);
    const [sortDirection, setSortDirection] = useURLState<SortDirection>("sd", gDefaultStaticFilterValue.orderByDirection);

    const sortModel: SortBySpec = {
        columnName: sortColumn,
        direction: sortDirection,
    };
    const setSortModel = (x: SortBySpec) => {
        setSortColumn(x.columnName);
        setSortDirection(x.direction);
    };

    // "tg" prefix
    const [tagFilterBehaviorWhenEnabled, setTagFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tgb", gDefaultStaticFilterValue.tagFilterBehavior);
    const [tagFilterOptionsWhenEnabled, setTagFilterOptionsWhenEnabled] = useURLState<number[]>("tgo", gDefaultStaticFilterValue.tagFilterOptions);
    const [tagFilterEnabled, setTagFilterEnabled] = useURLState<boolean>("tge", gDefaultStaticFilterValue.tagFilterEnabled);
    const tagFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "tags",
        behavior: tagFilterBehaviorWhenEnabled,
        options: tagFilterOptionsWhenEnabled,
    };
    const setTagFilterWhenEnabled = (x: DiscreteCriterion) => {
        setTagFilterBehaviorWhenEnabled(x.behavior);
        setTagFilterOptionsWhenEnabled(x.options as any);
    };

    // "st" prefix
    const [statusFilterBehaviorWhenEnabled, setStatusFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("stb", gDefaultStaticFilterValue.statusFilterBehavior);
    const [statusFilterOptionsWhenEnabled, setStatusFilterOptionsWhenEnabled] = useURLState<number[]>("sto", gDefaultStaticFilterValue.statusFilterOptions);
    const [statusFilterEnabled, setStatusFilterEnabled] = useURLState<boolean>("ste", gDefaultStaticFilterValue.statusFilterEnabled);
    const statusFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "status",
        behavior: statusFilterBehaviorWhenEnabled,
        options: statusFilterOptionsWhenEnabled,
    };
    const setStatusFilterWhenEnabled = (x: DiscreteCriterion) => {
        setStatusFilterBehaviorWhenEnabled(x.behavior);
        setStatusFilterOptionsWhenEnabled(x.options as any);
    };

    // "tp" prefix
    const [typeFilterBehaviorWhenEnabled, setTypeFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tpb", gDefaultStaticFilterValue.typeFilterBehavior);
    const [typeFilterOptionsWhenEnabled, setTypeFilterOptionsWhenEnabled] = useURLState<number[]>("tpo", gDefaultStaticFilterValue.typeFilterOptions);
    const [typeFilterEnabled, setTypeFilterEnabled] = useURLState<boolean>("tpe", gDefaultStaticFilterValue.typeFilterEnabled);

    const typeFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "type",
        behavior: typeFilterBehaviorWhenEnabled,
        options: typeFilterOptionsWhenEnabled,
    };
    const setTypeFilterWhenEnabled = (x: DiscreteCriterion) => {
        setTypeFilterBehaviorWhenEnabled(x.behavior);
        setTypeFilterOptionsWhenEnabled(x.options as any);
    };

    // "dt" prefix
    const [dateFilterBehaviorWhenEnabled, setDateFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("dtb", gDefaultStaticFilterValue.dateFilterBehavior);
    const [dateFilterOptionsWhenEnabled, setDateFilterOptionsWhenEnabled] = useURLState<number[]>("dto", gDefaultStaticFilterValue.dateFilterOptions);
    const [dateFilterEnabled, setDateFilterEnabled] = useURLState<boolean>("dte", gDefaultStaticFilterValue.dateFilterEnabled);

    const dateFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "startsAt",
        behavior: dateFilterBehaviorWhenEnabled,
        options: dateFilterOptionsWhenEnabled,
    };
    const setDateFilterWhenEnabled = (x: DiscreteCriterion) => {
        setDateFilterBehaviorWhenEnabled(x.behavior);
        setDateFilterOptionsWhenEnabled(x.options as any);
    };

    // the default basic filter spec when no params specified.
    const filterSpec: EventsFilterSpec = {
        pageSize: 20,
        refreshSerial,
        page,

        // in dto...
        quickFilter,

        orderByColumn: sortColumn as any,
        orderByDirection: sortDirection,

        tagFilter: tagFilterEnabled ? tagFilterWhenEnabled : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        statusFilter: statusFilterEnabled ? statusFilterWhenEnabled : { db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        typeFilter: typeFilterEnabled ? typeFilterWhenEnabled : { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        dateFilter: dateFilterEnabled ? dateFilterWhenEnabled : { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    const [results, setResults] = React.useState<SearchResultsRet>({
        facets: [],
        results: [],
        rowCount: 0,
        customData: null,
        queryMetrics: [],
        filterQueryResult: {
            errors: [],
            sqlSelect: "",
        },
    });

    // # when filter spec (other than page change), reset page to 0.
    let everythingButPage: any = {};
    { // avoid collision with `page`
        const { page, ...everythingButPage__ } = filterSpec;
        everythingButPage = everythingButPage__;
    }

    const specHash = JSON.stringify(everythingButPage);
    // React.useEffect(() => {
    //     setFilterSpec({ ...filterSpec, page: 0 });
    // }, [specHash]);
    React.useEffect(() => {
        setPage(0);
    }, [specHash]);

    const enrichedEvents = results.results.map(e => db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext));

    const handleCopyFilterspec = () => {
        const o: EventsFilterSpecStatic = {
            label: "(n/a)",
            helpText: "",
            orderByColumn: sortColumn as any,
            orderByDirection: sortDirection,

            statusFilterEnabled,
            statusFilterBehavior: statusFilterBehaviorWhenEnabled,
            statusFilterOptions: statusFilterOptionsWhenEnabled,

            typeFilterEnabled,
            typeFilterBehavior: typeFilterBehaviorWhenEnabled,
            typeFilterOptions: typeFilterOptionsWhenEnabled,

            tagFilterEnabled,
            tagFilterBehavior: tagFilterBehaviorWhenEnabled,
            tagFilterOptions: tagFilterOptionsWhenEnabled,

            dateFilterEnabled,
            dateFilterBehavior: dateFilterBehaviorWhenEnabled,
            dateFilterOptions: dateFilterOptionsWhenEnabled,
        }
        const txt = JSON.stringify(o, null, 2);
        navigator.clipboard.writeText(txt).then(() => {
            snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
        }).catch(() => {
            // nop
        });
    };

    const handleClickStaticFilter = (x: EventsFilterSpecStatic) => {
        setSortColumn(x.orderByColumn);
        setSortDirection(x.orderByDirection);

        setTypeFilterEnabled(x.typeFilterEnabled);
        setTypeFilterBehaviorWhenEnabled(x.typeFilterBehavior);
        setTypeFilterOptionsWhenEnabled(x.typeFilterOptions);

        setStatusFilterEnabled(x.statusFilterEnabled);
        setStatusFilterBehaviorWhenEnabled(x.statusFilterBehavior);
        setStatusFilterOptionsWhenEnabled(x.statusFilterOptions);

        setTagFilterEnabled(x.tagFilterEnabled);
        setTagFilterBehaviorWhenEnabled(x.tagFilterBehavior);
        setTagFilterOptionsWhenEnabled(x.tagFilterOptions);

        setDateFilterEnabled(x.dateFilterEnabled);
        setDateFilterBehaviorWhenEnabled(x.dateFilterBehavior);
        setDateFilterOptionsWhenEnabled(x.dateFilterOptions);
    };

    const MatchesStaticFilter = (x: EventsFilterSpecStatic): boolean => {
        if (sortColumn !== x.orderByColumn) return false;
        if (sortDirection !== x.orderByDirection) return false;

        if (x.typeFilterEnabled !== typeFilterEnabled) return false;
        if (typeFilterEnabled) {
            if (typeFilterBehaviorWhenEnabled !== x.typeFilterBehavior) return false;
            if (!arraysContainSameValues(typeFilterOptionsWhenEnabled, x.typeFilterOptions)) return false;
        }

        if (x.statusFilterEnabled !== statusFilterEnabled) return false;
        if (statusFilterEnabled) {
            if (statusFilterBehaviorWhenEnabled !== x.statusFilterBehavior) return false;
            if (!arraysContainSameValues(statusFilterOptionsWhenEnabled, x.statusFilterOptions)) return false;
        }

        if (x.tagFilterEnabled !== tagFilterEnabled) return false;
        if (tagFilterEnabled) {
            if (tagFilterBehaviorWhenEnabled !== x.tagFilterBehavior) return false;
            if (!arraysContainSameValues(tagFilterOptionsWhenEnabled, x.tagFilterOptions)) return false;
        }

        if (x.dateFilterEnabled !== dateFilterEnabled) return false;
        if (dateFilterEnabled) {
            if (dateFilterBehaviorWhenEnabled !== x.dateFilterBehavior) return false;
            if (!arraysContainSameValues(dateFilterOptionsWhenEnabled, x.dateFilterOptions)) return false;
        }

        return true;
    };

    const matchingStaticFilter = gStaticFilters.find(x => MatchesStaticFilter(x));

    const hasExtraFilters = ((): boolean => {
        if (!!matchingStaticFilter) return false;
        if (typeFilterEnabled) return true;
        if (statusFilterEnabled) return true;
        if (tagFilterEnabled) return true;
        if (dateFilterEnabled) return true;
        return false;
    })();

    const hasAnyFilters = hasExtraFilters;

    return <>
        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">

                {dashboardContext.isShowingAdminControls && <CMSmallButton onClick={handleCopyFilterspec}>Copy filter spec</CMSmallButton>}

                {/* <EventsControls onChange={setFilterSpec} filterSpec={filterSpec} filterInfo={filterInfo} /> */}
                <FilterControls
                    inCard={false}
                    onQuickFilterChange={(v) => setQuickFilter(v)}
                    onResetFilter={() => {
                        handleClickStaticFilter(gDefaultStaticFilterValue);
                    }}
                    hasAnyFilters={hasAnyFilters}
                    hasExtraFilters={hasExtraFilters}
                    quickFilterText={filterSpec.quickFilter}
                    primaryFilter={
                        <div>
                            <CMChipContainer>
                                {
                                    gStaticFilters.map(e => {
                                        const doesMatch = e.label === matchingStaticFilter?.label;// MatchesStaticFilter(e[1]);
                                        return <CMChip
                                            key={e.label}
                                            onClick={() => handleClickStaticFilter(e)} size="small"
                                            variation={{ ...StandardVariationSpec.Strong, selected: doesMatch }}
                                            shape="rectangle"
                                        >
                                            {e.label}
                                        </CMChip>;
                                    })
                                }
                                {matchingStaticFilter && <div className="tinyCaption">{matchingStaticFilter.helpText}</div>}
                            </CMChipContainer>
                        </div>
                    }
                    extraFilter={
                        <div>
                            <TagsFilterGroup
                                label={"Status"}
                                style="foreignSingle"
                                errorMessage={results.filterQueryResult.errors.find(x => x.column === "status")?.error}
                                value={statusFilterWhenEnabled}
                                filterEnabled={statusFilterEnabled}
                                onChange={(n, enabled) => {
                                    setStatusFilterEnabled(enabled);
                                    setStatusFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "status")?.items || []}
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                label={"Type"}
                                style="foreignSingle"
                                errorMessage={results.filterQueryResult.errors.find(x => x.column === "type")?.error}
                                value={typeFilterWhenEnabled}
                                filterEnabled={typeFilterEnabled}
                                onChange={(n, enabled) => {
                                    setTypeFilterEnabled(enabled);
                                    setTypeFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "type")?.items || []}
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                label={"Tags"}
                                style="tags"
                                filterEnabled={tagFilterEnabled}
                                errorMessage={results.filterQueryResult.errors.find(x => x.column === "tags")?.error}
                                value={tagFilterWhenEnabled}
                                onChange={(n, enabled) => {
                                    setTagFilterEnabled(enabled);
                                    setTagFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "tags")?.items || []}
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                label={"Date"}
                                style="radio"
                                filterEnabled={dateFilterEnabled}
                                errorMessage={results.filterQueryResult.errors.find(x => x.column === "startsAt")?.error}
                                value={dateFilterWhenEnabled}
                                onChange={(n, enabled) => {
                                    setDateFilterEnabled(enabled);
                                    setDateFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "startsAt")?.items || []}
                            />

                        </div>
                    } // extra filter
                    footerFilter={
                        <div>
                            <div className="divider" />
                            <SortByGroup
                                columnOptions={Object.keys(OrderByColumnOptions)}
                                setValue={setSortModel}
                                value={sortModel}
                            />
                        </div>
                    }
                />
            </div>

            <Suspense fallback={<div className="queryProgressLine loading"></div>}>
                <EventListQuerier filterSpec={filterSpec} setResults={setResults} />
            </Suspense>
        </CMSinglePageSurfaceCard >
        <EventsList
            filterSpec={filterSpec}
            //setFilterSpec={setFilterSpec}
            setPage={setPage}
            events={enrichedEvents}
            results={results}
            refetch={() => setRefreshSerial(filterSpec.refreshSerial + 1)}
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
