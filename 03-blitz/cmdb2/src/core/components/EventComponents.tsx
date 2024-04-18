
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

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
import { DateTimeRange, Timing } from 'shared/time';
import { IsNullOrWhitespace } from 'shared/utils';
import { useAuthorization } from 'src/auth/hooks/useAuthorization';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from '../db3/components/IconSelectDialog';
import { AttendanceChip, CMChip, CMChipContainer, CMChipProps, CMStandardDBChip, CMStatusIndicator, CustomTabPanel, InspectObject, InstrumentChip, InstrumentFunctionalGroupChip, ReactiveInputDialog, TabA11yProps, TimingChip, } from './CMCoreComponents';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { EventAttendanceControl } from './EventAttendanceComponents';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { SegmentList } from './EventSegmentComponents';
import { EventSongListTabContent } from './EventSongListComponents';
import { Markdown } from './RichTextEditor';
import { GenerateDefaultDescriptionSettingName, MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { AddUserButton } from './UserComponents';
import { CMDialogContentText } from './CMCoreComponents2';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { VisibilityControl, VisibilityValue } from './VisibilityControl';
import { FilesTabContent } from './SongFileComponents';
import { CalculateEventMetadata, EventWithMetadata } from './EventComponentsBase';


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
export interface EventAttendanceEditDialogProps {
    responseInfo: db3.EventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    refetch: () => void;

    onCancel: () => void;
    onOK: () => void;
};

// see also NewEventDialogWrapper for doing this.
//  some challenges:
// 1. fields from multiple tables. for the moment let's continue to do things manually. we also do this for NewEventDialogWrapper
// 2. insert-or-update style. i guess we need a new mutation for this? well let's use the existing stuff.
// 3. this edits responses for all segments, not just 1. so a dynamic # of items
export const EventAttendanceEditDialog = (props: EventAttendanceEditDialogProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const mutationToken = API.events.updateUserEventAttendance.useToken();

    const [eventResponseValue, setEventResponseValue] = React.useState<db3.EventUserResponsePayload>(props.responseInfo.getEventResponseForUser(props.user).response);
    const [eventSegmentResponseValues, setEventSegmentResponseValues] = React.useState<Record<number, db3.EventSegmentUserResponsePayload>>(() => {
        return Object.fromEntries(Object.entries(props.responseInfo.getResponsesBySegmentForUser(props.user)).map(x => [x[0], x[1].response]));
    });

    // use the db3 client stuff for rendering / validating fields.
    const eventResponseTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventUserResponse,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "userComment", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isInvited" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "instrument", cellWidth: 120 }),
        ],
    });

    const eventSegmentResponseTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegmentUserResponse,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({
                columnName: "attendance",
                cellWidth: 120,
                renderAsChip: (args: DB3Client.RenderAsChipParams<db3.EventAttendanceBasePayload>) => <CMStandardDBChip model={args.value} variation={args.colorVariant} />,
            }),
        ],
    });

    //necessary to connect all the columns in the spec.
    const eventResponseTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None, // we're only using this for display.
        tableSpec: eventResponseTableSpec,
    });

    //necessary to connect all the columns in the spec.
    const eventSegmentResponseTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None, // we're only using this for display.
        tableSpec: eventSegmentResponseTableSpec,
    });

    const eventValidationResult = eventResponseTableSpec.args.table.ValidateAndComputeDiff(eventResponseValue, eventResponseValue, "update", clientIntention);
    const eventSegmentValidationResults: Record<number, db3.ValidateAndComputeDiffResult> = Object.fromEntries(
        props.event.segments.map(segment => [segment.id, eventSegmentResponseTableSpec.args.table.ValidateAndComputeDiff(eventSegmentResponseValues[segment.id]!, eventSegmentResponseValues[segment.id]!, "update", clientIntention)])
    );

    const handleSaveClick = () => {
        mutationToken.invoke({
            userId: props.user.id,
            eventId: props.event.id,
            isInvited: eventResponseValue.isInvited,
            comment: eventResponseValue.userComment,
            instrumentId: eventResponseValue.instrumentId,
            segmentResponses: Object.fromEntries(Object.entries(eventSegmentResponseValues).map(x => [x[0], {
                attendanceId: x[1].attendance?.id || null
            }])),
        }).then(() => {
            showSnackbar({ children: "update successful", severity: 'success' });
            props.onOK();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "update error", severity: 'error' });
        }).finally(props.refetch);
    };

    const handleChangedEventResponse = (n: db3.EventUserResponsePayload) => {
        setEventResponseValue(n);
    };

    const handleChangedEventSegmentResponse = (segment: db3.EventSegmentPayloadMinimum, n: db3.EventSegmentUserResponsePayload) => {
        const newval = {
            ...eventSegmentResponseValues,
            [segment.id]: n
        };
        setEventSegmentResponseValues(newval);
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>

        <DialogTitle>
            edit event response for user / event
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                description of events and segments?
            </CMDialogContentText>

            <div className="EventSongListValue">
                {eventResponseTableSpec.renderEditor("isInvited", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention)}
                {eventResponseTableSpec.renderEditor("instrument", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention)}

                {
                    props.event.segments.map(segment => {
                        const validationResult = eventSegmentValidationResults[segment.id]!;
                        const response = eventSegmentResponseValues[segment.id]!;
                        return <div key={segment.id}>
                            <div>{segment.name}
                                {eventSegmentResponseTableSpec.renderEditor("attendance", response, validationResult, (n) => handleChangedEventSegmentResponse(segment, n), clientIntention)}
                            </div>
                        </div>;
                    })
                }
                {eventResponseTableSpec.renderEditor("userComment", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention)}

            </div>
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
            <Button onClick={handleSaveClick} startIcon={gIconMap.Save()}>OK</Button>
        </DialogActions>

    </ReactiveInputDialog>;
};



