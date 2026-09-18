// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { HostingMode } from '@/shared/brandConfigBase';
import { EditNote, LibraryMusic } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, DialogContent, DialogTitle, Divider, FormControlLabel, Link, ListItemIcon, MenuItem, Switch, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { toSorted } from 'shared/arrayUtils';
import { isAttendanceGoing, isAttendanceNotGoing } from 'shared/eventAttendance';
import { Permission } from 'shared/permissions';
import { Timing } from 'shared/time';
import { IsNullOrWhitespace } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from '../../db3/clientAPI';
import { gCharMap, gIconMap } from '../../db3/components/IconMap';
import { SearchResultsRet } from '../../db3/shared/apiTypes';
import { EnrichedSearchEventPayload, enrichSearchResultEvent } from '../../db3/shared/schema/enrichedEventTypes';
import { enrichFile } from '../../db3/shared/schema/enrichedFileTypes';
import { EventResponseInfo, UserInstrumentList } from '../../db3/shared/schema/eventAPI';
import { wikiMakeWikiPathFromEventDescription } from '../../wiki/shared/wikiUtils';
import { AppContextMarker } from '../AppContext';
import { CMChipContainer, CMStandardDBChip } from '../CMChip';
import { InstrumentChip, InstrumentFunctionalGroupChip } from '../CMCoreComponents';
import { AdminInspectObject, CMDialogContentText, DialogActionsCM, DotMenu, EventDateField, NameValuePair } from '../CMCoreComponents2';
import { CMLink } from '../CMLink';
import { GetStyleVariablesForColor } from '../color/ColorClientUtils';
import { ColorVariationSpec, gLightSwatchColors, StandardVariationSpec } from '../color/palette';
import { DashboardContextData, useDashboardContext, useFeatureRecorder } from '../dashboardContext/DashboardContext';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from '../EditFieldsDialog';
import { EventStatusChip } from '../event/EventChips';
import { EventAttendanceControl } from '../EventAttendanceComponents';
import { EventSongListTabContent } from '../EventSongListComponents';
import { ActivityFeature } from '../featureReports/activityTracking';
import { Markdown } from '../markdown/Markdown';
import { ReactiveInputDialog } from '../ReactiveInputDialog';
import { SearchItemBigCardLink } from '../SearchItemBigCardLink';
import { SettingMarkdown } from '../SettingMarkdown';
import { FilesTabContent } from '../SongFileComponents';
import { CMTab, CMTabPanel } from '../TabPanel';
import { UserChip } from '../user/userChip';
import { AddUserButton } from '../user/UserComponents';
import { VisibilityValue } from '../VisibilityControl';
import { WikiStandaloneControl } from '../wiki/WikiStandaloneComponents';
import { AttendanceChip } from './AttendanceChips';
import { EventAttendanceUserTagControl } from './EventAttendanceUserTagControl';
import { EventsFilterSpec } from './EventClientBaseTypes';
import { CalculateEventMetadata_Verbose, CalculateEventSearchResultsMetadata, EventEnrichedVerbose_Event, EventWithMetadata } from './EventComponentsBase';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { RelevanceClassOverrideIndicator, RelevanceClassOverrideMenuItemGroup } from './EventRelevanceOverrideComponents';
import { EditSingleSegmentDateButton, EventSegmentDotMenu, SegmentList } from './EventSegmentComponents';

// type EventWithTypePayload = Prisma.EventGetPayload<{
//     include: {
//         type: true,
//         visiblePermission: {
//             include: {
//                 roles: true,
//             }
//         },
//     }
// }>;



type VerboseEventResponseInfo = EventResponseInfo<
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
    const dashboardContext = useDashboardContext();
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            //underline="hover"
            //color="inherit"
            //sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            //underline="hover"
            //color="inherit"
            href="/backstage/events"
        //sx={{ display: 'flex', alignItems: 'center' }}
        >
            Events
        </CMLink>

        <CMLink
            //underline="hover"
            //color="inherit"
            href={dashboardContext.routingApi.getURIForEvent(props.event)}
        //sx={{ display: 'flex', alignItems: 'center' }}
        >
            {props.event.name}
        </CMLink>


        {/* <Typography color="text.primary">{params.idOrSlug}</Typography> */}
    </Breadcrumbs>
        ;
};



////////////////////////////////////////////////////////////////
export interface EventAttendanceEditDialogProps {
    responseInfo: VerboseEventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    userMap: UserInstrumentList;
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

