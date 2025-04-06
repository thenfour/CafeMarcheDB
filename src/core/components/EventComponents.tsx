
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useAuthenticatedSession } from '@blitzjs/auth';
import { Checklist, EditNote, LibraryMusic } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, Checkbox, DialogContent, DialogTitle, Divider, FormControlLabel, Link, ListItemIcon, MenuItem, Select, Switch, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { toSorted } from 'shared/arrayUtils';
import { ColorVariationSpec, StandardVariationSpec } from 'shared/color';
import { Permission } from 'shared/permissions';
import { Timing } from 'shared/time';
import { CoalesceBool, IsNullOrWhitespace } from 'shared/utils';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { getAbsoluteUrl } from '../db3/clientAPILL';
import { gCharMap, gIconMap, RenderMuiIcon } from '../db3/components/IconMap';
import { GetICalRelativeURIForUserAndEvent, GetICalRelativeURIForUserUpcomingEvents, gNullValue, SearchResultsRet } from '../db3/shared/apiTypes';
import { wikiMakeWikiPathFromEventDescription } from '../wiki/shared/wikiUtils';
import { CMChipContainer, CMStandardDBChip } from './CMChip';
import { AdminInspectObject, AttendanceChip, InspectObject, InstrumentChip, InstrumentFunctionalGroupChip } from './CMCoreComponents';
import { CMDialogContentText, DialogActionsCM, DotMenu, EventDateField, NameValuePair } from './CMCoreComponents2';
import { CMTextInputBase } from './CMTextField';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { DashboardContext, DashboardContextData, useDashboardContext } from './DashboardContext';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { EventAttendanceControl } from './EventAttendanceComponents';
import { CalculateEventMetadata_Verbose, CalculateEventSearchResultsMetadata, EventEnrichedVerbose_Event, EventsFilterSpec, EventWithMetadata } from './EventComponentsBase';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { EditSingleSegmentDateButton, EventSegmentDotMenu, SegmentList } from './EventSegmentComponents';
import { EventSongListTabContent } from './EventSongListComponents';
import { ReactiveInputDialog } from './ReactiveInputDialog';
import { SearchItemBigCardLink } from './SearchItemBigCardLink';
import { GenerateDefaultDescriptionSettingName, SettingMarkdown } from './SettingMarkdown';
import { FilesTabContent } from './SongFileComponents';
import { CMTab, CMTabPanel } from './TabPanel';
import { AddUserButton } from './UserComponents';
import { VisibilityControl, VisibilityValue } from './VisibilityControl';
import { WikiStandaloneControl } from './WikiStandaloneComponents';
import { EventWorkflowTabContent } from './WorkflowEventComponents';
import { Markdown3Editor } from './markdown/MarkdownControl3';
import { Markdown } from './markdown/Markdown';

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
type EventCustomFieldValuePayload = Prisma.EventCustomFieldValueGetPayload<{}>;

////////////////////////////////////////////////////////////////
interface EventCustomFieldValueControlProps {
    value: EventCustomFieldValuePayload;
    readonly?: boolean;
    mode: "edit" | "view";
    onChange?: (x: EventCustomFieldValuePayload) => void;
};

type EventCustomFieldValueControlPropsWithDeserializedValueView<T> = Omit<EventCustomFieldValueControlProps, "onChange"> & {
    deserializedValue: T;
}

type EventCustomFieldValueControlPropsWithDeserializedValue<T> = EventCustomFieldValueControlPropsWithDeserializedValueView<T> & {
    deserializedValue: T;
    onChange: (val: T) => void;
}

// checkbox json data is just a boolish value null/true/false. checkbox types do not need to care about tri-state; if you want tristate use an options type.
const EventCustomFieldValueValueView_Checkbox = (props: EventCustomFieldValueControlPropsWithDeserializedValueView<boolean>) => {
    return <div>{props.deserializedValue ? "YES" : "NO"}</div>
}

