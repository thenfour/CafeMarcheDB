
import { useAuthenticatedSession } from '@blitzjs/auth';
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { StandardVariationSpec } from 'shared/color';
import { IsNullOrWhitespace } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';
import { TAnyModel } from '../db3/shared/apiTypes';
import { CMChip, CMChipContainer, CMStandardDBChip, CustomTabPanel, InspectObject, TabA11yProps } from './CMCoreComponents';
import { NameValuePair } from './CMCoreComponents2';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { MetronomeButton } from './Metronome';
import { Markdown } from './RichTextEditor';
import { SearchableNameColumnClient } from './SearchableNameColumnClient';
import { MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { CalculateSongMetadata, EnrichedVerboseSong, SongWithMetadata } from './SongComponentsBase';
import { FilesTabContent } from './SongFileComponents';
import { VisibilityValue } from './VisibilityControl';
import { Markdown2Control } from './MarkdownControl2';
import { DashboardContext } from './DashboardContext';


export const SongClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
    //searchableName: new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
    aliases: new DB3Client.GenericStringColumnClient({ columnName: "aliases", cellWidth: 180 }),
    slug: new DB3Client.SlugColumnClient({
        columnName: "slug", cellWidth: 120, previewSlug: (obj) => {
            const id = obj.id || "???";
            const slug = obj.slug || undefined;
            return API.songs.getURIForSong(id, slug);
        }
    }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
    startBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "startBPM", cellWidth: 100 }),
    endBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "endBPM", cellWidth: 100 }),
    introducedYear: new DB3Client.GenericIntegerColumnClient({ columnName: "introducedYear", cellWidth: 100 }),
    lengthSeconds: new DB3Client.SongLengthSecondsColumnClient({ columnName: "lengthSeconds", cellWidth: 100, fieldCaption: "Length / duration" }),
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
            href={API.songs.getURIForSong(props.song.id, props.song.slug)}
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            {props.song.name}
        </Link>

    </Breadcrumbs>
        ;
};




