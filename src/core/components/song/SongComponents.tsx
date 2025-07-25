
import { useAuthenticatedSession } from '@blitzjs/auth';
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Button, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { IsNullOrWhitespace, StringToEnumValue } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { Prisma } from "db";
import { API } from '../../db3/clientAPI';
import { gIconMap } from '../../db3/components/IconMap';
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../../db3/components/db3NewObjectDialog';
import { TAnyModel } from '../../db3/shared/apiTypes';
import { CMChipContainer, CMStandardDBChip } from '../CMChip';
import { NameValuePair, InspectObject } from '../CMCoreComponents2';
import { DashboardContext, useFeatureRecorder } from '../DashboardContext';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from '../EditFieldsDialog';
import { Markdown3Editor } from '../markdown/MarkdownControl3';
import { MetronomeButton } from '../Metronome';
import { Markdown } from '../markdown/Markdown';
import { SearchableNameColumnClient } from '../SearchableNameColumnClient';
import { SettingMarkdown } from '../SettingMarkdown';
import { CalculateSongMetadata, GetSongFileInfo, SongWithMetadata } from './SongComponentsBase';
import { FilesTabContent } from '../SongFileComponents';
import { SongHistory } from './SongHistory';
import { VisibilityValue } from '../VisibilityControl';
import { CMTab, CMTabPanel } from '../TabPanel';
import { AppContextMarker } from '../AppContext';
import { ActivityFeature } from '../featureReports/activityTracking';
import { CMLink } from '../CMLink';
import { UserChip } from '../user/userChip';
import { StandardVariationSpec } from '../color/palette';


export const SongClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
    //searchableName: new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
    aliases: new DB3Client.GenericStringColumnClient({ columnName: "aliases", cellWidth: 180 }),
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
        <CMLink
            // underline="hover"
            // color="inherit"
            // sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            // underline="hover"
            // color="inherit"
            href="/backstage/songs"
        //sx={{ display: 'flex', alignItems: 'center' }}
        >
            Songs
        </CMLink>

        <CMLink
            // underline="hover"
            // color="inherit"
            href={API.songs.getURIForSong(props.song)}
        // sx={{ display: 'flex', alignItems: 'center' }}
        >
            {props.song.name}
        </CMLink>

    </Breadcrumbs>
        ;
};

type SongWithDescription = Prisma.SongGetPayload<{
    select: {
        id: true,
        name: true,
        description: true,
        createdByUserId: true,
    }
}>;

////////////////////////////////////////////////////////////////
interface SongDescriptionEditorProps {
    song: SongWithDescription;
    refetch: () => void;
    onClose: () => void;
};

export const SongDescriptionEditor = (props: SongDescriptionEditorProps) => {
    const [value, setValue] = React.useState<string>(props.song.description || "");

    const mutationToken = API.songs.updateSongBasicFields.useToken();
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleSave = async (): Promise<boolean> => {
        try {
            void recordFeature({
                feature: ActivityFeature.song_edit_description,
            });
            await mutationToken.invoke({
                songId: props.song.id,
                description: value,
            });
            showSnackbar({ severity: "success", children: "Success" });
            props.refetch();
            return true;
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating song description" });
            return false;
        }
    };

    const hasEdits = (props.song.description !== value);

    const handleSaveAndClose = async (): Promise<boolean> => {
        const r = await handleSave();
        props.onClose();
        return r;
    };

    return <>
        <Markdown3Editor
            onChange={(v) => setValue(v)}
            value={value}
            nominalHeight={300}
            handleSave={() => { void handleSave() }}
            handleSaveAndClose={() => { void handleSaveAndClose() }}
            handleCancel={props.onClose}
            showActionButtons={true}
            hasEdits={hasEdits}
            uploadFileContext={{ taggedSongId: props.song.id }}
        />
    </>;
};

