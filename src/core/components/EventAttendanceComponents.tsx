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
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { AdminInspectObject, AttendanceChip } from './CMCoreComponents';
import { CMSmallButton, NameValuePair } from "./CMCoreComponents2";
import { CalcEventAttendance, EventWithMetadata } from "./EventComponentsBase";
//import { CompactMutationMarkdownControl } from './SettingMarkdown';
import { CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { Prisma } from "db";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";
import { CMChip, CMChipContainer } from "./CMChip";
import { DashboardContext, useDashboardContext } from "./DashboardContext";
import { Markdown3Editor } from "./markdown/MarkdownControl3";
import { ReactiveInputDialog } from "./ReactiveInputDialog";
import { Markdown } from "./markdown/RichTextEditor";
import { SettingMarkdown } from "./SettingMarkdown";


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
  const [inProgress, setInProgress] = React.useState<boolean>(false);
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
  const dashboardContext = React.useContext(DashboardContext);

  const selectedInstrument = dashboardContext.instrument.getById(props.eventUserResponse.response.instrumentId);

  const handleChange = async (value: null | db3.InstrumentPayloadMinimum) => {
    setInProgress(true);
    token.invoke({
      userId: props.eventUserResponse.response.userId,
      eventId: props.eventId,
      instrumentId: value === null ? null : value.id,
    }).then(() => {
      showSnackbar({ children: "Response updated", severity: 'success' });
      props.onRefetch();
    }).catch(err => {
      console.log(err);
      showSnackbar({ children: "update error", severity: 'error' });
      props.onRefetch();
    }).finally(() => {
      setInProgress(false);
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
      {inProgress ? <CircularProgress size={16} /> :
        instrumentList.map(option =>
          <EventAttendanceInstrumentButton key={option.id} selected={option.id === selectedInstrument?.id} value={option} onSelect={() => handleChange(option)} />)
      }
    </CMChipContainer>
    } />
    ;
};


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
        autoFocus={true} // why doesn't this work?
        onChange={(v) => setValue(v)}
        value={value}
        handleSave={() => { void handleSave() }}
        nominalHeight={200}
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
  const [inProgress, setInProgress] = React.useState<boolean>(false);

  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const selectedResponse = props.segmentUserResponse.response;
  const selectedAttendanceId: number | null = props.segmentUserResponse.response.attendanceId;
  const dashboardContext = React.useContext(DashboardContext);

  const handleReadonlyClick = () => {
    props.onReadonlyClick();
    setExplicitEdit(true);
  }

  const handleChange = async (value: null | Prisma.EventAttendanceGetPayload<{}>) => {
    const segmentResponses: Record<number, { attendanceId: number | null }> = {};
    segmentResponses[props.segmentUserResponse.segment.id] = {
      attendanceId: (value === null ? null : value.id),
    }
    setInProgress(true);
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
    }).finally(() => {
      setInProgress(false);
    });
  };

  const selectedAttendance = dashboardContext.eventAttendance.getById(selectedResponse.attendanceId);
  if (inProgress) return <CircularProgress size={16} />;

  return <>
    {editMode ? (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          {dashboardContext.eventAttendance.filter(o => o.isActive).map(option =>
            <EventAttendanceAnswerButton key={option.id} noItemSelected={selectedAttendanceId === null} selected={option.id === selectedAttendanceId} value={option} onSelect={() => handleChange(option)} tooltip={option.description} />)}
          <EventAttendanceAnswerButton noItemSelected={selectedAttendanceId === null} selected={null === selectedAttendanceId} value={null} onSelect={() => handleChange(null)} tooltip={"Don't leave an answer now"} />
        </CMChipContainer>
      </>) : (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          <EventAttendanceAnswerButton noItemSelected={false} selected={true} value={selectedAttendance} onSelect={handleReadonlyClick} tooltip={selectedAttendance?.description || "Not answered yet"} />
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
  minimalWhenNotAlert: boolean,
  //alertOnly?: boolean; // when true, the control hides unless it's an alert.
};


export const EventAttendanceControl = (props: EventAttendanceControlProps) => {
  const dashboardContext = useDashboardContext();

  const y = CalcEventAttendance({
    eventData: props.eventData,
    userMap: props.userMap,
    //minimalWhenNotAlert: props.minimalWhenNotAlert,
    //alertOnly: props.alertOnly,
  });

  // never show attendance alert control for cancelled events
  if (props.eventData.event.status?.significance === db3.EventStatusSignificance.Cancelled) {
    return <AdminInspectObject src={"hidden bc cancelled."} label="AttendanceControl" />;
  }

  const [userSelectedEdit, setUserSelectedEdit] = React.useState<boolean>(false);

  const editMode = userSelectedEdit || !y.allowViewMode;

  const debugView = <AdminInspectObject src={y} label="AttendanceControl" />;

  if (!y.visible) return debugView;

  const mapIndex = !y.allUncancelledSegmentsAnswered ? 0 : (y.allUncancelledSegmentsAffirmative ? 1 : (y.allUncancelledSegmentResponsesNegative ? 2 : 3));

  // require any answered otherwise you get "you responded: no response".
  if (y.visible && !y.alertFlag && y.anyAnswered && props.minimalWhenNotAlert) {
    return <div className={`eventAttendanceControl minimalView`}>
      <CMChipContainer>
        <div className="caption">You responded</div>
        {y.uncancelledSegmentUserResponses.map((r, i) => <AttendanceChip
          key={r.segment.id}
          value={dashboardContext.eventAttendance.getById(r.response.attendanceId)}
          tooltipOverride={r.segment.name}
        />)}
      </CMChipContainer>
    </div>;
  }

  return <div className={`eventAttendanceControl ${y.alertFlag && "alert"}`}>
    {debugView}
    <div className='header'>
      <div>{gCaptionMap[y.eventTiming][mapIndex]}</div>
      {editMode && y.allowViewMode && <CMSmallButton variant="framed" onClick={() => { setUserSelectedEdit(false) }}>{"Close"}</CMSmallButton>}
    </div>

    <div className="attendanceResponseInput">
      <div className='comment'>
        <EventAttendanceCommentControl onRefetch={props.onRefetch} userResponse={y.eventUserResponse} readonly={false} />
      </div>

      {editMode ? (<>
        {y.allowInstrumentSelect && <div className='instrument'>
          <EventAttendanceInstrumentControl
            eventUserResponse={y.eventUserResponse}
            onRefetch={props.onRefetch}
            //onChanged={() => setUserSelectedEdit(false)} // when a user selects an item, allow the control to go back to view mode again.
            onChanged={() => { }} // when a user selects an item, allow the control to go back to view mode again.
            eventId={props.eventData.event.id}
          />
        </div>}
        <div className="segmentList">
          {y.uncancelledSegmentUserResponses.map(segment => {
            return <EventAttendanceSegmentControl
              isSingleSegment={y.isSingleSegment}
              key={segment.segment.id}
              initialEditMode={true}
              onRefetch={props.onRefetch}
              onReadonlyClick={() => setUserSelectedEdit(true)}
              onSelectedItem={() => { }} // setUserSelectedEdit(false) would allow the control to go back to view mode. but it's a bit distracting, and anyway the user has already been interacting here so don't.
              eventUserResponse={y.eventUserResponse}
              segmentUserResponse={segment}
            //eventData={props.eventData}
            />;
          })}
        </div>
      </>
      ) : (

        <CMChipContainer>
          {y.allowInstrumentSelect && <EventAttendanceInstrumentButton key={"__"}
            selected={false}
            value={y.eventUserResponse.instrument}
            onSelect={() => setUserSelectedEdit(true)}
          />}
          {y.uncancelledSegmentUserResponses.map(segment => {
            return <EventAttendanceAnswerControl
              forceEditMode={false} // compact mode never has edit by default
              key={segment.segment.id}
              eventUserResponse={y.eventUserResponse}
              onRefetch={props.onRefetch}
              segmentUserResponse={segment}
              onReadonlyClick={() => setUserSelectedEdit(true)} // when a user selects an item, allow the control to go back to view mode again.
              onSelectedItem={() => { }} // setUserSelectedEdit(false) would allow the control to go back to view mode. but it's a bit distracting, and anyway the user has already been interacting here so don't.
            />
          })
          }
        </CMChipContainer>
      )}
    </div>

  </div>;
};




