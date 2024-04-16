
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
import { CMChipContainer, CMStandardDBChip, CustomTabPanel, TabA11yProps } from './CMCoreComponents';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { SongCreditsControl } from './SongCreditsControls';
import { FilesTabContent } from './SongFileComponents';
import { VisibilityValue } from './VisibilityControl';


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
export const gSongDetailTabSlugIndices = {
    info: 0,
    partitions: 1,
    recordings: 2,
    allFiles: 3,
} as const;

export interface SongDetailArgs {
    song: db3.SongPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTabIndex?: number;
    isOnlySongVisible: boolean; // some formatting stuff cares about whether this is a part of a list of events, or is the only one on the screen.
    allowRouterPush: boolean; // if true, selecting tabs updates the window location for shareability. if this control is in a list then don't set tihs.
}

export const SongDetail = ({ song, tableClient, ...props }: SongDetailArgs) => {
    const [user] = useCurrentUser()!;
    const router = useRouter();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();

    const refetch = () => {
        tableClient.refetch();
    };

    const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || 0);

    const handleTabChange = (e: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    };

    // convert index to tab slug
    const tabSlug = Object.keys(gSongDetailTabSlugIndices)[selectedTab];
    const eventURI = API.songs.getURIForSong(song, tabSlug);

    React.useEffect(() => {
        if (props.allowRouterPush) {
            void router.push(eventURI);
        }
    }, [eventURI]);

    const visInfo = API.users.getVisibilityInfo(song);

    const formattedBPM = API.songs.getFormattedBPM(song);
    const formattedLength = !!song.lengthSeconds ? formatSongLength(song.lengthSeconds) : null;

    return <div className={`EventDetail contentSection event ${visInfo.className}`}>
        <div className='header'>

            <div className="location smallInfoBox">
                <span className="text">&nbsp;</span>
            </div>
            <div className='flex-spacer'></div>
            <VisibilityValue permission={song.visiblePermission} variant='verbose' />
        </div>

        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    <Link href={eventURI} className="titleLink">
                        <span className='title'>{song.name}</span>
                        {song.introducedYear && <Tooltip title={`Introduced in ${song.introducedYear}`}><span className='titleTag'>({song.introducedYear})</span></Tooltip>}
                    </Link>
                    <div className='subtitle'><Tooltip title={"Aliases"}><span>{song.aliases}</span></Tooltip></div>
                </div>

                {
                    isShowingAdminControls &&
                    <DB3Client.NameValuePair
                        isReadOnly={true}
                        name={"songId"}
                        value={song.id}
                    />
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

                <CMChipContainer>
                    {song.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.tag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
                </CMChipContainer>

            </div>

            {formattedLength && <div className='contentRow EmphasizedProperty SongLength SingleLineNameValuePairContainer'>
                <div className='name'>Length</div><div className='value'>{formattedLength}</div>
            </div>}

            {formattedBPM && <div className='contentRow EmphasizedProperty BPM SingleLineNameValuePairContainer'>
                <div className='name'>BPM</div><div className='value'>{formattedBPM}</div>
            </div>}

            <div className='contentRow songCreditsControl'>
                <SongCreditsControl value={song} refetch={refetch} readonly={props.readonly} />
            </div>

            <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
            >
                <Tab label="Song Info" {...TabA11yProps('song', gSongDetailTabSlugIndices.info)} />
                <Tab label="Partitions" {...TabA11yProps('song', gSongDetailTabSlugIndices.partitions)} />
                <Tab label="Recordings" {...TabA11yProps('song', gSongDetailTabSlugIndices.recordings)} />
                <Tab label={`All Files (${song.taggedFiles.length})`} {...TabA11yProps('song', gSongDetailTabSlugIndices.allFiles)} />
            </Tabs>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.info}>
                {/* <Markdown markdown={song.description} /> */}
                <SongDescriptionControl readonly={props.readonly} refetch={refetch} song={song} />
            </CustomTabPanel>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.partitions}>
                partitions
            </CustomTabPanel>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.recordings}>
                recordings
            </CustomTabPanel>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.allFiles}>
                <FilesTabContent fileTags={song.taggedFiles} readonly={props.readonly} refetch={refetch} uploadTags={{
                    taggedSongId: song.id,
                }} />
            </CustomTabPanel>
        </div>

    </div>;
};


