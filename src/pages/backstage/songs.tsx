import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button, ListItemIcon, Menu, MenuItem, Pagination } from "@mui/material";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { arrayToTSV, arraysContainSameValues, toggleValueInArray } from "shared/utils";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, DebugCollapsibleAdminText } from "src/core/components/CMCoreComponents2";
import { SearchInput } from "src/core/components/CMTextField";
import { DashboardContext } from "src/core/components/DashboardContext";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { SongDetailContainer } from "src/core/components/SongComponents";
import { CalculateSongMetadata, EnrichedVerboseSong } from "src/core/components/SongComponentsBase";
import { API } from "src/core/db3/clientAPI";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { RenderMuiIcon, gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import getSongFilterInfo from "src/core/db3/queries/getSongFilterInfo";
import { GetSongFilterInfoRet, MakeGetSongFilterInfoRet, SongSelectionFilter } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

interface SongsFilterSpec {
    pageSize: number;
    page: number;
    selection: SongSelectionFilter;

    quickFilter: string;
    tagFilter: number[];
};

const gDefaultFilter: SongsFilterSpec = {
    pageSize: 20,
    page: 0,
    selection: "relevant",

    quickFilter: "",
    tagFilter: [],
};// cannot be as const because the array is writable.

const HasExtraFilters = (val: SongsFilterSpec) => {
    if (val.pageSize != gDefaultFilter.pageSize) return true;
    if (val.quickFilter != gDefaultFilter.quickFilter) return true;
    if (val.selection != gDefaultFilter.selection) return true;
    if (!arraysContainSameValues(val.tagFilter, gDefaultFilter.tagFilter)) return true;
    return false;
};

const HasAnyFilters = (val: SongsFilterSpec) => {
    if (val.quickFilter != gDefaultFilter.quickFilter) return true;
    return HasExtraFilters(val);
};

interface SongsListArgs {
    filterSpec: SongsFilterSpec,
};

type SongsControlsValueProps = SongsControlsProps & {
    filterInfo: GetSongFilterInfoRet,
};


const SongsFilterControlsValue = ({ filterInfo, ...props }: SongsControlsValueProps) => {

    const toggleTag = (tagId: number) => {
        const newSpec: SongsFilterSpec = { ...props.filterSpec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    // const selectionChips: Record<SongSelectionFilter, string> = {
    //     "relevant": "Search songs from upcoming and recent events",
    //     "all": "Search all songs",
    // };

    // const selectSelection = (t: SongSelectionFilter) => {
    //     const newSpec: SongsFilterSpec = { ...props.filterSpec };
    //     newSpec.selection = t;
    //     props.onChange(newSpec);
    // };

    return <div className={`SongsFilterControlsValue`}>
        {/* <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <CMChipContainer className="cell">
                {Object.keys(selectionChips).map(k => (
                    <CMChip
                        key={k}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.selection === k }}
                        size="small"
                        onClick={() => selectSelection(k as any)}
                    >
                        {k}
                    </CMChip>
                ))}
            </CMChipContainer>
            <div className="tinyCaption">{selectionChips[props.filterSpec.selection]}</div>
        </div> */}

        <div className="divider"></div>

        <div className="row">
            <CMChipContainer className="cell">
                {filterInfo.tags.map(tag => (
                    <CMChip
                        key={tag.id}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.some(id => id === tag.id) }}
                        size="small"
                        onClick={() => toggleTag(tag.id)}
                        color={tag.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(tag.iconName)}{tag.label} ({tag.rowCount})
                    </CMChip>
                ))}
            </CMChipContainer>
        </div>
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SongsControlsProps {
    filterSpec: SongsFilterSpec;
    filterInfo: GetSongFilterInfoRet;
    onChange: (value: SongsFilterSpec) => void;
};

const SongsControls = (props: SongsControlsProps) => {
    const [expanded, setExpanded] = React.useState<boolean>(false);
    const hasExtraFilters = HasExtraFilters(props.filterSpec);
    const hasAnyFilters = HasAnyFilters(props.filterSpec);

    const setFilterText = (quickFilter: string) => {
        props.onChange({ ...props.filterSpec, quickFilter });
    };

    const handleClearFilter = () => {
        props.onChange({ ...gDefaultFilter });
    };

    const selectionChips: Record<SongSelectionFilter, string> = {
        "relevant": "Showing songs from upcoming and recent events",
        "all": "Showing all songs",
    };

    const selectSelection = (t: SongSelectionFilter) => {
        const newSpec: SongsFilterSpec = { ...props.filterSpec };
        newSpec.selection = t;
        props.onChange(newSpec);
    };

    return <div className="filterControlsContainer">
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={props.filterSpec.quickFilter}
                            autoFocus={true}
                        />
                        {(hasAnyFilters) && <Button onClick={handleClearFilter}>Reset filter</Button>}
                        <div className="freeButton headerExpandableButton" onClick={() => setExpanded(!expanded)}>
                            Filter {hasExtraFilters && "*"}
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </div>
                    </div>


                    <div className={`SongsFilterControlsValue`}>
                        <div className="row" style={{ display: "flex", alignItems: "center" }}>
                            <CMChipContainer className="cell">
                                {Object.keys(selectionChips).map(k => (
                                    <CMChip
                                        key={k}
                                        variation={{ fillOption: "hollow", selected: (k === props.filterSpec.selection), enabled: true, variation: "weak" }}
                                        //variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.selection === k }}
                                        shape="rectangle"
                                        size="small"
                                        onClick={() => selectSelection(k as any)}
                                    >
                                        {k}
                                    </CMChip>
                                ))}
                            </CMChipContainer>
                            <div className="tinyCaption">{selectionChips[props.filterSpec.selection]}</div>
                        </div>
                    </div>

                    {expanded && <SongsFilterControlsValue {...props} filterInfo={props.filterInfo} />}

                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SongListItemProps {
    song: EnrichedVerboseSong;
    filterSpec: SongsFilterSpec;
};
const SongListItem = (props: SongListItemProps) => {
    //const router = useRouter();
    const songData = CalculateSongMetadata(props.song);
    return <div className="searchListItem">
        <SongDetailContainer readonly={true} tableClient={null} songData={songData} showVisibility={true} highlightedTagIds={props.filterSpec.tagFilter}
            renderAsLinkTo={API.songs.getURIForSong(props.song.id, props.song.slug)}
        >
        </SongDetailContainer>
    </div>;
};






async function CopySongListCSV(snackbarContext: SnackbarContextType, value: db3.SongPayload_Verbose[]) {
    const obj = value.map((e, i) => ({
        Order: (i + 1).toString(),
        ID: e.id.toString(),
        Name: e.name,
        StartBPM: e.startBPM?.toString() || "",
        EndBPM: e.endBPM?.toString() || "",
        LengthSeconds: e.lengthSeconds?.toString() || "",
        URL: getURIForSong(e.id),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}






interface SongsListArgs {
    filterSpec: SongsFilterSpec,
    filterInfo: GetSongFilterInfoRet;
    setFilterSpec: (value: SongsFilterSpec) => void, // for pagination
    //items: EnrichedVerboseSong[],
};

const SongsList = ({ filterSpec, filterInfo, ...props }: SongsListArgs) => {
    const dashboardContext = React.useContext(DashboardContext);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    const items = (filterInfo.fullSongs as db3.SongPayload_Verbose[]).map(s => db3.enrichSong(s, dashboardContext));

    const handleCopy = async () => {
        await CopySongListCSV(snackbarContext, items);
    };

    return <div className="songsList searchResults">
        <div className="searchRecordCount">
            {filterInfo.rowCount === 0 ? "No items to show" : <>Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + items.length} of {filterInfo.rowCount} total</>}
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
        {items.map(song => <SongListItem key={song.id} song={song} filterSpec={filterSpec} />)}
        <Pagination
            count={Math.ceil(filterInfo.rowCount / filterSpec.pageSize)}
            page={filterSpec.page + 1}
            onChange={(e, newPage) => {
                props.setFilterSpec({ ...filterSpec, page: newPage - 1 });
            }} />
    </div>;

};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SongListQuerierProps {
    filterSpec: SongsFilterSpec;
    setFilterInfo: (v: GetSongFilterInfoRet) => void;
    //setSongsQueryResult: (v: EnrichedVerboseSong[]) => void;
};

const SongListQuerier = (props: SongListQuerierProps) => {
    //const dashboardContext = React.useContext(DashboardContext);

    // QUERY: filtered results & info
    const [queriedFilterInfo, getFilterInfoExtra] = useQuery(getSongFilterInfo, {
        filterSpec: {
            quickFilter: props.filterSpec.quickFilter,
            tagIds: props.filterSpec.tagFilter,
            pageSize: props.filterSpec.pageSize,
            page: props.filterSpec.page,
            selection: props.filterSpec.selection,
        }
    });

    React.useEffect(() => {
        if (getFilterInfoExtra.isSuccess) {
            props.setFilterInfo({ ...queriedFilterInfo });
        }
    }, [getFilterInfoExtra.dataUpdatedAt]);

    return <div className="queryProgressLine idle"></div>;
};




//////////////////////////////////////////////////////////////////////////////////////////////////
const SongListOuter = () => {
    const [filterSpec, setFilterSpec] = React.useState<SongsFilterSpec>({ ...gDefaultFilter });

    const [filterInfo, setFilterInfo] = React.useState<GetSongFilterInfoRet>(MakeGetSongFilterInfoRet());
    //const [songsQueryResult, setSongsQueryResult] = React.useState<EnrichedVerboseSong[]>([]);

    // # when filter spec (other than page change), reset page to 0.
    const { page, ...everythingButPage } = filterSpec;

    const specHash = JSON.stringify(everythingButPage);
    React.useEffect(() => {
        setFilterSpec({ ...filterSpec, page: 0 });
    }, [specHash]);

    return <>
        <NewSongButton />

        <DebugCollapsibleAdminText text={filterInfo.tagsQuery} caption={"tagsQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.paginatedResultQuery} caption={"paginatedResultQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.totalRowCountQuery} caption={"totalRowCountQuery"} />

        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                <SongsControls onChange={setFilterSpec} filterSpec={filterSpec} filterInfo={filterInfo} />
            </div>

            <Suspense fallback={<div className="queryProgressLine loading"></div>}>
                <SongListQuerier filterSpec={filterSpec} setFilterInfo={setFilterInfo} />
            </Suspense>
        </CMSinglePageSurfaceCard>
        <SongsList filterSpec={filterSpec} setFilterSpec={setFilterSpec} filterInfo={filterInfo} />
    </>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
const SongListPageContent = () => {
    return <div className="eventsMainContent searchPage">

        <Suspense>
            <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
        </Suspense>

        <SongListOuter />
    </div>;
};





const ViewSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs" basePermission={Permission.view_songs}>
            <SongListPageContent />
        </DashboardLayout>
    )
}

export default ViewSongsPage;
