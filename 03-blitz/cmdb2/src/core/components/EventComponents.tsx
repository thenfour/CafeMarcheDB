// 


// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, Card, CardActionArea, Link, Tab, Tabs } from "@mui/material";
import { Prisma } from "db";
import React, { Suspense } from "react";
import { ArrayElement, IsNullOrWhitespace } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { RenderMuiIcon, gIconMap } from '../db3/components/IconSelectDialog';
import { CMTagList, ConfirmationDialog, CustomTabPanel, EditTextDialogButton, EventDetailVerbosity, TabA11yProps, VisibilityControl } from './CMCoreComponents';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { EventAttendanceFrame, EventAttendanceSummary } from './EventAttendanceComponents';
import { EventCommentTabContent } from './EventCommentComponents';
import { MutationMarkdownControl } from './SettingMarkdown';
import { EventSegmentPanel, NewSegmentButton, SegmentList } from './EventSegmentComponents';

////////////////////////////////////////////////////////////////
// TODO: generic big status
////////////////////////////////////////////////////////////////
// specific non-interactive status for event status
// export interface EventTypeValueProps {
//     type: db3.EventTypePayload,
// };

// // actually this would look better:
// <div className="statusIndicator confirmed">
//     <CheckIcon className="statusIcon" />
//     <span className="statusText">Confirmed</span>
// </div>

// export const EventTypeValue = (props: EventTypeValueProps) => {
//     const style = GetStyleVariablesForColor(props.type.color);
//     return <div><div className={`statusIndicator applyColor-inv`} style={style}>
//         {props.type.text}
//     </div></div>;
// };

type EventWithTypePayload = Prisma.EventGetPayload<{
    include: {
        type: true,
        visiblePermission: {
            include: {
                roles: true,
            }
        },
    }
}>;


////////////////////////////////////////////////////////////////
// TODO: generic big status
////////////////////////////////////////////////////////////////
// specific non-interactive status for event status
export interface CMEventBigStatusProps {
    event: db3.EventPayloadClient,
    //tableClient: DB3Client.xTableRenderClient,
};

// actually this would look better:
{/* <div className="statusIndicator confirmed">
                <CheckIcon className="statusIcon" />
                <span className="statusText">Confirmed</span>
            </div> */}

export const CMEventBigStatus = (props: CMEventBigStatusProps) => {
    if (!props.event.status) {
        return null;
    }
    const status: db3.EventStatusPayloadBare = props.event.status;
    const style = GetStyleVariablesForColor(status.color);
    //console.log(status.color)
    return <div><div className={`bigstatus applyColor-inv`} style={style}>
        {RenderMuiIcon(status.iconName)}
        {status.label}
    </div></div>;
};





////////////////////////////////////////////////////////////////
// non-interactive-feeling card; it's meant as a gateway to something else with very little very curated information.
export interface NoninteractiveCardEventProps {
    event: db3.EventPayloadClient,
    //tableClient: DB3Client.xTableRenderClient,
};

export const NoninteractiveCardEvent = (props: NoninteractiveCardEventProps) => {

    // the rotation is cool looking but maybe just too much
    // const maxRotation = 2;
    // const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    // const maxMargin = 30;
    // const marginLeft = `${(Math.random() * maxMargin) + 25}px`;
    // style={{ rotate, marginLeft }}

    // find your attendance record.
    const [user] = useCurrentUser();
    if (!user || !user.id) throw new Error(`no current user`);

    return <Card className="cmcard event concert" elevation={5} >
        <CardActionArea className="actionArea" href={API.events.getURIForEvent(props.event)}>
            <div className="cardContent">
                <div className="left"><div className="leftVertText">{props.event.dateRangeInfo.formattedYear}</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">{props.event.dateRangeInfo.formattedDateRange}</div>
                    <div className="name">{props.event.name}</div>

                    <CMEventBigStatus event={props.event} />
                    {/* 
                    <CMBigChip color={sampleColor} variant='strong'>
                        <ThumbUpIcon />
                        You are coming!
                    </CMBigChip> */}

                    <EventAttendanceSummary event={props.event} />

                    {/* 
                    <div className="attendance yes">
                        <div className="chip">
                        </div>
                    </div> */}

                    {/* <div className="info">43 photos uploaded</div> */}
                    <CMTagList
                        tagAssociations={props.event.tags}
                        columnSchema={db3.xEvent.getColumn("tags") as db3.TagsField<db3.EventTagAssignmentPayload>}
                        //tagsFieldClient={props.tableClient.args.tableSpec.getColumn("tags") as DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>}
                        colorVariant="weak"
                    />
                </div>
            </div>
        </CardActionArea>
    </Card>
};