    const mutationToken = API.events.updateUserEventAttendance.useToken();
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();
    const [showCancelledSegments, setShowCancelledSegments] = React.useState<boolean>(false);

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
        requestedCaps: DB3Client.xTableClientCaps.None, // we're only using this for display.
        tableSpec: eventResponseTableSpec,
    });

    //necessary to connect all the columns in the spec.
    const eventSegmentResponseTableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None, // we're only using this for display.
        tableSpec: eventSegmentResponseTableSpec,
    });

    // if this is null it 
    if (!eventResponseValue) throw new Error("eventResponseValue is null; i'm guessing usermap did not include a relevant user.");

    const eventValidationResult = eventResponseTableSpec.args.table.ValidateAndComputeDiff(eventResponseValue, eventResponseValue, "update");
    const eventSegmentValidationResults: Record<number, db3.ValidateAndComputeDiffResult> = Object.fromEntries(
        props.event.segments.map(segment => [
            segment.id,
            eventSegmentResponseTableSpec.args.table.ValidateAndComputeDiff(
                eventSegmentResponseValues[segment.id]!,
                eventSegmentResponseValues[segment.id]!,
                "update"),
        ])
    );

    const handleSaveClick = () => {
        void recordFeature({
            feature: ActivityFeature.attendance_response,
            context: `EventAttendanceEditDialog`,
            eventId: props.event.id,
        });
        mutationToken.invoke({
            userId: props.user.id,
            eventId: props.event.id,
            comment: eventResponseValue.userComment,
            instrumentId: eventResponseValue.instrumentId,
            segmentResponses: Object.fromEntries(Object.entries(eventSegmentResponseValues).map(x => {
                const att = dashboardContext.eventAttendance.getById(x[1].attendanceId);
                return [x[0], {
                    attendanceId: att?.id || null
                }];
            })),
            // inviting another user requires manage-events permission
            ...(dashboardContext.isAuthorized(Permission.manage_events)
                ? { isInvited: eventResponseValue.isInvited }
                : {}),
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

    const [cancelledSegments, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(props.event.segments);
    const segmentsToShow = showCancelledSegments ? props.event.segments : uncancelledSegments;

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

            <div className="NameValuePairList">
                {eventResponseTableSpec.renderEditor("isInvited", eventResponseValue, eventValidationResult, handleChangedEventResponse, false)}
                {eventResponseTableSpec.renderEditor("instrument", eventResponseValue, eventValidationResult, handleChangedEventResponse, false)}

                {(cancelledSegments.length > 0) && dashboardContext.isAuthorized(Permission.manage_events) &&
                    <FormControlLabel
                        control={
                            <Switch checked={showCancelledSegments} onChange={e => {
                                setShowCancelledSegments(!showCancelledSegments);
                            }} />
                        }
                        label="Show cancelled segments?"
                    />
                }

                {
                    segmentsToShow.map(segment => {
                        const validationResult = eventSegmentValidationResults[segment.id]!;
                        const response = eventSegmentResponseValues[segment.id]!;
                        const augmentedResponse = { ...response, attendance: dashboardContext.eventAttendance.getById(response.attendanceId) };
                        return <div key={segment.id} className='editSegmentResponse segment'>
                            <div>
                                <div className='segmentName'>{segment.name}</div>
                                {eventSegmentResponseTableSpec.renderEditor("attendance", augmentedResponse, validationResult, (n) => handleChangedEventSegmentResponse(segment, n), false)}
                            </div>
                        </div>;
                    })
                }
                {eventResponseTableSpec.renderEditor("userComment", eventResponseValue, eventValidationResult, handleChangedEventResponse, false)}

            </div>
            <DialogActionsCM>
                <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
                <Button onClick={handleSaveClick} startIcon={gIconMap.Save()}>OK</Button>
            </DialogActionsCM>
        </DialogContent>

    </ReactiveInputDialog>;
};



////////////////////////////////////////////////////////////////
export interface EventAttendanceEditButtonProps {
    responseInfo: VerboseEventResponseInfo;
    event: db3.EventClientPayload_Verbose;
    user: db3.UserWithInstrumentsPayload;
    userMap: UserInstrumentList;
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
    userMap: UserInstrumentList;
    showCancelledSegments: boolean;
    refetch: () => void;
    readonly: boolean;
};

export const EventAttendanceDetailRow = ({ responseInfo, user, event, refetch, readonly, userMap, showCancelledSegments }: EventAttendanceDetailRowProps) => {
    const currentUser = useCurrentUser()[0]!;
    const dashboardContext = useDashboardContext();

    const realUser: { color: string | null } & typeof user = {
        ...user,
        color: null,
    };

    const eventResponse = responseInfo.getEventResponseForUser(user, dashboardContext, userMap);
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const attendanceVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "filled", variation: 'strong' };
    if (!eventResponse?.isRelevantForDisplay) {
        return null;
    }

    const authorizedForEdit = dashboardContext.isAuthorized(Permission.change_others_event_responses);
    const isYou = eventResponse.user.id === currentUser.id;

    const [_, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);
    const shownSegments: (typeof event.segments[0])[] = showCancelledSegments ? event.segments : uncancelledSegments;

    const classes = [
        `nameCellContainer`,
        isYou && "you",
        `userCssClass_${user.cssClass}`,
        ...user.tags.map(ta => `userTagCssClass_${dashboardContext.userTag.getById(ta.userTagId)?.cssClass}`),
    ];

    if (isYou) {
        realUser.name += " (you)";
        realUser.color = gLightSwatchColors.light_blue;
    }

    return <tr>
        <td>
            {/* <div className={classes.join(" ")}> */}
            {/* <div className={`name`}>{user.name}</div> */}
            <UserChip className={classes.join(" ")} value={realUser} size='small' color={realUser.color} />
            {/* {isYou && <div className='you'>(you)</div>} */}
            {/* </div> */}
        </td>
        <td>{!!eventResponse.instrument ? <InstrumentChip value={eventResponse.instrument} variation={instVariant} shape="rectangle" border={'noBorder'} /> : "--"}</td>
        {shownSegments.map((segment, iseg) => {
            const segmentResponse = responseInfo.getResponseForUserAndSegment({ user, segment });
            assert(!!segmentResponse, "segmentResponse shouldn't be null.");
            const attendance = dashboardContext.eventAttendance.getById(segmentResponse.response.attendanceId);
            const status = dashboardContext.eventStatus.getById(segment.statusId);
            return <React.Fragment key={segment.id}>
                <td className={`responseCell segmentSignificance_${status?.significance || "none"}`}>
                    <div className='responseCellContents'>
                        {iseg === 0 && <div className='editButton'>{!readonly && authorizedForEdit && <EventAttendanceEditButton {...{ event, user, responseInfo, refetch, userMap }} />}</div>}
                        {!!attendance ? <AttendanceChip
                            value={attendance}
                            variation={attendanceVariant}
                            event={event}
                            eventSegment={segment}
                            segmentResponse={segmentResponse.response}
                            eventResponse={eventResponse.response}
                        /> : "--"}
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
    userMap: UserInstrumentList;
};

type EventAttendanceDetailSortField = "user" | "instrument" | "response";

export const EventAttendanceDetail = ({ refetch, eventData, tableClient, ...props }: EventAttendanceDetailProps) => {
    if (!eventData.responseInfo) return null;
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;
    const dashboardContext = useDashboardContext();
    const token = API.events.updateUserEventAttendance.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [sortField, setSortField] = React.useState<EventAttendanceDetailSortField>("instrument");
    const [sortSegmentId, setSortSegmentId] = React.useState<number>(0); // support invalid IDs
    const [sortSegment, setSortSegment] = React.useState<db3.EventVerbose_EventSegment | null>(null);
    const recordFeature = useFeatureRecorder();

    const [showCancelledSegments, setShowCancelledSegments] = React.useState<boolean>(false);

    const canAddUsers = dashboardContext.isAuthorized(Permission.manage_events);
    const [cancelledSegments, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);
    const showCancelledSegmentsControls = canAddUsers && cancelledSegments.length > 0;

    const shownSegments: (typeof event.segments[0])[] = showCancelledSegments ? event.segments : uncancelledSegments;

    React.useEffect(() => {
        setSortSegment(shownSegments.find(s => s.id === sortSegmentId) || null);
    }, [sortSegmentId, event]);

    const onAddUser = (u: db3.UserPayload | null) => {
        if (u == null) return;
        void recordFeature({
            feature: ActivityFeature.attendance_explicit_invite,
        });
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

    const isSingleSegment = shownSegments.length === 1;

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

            // sort first by functional group            
            if (ar.instrument.functionalGroup.sortOrder !== br.instrument.functionalGroup.sortOrder) {
                return ar.instrument.functionalGroup.sortOrder < br.instrument.functionalGroup.sortOrder ? -1 : 1;
            }

            // and then by instrument
            return Math.sign(ar.instrument.sortOrder - br.instrument.sortOrder);

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

    const segStats = GetSegmentResponseStats(shownSegments, dashboardContext);

    return <>
        <NameValuePair
            name="People having this user tag are invited:"
            value={<EventAttendanceUserTagControl event={event} refetch={refetch} readonly={props.readonly} />}
            isReadOnly={props.readonly}
        />

        {showCancelledSegmentsControls && <FormControlLabel
            control={
                <Switch checked={showCancelledSegments} onChange={(e) => setShowCancelledSegments(e.target.checked)} />
            }
            label={`Show ${cancelledSegments.length} cancelled segments`}
        />}

        <table className='attendanceDetailTable'>
            <thead>
                <tr>
                    <th>
                        <div className='interactable' onClick={() => setSortField('user')}>Who {sortField === 'user' && gCharMap.DownArrow()}</div>
                    </th>
                    <th>
                        <div className='interactable' onClick={() => setSortField('instrument')}>Instrument {sortField === 'instrument' && gCharMap.DownArrow()}</div>
                    </th>
                    {shownSegments.map(seg => {
                        const status = dashboardContext.eventStatus.getById(seg.statusId);
                        return <React.Fragment key={seg.id}>
                            <th className={`responseCell segmentSignificance_${status?.significance || "none"}`}>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <div className='interactable' onClick={() => { setSortField('response'); setSortSegmentId(seg.id); }}>
                                        {isSingleSegment ? "Response" : seg.name} {sortField === 'response' && seg.id === sortSegmentId && gCharMap.DownArrow()}
                                    </div>
                                    <EventSegmentDotMenu
                                        event={event}
                                        refetch={refetch}
                                        readonly={props.readonly}
                                        segment={seg}
                                        getAttendeeNames={(copyInstrumentNames) => GetSegmentAttendeeNames(copyInstrumentNames, seg.id, eventData, props.userMap, dashboardContext)}
                                    />
                                </div>
                            </th>
                        </React.Fragment>;
                    })}
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
                {
                    sortedUsers.map(user => {
                        return <EventAttendanceDetailRow
                            key={user.id}
                            responseInfo={responseInfo}
                            event={event}
                            user={user}
                            refetch={refetch}
                            readonly={props.readonly}
                            userMap={props.userMap}
                            showCancelledSegments={showCancelledSegments}
                        />
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
                    {segStats.map(seg => {
                        const status = dashboardContext.eventStatus.getById(seg.segment.statusId);
                        return <React.Fragment key={seg.segment.id}>
                            <td className={`responseCell segmentSignificance_${status?.significance || "none"}`}>
                                <EventSegmentAttendeeStat stat={seg} />
                            </td>
                        </React.Fragment>;
                    })}
                    <td>{/*Comments*/}</td>
                </tr>
            </tfoot>
        </table>
    </>;

};



export const EventDescriptionControl = ({ event, refetch, readonly }: { event: Prisma.EventGetPayload<{ select: { name: true, id: true } }>, refetch: () => void, readonly: boolean }) => {
    const wikiPath = wikiMakeWikiPathFromEventDescription(event);
    return <WikiStandaloneControl
        canonicalWikiPath={wikiPath.canonicalWikiPath}
        readonly={readonly}
        onUpdated={refetch}
        renderCreateButton={(onClick) => <Button onClick={onClick} startIcon={gIconMap.Edit()}>Add information</Button>}
    />;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type SegmentResponseStat = {
    segment: db3.EventVerbose_EventSegment;
    notGoingCount: number;
    goingCount: number;
};

const GetSegmentResponseStats = (segments: db3.EventVerbose_EventSegment[], dashboardContext: DashboardContextData): SegmentResponseStat[] => {
    return segments.map(seg => ({
        segment: seg,
        notGoingCount: seg.responses.filter(resp => {
            const att = dashboardContext.eventAttendance.getById(resp.attendanceId);
            return isAttendanceNotGoing(att)
        }).length,
        goingCount: seg.responses.filter(resp => {
            const att = dashboardContext.eventAttendance.getById(resp.attendanceId);
            return isAttendanceGoing(att)
        }).length
    }));
};

const EventSegmentAttendeeStat = (props: { stat: SegmentResponseStat }) => {
    return <div className='EventSegmentAttendeeStat'>
        <div>{gIconMap.ThumbUp()} {props.stat.goingCount}</div>
        <div>{gIconMap.ThumbDown()} {props.stat.notGoingCount}</div>
    </div>;
};

const GetSegmentAttendeeNames = (copyInstrumentNames: boolean, segmentId: number, eventData: VerboseEventWithMetadata, userMap: UserInstrumentList, dashboardContext: DashboardContextData): string[] => {
    const responseInfo = eventData.responseInfo!;
    const segmentResponses = responseInfo.getResponsesForSegment(segmentId)
        .filter(r => dashboardContext.isAttendanceIdGoing(r.response.attendanceId));
    const attendees = segmentResponses.map(sr => {
        const user = sr.user;
        const eventResponse = responseInfo.getEventResponseForUser(user, dashboardContext, userMap);
        const instrumentStr = eventResponse?.instrument ? `(${eventResponse.instrument.name})` : "";
        return copyInstrumentNames ? `${user.name} ${instrumentStr}` : user.name;
    });
    return toSorted(attendees);
};

export interface EventCompletenessTabContentProps {
    eventData: VerboseEventWithMetadata;
    userMap: UserInstrumentList;
    readonly: boolean;
    refetch: () => void;
}

export const EventCompletenessTabContent = ({ eventData, userMap, ...props }: EventCompletenessTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;

    const [showCancelledSegments, setShowCancelledSegments] = React.useState<boolean>(false);
    const [cancelledSegments, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);
    const showCancelledSegmentsControls = dashboardContext.isAuthorized(Permission.manage_events) && cancelledSegments.length > 0;
    const shownSegments: (typeof event.segments[0])[] = showCancelledSegments ? event.segments : uncancelledSegments;

    const functionalGroupsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xInstrumentFunctionalGroup,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    if (!responseInfo) return null;

    const isSingleSegment = eventData.event.segments.length === 1;

    const segStats = GetSegmentResponseStats(shownSegments, dashboardContext);

    return <div style={{ overflowX: "auto" }}>
        {/* <FormControlLabel control={<input type="range" min={0} max={100} value={minStrength} onChange={e => setMinStrength(e.target.valueAsNumber)} />} label="Filter responses" /> */}

        {showCancelledSegmentsControls && <FormControlLabel
            control={
                <Switch checked={showCancelledSegments} onChange={(e) => setShowCancelledSegments(e.target.checked)} />
            }
            label={`Show ${cancelledSegments.length} cancelled segments`}
        />}

        <table className='EventCompletenessTabContent'>
            <tbody>
                <tr>
                    <th>Instrument group</th>
                    {isSingleSegment ? <th key="__">Response</th> : shownSegments.map((seg) => {
                        const status = dashboardContext.eventStatus.getById(seg.statusId);
                        return <th className={`segmentStatusSignificance_${status?.significance || "none"}`} key={seg.id}>
                            <div style={{ display: "flex", justifyContent: "center" }}>
                                <div>{seg.name}</div>
                                <EventSegmentDotMenu
                                    event={event}
                                    readonly={props.readonly}
                                    refetch={props.refetch}
                                    segment={seg}
                                    getAttendeeNames={(copyInstrumentNames) => GetSegmentAttendeeNames(copyInstrumentNames, seg.id, eventData, userMap, dashboardContext)}
                                />
                            </div>
                        </th>;
                    })}
                </tr>
                {(functionalGroupsClient.items as db3.InstrumentFunctionalGroupPayload[]).map(functionalGroup => {
                    return <tr key={functionalGroup.id}>
                        <td className='instrumentFunctionalGroupTD'>
                            <InstrumentFunctionalGroupChip value={functionalGroup} size='small' variation={instVariant} border={'noBorder'} shape='rectangle' />
                        </td>
                        {shownSegments.map((seg) => {
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
                            const status = dashboardContext.eventStatus.getById(seg.statusId);
                            return <td key={seg.id} className={`segmentStatusSignificance_${status?.significance || "none"}`}>
                                <div className='attendanceResponseColorBarCell'>
                                    <div className='attendanceResponseColorBarSegmentContainer'>
                                        {sortedResponses.map(resp => {
                                            const att = dashboardContext.eventAttendance.getById(resp.response.attendanceId);
                                            const going = isAttendanceGoing(att);
                                            const color = going ? att?.color : null;
                                            const style = GetStyleVariablesForColor({ color, ...StandardVariationSpec.Strong });
                                            return <Tooltip disableInteractive key={resp.response.id} title={`${resp.user.name}: ${att?.text || "no response"}`}>
                                                <div className={`attendanceResponseColorBarSegment applyColor ${style.cssClass} ${going ? "going" : "notgoing"}`} style={style.style}>
                                                    {/* {resp.user.name.substring(0, 1).toLocaleUpperCase()} */}
                                                    {resp.user.name}
                                                </div>
                                            </Tooltip>
                                        })}
                                    </div>
                                    {/* <div className='attendanceResponseColorBarText'>
                                        {sortedResponses.reduce((acc, r) => acc + (isAttendanceGoing(r.response.attendance) ? 1 : 0), 0)}
                                    </div> */}
                                </div>
                            </td>;
                        })}
                    </tr>;
                })
                }
            </tbody>
            <tfoot>
                <tr>
                    <td>
                    </td>
                    {segStats.map(seg => {
                        //const status = dashboardContext.eventStatus.getById(seg.segment.statusId);
                        return <React.Fragment key={seg.segment.id}>
                            <td className={`responseCell`}>
                                <EventSegmentAttendeeStat stat={seg} />
                            </td>
                        </React.Fragment>
                    })}
                </tr>
            </tfoot>
        </table>
    </div>;
};

const EventDotMenu = ({ event, showVisibility, refetch }: { event: Prisma.EventGetPayload<{ select: { visiblePermissionId, id, name, relevanceClassOverride } }>, showVisibility: boolean, refetch: () => void }) => {
    const endMenuItemRef = React.useRef<() => void>(() => { });
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();

    const closeMenu = () => {
        endMenuItemRef.current();
    };

    return <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>

        {showVisibility &&
            <MenuItem disabled={true}>
                <VisibilityValue permissionId={event.visiblePermissionId} variant='verbose' />
            </MenuItem>
        }
        {showVisibility &&
            <Divider />
        }


        <MenuItem onClick={async () => {
            const uri = dashboardContext.routingApi.getURIForEvent(event);
            await navigator.clipboard.writeText(uri);
            closeMenu();
            snackbar.showSuccess("Link address copied");
        }}>
            <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
            Copy event link to clipboard
        </MenuItem>

        <Divider />

        {dashboardContext.isAuthorized(Permission.manage_events) &&
            <RelevanceClassOverrideMenuItemGroup event={event} closeMenu={closeMenu} refetch={refetch} />
        }
    </DotMenu>;
};

// an list of slugs
export const gEventDetailTabSlugIndices = {
    "none": "none",
    "info": "info",
    "setlists": "setlists",
    "attendance": "attendance",
    "completeness": "completeness",
    "files": "files",
    "frontpage": "frontpage",
} as const;

export interface EventDetailContainerProps {
    eventData: VerboseEventWithMetadata;
    tableClient: DB3Client.xTableRenderClient | null;
    refetch: () => void;
    readonly: boolean;
    fadePastEvents: boolean;
    showVisibility?: boolean;

    highlightTagIds?: number[];
    highlightStatusId?: number[];
    highlightTypeId?: number[];
}

export const EventDetailContainer = ({ eventData, tableClient, refetch, ...props }: React.PropsWithChildren<EventDetailContainerProps>) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = useDashboardContext();
    const isShowingAdminControls = API.other.useIsShowingAdminControls();
    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusId || [];
    const highlightTypeIds = props.highlightTypeId || [];
    const recordFeature = useFeatureRecorder();

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

    const isCancelled = eventData.event.status?.significance === db3.EventStatusSignificance.Cancelled;

    return <div style={typeStyle.style} className={classes.join(" ")}>
        <div className='header  applyColor'>
            <CMChipContainer>
                <EventStatusChip statusId={eventData.event.statusId} highlightStatusIds={highlightStatusIds} />
            </CMChipContainer>

            <div className='flex-spacer'></div>

            <RelevanceClassOverrideIndicator event={eventData.event} colorStyle='default' />

            <CMChipContainer>
                {eventData.event.type && //<EventTypeValue type={event.type} />
                    <CMStandardDBChip
                        className='eventTypeChip'
                        size='small'
                        model={eventData.event.type}
                        getTooltip={_ => eventData.event.type?.description || null}
                        variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(eventData.event.typeId!) }}
                    />
                }

            </CMChipContainer>

            <AdminInspectObject src={eventData} />

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
                        void recordFeature({
                            feature: ActivityFeature.event_edit,
                            context: "EditFieldsDialogButton",
                        });
                        tableClient.doUpdateMutation(obj).then(() => {
                            showSnackbar({ children: "update successful", severity: 'success' });
                            api.close();
                            // if (obj.slug !== eventData.event.slug) {
                            //     const newUrl = API.events.getURIForEvent(obj.id, obj.slug);
                            //     //void router.replace(newUrl); // <-- ideally we would show the snackbar on refresh but no.
                            // }
                        }).catch(err => {
                            console.log(err);
                            showSnackbar({ children: "update error", severity: 'error' });
                        }).finally(refetch);
                    }}
                    onDelete={(api: EditFieldsDialogButtonApi) => {
                        void recordFeature({
                            feature: ActivityFeature.event_delete,
                        });
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

            <EventDotMenu event={eventData.event} showVisibility={!!showVisibility} refetch={refetch} />
        </div>

        <div className='content'>

            {/* for search results it's really best if we allow the whole row to be clickable. */}
            <Link href={eventData.eventURI} className="titleLink">
                <div className='titleLine'>
                    <div className="titleText">
                        {eventData.event.name}
                    </div>
                    {isCancelled && <div className="cancelledTag">(Cancelled)</div>}
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
                    getTooltip={(_) => tag.eventTag.description}
                />)}
            </CMChipContainer>

            {props.children}

        </div>

    </div>;
};


export interface EventDetailFullProps {
    event: EventEnrichedVerbose_Event,
    tableClient: DB3Client.xTableRenderClient;
    initialTabIndex?: string;
    readonly: boolean;
    refetch: () => void;
};

type EventDetailFullTabAreaProps = EventDetailFullProps & {
    selectedTab: string;
    setSelectedTab: (v: string) => void;
    eventData: VerboseEventWithMetadata;
    userMap: UserInstrumentList;
};

export const EventDetailFullTab2Area = ({ eventData, refetch, selectedTab, event, tableClient, userMap, ...props }: EventDetailFullTabAreaProps) => {
    const dashboardContext = useDashboardContext();

    const handleTabChange = (_: undefined | React.SyntheticEvent, newValue: string) => {
        props.setSelectedTab(newValue);
    };

    const [_, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);

    const segmentResponseCounts = !eventData.responseInfo ? [] : uncancelledSegments.map(seg => {
        return eventData.responseInfo!.getResponsesForSegment(seg.id).reduce((acc, resp) => {
            const att = dashboardContext.eventAttendance.getById(resp.response.attendanceId);
            return acc + (isAttendanceGoing(att) ? 1 : 0)
        }, 0);
    });
    const segmentResponseCountStr = segmentResponseCounts.length > 0 ? `(${segmentResponseCounts.join(" - ")})` : "";

    const enrichedFiles = eventData.event.fileTags.map(ft => {
        return {
            ...ft,
            file: enrichFile(ft.file, dashboardContext),
        };
    });
    //const elevation = 1;

    return <CMTabPanel
        handleTabChange={handleTabChange}
        selectedTabId={selectedTab}
    //setNewDefault={(t) => handleTabChange(undefined, t as string)}
    >
        <CMTab
            summaryIcon={gIconMap.Info()}
            summaryTitle="Info"
            thisTabId={gEventDetailTabSlugIndices.info}
            canBeDefault={!IsNullOrWhitespace(eventData.event.descriptionWikiPage?.currentRevision?.content)}
        >
            <AppContextMarker name="info tab">
                <div className='descriptionLine'>
                    <EventDescriptionControl event={event} refetch={refetch} readonly={props.readonly} />
                </div>
            </AppContextMarker>
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.setlists}
            canBeDefault={!!event.songLists.length}
            summaryIcon={gIconMap.LibraryMusic()}
            summaryTitle="Setlists"
            summarySubtitle={<>({event.songLists.length})</>}
        >
            <AppContextMarker name="setlists tab">
                <EventSongListTabContent event={event} tableClient={tableClient} readonly={props.readonly} refetch={refetch} />
            </AppContextMarker>
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.completeness}
            summaryIcon={gIconMap.Trumpet()}
            summaryTitle="by instrument"
        >
            <AppContextMarker name="by instrument tab">
                <SettingMarkdown setting='EventCompletenessTabMarkdown' />
                <EventCompletenessTabContent eventData={eventData} userMap={userMap} readonly={props.readonly} refetch={refetch} />
            </AppContextMarker>
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.attendance}
            summaryIcon={gIconMap.ThumbUp()}
            summaryTitle="Responses"
            summarySubtitle={segmentResponseCountStr}
        >
            <AppContextMarker name="attendance tab">
                <SettingMarkdown setting='EventAttendanceDetailMarkdown' />
                <EventAttendanceDetail eventData={eventData} tableClient={tableClient} refetch={refetch} readonly={props.readonly} userMap={userMap} />
            </AppContextMarker>
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.frontpage}
            summaryIcon={gIconMap.Public()}
            summaryTitle="Frontpage"
            summarySubtitle={<>{eventData.event.frontpageVisible && gCharMap.Checkmark()}</>}
            enabled={dashboardContext.brand.hostingMode === HostingMode.CafeMarche}
        >
            <AppContextMarker name="frontpage tab">
                <EventFrontpageTabContent event={event} refetch={refetch} readonly={props.readonly} />
            </AppContextMarker>
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.files}
            canBeDefault={!!event.fileTags.length}
            summaryIcon={gIconMap.AttachFile()}
            summaryTitle="Files"
            summarySubtitle={<>({event.fileTags.length})</>}
        >
            <AppContextMarker name="files tab">
                <FilesTabContent
                    fileTags={enrichedFiles}
                    uploadTags={{
                        taggedEventId: event.id,
                    }}
                    hiddenTagIds={{
                        eventTagIds: [event.id],
                    }
                    }
                    refetch={refetch}
                    readonly={props.readonly}
                    contextEvent={event}
                />
            </AppContextMarker>
        </CMTab>
    </CMTabPanel>
};




