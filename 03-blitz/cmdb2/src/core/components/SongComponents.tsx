
import { useAuthenticatedSession } from '@blitzjs/auth';
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { StandardVariationSpec } from 'shared/color';
import { formatSongLength } from 'shared/time';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { CMChip, CMChipContainer, CMStandardDBChip, CustomTabPanel, EventChip, InspectObject, TabA11yProps, UserChip } from './CMCoreComponents';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { FilesTabContent } from './SongFileComponents';
import { VisibilityValue } from './VisibilityControl';
import { CalculateSongMetadata, SongWithMetadata } from './SongComponentsBase';
import { Markdown } from './RichTextEditor';
import { IsNullOrWhitespace, TAnyModel } from 'shared/utils';
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';


export const SongClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
    aliases: new DB3Client.GenericStringColumnClient({ columnName: "aliases", cellWidth: 180 }),
    slug: new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 120 }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
    startBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "startBPM", cellWidth: 100 }),
    endBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "endBPM", cellWidth: 100 }),
    introducedYear: new DB3Client.GenericIntegerColumnClient({ columnName: "introducedYear", cellWidth: 100 }),
    lengthSeconds: new DB3Client.GenericIntegerColumnClient({ columnName: "lengthSeconds", cellWidth: 100 }),
    tags: new DB3Client.TagsFieldClient({ columnName: "tags", cellWidth: 200, allowDeleteFromCell: false }),
    createdByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120 }),
    visiblePermission: new DB3Client.ForeignSingleFieldClient({
        columnName: "visiblePermission", cellWidth: 120, nullItemInfo: {
            label: "Private",
            color: "red",
            tooltip: "Only you will be able to view this item for now. You can make it public later when you're ready."
        }
    }),
};

