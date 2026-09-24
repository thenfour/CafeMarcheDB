import { formatEventDateRange, EventDatePresentation } from "shared/dateTimePresentation";
import React from "react";
import { CircularProgress } from "@mui/material";
import * as db3 from "src/core/db3/db3";
import { getEventSegmentDateTimeRange } from "src/core/db3/shared/schema/event";
import { isAttendanceGoing } from "shared/eventAttendance";
import { Timing } from "shared/time";
import { RenderMuiIcon, gIconMap } from "../../db3/components/IconMap";
import { CMChip, CMChipContainer } from "../CMChip";
import { CMDialog } from "../CMDialog";
import { CMButton, CMSmallButton, NameValuePair } from "../CMCoreComponents2";
import { Markdown } from "../markdown/Markdown";
import { Markdown3Editor } from "../markdown/MarkdownControl3";
import { AppContextMarker } from "../AppContext";
import { AttendanceChipView, AttendanceChipTooltipContent } from "./AttendanceChipView";
import type { EventAttendanceResult } from "./attendanceCalculation";

export type AttendanceChange =
    | { type: "segment"; segmentId: number; attendanceId: number | null }
    | { type: "instrument"; instrumentId: db3.InstrumentIdentity | null }
    | { type: "comment"; comment: string };

export interface AttendanceControlEnvironment {
    attendances: db3.EventAttendanceDisplay[];
    instruments: db3.InstrumentClientOrDbPayload[];
    // Reject on failure. The adapter owns persistence, refetching, telemetry,
    // and feedback; the view owns only the in-progress and editing states.
    onSave: (change: AttendanceChange) => Promise<void>;
    commentDialogTitle: React.ReactNode;
    commentDialogDescription: React.ReactNode;
    allowUploads: boolean;
    datePresentation: EventDatePresentation;
}

export interface AttendanceControlViewProps {
    attendance: EventAttendanceResult;
    environment: AttendanceControlEnvironment;
    event: { id: number; name: string; startsAt: Date | null };
    minimalWhenNotAlert: boolean;
    debugView?: React.ReactNode;
}

const captions: Record<Timing, readonly string[]> = {
    [Timing.Past]: ["Did you go?", "You were there!", "We missed you 😢", "You were (partially) there"],
    [Timing.Present]: ["Are you there?", "You are there!", "We're missing you 😢", "You are (partially) going"],
    [Timing.Future]: ["Are you going?", "You're going!", "We'll miss you 😢", "You're (partially) going"],
};

const InstrumentButton = ({ value, selected, onSelect }: {
    value: db3.InstrumentClientOrDbPayload | null;
    selected: boolean;
    onSelect: () => void;
}) => !value?.name ? null : <CMChip
    onClick={onSelect} shape="rounded" border="noBorder"
    className={`attendanceInstrument CMChipNoMargin ${selected ? "" : "HalfOpacity"}`}
    color={value.functionalGroup.color} tooltip={value.description}
    variation={{ enabled: true, fillOption: selected ? "filled" : "hollow", variation: selected ? "strong" : "weak", selected }}
>{value.name}</CMChip>;

const InstrumentControl = ({ response, environment }: {
    response: EventAttendanceResult["eventUserResponse"]; environment: AttendanceControlEnvironment;
}) => {
    const [inProgress, setInProgress] = React.useState(false);
    const instruments = response.user.instruments.map(ui => environment.instruments.find(
        instrument => db3.getInstrumentIdentity(instrument) === ui.instrumentId,
    )!);
    const selected = environment.instruments.find(
        instrument => db3.getInstrumentIdentity(instrument) === response.response.instrumentId,
    );
    const change = async (instrumentId: db3.InstrumentIdentity) => {
        setInProgress(true);
        try { await environment.onSave({ type: "instrument", instrumentId }); }
        catch { /* Feedback belongs to the adapter. */ }
        finally { setInProgress(false); }
    };
    if (instruments.length < 2) return null;
    return <NameValuePair name="Instrument" value={<CMChipContainer className="EventAttendanceResponseControlButtonGroup">
        {inProgress ? <CircularProgress size={16} /> : instruments.map(option => <InstrumentButton
            key={db3.getInstrumentIdentity(option)}
            value={option}
            selected={db3.getInstrumentIdentity(option) === (selected && db3.getInstrumentIdentity(selected))}
            onSelect={() => { void change(db3.getInstrumentIdentity(option)); }} />)}
    </CMChipContainer>} />;
};

