/*
better terminology would make things clearer. ideally,
"answer" is just the yes/no/etc portion of your response
"comment" is just the comment
"response" or "attendance" or "attendanceResponse" refers to the combination attendance + comment

"frame" or "chip" will put a frame. otherwise it's a standalone embeddable component
-----------------------------------------------------------------------------------------------------------------------------

EventAttendanceAnswer
  big chip answer + optional edit button
  read-only companion to EventAttendanceEditControl
  you are going [edit]
  comment       [edit]


EventAttendanceCommentControl [internal, used by EventAttendanceEditControl]
  Just the field for showing or editing comment
  comment       [edit]


EventAttendanceResponseControl [internal, used by EventAttendanceEditControl]
  button array for generic event segment response
  [ yes ][ maybe ][ no ][ no answer ]


EventAttendanceEditControl
    the editable version of a complete response
    EventAttendanceResponseControl + EventAttendanceCommentControl
  [ yes ][ maybe ][ no ][ no answer ]
  comment       [edit]


EventAttendanceFrame
  per segment
  frame + editMode EventAttendanceEditControl or EventAttendanceAnswer
  direct child of alert control
  .---------------------------------------------------------.
  | Set 1 from  12:00 - 14:00                               |
  | you are going [edit]                                    | <EventAttendanceAnswer>
  | comment       [edit]                                    | 
  `---------------------------------------------------------`
  or,
  .---------------------------------------------------------.
  | Set 1 from  12:00 - 14:00                               |
  | <EventAttendanceEditControl> or <EventAttendanceAnswer> |
  `---------------------------------------------------------`


EventAttendanceAlertControl
  big alert for an event with edit controls for all segments.
  .--------------------------------.
  | Are you going to xyz?          |
  | <EventAttendanceFrame>       |
  | <EventAttendanceFrame>       |
  `--------------------------------`

  
EventAttendanceSummary
  per event, an array of <BigChip> showing a response + comment (EventAttendanceAnswer). used by noninteractivecard


*/


// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import {
    Edit as EditIcon
} from '@mui/icons-material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PlaceIcon from '@mui/icons-material/Place';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Alert, Breadcrumbs, Button, ButtonGroup, Card, CardActionArea, Chip, Link, TextField, Tooltip, Typography } from "@mui/material";
import React, { FC, Suspense } from "react"
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { CompactMutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { ColorPaletteEntry, gGeneralPaletteList } from 'shared/color';
import { ColorVariationOptions, GetStyleVariablesForColor } from './Color';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { TAnyModel } from 'shared/utils';
import { RenderMuiIcon } from '../db3/components/IconSelectDialog';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { API } from '../db3/clientAPI';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { CMTextField } from './CMTextField';
import { CompactMarkdownControl, Markdown, MarkdownControl } from './RichTextEditor';
import { CMBigChip, CMTagList } from './CMCoreComponents';
import HomeIcon from '@mui/icons-material/Home';

////////////////////////////////////////////////////////////////
// a view/edit control for the comment only (including mutation)
interface EventAttendanceCommentControlProps {
    event: db3.EventPayloadClient,
    segmentInfo: db3.SegmentAndResponse,
    eventUserInfo: db3.EventInfoForUser,
    onRefetch: () => void,
};

const EventAttendanceCommentControl = (props: EventAttendanceCommentControlProps) => {
    const token = API.events.updateUserEventSegmentAttendanceComment.useToken();
    return <CompactMutationMarkdownControl initialValue={props.segmentInfo.response.attendanceComment} refetch={props.onRefetch} onChange={async (value) => {
        return await API.events.updateUserEventSegmentAttendanceComment.invoke(token, {
            userId: props.eventUserInfo.user.id,
            eventSegmentId: props.segmentInfo.segment.id,
            comment: value,
        });
    }} />;
};



////////////////////////////////////////////////////////////////
// event segment attendance standalone field (read-only possible, buttons array for input).
// basically a button array of responses, not tied to DB but just a value.
interface EventAttendanceResponseControlProps {
    value: db3.EventAttendanceBasePayload | null;
    onChange: (value: db3.EventAttendanceBasePayload | null) => void;
    showClose: boolean,
    onClose: () => void,
};

const EventAttendanceResponseControl = (props: EventAttendanceResponseControlProps) => {
    const options = API.events.useGetEventAttendanceOptions({});
    const nullSelStyle = (!props.value) ? "selected" : "notSelected";
    return <>
        <ButtonGroup className='EventAttendanceResponseControlButtonGroup'>
            {options.items.map(option => {
                const style = GetStyleVariablesForColor(option.color);
                const selStyle = (!!props.value && (option.id === props.value.id)) ? "selected" : "notSelected";
                const yesNoStyle = (option.strength > 50) ? "yes" : "no";
                return <Button
                    key={option.id}
                    style={style}
                    endIcon={(option.strength > 50) ? <ThumbUpIcon /> : <ThumbDownIcon />}
                    className={`${yesNoStyle} applyColor-strong-noBorder ${selStyle}`}
                    onClick={() => { props.onChange(option); }}
                >
                    {option.text}
                </Button>;
            })}

            <Button className={`null noSelection ${nullSelStyle}`} onClick={() => { props.onChange(null); }}>no answer</Button>

        </ButtonGroup>

        {props.showClose && <Button onClick={() => { props.onClose() }}>
            <Tooltip title="hide these buttons" >
                <CloseIcon />
            </Tooltip>
        </Button>}
    </>;
};




////////////////////////////////////////////////////////////////
// read-only answer + comment, with optional "edit" button
export interface EventAttendanceAnswerProps {
    event: db3.EventPayloadClient,
    segmentInfo: db3.SegmentAndResponse,
    eventUserInfo: db3.EventInfoForUser,
    readOnly: boolean,
    onEditClicked?: () => void,
};

export const EventAttendanceAnswer = (props: EventAttendanceAnswerProps) => {
    return <CMBigChip color={props.segmentInfo.response.attendance!.color} variant='strong'>
        <ThumbUpIcon className="icon" />
        <span className="text">{props.segmentInfo.response.attendance?.personalText}</span>
        {!props.readOnly && <Button onClick={() => { props.onEditClicked && props.onEditClicked() }}>
            <EditIcon />
        </Button>}
        <div className='userComment'>
            <Markdown markdown={props.segmentInfo.response.attendanceComment} />
        </div>
    </CMBigChip>;
};


////////////////////////////////////////////////////////////////
// frame for event segment
// input controls for attendance + comment
export interface EventAttendanceEditControlProps {
    event: db3.EventPayloadClient,
    segmentInfo: db3.SegmentAndResponse,
    eventUserInfo: db3.EventInfoForUser,

    onRefetch: () => void,
    showClose: boolean,
    onClose: () => void,
};

export const EventAttendanceEditControl = (props: EventAttendanceEditControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const token = API.events.updateUserEventSegmentAttendance.useToken();

    const handleOnChange = async (value: db3.EventAttendanceBasePayload | null) => {
        try {
            await API.events.updateUserEventSegmentAttendance.invoke(token, {
                userId: props.eventUserInfo.user.id,
                eventSegmentId: props.segmentInfo.segment.id,
                attendanceId: value == null ? null : value.id,
            });
            showSnackbar({ severity: 'success', children: "update successful - todo: refetch" });
            props.onRefetch();
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: 'error', children: "error;  see console" });
        }
    };

    return <>
        <EventAttendanceResponseControl
            value={props.segmentInfo.response.attendance}
            onChange={handleOnChange}
            showClose={props.showClose}
            onClose={props.onClose}
        />
        <EventAttendanceCommentControl segmentInfo={props.segmentInfo} eventUserInfo={props.eventUserInfo} event={props.event} onRefetch={props.onRefetch} />
    </>;

};

