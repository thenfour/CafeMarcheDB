import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button, Pagination } from "@mui/material";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { arraysContainSameValues, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { DebugCollapsibleText } from "src/core/components/CMCoreComponents2";
import { SearchInput } from "src/core/components/CMTextField";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SongDetailContainer } from "src/core/components/SongComponents";
import { CalculateSongMetadata } from "src/core/components/SongComponentsBase";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getSongFilterInfo from "src/core/db3/queries/getSongFilterInfo";
import { GetSongFilterInfoRet, MakeGetSongFilterInfoRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

interface SongsFilterSpec {
    pageSize: number;
    page: number;

    quickFilter: string;
    tagFilter: number[];
};

const gDefaultFilter: SongsFilterSpec = {
    pageSize: 20,
    page: 0,

    quickFilter: "",
    tagFilter: [],
};// cannot be as const because the array is writable.

const HasExtraFilters = (val: SongsFilterSpec) => {
    if (val.pageSize != gDefaultFilter.pageSize) return true;
    if (val.quickFilter != gDefaultFilter.quickFilter) return true;
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

    return <div className={`SongsFilterControlsValue`}>
        <div className="row">
            {/* <div className="caption cell">tags</div> */}
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
                        {(hasAnyFilters) && <Button onClick={handleClearFilter}>Clear filter</Button>}
                        <div className="freeButton headerExpandableButton" onClick={() => setExpanded(!expanded)}>
                            Filter {hasExtraFilters && "*"}
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
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
    song: db3.SongPayload_Verbose;
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








interface SongsListArgs {
    filterSpec: SongsFilterSpec,
    filterInfo: GetSongFilterInfoRet;
    setFilterSpec: (value: SongsFilterSpec) => void, // for pagination
    items: db3.SongPayload_Verbose[],
};

const SongsList = ({ filterSpec, filterInfo, items, ...props }: SongsListArgs) => {

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    return <div className="songsList searchResults">
        {items.map(song => <SongListItem key={song.id} song={song} filterSpec={filterSpec} />)}
        <div className="searchRecordCount">
            {filterInfo.rowCount === 0 ? "No items to show" : <>Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + items.length} of {filterInfo.rowCount} total</>}
        </div>
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
    setSongsQueryResult: (v: db3.SongPayload_Verbose[]) => void;
};

const SongListQuerier = (props: SongListQuerierProps) => {

    // QUERY: filtered results & info
    const [queriedFilterInfo, getFilterInfoExtra] = useQuery(getSongFilterInfo, {
        filterSpec: {
            quickFilter: props.filterSpec.quickFilter,
            tagIds: props.filterSpec.tagFilter,
            pageSize: props.filterSpec.pageSize,
            page: props.filterSpec.page,
        }
    });

    React.useEffect(() => {
        if (getFilterInfoExtra.isSuccess) {
            props.setFilterInfo({ ...queriedFilterInfo });
        }
    }, [getFilterInfoExtra.dataUpdatedAt]);

    // QUERY: details
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const tableParams: db3.SongTableParams = {
        songIds: queriedFilterInfo.songIds.length === 0 ? [-1] : queriedFilterInfo.songIds, // prevent fetching the entire table!
    };

    const songsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xSong_Verbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        filterModel: {
            items: [],
            tableParams,
        },
        paginationModel: {
            page: 0,
            pageSize: props.filterSpec.pageSize, // not usually needed because the eventid list is there. so for sanity.
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    React.useEffect(() => {
        if (songsClient.remainingQueryStatus.isSuccess) {
            const items = songsClient.items as db3.SongPayload_Verbose[];
            // the db3 query doesn't retain the same order as the filter info ret, put in correct order.
            const songsWithPossibleNulls = queriedFilterInfo.songIds.map(id => items.find(e => e.id === id));
            const songs = songsWithPossibleNulls.filter(e => !!e) as db3.SongPayload_Verbose[]; // in case of any desync.
            props.setSongsQueryResult(songs);
        }
    }, [songsClient.remainingQueryStatus.dataUpdatedAt]);

    return <div className="queryProgressLine idle"></div>;
};




//////////////////////////////////////////////////////////////////////////////////////////////////
const SongListOuter = () => {
    const [filterSpec, setFilterSpec] = React.useState<SongsFilterSpec>({ ...gDefaultFilter });

    const [filterInfo, setFilterInfo] = React.useState<GetSongFilterInfoRet>(MakeGetSongFilterInfoRet());
    const [songsQueryResult, setSongsQueryResult] = React.useState<db3.SongPayload_Verbose[]>([]);

    // # when filter spec (other than page change), reset page to 0.
    const { page, ...everythingButPage } = filterSpec;

    const specHash = JSON.stringify(everythingButPage);
    React.useEffect(() => {
        setFilterSpec({ ...filterSpec, page: 0 });
    }, [specHash]);

    return <>
        <NewSongButton />

        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                <SongsControls onChange={setFilterSpec} filterSpec={filterSpec} filterInfo={filterInfo} />
            </div>

            <Suspense fallback={<div className="queryProgressLine loading"></div>}>
                <SongListQuerier filterSpec={filterSpec} setSongsQueryResult={setSongsQueryResult} setFilterInfo={setFilterInfo} />
            </Suspense>
        </CMSinglePageSurfaceCard>
        <SongsList filterSpec={filterSpec} setFilterSpec={setFilterSpec} items={songsQueryResult} filterInfo={filterInfo} />
    </>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
const SongListPageContent = () => {
    if (!useAuthorization("ViewSongsPage", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    return <div className="eventsMainContent searchPage">

        <Suspense>
            <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
        </Suspense>

        <SongListOuter />
    </div>;
};





const ViewSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <SongListPageContent />
        </DashboardLayout>
    )
}

export default ViewSongsPage;