////////////////////////////////////////////////////////////////
export interface SongBreadcrumbProps {
    song: db3.SongPayloadMinimum,
};
export const SongBreadcrumbs = (props: SongBreadcrumbProps) => {
    return <Breadcrumbs aria-label="breadcrumb">
        <Link
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </Link>
        <Link
            underline="hover"
            color="inherit"
            href="/backstage/songs"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Songs
        </Link>

        <Link
            underline="hover"
            color="inherit"
            href={API.songs.getURIForSong(props.song)}
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            {props.song.name}
        </Link>

    </Breadcrumbs>
        ;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const SongDescriptionControl = ({ song, refetch, readonly }: { song: db3.SongPayloadMinimum, refetch: () => void, readonly: boolean }) => {
    const mutationToken = API.songs.updateSongBasicFields.useToken();

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorized = db3.xEvent.authorizeColumnForEdit({
        model: null,
        columnName: "description",
        clientIntention,
        publicData,
    });

    return <MutationMarkdownControl
        initialValue={song.description}
        refetch={refetch}
        readonly={readonly || !authorized}
        onChange={(newValue) => mutationToken.invoke({
            songId: song.id,
            description: newValue || "",
        })}
    />;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongCreditEditButtonProps {
    //songData: SongWithMetadata;
    value: db3.SongCreditPayloadFromVerboseSong;
    refetch: () => void;
    readonly: boolean;
    creditsTableClient: DB3Client.xTableRenderClient;
};
// also checks authorization & readonly to hide this button
export const SongCreditEditButton = ({ creditsTableClient, ...props }: SongCreditEditButtonProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicData = useAuthenticatedSession();

    const handleConfirmedDelete = (api: DB3EditRowButtonAPI) => {
        creditsTableClient.doDeleteMutation(props.value.id, 'softWhenPossible').then(e => {
            showSnackbar({ severity: "success", children: "deleted" });
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error deleting" });
        }).finally(async () => {
            props.refetch();
        });
    };

    const handleSaveEdits = (newRow: TAnyModel, api: DB3EditRowButtonAPI) => {
        creditsTableClient.doUpdateMutation(newRow).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error saving" });
        }).finally(async () => {
            props.refetch();
        });
    };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention: creditsTableClient.args.clientIntention,
        model: props.value,
        publicData,
    });

    if (!editAuthorized) return null;
    if (props.readonly) return null;

    return <DB3EditRowButton
        smallButton={true}
        label={gIconMap.Edit()}
        tableRenderClient={creditsTableClient}
        row={props.value}
        onSave={handleSaveEdits}
        onDelete={handleConfirmedDelete}
    />;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const SongMetadataView = ({ songData, ...props }: { songData: SongWithMetadata, refetch: () => void, readonly: boolean, showCredits: boolean }) => {

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };
    const publicData = useAuthenticatedSession();

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSongCredit,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "type", cellWidth: 120, }),
            new DB3Client.GenericStringColumnClient({ columnName: "year", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "comment", cellWidth: 120 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "song", cellWidth: 120, visible: false }),
        ],
    });

    const creditsTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Mutation,
        tableSpec,
    });

    const handleSaveNew = (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
        creditsTableClient.doInsertMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating" });
        }).finally(async () => {
            creditsTableClient.refetch();
            props.refetch();
            api.closeDialog();
        });
    };

    const newObj = db3.xSongCredit.createNew(clientIntention);
    newObj.song = songData.song;
    newObj.songId = songData.song.id;
    newObj.year = `${(new Date()).getFullYear()}`;

    const insertAuthorized = db3.xEventSongList.authorizeRowBeforeInsert({
        clientIntention,
        publicData,
    });

    const refetch = () => {
        creditsTableClient.refetch();
        props.refetch();
    };

    //const rows: { name: React.ReactNode, value: [React.ReactNode, React.ReactNode, React.ReactNode] }[] = [];
    const rows: { rowClassName: string, cells: React.ReactNode[] }[] = [];

    if (songData.formattedLength) {
        rows.push({ rowClassName: "length", cells: [<th key={0}>Length</th>, <td key={1} colSpan={1}>{songData.formattedLength}</td>, <td key={2} colSpan={2}></td>, null] });
    }
    if (songData.formattedBPM) {
        rows.push({ rowClassName: "bpm", cells: [<th key={0}>Tempo</th>, <td key={1} colSpan={1}>{songData.formattedBPM}</td>, <td key={2} colSpan={2}></td>, null] });
    }

    if (props.showCredits) {
        songData.song.credits.forEach(credit => {
            rows.push({
                rowClassName: `credit `,
                cells: [
                    <th key={0} className={`creditType ${credit.type.text}`}>{credit.type.text}</th>,
                    <td key={1} className={`user`}><div className='flexRow'>
                        <SongCreditEditButton readonly={props.readonly} refetch={refetch} creditsTableClient={creditsTableClient} value={credit} />{credit.user && credit.user.name}
                    </div>
                    </td>,
                    <td key={2} className={`year`}>{credit.year}</td>,
                    <td key={3} className={`comment`}><Markdown markdown={credit.comment} compact={true} /></td>,
                ],
            });
        });
    }

    if (!rows.length) return null;

    return <div>
        <table className='songMetadata'>
            <tbody>
                {rows.map((kv, i) => <tr key={i} className={`${kv.rowClassName}`}>
                    {kv.cells.map((cell, i) => cell)}
                </tr>)}
            </tbody>
        </table>

        {insertAuthorized && !props.readonly && <DB3EditRowButton
            onSave={handleSaveNew}
            row={newObj}
            tableRenderClient={creditsTableClient}
            label={`Add song credit`}
        />}
    </div>;

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongDetailContainerProps {
    songData: SongWithMetadata;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTabIndex?: number;
    //isOnlySongVisible: boolean; // some formatting stuff cares about whether this is a part of a list of events, or is the only one on the screen.
}