////////////////////////////////////////////////////////////////
// frame for event segment:
// shows your answer & comment, small button to show edit controls.
export interface EventAttendanceFrameProps {
    event: db3.EventPayloadClient,
    segmentInfo: db3.SegmentAndResponse,
    eventUserInfo: db3.EventInfoForUser,
    onRefetch: () => void,
};

export const EventAttendanceFrame = (props: EventAttendanceFrameProps) => {
    const [explicitEdit, setExplicitEdit] = React.useState<boolean>(false);
    const hasResponse = !!props.segmentInfo.response.attendance;
    const expectResponse = true;//props.segmentInfo.response.expectAttendance;
    // alert mode effectively forces edit mode, regardless of explicit edit. so don't show the hide button in alert state because it would do nothing.
    const alert = expectResponse && !hasResponse;
    const editMode = (explicitEdit || alert);

    return <div className={`segment ${alert && "alert"}`}>
        <div className='header'>
            {alert && <ErrorOutlineIcon className='icon' />}
            <div className="segmentName">{API.events.getEventSegmentFormattedDateRange(props.segmentInfo.segment)}</div>
            {editMode && <div className="prompt">Are you going?</div>}
        </div>
        {editMode ?
            <EventAttendanceEditControl
                event={props.event}
                segmentInfo={props.segmentInfo}
                eventUserInfo={props.eventUserInfo}
                onRefetch={props.onRefetch}
                showClose={true && !alert} // alert forces edit mode; don't allow hiding then
                onClose={() => { setExplicitEdit(false) }}
            /> :
            <EventAttendanceAnswer
                event={props.event}
                segmentInfo={props.segmentInfo}
                eventUserInfo={props.eventUserInfo}
                onEditClicked={() => { setExplicitEdit(true); }}
            />
        }
    </div>;

};

////////////////////////////////////////////////////////////////
// frame for event:
// big attendance alert (per event, multiple segments)
export interface EventAttendanceAlertControlProps {
    event: db3.EventPayloadClient,
    onRefetch: () => void,
};

export const EventAttendanceAlertControl = (props: EventAttendanceAlertControlProps) => {
    const [user] = useCurrentUser()!;
    const eventInfo = API.events.getEventInfoForUser({ event: props.event, user });
    return <Alert severity="error" className='cmalert attendanceAlert'>
        <Typography variant='h5'>Are you coming to <a href={API.events.getURIForEvent(eventInfo.event)}>{props.event.name}</a>?</Typography>
        <div className="attendanceResponseInput">
            <div className="segmentList">
                {props.event.segments.map(segment => {
                    const segInfo = eventInfo.getSegmentUserInfo(segment.id);
                    return <EventAttendanceFrame key={segment.id} onRefetch={props.onRefetch} segmentInfo={segInfo} eventUserInfo={eventInfo} event={props.event} />;
                })}
            </div>
        </div>
    </Alert>;


};



////////////////////////////////////////////////////////////////
export interface EventAttendanceSummaryProps {
    event: db3.EventPayloadClient,
};

export const EventAttendanceSummary = (props: EventAttendanceSummaryProps) => {
    const [user] = useCurrentUser()!;
    console.assert(!!user);

    const eventInfo = new db3.EventInfoForUser({ event: props.event, user });
    console.assert(!!eventInfo.segments);

    return <div className='CMEventAttendanceSummary bigChipContainer'>
        {
            eventInfo.segments.map((seg, index) => {

                return <EventAttendanceAnswer
                    readOnly={true}
                    event={props.event}
                    segmentInfo={seg}
                    eventUserInfo={eventInfo}
                    onEditClicked={() => { }}
                />;
            })
        }
    </div>;
};



