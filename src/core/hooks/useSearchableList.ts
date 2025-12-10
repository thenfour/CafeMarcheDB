import { useCallback, useEffect, useRef, useState } from 'react';
import { GetSearchResultsInput, MakeEmptySearchResultsRet, SearchResultsRet } from 'src/core/db3/shared/apiTypes';
import { useDashboardContext } from '../components/dashboardContext/DashboardContext';
import { fetchSearchResultsApi } from '../components/search/SearchBase';
import { useSnackbar } from '../components/SnackbarContext';

const DEFAULT_PAGE_SIZE = 20;

// Generic configuration for different search types
export interface SearchableListConfig<TFilterSpec, TRawItem, TEnrichedItem> {
    // Function to build the search query arguments from filter spec
    getQueryArgs: (filterSpec: TFilterSpec, offset: number, take: number) => GetSearchResultsInput;

    // Function to enrich raw items from the API
    enrichItem: (rawItem: TRawItem, dashboardContext: any, ...additionalArgs: any[]) => TEnrichedItem;

    // Optional function to extract additional enrichment arguments
    getEnrichmentArgs?: (dashboardContext: any) => any[];

    // Error message to show when fetch fails
    errorMessage?: string;
}

export interface UseSearchableListResult<TEnrichedItem> {
    enrichedItems: TEnrichedItem[];
    results: SearchResultsRet;
    loadMoreData: () => void;
    loading: boolean;
}

export function useSearchableList<TFilterSpec, TRawItem, TEnrichedItem>(
    filterSpec: TFilterSpec,
    config: SearchableListConfig<TFilterSpec, TRawItem, TEnrichedItem>,
    pageSize: number = DEFAULT_PAGE_SIZE
): UseSearchableListResult<TEnrichedItem> {
    const dashboardContext = useDashboardContext();
    const snackbarContext = useSnackbar();

    const filterSpecHash = JSON.stringify(filterSpec);

    const [enrichedItems, setEnrichedItems] = useState<TEnrichedItem[]>([]);
    const [results, setResults] = useState<SearchResultsRet>(MakeEmptySearchResultsRet());
    const [loading, setLoading] = useState(false);

    const isFetchingRef = useRef(false);

    const fetchData = async (offset: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);

        try {
            const queryArgs = config.getQueryArgs(filterSpec, offset, pageSize);
            //console.log('Fetching search results with args:', queryArgs);
            const searchResult = await fetchSearchResultsApi(queryArgs);
            setLoading(false);
            const enrichmentArgs = config.getEnrichmentArgs ? config.getEnrichmentArgs(dashboardContext) : [];

            const newItemsDb = searchResult.results.map(rawItem =>
                config.enrichItem(rawItem as TRawItem, dashboardContext, ...enrichmentArgs)
            );

            setEnrichedItems(prevItems => {
                const newItems: TEnrichedItem[] = [];
                const overlaps: TEnrichedItem[] = [];

                for (const item of newItemsDb) {
                    // Assume all items have an 'id' property for deduplication
                    const foundIndex = prevItems.findIndex(e => (e as any).id === (item as any).id);
                    if (foundIndex === -1) {
                        newItems.push(item);
                    } else {
                        // the item already exists; just leave it.
                        overlaps.push(item);
                    }
                }

                const ret = [...prevItems, ...newItems];
                return ret;
            });

            setResults(searchResult);
        } catch (error) {
            snackbarContext.showMessage({
                severity: 'error',
                children: config.errorMessage || 'Failed to load more items.',
            });
        } finally {
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        setEnrichedItems([]);
        setResults(MakeEmptySearchResultsRet());
        // Fetch the first page
        void fetchData(0);
    }, [filterSpecHash]);

    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        void fetchData(enrichedItems.length);
    }, [enrichedItems]);

    return { enrichedItems, results, loadMoreData, loading };
}