////////////////////////////////////////////////////////////////
export interface EventAttendanceEditButtonProps {
    responseInfo: db3.EventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    refetch: () => void;
};
export const EventAttendanceEditButton = (props: EventAttendanceEditButtonProps) => {
    // const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [showingDialog, setShowingDialog] = React.useState(false);

    // table render contexts.
    // we have some challenges:
    // 1. fields from multiple tables. for the moment let's continue to do things manually. we also do this for event insert.
    // 2. insert-or-update style. i guess we need a new mutation for this? well let's use the existing stuff.

    return <>
        <div className='interactable' style={{ display: "inline" }} onClick={() => setShowingDialog(true)}>{gIconMap.Edit()}</div>
        {showingDialog && <EventAttendanceEditDialog {...props} onCancel={() => setShowingDialog(false)} onOK={() => setShowingDialog(false)} />}
    </>;
};


////////////////////////////////////////////////////////////////
export interface EventAttendanceDetailRowProps {
    responseInfo: db3.EventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    refetch: () => void;
    readonly: boolean;
};

export const EventAttendanceDetailRow = ({ responseInfo, user, event, refetch, readonly }: EventAttendanceDetailRowProps) => {
    const currentUser = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser };

    const eventResponse = responseInfo.getEventResponseForUser(user);
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const attendanceVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "filled", variation: 'strong' };
    if (!eventResponse.isRelevantForDisplay) return null;

    const authorizedForEdit = db3.xEventUserResponse.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: eventResponse,
    });

    //const canRespondToEvents = useAuthorization("xy", Permission.respond_to_events);
    const isYou = eventResponse.user.id === currentUser.id;

    return <tr>
        <td>
            <div className={`nameCellContainer ${isYou && "you"}`}>
                <div className='name'>{user.name}</div>
                {isYou && <div className='you'>(you)</div>}
            </div>
        </td>
        <td>{!!eventResponse.instrument ? <InstrumentChip value={eventResponse.instrument} variation={instVariant} shape="rectangle" border={'noBorder'} /> : "--"}</td>
        <td>{!!eventResponse.instrument?.functionalGroup ? <InstrumentFunctionalGroupChip value={eventResponse.instrument.functionalGroup} variation={instVariant} shape="rectangle" border={'noBorder'} /> : "--"}</td>
        {event.segments.map((segment, iseg) => {
            const segmentResponse = responseInfo.getResponseForUserAndSegment({ user, segment });
            return <React.Fragment key={segment.id}>
                <td className='responseCell'>
                    <div className='responseCellContents'>
                        {iseg === 0 && <div className='editButton'>{!readonly && authorizedForEdit && <EventAttendanceEditButton {...{ event, user, responseInfo, refetch }} />}</div>}
                        {!!segmentResponse.response.attendance ? <AttendanceChip value={segmentResponse.response.attendance} variation={attendanceVariant} shape="rectangle" /> : "--"}
                    </div>
                </td>
            </React.Fragment>;
        })}
        <td><Markdown markdown={eventResponse.response.userComment} className='compact' /></td>
    </tr>;
};