////////////////////////////////////////////////////////////////
export interface EventBreadcrumbProps {
    event: db3.EventPayloadClient,
};
export const EventBreadcrumbs = (props: EventBreadcrumbProps) => {
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
            href="/backstage/events"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Events
        </Link>

        <Link
            underline="hover"
            color="inherit"
            href={API.events.getURIForEvent(props.event)}
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            {props.event.name}
        </Link>


        {/* <Typography color="text.primary">{params.idOrSlug}</Typography> */}
    </Breadcrumbs>
        ;
};


////////////////////////////////////////////////////////////////
type SongListPayload = ArrayElement<db3.EventClientPayload_Verbose['songLists']>;
type SongListSongPayload = ArrayElement<SongListPayload['songs']>;

export interface SongListSongProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    songList: ArrayElement<db3.EventClientPayload_Verbose['songLists']>;
    song: SongListSongPayload,
    index: number,
};

export const SongListSong = ({ event, tableClient, songList, song, index }: SongListSongProps) => {
    return <tr>
        <td>{index + 1 /** one-based */}</td>
        <td><a href={API.songs.getURIForSong(song.song)}>{song.song.name}</a></td>
        <td>{song.subtitle}</td>
        <td>{song.song.startBPM}-{song.song.endBPM} BPM</td>
        <td>{song.song.lengthSeconds}</td>
    </tr>;
};



////////////////////////////////////////////////////////////////
export interface EventSongListDetailProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    songList: SongListPayload;
};

////////////////////////////////////////////////////////////////
export const SongListSummary = ({ event, tableClient, songList }: EventSongListDetailProps) => {
    const totalSeconds = songList.songs.reduce((acc, song) => acc + (song.song.lengthSeconds || 0), 0);
    return <tr>
        <td>{songList.songs.length} songs</td>
        <td></td>
        <td></td>
        <td></td>
        <td>{totalSeconds} total seconds</td>
    </tr>;
};

////////////////////////////////////////////////////////////////
export const EventSongListDetail = ({ event, tableClient, songList }: EventSongListDetailProps) => {
    return <>
        <div className='caption'>{songList.name} {gIconMap.Edit()}</div>
        <div className='description'>{songList.description}</div>
        <table className='songListTable'>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Song</th>
                    <th>Comment</th>
                    <th>BPM</th>
                    <th>Length</th>
                </tr>
            </thead>
            <tbody>
                {songList.songs.map((song, index) => <SongListSong key={song.id} index={index} event={event} tableClient={tableClient} songList={songList} song={song} />)}
            </tbody>
            <tfoot>
                <SongListSummary event={event} tableClient={tableClient} songList={songList} />
            </tfoot>
        </table>
    </>;

};




////////////////////////////////////////////////////////////////
// tag list with ability to edit
// see also OwnInstrumentsControl
interface EventTagsControlProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
};

export const EventTagsControl = ({ event, tableClient }: EventTagsControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const validationResult = tableClient.schema.ValidateAndComputeDiff(event, event, "update");
    return tableClient.getColumn("tags").renderForNewDialog!({
        key: event.id,
        row: event,
        value: event.tags,
        validationResult,
        api: {
            setFieldValues: (updatedFields) => {
                const updateObj = {
                    id: event.id,
                    ...updatedFields,
                };
                tableClient.doUpdateMutation(updateObj).then(e => {
                    showSnackbar({ severity: "success", children: "Tags updated" });
                }).catch(e => {
                    console.log(e);
                    showSnackbar({ severity: "error", children: "error updating tags" });
                });
            }
        }
    });
};






////////////////////////////////////////////////////////////////
export interface EventAttendanceDetailRowProps {
    userResponse: db3.EventInfoForUser;
};

export const EventAttendanceDetailRow = ({ userResponse }: EventAttendanceDetailRowProps) => {
    return <tr>
        <td>{userResponse.user.name}</td>
        {userResponse.segments.map(segment => {
            return <React.Fragment key={segment.segment.id}>
                <td>{!!segment.response.attendance ? segment.response.attendance.text : "--"}</td>
                <td>{segment.instrument?.name || "--"}</td>
                <td>{segment.instrument?.functionalGroup.name || "--"}</td>
            </React.Fragment>;
        })}
    </tr>;
};



////////////////////////////////////////////////////////////////
export interface EventAttendanceDetailProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
};