export const SongDescriptionControl = ({ song, refetch, readonly }: { song: db3.SongPayloadMinimum, refetch: () => void, readonly: boolean }) => {
    const mutationToken = API.songs.updateSongBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorized = db3.xSong.authorizeColumnForEdit({
        model: null,
        columnName: "description",
        clientIntention,
        publicData,
    });

    const onValueSaved = async (newValue: string): Promise<boolean> => {
        try {
            await mutationToken.invoke({
                songId: song.id,
                description: newValue || "",
            });
            showSnackbar({ severity: "success", children: "Success" });
            refetch();
            return true;
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event visibility" });
            return false;
        }
    };
    return <Markdown2Control
        isExisting={true}
        readonly={readonly || !authorized}
        value={song.description}
        onValueSaved={onValueSaved}
        displayUploadFileComponent={true} // #133 for mobile,this gives an opportunity to upload/embed.
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
    const dashboardContext = React.useContext(DashboardContext);

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
        rows.push({
            rowClassName: "bpm", cells: [<th key={0}>Tempo</th>,
            <td key={1} colSpan={1} className='bpmControlsTD' >
                <div className='bpmControlsContainer'>
                    {songData.song.startBPM !== null && <MetronomeButton bpm={songData.song.startBPM} isTapping={false} />}
                    <div className='bpmValue'>{songData.formattedBPM}</div>
                    {songData.song.endBPM !== null && (songData.song.startBPM != songData.song.endBPM) && <MetronomeButton bpm={songData.song.endBPM} isTapping={false} />}
                </div>
            </td>,
            <td key={2} colSpan={2}></td>, null]
        });
    }

    if (props.showCredits) {
        songData.song.credits.forEach(credit => {
            const type = dashboardContext.songCreditType.getById(credit.typeId)!;
            rows.push({
                rowClassName: `credit `,
                cells: [
                    <th key={0} className={`creditType ${type.text}`}>{type.text}</th>,
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

    return <div>
        {rows.length > 0 &&
            <table className='songMetadata'>
                <tbody>
                    {rows.map((kv, i) => <tr key={i} className={`${kv.rowClassName}`}>
                        {kv.cells.map((cell, i) => cell)}
                    </tr>)}
                </tbody>
            </table>
        }

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
    tableClient: null | DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTabIndex?: number;
    showVisibility?: boolean;
    highlightedTagIds?: number[];
    renderAsLinkTo?: string;
}

export const SongDetailContainer = ({ songData, tableClient, ...props }: React.PropsWithChildren<SongDetailContainerProps>) => {
    const song = songData.song;
    const router = useRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();
    const highlightedTagIds = props.highlightedTagIds || [];
    const dashboardContext = React.useContext(DashboardContext);

    const refetch = () => {
        tableClient?.refetch();
    };

    const visInfo = dashboardContext.getVisibilityInfo(song);

    return React.createElement(props.renderAsLinkTo ? "a" : "div", {
        href: props.renderAsLinkTo,
        className: `EventDetail contentSection event ${visInfo.className}`
    },
        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    {props.renderAsLinkTo ?
                        <div className="titleLink">
                            <span className='title'>{song.name}</span>
                            {song.introducedYear && <Tooltip title={`Introduced in ${song.introducedYear}`}><span className='titleTag'>{song.introducedYear}</span></Tooltip>}
                        </div>
                        :
                        <Link href={songData.songURI} className="titleLink">
                            <span className='title'>{song.name}</span>
                            {song.introducedYear && <Tooltip title={`Introduced in ${song.introducedYear}`}><span className='titleTag'>{song.introducedYear}</span></Tooltip>}
                        </Link>}
                    {!IsNullOrWhitespace(song.aliases) && <div className='subtitle songAliases'><Tooltip title={"Aliases"}><span>{song.aliases}</span></Tooltip></div>}
                </div>

                <div className='flex-spacer'></div>

                {
                    isShowingAdminControls && <>
                        <NameValuePair
                            isReadOnly={true}
                            name={"songId"}
                            value={song.id}
                        />
                        <InspectObject src={song} />
                    </>
                }

                {tableClient && <EditFieldsDialogButton
                    dialogTitle='Edit song'
                    dialogDescription={<SettingMarkdown setting='EditSongDialogDescription' />}
                    readonly={props.readonly}
                    initialValue={song}
                    renderButtonChildren={() => <>{gIconMap.Edit()} Edit</>}
                    tableSpec={tableClient.tableSpec}
                    onCancel={() => { }}
                    onOK={(obj: EnrichedVerboseSong, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => {
                        tableClient.doUpdateMutation(obj).then(() => {
                            showSnackbar({ children: "update successful", severity: 'success' });
                            api.close();
                            if (obj.slug !== song.slug) {
                                const newUrl = API.songs.getURIForSong(obj.id, obj.slug);
                                void router.replace(newUrl); // <-- ideally we would show the snackbar on refresh but no.
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
                />}

                {props.showVisibility && <VisibilityValue permissionId={song.visiblePermissionId} variant='minimal' />}

            </div>{/* title line */}


            <CMChipContainer>
                {song.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.tag}
                    variation={{ ...StandardVariationSpec.Weak, selected: highlightedTagIds.includes(tag.tagId) }}
                    getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`}
                />)}
            </CMChipContainer>




            {props.children}

        </div>// content
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const gSongDetailTabSlugIndices = {
    info: 0,
    files: 1,
} as const;

export interface SongDetailArgs {
    song: EnrichedVerboseSong;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTabIndex?: number;
}

export const SongDetail = ({ song, tableClient, ...props }: SongDetailArgs) => {
    const dashboardContext = React.useContext(DashboardContext);
    const router = useRouter();

    const refetch = () => {
        tableClient.refetch();
    };

    const enrichedFiles = song.taggedFiles.map(ft => {
        return {
            ...ft,
            file: db3.enrichFile(ft.file, dashboardContext),
        };
    });

    //const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || 0);
    const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || ((IsNullOrWhitespace(song.description) && (enrichedFiles.length > 0)) ? gSongDetailTabSlugIndices.files : gSongDetailTabSlugIndices.info));

    const handleTabChange = (e: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    };

    // convert index to tab slug
    const tabSlug = Object.keys(gSongDetailTabSlugIndices)[selectedTab];
    const songData = CalculateSongMetadata(song, tabSlug);

    React.useEffect(() => {
        void router.replace(songData.songURI);
    }, [songData.songURI]);

    return <SongDetailContainer readonly={props.readonly} songData={songData} tableClient={tableClient} showVisibility={true}>

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
            <FilesTabContent fileTags={enrichedFiles} readonly={props.readonly} refetch={refetch} uploadTags={{
                taggedSongId: song.id,
            }} />
        </CustomTabPanel>
    </SongDetailContainer>;

};