////////////////////////////////////////////////////////////////
export interface EventAttendanceDetailProps {
    //event: db3.EventClientPayload_Verbose;
    //responseInfo: db3.EventResponseInfo;
    eventData: EventWithMetadata;
    tableClient: DB3Client.xTableRenderClient;
    //expectedAttendanceTag: db3.UserTagPayload | null;
    //functionalGroups: db3.InstrumentFunctionalGroupPayload[];
    refetch: () => void;
    readonly: boolean;
};

type EventAttendanceDetailSortField = "user" | "instrument" | "response";

export const EventAttendanceDetail = ({ refetch, eventData, tableClient, ...props }: EventAttendanceDetailProps) => {
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;
    const segAttendees = API.events.getAttendeeCountPerSegment({ event: eventData.event });
    const token = API.events.updateUserEventAttendance.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [sortField, setSortField] = React.useState<EventAttendanceDetailSortField>("instrument");
    const [sortSegmentId, setSortSegmentId] = React.useState<number>(0); // support invalid IDs
    const [sortSegment, setSortSegment] = React.useState<db3.EventVerbose_EventSegmentPayload | null>(null);
    const user = useCurrentUser()[0]!;
    // const publicData = useAuthenticatedSession();
    // const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    React.useEffect(() => {
        setSortSegment(event.segments.find(s => s.id === sortSegmentId) || null);
    }, [sortSegmentId, event]);

    const onAddUser = (u: db3.UserPayload | null) => {
        if (u == null) return;
        token.invoke({
            eventId: event.id,
            userId: u.id,
            isInvited: true,
        }).then(e => {
            showSnackbar({ severity: "success", children: "user invited" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error inviting" });
        }).finally(() => {
            refetch();
        });
    };


    const canAddUsers = useAuthorization("EventAttendanceDetail:canAddUsers", Permission.manage_events);

    // sort rows
    const sortedUsers = [...responseInfo.distinctUsers];
    sortedUsers.sort((a, b) => {
        if (sortField === 'instrument') {
            const ar = responseInfo.getEventResponseForUser(a);
            const br = responseInfo.getEventResponseForUser(b);
            if (!ar.instrument) return -1;
            if (!br.instrument) return 1;
            return ar.instrument.functionalGroup.sortOrder < br.instrument.functionalGroup.sortOrder ? -1 : 1;
        }
        if (sortField === 'response' && !!sortSegment) {
            const ar = responseInfo.getResponseForUserAndSegment({ user: a, segment: sortSegment });
            const br = responseInfo.getResponseForUserAndSegment({ user: b, segment: sortSegment });
            if (!ar.response.attendance) return -1;
            if (!br.response.attendance) return 1;
            return ar.response.attendance.sortOrder < br.response.attendance.sortOrder ? -1 : 1;
        }
        //        if (sortField === 'user') 
        return a.name < b.name ? -1 : 1;
    });

    return <>
        <DB3Client.RenderBasicNameValuePair
            name="Attendance is expected for this user tag:"
            value={<EventAttendanceUserTagControl event={event} refetch={refetch} readonly={props.readonly} />}
            isReadOnly={props.readonly}
        />

        <table className='attendanceDetailTable'>
            <thead>
                <tr>
                    <th>
                        <div className='interactable' onClick={() => setSortField('user')}>Who {sortField === 'user' && gCharMap.DownArrow()}</div>
                    </th>
                    <th colSpan={2}>
                        <div className='interactable' onClick={() => setSortField('instrument')}>Instrument / function {sortField === 'instrument' && gCharMap.DownArrow()}</div>
                    </th>
                    {event.segments.map(seg => <React.Fragment key={seg.id}>
                        <th className='responseCell' onClick={() => { setSortField('response'); setSortSegmentId(seg.id); }}>
                            <div className='interactable'>
                                {seg.name} {sortField === 'response' && seg.id === sortSegmentId && gCharMap.DownArrow()}
                            </div>
                        </th>
                    </React.Fragment>)}
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
                {
                    sortedUsers.map(user => {
                        return <EventAttendanceDetailRow key={user.id} responseInfo={responseInfo} event={event} user={user} refetch={refetch} readonly={props.readonly} />
                    })
                }
            </tbody>
            <tfoot>
                <tr>
                    <td>
                        {!props.readonly && canAddUsers && <AddUserButton
                            onSelect={onAddUser}
                            filterPredicate={(u) => {
                                // don't show users who are already being displayed.
                                const isDisplayed = responseInfo.allEventResponses.some(r => r.user.id === u.id && r.isRelevantForDisplay);
                                return !isDisplayed;
                                //!props.responseInfo.distinctUsers.some(d => d.id === u.id)
                            }}
                            buttonChildren={<>{gIconMap.Add()} Invite someone</>}
                        />}
                    </td>
                    <td>{/*Instrument*/}</td>
                    <td>{/*Function*/}</td>
                    {segAttendees.map(seg => <React.Fragment key={seg.segment.id}>
                        <td className='responseCell'>{seg.attendeeCount}</td>
                    </React.Fragment>)}
                    <td>{/*Comments*/}</td>
                </tr>
            </tfoot>
        </table>
    </>;

};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventDescriptionControl = ({ event, refetch, readonly }: { event: db3.EventPayloadMinimum, refetch: () => void, readonly: boolean }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();

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
        initialValue={event.description}
        refetch={refetch}
        readonly={readonly || !authorized}
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

export interface EventStatusValueProps {
    onClick?: () => void;
    status: db3.EventStatusPayloadMinimum | null;
};
export const EventStatusValue = (props: EventStatusValueProps) => {
    return !props.status ? (<Button onClick={props.onClick}>Set event status</Button>) : (<CMStatusIndicator model={props.status} onClick={props.onClick} getText={o => o?.label || ""} />);
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EventAttendanceUserTagValueProps {
    onClick?: () => void;
    value: db3.UserTagPayload | null;
};
export const EventAttendanceUserTagValue = (props: EventAttendanceUserTagValueProps) => {
    return !props.value ? <div className='interactable' onClick={props.onClick}>(none)</div> : <CMStandardDBChip onClick={props.onClick} model={props.value} />;
    // return !props.value ? (<Button onClick={props.onClick}>Set expected attendance role</Button>) : (
    //     
    // );
};

export const EventAttendanceUserTagControl = ({ event, refetch, readonly }: { event: db3.EventWithAttendanceUserTagPayload, refetch: () => void, readonly: boolean }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorizedForEdit = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        model: event,
        columnName: "expectedAttendanceUserTag",
    });

    const handleChange = (value: db3.UserTagPayload | null) => {
        mutationToken.invoke({
            eventId: event.id,
            expectedAttendanceUserTagId: value?.id || null,
        }).then(() => {
            showSnackbar({ severity: "success", children: "Successfully updated event attendance tag" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event attendance tag" });
        }).finally(() => {
            refetch();
        });
    };

    const itemsClient = API.users.getUserTagsClient();
    const items = [null, ...(itemsClient.items as db3.UserTagPayload[])];

    readonly = readonly || !authorizedForEdit;

    // value type is UserTagPayload
    return <div className={`eventStatusControl ${event.expectedAttendanceUserTag?.significance}`}>
        <ChoiceEditCell
            isEqual={(a: db3.UserTagPayload, b: db3.UserTagPayload) => a.id === b.id}
            items={items}
            readonly={readonly}
            selectDialogTitle="Select who should be expected to respond to this event"
            value={event.expectedAttendanceUserTag}
            //event.expectedAttendanceUserTag.DescriptionMarkdown
            dialogDescription={<SettingMarkdown setting={GenerateDefaultDescriptionSettingName("event", "expectedAttendanceUserTag")} />}
            //dialogDescription={"asoeunth"}
            renderAsListItem={(chprops, value: db3.UserTagPayload | null, selected: boolean) => {
                return <li {...chprops}>
                    <EventAttendanceUserTagValue value={value} /></li>;
            }}
            renderValue={(args) => {
                return <EventAttendanceUserTagValue value={args.value} onClick={readonly ? undefined : args.handleEnterEdit} />;
            }}
            onChange={handleChange}
        />
    </div>;
};


export interface EventCompletenessTabContentProps {
    //event: db3.EventClientPayload_Verbose;
    //responseInfo: db3.EventResponseInfo;
    eventData: EventWithMetadata;
    //functionalGroupsClient: DB3Client.xTableRenderClient;
}

export const EventCompletenessTabContent = ({ eventData }: EventCompletenessTabContentProps) => {
    const [minStrength, setMinStrength] = React.useState<number>(50);
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;

    const [user] = useCurrentUser()!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const functionalGroupsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xInstrumentFunctionalGroup,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    return <div>
        <FormControlLabel control={<input type="range" min={0} max={100} value={minStrength} onChange={e => setMinStrength(e.target.valueAsNumber)} />} label="Filter responses" />
        <table className='EventCompletenessTabContent'>
            <tbody>
                <tr>
                    <th>Instrument group</th>
                    {event.segments.map((seg) => {
                        return <th key={seg.id}>{seg.name}</th>;
                    })}
                </tr>
                {(functionalGroupsClient.items as db3.InstrumentFunctionalGroupPayload[]).map(functionalGroup => {
                    return <tr key={functionalGroup.id}>
                        <td className='instrumentFunctionalGroupTD'>
                            <InstrumentFunctionalGroupChip value={functionalGroup} size='small' variation={instVariant} border={'noBorder'} shape='rectangle' />
                        </td>
                        {event.segments.map((seg) => {
                            // come up with the icons per user responses
                            // either just sort segment responses by answer strength,
                            // or group by answer. not sure which is more useful probably the 1st.
                            const sortedResponses = responseInfo.getResponsesForSegment(seg.id).filter(resp => {
                                // only take responses where we 1. expect the user, OR they have responded.
                                // AND it matches the current instrument function.
                                if (!resp.response.attendance) return false; // no answer = don't show.
                                if (resp.response.attendance.strength < (100 - minStrength)) return false;
                                const eventResponse = responseInfo.getEventResponseForUser(resp.user);
                                const responseInstrument = eventResponse.instrument;
                                if (responseInstrument?.functionalGroupId !== functionalGroup.id) return false;
                                return eventResponse.isRelevantForDisplay;
                            });
                            sortedResponses.sort((a, b) => {
                                // no response is weakest.
                                if (a.response.attendance === null) {
                                    if (b.response.attendance === null) return 0;
                                    return -1; // null always lowest, and b is not null.
                                }
                                if (b.response.attendance === null) {
                                    return 1; // b is null & a is not.
                                }
                                return (a.response.attendance.strength < b.response.attendance.strength) ? -1 : 1;
                            });
                            return <td key={seg.id}>
                                <div className='attendanceResponseColorBarCell'>
                                    <div className='attendanceResponseColorBarSegmentContainer'>
                                        {sortedResponses.map(resp => {
                                            const style = GetStyleVariablesForColor({ color: resp.response.attendance?.color, ...StandardVariationSpec.Strong });
                                            return <Tooltip key={resp.response.id} title={`${resp.user.name}: ${resp.response.attendance?.text || "no response"}`}>
                                                <div className={`attendanceResponseColorBarSegment applyColor ${style.cssClass}`} style={style.style}>
                                                    {resp.user.name.substring(0, 1).toLocaleUpperCase()}
                                                </div>
                                            </Tooltip>
                                        })}
                                    </div>
                                    {/* <div className='attendanceResponseColorBarText'>
                                        {sortedResponses.reduce((acc, r) => acc + (((r.response.attendance?.strength || 0) > 50) ? 1 : 0), 0)}
                                    </div> */}
                                </div>
                            </td>;
                        })}
                    </tr>;
                })
                }
            </tbody>
        </table>
    </div>;
};

export const gEventDetailTabSlugIndices = {
    "info": 0,
    "set-lists": 1,
    "attendance": 2,
    "completeness": 3,
    "files": 4,
    "frontpage": 5,
} as const;

export interface EventDetailContainerProps {
    eventData: EventWithMetadata;
    tableClient: DB3Client.xTableRenderClient;
    //verbosity: EventDetailVerbosity;
    readonly: boolean;
    //initialTabIndex?: number;
    //isOnlyEventVisible: boolean; // some formatting stuff cares about whether this is a part of a list of events, or is the only one on the screen.
    //allowRouterPush: boolean; // if true, selecting tabs updates the window location for shareability. if this control is in a list then don't set tihs.
    fadePastEvents: boolean;
    showVisibility?: boolean;
}

export const EventDetailContainer = ({ eventData, tableClient, ...props }: React.PropsWithChildren<EventDetailContainerProps>) => {
    const [user] = useCurrentUser()!;
    const router = useRouter();
    //const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();

    const refetch = () => {
        tableClient.refetch();
    };

    const visInfo = API.users.getVisibilityInfo(eventData.event);

    const timingLabel: { [key in Timing]: string } = {
        [Timing.Past]: "Past event",
        [Timing.Present]: "Ongoing event",
        [Timing.Future]: "Future event",
    } as const;

    return <div className={`EventDetail contentSection event ${visInfo.className} ${(props.fadePastEvents && (eventData.eventTiming === Timing.Past)) ? "past" : "notPast"}`}>
        <div className='header'>
            <CMChipContainer>

                {eventData.event.type && //<EventTypeValue type={event.type} />
                    <CMStandardDBChip
                        model={eventData.event.type}
                        getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                        variation={{ ...StandardVariationSpec.Strong /*, fillOption: 'hollow'*/ }}
                    />
                }
                {eventData.event.status && <CMStandardDBChip
                    variation={StandardVariationSpec.Strong}
                    border='border'
                    shape="rectangle"
                    model={eventData.event.status} getTooltip={(_, c) => !!c ? `Status: ${c}` : `Status`}
                />}


            </CMChipContainer>

            <div className='flex-spacer'></div>

            {
                isShowingAdminControls && <>
                    <DB3Client.NameValuePair
                        isReadOnly={true}
                        name={"eventId"}
                        value={eventData.event.id}
                    />
                    <InspectObject src={eventData} />
                </>
            }

            <EditFieldsDialogButton
                dialogTitle='Edit event'
                readonly={props.readonly}
                initialValue={eventData.event}
                renderButtonChildren={() => <>{gIconMap.Edit()} Edit</>}
                tableSpec={tableClient.tableSpec}
                dialogDescription={<SettingMarkdown setting='EditEventDialogDescription' />}
                onCancel={() => { }}
                onOK={(obj: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => {
                    tableClient.doUpdateMutation(obj).then(() => {
                        showSnackbar({ children: "update successful", severity: 'success' });
                        api.close();
                        if (obj.slug !== eventData.event.slug) {
                            const newUrl = API.events.getURIForEvent(obj.slug);
                            void router.push(newUrl); // <-- ideally we would show the snackbar on refresh but no.
                        }
                    }).catch(err => {
                        console.log(err);
                        showSnackbar({ children: "update error", severity: 'error' });
                    }).finally(refetch);
                }}
                onDelete={(api: EditFieldsDialogButtonApi) => {
                    tableClient.doDeleteMutation(eventData.event.id, 'softWhenPossible').then(() => {
                        showSnackbar({ children: "delete successful", severity: 'success' });
                        api.close();
                    }).catch(err => {
                        console.log(err);
                        showSnackbar({ children: "delete error", severity: 'error' });
                    }).finally(refetch);
                }}
            />

            {props.showVisibility && <VisibilityValue permission={eventData.event.visiblePermission} variant='minimal' />}

            <TimingChip value={eventData.eventTiming}>
                {timingLabel[eventData.eventTiming]}
            </TimingChip>

        </div>

        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    <Link href={eventData.eventURI} className="titleLink">
                        {eventData.event.name}
                    </Link>
                </div>

                <CMChipContainer>
                    {eventData.event.tags.map(tag => <CMStandardDBChip key={tag.id} model={tag.eventTag} variation={StandardVariationSpec.Weak} getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`} />)}
                </CMChipContainer>
            </div>

            <div className='titleLine'>
                <div className="date smallInfoBox">
                    <CalendarMonthIcon className="icon" />
                    <span className="text">{eventData.dateRange.toString()}</span>
                </div>
            </div>

            <div className='titleLine'>
                <div className="location smallInfoBox">
                    <PlaceIcon className="icon" />
                    <span className="text">{IsNullOrWhitespace(eventData.event.locationDescription) ? "Location TBD" : eventData.event.locationDescription}</span>
                </div>
            </div>

            {props.children}

        </div>

    </div>;
};


export interface EventDetailFullProps {
    event: db3.EventClientPayload_Verbose,
    tableClient: DB3Client.xTableRenderClient;
    initialTabIndex?: number;
    readonly: boolean;
}
export const EventDetailFull = ({ event, tableClient, ...props }: EventDetailFullProps) => {

    const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || 0);
    const tabSlug = Object.keys(gEventDetailTabSlugIndices)[selectedTab];
    const router = useRouter();

    const handleTabChange = (e: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
    };

    const eventData = CalculateEventMetadata(event, tabSlug);

    React.useEffect(() => {
        void router.push(eventData.eventURI);
    }, [eventData.eventURI]);

    const refetch = tableClient.refetch;

    return <EventDetailContainer eventData={eventData} readonly={props.readonly} tableClient={tableClient} fadePastEvents={false} showVisibility={true}>
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={tableClient.refetch}
        />

        <SegmentList
            event={event}
            tableClient={tableClient}
            readonly={props.readonly}
        />

        <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
        >
            <Tab label="Event Info" {...TabA11yProps('event', 0)} />
            <Tab label={`Set Lists (${event.songLists.length})`} {...TabA11yProps('event', 1)} />
            <Tab label={`Attendance`} {...TabA11yProps('event', 2)} />
            <Tab label={`Completeness`} {...TabA11yProps('event', 3)} />
            <Tab label={`Files (${event.fileTags.length})`} {...TabA11yProps('event', 4)} />
            <Tab label={`Frontpage`} {...TabA11yProps('event', 5)} />
        </Tabs>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={0}>
            <div className='descriptionLine'>
                <EventDescriptionControl event={event} refetch={refetch} readonly={props.readonly} />
            </div>
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={1}>
            <EventSongListTabContent event={event} tableClient={tableClient} readonly={props.readonly} refetch={refetch} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={2}>
            <SettingMarkdown setting='EventAttendanceDetailMarkdown' />
            <EventAttendanceDetail eventData={eventData} tableClient={tableClient} refetch={refetch} readonly={props.readonly} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={3}>
            <SettingMarkdown setting='EventCompletenessTabMarkdown' />
            <EventCompletenessTabContent eventData={eventData} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={4}>
            {/* <EventFilesTabContent event={event} refetch={refetch} readonly={props.readonly} /> */}
            <FilesTabContent fileTags={event.fileTags} uploadTags={{
                taggedEventId: event.id,
            }} refetch={refetch} readonly={props.readonly} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={5}>
            <EventFrontpageTabContent event={event} refetch={refetch} readonly={props.readonly} />
        </CustomTabPanel>

    </EventDetailContainer>;
};



export interface EventDashboardItemProps {
    event: db3.EventClientPayload_Verbose,
    tableClient: DB3Client.xTableRenderClient;
}
export const EventDashboardItem = ({ event, ...props }: EventDashboardItemProps) => {

    const eventData = CalculateEventMetadata(event);

    return <EventDetailContainer eventData={eventData} readonly={true} tableClient={props.tableClient} fadePastEvents={true} showVisibility={false}>
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.tableClient.refetch}
        />
    </EventDetailContainer>;
};

export interface EventDashboardProps {
    items: db3.EventClientPayload_Verbose[];
    tableClient: DB3Client.xTableRenderClient;
};

export const EventDashboard = (props: EventDashboardProps) => {

    return <div className='EventDashboard'>
        {props.items.length < 1 ? (<div>
            Nothing here!
        </div>) : <div className='searchResults'>{props.items.map(event => <EventDashboardItem key={event.id}
            event={event as db3.EventClientPayload_Verbose}
            tableClient={props.tableClient}
        />)}</div>
        }
    </div>;
};

export const EventTableClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
    dateRange: new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
    slug: new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 150, fieldCaption: "URL (auto-generated)" }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
    locationDescription: new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150, fieldCaption: "Location" }),
    locationURL: new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150, fieldCaption: "Location URL" }),
    type: new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, selectStyle: "inline", fieldCaption: "Event Type" }),
    status: new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, fieldCaption: "Status" }),
    segmentBehavior: new DB3Client.ConstEnumStringFieldClient({ columnName: "segmentBehavior", cellWidth: 220, fieldCaption: "Behavior of segments" }),
    expectedAttendanceUserTag: new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, fieldCaption: "Who's invited?" }),
    tags: new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags" }),
    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, fieldCaption: "Who can view this event?" }),

    createdAt: new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
    createdByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, }),

    frontpageVisible: new DB3Client.BoolColumnClient({ columnName: "frontpageVisible" }),
    frontpageDate: new DB3Client.GenericStringColumnClient({ columnName: "frontpageDate", cellWidth: 150 }),
    frontpageTime: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTime", cellWidth: 150 }),
    frontpageDetails: new DB3Client.MarkdownStringColumnClient({ columnName: "frontpageDetails", cellWidth: 150 }),

    frontpageTitle: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTitle", cellWidth: 150 }),
    frontpageLocation: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocation", cellWidth: 150 }),
    frontpageLocationURI: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocationURI", cellWidth: 150 }),
    frontpageTags: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTags", cellWidth: 150 }),
} as const;
