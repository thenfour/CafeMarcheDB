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
  instrument    [edit]
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
  instrument    [edit]
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
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { Alert, Button, ButtonGroup, Tooltip, Typography } from "@mui/material";
import React, { Suspense } from "react";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { CMBigChip } from './CMCoreComponents';
import { GetStyleVariablesForColor } from './Color';
import { Markdown } from './RichTextEditor';
import { CompactMutationMarkdownControl } from './SettingMarkdown';
import { StandardVariationSpec } from 'shared/color';


// ////////////////////////////////////////////////////////////////
// // a view/edit control for the comment only (including mutation)
// interface EventAttendanceCommentControlProps {
//     userResponse: db3.EventSegmentUserResponse,
//     //event: db3.EventPayloadClient,
//     //segmentInfo: db3.SegmentAndResponse,
//     //eventUserInfo: db3.EventInfoForUser,
//     onRefetch: () => void,
// };

// const EventAttendanceCommentControl = (props: EventAttendanceCommentControlProps) => {
//     const token = API.events.updateUserEventAttendance.useToken();
//     return <CompactMutationMarkdownControl initialValue={props.userResponse.response.attendanceComment} refetch={props.onRefetch} onChange={async (value) => {
//         return await token.invoke({
//             userId: props.userResponse.user.id,
//             eventId: props.userResponse.segment.eventId,
//             comment: value,
//         });
//     }} />;
// };



// ////////////////////////////////////////////////////////////////
// // event segment attendance standalone field (read-only possible, buttons array for input).
// // basically a button array of responses, not tied to DB but just a value.
// interface EventAttendanceResponseControlProps {
//     value: db3.EventAttendanceBasePayload | null;
//     onChange: (value: db3.EventAttendanceBasePayload | null) => void;
//     showClose: boolean,
//     onClose: () => void,
// };



// const EventAttendanceResponseControlMeat = (props: EventAttendanceResponseControlProps) => {

//     const optionsClient = DB3Client.useTableRenderContext({
//         requestedCaps: DB3Client.xTableClientCaps.Query,
//         clientIntention: { intention: 'user', mode: 'primary' },
//         tableSpec: new DB3Client.xTableClientSpec({
//             table: db3.xEventAttendance,
//             columns: [
//                 new DB3Client.PKColumnClient({ columnName: "id" }),
//             ],
//         }),
//     });

//     //const nullSelStyle = (!props.value) ? "selected" : "notSelected";
//     return <>{(optionsClient.items as db3.EventAttendancePayload[]).map(option => {
//         const style = GetStyleVariablesForColor({ color: option.color, ...StandardVariationSpec.Strong });
//         const selStyle = (!!props.value && (option.id === props.value.id)) ? "selected" : "notSelected";
//         const yesNoStyle = (option.strength > 50) ? "yes" : "no";
//         return <Button
//             key={option.id}
//             style={style}
//             endIcon={(option.strength > 50) ? <ThumbUpIcon /> : <ThumbDownIcon />}
//             className={`${yesNoStyle} applyColor ${selStyle}`}
//             onClick={() => { props.onChange(option); }}
//         >
//             {option.text}
//         </Button>;
//     })}</>;
// };

// const EventAttendanceResponseControl = (props: EventAttendanceResponseControlProps) => {
//     const nullSelStyle = (!props.value) ? "selected" : "notSelected";
//     return <>
//         <ButtonGroup className='EventAttendanceResponseControlButtonGroup'>
//             <Suspense>
//                 <EventAttendanceResponseControlMeat {...props} />
//             </Suspense>

//             <Button className={`null noSelection ${nullSelStyle}`} onClick={() => { props.onChange(null); }}>no answer</Button>

//         </ButtonGroup>

//         {props.showClose && <Button onClick={() => { props.onClose() }}>
//             <Tooltip title="hide these buttons" >
//                 <CloseIcon />
//             </Tooltip>
//         </Button>}
//     </>;
// };



// ////////////////////////////////////////////////////////////////
// // event segment attendance standalone field (read-only possible, buttons array for input).
// // basically a button array of responses, not tied to DB but just a value.
// interface EventAttendanceInstrumentControlProps {
//     selectedInstrumentId: number | null;
//     onChange: (value: db3.InstrumentPayload | null) => void;
//     user: db3.UserWithInstrumentsPayload;
// };

// const EventAttendanceInstrumentControl = (props: EventAttendanceInstrumentControlProps) => {

