import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { BlitzPage } from "@blitzjs/next";
import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV, arraysContainSameValues } from "shared/utils";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { AdminInspectObject, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, useURLState } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventListItem } from "src/core/components/EventComponents";
import { FilterControls, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { getURIForEvent } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterion, DiscreteCriterionFilterType, GetSearchResultsInput, MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { EventOrderByColumnOption, EventOrderByColumnOptions, EventsFilterSpec } from 'src/core/components/EventComponentsBase';
import superjson from 'superjson';

const gPageSize = 15;

async function fetchSearchResultsApi(args: GetSearchResultsInput): Promise<SearchResultsRet> {
    const serializedArgs = superjson.stringify(args);
    const encodedArgs = encodeURIComponent(serializedArgs);

    //console.log(`fetching items [${args.offset}, ${args.take}]`);

    const response = await fetch(
        `/api/search/getSearchResultsApi?args=${encodedArgs}`
    );

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return superjson.parse(await response.text());
}


function GetSearchResultsQueryArgs(filterSpec: EventsFilterSpec, offset: number, take: number = gPageSize) {
    return {
        offset,
        take,
        tableID: db3.xEvent.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.dateFilter,
            filterSpec.typeFilter,
            filterSpec.statusFilter,
            filterSpec.tagFilter,
        ],
    };
}




function useEventListData(filterSpec: EventsFilterSpec) {
    const dashboardContext = useContext(DashboardContext);
    const snackbarContext = useContext(SnackbarContext);

    const filterSpecHash = JSON.stringify(filterSpec);

    const [enrichedEvents, setEnrichedEvents] = useState<db3.EnrichedSearchEventPayload[]>([]);
    const [results, setResults] = useState<SearchResultsRet>(MakeEmptySearchResultsRet());
    //const [hasMore, setHasMore] = useState(true);

    const isFetchingRef = useRef(false);
    const totalEventsFetchedRef = useRef(0);

    const fetchData = async (offset: number) => {
        //if (isFetchingRef.current || !hasMore) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const searchResult = await fetchSearchResultsApi(GetSearchResultsQueryArgs(filterSpec, offset));
            //console.log(searchResult);

            const newEvents = searchResult.results.map(e =>
                db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext)
            );

            // if (newEvents.length < 1) {
            //     setHasMore(false);
            // }

            setEnrichedEvents(prevEvents => {
                const newItems: db3.EnrichedSearchEventPayload[] = [];
                const overlaps: db3.EnrichedSearchEventPayload[] = [];

                for (const event of newEvents) {
                    const foundIndex = prevEvents.findIndex(e => e.id === event.id);
                    if (foundIndex === -1) {
                        newItems.push(event);
                    } else {
                        // the item already exists; just leave it.
                        overlaps.push(event);
                    }
                }

                const ret = [...prevEvents, ...newItems];
                // console.log(`new enriched events ${prevEvents.length} + ${newEvents.length} => ${ret.length} (${overlaps.length} overlap)`);
                // console.log(`    ${JSON.stringify(prevEvents.map(e => e.id))}`);
                // console.log(`  + ${JSON.stringify(newEvents.map(e => e.id))} (overlaps: ${JSON.stringify(overlaps.map(e => e.id))})`);
                return ret;
            });

            setResults(searchResult);
        } catch (error) {
            snackbarContext.showMessage({
                severity: 'error',
                children: 'Failed to load more events.',
            });
        } finally {
            isFetchingRef.current = false;
        }
    };

    // Reset data when filters change
    useEffect(() => {
        //console.log(`fetching due to filterspec change`);
        setEnrichedEvents([]);
        setResults(MakeEmptySearchResultsRet());
        //setHasMore(true);
        totalEventsFetchedRef.current = 0;
        // Fetch the first page
        fetchData(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterSpecHash]);

    // Function to load more data, passed to InfiniteScroll
    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        //if (isFetchingRef.current || !hasMore) return;
        fetchData(enrichedEvents.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [/*hasMore, */enrichedEvents]);

    return { enrichedEvents, results, loadMoreData/*, hasMore*/ };
}