export const EventDetailFull = ({ event, tableClient, ...props }: EventDetailFullProps) => {

    const [selectedTab, setSelectedTab] = React.useState<string>(props.initialTabIndex || ((IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && (event.songLists?.length > 0)) ? gEventDetailTabSlugIndices.setlists : gEventDetailTabSlugIndices.info));
    const tabSlug = selectedTab;//Object.keys(gEventDetailTabSlugIndices)[selectedTab];
    const router = useRouter();
    const dashboardContext = useDashboardContext();

    const { eventData, userMap } = CalculateEventMetadata_Verbose({ event, tabSlug, dashboardContext });


    React.useEffect(() => {
        void router.replace(eventData.eventURI, undefined, { shallow: true });// unfortunately this causes annoyances with scrolling.
    }, [eventData.eventURI]);

    //const refetch = tableClient.refetch;

    return <EventDetailContainer eventData={eventData} readonly={props.readonly} tableClient={tableClient} fadePastEvents={false} showVisibility={true} refetch={props.refetch}>
        <AppContextMarker name="event detail full" eventId={event.id} >
            <EventAttendanceControl
                eventData={eventData}
                onRefetch={tableClient.refetch}
                userMap={userMap}
                minimalWhenNotAlert={false} // show full always, allow users to respond always.
            />

            <SegmentList
                event={event}
                tableClient={tableClient}
                readonly={props.readonly}
            />

            <Suspense>
                <EventDetailFullTab2Area {...props} event={event} tableClient={tableClient} selectedTab={selectedTab} setSelectedTab={setSelectedTab} refetch={props.refetch} eventData={eventData} userMap={userMap} />
            </Suspense>
        </AppContextMarker>
    </EventDetailContainer>;
};


