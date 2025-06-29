import { SongListItem } from "@/src/core/components/song/SongListItem";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { DashboardContext } from "src/core/components/DashboardContext";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SearchPageFilterControls, createFilterGroupConfig } from "src/core/components/SearchPageFilterControls";
import { SearchResultsList } from "src/core/components/SearchResultsList";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { EnrichedVerboseSong, SongOrderByColumnOption, SongOrderByColumnOptions, SongsFilterSpec } from "src/core/components/SongComponentsBase";
import { useSongListData } from "src/core/components/SongSearch";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
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



async function CopySongListCSV(snackbarContext: SnackbarContextType, value: EnrichedVerboseSong[]) {
    const obj = value.map((e, i) => ({
        Order: (i + 1).toString(),
        ID: e.id.toString(),
        Name: e.name,
        URL: getURIForSong(e),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}




interface SongsListArgs {
    filterSpec: SongsFilterSpec,
    results: SearchResultsRet;
    songs: EnrichedVerboseSong[],
    refetch: () => void;
    loadMoreData: () => void;
    hasMore: boolean;
};

const SongsList = ({ filterSpec, results, songs, refetch, loadMoreData, hasMore }: SongsListArgs) => {
    const snackbarContext = React.useContext(SnackbarContext);

    const handleCopyCSV = async (items: EnrichedVerboseSong[]) => {
        await CopySongListCSV(snackbarContext, items);
    };

    return (
        <SearchResultsList
            items={songs}
            results={results}
            filterSpec={filterSpec}
            loadMoreData={loadMoreData}
            hasMore={hasMore}
            refetch={refetch}
            onCopyCSV={handleCopyCSV}
            contextMarkerName="SongList"
            renderItem={(song, index) => (
                <SongListItem
                    index={index}
                    song={song}
                    filterSpec={filterSpec}
                    refetch={refetch}
                    results={results}
                />
            )}
            getItemKey={(song) => song.id}
        />
    );
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
    const snackbarContext = React.useContext(SnackbarContext);

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
    }); const { enrichedItems, results, loadMoreData } = useSongListData(searchPage.filterSpec);

    // Configure filter groups for the generic component
    const filterGroups = [
        createFilterGroupConfig("tags", "Tags", "tags", "tags", tagFilter, (x) => {
            if (!x.id) return x;
            const tag = dashboardContext.songTag.getById(x.id)!;
            return {
                ...x,
                color: tag.color,
                label: tag.text,
                shape: "rounded",
                tooltip: tag.description,
            };
        }),
    ];

    return <>
        <SearchPageFilterControls
            searchPage={searchPage}
            staticFilters={gStaticFilters}
            filterGroups={filterGroups}
            sortConfig={{
                columnOptions: Object.keys(SongOrderByColumnOptions),
                columnOptionsEnum: SongOrderByColumnOptions,
            }}
            results={results}
            showAdminControls={true}
        />
        <SongsList
            filterSpec={searchPage.filterSpec}
            songs={enrichedItems}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedItems.length < results.rowCount}
            refetch={() => searchPage.setRefreshSerial(searchPage.refreshSerial + 1)}
        />
    </>;
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
