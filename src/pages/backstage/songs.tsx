import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { BlitzPage } from "@blitzjs/next";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { StandardVariationSpec } from "shared/color";
import { SelectEnglishNoun } from "shared/lang";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { IsNullOrWhitespace, arrayToTSV } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";
import { CMLink } from "src/core/components/CMLink";
import { DashboardContext, useDashboardContext } from "src/core/components/DashboardContext";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SearchPageFilterControls, createFilterGroupConfig } from "src/core/components/SearchPageFilterControls";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { CalculateSongMetadata, EnrichedVerboseSong, GetSongFileInfo, SongOrderByColumnOption, SongOrderByColumnOptions, SongsFilterSpec } from "src/core/components/SongComponentsBase";
import { useSongListData } from "src/core/components/SongSearch";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import { DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "src/core/layouts/DashboardLayout";

type SongListItemProps = {
    index: number;
    song: EnrichedVerboseSong;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: SongsFilterSpec;
};

const SongListItem = (props: SongListItemProps) => {
    const dashboardContext = useDashboardContext();
    const songData = CalculateSongMetadata(props.song);
    const fileInfo = GetSongFileInfo(props.song, dashboardContext);
    const hasBpm = !IsNullOrWhitespace(songData.formattedBPM);
    const hasLength = !!songData.song.lengthSeconds;
    const hasPartitions = fileInfo.partitions.length > 0;
    const hasRecordings = fileInfo.recordings.length > 0;
    const hasOtherFiles = fileInfo.otherFiles.length > 0;

    return <div className={`songListItem`}>
        <AppContextMarker name="SongListItem" songId={props.song.id}>
            <div className="titleLine">
                <div className="topTitleLine">
                    <CMLink className="nameLink" href={songData.songURI} trackingFeature={ActivityFeature.link_follow_internal}>{props.song.name}</CMLink>
                    {props.song.introducedYear && <span className="introducedYear">({props.song.introducedYear})</span>}
                    <div style={{ flexGrow: 1 }}></div>
                    <span className="resultIndex">#{props.index}</span>
                </div>
                <div className="aliases">{props.song.aliases}</div>
            </div>
            <div className="searchBody">
                <CMChipContainer className="songTags">
                    {props.song.tags.map(tag => <CMStandardDBChip
                        key={tag.id}
                        size='small'
                        model={tag.tag}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.tagId) }}
                        getTooltip={(_) => tag.tag.description}
                    />)}
                </CMChipContainer>

                {!!props.song.credits.length && (
                    <div className="credits">
                        {props.song.credits.map(credit => {
                            const creditType = dashboardContext.songCreditType.getById(credit.typeId);
                            return <div className="credit row" key={credit.id}>
                                {!!credit.user && <><div className="userName fieldItem">{credit.user?.name}</div></>}
                                {!!creditType && <div className="creditType fieldItem">{creditType.text}</div>}
                                {!IsNullOrWhitespace(credit.year) && <div className="year fieldItem">({credit.year})</div>}
                                {!IsNullOrWhitespace(credit.comment) && <div className="creditComment fieldItem">{credit.comment}</div>}
                            </div>;
                        })}
                    </div>
                )}

                {(hasBpm || hasLength) && (
                    <div className="lengthBpmLine row">
                        {hasBpm && <div className="bpm fieldItem"><span className="label">BPM: </span><div className="value">{songData.formattedBPM}</div></div>}
                        {hasLength && <div className="length  fieldItem"><span className="label">Length: </span><div className="value">{songData.formattedLength}</div></div>}
                        {hasPartitions && <div className="partitionCount fieldItem">{gIconMap.LibraryMusic()} {fileInfo.partitions.length} {SelectEnglishNoun(fileInfo.partitions.length, "partition", "partitions")}</div>}
                        {hasRecordings && <div className="recordingCount fieldItem">{gIconMap.PlayCircleOutline()} {fileInfo.recordings.length} {SelectEnglishNoun(fileInfo.recordings.length, "recording", "recordings")}</div>}
                        {hasOtherFiles && <div className="otherFilesCount fieldItem">{gIconMap.AttachFile()} {fileInfo.otherFiles.length} {SelectEnglishNoun(fileInfo.otherFiles.length, "unsorted file", "unsorted files")}</div>}
                    </div>
                )}
            </div>
        </AppContextMarker>
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

    const [autoLoadCount, setAutoLoadCount] = React.useState(0);
    const MAX_AUTO_LOADS = 15;

    const handleCopy = async () => {
        await CopySongListCSV(snackbarContext, songs);
    };

    // useEffect hook to check if more data needs to be loaded
    React.useEffect(() => {
        const checkIfNeedsMoreData = () => {
            const contentElement = document.querySelector('.eventList.searchResults');
            if (contentElement) {
                const contentHeight = contentElement.scrollHeight;
                const viewportHeight = window.innerHeight;

                if (contentHeight <= viewportHeight && hasMore && autoLoadCount < MAX_AUTO_LOADS) {
                    setAutoLoadCount(prevCount => prevCount + 1);
                    console.log(`autoLoadCount = ${autoLoadCount}`);
                    loadMoreData();
                }
            }
        };

        // Delay the check to ensure the DOM has updated
        setTimeout(checkIfNeedsMoreData, 0);
    }, [songs]);

    return <div className="eventList searchResults">
        <AppContextMarker name="SongList" queryText={filterSpec.quickFilter}>
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
            //scrollableTarget="scrollableDiv"
            >
                {songs.map((song, i) => (
                    <SongListItem
                        index={i + 1}
                        key={song.id}
                        song={song}
                        filterSpec={filterSpec}
                        refetch={refetch}
                        results={results}
                    />
                ))}
            </InfiniteScroll>
            {hasMore && <Button onClick={loadMoreData}>Load more results...</Button>}

        </AppContextMarker>
    </div >;
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