const CommentEditor = ({ response, environment, onClose }: {
    response: EventAttendanceResult["eventUserResponse"]; environment: AttendanceControlEnvironment; onClose: () => void;
}) => {
    const [value, setValue] = React.useState(response.response.userComment || "");
    const save = async () => {
        try { await environment.onSave({ type: "comment", comment: value }); }
        catch { /* Feedback belongs to the adapter. */ }
    };
    return <AppContextMarker name="EventAttendanceCommentEditorDialog"><CMDialog
        open
        onClose={onClose}
        title={environment.commentDialogTitle}
        actions={<>
            <CMButton className="freeButton cancelButton" onClick={onClose}>Cancel</CMButton>
            <CMButton className="saveButton saveAndCloseButton freeButton changed" onClick={async () => { await save(); onClose(); }}>
                {gIconMap.CheckCircleOutline()}Save
            </CMButton>
        </>}
    >
        {environment.commentDialogDescription}
        <Markdown3Editor value={value} onChange={setValue} nominalHeight={200}
            handleSave={() => { void save(); }} allowUploads={environment.allowUploads}
            uploadFileContext={environment.allowUploads ? { taggedEventId: response.event.id } : undefined} />
    </CMDialog></AppContextMarker>;
};

const CommentControl = ({ response, environment }: {
    response: EventAttendanceResult["eventUserResponse"]; environment: AttendanceControlEnvironment;
}) => {
    const [editing, setEditing] = React.useState(false);
    return <div className={`ownAttendanceComment freeButton ${!editing && "clickToEdit"}`} onClick={!editing ? () => setEditing(true) : undefined}>
        <div>{editing ? <CommentEditor response={response} environment={environment} onClose={() => setEditing(false)} />
            : <Markdown markdown={response.response.userComment || ""} />}</div>
        <div className="clickToAddComment">Click to add/edit a comment</div>
    </div>;
};

const AnswerButton = ({ value, selected, noItemSelected, onSelect, tooltip }: {
    value: db3.EventAttendanceDisplay | null; selected: boolean; noItemSelected: boolean;
    onSelect: () => void; tooltip: string;
}) => <CMChip onClick={onSelect} shape="rectangle" size="big" color={value?.color} tooltip={tooltip}
    className={`attendanceAnswer ${isAttendanceGoing(value) ? "yes" : "no"} CMChipNoMargin`}
    variation={{ enabled: true, fillOption: "filled", variation: selected || noItemSelected ? "strong" : "weak", selected }}>
        {value?.text || "(no answer)"}{RenderMuiIcon(value?.iconName)}
    </CMChip>;

const AnswerControl = ({ segment, environment, forceEditMode, onReadonlyClick }: {
    segment: EventAttendanceResult["segmentUserResponses"][number]; environment: AttendanceControlEnvironment;
    forceEditMode: boolean; onReadonlyClick: () => void;
}) => {
    const [explicitEdit, setExplicitEdit] = React.useState(false);
    const [inProgress, setInProgress] = React.useState(false);
    const selectedId = segment.response.attendanceId;
    const selected = environment.attendances.find(a => a.id === selectedId) || null;
    const change = async (attendanceId: number | null) => {
        setInProgress(true);
        try {
            await environment.onSave({ type: "segment", segmentId: segment.segment.id, attendanceId });
            setExplicitEdit(false);
        } catch { /* Feedback belongs to the adapter. */ }
        finally { setInProgress(false); }
    };
    if (inProgress) return <CircularProgress size={16} />;
    return <CMChipContainer className="EventAttendanceResponseControlButtonGroup">
        {explicitEdit || forceEditMode ? <>
            {environment.attendances.filter(a => a.isActive).map(option => <AnswerButton key={option.id}
                value={option} selected={selectedId === option.id} noItemSelected={selectedId === null}
                onSelect={() => { void change(option.id); }} tooltip={option.description} />)}
            <AnswerButton value={null} selected={selectedId === null} noItemSelected={selectedId === null}
                onSelect={() => { void change(null); }} tooltip="Don't leave an answer now" />
        </> : <AnswerButton value={selected} selected noItemSelected={false}
            onSelect={() => { onReadonlyClick(); setExplicitEdit(true); }} tooltip={selected?.description || "Not answered yet"} />}
    </CMChipContainer>;
};

