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
import { FilterControls, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { SongDetailContainer } from "src/core/components/SongComponents";
import { CalculateSongMetadata, EnrichedVerboseSong, SongOrderByColumnOption, SongOrderByColumnOptions, SongsFilterSpec } from "src/core/components/SongComponentsBase";
import { useSongListData } from "src/core/components/SongSearch";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import { DiscreteCriterion, DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { API } from "src/core/db3/clientAPI";

type SongListItemProps = {
    song: EnrichedVerboseSong;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: SongsFilterSpec;
};

// const SongListItem = (props: SongListItemProps) => {
//     return <div className={`songListItem`}>
//         <h2>{props.song.name}</h2>
//     </div>;
// };

// //////////////////////////////////////////////////////////////////////////////////////////////////
// interface SongListItemProps {
//     song: EnrichedVerboseSong;
//     filterSpec: SongsFilterSpec;
// };
const SongListItem = (props: SongListItemProps) => {
    //const router = useRouter();
    const songData = CalculateSongMetadata(props.song);
    return <div className="searchListItem">
        <SongDetailContainer readonly={true} tableClient={null} songData={songData} showVisibility={true} highlightedTagIds={[]}
            renderAsLinkTo={API.songs.getURIForSong(props.song)}
        >
        </SongDetailContainer>
    </div>;
};









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
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const handleCopy = async () => {
        await CopySongListCSV(snackbarContext, songs);
    };

    return <div className="eventList searchResults">
        <div className="searchRecordCount">
            {results.rowCount === 0 ? "No items to show" : <>Displaying {songs.length} items of {results.rowCount} total</>}
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
            dataLength={songs.length}
            next={loadMoreData}
            hasMore={hasMore}
            loader={<h4>Loading...</h4>}
            scrollableTarget="scrollableDiv"
        >
            {songs.map((song, i) => (
                <SongListItem
                    key={song.id}
                    song={song}
                    filterSpec={filterSpec}
                    refetch={refetch}
                    results={results}
                />
            ))}
        </InfiniteScroll>

    </div>;
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

    // the default basic filter spec when no params specified.
    const filterSpec: SongsFilterSpec = {
        //pageSize: gPageSize,
        refreshSerial,
        //page,

        // in dto...
        quickFilter,

        orderByColumn: sortColumn as any,
        orderByDirection: sortDirection,

        tagFilter: tagFilterEnabled ? tagFilterWhenEnabled : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    const { enrichedItems, results, loadMoreData } = useSongListData(filterSpec);

    const handleCopyFilterspec = () => {
        const o: SongsFilterSpecStatic = {
            label: "(n/a)",
            helpText: "",
            orderByColumn: sortColumn as any,
            orderByDirection: sortDirection,

            tagFilterEnabled,
            tagFilterBehavior: tagFilterBehaviorWhenEnabled,
            tagFilterOptions: tagFilterOptionsWhenEnabled,
        }
        const txt = JSON.stringify(o, null, 2);
        console.log(o);
        navigator.clipboard.writeText(txt).then(() => {
            snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
        }).catch(() => {
            // nop
        });
    };

    const handleClickStaticFilter = (x: SongsFilterSpecStatic) => {
        setSortColumn(x.orderByColumn);
        setSortDirection(x.orderByDirection);

        setTagFilterEnabled(x.tagFilterEnabled);
        setTagFilterBehaviorWhenEnabled(x.tagFilterBehavior);
        setTagFilterOptionsWhenEnabled(x.tagFilterOptions);
    };

    const MatchesStaticFilter = (x: SongsFilterSpecStatic): boolean => {
        if (sortColumn !== x.orderByColumn) return false;
        if (sortDirection !== x.orderByDirection) return false;

        if (x.tagFilterEnabled !== tagFilterEnabled) return false;
        if (tagFilterEnabled) {
            if (tagFilterBehaviorWhenEnabled !== x.tagFilterBehavior) return false;
            if (!arraysContainSameValues(tagFilterOptionsWhenEnabled, x.tagFilterOptions)) return false;
        }

        return true;
    };

    const matchingStaticFilter = gStaticFilters.find(x => MatchesStaticFilter(x));

    const hasExtraFilters = ((): boolean => {
        if (!!matchingStaticFilter) return false;
        if (tagFilterEnabled) return true;
        return false;
    })();

    const hasAnyFilters = hasExtraFilters;

    return <>
        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">

                {dashboardContext.isShowingAdminControls && <CMSmallButton onClick={handleCopyFilterspec}>Copy filter spec</CMSmallButton>}
                <AdminInspectObject src={filterSpec} label="Filter spec" />
                <AdminInspectObject src={results} label="Results obj" />
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

                        </div>
                    } // extra filter
                    footerFilter={
                        <div>
                            <div className="divider" />
                            <SortByGroup
                                columnOptions={Object.keys(SongOrderByColumnOptions)}
                                setValue={setSortModel}
                                value={sortModel}
                            />
                        </div>
                    }
                />
            </div>

        </CMSinglePageSurfaceCard >
        <SongsList
            filterSpec={filterSpec}
            songs={enrichedItems}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedItems.length < results.rowCount}
            refetch={() => setRefreshSerial(refreshSerial + 1)}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const SearchSongsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Songs" basePermission={Permission.view_songs}>
            <div className="eventsMainContent searchPage">
                <Suspense>
                    <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
                </Suspense>
                <NewSongButton />

                <SongListOuter />
            </div>
        </DashboardLayout>
    )
}

export default SearchSongsPage;