const EventCustomFieldValueValueEdit_Checkbox = (props: EventCustomFieldValueControlPropsWithDeserializedValue<boolean>) => {
    //return <div>{props.deserializedValue ? "YES" : "NO"}</div>
    return <Checkbox
        checked={props.deserializedValue || false}
        onChange={props.onChange == null ? undefined : ((e) => props.onChange!(e.target.checked))}
    />;
}

const EventCustomFieldValueValueView_Options = (props: EventCustomFieldValueControlPropsWithDeserializedValueView<null | string>) => {
    const dashboardContext = useDashboardContext();
    const fieldSpec = dashboardContext.eventCustomField.getById(props.value.customFieldId);
    assert(!!fieldSpec, `fieldspec not found for id ${props.value.customFieldId}`);
    const options = db3.ParseEventCustomFieldOptionsJson(fieldSpec.optionsJson);
    let selectedOption = options.find(o => o.id === props.deserializedValue);
    return <div>{selectedOption ? selectedOption.label : "<none>"}</div>;
}

const EventCustomFieldValueValueEdit_Options = (props: EventCustomFieldValueControlPropsWithDeserializedValue<null | string>) => {
    const dashboardContext = useDashboardContext();
    const fieldSpec = dashboardContext.eventCustomField.getById(props.value.customFieldId);
    assert(!!fieldSpec, `fieldspec not found for id ${props.value.customFieldId}`);
    const options = db3.ParseEventCustomFieldOptionsJson(fieldSpec.optionsJson);
    return <Select value={props.deserializedValue || gNullValue} onChange={e => props.onChange(e.target.value)}>
        <MenuItem value={gNullValue}>--</MenuItem>
        {options.map(o => {
            return <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
        })}
    </Select>;
}

const EventCustomFieldValueValueView_RichText = (props: EventCustomFieldValueControlPropsWithDeserializedValueView<string | null>) => {
    return <div><Markdown markdown={props.deserializedValue} /></div>;
}

const EventCustomFieldValueValueEdit_RichText = (props: EventCustomFieldValueControlPropsWithDeserializedValue<string | null>) => {
    return <div><Markdown3Editor
        value={props.deserializedValue || ""}
        onChange={(v) => props.onChange(v)}
        nominalHeight={250}
    /></div>
}

const EventCustomFieldValueValueView_SimpleText = (props: EventCustomFieldValueControlPropsWithDeserializedValueView<string | null>) => {
    return <div>{props.deserializedValue}</div>
}

const EventCustomFieldValueValueEdit_SimpleText = (props: EventCustomFieldValueControlPropsWithDeserializedValue<string | null>) => {
    return <div><CMTextInputBase onChange={(e, v) => props.onChange(v)} value={props.deserializedValue} /></div>
}