export const EventAttendanceDetail = ({ event, tableClient }: EventAttendanceDetailProps) => {
    const userResponses = db3.GetEventResponsesPerUser({ event });
    const segAttendees = API.events.getAttendeeCountPerSegment({ event });

    return <>
        <table className='attendanceDetailTable'>
            <thead>
                <tr>
                    <th>Who</th>
                    {event.segments.map(seg => <React.Fragment key={seg.id}>
                        <th>{seg.name}</th>
                        <th>Instrument</th>
                        <th>Function</th>
                    </React.Fragment>)}
                </tr>
            </thead>
            <tbody>
                {
                    userResponses.map(userResponse => <EventAttendanceDetailRow key={userResponse.user.id} userResponse={userResponse} />)
                }
            </tbody>
            <tfoot>
                <tr>
                    <td></td>
                    {segAttendees.map(seg => <React.Fragment key={seg.segment.id}>
                        <td>{seg.attendeeCount}</td>
                        <td>{/*Instrument*/}</td>
                        <td>{/*Function*/}</td>
                    </React.Fragment>)}
                </tr>
            </tfoot>
        </table>
    </>;

};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventDescriptionControl = ({ event, refetch }: { event: db3.EventPayloadMinimum, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    return <MutationMarkdownControl
        initialValue={event.description}
        refetch={refetch}
        onChange={(newValue) => mutationToken.invoke({
            eventId: event.id,
            description: newValue || "",
        })}
    />;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventVisibilityControl = ({ event, refetch }: { event: EventWithTypePayload, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleChange = (value: db3.PermissionPayload | null) => {
        mutationToken.invoke({
            eventId: event.id,
            visiblePermissionId: !value ? null : value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event visibility" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event visibility" });
        }).finally(() => {
            refetch();
        });
    };

    return <VisibilityControl value={event.visiblePermission} onChange={handleChange} />;
};










////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventTypeValue = ({ type }: { type: db3.EventTypePayload | null }) => {
    const style = GetStyleVariablesForColor(type?.color);
    return <div className='eventTypeValue' style={style}>
        {RenderMuiIcon(type?.iconName)}
        {type == null ? "--" :
            type.text}
    </div>;
};

export const EventTypeControl = ({ event, refetch }: { event: EventWithTypePayload, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleChange = (value: db3.EventTypePayload | null) => {
        mutationToken.invoke({
            eventId: event.id,
            typeId: !value ? undefined : value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event type" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event type" });
        }).finally(() => {
            refetch();
        });
    };

    const typesClient = API.events.getEventTypesClient();

    // value type is EventTypePayload
    return <div className={`eventTypeControl ${event.type?.significance}`}>
        <ChoiceEditCell
            isEqual={(a: db3.EventTypePayload, b: db3.EventTypePayload) => a.id === b.id}
            items={typesClient.items}
            readOnly={false} // todo!
            validationError={null}
            selectDialogTitle='select dialog title here'
            selectButtonLabel='select button'
            value={event.type}
            renderDialogDescription={() => {
                return <>dialog description heree</>;
            }}
            renderAsListItem={(chprops, value: db3.EventTypePayload | null, selected: boolean) => {
                return <li {...chprops}>
                    <EventTypeValue type={value} /></li>;
            }}
            renderValue={(value: db3.EventTypePayload | null, onDelete) => {
                return <EventTypeValue type={value} />;
            }}
            onChange={handleChange}
        />
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type EventWithStatusPayload = Prisma.EventGetPayload<{
    include: {
        status: true,
    }
}>;

// todo: format like: {/* <CMEventBigStatus event={event} /> */}
export const EventStatusValue = ({ value }: { value: db3.EventStatusPayload | null }) => {
    const style = GetStyleVariablesForColor(value?.color);
    return <div className='eventStatusValue' style={style}>
        {RenderMuiIcon(value?.iconName as any)}
        {value == null ? "--" :
            value.label}
    </div>;
};

