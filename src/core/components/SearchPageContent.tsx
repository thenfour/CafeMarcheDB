import React from "react";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SearchPageFilterControls, createFilterGroupConfig } from "src/core/components/SearchPageFilterControls";
import { SearchResultsList } from "src/core/components/SearchResultsList";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { DiscreteFilterState, useSearchPage } from "src/core/hooks/useSearchFilters";
import { SearchableListConfig, useSearchableList } from "src/core/hooks/useSearchableList";

//////////////////////////////////////////////////////////////////////////////////////////////////
// Configuration interfaces for SearchPageContent
//////////////////////////////////////////////////////////////////////////////////////////////////

export interface FilterGroupDefinition {
    key: string; // Key for the filter group (e.g., "tags", "status")
    label: string; // Display label (e.g., "Tags", "Status")
    type: "tags" | "foreignSingle" | "radio" | string; // Filter UI type
    column: string; // Column for options lookup (e.g., "tags", "status")
    chipTransformer?: (option: any) => any; // Optional chip transformer
}

export interface SearchPageContentConfig<TStaticFilterSpec extends Record<string, any>, TFilterSpec, TRawItem, TItem> {
    // Static filters configuration
    staticFilters: TStaticFilterSpec[];
    defaultStaticFilter: TStaticFilterSpec;

    // Sort configuration
    sortColumnOptions: Record<string, string>; // Available sort options enum    // Data fetching configuration
    searchConfig: SearchableListConfig<TFilterSpec, TRawItem, TItem>;

    // Rendering configuration
    renderItem: (item: TItem, index: number, filterSpec: TFilterSpec, results: SearchResultsRet, refetch: () => void) => React.ReactNode;
    getItemKey: (item: TItem) => string | number;
    contextMarkerName?: string;
    className?: string;

    // CSV Export configuration
    csvExporter?: {
        itemToCSVRow: (item: TItem, index: number) => Record<string, string | number>;
        filename?: string;
    };

    // Admin controls
    showAdminControls?: boolean;
}

export interface SearchPageContentProps<TStaticFilterSpec extends Record<string, any>, TFilterSpec, TRawItem, TItem> {
    config: SearchPageContentConfig<TStaticFilterSpec, TFilterSpec, TRawItem, TItem>;
    // The calling component must pass these due to React hook constraints
    filterHooks: Record<string, DiscreteFilterState<any>>;
    filterGroupDefinitions: FilterGroupDefinition[];
    searchPageHook: ReturnType<typeof useSearchPage<TStaticFilterSpec, TFilterSpec>>;
}

/**
 * Generic search page content component that handles the common search page rendering logic.
 * 
 * Due to React hooks constraints (hooks can't be called conditionally), the calling component
 * must set up the filter hooks and search page hook, then pass them to this component.
 * 
 * This still eliminates a lot of repetitive rendering logic across search pages.
 */
export const SearchPageContent = <
    TStaticFilterSpec extends Record<string, any> & { label: string; helpText: string },
    TFilterSpec extends { quickFilter?: string },
    TRawItem,
    TItem
>({
    config,
    filterHooks,
    filterGroupDefinitions,
    searchPageHook
}: SearchPageContentProps<TStaticFilterSpec, TFilterSpec, TRawItem, TItem>): React.JSX.Element => {
    const dashboardContext = React.useContext(DashboardContext);    // Get data using the configured search config
    const dataHookRet = useSearchableList(searchPageHook.filterSpec, config.searchConfig);
    const { enrichedItems = [], results, loadMoreData } = dataHookRet;

    const filterGroups = filterGroupDefinitions.map(def => {
        const filterHook = filterHooks[def.key];
        if (!filterHook) {
            throw new Error(`Filter hook not found for key: ${def.key}`);
        }
        return createFilterGroupConfig(
            def.key,
            def.label,
            def.type as "tags" | "foreignSingle" | "radio",
            def.column,
            filterHook,
            def.chipTransformer
        );
    });

    return (
        <>
            <SearchPageFilterControls
                searchPage={searchPageHook}
                staticFilters={config.staticFilters}
                filterGroups={filterGroups}
                sortConfig={{
                    columnOptions: Object.keys(config.sortColumnOptions),
                    columnOptionsEnum: config.sortColumnOptions as any,
                }}
                results={results}
                showAdminControls={config.showAdminControls ?? true}
            />

            <SearchResultsList
                items={enrichedItems}
                results={results}
                filterSpec={searchPageHook.filterSpec}
                loadMoreData={loadMoreData}
                hasMore={enrichedItems.length < results.rowCount}
                refetch={() => searchPageHook.setRefreshSerial(x => x + 1)}
                csvExporter={config.csvExporter}
                contextMarkerName={config.contextMarkerName}
                renderItem={(item, index) => config.renderItem(item, index, searchPageHook.filterSpec, results, () => searchPageHook.setRefreshSerial(x => x + 1))}
                getItemKey={config.getItemKey}
                className={config.className}
            />
        </>
    );
};