const parseCustomFieldValueJson = (json: string | null) => {
    if (json == null) return null;
    try {
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
}

const stringifyCustomFieldValueJson = <T,>(dataType: db3.EventCustomFieldDataType, value: T): string => {
    // all datatypes currently are a straight serialize
    return JSON.stringify(value);
}

const EventCustomFieldValueValueView = (props: EventCustomFieldValueControlProps) => {
    const dataType = props.value.dataType as db3.EventCustomFieldDataType;
    const deserializedValue = parseCustomFieldValueJson(props.value.jsonValue);
    switch (dataType) {
        case db3.EventCustomFieldDataType.Checkbox:
            return <EventCustomFieldValueValueView_Checkbox {...props} deserializedValue={deserializedValue} />;
        case db3.EventCustomFieldDataType.Options:
            return <EventCustomFieldValueValueView_Options {...props} deserializedValue={deserializedValue} />;
        case db3.EventCustomFieldDataType.RichText:
            return <EventCustomFieldValueValueView_RichText {...props} deserializedValue={deserializedValue} />;
        case db3.EventCustomFieldDataType.SimpleText:
            return <EventCustomFieldValueValueView_SimpleText {...props} deserializedValue={deserializedValue} />;
        default:
            return <div>Unknown datatype {dataType}</div>;
    }
};

const EventCustomFieldValueValueEdit = (props: EventCustomFieldValueControlProps) => {
    const dataType = props.value.dataType as db3.EventCustomFieldDataType;
    const deserializedValue = parseCustomFieldValueJson(props.value.jsonValue);
    const handleChange = (val: unknown) => {
        if (props.onChange) {
            const newVal: EventCustomFieldValuePayload = { ...props.value };
            newVal.jsonValue = stringifyCustomFieldValueJson(dataType, val);
            props.onChange(newVal);
        }
    };
    switch (dataType) {
        case db3.EventCustomFieldDataType.Checkbox:
            return <EventCustomFieldValueValueEdit_Checkbox {...props} deserializedValue={deserializedValue} onChange={handleChange} />;
        case db3.EventCustomFieldDataType.Options:
            return <EventCustomFieldValueValueEdit_Options {...props} deserializedValue={deserializedValue} onChange={handleChange} />;
        case db3.EventCustomFieldDataType.RichText:
            return <EventCustomFieldValueValueEdit_RichText {...props} deserializedValue={deserializedValue} onChange={handleChange} />;
        case db3.EventCustomFieldDataType.SimpleText:
            return <EventCustomFieldValueValueEdit_SimpleText {...props} deserializedValue={deserializedValue} onChange={handleChange} />;
        default:
            return <div>Unknown datatype {dataType}</div>;
    }
}

////////////////////////////////////////////////////////////////
const EventCustomFieldValueControl = (props: EventCustomFieldValueControlProps) => {
    const dashboardContext = useDashboardContext();
    const field = dashboardContext.eventCustomField.getById(props.value.customFieldId);
    if (!field) return <div>field not found</div>;

    const usingViewer = (props.readonly || props.mode === 'view');

    return <NameValuePair
        name={<>
            {RenderMuiIcon(field.iconName)}
            <span>{field.name}</span>
        </>}
        description={field.description}
        isReadOnly={props.readonly}
        value={usingViewer ? <EventCustomFieldValueValueView {...props} /> : <EventCustomFieldValueValueEdit {...props} />}
    />;
};

////////////////////////////////////////////////////////////////
interface EventCustomFieldEditDialogProps {
    onClose: () => void,
    onOK: (value: EventCustomFieldValuePayload[]) => void,
    initialValue: EventCustomFieldValuePayload[];
};
const EventCustomFieldEditDialog = (props: EventCustomFieldEditDialogProps) => {
    const dashboardContext = useDashboardContext();
    const [currentValue, setCurrentValue] = React.useState<EventCustomFieldValuePayload[]>(() => {
        return toSorted(props.initialValue, (a, b) => {
            const sorta = dashboardContext.eventCustomField.getById(a.customFieldId)?.sortOrder || 0;
            const sortb = dashboardContext.eventCustomField.getById(b.customFieldId)?.sortOrder || 0;
            return sortb - sorta;
        });
    });

    return <ReactiveInputDialog onCancel={props.onClose}>

        <DialogTitle>
            <SettingMarkdown setting="EventEditCustomFieldValuesDialog_TitleMarkdown" />
            <AdminInspectObject src={props.initialValue} label="initialValue" />
            <AdminInspectObject src={currentValue} label="currentValue" />
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                <SettingMarkdown setting="EventEditCustomFieldValuesDialog_DescriptionMarkdown" />
            </CMDialogContentText>

            {
                currentValue.map(f => <EventCustomFieldValueControl
                    key={f.customFieldId}
                    value={f}
                    mode='edit'
                    readonly={false}
                    onChange={(val) => {
                        const newArray = [...currentValue]; // create new array which excludes this
                        const changedVal = newArray.find(x => x.customFieldId === val.customFieldId)!;
                        // todo: assert all other fields are the same.
                        changedVal.jsonValue = val.jsonValue;
                        setCurrentValue(newArray);
                    }}
                />)
            }

            <DialogActionsCM>
                <Button onClick={() => props.onOK(currentValue)} startIcon={gIconMap.Save()}>OK</Button>
                <Button onClick={props.onClose} startIcon={gIconMap.Cancel()}>Cancel</Button>
            </DialogActionsCM>
        </DialogContent>

    </ReactiveInputDialog>;
}

////////////////////////////////////////////////////////////////
interface EventCustomFieldsControlProps {
    event: Prisma.EventGetPayload<{ include: { customFieldValues: true } }>;
    readonly?: boolean;
    refetch: () => void;
};

export const EventCustomFieldsControl = (props: EventCustomFieldsControlProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const dashboardContext = React.useContext(DashboardContext);
    const snackbar = useSnackbar();

    const authToEdit = dashboardContext.isAuthorized(Permission.manage_events);
    const readonly = !authToEdit || props.readonly;

    const updateMutation = API.events.updateEventCustomFieldValues.useToken();

    const potentialValues = dashboardContext.eventCustomField.map(ecf => {
        const existing = props.event.customFieldValues.find(e => e.customFieldId === ecf.id);
        if (existing) return existing;
        const n = db3.xEventCustomFieldValue.createNew({ mode: 'primary', intention: "user" }) as db3.EventCustomFieldValuePayload;
        n.customField = ecf;
        n.customFieldId = ecf.id;
        n.eventId = props.event.id;
        n.dataType = ecf.dataType;
        //n.isVisible = true;
        return n;
    });

    // if there are no custom fields defined at all, don't show anything.
    if (dashboardContext.eventCustomField.items.length < 1) return null;

    const isJsonNotNullish = (s: string): boolean => {
        try {
            const x = JSON.parse(s);
            return x != null;
        } catch (e) {
            return false;
        }
    };

    return <div className='editCustomFieldsButtonContainer'>
        {!readonly && <Button onClick={() => setOpen(true)}>{gIconMap.Edit()}Edit custom fields</Button>}
        {props.event.customFieldValues
            .filter(v => CoalesceBool(dashboardContext.eventCustomField.getById(v.customFieldId)?.isVisibleOnEventPage, true) && isJsonNotNullish(v.jsonValue))
            .map(v => <EventCustomFieldValueControl key={v.id} value={v} mode='view' />)
        }
        {open && !readonly && <EventCustomFieldEditDialog onClose={() => setOpen(false)} onOK={async (val) => {
            try {
                await updateMutation.invoke({
                    eventId: props.event.id,
                    values: val,
                });
                snackbar.showMessage({ severity: "success", children: "Updated successfully" });
            }
            catch (e) {
                console.log(e);
                snackbar.showMessage({ severity: "error", children: "Error; see console" });
            }
            props.refetch();
            setOpen(false);
        }} initialValue={potentialValues} />}
    </div>;
};





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

            <div className="EventSongListValue">
                {eventResponseTableSpec.renderEditor("isInvited", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}
                {eventResponseTableSpec.renderEditor("instrument", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}

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
                                {eventSegmentResponseTableSpec.renderEditor("attendance", augmentedResponse, validationResult, (n) => handleChangedEventSegmentResponse(segment, n), clientIntention, false)}
                            </div>
                        </div>;
                    })
                }
                {eventResponseTableSpec.renderEditor("userComment", eventResponseValue, eventValidationResult, handleChangedEventResponse, clientIntention, false)}

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
    showCancelledSegments: boolean;
    refetch: () => void;
    readonly: boolean;
};