// The production adapter and the scenario page render this same interactive view.
export const AttendanceControlView = ({ attendance: y, environment, ...props }: AttendanceControlViewProps) => {
    const [userSelectedEdit, setUserSelectedEdit] = React.useState(false);
    const editMode = userSelectedEdit || !y.allowViewMode;
    if (!y.visible) return <>{props.debugView}</>;
    const captionIndex = !y.allUncancelledSegmentsAnswered ? 0 : y.allUncancelledSegmentsAffirmative ? 1 : y.allUncancelledSegmentResponsesNegative ? 2 : 3;
    const findAttendance = (id: number | null) => environment.attendances.find(a => a.id === id) || null;
    if (!userSelectedEdit && !y.alertFlag && y.anyAnswered && props.minimalWhenNotAlert) {
        return <div className="eventAttendanceControl minimalView"><CMChipContainer>
            <div className="caption">You responded</div>
            {y.uncancelledSegmentUserResponses.map(r => <AttendanceChipView key={r.segment.id}
                value={findAttendance(r.response.attendanceId)} onClick={() => setUserSelectedEdit(true)}
                event={props.event} eventSegment={r.segment}
                tooltip={<AttendanceChipTooltipContent value={findAttendance(r.response.attendanceId)} event={props.event} eventSegment={r.segment} />} />)}
            {props.debugView}
        </CMChipContainer></div>;
    }
    return <div className={`eventAttendanceControl ${y.alertFlag && "alert"}`}>
        {props.debugView}
        <div className="header">
            <div>{captions[y.eventTiming][captionIndex]}</div>
            {editMode && y.allowViewMode && <CMSmallButton variant="framed" onClick={() => setUserSelectedEdit(false)}>Close</CMSmallButton>}
        </div>
        <div className="attendanceResponseInput">
            <div className="comment"><CommentControl response={y.eventUserResponse} environment={environment} /></div>
            {editMode ? <>
                {y.allowInstrumentSelect && <div className="instrument"><InstrumentControl response={y.eventUserResponse} environment={environment} /></div>}
                <div className="segmentList">{y.uncancelledSegmentUserResponses.map(segment => <NameValuePair
                    key={segment.segment.id} className={y.isSingleSegment ? "bare" : ""} isReadOnly={false}
                    name={y.isSingleSegment ? null : <>{segment.segment.name} ({formatEventDateRange(getEventSegmentDateTimeRange(segment.segment), environment.datePresentation)})</>}
                    value={<>
                        <AnswerControl segment={segment} environment={environment} forceEditMode onReadonlyClick={() => setUserSelectedEdit(true)} />
                        <div className="helpText">{findAttendance(segment.response.attendanceId)?.description}</div>
                    </>} />)}</div>
            </> : <CMChipContainer>
                {y.allowInstrumentSelect && <InstrumentButton value={y.eventUserResponse.instrument} selected={false} onSelect={() => setUserSelectedEdit(true)} />}
                {y.uncancelledSegmentUserResponses.map(segment => <AnswerControl key={segment.segment.id}
                    segment={segment} environment={environment} forceEditMode={false} onReadonlyClick={() => setUserSelectedEdit(true)} />)}
            </CMChipContainer>}
        </div>
    </div>;
};