export const EventStatusControl = ({ event, refetch }: { event: EventWithStatusPayload, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleChange = (value: db3.EventStatusPayload | null) => {
        mutationToken.invoke({
            eventId: event.id,
            statusId: !value ? undefined : value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event status" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event status" });
        }).finally(() => {
            refetch();
        });
    };

    const statusesClient = API.events.getEventStatusesClient();

    // value type is EventStatusPayload
    return <div className={`eventStatusControl ${event.status?.significance}`}>
        <ChoiceEditCell
            isEqual={(a: db3.EventStatusPayload, b: db3.EventStatusPayload) => a.id === b.id}
            items={statusesClient.items}
            readOnly={false} // todo!
            validationError={null}
            selectDialogTitle='select dialog title here'
            selectButtonLabel='select button'
            value={event.status}
            renderDialogDescription={() => {
                return <>dialog description heree</>;
            }}
            renderAsListItem={(chprops, value: db3.EventStatusPayload | null, selected: boolean) => {
                return <li {...chprops}>
                    <EventStatusValue value={value} /></li>;
            }}
            renderValue={(value: db3.EventStatusPayload | null, onDelete) => {
                return <EventStatusValue value={value} />;
            }}
            onChange={handleChange}
        />
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSoftDeleteControl = ({ event, refetch }: { event: db3.EventPayloadMinimum, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [showingConfirmation, setShowingConfirmation] = React.useState(false);

    const handleClick = () => {
        mutationToken.invoke({
            eventId: event.id,
            isDeleted: true,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully deleted event" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error deleting event" });
        }).finally(() => {
            refetch();
            setShowingConfirmation(false);
        });
    };

    return <>
        <div className={`interactable EventSoftDeleteControl`} onClick={() => setShowingConfirmation(true)}>
            {gIconMap.Delete()}
        </div>
        {showingConfirmation && <ConfirmationDialog onCancel={() => setShowingConfirmation(false)} onConfirm={handleClick} />}
    </>;
};




////////////////////////////////////////////////////////////////
export const EventTitleControl = ({ event, refetch }: { event: EventWithStatusPayload, refetch: () => void }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleChange = (newValue: string) => {
        mutationToken.invoke({
            eventId: event.id,
            name: newValue,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event location" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event location" });
        }).finally(() => {
            refetch();
        });
    };

    return <div className="titleText">
        <Link href={API.events.getURIForEvent(event)} className="titleLink">
            {event.name}
        </Link>
        <EditTextDialogButton
            columnSpec={db3.xEvent.getColumn("name")! as db3.FieldBase<string>}
            dialogTitle='name dlg title'
            readOnly={false} // todo
            renderDialogDescription={() => <>description here</>}
            selectButtonLabel='edit name'
            value={event.name}
            onChange={handleChange}
        />
    </div>;

};


////////////////////////////////////////////////////////////////
export const EventLocationControl = ({ event, refetch }: { event: EventWithStatusPayload, refetch: () => void }) => {
    const locationKnown = !IsNullOrWhitespace(event.locationDescription);
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleChange = (newValue: string) => {
        mutationToken.invoke({
            eventId: event.id,
            locationDescription: newValue,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event location" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event location" });
        }).finally(() => {
            refetch();
        });
    };

    return <div className="location smallInfoBox">
        <PlaceIcon className="icon" />
        <span className="text">{
            locationKnown ? event.locationDescription : "Location TBD"
        }</span>
        <EditTextDialogButton
            columnSpec={db3.xEvent.getColumn("locationDescription")! as db3.FieldBase<string>}
            dialogTitle='Location'
            readOnly={false} // todo
            renderDialogDescription={() => <>description here</>}
            selectButtonLabel='edit location'
            value={event.locationDescription}
            onChange={handleChange}
        />
    </div>;
};



