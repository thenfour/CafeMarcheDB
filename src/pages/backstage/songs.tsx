import { SongListItem } from "@/src/core/components/song/SongListItem";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { AppContextMarker } from "src/core/components/AppContext";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { NewSongButton } from "src/core/components/song/NewSongComponents";
import { EnrichedVerboseSong, SongOrderByColumnOption, SongOrderByColumnOptions, SongsFilterSpec } from "src/core/components/song/SongComponentsBase";
import { getURIForSong } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { songSearchConfig } from "src/core/hooks/searchConfigs";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "src/core/layouts/DashboardLayout";


// for serializing in compact querystring
interface SongsFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: SongOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];
};

//////////////////////////////////////////////////////////////////////////////////////////////////

const gStaticFilters: SongsFilterSpecStatic[] = [
    {
        label: "All",
        helpText: "Searching all songs",
        orderByColumn: SongOrderByColumnOptions.name,
        orderByDirection: "asc",
        tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
        tagFilterOptions: [],
        tagFilterEnabled: false,
    },
];

const gDefaultStaticFilterName = "All" as const;
const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;

//////////////////////////////////////////////////////////////////////////////////////////////////
const SongListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);

    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter({
        urlPrefix: "tg",
        db3Column: "tags",
        defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
    });

    // Using useSearchPage hook for centralized search page logic
    const searchPage = useSearchPage<SongsFilterSpecStatic, SongsFilterSpec>({
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnKey: "orderByColumn",
        sortDirectionKey: "orderByDirection",
        filterMappings: [
            { filterHook: tagFilter, columnKey: "tagFilter" },
        ],
        buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
            const filterSpec: SongsFilterSpec = {
                refreshSerial,
                quickFilter,
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            };
            return filterSpec;
        },
        buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
            const staticSpec: SongsFilterSpecStatic = {
                label: "(n/a)",
                helpText: "",
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                tagFilterOptions: tagFilter.criterion.options as number[],
            };
            return staticSpec;
        }
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<SongsFilterSpecStatic, SongsFilterSpec, db3.SongPayload_Verbose, EnrichedVerboseSong> = {
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnOptions: SongOrderByColumnOptions,
        searchConfig: songSearchConfig,
        renderItem: (song, index, filterSpec, results, refetch) => (
            <SongListItem
                index={index}
                song={song}
                filterSpec={filterSpec}
                refetch={refetch}
                results={results}
            />
        ),
        getItemKey: (song) => song.id,
        contextMarkerName: "SongList",
        csvExporter: {
            itemToCSVRow: (song, index) => ({
                Order: index.toString(),
                ID: song.id.toString(),
                Name: song.name,
                URL: getURIForSong(song),
            }),
            filename: "songs"
        },
        showAdminControls: true,
    };

    // Filter hooks for passing to the generic component
    const filterHooks = {
        tags: tagFilter,
    };

    // Filter group definitions
    const filterGroupDefinitions: FilterGroupDefinition[] = [
        {
            key: "tags",
            label: "Tags",
            type: "tags",
            column: "tags",
            chipTransformer: (x) => {
                if (!x.id) return x;
                const tag = dashboardContext.songTag.getById(x.id)!;
                return {
                    ...x,
                    color: tag.color,
                    label: tag.text,
                    shape: "rounded",
                    tooltip: tag.description,
                };
            }
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
const SearchSongsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Songs" basePermission={Permission.view_songs}>
            <div className="eventsMainContent searchPage">
                <AppContextMarker name="song search page">
                    <Suspense>
                        <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
                    </Suspense>
                    <NewSongButton />

                    <SongListOuter />
                </AppContextMarker>
            </div>
        </DashboardLayout>
    )
}

export default SearchSongsPage;