export const SongDescriptionControl = ({ song, refetch, readonly }: { song: SongWithDescription, refetch: () => void, readonly: boolean }) => {
    const [editing, setEditing] = React.useState<boolean>(false);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorized = db3.xSong.authorizeColumnForEdit({
        model: null,
        columnName: "description",
        clientIntention,
        publicData,
        fallbackOwnerId: song.createdByUserId,
    });

    readonly = readonly && authorized;

    return <div className='descriptionContainer'>
        {!readonly && !editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
        {editing ? <SongDescriptionEditor
            song={song}
            refetch={refetch}
            onClose={() => setEditing(false)}
        /> : <Markdown markdown={song.description} />}
    </div>;
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
    const recordFeature = useFeatureRecorder();
    const publicData = useAuthenticatedSession();

    const handleConfirmedDelete = (api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.song_credit_delete,
            songCreditTypeId: props.value.typeId,
        });
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
        void recordFeature({
            feature: ActivityFeature.song_credit_edit,
            songCreditTypeId: props.value.typeId,
        });
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
    const recordFeature = useFeatureRecorder();

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
        void recordFeature({
            feature: ActivityFeature.song_credit_add,
        });
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
                    {!!songData.song.startBPM && <MetronomeButton bpm={songData.song.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='normal' />}
                    {!!songData.song.startBPM && !!songData.song.endBPM && <div className='bpmValue'>⇢</div>}
                    {!!songData.song.endBPM && (songData.song.startBPM != songData.song.endBPM) && <MetronomeButton bpm={songData.song.endBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='normal' />}
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
                        <SongCreditEditButton readonly={props.readonly} refetch={refetch} creditsTableClient={creditsTableClient} value={credit} />
                        {/* {credit.user && credit.user.name} */}
                        <UserChip value={credit.user} />
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
            <AppContextMarker name="song metadata">
                <table className='songMetadata'>
                    <tbody>
                        {rows.map((kv, i) => <tr key={i} className={`${kv.rowClassName}`}>
                            {kv.cells.map((cell, i) => cell)}
                        </tr>)}
                    </tbody>
                </table>
            </AppContextMarker>
        }

        {insertAuthorized && !props.readonly && <DB3EditRowButton
            onSave={handleSaveNew}
            row={newObj}
            tableRenderClient={creditsTableClient}
            label={<>{gIconMap.Add()} Add song credit</>}
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
    //const router = useRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
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
                        <CMLink href={songData.songURI} className="titleLink">
                            <span className='title'>{song.name}</span>
                            {song.introducedYear && <Tooltip title={`Introduced in ${song.introducedYear}`}><span className='titleTag'>{song.introducedYear}</span></Tooltip>}
                        </CMLink>}
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
                    onOK={(obj: db3.EnrichedVerboseSong, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => {
                        void recordFeature({
                            feature: ActivityFeature.song_edit,
                            context: "song detail dialog",
                        });
                        console.log(`song update`, obj);
                        tableClient.doUpdateMutation(obj).then(() => {
                            showSnackbar({ children: "update successful", severity: 'success' });
                            api.close();
                            // if (obj.slug !== song.slug) {
                            //     const newUrl = API.songs.getURIForSong(obj.id, obj.slug);
                            //     void router.replace(newUrl); // <-- ideally we would show the snackbar on refresh but no.
                            // }
                        }).catch(err => {
                            console.log(err);
                            showSnackbar({ children: "update error", severity: 'error' });
                        }).finally(refetch);
                    }}
                    onDelete={(api: EditFieldsDialogButtonApi) => {
                        void recordFeature({
                            feature: ActivityFeature.song_delete,
                            context: "song detail dialog",
                        });
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
                    getTooltip={(_) => tag.tag.description}
                />)}
            </CMChipContainer>




            {props.children}

        </div>// content
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export enum SongDetailTabSlug {
    info = "info",
    parts = "parts",
    recordings = "recordings",
    files = "files",
    history = "history",
};


export interface SongDetailArgs {
    song: db3.EnrichedVerboseSong;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTab?: SongDetailTabSlug;
}

export const SongDetail = ({ song, tableClient, ...props }: SongDetailArgs) => {
    const dashboardContext = React.useContext(DashboardContext);
    const router = useRouter();

    const refetch = () => {
        tableClient.refetch();
    };

    const fileInfo = GetSongFileInfo(song, dashboardContext);

    const [selectedTab, setSelectedTab] = React.useState<SongDetailTabSlug>(props.initialTab || ((IsNullOrWhitespace(song.description) && (fileInfo.enrichedFiles.length > 0)) ? SongDetailTabSlug.files : SongDetailTabSlug.info));

    // convert index to tab slug
    const songData = CalculateSongMetadata(song, selectedTab);

    React.useEffect(() => {
        void router.replace(songData.songURI, undefined, { shallow: true }); // shallow prevents annoying re-scroll behavior
    }, [songData.songURI]);

    const handleTabChange = (newId: string) => {
        const slug = StringToEnumValue(SongDetailTabSlug, (newId || "").toString()) || SongDetailTabSlug.info;
        setSelectedTab(slug);
    }

    return <SongDetailContainer readonly={props.readonly} songData={songData} tableClient={tableClient} showVisibility={true}>

        <SongMetadataView readonly={props.readonly} refetch={refetch} songData={songData} showCredits={true} />

        <CMTabPanel
            selectedTabId={selectedTab}
            handleTabChange={(e, newId) => handleTabChange(newId as string)}
        >
            <CMTab
                thisTabId={SongDetailTabSlug.info}
                summaryTitle={"Info"}
                summaryIcon={gIconMap.Info()}
                canBeDefault={!IsNullOrWhitespace(song.description)}
            >
                <AppContextMarker name="info tab" songId={song.id}>
                    <SongDescriptionControl readonly={props.readonly} refetch={refetch} song={song} />
                </AppContextMarker>
            </CMTab>
            <CMTab
                thisTabId={SongDetailTabSlug.parts}
                summaryTitle={"Parts"}
                summaryIcon={gIconMap.LibraryMusic()}
                summarySubtitle={fileInfo.partitions.length}
                canBeDefault={!!fileInfo.partitions.length}
            >
                <AppContextMarker name="partitions tab" songId={song.id}>
                    <FilesTabContent
                        fileTags={fileInfo.partitions}
                        readonly={props.readonly}
                        refetch={refetch}
                        uploadTags={{
                            taggedSongId: song.id,
                            fileTagId: dashboardContext.fileTag.find(t => t.significance === db3.FileTagSignificance.Partition)?.id,
                        }}
                        contextSong={song}
                    />
                </AppContextMarker>
            </CMTab>
            <CMTab
                thisTabId={SongDetailTabSlug.recordings}
                summaryTitle={"Recordings"}
                summaryIcon={gIconMap.PlayCircleOutline()}
                summarySubtitle={fileInfo.recordings.length}
                canBeDefault={!!fileInfo.recordings.length}
            >
                <AppContextMarker name="recordings tab" songId={song.id}>
                    <FilesTabContent
                        fileTags={fileInfo.recordings}
                        readonly={props.readonly}
                        refetch={refetch}
                        uploadTags={{
                            taggedSongId: song.id,
                            fileTagId: dashboardContext.fileTag.find(t => t.significance === db3.FileTagSignificance.Recording)?.id,
                        }}
                        contextSong={song}
                    />
                </AppContextMarker>
            </CMTab>
            <CMTab
                thisTabId={SongDetailTabSlug.files}
                summaryTitle={"All files"}
                summaryIcon={gIconMap.AttachFile()}
                summarySubtitle={song.taggedFiles.length}
                canBeDefault={!!song.taggedFiles.length}
            >
                <AppContextMarker name="all files tab" songId={song.id}>
                    <FilesTabContent
                        fileTags={fileInfo.enrichedFiles}
                        readonly={props.readonly}
                        refetch={refetch}
                        uploadTags={{
                            taggedSongId: song.id,
                        }}
                        contextSong={song}
                    />
                </AppContextMarker>
            </CMTab>
            <CMTab
                thisTabId={SongDetailTabSlug.history}
                summaryTitle={"Stats"}
                summaryIcon={gIconMap.Equalizer()}
            >
                <AppContextMarker name="stats tab" songId={song.id}>
                    <SongHistory song={song} />
                </AppContextMarker>
            </CMTab>
        </CMTabPanel>


    </SongDetailContainer>;

};