export const EventAttendanceDetailRow = ({ responseInfo, user, event, refetch, readonly, userMap, showCancelledSegments }: EventAttendanceDetailRowProps) => {
    const currentUser = useCurrentUser()[0]!;
    const dashboardContext = React.useContext(DashboardContext);

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

    return <tr>
        <td>
            <div className={classes.join(" ")}>
                <div className={`name`}>{user.name}</div>
                {isYou && <div className='you'>(you)</div>}
            </div>
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
                        {!!attendance ? <AttendanceChip value={attendance} variation={attendanceVariant} /> : "--"}
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



export const EventDescriptionControl = ({ event, refetch, readonly }: { event: db3.EventPayloadMinimum, refetch: () => void, readonly: boolean }) => {
    const wikiPath = wikiMakeWikiPathFromEventDescription(event);
    return <WikiStandaloneControl
        canonicalWikiPath={wikiPath.canonicalWikiPath}
        readonly={readonly}
        onUpdated={refetch}
        renderCreateButton={(onClick) => <Button onClick={onClick} startIcon={gIconMap.Edit()}>Add information</Button>}
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
            return att && (att.strength < 50)
        }).length,
        goingCount: seg.responses.filter(resp => {
            const att = dashboardContext.eventAttendance.getById(resp.attendanceId);
            return att && (att.strength >= 50)
        }).length
    }));
};