export interface EventSearchItemContainerProps {
    event: db3.EventSearch_Event;

    highlightTagIds?: number[];
    highlightStatusIds?: number[];
    highlightTypeIds?: number[];
    reducedInfo?: boolean; // show less info
}

export const EventSearchItemContainer = ({ reducedInfo = false, ...props }: React.PropsWithChildren<EventSearchItemContainerProps>) => {
    const dashboardContext = useDashboardContext();
    const event = enrichSearchResultEvent(props.event, dashboardContext);

    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusIds || [];
    const highlightTypeIds = props.highlightTypeIds || [];

    const eventURI = dashboardContext.routingApi.getURIForEvent(event);
    const dateRange = API.events.getEventDateRange(event);
    const eventTiming = dateRange.hitTestDateTime(new Date());

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

    const isCancelled = event.status?.significance === db3.EventStatusSignificance.Cancelled;

    return <div style={typeStyle.style} className={classes.join(" ")}>
        <AppContextMarker name="event search item" eventId={event.id} >
            <div className='header applyColor'>
                {!reducedInfo &&
                    <CMChipContainer>
                        {event.status && <CMStandardDBChip
                            variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(event.statusId!) }}
                            border='border'
                            shape="rectangle"
                            model={event.status}
                            //getTooltip={(status, c) => `Status ${c}: ${status?.description}`}
                            getTooltip={_ => event.status?.description || null}
                        />}
                    </CMChipContainer>
                }

                <div className='flex-spacer'></div>

                <RelevanceClassOverrideIndicator event={event} colorStyle='subtle' />

                <CMChipContainer>
                    {event.type &&
                        <CMStandardDBChip
                            model={event.type}
                            //getTooltip={(_, c) => !!c ? `Type: ${c}` : `Type`}
                            getTooltip={_ => event.type?.description || ""}
                            variation={{ ...StandardVariationSpec.Strong, selected: highlightTypeIds.includes(event.typeId!) }}
                            className='eventTypeChip'
                        />
                    }

                </CMChipContainer>

                <AdminInspectObject src={event} />

                {!reducedInfo &&
                    <EventDotMenu event={event} showVisibility={false} refetch={() => { }} />}
            </div>

            <div className='content'>
                {/* for search results it's really best if we allow the whole row to be clickable. */}
                <CMLink href={eventURI} className="titleLink" trackingFeature={ActivityFeature.link_follow_internal}>
                    <div className='titleLine'>
                        <div className="titleText">
                            {event.name}
                        </div>
                        {isCancelled && <div className="cancelledTag">(Cancelled)</div>}
                    </div>
                </CMLink>

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

                {(event.status?.significance !== db3.EventStatusSignificance.Cancelled) &&
                    <CMChipContainer>
                        {event.tags.map(tag => <CMStandardDBChip
                            key={tag.id}
                            model={tag.eventTag}
                            size='small'
                            variation={{ ...StandardVariationSpec.Weak, selected: highlightTagIds.includes(tag.eventTagId) }}
                            getTooltip={(_) => tag.eventTag.description}
                        />)}
                    </CMChipContainer>}

                {props.children}

            </div>
        </AppContextMarker>
    </div>;
};

