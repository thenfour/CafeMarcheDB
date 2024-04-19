/*
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
import { RenderMuiIcon } from '../db3/components/IconSelectDialog';
import { AdminInspectObject, CMChip, CMChipContainer, InspectObject } from './CMCoreComponents';
import { CompactMutationMarkdownControl } from './SettingMarkdown';
import { CMSmallButton } from "./CMCoreComponents2";
import { EventWithMetadata } from "./EventComponentsBase";
import { Markdown } from "./RichTextEditor";


////////////////////////////////////////////////////////////////
interface EventAttendanceInstrumentButtonProps {
  value: db3.InstrumentPayload | null;
  selected: boolean,
  onSelect?: ((value: db3.InstrumentPayload | null) => void),
};


const EventAttendanceInstrumentButton = ({ value, selected, onSelect }: EventAttendanceInstrumentButtonProps) => {
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
    {value?.name || "(no answer)"}
  </CMChip>;
}

////////////////////////////////////////////////////////////////
// ONLY show this if:
// - you play multiple instruments
// - OR, the selected instrument for this is not your instrument for some reason
//
// therefore also make sure the shown list includes instruments you play
interface EventAttendanceInstrumentControlProps {
  eventUserResponse: db3.EventUserResponse;
  onRefetch: () => void,
  readonly?: boolean,
};

const EventAttendanceInstrumentControl = (props: EventAttendanceInstrumentControlProps) => {
  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const selectedInstrument = props.eventUserResponse.instrument;

  const handleChange = async (value: null | db3.InstrumentPayloadMinimum) => {
    token.invoke({
      userId: props.eventUserResponse.user.id,
      eventId: props.eventUserResponse.event.id,
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

  const instrumentList = props.eventUserResponse.user.instruments.map(ui => ui.instrument);
  // you'll naturally see weird behavior if your user instrument list doesn't include the one selected.
  // but that's an edge case i don't care about. workaround: add it to your user list if you want to be able to select it here.
  // TODO: allow adding it to your user list FROM here. (like an "other..." button, pop up dialog to select, then "would you like to add it to your list?")

  if (instrumentList.length < 2) return null;

  return <DB3Client.NameValuePair
    isReadOnly={props.readonly || false}
    name="Instrument"
    value={<CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
      {!!props.readonly ? (
        selectedInstrument !== null && <EventAttendanceInstrumentButton key={"__"} selected={true} value={selectedInstrument} />
      ) : (instrumentList.map(option =>
        <EventAttendanceInstrumentButton key={option.id} selected={option.id === selectedInstrument?.id} value={option} onSelect={() => handleChange(option)} />))}
    </CMChipContainer>} />
    ;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// a view/edit control for the comment only (including mutation)
interface EventAttendanceCommentControlProps {
  userResponse: db3.EventUserResponse,
  onRefetch: () => void,
  readonly: boolean,
};

const EventAttendanceCommentControl = (props: EventAttendanceCommentControlProps) => {
  const token = API.events.updateUserEventAttendance.useToken();
  const val = props.userResponse.response.userComment || "";
  return <CompactMutationMarkdownControl
    initialValue={props.userResponse.response.userComment}
    editButtonMessage={val === "" ? "Add a comment" : "Edit comment"}
    editButtonVariant={val === "" ? "default" : "framed"}
    refetch={props.onRefetch}
    readonly={props.readonly}
    className="compact"
    onChange={async (value) => {
      return await token.invoke({
        userId: props.userResponse.user.id,
        eventId: props.userResponse.event.id,
        comment: value,
      });
    }} />;
};


////////////////////////////////////////////////////////////////
interface EventAttendanceAnswerButtonProps {
  value: db3.EventAttendanceBasePayload | null;
  selected: boolean,
  noItemSelected: boolean, // when you have no selected item, color all items as strong
  onSelect?: ((value: db3.EventAttendanceBasePayload | null) => void),
};


const EventAttendanceAnswerButton = ({ value, selected, noItemSelected, onSelect }: EventAttendanceAnswerButtonProps) => {
  const yesNoStyle = value && (value.strength > 50) ? "yes" : "no";
  return <CMChip
    onClick={() => onSelect && onSelect(value)}
    shape='rectangle'
    className={`attendanceAnswer ${yesNoStyle} CMChipNoMargin`}
    //border='border'
    color={value?.color}
    size='big'
    tooltip={value?.description}
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
  eventUserResponse: db3.EventUserResponse;
  segmentUserResponse: db3.EventSegmentUserResponse;
  //readonly: boolean;
  onRefetch: () => void,
};

const EventAttendanceAnswerControl = (props: EventAttendanceAnswerControlProps) => {
  const [explicitEdit, setExplicitEdit] = React.useState<boolean>(false);
  const hasAnswer = !!props.segmentUserResponse.response.attendance;
  const defaultEdit = props.eventUserResponse.isInvited && !hasAnswer; // no answer and invited = default edit
  const editMode = explicitEdit || defaultEdit;

  const token = API.events.updateUserEventAttendance.useToken();
  const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

  const selectedResponse = props.segmentUserResponse.response;
  const selectedAttendanceId: number | null = props.segmentUserResponse.response.attendanceId;

  const optionsClient = DB3Client.useTableRenderContext({
    requestedCaps: DB3Client.xTableClientCaps.Query,
    clientIntention: { intention: 'user', mode: 'primary' },
    tableSpec: new DB3Client.xTableClientSpec({
      table: db3.xEventAttendance,
      columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
      ],
    }),
  });

  const handleChange = async (value: null | db3.EventAttendancePayload) => {
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
      props.onRefetch();
    }).catch(err => {
      console.log(err);
      showSnackbar({ children: "update error", severity: 'error' });
      props.onRefetch();
    });
  };

  return <>
    {editMode ? (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          {(optionsClient.items as db3.EventAttendancePayload[]).map(option =>
            <EventAttendanceAnswerButton key={option.id} noItemSelected={selectedAttendanceId === null} selected={option.id === selectedAttendanceId} value={option} onSelect={() => handleChange(option)} />)}
          <EventAttendanceAnswerButton noItemSelected={selectedAttendanceId === null} selected={null === selectedAttendanceId} value={null} onSelect={() => handleChange(null)} />
        </CMChipContainer>
      </>) : (
      <>
        <CMChipContainer className='EventAttendanceResponseControlButtonGroup'>
          <EventAttendanceAnswerButton noItemSelected={false} selected={true} value={selectedResponse.attendance} onSelect={() => setExplicitEdit(true)} />
          <CMSmallButton onClick={() => setExplicitEdit(true)}>change</CMSmallButton>
        </CMChipContainer>
      </>
    )}
  </>;
};

////////////////////////////////////////////////////////////////
// frame for event segment:
// shows your answer & comment, small button to show edit controls.
export interface EventAttendanceSegmentControlProps {
  eventData: EventWithMetadata;
  eventUserResponse: db3.EventUserResponse;
  segmentUserResponse: db3.EventSegmentUserResponse;
  //readonly: boolean;
  //showHeader: boolean;
  onRefetch: () => void,
};

export const EventAttendanceSegmentControl = ({ segmentUserResponse, ...props }: EventAttendanceSegmentControlProps) => {

  return <DB3Client.NameValuePair
    isReadOnly={false}
    name={<>{segmentUserResponse.segment.name} ({API.events.getEventSegmentFormattedDateRange(segmentUserResponse.segment)})</>}
    value={<EventAttendanceAnswerControl
      eventUserResponse={props.eventUserResponse}
      segmentUserResponse={segmentUserResponse}
      onRefetch={props.onRefetch}
    />
    }
  />;

  // return <div className="segment">
  //   <div className='header'>{segmentUserResponse.segment.name} ({API.events.getEventSegmentFormattedDateRange(segmentUserResponse.segment)})</div>
  //   <EventAttendanceAnswerControl
  //     eventUserResponse={props.eventUserResponse}
  //     segmentUserResponse={segmentUserResponse}
  //     onRefetch={props.onRefetch}
  //   />
  // </div>;
};

////////////////////////////////////////////////////////////////
// frame for event:
// big attendance alert (per event, multiple segments)
export interface EventAttendanceControlProps {
  eventData: EventWithMetadata;
  onRefetch: () => void,
};

export const EventAttendanceControl = (props: EventAttendanceControlProps) => {
  const [userExpanded, setUserExpanded] = React.useState<boolean>(false);
  const user = useCurrentUser()[0]!;
  const segmentResponses = Object.values(props.eventData.responseInfo.getResponsesBySegmentForUser(user));
  segmentResponses.sort((a, b) => db3.compareEventSegments(a.segment, b.segment));
  const eventResponse = props.eventData.responseInfo.getEventResponseForUser(user);

  const eventTiming = props.eventData.eventTiming;
  const eventIsPast = eventTiming === Timing.Past;
  const anyAnswered = segmentResponses.some(r => !!r.response.attendance);
  const allAnswered = segmentResponses.every(r => !!r.response.attendance);
  const allAffirmative = segmentResponses.every(r => !!r.response.attendance && r.response.attendance!.strength > 50);
  const someAffirmative = segmentResponses.some(r => !!r.response.attendance && r.response.attendance!.strength > 50);
  const allNegative = segmentResponses.every(r => !!r.response.attendance && r.response.attendance!.strength <= 50);
  const isInvited = eventResponse.isInvited;

  // does the control want to bring attention to demand user input (not the same as read-only!)
  // - if in the PAST, never.
  // - then the only time to alert is when the user is:
  //   - invited
  //   - and not all answered
  const inputAlert = !eventIsPast && (isInvited && !allAnswered);
  const isVerbose = inputAlert || userExpanded;
  const canExpandUnexpand = !inputAlert;
  const visible = anyAnswered || isInvited;// hide the control entirely if you're not invited, but still show if you already responded.

  if (!visible) return null;

  const inspectable = {
    eventTiming,
    eventIsPast,
    anyAnswered,
    allAnswered,
    allAffirmative,
    someAffirmative,
    allNegative,
    isInvited,
    inputAlert,
    isVerbose,
    canExpandUnexpand,
    visible,
    segmentResponses,
  };

  const captionMap = {};
  captionMap[Timing.Past] = [
    "Did you go?",// any non-responses
    "You were there!",// all affirmative
    "We missed you 😢",// all negative
    "You were (partially) there",// else (mixed)
  ] as const;
  captionMap[Timing.Present] = [
    "Are you there?",// any non-responses
    "You are there!",// all affirmative
    "We're missing you 😢",// all negative
    "You are (partially) going",// else (mixed)
  ] as const;
  captionMap[Timing.Future] = [
    "Are you going?",// any non-responses
    "You're going!",// all affirmative
    "We'll miss you 😢",// all negative
    "You're (partially) going",// else (mixed)
  ] as const;

  const mapIndex = !allAnswered ? 0 : (allAffirmative ? 1 : (allNegative ? 2 : 3));

  return <div className={`eventAttendanceControl ${inputAlert && "alert"}`}>

    <div className='header'>
      <AdminInspectObject src={inspectable} />
      <div>{captionMap[eventTiming][mapIndex]}</div>
      {canExpandUnexpand && <CMSmallButton variant="framed" onClick={() => setUserExpanded(!userExpanded)}>{isVerbose ? "Close" : "More..."}</CMSmallButton>}
    </div>

    <div className="attendanceResponseInput">
      <div className='comment'>
        <EventAttendanceCommentControl onRefetch={props.onRefetch} userResponse={eventResponse} readonly={!isVerbose} />
      </div>

      {isVerbose ? (<>
        {someAffirmative &&
          <div className='instrument'>
            <EventAttendanceInstrumentControl
              eventUserResponse={eventResponse}
              onRefetch={props.onRefetch}
            />
          </div>}
        <div className="segmentList">
          {segmentResponses.map(segment => {
            return <EventAttendanceSegmentControl
              key={segment.segment.id}
              //showHeader={isVerbose}
              //readonly={!isVerbose}
              onRefetch={props.onRefetch}
              eventUserResponse={eventResponse}
              segmentUserResponse={segment}
              eventData={props.eventData}
            />;
          })}
        </div>
      </>
      ) : (
        <CMChipContainer>
          <EventAttendanceInstrumentButton key={"__"} selected={false} value={eventResponse.instrument} />
          {segmentResponses.map(segment =>
            <EventAttendanceAnswerButton key={segment.response.id} noItemSelected={false} selected={false} value={segment.response.attendance} onSelect={() => { }} />)}
        </CMChipContainer>
      )}


    </div>

  </div>;
};


