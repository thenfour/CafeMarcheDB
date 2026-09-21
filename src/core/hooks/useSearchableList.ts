import { useCallback, useEffect, useRef, useState } from 'react';
import { GetSearchResultsInput, MakeEmptySearchResultsRet, SearchResultsRet } from 'src/core/db3/shared/apiTypes';
import type { TAnyModel } from 'shared/rootroot';
import * as db3 from 'src/core/db3/db3';
import { DashboardContextData, useDashboardContext } from '../components/dashboardContext/DashboardContext';
import { fetchSearchResultsApi } from '../components/search/SearchBase';
import { useSnackbar } from '../components/SnackbarContext';

const DEFAULT_PAGE_SIZE = 20;

// Generic configuration for different search types
export interface SearchableListConfig<
    TFilterSpec,
    TTransportItem extends TAnyModel,
    TClientItem extends TAnyModel,
> {
    // Function to build the search query arguments from filter spec
    getQueryArgs: (filterSpec: TFilterSpec, offset: number, take: number) => GetSearchResultsInput;
    materializeItem: (transportItem: TTransportItem, dashboardContext: DashboardContextData) => TClientItem;
    getItemKey: (clientItem: TClientItem) => string | number;

    // Error message to show when fetch fails
    errorMessage?: string;
}

type ViewSearchQueryInput = Omit<GetSearchResultsInput, "tableID" | "viewID">;

export function defineViewSearchConfig<
    TFilterSpec,
    TView extends db3.AnyDB3View,
>(args: {
    view: TView;
    getQueryArgs: (filterSpec: TFilterSpec, offset: number, take: number) => ViewSearchQueryInput;
    errorMessage?: string;
}): SearchableListConfig<TFilterSpec, db3.DtoOf<TView>, db3.ClientOf<TView>> {
    return {
        getQueryArgs: (filterSpec, offset, take) => ({
            ...args.getQueryArgs(filterSpec, offset, take),
            tableID: args.view.tableID,
            viewID: args.view.viewID,
        }),
        materializeItem: (transportItem, dashboardContext) => db3.hydrateView(
            args.view,
            args.view.parseDto(transportItem),
            dashboardContext.referenceStore,
        ),
        getItemKey: args.view.entity.getIdentity,
        errorMessage: args.errorMessage,
    };
}

export function defineLegacySearchConfig<
    TFilterSpec,
    TRawItem extends TAnyModel,
    TEnrichedItem extends TAnyModel,
>(args: {
    getQueryArgs: (filterSpec: TFilterSpec, offset: number, take: number) => GetSearchResultsInput;
    enrichItem: (rawItem: TRawItem, dashboardContext: DashboardContextData) => TEnrichedItem;
    getItemKey: (clientItem: TEnrichedItem) => string | number;
    errorMessage?: string;
}): SearchableListConfig<TFilterSpec, TRawItem, TEnrichedItem> {
    return {
        getQueryArgs: args.getQueryArgs,
        materializeItem: args.enrichItem,
        getItemKey: args.getItemKey,
        errorMessage: args.errorMessage,
    };
}

export interface UseSearchableListResult<TTransportItem extends TAnyModel, TClientItem extends TAnyModel> {
    enrichedItems: TClientItem[];
    results: SearchResultsRet<TTransportItem>;
    loadMoreData: () => void;
    loading: boolean;
}

export function useSearchableList<
    TFilterSpec,
    TTransportItem extends TAnyModel,
    TClientItem extends TAnyModel,
>(
    filterSpec: TFilterSpec,
    config: SearchableListConfig<TFilterSpec, TTransportItem, TClientItem>,
    pageSize: number = DEFAULT_PAGE_SIZE
): UseSearchableListResult<TTransportItem, TClientItem> {
    const dashboardContext = useDashboardContext();
    const snackbarContext = useSnackbar();

    const filterSpecHash = JSON.stringify(filterSpec);

    const [enrichedItems, setEnrichedItems] = useState<TClientItem[]>([]);
    const [results, setResults] = useState<SearchResultsRet<TTransportItem>>(MakeEmptySearchResultsRet<TTransportItem>());
    const [loading, setLoading] = useState(false);

    const activeRequest = useRef<AbortController | null>(null);

    const fetchData = async (offset: number) => {
        if (activeRequest.current) return;
        const request = new AbortController();
        activeRequest.current = request;
        setLoading(true);

        try {
            const queryArgs = config.getQueryArgs(filterSpec, offset, pageSize);
            //console.log('Fetching search results with args:', queryArgs);
            const searchResult = await fetchSearchResultsApi<TTransportItem>(queryArgs, request.signal);
            if (request.signal.aborted || activeRequest.current !== request) return;
            const newItemsDb = searchResult.results.map(rawItem => config.materializeItem(rawItem, dashboardContext));

            setEnrichedItems(prevItems => {
                const newItems: TClientItem[] = [];

                for (const item of newItemsDb) {
                    const itemKey = config.getItemKey(item);
                    const foundIndex = prevItems.findIndex(existing => config.getItemKey(existing) === itemKey);
                    if (foundIndex === -1) {
                        newItems.push(item);
                    }
                }

                const ret = [...prevItems, ...newItems];
                return ret;
            });

            setResults(searchResult);
        } catch (error) {
            if (request.signal.aborted || activeRequest.current !== request) return;
            snackbarContext.showMessage({
                severity: 'error',
                children: config.errorMessage || 'Failed to load more items.',
            });
        } finally {
            if (activeRequest.current === request) {
                activeRequest.current = null;
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        activeRequest.current?.abort();
        activeRequest.current = null;
        setEnrichedItems([]);
        setResults(MakeEmptySearchResultsRet<TTransportItem>());
        // Fetch the first page
        void fetchData(0);
        return () => {
            activeRequest.current?.abort();
            activeRequest.current = null;
        };
    }, [filterSpecHash]);

    const loadMoreData = useCallback(() => {
        if (activeRequest.current) return;
        void fetchData(enrichedItems.length);
    }, [enrichedItems, filterSpecHash]);

    return { enrichedItems, results, loadMoreData, loading };
}