export const EventDetail = ({ event, tableClient, verbosity }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, verbosity: EventDetailVerbosity }) => {
    const [user] = useCurrentUser()!;
    const myEventInfo = API.events.getEventInfoForUser({ event, user: user as any });

    const functionalGroupsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention: { intention: 'user', mode: 'primary' },
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xInstrumentFunctionalGroup,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    const [selectedTab, setSelectedTab] = React.useState<number>(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    };

    const minMaxSegmentAttendees = API.events.getMinMaxAttendees({ event });
    let formattedAttendeeRange: string = "";
    if (minMaxSegmentAttendees.maxAttendees === null || minMaxSegmentAttendees.minAttendees === null) {
        // probably no segments or no attendees.
    }
    else if (minMaxSegmentAttendees.maxAttendees === minMaxSegmentAttendees.minAttendees) {
        // equal. could be 1 segment, or all similar responses.
        formattedAttendeeRange = ` (${minMaxSegmentAttendees.maxAttendees})`;
    } else {
        formattedAttendeeRange = ` (${minMaxSegmentAttendees.minAttendees}-${minMaxSegmentAttendees.maxAttendees})`;
    }

    return <div className={`contentSection event ${verbosity}Verbosity`}>

        <Suspense>
            <EventVisibilityControl event={event} refetch={tableClient.refetch} />
        </Suspense>

        <div className="infoLine">
            <div className="date smallInfoBox">
                <CalendarMonthIcon className="icon" />
                <span className="text">{event.dateRangeInfo.formattedDateRange}</span>
            </div>

            <EventLocationControl event={event} refetch={tableClient.refetch} />
        </div>

        <div className='titleLine'>
            <EventTitleControl event={event} refetch={tableClient.refetch} />
            <EventTypeControl event={event} refetch={tableClient.refetch} />
            <EventStatusControl event={event} refetch={tableClient.refetch} />
            <EventSoftDeleteControl event={event} refetch={tableClient.refetch} />
        </div>

        <div className="tagsLine">
            <EventTagsControl event={event} tableClient={tableClient} />
        </div>
        {/* 
        <div className="attendanceResponseInput">
            <div className="segmentList">
                {event.segments.map(segment => {
                    const segInfo = myEventInfo.getSegmentUserInfo(segment.id);
                    return <EventAttendanceFrame key={segment.id} onRefetch={refetch} segmentInfo={segInfo} eventUserInfo={myEventInfo} event={event} />;
                })}
            </div>
        </div> */}

        <SegmentList event={event} myEventInfo={myEventInfo} tableClient={tableClient} verbosity={verbosity} />

        {verbosity === 'verbose' && (
            <>
                <Tabs value={selectedTab} onChange={handleTabChange}>
                    <Tab label="Info" {...TabA11yProps('event', 0)} />
                    <Tab label={`Comments (${event.comments.length})`} {...TabA11yProps('event', 1)} />
                    <Tab label={`Set Lists (${event.songLists.length})`} {...TabA11yProps('event', 2)} />
                    <Tab label={`Attendance ${formattedAttendeeRange}`} {...TabA11yProps('event', 3)} />
                    <Tab label={`Completeness`} {...TabA11yProps('event', 4)} />
                    <Tab label={`Files (${event.fileTags.length})`} {...TabA11yProps('event', 5)} />
                </Tabs>

                <CustomTabPanel tabPanelID='event' value={selectedTab} index={0}>
                    <div className='descriptionLine'>
                        <EventDescriptionControl event={event} refetch={tableClient.refetch} />
                    </div>
                </CustomTabPanel>

                <CustomTabPanel tabPanelID='event' value={selectedTab} index={1}>
                    <EventCommentTabContent event={event} tableClient={tableClient} />
                </CustomTabPanel>

                <CustomTabPanel tabPanelID='event' value={selectedTab} index={2}>
                    {
                        event.songLists.map(songList => <EventSongListDetail key={songList.id} event={event} tableClient={tableClient} songList={songList} />)
                    }
                    <Button startIcon={gIconMap.Add()}>Add song list</Button>
                </CustomTabPanel>

                <CustomTabPanel tabPanelID='event' value={selectedTab} index={3}>
                    <EventAttendanceDetail event={event} tableClient={tableClient} />
                </CustomTabPanel>

                <CustomTabPanel tabPanelID='event' value={selectedTab} index={4}>
                    {/* COMPLETENESS */}
                    <table>
                        <tbody>
                            <tr>
                                <th>Instrument group</th>
                                {event.segments.map((seg) => {
                                    return <th key={seg.id}>{seg.name}</th>;
                                })}
                            </tr>
                            {
                                (functionalGroupsClient.items as db3.InstrumentFunctionalGroupPayload[]).map(functionalGroup => {
                                    return <tr key={functionalGroup.id}>
                                        <td>{functionalGroup.name}</td>
                                        {event.segments.map((seg) => {
                                            // come up with the icons per user responses
                                            // either just sort segment responses by answer strength,
                                            // or group by answer. not sure which is more useful probably the 1st.
                                            const sorted = seg.responses.filter(resp => {
                                                // only take responses where we 1. expect the user, OR they have responded.
                                                // AND it matches the current instrument function.
                                                const responseInstrument = API.events.getInstrumentForUserResponse(resp, resp.user);
                                                if (responseInstrument?.functionalGroupId !== functionalGroup.id) return false;
                                                return resp.expectAttendance || !!resp.attendance;
                                            });
                                            sorted.sort((a, b) => {
                                                // no response is weakest.
                                                if (a.attendance === null) {
                                                    if (b.attendance === null) return 0;
                                                    return -1; // null always lowest, and b is not null.
                                                }
                                                if (b.attendance === null) {
                                                    return 1; // b is null & a is not.
                                                }
                                                return (a > b) ? -1 : 1;
                                            });
                                            return <td key={seg.id}>
                                                {sorted.map(resp => {
                                                    if (resp.attendance === null) {
                                                        return <div key={resp.id}>null</div>;
                                                    }
                                                    return <div key={resp.id}>{resp.attendance.text}</div>
                                                })}
                                            </td>;
                                        })}
                                    </tr>;
                                })
                            }
                        </tbody>
                    </table>
                </CustomTabPanel>


                <CustomTabPanel tabPanelID='event' value={selectedTab} index={5}>
                    (todo)
                </CustomTabPanel>

            </>
        )}


    </div>;
};
