import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { InputBase, Pagination } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SplitQuickFilter, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SearchInput } from "src/core/components/CMTextField";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SongDetailContainer } from "src/core/components/SongComponents";
import { CalculateSongMetadata } from "src/core/components/SongComponentsBase";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getEventFilterInfo from "src/core/db3/queries/getEventFilterInfo";
import getSongFilterInfo from "src/core/db3/queries/getSongFilterInfo";
import { GetSongFilterInfoRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

interface SongsControlsSpec {
    recordCount: number;
    quickFilter: string;
    tagFilter: number[];
    refreshSerial: number; // increment this in order to trigger a refetch
};

interface SongsListArgs {
    filterSpec: SongsControlsSpec,
};

interface SongsControlsProps {
    spec: SongsControlsSpec;
    onChange: (value: SongsControlsSpec) => void;
};

type SongsControlsValueProps = SongsControlsProps & {
    filterInfo: GetSongFilterInfoRet,
    readonly: boolean;
};

type SongsControlsDynProps = SongsControlsProps & {
    filterInfo: GetSongFilterInfoRet,
    onFilterInfoChanged: (value: GetSongFilterInfoRet) => void;
};



const SongsFilterControlsValue = ({ filterInfo, ...props }: SongsControlsValueProps) => {

    const toggleTag = (tagId: number) => {
        const newSpec: SongsControlsSpec = { ...props.spec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    return <div className={`SongsFilterControlsValue ${props.readonly && "HalfOpacity"}`}>
        <div className="row">
            {/* <div className="caption cell">tags</div> */}
            <CMChipContainer className="cell">
                {filterInfo.tags.map(tag => (
                    <CMChip
                        key={tag.id}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.spec.tagFilter.some(id => id === tag.id) }}
                        size="small"
                        onClick={props.readonly ? undefined : (() => toggleTag(tag.id))}
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


const SongsFilterControlsDyn = (props: SongsControlsDynProps) => {

    const [filterInfo, filterInfoExtra] = useQuery(getSongFilterInfo, {
        filterSpec: {
            quickFilter: props.spec.quickFilter,
            tagIds: props.spec.tagFilter,
        }
    });

    React.useEffect(() => {
        props.onFilterInfoChanged(filterInfo);
    }, [filterInfo]);

    return <SongsFilterControlsValue {...props} readonly={false} />;
};




const SongsControls = (props: SongsControlsProps) => {
    const [filterInfo, setFilterInfo] = React.useState<GetSongFilterInfoRet>(
        {
            tags: [],
            tagsQuery: "",
        }
    );

    const [popularTags, { refetch }] = API.songs.usePopularSongTagsQuery();

    const setFilterText = (quickFilter: string) => {
        const newSpec: SongsControlsSpec = { ...props.spec, quickFilter };
        props.onChange(newSpec);
    };

    const toggleTag = (tagId: number) => {
        const newSpec: SongsControlsSpec = { ...props.spec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    return <div className="filterControlsContainer">
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={props.spec.quickFilter}
                            autoFocus={true}
                        />
                    </div>

                    {/* The way we store the filter results here allows the suspense to be less flickry, rendering the same content during fallback. */}
                    <Suspense fallback={<SongsFilterControlsValue {...props} filterInfo={filterInfo} readonly={true} />}>
                        <SongsFilterControlsDyn {...props} filterInfo={filterInfo} onFilterInfoChanged={(v) => setFilterInfo(v)} />
                    </Suspense>

                    {/* 
                    <div className="row">
                        <CMChipContainer className="cell">
                            {popularTags.filter(t => t.songs.length > 0).map(tag => (
                                <CMChip
                                    key={tag.id}
                                    //selected={props.spec.tagFilter.some(id => id === tag.id)}
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.tagFilter.some(id => id === tag.id) }}
                                    onClick={() => toggleTag(tag.id)}
                                    color={tag.color}
                                >
                                    {tag.text} ({tag.songs.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div> */}


                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};


// {items.map(song => <SongListItem key={song.id} readonly={true} song={song} tableClient={songsClient} />)}
interface SongListItemProps {
    song: db3.SongPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    filterSpec: SongsControlsSpec;
};
const SongListItem = (props: SongListItemProps) => {
    const router = useRouter();
    const songData = CalculateSongMetadata(props.song);
    return <div className="searchListItem" onClick={() => router.push(API.songs.getURIForSong(props.song.id, props.song.slug))}>
        <SongDetailContainer readonly={true} tableClient={props.tableClient} songData={songData} showVisibility={true} highlightedTagIds={props.filterSpec.tagFilter}>
            {/* <SongMetadataView readonly={true} refetch={props.tableClient.refetch} songData={songData} showCredits={false} /> */}
        </SongDetailContainer>
    </div>;
};


const SongsList = ({ filterSpec }: SongsListArgs) => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;
    const [page, setPage] = React.useState<number>(0);

    const filterModel = {
        quickFilterValues: SplitQuickFilter(filterSpec.quickFilter),
        items: [],
        tagIds: filterSpec.tagFilter,
        tableParams: {
            // todo
        }
    };

    const songsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xSong_Verbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        filterModel,
        paginationModel: {
            page: page,
            pageSize: filterSpec.recordCount,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    const items = songsClient.items as db3.SongPayload_Verbose[];

    React.useEffect(() => {
        songsClient.refetch();
    }, [filterSpec]);
    const itemBaseOrdinal = page * filterSpec.recordCount;

    return <div className="songsList searchResults">
        {items.map(song => <SongListItem key={song.id} song={song} tableClient={songsClient} filterSpec={filterSpec} />)}
        <div className="searchRecordCount">
            Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + items.length} of {songsClient.rowCount} total
        </div>
        <Pagination
            count={Math.ceil(songsClient.rowCount / filterSpec.recordCount)}
            page={page + 1}
            onChange={(e, newPage) => {
                setPage(newPage - 1);
                songsClient.refetch();
            }} />
    </div>;
};

const MainContent = () => {
    //const router = useRouter();

    if (!useAuthorization("ViewSongsPage", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    //const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    //const mut = API.events.newEventMutation.useToken();
    //const currentUser = useCurrentUser()[0]!;
    //const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const [controlSpec, setControlSpec] = React.useState<SongsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        refreshSerial: 0,
    });

    const handleSpecChange = (value: SongsControlsSpec) => {
        setControlSpec(value);
    };

    return <div className="songsMainContent">

        <Suspense>
            <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
        </Suspense>

        <NewSongButton />

        <Suspense>
            <CMSinglePageSurfaceCard className="filterControls">
                <div className="header">
                    Search & filter songs
                </div>
                <div className="content">
                    <SongsControls onChange={handleSpecChange} spec={controlSpec} />
                </div>
            </CMSinglePageSurfaceCard>
        </Suspense>

        <Suspense>
            <SongsList filterSpec={controlSpec} />
        </Suspense>
    </div>;
};

const ViewSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <MainContent />
        </DashboardLayout>
    )
}

export default ViewSongsPage;