const EventSegmentAttendeeStat = (props: { stat: SegmentResponseStat }) => {
    return <div className='EventSegmentAttendeeStat'>
        <div>{gIconMap.ThumbUp()} {props.stat.goingCount}</div>
        <div>{gIconMap.ThumbDown()} {props.stat.notGoingCount}</div>
    </div>;
};

const GetSegmentAttendeeNames = (copyInstrumentNames: boolean, segmentId: number, eventData: VerboseEventWithMetadata, userMap: db3.UserInstrumentList, dashboardContext: DashboardContextData): string[] => {
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
    userMap: db3.UserInstrumentList;
    readonly: boolean;
    refetch: () => void;
}

export const EventCompletenessTabContent = ({ eventData, userMap, ...props }: EventCompletenessTabContentProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const instVariant: ColorVariationSpec = { enabled: true, selected: false, fillOption: "hollow", variation: 'weak' };
    const event = eventData.event;
    const responseInfo = eventData.responseInfo;

    const [showCancelledSegments, setShowCancelledSegments] = React.useState<boolean>(false);
    const [cancelledSegments, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);
    const showCancelledSegmentsControls = dashboardContext.isAuthorized(Permission.manage_events) && cancelledSegments.length > 0;
    const shownSegments: (typeof event.segments[0])[] = showCancelledSegments ? event.segments : uncancelledSegments;

    const functionalGroupsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention: dashboardContext.userClientIntention,
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
                                            const going = (((att?.strength) || 0) > 50);
                                            const color = going ? att?.color : null;
                                            const style = GetStyleVariablesForColor({ color, ...StandardVariationSpec.Strong });
                                            return <Tooltip disableInteractive key={resp.response.id} title={`${resp.user.name}: ${att?.text || "no response"}`}>
                                                <div className={`attendanceResponseColorBarSegment applyColor ${style.cssClass} ${((att?.strength) || 0) > 50 ? "going" : "notgoing"}`} style={style.style}>
                                                    {/* {resp.user.name.substring(0, 1).toLocaleUpperCase()} */}
                                                    {resp.user.name}
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

const EventDotMenu = ({ event, showVisibility }: { event: db3.EventPayloadMinimum, showVisibility: boolean }) => {
    const endMenuItemRef = React.useRef<() => void>(() => { });
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();

    const uriForThisEvent = dashboardContext.currentUser && GetICalRelativeURIForUserAndEvent({
        userAccessToken: dashboardContext.currentUser?.accessToken || null,
        eventUid: event.uid,
        userUid: dashboardContext.currentUser.uid,
    });
    const uriForGlobalCalendar = dashboardContext.currentUser && getAbsoluteUrl(GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: dashboardContext.currentUser!.accessToken }));

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
            const uri = API.events.getURIForEvent(event);
            await navigator.clipboard.writeText(uri);
            closeMenu();
            snackbar.showSuccess("Link address copied");
        }}>
            <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
            Copy event link to clipboard
        </MenuItem>

        <Divider />

        {uriForThisEvent &&
            <MenuItem onClick={async () => {
                await navigator.clipboard.writeText(uriForThisEvent);
                closeMenu();
                snackbar.showSuccess("Link address copied");
            }}>
                <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                This event: Copy Calendar link
            </MenuItem>
        }
        {uriForThisEvent &&

            <MenuItem component={Link} href={uriForThisEvent} target="_blank" rel="noreferrer" onClick={closeMenu}>
                <ListItemIcon>{gIconMap.CalendarMonth()}</ListItemIcon>
                This event: iCal import
            </MenuItem>
        }

        <Divider />

        {uriForGlobalCalendar &&
            <MenuItem onClick={async () => {
                await navigator.clipboard.writeText(uriForGlobalCalendar);
                closeMenu();
                snackbar.showSuccess("Link address copied");
            }}>
                <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                Global event calendar: Copy Calendar link
            </MenuItem>
        }
        {uriForGlobalCalendar &&
            <MenuItem component={Link} href={uriForGlobalCalendar} target='_blank' rel="noreferrer" onClick={closeMenu}>
                <ListItemIcon>{gIconMap.CalendarMonth()}</ListItemIcon>
                Global event calendar: iCal import
            </MenuItem>
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
    "workflow": "workflow",
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
    const dashboardContext = React.useContext(DashboardContext);
    const isShowingAdminControls = API.other.useIsShowingAdminControls();
    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusId || [];
    const highlightTypeIds = props.highlightTypeId || [];

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
                    getTooltip={_ => eventData.event.status?.description || null}
                />}

            </CMChipContainer>

            <div className='flex-spacer'></div>

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

            <EventDotMenu event={eventData.event} showVisibility={!!showVisibility} />
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
    workflowRefreshTrigger: number;
    refetch: () => void;
};