//     return <div className='EventAttendanceInstrumentControlContainer'>
//         <ButtonGroup className='EventAttendanceInstrumentControl'>
//             {props.user.instruments.map(assoc => {
//                 const style = GetStyleVariablesForColor({ color: assoc.instrument.functionalGroup.color, ...StandardVariationSpec.Strong });
//                 const selStyle = (props.selectedInstrumentId == assoc.instrumentId) ? "selected" : "notSelected";
//                 return <Button
//                     key={assoc.id}
//                     style={style}
//                     className={`applyColor ${selStyle}`}
//                     onClick={() => { props.onChange(assoc.instrument); }}
//                 >
//                     {assoc.instrument.name}
//                 </Button>;
//             })}
//         </ButtonGroup>
//     </div>;
// };




// ////////////////////////////////////////////////////////////////
// // read-only answer + comment, with optional "edit" button
// export interface EventAttendanceAnswerProps {
//     //event: db3.EventPayloadClient,
//     userResponse: db3.EventSegmentUserResponse,
//     //segmentInfo: db3.SegmentAndResponse,
//     //eventUserInfo: db3.EventInfoForUser,
//     readOnly: boolean,
//     onEditClicked?: () => void,
// };

// export const EventAttendanceAnswer = (props: EventAttendanceAnswerProps) => {
//     return <CMBigChip color={props.userResponse.response.attendance?.color} variation={StandardVariationSpec.Strong}>
//         <ThumbUpIcon className="icon" />
//         <span className="text">{props.userResponse.response.attendance?.personalText}</span>
//         {!props.readOnly && <Button onClick={() => { props.onEditClicked && props.onEditClicked() }}>
//             <EditIcon />
//         </Button>}
//         {
//             props.userResponse.user.instruments.length > 1 &&
//             <div className='instrument'>{props.userResponse.instrument!.name}</div>
//         }
//         <div className='userComment'>
//             <Markdown markdown={props.userResponse.response.attendanceComment} />
//         </div>
//     </CMBigChip>;
// };


// ////////////////////////////////////////////////////////////////
// // frame for event segment
// // input controls for attendance + comment
// export interface EventAttendanceEditControlProps {
//     // event: db3.EventPayloadClient,
//     // segmentInfo: db3.SegmentAndResponse,
//     // eventUserInfo: db3.EventInfoForUser,
//     userResponse: db3.EventSegmentUserResponse,

//     onRefetch: () => void,
//     showClose: boolean,
//     onClose: () => void,
// };

// export const EventAttendanceEditControl = (props: EventAttendanceEditControlProps) => {
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
//     const token = API.events.updateUserEventSegmentAttendance.useToken();

//     const handleOnChange = async (value: db3.EventAttendanceBasePayload | null) => {
//         try {
//             await API.events.updateUserEventSegmentAttendance.invoke(token, {
//                 userId: props.userResponse.user.id,
//                 eventSegmentIds: [props.userResponse.segment.id],
//                 attendanceId: value == null ? null : value.id,
//             });
//             showSnackbar({ severity: 'success', children: "update successful" });
//             props.onRefetch();
//         } catch (e) {
//             console.log(e);
//             showSnackbar({ severity: 'error', children: "error;  see console" });
//         }
//     };

//     const handleInstrumentChange = async (value: db3.InstrumentPayload) => {
//         try {
//             await API.events.updateUserEventSegmentAttendance.invoke(token, {
//                 userId: props.userResponse.user.id,
//                 eventSegmentIds: [props.userResponse.segment.id],
//                 instrumentId: value.id,
//             });
//             showSnackbar({ severity: 'success', children: "update instrument successful" });
//             props.onRefetch();
//         } catch (e) {
//             console.log(e);
//             showSnackbar({ severity: 'error', children: "error;  see console" });
//         }
//     };

//     return <>
//         <EventAttendanceResponseControl
//             value={props.userResponse.response.attendance}
//             onChange={handleOnChange}
//             showClose={props.showClose}
//             onClose={props.onClose}
//         />
//         <EventAttendanceInstrumentControl
//             onChange={handleInstrumentChange}
//             selectedInstrumentId={props.userResponse.instrument?.id || null}
//             user={props.userResponse.user}
//         />
//         <EventAttendanceCommentControl userResponse={props.userResponse} onRefetch={props.onRefetch} />
//     </>;

// };

