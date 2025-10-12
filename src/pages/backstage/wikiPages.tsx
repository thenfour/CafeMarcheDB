import { EnrichedVerboseWikiPage, WikiPageOrderByColumnNames, WikiPageOrderByColumnOption, WikiPageOrderByColumnOptions, WikiPagesFilterSpec } from "@/src/core/components/wiki/WikiClientBaseTypes";
import { WikiPageListItem } from "@/src/core/components/wiki/WikiPageListItem";
import { wikiParseCanonicalWikiPath } from "@/src/core/wiki/shared/wikiUtils";
import { BlitzPage } from "@blitzjs/next";
import React from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { AppContextMarker } from "src/core/components/AppContext";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
import { getAbsoluteUrl } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { wikiPageSearchConfig } from "src/core/hooks/searchConfigs";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";

// for serializing in compact querystring
interface WikiPagesFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: WikiPageOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];

    namespaceFilterEnabled: boolean;
    namespaceFilterBehavior: DiscreteCriterionFilterType;
    namespaceFilterOptions: string[];
}

// predefined filter sets
const gDefaultStaticFilterValue: WikiPagesFilterSpecStatic = {
    label: "All wiki pages",
    helpText: "",
    orderByColumn: WikiPageOrderByColumnOptions.slug,
    orderByDirection: "asc",

    tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
    tagFilterOptions: [],
    tagFilterEnabled: false,

    namespaceFilterBehavior: DiscreteCriterionFilterType.doesntHaveAnyOf,
    namespaceFilterOptions: ["EventDescription"],
    namespaceFilterEnabled: true,
};

const gStaticFilters: WikiPagesFilterSpecStatic[] = []

const WikiPageListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);

    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter({
        urlPrefix: "ta",
        db3Column: "tags",
        defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
    });

    const namespaceFilter = useDiscreteFilter<string>({
        urlPrefix: "ns",
        db3Column: "namespace",
        defaultBehavior: gDefaultStaticFilterValue.namespaceFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.namespaceFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.namespaceFilterEnabled,
    });

    // Using useSearchPage hook for centralized search page logic
    const searchPage = useSearchPage<WikiPagesFilterSpecStatic, WikiPagesFilterSpec>({
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnKey: "orderByColumn",
        sortDirectionKey: "orderByDirection",
        filterMappings: [
            { filterHook: tagFilter, columnKey: "tagFilter" },
            { filterHook: namespaceFilter, columnKey: "namespaceFilter" },
        ],
        buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
            const filterSpec: WikiPagesFilterSpec = {
                refreshSerial,
                quickFilter,
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                namespaceFilter: namespaceFilter.enabled ? namespaceFilter.criterion : { db3Column: "namespace", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            };
            return filterSpec;
        },
        buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
            const staticSpec: WikiPagesFilterSpecStatic = {
                label: "(n/a)",
                helpText: "",
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                tagFilterOptions: tagFilter.criterion.options as number[],
                namespaceFilterEnabled: namespaceFilter.enabled,
                namespaceFilterBehavior: namespaceFilter.criterion.behavior,
                namespaceFilterOptions: namespaceFilter.criterion.options as string[],
            };
            return staticSpec;
        }
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<WikiPagesFilterSpecStatic, WikiPagesFilterSpec, db3.WikiPagePayload, EnrichedVerboseWikiPage> = {
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnOptions: WikiPageOrderByColumnOptions,
        sortColumnNames: WikiPageOrderByColumnNames,
        searchConfig: wikiPageSearchConfig,
        renderItem: (wikiPage, index, filterSpec, results, refetch) => (
            <WikiPageListItem
                index={index}
                wikiPage={wikiPage}
                results={results}
                refetch={refetch}
                filterSpec={filterSpec}
            />
        ),
        getItemKey: (wikiPage) => wikiPage.id,
        contextMarkerName: "Wiki pages list",
        csvExporter: {
            itemToCSVRow: (wikiPage, index) => {
                const path = wikiParseCanonicalWikiPath(wikiPage.slug);
                return {
                    Order: (index + 1).toString(),
                    ID: wikiPage.id.toString(),
                    Slug: wikiPage.slug,
                    Namespace: wikiPage.namespace || "",
                    URL: getAbsoluteUrl(path.uriRelativeToHost),
                }
            }
        },
        className: "wikiPagesListContainer",
        showAdminControls: true,
    };

    // Filter hooks for passing to the generic component
    const filterHooks = {
        tags: tagFilter,
        namespace: namespaceFilter,
    };

    // Filter group definitions
    const filterGroupDefinitions: FilterGroupDefinition[] = [
        {
            key: "tags",
            label: "Wiki page tags",
            type: "tags",
            column: "tags",
        },
        {
            key: "namespace",
            label: "Namespace",
            type: "foreignSingle",
            column: "namespace",
        },
    ];

    return (
        <SearchPageContent
            config={config}
            filterHooks={filterHooks}
            filterGroupDefinitions={filterGroupDefinitions}
            searchPageHook={searchPage}
        />
    );
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const WikiPagesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Wiki Pages" basePermission={Permission.search_wiki_pages} navRealm={NavRealm.wikiPages}>
            <AppContextMarker name="Wiki pages search page">
                <div className="eventsMainContent searchPage">
                    <WikiPageListOuter />
                </div>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default WikiPagesPage;
