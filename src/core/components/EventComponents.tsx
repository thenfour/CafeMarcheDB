
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useAuthenticatedSession } from '@blitzjs/auth';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, DialogActions, DialogContent, DialogTitle, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { ColorVariationSpec, StandardVariationSpec } from 'shared/color';
import { Permission } from 'shared/permissions';
import { Timing } from 'shared/time';
import { IsNullOrWhitespace } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { GetICalRelativeURIForUserAndEvent, SearchResultsRet } from '../db3/shared/apiTypes';
import { AdminInspectObject, AttendanceChip, CMStatusIndicator, CustomTabPanel, InspectObject, InstrumentChip, InstrumentFunctionalGroupChip, ReactiveInputDialog, TabA11yProps } from './CMCoreComponents';
import { CMDialogContentText, EventDateField, NameValuePair } from './CMCoreComponents2';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { DashboardContext } from './DashboardContext';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { EventAttendanceControl } from './EventAttendanceComponents';
import { CalculateEventMetadata_Verbose, CalculateEventSearchResultsMetadata, EventEnrichedVerbose_Event, EventWithMetadata, EventsFilterSpec } from './EventComponentsBase';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { EditSingleSegmentDateButton, SegmentList } from './EventSegmentComponents';
import { EventSongListTabContent } from './EventSongListComponents';
import { Markdown3Editor } from './MarkdownControl3';
import { Markdown } from './RichTextEditor';
import { GenerateDefaultDescriptionSettingName, SettingMarkdown } from './SettingMarkdown';
import { FilesTabContent } from './SongFileComponents';
import { AddUserButton } from './UserComponents';
import { VisibilityControl, VisibilityValue } from './VisibilityControl';
import { CMChipContainer, CMStandardDBChip } from './CMChip';


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



type VerboseEventResponseInfo = db3.EventResponseInfo<
    EventEnrichedVerbose_Event,
    db3.EventVerbose_EventSegment,
    db3.EventVerbose_EventUserResponse,
    db3.EventVerbose_EventSegmentUserResponse
>;

type VerboseEventWithMetadata = EventWithMetadata<
    EventEnrichedVerbose_Event,
    db3.EventVerbose_EventUserResponse,
    db3.EventVerbose_EventSegment,
    db3.EventVerbose_EventSegmentUserResponse
>;

////////////////////////////////////////////////////////////////
export interface EventBreadcrumbProps {
    event: db3.EventVerbose_Event,
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
            href={API.events.getURIForEvent(props.event.id, props.event.slug)}
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
    responseInfo: VerboseEventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    userMap: db3.UserInstrumentList;
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
    const dashboardContext = React.useContext(DashboardContext);

    const [eventResponseValue, setEventResponseValue] = React.useState<db3.EventVerbose_EventUserResponse | null>(() => {
        return (props.responseInfo.getEventResponseForUser(props.user, dashboardContext, props.userMap)?.response) || null;
    });
    const [eventSegmentResponseValues, setEventSegmentResponseValues] = React.useState<Record<number, db3.EventVerbose_EventSegmentUserResponse>>(() => {
        return Object.fromEntries(Object.entries(props.responseInfo.getResponsesBySegmentForUser(props.user)).map(x => [x[0], x[1].response]));
    });

    // use the db3 client stuff for rendering / validating fields.
    const eventResponseTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventUserResponse,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "userComment", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isInvited", fieldCaption: "Is invited?" }),
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
                fieldCaption: "Going?"
                //renderAsChip: (args: DB3Client.RenderAsChipParams<db3.EventAttendanceBasePayload>) => <CMStandardDBChip model={args.value} variation={args.colorVariant} />,
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

    // if this is null it 
    if (!eventResponseValue) throw new Error("eventResponseValue is null; i'm guessing usermap did not include a relevant user.");

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
            segmentResponses: Object.fromEntries(Object.entries(eventSegmentResponseValues).map(x => {
                const att = dashboardContext.eventAttendance.getById(x[1].attendanceId);
                return [x[0], {
                    attendanceId: att?.id || null
                }];
            })),
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