// ////////////////////////////////////////////////////////////////
// // frame for event segment:
// // shows your answer & comment, small button to show edit controls.
// export interface EventAttendanceFrameProps {
//     // event: db3.EventPayloadClient,
//     // segmentInfo: db3.SegmentAndResponse,
//     // eventUserInfo: db3.EventInfoForUser,
//     userResponse: db3.EventSegmentUserResponse;
//     onRefetch: () => void,
// };

// export const EventAttendanceFrame = (props: EventAttendanceFrameProps) => {
//     const [explicitEdit, setExplicitEdit] = React.useState<boolean>(false);
//     // const hasResponse = !!props.segmentInfo.response.attendance;
//     // const expectResponse = true;//props.segmentInfo.response.expectAttendance;
//     // alert mode effectively forces edit mode, regardless of explicit edit. so don't show the hide button in alert state because it would do nothing.
//     //const alert = expectResponse && !hasResponse;
//     const editMode = (explicitEdit || props.userResponse.isAlert);

//     return <div className={`segment ${props.userResponse.isAlert && "alert"}`}>
//         <div className='header'>
//             {props.userResponse.isAlert && <ErrorOutlineIcon className='icon' />}
//             <div className="segmentName">{API.events.getEventSegmentFormattedDateRange(props.userResponse.segment)}</div>
//             <div className=''>{props.userResponse.segment.name}</div>
//             {editMode && <div className="prompt">Are you going?</div>}
//         </div>
//         {editMode ?
//             <EventAttendanceEditControl
//                 userResponse={props.userResponse}
//                 // event={props.event}
//                 // segmentInfo={props.segmentInfo}
//                 // eventUserInfo={props.eventUserInfo}
//                 onRefetch={props.onRefetch}
//                 showClose={true && !alert} // alert forces edit mode; don't allow hiding then
//                 onClose={() => { setExplicitEdit(false) }}
//             /> :
//             <EventAttendanceAnswer
//                 userResponse={props.userResponse}
//                 readOnly={false}
//                 // event={props.event}
//                 // segmentInfo={props.segmentInfo}
//                 // eventUserInfo={props.eventUserInfo}
//                 onEditClicked={() => { setExplicitEdit(true); }}
//             />
//         }
//     </div>;

// };

// ////////////////////////////////////////////////////////////////
// // frame for event:
// // big attendance alert (per event, multiple segments)
// export interface EventAttendanceAlertControlProps {
//     event: db3.EventClientPayload_Verbose,
//     responseInfo: db3.EventResponseInfo;
//     onRefetch: () => void,
// };

// export const EventAttendanceAlertControl = (props: EventAttendanceAlertControlProps) => {
//     // there are many scenarios yet to deal with and bugs currently
//     // - events in the past should say "did you go" rather than "will you go"
//     // - future events are far more critical than past events. mayeb just don't show past events?
//     // - i think when you explicitly set "No answer" it doesn't highlight buttons like it should
//     const user = useCurrentUser()[0]!;
//     const responses = props.responseInfo.getResponsesBySegmentForUser(user);
//     //const eventInfo = API.events.getEventInfoForUser({ event: props.event, user });

//     return <Alert severity="error" className='cmalert attendanceAlert'>
//         {/* <InspectObject src={eventInfo} /> */}
//         <Typography variant='h5'>Are you coming to <a href={API.events.getURIForEvent(props.event)}>{props.event.name}</a>?</Typography>
//         <div className="attendanceResponseInput">
//             <div className="segmentList">
//                 {responses.map(segment => {
//                     //const segInfo = eventInfo.getSegmentUserInfo(segment.id);
//                     return <EventAttendanceFrame key={segment.id} onRefetch={props.onRefetch} segmentInfo={segInfo} eventUserInfo={eventInfo} event={props.event} />;
//                 })}
//             </div>
//         </div>
//     </Alert>;
// };



// ////////////////////////////////////////////////////////////////
// export interface EventAttendanceSummaryProps {
//     event: db3.EventClientPayload_Verbose,
//     responseInfo: db3.EventResponseInfo;
// };

// export const EventAttendanceSummary = (props: EventAttendanceSummaryProps) => {
//     const user = useCurrentUser()[0]!;

//     return <div className='CMEventAttendanceSummary bigChipContainer'>
//         {
//             props.event.segments.map((segment) => {
//                 return <EventAttendanceAnswer
//                     key={segment.id}
//                     readOnly={true}
//                     userResponse={}
//                     //event={props.event}
//                     //segmentInfo={seg}
//                     //eventUserInfo={eventInfo}
//                     onEditClicked={() => { }}
//                 />;
//             })
//         }
//     </div>;
// };



