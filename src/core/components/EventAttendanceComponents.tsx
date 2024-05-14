/*
The logic that controls how this thing is displayed is actually somewhat complex because there are a lot of
factors and it's very optimized ux. So it's not sufficient to have a bunch of floating logic everywhere; it needs to be organized.
for example,
- are you invited?
- is it in the past?
- did you already answer all segments? any segments? no segments?
- are any answers affirmative? (to show instrument selection)
- is it single-segment? 0 segments? multi-segment?

VIEW FLAGS:
- alert?

EVENT MODES:
- read-only
- alert
- compact/expanded view, instrument & all segments are on single-line. clicking elements enters expanded + edit mode.

------------------------------------


better terminology makes things clearer. ideally stick to:
"answer" is just the yes/no/etc portion of your response
"comment" is just the comment
"response" or "attendance" or "attendanceResponse" refers to the combination attendance + comment + instrument

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
EventAttendanceAnswer
  big chip answer + optional edit button
  read-only companion to EventAttendanceEditControl
  you are going [edit]
  instrument    [edit]


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
EventAttendanceCommentControl [internal, used by EventAttendanceEditControl]
  Just the field for showing or editing comment
  comment       [edit]


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
EventAttendanceResponseControl [internal, used by EventAttendanceEditControl]
  button array for generic event segment response
  [ yes ][ maybe ][ no ][ no answer ]


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
EventAttendanceEditControl
    the editable version of a complete response
    EventAttendanceResponseControl + EventAttendanceCommentControl
  [ yes ][ maybe ][ no ][ no answer ]
  instrument    [edit]
  comment       [edit]


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EventAttendanceSegmentControl

  editMode EventAttendanceEditControl or EventAttendanceAnswer
  direct child of alert control

  answered:
  .---------------------------------------------------------.
  | Set 1 (12:00 - 14:00)                                   |
  | You are going! [change]                                 |
  |   [Bass guitar] [flute] [trombone] [change]             |  <-- default instrument is selected by default
  `---------------------------------------------------------`

  unanswered:
  .---------------------------------------------------------.
  | Set 1 (12:00 - 14:00)                                   |
  | [no][nomaybe][yesmaybe][yes]             |
  `---------------------------------------------------------`

  (iow,)
  .---------------------------------------------------------.
  | Set 1 (12:00 - 14:00)                                   |
  | <EventAttendanceAnswerControl>                          |
  | <EventAttendanceInstrumentControl>                      |
  `---------------------------------------------------------`

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EventAttendanceControl

  big alert for an event with edit controls for all segments.

  * low-profile mode if no activity is needed (already answered)
  * invisible if not invited or otherwise no attendance is relevant
  * if in the past AND no responses, invisible. for the sake of simplicity and clutter
  .-----------------------------------------.
  | Are you going to xyz?                   | <-- if ANY are unanswered
  |   [ comment...           ] [change]     |
  | <EventAttendanceSegmentControl>         |
  | <EventAttendanceSegmentControl>         |
  | <EventAttendanceSegmentControl>         |
  `-----------------------------------------`

  | You're going to xyz!             | <-- if all are answered going
  
  | You're partially going to xyz!   | <-- if ANY are answered going

  | You're missing xyz :(            | <-- if all are answered not going


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
EventAttendanceSummary (obsolete?)
  per event, an array of <BigChip> showing a response + comment (EventAttendanceAnswer). used by noninteractivecard


*/


// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import React from "react";
import { Timing } from 'shared/time';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { AdminInspectObject, CMChip, CMChipContainer, ReactiveInputDialog } from './CMCoreComponents';
import { CMSmallButton, DebugCollapsibleAdminText, DebugCollapsibleText, NameValuePair } from "./CMCoreComponents2";
import { EventWithMetadata } from "./EventComponentsBase";
//import { CompactMutationMarkdownControl } from './SettingMarkdown';
import { DashboardContext } from "./DashboardContext";
import { ArrayElement, CoalesceBool } from "shared/utils";
import { Prisma } from "db";
import { Markdown } from "./RichTextEditor";
import { Markdown3Editor } from "./MarkdownControl3";
import { DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { SettingMarkdown } from "./SettingMarkdown";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";


const gCaptionMap = {};
gCaptionMap[Timing.Past] = [
  "Did you go?",// any non-responses
  "You were there!",// all affirmative
  "We missed you 😢",// all negative
  "You were (partially) there",// else (mixed)
] as const;
gCaptionMap[Timing.Present] = [
  "Are you there?",// any non-responses
  "You are there!",// all affirmative
  "We're missing you 😢",// all negative
  "You are (partially) going",// else (mixed)
] as const;
gCaptionMap[Timing.Future] = [
  "Are you going?",// any non-responses
  "You're going!",// all affirmative
  "We'll miss you 😢",// all negative
  "You're (partially) going",// else (mixed)
] as const;



////////////////////////////////////////////////////////////////
interface EventAttendanceInstrumentButtonProps {
  value: db3.InstrumentPayload | null;
  selected: boolean,
  onSelect?: ((value: db3.InstrumentPayload | null) => void),
};


const EventAttendanceInstrumentButton = ({ value, selected, onSelect }: EventAttendanceInstrumentButtonProps) => {
  if (!value?.name) return null;
  return <CMChip
    onClick={() => onSelect && onSelect(value)}
    shape='rounded'
    className={`attendanceInstrument CMChipNoMargin ${selected ? "" : "HalfOpacity"}`}
    border='noBorder'
    color={value?.functionalGroup.color}
    //size='small'
    tooltip={value?.description}
    variation={{
      enabled: true,
      fillOption: (selected) ? "filled" : 'hollow',
      variation: (selected) ? 'strong' : "weak",
      selected,
    }}
  >
    {value!.name}
  </CMChip>;
}

////////////////////////////////////////////////////////////////
// ONLY show this if:
// - you play multiple instruments
// - OR, the selected instrument for this is not your instrument for some reason
//
// therefore also make sure the shown list includes instruments you play
interface EventAttendanceInstrumentControlProps {
  eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
  onRefetch: () => void,
  onChanged: () => void,
  eventId: number,
  //readonly?: boolean,
  //userMap: db3.UserInstrumentList,
};

const EventAttendanceInstrumentControl = (props: EventAttendanceInstrumentControlProps) => {
  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
  const dashboardContext = React.useContext(DashboardContext);

  const selectedInstrument = dashboardContext.instrument.getById(props.eventUserResponse.response.instrumentId);

  const handleChange = async (value: null | db3.InstrumentPayloadMinimum) => {
    token.invoke({
      userId: props.eventUserResponse.response.userId,
      eventId: props.eventId,
      instrumentId: value === null ? null : value.id,
    }).then(() => {
      showSnackbar({ children: "Response updated", severity: 'success' });
      //setExplicitEdit(false);
      props.onRefetch();
    }).catch(err => {
      console.log(err);
      showSnackbar({ children: "update error", severity: 'error' });
      props.onRefetch();
    });
  };

  const instrumentList = props.eventUserResponse.user.instruments.map(ui => dashboardContext.instrument.getById(ui.instrumentId)!);
  // you'll naturally see weird behavior if your user instrument list doesn't include the one selected.
  // but that's an edge case i don't care about. workaround: add it to your user list if you want to be able to select it here.
  // TODO: allow adding it to your user list FROM here. (like an "other..." button, pop up dialog to select, then "would you like to add it to your list?")

  if (instrumentList.length < 2) return null;

  return <NameValuePair
    //isReadOnly={props.readonly || false}
    name="Instrument"
    value={<CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
      {instrumentList.map(option =>
        <EventAttendanceInstrumentButton key={option.id} selected={option.id === selectedInstrument?.id} value={option} onSelect={() => handleChange(option)} />)}
    </CMChipContainer>
    } />
    ;
};




// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// // a view/edit control for the comment only (including mutation)
// interface EventAttendanceCommentControlProps {
//   userResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>,
//   onRefetch: () => void,
//   readonly: boolean,
// };

// const EventAttendanceCommentControl = (props: EventAttendanceCommentControlProps) => {
//   const token = API.events.updateUserEventAttendance.useToken();
//   const val = props.userResponse.response.userComment || "";
//   return <CompactMutationMarkdownControl
//     initialValue={props.userResponse.response.userComment}
//     editButtonMessage={val === "" ? "Add a comment" : "Edit comment"}
//     editButtonVariant={val === "" ? "default" : "framed"}
//     refetch={props.onRefetch}
//     readonly={props.readonly}
//     className="compact"
//     onChange={async (value) => {
//       return await token.invoke({
//         userId: props.userResponse.user.id,
//         eventId: props.userResponse.event.id,
//         comment: value,
//       });
//     }} />;
// };



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventAttendanceCommentEditorProps {
  userResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>,
  onRefetch: () => void,
  onClose: () => void;
  initialValue: string;
};

const EventAttendanceCommentEditor = (props: EventAttendanceCommentEditorProps) => {
  const [value, setValue] = React.useState<string>(props.initialValue);
  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const handleSave = async (): Promise<boolean> => {
    try {
      await token.invoke({
        userId: props.userResponse.user.id,
        eventId: props.userResponse.event.id,
        comment: value,
      });
      showSnackbar({ severity: "success", children: "Success" });
      props.onRefetch();
      return true;
    } catch (e) {
      console.log(e);
      showSnackbar({ severity: "error", children: "error updating event description" });
      return false;
    }
  };

  // const hasEdits = (props.initialValue !== value);

  const handleSaveAndClose = async (): Promise<boolean> => {
    const r = await handleSave();
    props.onClose();
    return r;
  };

  return <ReactiveInputDialog
    onCancel={props.onClose}
  >

    <DialogTitle>
      <SettingMarkdown setting="EventAttendanceCommentDialog_TitleMarkdown" />
    </DialogTitle>
    <DialogContent dividers>
      <SettingMarkdown setting="EventAttendanceCommentDialog_DescriptionMarkdown" />

      <Markdown3Editor
        onChange={(v) => setValue(v)}
        value={value}
        onSave={() => { void handleSave() }}
        minHeight={140}
      //enableSaveProgress={false}
      />

      <DialogActions className="actionButtonsRow">
        <div className={`freeButton cancelButton`} onClick={props.onClose}>Cancel</div>
        {/* <div className={`saveButton saveProgressButton ${hasEdits ? "freeButton changed" : "unchanged"}`} onClick={hasEdits ? handleSave : undefined}>Save progress</div> */}
        <div className={`saveButton saveAndCloseButton freeButton changed`} onClick={handleSaveAndClose}>{gIconMap.CheckCircleOutline()}Save</div>
      </DialogActions>

    </DialogContent>
  </ReactiveInputDialog>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// a view/edit control for the comment only (including mutation)
interface EventAttendanceCommentControlProps {
  userResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>,
  onRefetch: () => void,
  readonly: boolean,
};

const EventAttendanceCommentControl = (props: EventAttendanceCommentControlProps) => {
  const [editing, setEditing] = React.useState<boolean>(false);
  //const token = API.events.updateUserEventAttendance.useToken();
  const val = props.userResponse.response.userComment || "";

  const clickToEdit = !props.readonly && !editing;

  return <div className={`ownAttendanceComment freeButton ${clickToEdit && "clickToEdit"}`} onClick={clickToEdit ? () => setEditing(true) : undefined}>
    <div>
      {editing ? <EventAttendanceCommentEditor
        onClose={() => setEditing(false)}
        initialValue={val}
        onRefetch={props.onRefetch}
        userResponse={props.userResponse}
      /> : <Markdown markdown={val} />}
    </div>
    <div className="clickToAddComment">Click to add/edit a comment</div>
  </div>;
};



////////////////////////////////////////////////////////////////
interface EventAttendanceAnswerButtonProps {
  value: db3.EventAttendanceBasePayload | null;
  selected: boolean,
  noItemSelected: boolean, // when you have no selected item, color all items as strong
  onSelect?: ((value: db3.EventAttendanceBasePayload | null) => void),
  tooltip: string; // value?.description
};


const EventAttendanceAnswerButton = ({ value, selected, noItemSelected, onSelect, tooltip }: EventAttendanceAnswerButtonProps) => {
  const yesNoStyle = value && (value.strength > 50) ? "yes" : "no";
  return <CMChip
    onClick={() => onSelect && onSelect(value)}
    shape='rectangle'
    className={`attendanceAnswer ${yesNoStyle} CMChipNoMargin`}
    //border='border'
    color={value?.color}
    size='big'
    tooltip={tooltip}
    variation={{
      enabled: true,
      fillOption: 'filled',
      variation: (selected || noItemSelected) ? 'strong' : "weak",
      selected,
    }}
  >
    {value?.text || "(no answer)"}
    {RenderMuiIcon(value?.iconName)}
  </CMChip>;
}

////////////////////////////////////////////////////////////////
// event segment attendance standalone field (read-only possible, buttons array for input).
// basically a button array of responses, not tied to DB but just a value.
interface EventAttendanceAnswerControlProps {
  eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
  segmentUserResponse: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>;
  forceEditMode: boolean;
  //readonly: boolean;
  onRefetch: () => void,
  onReadonlyClick: () => void;
  onSelectedItem: () => void;
};

const EventAttendanceAnswerControl = (props: EventAttendanceAnswerControlProps) => {
  const [explicitEdit, setExplicitEdit] = React.useState<boolean>(false);
  const editMode = explicitEdit || props.forceEditMode;

  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const selectedResponse = props.segmentUserResponse.response;
  const selectedAttendanceId: number | null = props.segmentUserResponse.response.attendanceId;
  const dashboardContext = React.useContext(DashboardContext);

  // const optionsClient = DB3Client.useTableRenderContext({
  //   requestedCaps: DB3Client.xTableClientCaps.Query,
  //   clientIntention: { intention: 'user', mode: 'primary' },
  //   tableSpec: new DB3Client.xTableClientSpec({
  //     table: db3.xEventAttendance,
  //     columns: [
  //       new DB3Client.PKColumnClient({ columnName: "id" }),
  //     ],
  //   }),
  // });

  const handleReadonlyClick = () => {
    props.onReadonlyClick();
    setExplicitEdit(true);
  }

  const handleChange = async (value: null | Prisma.EventAttendanceGetPayload<{}>) => {
    const segmentResponses: Record<number, { attendanceId: number | null }> = {};
    segmentResponses[props.segmentUserResponse.segment.id] = {
      attendanceId: (value === null ? null : value.id),
    }
    token.invoke({
      userId: props.eventUserResponse.user.id,
      eventId: props.eventUserResponse.event.id,
      segmentResponses,
    }).then(() => {
      showSnackbar({ children: "Response updated", severity: 'success' });
      setExplicitEdit(false);
      props.onSelectedItem();
      props.onRefetch();
    }).catch(err => {
      console.log(err);
      showSnackbar({ children: "update error", severity: 'error' });
      props.onRefetch();
    });
  };

  const attendance = dashboardContext.eventAttendance.getById(selectedResponse.attendanceId);

  const optionDesc = attendance ? (`${attendance.text} : ${attendance.description}`) : `no answer`;
  const tooltip = `${props.segmentUserResponse.segment.name}: ${optionDesc}`;

  return <>
    {editMode ? (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          {(dashboardContext.eventAttendance).map(option =>
            <EventAttendanceAnswerButton key={option.id} noItemSelected={selectedAttendanceId === null} selected={option.id === selectedAttendanceId} value={option} onSelect={() => handleChange(option)} tooltip={tooltip} />)}
          <EventAttendanceAnswerButton noItemSelected={selectedAttendanceId === null} selected={null === selectedAttendanceId} value={null} onSelect={() => handleChange(null)} tooltip={tooltip} />
        </CMChipContainer>
      </>) : (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          <EventAttendanceAnswerButton noItemSelected={false} selected={true} value={attendance} onSelect={handleReadonlyClick} tooltip={tooltip} />
          {/* <CMSmallButton onClick={handleClick}>change</CMSmallButton> */}
        </CMChipContainer>
      </>
    )}
  </>;
};

////////////////////////////////////////////////////////////////
// frame for event segment:
// shows your answer & comment, small button to show edit controls.
export interface EventAttendanceSegmentControlProps {
  //eventData: EventWithMetadata;
  initialEditMode: boolean;
  eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
  segmentUserResponse: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>;
  isSingleSegment: boolean;
  onRefetch: () => void,
  onReadonlyClick: () => void;
  onSelectedItem: () => void;
};

export const EventAttendanceSegmentControl = ({ segmentUserResponse, ...props }: EventAttendanceSegmentControlProps) => {
  const dashboardContext = React.useContext(DashboardContext);

  const name = props.isSingleSegment ? null : (<>{segmentUserResponse.segment.name} ({API.events.getEventSegmentFormattedDateRange(segmentUserResponse.segment)})</>);

  const attendance = dashboardContext.eventAttendance.getById(segmentUserResponse.response.attendanceId);
  const hasAnswer = !!attendance;
  const forceEditMode = props.initialEditMode || (props.eventUserResponse.isInvited && !hasAnswer); // no answer and invited = default edit  

  return <NameValuePair
    className={props.isSingleSegment ? "bare" : ""}
    isReadOnly={false}
    name={name}
    value={<>
      <EventAttendanceAnswerControl
        forceEditMode={forceEditMode}
        eventUserResponse={props.eventUserResponse}
        segmentUserResponse={segmentUserResponse}
        onRefetch={props.onRefetch}
        onReadonlyClick={props.onReadonlyClick}
        onSelectedItem={props.onSelectedItem}
      />
      <div className="helpText">
        {attendance?.description}
      </div>
    </>
    }
  />;
};

////////////////////////////////////////////////////////////////
// frame for event:
// big attendance alert (per event, multiple segments)
export interface EventAttendanceControlProps {
  eventData: EventWithMetadata<
    db3.EnrichedSearchEventPayload,
    db3.EventResponses_MinimalEventUserResponse,
    db3.EventResponses_MinimalEventSegment,
    db3.EventResponses_MinimalEventSegmentUserResponse
  >;
  onRefetch: () => void,
  userMap: db3.UserInstrumentList,
  alertOnly?: boolean; // when true, the control hides unless it's an alert.
};


export const EventAttendanceControl = (props: EventAttendanceControlProps) => {
  const dashboardContext = React.useContext(DashboardContext);
  const alertOnly = CoalesceBool(props.alertOnly, false);

  if (!props.eventData.responseInfo) return <AdminInspectObject src={"hidden bc no response info; this is an error"} label="AttendanceControl" />;
  if (props.eventData.event.segments.length < 1) return <AdminInspectObject src={"hidden bc no segments. no attendance can be recorded."} label="AttendanceControl" />;

  // never show attendance alert control for cancelled events
  if (props.eventData.event.status?.significance === db3.EventStatusSignificance.Cancelled) {
    return <AdminInspectObject src={"hidden bc cancelled."} label="AttendanceControl" />;
  }

  const [userSelectedEdit, setUserSelectedEdit] = React.useState<boolean>(false);
  //const [refreshSerial, setRefreshSerial] = React.useState(0);
  const user = useCurrentUser()[0]!;
  const segmentResponses = Object.values(props.eventData.responseInfo.getResponsesBySegmentForUser(user));
  segmentResponses.sort((a, b) => db3.compareEventSegments(a.segment, b.segment));
  const eventResponse = props.eventData.responseInfo.getEventResponseForUser(user, dashboardContext, props.userMap);
  if (!eventResponse) {
    // this should always return a value; if not it means it can't be done.
    return <AdminInspectObject src={"hidden bc no eventResponse; this is an error."} label="AttendanceControl" />;
  }

  const eventTiming = props.eventData.eventTiming;
  // if (eventTiming === Timing.Past) {
  //   return <AdminInspectObject src={"hidden bc in the past."} label="AttendanceControl" />;
  // }
  const isPast = (eventTiming === Timing.Past);

  const isInvited = eventResponse.isInvited;
  const isSingleSegment = segmentResponses.length === 1;

  const allAttendances = segmentResponses.map(sr => dashboardContext.eventAttendance.getById(sr.response.attendanceId));

  const anyAnswered = allAttendances.some(r => !!r);
  const allAnswered = allAttendances.every(r => !!r);
  const allAffirmative = allAttendances.every(r => !!r && r.strength > 50);
  const someAffirmative = allAttendances.some(r => !!r && r.strength > 50);
  const allNegative = allAttendances.every(r => !!r && r.strength <= 50);

  const alertFlag = isInvited && !allAnswered && !isPast;
  const hideBecauseNotAlert = !alertFlag && alertOnly;
  const visible = !hideBecauseNotAlert && (anyAnswered || isInvited);// hide the control entirely if you're not invited, but still show if you already responded.

  // there are really just 2 modes here for simplicity
  // view (compact, instrument & segments on same line)
  // edit (full, instrument & segments on separate lines with full text)
  const allowViewMode = !alertFlag;
  const editMode = userSelectedEdit || !allowViewMode;

  // try to make the process slightly more linear by first asking about attendance. when you've answered that, THEN ask on what instrument.
  // also don't ask about instrument if all answers are negative.
  const allowInstrumentSelect = allAnswered && someAffirmative;

  const debugView = <AdminInspectObject src={{
    isPast,
    isInvited,
    isSingleSegment,
    allAttendances,
    anyAnswered,
    allAnswered,
    allAffirmative,
    someAffirmative,
    allNegative,
    alertFlag,
    alertOnly,
    hideBecauseNotAlert,
    visible,
    allowViewMode,
    editMode,
    allowInstrumentSelect,
  }} label="AttendanceControl" />;

  if (!visible) return debugView;

  const inspectable = {
    event: {
      isSingleSegment,
      isInvited,
    },
    yourResponses: {
      anyAnswered,
      allAnswered,
      allAffirmative,
      someAffirmative,
      allNegative,
    },
    componentState: {
      alertFlag,
      allowViewMode,
      userSelectedEdit,
      editMode,
    }
  };

  const mapIndex = !allAnswered ? 0 : (allAffirmative ? 1 : (allNegative ? 2 : 3));

  return <div className={`eventAttendanceControl ${alertFlag && "alert"}`}>
    {debugView}
    <div className='header'>
      <div>{gCaptionMap[eventTiming][mapIndex]}</div>
      {editMode && allowViewMode && <CMSmallButton variant="framed" onClick={() => { setUserSelectedEdit(false) }}>{"Close"}</CMSmallButton>}
    </div>

    <div className="attendanceResponseInput">
      <div className='comment'>
        <EventAttendanceCommentControl onRefetch={props.onRefetch} userResponse={eventResponse} readonly={false} />
      </div>

      {editMode ? (<>
        {allowInstrumentSelect && <div className='instrument'>
          <EventAttendanceInstrumentControl
            eventUserResponse={eventResponse}
            onRefetch={props.onRefetch}
            //onChanged={() => setUserSelectedEdit(false)} // when a user selects an item, allow the control to go back to view mode again.
            onChanged={() => { }} // when a user selects an item, allow the control to go back to view mode again.
            eventId={props.eventData.event.id}
          />
        </div>}
        <div className="segmentList">
          {segmentResponses.map(segment => {
            return <EventAttendanceSegmentControl
              isSingleSegment={isSingleSegment}
              key={segment.segment.id}
              initialEditMode={true}
              onRefetch={props.onRefetch}
              onReadonlyClick={() => setUserSelectedEdit(true)}
              onSelectedItem={() => { }} // setUserSelectedEdit(false) would allow the control to go back to view mode. but it's a bit distracting, and anyway the user has already been interacting here so don't.
              eventUserResponse={eventResponse}
              segmentUserResponse={segment}
            //eventData={props.eventData}
            />;
          })}
        </div>
      </>
      ) : (

        <CMChipContainer>
          <EventAttendanceInstrumentButton key={"__"}
            selected={false}
            value={eventResponse.instrument}
            onSelect={() => setUserSelectedEdit(true)}
          />
          {segmentResponses.map(segment => {
            return <EventAttendanceAnswerControl
              forceEditMode={false} // compact mode never has edit by default
              key={segment.segment.id}
              eventUserResponse={eventResponse}
              onRefetch={props.onRefetch}
              segmentUserResponse={segment}
              onReadonlyClick={() => setUserSelectedEdit(true)} // when a user selects an item, allow the control to go back to view mode again.
              onSelectedItem={() => { }} // setUserSelectedEdit(false) would allow the control to go back to view mode. but it's a bit distracting, and anyway the user has already been interacting here so don't.
            />
          })
          }
        </CMChipContainer>
      )}

      <DebugCollapsibleAdminText obj={inspectable} />
    </div>

  </div>;
};