type EventDetailFullTabAreaProps = EventDetailFullProps & {
    selectedTab: string;
    setSelectedTab: (v: string) => void;
    eventData: VerboseEventWithMetadata;
    userMap: db3.UserInstrumentList;
};

export const EventDetailFullTab2Area = ({ eventData, refetch, selectedTab, event, tableClient, userMap, ...props }: EventDetailFullTabAreaProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const handleTabChange = (_: undefined | React.SyntheticEvent, newValue: string) => {
        props.setSelectedTab(newValue);
    };

    const [_, uncancelledSegments] = dashboardContext.partitionEventSegmentsByCancellation(event.segments);

    const segmentResponseCounts = !eventData.responseInfo ? [] : uncancelledSegments.map(seg => {
        return eventData.responseInfo!.getResponsesForSegment(seg.id).reduce((acc, resp) => {
            const att = dashboardContext.eventAttendance.getById(resp.response.attendanceId);
            return acc + ((((att?.strength || 0) > 50) ? 1 : 0))
        }, 0);
    });
    const segmentResponseCountStr = segmentResponseCounts.length > 0 ? `(${segmentResponseCounts.join(" - ")})` : "";

    const enrichedFiles = eventData.event.fileTags.map(ft => {
        return {
            ...ft,
            file: db3.enrichFile(ft.file, dashboardContext),
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
            <div className='descriptionLine'>
                <Suspense>
                    <EventCustomFieldsControl event={event} readonly={props.readonly} refetch={refetch} />
                </Suspense>
                <EventDescriptionControl event={event} refetch={refetch} readonly={props.readonly} />
            </div>
        </CMTab>

        <CMTab
            enabled={!!event.workflowDefId}
            summaryIcon={<Checklist />}
            summaryTitle="Checklist"
            thisTabId={gEventDetailTabSlugIndices.workflow}
        >
            <EventWorkflowTabContent event={event} tableClient={tableClient} readonly={props.readonly} refetch={refetch} refreshTrigger={props.workflowRefreshTrigger} />
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.setlists}
            canBeDefault={!!event.songLists.length}
            summaryIcon={gIconMap.LibraryMusic()}
            summaryTitle="Setlists"
            summarySubtitle={<>({event.songLists.length})</>}
        >
            <EventSongListTabContent event={event} tableClient={tableClient} readonly={props.readonly} refetch={refetch} />
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.completeness}
            summaryIcon={gIconMap.Trumpet()}
            summaryTitle="by instrument"
        >
            <SettingMarkdown setting='EventCompletenessTabMarkdown' />
            <EventCompletenessTabContent eventData={eventData} userMap={userMap} readonly={props.readonly} refetch={refetch} />
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.attendance}
            summaryIcon={gIconMap.ThumbUp()}
            summaryTitle="Responses"
            summarySubtitle={segmentResponseCountStr}
        >
            <SettingMarkdown setting='EventAttendanceDetailMarkdown' />
            <EventAttendanceDetail eventData={eventData} tableClient={tableClient} refetch={refetch} readonly={props.readonly} userMap={userMap} />
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.frontpage}
            summaryIcon={gIconMap.Public()}
            summaryTitle="Frontpage"
            summarySubtitle={<>{eventData.event.frontpageVisible && gCharMap.Checkmark()}</>}
        >
            <EventFrontpageTabContent event={event} refetch={refetch} readonly={props.readonly} />
        </CMTab>

        <CMTab
            thisTabId={gEventDetailTabSlugIndices.files}
            canBeDefault={!!event.fileTags.length}
            summaryIcon={gIconMap.AttachFile()}
            summaryTitle="Files"
            summarySubtitle={<>({event.fileTags.length})</>}
        >
            <FilesTabContent
                fileTags={enrichedFiles}
                uploadTags={{
                    taggedEventId: event.id,
                }}
                refetch={refetch}
                readonly={props.readonly}
                contextEventId={event.id}
            />
        </CMTab>
    </CMTabPanel>
};




