import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventsFilterSpec } from 'src/core/components/EventComponentsBase';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { GetSearchResultsInput, MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";
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


function GetSearchResultsQueryArgs(filterSpec: EventsFilterSpec, offset: number, take: number) {
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




export function useEventListData(filterSpec: EventsFilterSpec, pageSize: number = gPageSize) {
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
            const searchResult = await fetchSearchResultsApi(GetSearchResultsQueryArgs(filterSpec, offset, pageSize));
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
        void fetchData(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterSpecHash]);

    // Function to load more data, passed to InfiniteScroll
    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        //if (isFetchingRef.current || !hasMore) return;
        void fetchData(enrichedEvents.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [/*hasMore, */enrichedEvents]);

    return { enrichedEvents, results, loadMoreData/*, hasMore*/ };
}