export interface EventListItemProps {
    event: EnrichedSearchEventPayload;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec?: EventsFilterSpec; // for highlighting matching fields
    showTabs?: boolean;
    showAttendanceControl?: boolean;
    reducedInfo?: boolean; // show less info, like in the event list.
};

export const EventListItem = ({ showTabs = false, showAttendanceControl = true, reducedInfo = false, event, ...props }: EventListItemProps) => {
    const dashboardContext = useDashboardContext();
    const { eventData, userMap } = CalculateEventSearchResultsMetadata({ event, results: props.results });

    return <EventSearchItemContainer
        event={event}
        highlightTagIds={props.filterSpec ? props.filterSpec.tagFilter.options as number[] : []}
        highlightStatusIds={props.filterSpec ? props.filterSpec.statusFilter.options as number[] : []}
        highlightTypeIds={props.filterSpec ? props.filterSpec.typeFilter.options as number[] : []}
        reducedInfo={reducedInfo}
    //queryText={props.queryText}
    >
        {showAttendanceControl &&
            <EventAttendanceControl
                eventData={eventData}
                onRefetch={props.refetch}
                userMap={userMap}
                minimalWhenNotAlert={true}
            />
        }
        {showTabs && // gIconMap.Info()
            <div className='SearchItemBigCardLinkContainer'>
                {!IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && <SearchItemBigCardLink
                    icon={<EditNote />}
                    title="View info"
                    uri={dashboardContext.routingApi.getURIForEvent(event, gEventDetailTabSlugIndices.info)}
                    eventId={event.id}
                />
                }
                {event.songLists.length > 0 && <SearchItemBigCardLink
                    icon={<LibraryMusic />}
                    title="View setlist"
                    uri={dashboardContext.routingApi.getURIForEvent(event, gEventDetailTabSlugIndices.setlists)}
                    eventId={event.id}
                />
                }
            </div>
        }
    </EventSearchItemContainer>;
};