export const EventDetailFull = ({ event, tableClient, ...props }: EventDetailFullProps) => {

    const [selectedTab, setSelectedTab] = React.useState<string>(props.initialTabIndex || ((IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && (event.songLists?.length > 0)) ? gEventDetailTabSlugIndices.setlists : gEventDetailTabSlugIndices.info));
    const tabSlug = selectedTab;//Object.keys(gEventDetailTabSlugIndices)[selectedTab];
    const router = useRouter();
    const dashboardContext = React.useContext(DashboardContext);

    const { eventData, userMap } = CalculateEventMetadata_Verbose({ event, tabSlug, dashboardContext });


    React.useEffect(() => {
        void router.replace(eventData.eventURI, undefined, { shallow: true });// unfortunately this causes annoyances with scrolling.
    }, [eventData.eventURI]);

    //const refetch = tableClient.refetch;

    return <EventDetailContainer eventData={eventData} readonly={props.readonly} tableClient={tableClient} fadePastEvents={false} showVisibility={true} refetch={props.refetch}>
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
    const dashboardContext = React.useContext(DashboardContext);
    const event = db3.enrichSearchResultEvent(props.event, dashboardContext);

    const highlightTagIds = props.highlightTagIds || [];
    const highlightStatusIds = props.highlightStatusIds || [];
    const highlightTypeIds = props.highlightTypeIds || [];

    const eventURI = API.events.getURIForEvent(event);
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

            {!reducedInfo &&
                <EventDotMenu event={event} showVisibility={false} />}
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

    </div>;
};

export interface EventListItemProps {
    event: db3.EnrichedSearchEventPayload;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec?: EventsFilterSpec; // for highlighting matching fields
    showTabs?: boolean;
    showAttendanceControl?: boolean;
    reducedInfo?: boolean; // show less info, like in the event list.
};

export const EventListItem = ({ showTabs = false, showAttendanceControl = true, reducedInfo = false, event, ...props }: EventListItemProps) => {

    const { eventData, userMap } = CalculateEventSearchResultsMetadata({ event, results: props.results });

    return <EventSearchItemContainer
        event={event}
        highlightTagIds={props.filterSpec ? props.filterSpec.tagFilter.options as number[] : []}
        highlightStatusIds={props.filterSpec ? props.filterSpec.statusFilter.options as number[] : []}
        highlightTypeIds={props.filterSpec ? props.filterSpec.typeFilter.options as number[] : []}
        reducedInfo={reducedInfo}
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
                    uri={API.events.getURIForEvent(event, gEventDetailTabSlugIndices.info)}
                />
                }
                {event.songLists.length > 0 && <SearchItemBigCardLink
                    icon={<LibraryMusic />}
                    title="View setlist"
                    uri={API.events.getURIForEvent(event, gEventDetailTabSlugIndices.setlists)}
                />
                }
            </div>
        }
    </EventSearchItemContainer>;
};