// for serializing in compact querystring
interface EventsFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: EventOrderByColumnOption;
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
        URL: getURIForEvent(e),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}




interface EventsListArgs {
    filterSpec: EventsFilterSpec,
    results: SearchResultsRet;
    events: db3.EnrichedSearchEventPayload[],
    refetch: () => void;
    loadMoreData: () => void;
    hasMore: boolean;
};

const EventsList = ({ filterSpec, results, events, refetch, loadMoreData, hasMore }: EventsListArgs) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const handleCopy = async () => {
        await CopyEventListCSV(snackbarContext, events);
    };

    return <div className="eventList searchResults">
        <div className="searchRecordCount">
            {results.rowCount === 0 ? "No items to show" : <>Displaying {events.length} items of {results.rowCount} total</>}
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

        <InfiniteScroll
            dataLength={events.length}
            next={loadMoreData}
            hasMore={hasMore}
            loader={<h4>Loading...</h4>}
            scrollableTarget="scrollableDiv"
        >
            {events.map((event, i) => (
                <EventListItem
                    key={event.id}
                    event={event}
                    filterSpec={filterSpec}
                    refetch={refetch}
                    results={results}
                />
            ))}
        </InfiniteScroll>

    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////

const gStaticFilters: EventsFilterSpecStatic[] = [
    {
        label: "Everything",
        helpText: "Searching all events",
        orderByColumn: EventOrderByColumnOptions.startsAt,
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
        "orderByDirection": "desc",
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
    {
        "label": "Past concerts",
        "helpText": "",
        "orderByColumn": "startsAt",
        "orderByDirection": "desc",
        "statusFilterEnabled": true,
        "statusFilterBehavior": "hasSomeOf" as any,
        "statusFilterOptions": [
            4
        ],
        "typeFilterEnabled": true,
        "typeFilterBehavior": "hasSomeOf" as any,
        "typeFilterOptions": [
            1
        ],
        "tagFilterEnabled": false,
        "tagFilterBehavior": "hasAllOf" as any,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": "hasAllOf" as any,
        "dateFilterOptions": [
            10000
        ]
    },
];

const gDefaultStaticFilterName = "Relevant" as const;
const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;


//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const snackbarContext = React.useContext(SnackbarContext);

    //const [page, setPage] = useURLState<number>("p", 0);
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
        //pageSize: gPageSize,
        refreshSerial,
        //page,

        // in dto...
        quickFilter,

        orderByColumn: sortColumn as any,
        orderByDirection: sortDirection,

        tagFilter: tagFilterEnabled ? tagFilterWhenEnabled : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        statusFilter: statusFilterEnabled ? statusFilterWhenEnabled : { db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        typeFilter: typeFilterEnabled ? typeFilterWhenEnabled : { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        dateFilter: dateFilterEnabled ? dateFilterWhenEnabled : { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    const { enrichedEvents, results, /*hasMore, */loadMoreData } = useEventListData(filterSpec,);

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
        console.log(o);
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
                <AdminInspectObject src={filterSpec} label="Filter spec" />
                <AdminInspectObject src={results} label="Results obj" />

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
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "status")?.error}
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
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "type")?.error}
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
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "tags")?.error}
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
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "startsAt")?.error}
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
                                columnOptions={Object.keys(EventOrderByColumnOptions)}
                                setValue={setSortModel}
                                value={sortModel}
                            />
                        </div>
                    }
                />
            </div>

        </CMSinglePageSurfaceCard >
        <EventsList
            filterSpec={filterSpec}
            events={enrichedEvents}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedEvents.length < results.rowCount}
            refetch={() => setRefreshSerial(refreshSerial + 1)}
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
                <NewEventButton />

                <EventListOuter />
            </div>
        </DashboardLayout>
    )
}

export default SearchEventsPage;
