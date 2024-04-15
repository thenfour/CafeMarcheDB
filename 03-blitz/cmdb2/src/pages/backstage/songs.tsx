import { BlitzPage } from "@blitzjs/next";
import {
    Search as SearchIcon
} from '@mui/icons-material';
import { InputBase } from "@mui/material";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { SongClientColumns, SongDetail } from "src/core/components/SongComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { DB3EditRowButton, DB3EditRowButtonAPI } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";
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

const SongsControls = (props: SongsControlsProps) => {

    const [popularTags, { refetch }] = API.songs.usePopularSongTagsQuery();

    const setFilterText = (quickFilter: string) => {
        const newSpec: SongsControlsSpec = { ...props.spec, quickFilter };
        props.onChange(newSpec);
    };

    const setRecordCount = (recordCount: number) => {
        const newSpec: SongsControlsSpec = { ...props.spec, recordCount };
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
                        <InputBase
                            size="small"
                            placeholder="Filter"
                            sx={{
                                backgroundColor: "#f0f0f0",
                                borderRadius: 3,
                            }}
                            value={props.spec.quickFilter}
                            onChange={(e) => setFilterText(e.target.value)}
                            startAdornment={<SearchIcon />}
                        />
                    </div>

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
                    </div>


                </div>
            </div>
            <div className="row">
                <CMChipContainer className="cell">
                    <CMChip variation={{ ...StandardVariationSpec.Strong, selected: props.spec.recordCount === 5 }} onClick={() => setRecordCount(5)}>5</CMChip>
                    <CMChip variation={{ ...StandardVariationSpec.Strong, selected: props.spec.recordCount === 20 }} onClick={() => setRecordCount(20)}>20</CMChip>
                    <CMChip variation={{ ...StandardVariationSpec.Strong, selected: props.spec.recordCount === 100 }} onClick={() => setRecordCount(100)}>100</CMChip>
                </CMChipContainer>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};






const SongsList = ({ filterSpec }: SongsListArgs) => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const filterModel = {
        quickFilterValues: filterSpec.quickFilter.split(/\s+/).filter(token => token.length > 0),
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
            page: 0,
            pageSize: filterSpec.recordCount,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    const items = songsClient.items as db3.SongPayload_Verbose[];

    React.useEffect(() => {
        songsClient.refetch();
    }, [filterSpec]);

    // console.log(`calculating song where clause`);
    // //const wc = songsClient.schema.GetQuickFilterWhereClauseExpression("roger", clientIntention);
    // songsClient.schema.CalculateWhereClause({ filterModel, clientIntention, skipVisibilityCheck: true }).then(wc => {
    //     console.log(`calculated song where clause`);
    //     console.log(wc);
    // });

    return <div className="songsList">
        {items.map(song => <SongDetail key={song.id} readonly={true} song={song} tableClient={songsClient} isOnlySongVisible={false} allowRouterPush={false} />)}
    </div>;
};

const MainContent = () => {
    if (!useAuthorization("ViewSongsPage", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    //const mut = API.events.newEventMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const [controlSpec, setControlSpec] = React.useState<SongsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        refreshSerial: 0,
    });

    const handleSpecChange = (value: SongsControlsSpec) => {
        setControlSpec(value);
    };


    // song table bindings
    const songTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSong,
        columns: [
            SongClientColumns.id,
            SongClientColumns.name,
            SongClientColumns.aliases,
            SongClientColumns.slug,
            //SongClientColumns.description,
            SongClientColumns.startBPM,
            SongClientColumns.endBPM,
            SongClientColumns.introducedYear,
            SongClientColumns.lengthSeconds,
            SongClientColumns.tags,
            //SongClientColumns.createdByUser,
            SongClientColumns.visiblePermission,
        ],
    });

    // necessary to connect all the columns in the spec.
    const songTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Mutation,
        tableSpec: songTableSpec,
    });

    const refetch = async () => {
        setControlSpec({ ...controlSpec, refreshSerial: controlSpec.refreshSerial + 1 });
        await songTableClient.refetch();
    };

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        songTableClient.doInsertMutation(obj).then(async () => {
            showSnackbar({ severity: "success", children: "success" });
            await refetch();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    return <div className="songsMainContent">

        <Suspense>
            <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
        </Suspense>

        <DB3EditRowButton
            onSave={handleSave}
            tableRenderClient={songTableClient}
            row={db3.xSong.createNew(clientIntention)}
            label={"Add new song"}
        />

        <Suspense>
            <CMSinglePageSurfaceCard>
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
