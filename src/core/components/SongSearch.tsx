import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { fetchSearchResultsApi } from './SearchBase';
import { EnrichedVerboseSong, SongsFilterSpec } from './SongComponentsBase';

const gPageSize = 20;

function GetSearchResultsQueryArgs(filterSpec: SongsFilterSpec, offset: number, take: number) {
    return {
        offset,
        take,
        tableID: db3.xSong_Verbose.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.tagFilter,
        ],
    };
}

export function useSongListData(filterSpec: SongsFilterSpec, pageSize: number = gPageSize) {
    const dashboardContext = useContext(DashboardContext);
    const snackbarContext = useContext(SnackbarContext);

    const filterSpecHash = JSON.stringify(filterSpec);

    const [enrichedItems, setEnrichedItems] = useState<EnrichedVerboseSong[]>([]);
    const [results, setResults] = useState<SearchResultsRet>(MakeEmptySearchResultsRet());

    const isFetchingRef = useRef(false);
    const totalItemsFetchedRef = useRef(0);

    const fetchData = async (offset: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const searchResult = await fetchSearchResultsApi(GetSearchResultsQueryArgs(filterSpec, offset, pageSize));

            const newItemsDb = searchResult.results.map(e =>
                db3.enrichSong(e as db3.SongPayload_Verbose, dashboardContext)
            );

            setEnrichedItems(prevEvents => {
                const newItems: EnrichedVerboseSong[] = [];
                const overlaps: EnrichedVerboseSong[] = [];

                for (const item of newItemsDb) {
                    const foundIndex = prevEvents.findIndex(e => e.id === item.id);
                    if (foundIndex === -1) {
                        newItems.push(item);
                    } else {
                        // the item already exists; just leave it.
                        overlaps.push(item);
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
        setEnrichedItems([]);
        setResults(MakeEmptySearchResultsRet());
        totalItemsFetchedRef.current = 0;
        // Fetch the first page
        void fetchData(0);
    }, [filterSpecHash]);

    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        void fetchData(enrichedItems.length);
    }, [enrichedItems]);

    return { enrichedItems, results, loadMoreData };
}

