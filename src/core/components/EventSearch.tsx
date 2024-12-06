import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventsFilterSpec } from 'src/core/components/EventComponentsBase';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { fetchSearchResultsApi } from './SearchBase';

const gPageSize = 20;

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

    const isFetchingRef = useRef(false);
    const totalEventsFetchedRef = useRef(0);

    const fetchData = async (offset: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const searchResult = await fetchSearchResultsApi(GetSearchResultsQueryArgs(filterSpec, offset, pageSize));

            const newEvents = searchResult.results.map(e =>
                db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext)
            );

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

    useEffect(() => {
        setEnrichedEvents([]);
        setResults(MakeEmptySearchResultsRet());
        totalEventsFetchedRef.current = 0;
        // Fetch the first page
        void fetchData(0);
    }, [filterSpecHash]);

    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        void fetchData(enrichedEvents.length);
    }, [enrichedEvents]);

    return { enrichedEvents, results, loadMoreData };
}