export const SongDetailContainer = ({ songData, tableClient, ...props }: React.PropsWithChildren<SongDetailContainerProps>) => {
    const song = songData.song;
    const router = useRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();

    const refetch = () => {
        tableClient.refetch();
    };

    const visInfo = API.users.getVisibilityInfo(song);

    return <div className={`EventDetail contentSection event ${visInfo.className}`}>

        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    <Link href={songData.songURI} className="titleLink">
                        <span className='title'>{song.name}</span>
                        {song.introducedYear && <Tooltip title={`Introduced in ${song.introducedYear}`}><span className='titleTag'>({song.introducedYear})</span></Tooltip>}
                    </Link>
                    <div className='subtitle'><Tooltip title={"Aliases"}><span>{song.aliases}</span></Tooltip></div>
                </div>

                <CMChipContainer>
                    {song.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.tag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
                </CMChipContainer>

                <div className='flex-spacer'></div>

                {
                    isShowingAdminControls && <>
                        <DB3Client.NameValuePair
                            isReadOnly={true}
                            name={"songId"}
                            value={song.id}
                        />
                        <InspectObject src={song} />
                    </>
                }

                <EditFieldsDialogButton
                    dialogTitle='Edit song'
                    dialogDescription={<SettingMarkdown setting='EditSongDialogDescription' />}
                    readonly={props.readonly}
                    initialValue={song}
                    renderButtonChildren={() => <>{gIconMap.Edit()} Edit</>}
                    tableSpec={tableClient.tableSpec}
                    onCancel={() => { }}
                    onOK={(obj: db3.SongPayload_Verbose, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => {
                        tableClient.doUpdateMutation(obj).then(() => {
                            showSnackbar({ children: "update successful", severity: 'success' });
                            api.close();
                            if (obj.slug !== song.slug) {
                                const newUrl = API.songs.getURIForSong(obj.slug);
                                void router.push(newUrl); // <-- ideally we would show the snackbar on refresh but no.
                            }
                        }).catch(err => {
                            console.log(err);
                            showSnackbar({ children: "update error", severity: 'error' });
                        }).finally(refetch);
                    }}
                    onDelete={(api: EditFieldsDialogButtonApi) => {
                        tableClient.doDeleteMutation(song.id, 'softWhenPossible').then(() => {
                            showSnackbar({ children: "delete successful", severity: 'success' });
                            api.close();
                        }).catch(err => {
                            console.log(err);
                            showSnackbar({ children: "delete error", severity: 'error' });
                        }).finally(refetch);
                    }}
                />

                <VisibilityValue permission={song.visiblePermission} variant='minimal' />

            </div>{/* title line */}

            {props.children}

        </div>{/* content */}

    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const gSongDetailTabSlugIndices = {
    info: 0,
    files: 1,
} as const;

export interface SongDetailArgs {
    song: db3.SongPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTabIndex?: number;
}

export const SongDetail = ({ song, tableClient, ...props }: SongDetailArgs) => {
    const router = useRouter();

    const refetch = () => {
        tableClient.refetch();
    };

    const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || 0);

    const handleTabChange = (e: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    };

    // convert index to tab slug
    const tabSlug = Object.keys(gSongDetailTabSlugIndices)[selectedTab];
    const songData = CalculateSongMetadata(song, tabSlug);

    React.useEffect(() => {
        void router.push(songData.songURI);
    }, [songData.songURI]);

    return <SongDetailContainer readonly={props.readonly} songData={songData} tableClient={tableClient}>

        <SongMetadataView readonly={props.readonly} refetch={refetch} songData={songData} showCredits={true} />

        <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
        >
            <Tab label="Song Info" {...TabA11yProps('song', gSongDetailTabSlugIndices.info)} />
            <Tab label={`Files (${song.taggedFiles.length})`} {...TabA11yProps('song', gSongDetailTabSlugIndices.files)} />
        </Tabs>

        <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.info}>
            <SongDescriptionControl readonly={props.readonly} refetch={refetch} song={song} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.files}>
            <FilesTabContent fileTags={song.taggedFiles} readonly={props.readonly} refetch={refetch} uploadTags={{
                taggedSongId: song.id,
            }} />
        </CustomTabPanel>
    </SongDetailContainer>;

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface CurrentSongsDashboardItem {
    songId: number;
    mostRecentAppearance: Date;
    appearsInPresentOrFutureEvents: boolean;
    appearsInEvents: db3.EventClientPayload_Verbose[];
};

export interface CurrentSongsDashboardProps {
    songs: CurrentSongsDashboardItem[];
};

export const CurrentSongsDashboard = (props: CurrentSongsDashboardProps) => {
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    // song table bindings
    const songTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSong,
        columns: [
            SongClientColumns.id,
        ],
    });

    // necessary to connect all the columns in the spec.
    const tableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: songTableSpec,
        filterModel: {
            items: [],
            tableParams: {
                songIds: props.songs.map(s => s.songId),
            }
        }
    });

    const songs = tableClient.items as db3.SongPayload_Verbose[];

    return <div className='searchResults'>
        {songs.map(s => {
            const songData = CalculateSongMetadata(s);
            const dashEntry = props.songs.find(s2 => s2.songId === s.id)!;
            return <SongDetailContainer key={s.id} readonly={true} songData={songData} tableClient={tableClient} >
                <CMChipContainer orientation='vertical'>
                    {dashEntry.appearsInEvents.map(e => <CMChip
                        key={e.id}
                        shape={'rectangle'}
                    >
                        {e.name}
                    </CMChip>)}
                </CMChipContainer>
            </SongDetailContainer>;
        })}
    </div>;
};