    const handleChangedEventSegmentResponse = (segment: db3.EventSegmentPayloadMinimum, n: db3.EventVerbose_EventSegmentUserResponse) => {
        const newval = {
            ...eventSegmentResponseValues,
            [segment.id]: n
        };
        setEventSegmentResponseValues(newval);
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>

        <DialogTitle>
            <SettingMarkdown setting="EventAttendanceEditDialog_TitleMarkdown" />
            <AdminInspectObject src={eventResponseValue} label="event response" />
            <AdminInspectObject src={eventSegmentResponseValues} label="segment responses" />
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                <SettingMarkdown setting="EventAttendanceEditDialog_DescriptionMarkdown" />
            </CMDialogContentText>

            <div className="EventSongListValue">
                {eventResponseTableSpec.renderEditor("isInvited", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}
                {eventResponseTableSpec.renderEditor("instrument", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}

                {
                    props.event.segments.map(segment => {
                        const validationResult = eventSegmentValidationResults[segment.id]!;
                        const response = eventSegmentResponseValues[segment.id]!;
                        return <div key={segment.id} className='editSegmentResponse segment'>
                            <div>
                                <div className='segmentName'>{segment.name}</div>
                                {eventSegmentResponseTableSpec.renderEditor("attendance", response, validationResult, (n) => handleChangedEventSegmentResponse(segment, n), clientIntention, false)}
                            </div>
                        </div>;
                    })
                }
                {eventResponseTableSpec.renderEditor("userComment", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}

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
    responseInfo: VerboseEventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    userMap: db3.UserInstrumentList;
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
    responseInfo: VerboseEventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    userMap: db3.UserInstrumentList;
    refetch: () => void;
    readonly: boolean;
};

export const EventAttendanceDetailRow = ({ responseInfo, user, event, refetch, readonly, userMap }: EventAttendanceDetailRowProps) => {
    const currentUser = useCurrentUser()[0]!;
    //const publicData = useAuthenticatedSession();
    //const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser };
    const dashboardContext = React.useContext(DashboardContext);

    const eventResponse = responseInfo.getEventResponseForUser(user, dashboardContext, userMap);
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const attendanceVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "filled", variation: 'strong' };
    if (!eventResponse?.isRelevantForDisplay) {
        return null;
    }

    const authorizedForEdit = dashboardContext.isAuthorized(Permission.change_others_event_responses);
    const isYou = eventResponse.user.id === currentUser.id;

    const classes = [
        `nameCellContainer`,
        isYou && "you",
        `userCssClass_${user.cssClass}`,
        ...user.tags.map(ta => `userTagCssClass_${dashboardContext.userTag.getById(ta.userTagId)?.cssClass}`),
    ];

    return <tr>
        <td>
            <div className={classes.join(" ")}>
                <div className={`name`}>{user.name}</div>
                {isYou && <div className='you'>(you)</div>}
            </div>
        </td>
        <td>{!!eventResponse.instrument ? <InstrumentChip value={eventResponse.instrument} variation={instVariant} shape="rectangle" border={'noBorder'} /> : "--"}</td>
        {event.segments.map((segment, iseg) => {
            const segmentResponse = responseInfo.getResponseForUserAndSegment({ user, segment });
            assert(!!segmentResponse, "segmentResponse shouldn't be null.");
            const attendance = dashboardContext.eventAttendance.getById(segmentResponse.response.attendanceId);
            return <React.Fragment key={segment.id}>
                <td className='responseCell'>
                    <div className='responseCellContents'>
                        {iseg === 0 && <div className='editButton'>{!readonly && authorizedForEdit && <EventAttendanceEditButton {...{ event, user, responseInfo, refetch, userMap }} />}</div>}
                        {!!attendance ? <AttendanceChip value={attendance} variation={attendanceVariant} shape="rectangle" /> : "--"}
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
    eventData: VerboseEventWithMetadata;
    tableClient: DB3Client.xTableRenderClient;
    //expectedAttendanceTag: db3.UserTagPayload | null;
    //functionalGroups: db3.InstrumentFunctionalGroupPayload[];
    refetch: () => void;
    readonly: boolean;
    userMap: db3.UserInstrumentList;
};

type EventAttendanceDetailSortField = "user" | "instrument" | "response";

export const EventAttendanceDetail = ({ refetch, eventData, tableClient, ...props }: EventAttendanceDetailProps) => {
    if (!eventData.responseInfo) return null;
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;
    const dashboardContext = React.useContext(DashboardContext);
    const token = API.events.updateUserEventAttendance.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [sortField, setSortField] = React.useState<EventAttendanceDetailSortField>("instrument");
    const [sortSegmentId, setSortSegmentId] = React.useState<number>(0); // support invalid IDs
    const [sortSegment, setSortSegment] = React.useState<db3.EventVerbose_EventSegment | null>(null);
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

    const canAddUsers = dashboardContext.isAuthorized(Permission.manage_events);
    const isSingleSegment = eventData.event.segments.length === 1;

    // sort rows
    const sortedUsers = [...responseInfo.distinctUsers];
    sortedUsers.sort((a, b) => {
        if (sortField === 'instrument') {
            const ar = responseInfo.getEventResponseForUser(a, dashboardContext, props.userMap);
            assert(ar, "ar - usermap incomplete")
            const br = responseInfo.getEventResponseForUser(b, dashboardContext, props.userMap);
            assert(br, "br - usermap incomplete")
            if (!ar.instrument) return -1;
            if (!br.instrument) return 1;
            return ar.instrument.functionalGroup.sortOrder < br.instrument.functionalGroup.sortOrder ? -1 : 1;
        }
        if (sortField === 'response' && !!sortSegment) {
            const ar = responseInfo.getResponseForUserAndSegment({ user: a, segment: sortSegment });
            assert(ar, "ar2 - usermap incomplete");
            const br = responseInfo.getResponseForUserAndSegment({ user: b, segment: sortSegment });
            assert(br, "br2 - usermap incomplete");
            const aatt = dashboardContext.eventAttendance.getById(ar.response.attendanceId);
            const batt = dashboardContext.eventAttendance.getById(br.response.attendanceId);
            if (!aatt) return 1;
            if (!batt) return -1;
            return aatt.sortOrder < batt.sortOrder ? 1 : -1;
        }
        //        if (sortField === 'user') 
        return a.name < b.name ? -1 : 1;
    });

    const segAttendees = event.segments.map(seg => ({
        segment: seg,
        attendeeCount: seg.responses.filter(resp => {
            const att = dashboardContext.eventAttendance.getById(resp.attendanceId);
            return att && (att.strength > 50)
        }).length
    }));

    return <>
        <NameValuePair
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
                    <th>
                        <div className='interactable' onClick={() => setSortField('instrument')}>Instrument {sortField === 'instrument' && gCharMap.DownArrow()}</div>
                    </th>
                    {event.segments.map(seg => <React.Fragment key={seg.id}>
                        <th className='responseCell' onClick={() => { setSortField('response'); setSortSegmentId(seg.id); }}>
                            <div className='interactable'>
                                {isSingleSegment ? "Response" : seg.name} {sortField === 'response' && seg.id === sortSegmentId && gCharMap.DownArrow()}
                            </div>
                        </th>
                    </React.Fragment>)}
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
                {
                    sortedUsers.map(user => {
                        return <EventAttendanceDetailRow key={user.id} responseInfo={responseInfo} event={event} user={user} refetch={refetch} readonly={props.readonly} userMap={props.userMap} />
                    })
                }
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={2}>
                        {!props.readonly && canAddUsers && <AddUserButton
                            onSelect={onAddUser}
                            filterPredicate={(u) => {
                                // don't show users who are already being displayed.
                                const isDisplayed = responseInfo.allEventResponses.some(r => r.user.id === u.id && r.isRelevantForDisplay);
                                return !isDisplayed;
                                //!props.responseInfo.distinctUsers.some(d => d.id === u.id)
                            }}
                            buttonChildren={<>{gIconMap.Add()} Invite someone</>}
                            title={"Invite users"}
                            description={<SettingMarkdown setting='EventInviteUsersDialogDescriptionMarkdown' />}
                        />}
                    </td>
                    {segAttendees.map(seg => <React.Fragment key={seg.segment.id}>
                        <td className='responseCell'>{seg.attendeeCount}</td>
                    </React.Fragment>)}
                    <td>{/*Comments*/}</td>
                </tr>
            </tfoot>
        </table>
    </>;

};

interface EventDescriptionEditorProps {
    event: db3.EventPayloadMinimum;
    refetch: () => void;
    onClose: () => void;
};

export const EventDescriptionEditor = (props: EventDescriptionEditorProps) => {
    const [value, setValue] = React.useState<string>(props.event.description || "");

    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleSave = async (): Promise<boolean> => {
        try {
            await mutationToken.invoke({
                eventId: props.event.id,
                description: value,
            });
            showSnackbar({ severity: "success", children: "Success" });
            props.refetch();
            return true;
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating event description" });
            return false;
        }
    };

    const hasEdits = (props.event.description !== value);

    const handleSaveAndClose = async (): Promise<boolean> => {
        const r = await handleSave();
        props.onClose();
        return r;
    };

    return <>
        <Markdown3Editor
            onChange={(v) => setValue(v)}
            value={value}
            onSave={() => { void handleSave() }}
        />

        <div className="actionButtonsRow">
            <div className={`freeButton cancelButton`} onClick={props.onClose}>{hasEdits ? "Cancel" : "Close"}</div>
            <div className={`saveButton saveProgressButton ${hasEdits ? "freeButton changed" : "unchanged"}`} onClick={hasEdits ? handleSave : undefined}>Save progress</div>
            <div className={`saveButton saveAndCloseButton ${hasEdits ? "freeButton changed" : "unchanged"}`} onClick={hasEdits ? handleSaveAndClose : undefined}>{gIconMap.CheckCircleOutline()}Save & close</div>
        </div>
    </>;
};

export const EventDescriptionControl = ({ event, refetch, readonly }: { event: db3.EventPayloadMinimum, refetch: () => void, readonly: boolean }) => {
    const [editing, setEditing] = React.useState<boolean>(false);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorized = db3.xEvent.authorizeColumnForEdit({
        model: null,
        columnName: "description",
        clientIntention,
        publicData,
        fallbackOwnerId: event.createdByUserId,
    });

    readonly = readonly && authorized;

    return <div className='descriptionContainer'>
        {!readonly && !editing && <Button onClick={() => setEditing(true)}>
            {IsNullOrWhitespace(event.description) ? <>{gIconMap.Edit()}Add info</> : <>{gIconMap.Edit()}Edit info</>}
        </Button>}
        {editing ? <EventDescriptionEditor event={event} refetch={refetch} onClose={() => setEditing(false)} /> : <Markdown markdown={event.description} />}
    </div>;
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
    const dashboardContext = React.useContext(DashboardContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const authorizedForEdit = db3.xEvent.authorizeColumnForEdit({
        clientIntention,
        publicData,
        model: event,
        columnName: "expectedAttendanceUserTag",
        fallbackOwnerId: event.createdByUserId,
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

    readonly = readonly || !authorizedForEdit;
    const choices = [null, ...dashboardContext.userTag.items];

    // value type is UserTagPayload
    return <div className={`eventStatusControl ${event.expectedAttendanceUserTag?.significance}`}>
        <ChoiceEditCell
            isEqual={(a: db3.UserTagPayload, b: db3.UserTagPayload) => a.id === b.id}
            items={choices}
            readonly={readonly}
            selectDialogTitle="Select who should be expected to respond to this event"
            value={event.expectedAttendanceUserTag}
            dialogDescription={<SettingMarkdown setting={GenerateDefaultDescriptionSettingName("event", "expectedAttendanceUserTag")} />}
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
    eventData: VerboseEventWithMetadata;
    userMap: db3.UserInstrumentList;
    //functionalGroupsClient: DB3Client.xTableRenderClient;
}

export const EventCompletenessTabContent = ({ eventData, userMap }: EventCompletenessTabContentProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    //const [minStrength, setMinStrength] = React.useState<number>(50);
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

    if (!responseInfo) return null;

    const isSingleSegment = eventData.event.segments.length === 1;

    return <div>
        {/* <FormControlLabel control={<input type="range" min={0} max={100} value={minStrength} onChange={e => setMinStrength(e.target.valueAsNumber)} />} label="Filter responses" /> */}
        <table className='EventCompletenessTabContent'>
            <tbody>
                <tr>
                    <th>Instrument group</th>
                    {isSingleSegment ? <th key="__">Response</th> : event.segments.map((seg) => {
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
                                if (!resp.response.attendanceId) return false; // no answer = don't show.
                                const attendance = dashboardContext.eventAttendance.getById(resp.response.attendanceId)!;
                                //if (attendance.strength < (100 - minStrength)) return false;
                                const eventResponse = responseInfo.getEventResponseForUser(resp.user, dashboardContext, userMap);
                                assert(eventResponse, "eventResponse null; usermap must not be complete");
                                const responseInstrument = eventResponse.instrument;
                                if (responseInstrument?.functionalGroupId !== functionalGroup.id) return false;
                                return eventResponse.isRelevantForDisplay;
                            });
                            sortedResponses.sort((a, b) => {
                                // no response is weakest.
                                const aatt = dashboardContext.eventAttendance.getById(a.response.attendanceId);
                                const batt = dashboardContext.eventAttendance.getById(b.response.attendanceId);
                                if (aatt === null) {
                                    if (batt === null) return 0;
                                    return 1; // null always lowest, and b is not null.
                                }
                                if (batt === null) {
                                    return -1; // b is null & a is not.
                                }
                                return (aatt.strength < batt.strength) ? 1 : -1;
                            });
                            return <td key={seg.id}>
                                <div className='attendanceResponseColorBarCell'>
                                    <div className='attendanceResponseColorBarSegmentContainer'>
                                        {sortedResponses.map(resp => {
                                            const att = dashboardContext.eventAttendance.getById(resp.response.attendanceId);
                                            const going = (((att?.strength) || 0) > 50);
                                            const color = going ? att?.color : null;
                                            const style = GetStyleVariablesForColor({ color, ...StandardVariationSpec.Strong });
                                            return <Tooltip key={resp.response.id} title={`${resp.user.name}: ${att?.text || "no response"}`}>
                                                <div className={`attendanceResponseColorBarSegment applyColor ${style.cssClass} ${((att?.strength) || 0) > 50 ? "going" : "notgoing"}`} style={style.style}>
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
    eventData: VerboseEventWithMetadata;
    tableClient: DB3Client.xTableRenderClient | null;
    readonly: boolean;
    fadePastEvents: boolean;
    showVisibility?: boolean;

    highlightTagIds?: number[];
    highlightStatusId?: number[];
    highlightTypeId?: number[];
}

export const EventDetailContainer = ({ eventData, tableClient, ...props }: React.PropsWithChildren<EventDetailContainerProps>) => {
    const [currentUser] = useCurrentUser()!;
    const router = useRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = React.useContext(DashboardContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();
    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusId || [];
    const highlightTypeIds = props.highlightTypeId || [];

    const refetch = () => {
        tableClient?.refetch();
    };

    const visInfo = dashboardContext.getVisibilityInfo(eventData.event);

    // const timingLabel: { [key in Timing]: string } = {
    //     [Timing.Past]: "Past event",
    //     [Timing.Present]: "Ongoing event",
    //     [Timing.Future]: "Future event",
    // } as const;

    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Weak,
        color: eventData.event.type?.color || null,
    });

    const classes = [
        `EventDetail`,
        `contentSection`,
        `event`,
        `ApplyBorderLeftColor`,
        eventData.event.type?.text,
        visInfo.className,
        (props.fadePastEvents && (eventData.eventTiming === Timing.Past)) ? "past" : "notPast",
        `status_${eventData.event.status?.significance}`,
    ];

    const showVisibility = props.showVisibility && dashboardContext.isAuthorized(Permission.manage_events);

    return <div style={typeStyle.style} className={classes.join(" ")}>
        <div className='header  applyColor'>
            <CMChipContainer>
                {eventData.event.status && <CMStandardDBChip
                    variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(eventData.event.statusId!) }}
                    border='border'
                    shape="rectangle"
                    model={eventData.event.status}
                    getTooltip={(status, c) => `Status ${c}: ${status?.description}`}
                />}

            </CMChipContainer>

            <div className='flex-spacer'></div>

            <CMChipContainer>
                {eventData.event.type && //<EventTypeValue type={event.type} />
                    <CMStandardDBChip
                        className='eventTypeChip'
                        size='small'
                        model={eventData.event.type}
                        getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                        variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(eventData.event.typeId!) }}
                    />
                }

            </CMChipContainer>


            {
                isShowingAdminControls && <>
                    <NameValuePair
                        isReadOnly={true}
                        name={"eventId"}
                        value={eventData.event.id}
                    />
                    <NameValuePair
                        isReadOnly={true}
                        name={"revision"}
                        value={eventData.event.revision}
                    />
                    <InspectObject src={eventData} />
                </>
            }

            {tableClient &&
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
                                const newUrl = API.events.getURIForEvent(obj.id, obj.slug);
                                void router.replace(newUrl); // <-- ideally we would show the snackbar on refresh but no.
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
            }

            <Tooltip title="Add to your calendar (iCal)">
                <a href={GetICalRelativeURIForUserAndEvent({ userAccessToken: currentUser?.accessToken || null, eventUid: eventData.event.uid })} target='_blank' rel="noreferrer" className='HalfOpacity interactable shareCalendarButton'>{gIconMap.Share()}</a>
            </Tooltip>

            {showVisibility && <VisibilityValue permission={eventData.event.visiblePermission} variant='minimal' />}

        </div>

        <div className='content'>

            {/* for search results it's really best if we allow the whole row to be clickable. */}
            <Link href={eventData.eventURI} className="titleLink">
                <div className='titleLine'>
                    <div className="titleText">
                        {eventData.event.name}
                    </div>
                </div>
            </Link>

            <div className='titleLine'>
                <div className="date smallInfoBox">
                    <EventDateField className="date smallInfoBox text" dateRange={eventData.dateRange}>
                        {(eventData.event.segments.length === 1) && <EditSingleSegmentDateButton readonly={props.readonly} refetch={refetch} event={eventData.event} segment={eventData.event.segments[0]!} />}
                    </EventDateField>
                </div>
            </div>

            {!IsNullOrWhitespace(eventData.event.locationDescription) &&
                <div className='titleLine'>
                    <div className="location smallInfoBox">
                        <PlaceIcon className="icon" />
                        <span className="text">{eventData.event.locationDescription}</span>
                    </div>
                </div>
            }

            <CMChipContainer>
                {eventData.event.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    model={tag.eventTag}
                    size='small'
                    variation={{ ...StandardVariationSpec.Weak, selected: highlightTagIds.includes(tag.eventTagId) }}
                    getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`}
                />)}
            </CMChipContainer>

            {props.children}

        </div>

    </div>;
};


export interface EventDetailFullProps {
    event: EventEnrichedVerbose_Event,
    tableClient: DB3Client.xTableRenderClient;
    initialTabIndex?: number;
    readonly: boolean;
};

type EventDetailFullTabAreaProps = EventDetailFullProps & {
    selectedTab: number;
    setSelectedTab: (v: number) => void;
    refetch: () => void;
    eventData: VerboseEventWithMetadata;
    userMap: db3.UserInstrumentList;
};

export const EventDetailFullTabArea = ({ eventData, refetch, selectedTab, event, tableClient, userMap, ...props }: EventDetailFullTabAreaProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const handleTabChange = (e: React.SyntheticEvent, newValue: number) => {
        props.setSelectedTab(newValue);
    };

    const segmentResponseCounts = !eventData.responseInfo ? [] : eventData.event.segments.map(seg => {
        return eventData.responseInfo!.getResponsesForSegment(seg.id).reduce((acc, resp) => {
            const att = dashboardContext.eventAttendance.getById(resp.response.attendanceId);
            return acc + ((((att?.strength || 0) > 50) ? 1 : 0))
        }, 0);
    });
    const segmentResponseCountStr = segmentResponseCounts.length > 0 ? `(${Math.min(...segmentResponseCounts)})` : "";

    const enrichedFiles = eventData.event.fileTags.map(ft => {
        return {
            ...ft,
            file: db3.enrichFile(ft.file, dashboardContext),
        };
    });

    return <>

        <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
        >
            <Tab label="Info" {...TabA11yProps('event', 0)} />
            <Tab label="Workflow" {...TabA11yProps('event', 1)} />
            <Tab label={`Setlists (${event.songLists.length})`} {...TabA11yProps('event', 2)} />
            <Tab label={`Responses ${segmentResponseCountStr}`} {...TabA11yProps('event', 3)} />
            <Tab label={`By Instrument`} {...TabA11yProps('event', 4)} />
            <Tab label={`Files (${event.fileTags.length})`} {...TabA11yProps('event', 5)} />
            <Tab label={`Frontpage`} {...TabA11yProps('event', 6)} />
        </Tabs>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={0}>
            <div className='descriptionLine'>
                <EventDescriptionControl event={event} refetch={refetch} readonly={props.readonly} />
            </div>
        </CustomTabPanel>

        {/* <CustomTabPanel tabPanelID='event' value={selectedTab} index={1}>
            <WorkflowEditorPOC />
        </CustomTabPanel> */}

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={2}>
            <EventSongListTabContent event={event} tableClient={tableClient} readonly={props.readonly} refetch={refetch} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={3}>
            <SettingMarkdown setting='EventAttendanceDetailMarkdown' />
            <EventAttendanceDetail eventData={eventData} tableClient={tableClient} refetch={refetch} readonly={props.readonly} userMap={userMap} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={4}>
            <SettingMarkdown setting='EventCompletenessTabMarkdown' />
            <EventCompletenessTabContent eventData={eventData} userMap={userMap} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={5}>
            {/* <EventFilesTabContent event={event} refetch={refetch} readonly={props.readonly} /> */}
            <FilesTabContent fileTags={enrichedFiles} uploadTags={{
                taggedEventId: event.id,
            }} refetch={refetch} readonly={props.readonly} />
        </CustomTabPanel>

        <CustomTabPanel tabPanelID='event' value={selectedTab} index={6}>
            <EventFrontpageTabContent event={event} refetch={refetch} readonly={props.readonly} />
        </CustomTabPanel>
    </>;
}
export const EventDetailFull = ({ event, tableClient, ...props }: EventDetailFullProps) => {

    const [selectedTab, setSelectedTab] = React.useState<number>(props.initialTabIndex || ((IsNullOrWhitespace(event.description) && (event.songLists?.length > 0)) ? gEventDetailTabSlugIndices['set-lists'] : gEventDetailTabSlugIndices.info));
    const tabSlug = Object.keys(gEventDetailTabSlugIndices)[selectedTab];
    const router = useRouter();
    const dashboardContext = React.useContext(DashboardContext);

    const { eventData, userMap } = CalculateEventMetadata_Verbose({ event, tabSlug, dashboardContext });

    React.useEffect(() => {
        void router.replace(eventData.eventURI);
    }, [eventData.eventURI]);

    const refetch = tableClient.refetch;

    return <EventDetailContainer eventData={eventData} readonly={props.readonly} tableClient={tableClient} fadePastEvents={false} showVisibility={true}>
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={tableClient.refetch}
            userMap={userMap}
            alertOnly={false} // show this always, allow users to respond always.
        />

        <SegmentList
            event={event}
            tableClient={tableClient}
            readonly={props.readonly}
        />

        <Suspense>
            <EventDetailFullTabArea {...props} event={event} tableClient={tableClient} selectedTab={selectedTab} setSelectedTab={setSelectedTab} refetch={refetch} eventData={eventData} userMap={userMap} />
        </Suspense>
    </EventDetailContainer>;
};


export interface EventSearchItemContainerProps {
    event: db3.EventSearch_Event;

    highlightTagIds?: number[];
    highlightStatusIds?: number[];
    highlightTypeIds?: number[];
}

export const EventSearchItemContainer = ({ ...props }: React.PropsWithChildren<EventSearchItemContainerProps>) => {
    const dashboardContext = React.useContext(DashboardContext);
    const event = db3.enrichSearchResultEvent(props.event, dashboardContext);

    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusIds || [];
    const highlightTypeIds = props.highlightTypeIds || [];

    const eventURI = API.events.getURIForEvent(event.id, event.slug);
    const dateRange = API.events.getEventDateRange(event);
    const eventTiming = dateRange.hitTestDateTime();

    const visInfo = dashboardContext.getVisibilityInfo(event);

    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Weak,
        color: event.type?.color || null,
    });

    const classes = [
        `EventDetail`,
        `contentSection`,
        `event`,
        `ApplyBorderLeftColor`,
        event.type?.text,
        visInfo.className,
        ((eventTiming === Timing.Past)) ? "past" : "notPast",
        `status_${event.status?.significance}`,
    ];

    return <div style={typeStyle.style} className={classes.join(" ")}>
        <div className='header applyColor'>
            <CMChipContainer>
                {event.status && <CMStandardDBChip
                    variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(event.statusId!) }}
                    border='border'
                    shape="rectangle"
                    model={event.status}
                    getTooltip={(status, c) => `Status ${c}: ${status?.description}`}
                />}
            </CMChipContainer>

            <div className='flex-spacer'></div>

            <CMChipContainer>
                {event.type &&
                    <CMStandardDBChip
                        model={event.type}
                        getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                        variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(event.typeId!) }}
                        className='eventTypeChip'
                    />
                }

            </CMChipContainer>

            {
                dashboardContext.isShowingAdminControls && <>
                    <NameValuePair
                        isReadOnly={true}
                        name={"eventId"}
                        value={event.id}
                    />
                    <NameValuePair
                        isReadOnly={true}
                        name={"revision"}
                        value={event.revision}
                    />
                    <InspectObject src={event} />
                </>
            }

            <Tooltip title="Add to your calendar (iCal)">
                <a href={GetICalRelativeURIForUserAndEvent({ userAccessToken: dashboardContext.currentUser?.accessToken || null, eventUid: event.uid })} target='_blank' rel="noreferrer" className='HalfOpacity interactable shareCalendarButton'>{gIconMap.Share()}</a>
            </Tooltip>
        </div>

        <div className='content'>
            {/* for search results it's really best if we allow the whole row to be clickable. */}
            <Link href={eventURI} className="titleLink">
                <div className='titleLine'>
                    <div className="titleText">
                        {event.name}
                    </div>
                </div>
            </Link>

            <div className='titleLine'>
                <EventDateField className="date smallInfoBox text" dateRange={dateRange} />
            </div>

            {!IsNullOrWhitespace(event.locationDescription) &&
                <div className='titleLine'>
                    <div className="location smallInfoBox">
                        {gIconMap.Place()}
                        <span className="text">{event.locationDescription}</span>
                    </div>
                </div>}

            <CMChipContainer>
                {event.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    model={tag.eventTag}
                    size='small'
                    variation={{ ...StandardVariationSpec.Weak, selected: highlightTagIds.includes(tag.eventTagId) }}
                    getTooltip={(_, c) => !!c ? `Tag: ${c}` : `Tag`}
                />)}
            </CMChipContainer>

            {props.children}

        </div>

    </div>;
};



export interface EventListItemProps {
    event: db3.EnrichedSearchEventPayload;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: EventsFilterSpec;
};

export const EventListItem = ({ event, ...props }: EventListItemProps) => {

    const { eventData, userMap } = CalculateEventSearchResultsMetadata({ event, results: props.results });

    return <EventSearchItemContainer
        event={event}
        highlightTagIds={props.filterSpec.tagFilter.options as number[]}
        highlightStatusIds={props.filterSpec.statusFilter.options as number[]}
        highlightTypeIds={props.filterSpec.typeFilter.options as number[]}
    >
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.refetch}
            userMap={userMap}
            alertOnly={true}
        />
    </EventSearchItemContainer>;
};



export const EventTableClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
    dateRange: new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
    slug: new DB3Client.SlugColumnClient({
        columnName: "slug", cellWidth: 150, fieldCaption: "URL (auto-generated)", previewSlug: (obj) => {
            const id = obj.id || "???";
            const slug = obj.slug || undefined;
            return API.events.getURIForEvent(id, slug);
        }
    }),
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
