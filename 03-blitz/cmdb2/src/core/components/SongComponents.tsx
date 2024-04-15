
import { useAuthenticatedSession } from '@blitzjs/auth';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { Prisma } from "db";
import { useRouter } from "next/router";
import React from "react";
import { ColorVariationSpec, StandardVariationSpec } from 'shared/color';
import { Permission } from 'shared/permissions';
import { Timing } from 'shared/time';
import { IsNullOrWhitespace } from 'shared/utils';
import { useAuthorization } from 'src/auth/hooks/useAuthorization';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { AttendanceChip, CMChipContainer, CMStandardDBChip, CMStatusIndicator, CustomTabPanel, EventDetailVerbosity, InstrumentChip, InstrumentFunctionalGroupChip, ReactiveInputDialog, TabA11yProps, } from './CMCoreComponents';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { EventAttendanceControl } from './EventAttendanceComponents';
import { EventFilesTabContent } from './EventFileComponents';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { SegmentList } from './EventSegmentComponents';
import { EventSongListTabContent } from './EventSongListComponents';
import { Markdown } from './RichTextEditor';
import { GenerateDefaultDescriptionSettingName, MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { AddUserButton } from './UserComponents';
import { CMDialogContentText } from './CMCoreComponents2';
import { VisibilityValue } from './VisibilityControl';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';


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
    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
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





export const gSongDetailTabSlugIndices = {
    "info": 0,
    "credits": 1,
    "files": 2,
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
            console.log(`pushing route: ${eventURI}; song:${song.id}`);
            void router.push(eventURI);
        }
    }, [eventURI]);

    const visInfo = API.users.getVisibilityInfo(song);

    return <div className={`EventDetail contentSection event ${visInfo.className}`}>
        <div className='header'>

            <div className="location smallInfoBox">
                <span className="text">some text</span>
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
                    dialogDescription={<SettingMarkdown setting='EditSongDialogDescription' />}
                />

                <CMChipContainer>
                    {song.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.tag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
                </CMChipContainer>

            </div>





            <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
            >
                <Tab label="Song Info" {...TabA11yProps('song', gSongDetailTabSlugIndices.info)} />
                <Tab label="Credits" {...TabA11yProps('song', gSongDetailTabSlugIndices.credits)} />
                <Tab label={`Files (${song.taggedFiles.length})`} {...TabA11yProps('song', gSongDetailTabSlugIndices.files)} />
            </Tabs>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.info}>
                <Markdown markdown={song.description} />
            </CustomTabPanel>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.credits}>
                credits
            </CustomTabPanel>

            <CustomTabPanel tabPanelID='song' value={selectedTab} index={gSongDetailTabSlugIndices.files}>
                song files
            </CustomTabPanel>
        </div>

    </div>;
};



// export interface EventDashboardItemProps {
//     event: db3.EventClientPayload_Verbose,
//     onRefetch: () => void;
// }
// export const EventDashboardItem = ({ event, ...props }: EventDashboardItemProps) => {
//     const eventURI = API.events.getURIForEvent(event);
//     const visInfo = API.users.getVisibilityInfo(event);
//     const expectedAttendanceTag = API.users.getUserTag(event.expectedAttendanceUserTagId);
//     const responseInfo = db3.GetEventResponseInfo({ event, expectedAttendanceTag });
//     const eventTiming = API.events.getEventTiming(event);

//     return <div className={`EventDetail contentSection event ${visInfo.className} ${(eventTiming === Timing.Past) ? "past" : "notPast"}`}>
//         <div className='header'>
//             <CMChipContainer>
//                 {event.type && //<EventTypeValue type={event.type} />
//                     <CMStandardDBChip
//                         model={event.type}
//                         getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
//                         variation={{ ...StandardVariationSpec.Strong /*, fillOption: 'hollow'*/ }}
//                     />
//                 }

//             </CMChipContainer>

//             <div className="date smallInfoBox">
//                 <CalendarMonthIcon className="icon" />
//                 <span className="text">{API.events.getEventDateRange(event).toString()}</span>
//             </div>
//             <div className="location smallInfoBox">
//                 <PlaceIcon className="icon" />
//                 <span className="text">{IsNullOrWhitespace(event.locationDescription) ? "Location TBD" : event.locationDescription}</span>
//             </div>
//         </div>

//         <div className='content'>

//             <div className='titleLine'>
//                 <div className="titleText">
//                     <Link href={eventURI} className="titleLink">
//                         {event.name}
//                     </Link>
//                 </div>

//                 {event.status && <CMStandardDBChip
//                     variation={{ ...StandardVariationSpec.Strong, fillOption: 'hollow' }}
//                     border='border'
//                     shape="rectangle"
//                     model={event.status} getTooltip={(_, c) => !!c ? `Status: ${c}` : `Status`}
//                 />}

//                 <CMChipContainer>
//                     {event.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.eventTag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
//                 </CMChipContainer>
//             </div>

//             <EventAttendanceControl
//                 event={event}
//                 linkToEvent={false}
//                 onRefetch={props.onRefetch}
//                 responseInfo={responseInfo}
//             />
//         </div>
//     </div>;


// };

