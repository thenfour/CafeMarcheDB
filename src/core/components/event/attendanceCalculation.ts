import type { Prisma } from "@prisma/client";
import type * as db3 from "src/core/db3/db3";
import { compareEventSegments } from "src/core/db3/shared/schema/prismArgs";
import { Timing } from "shared/time";
import { isAttendanceGoing, isAttendanceNotGoing } from "shared/eventAttendance";

type Segment = Prisma.EventSegmentGetPayload<{
    select: {
        id: true,
        name: true,
        statusId: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
    }
}>;

export interface EventAttendanceResult {
    eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
    segmentUserResponses: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>[];
    uncancelledSegmentUserResponses: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>[];

    noSegments: boolean;
    eventIsCancelled: boolean;
    eventTiming: Timing;
    eventIsPast: boolean;

    uncancelledSegments: Segment[];

    isInvited: boolean;
    isSingleSegment: boolean;

    allAttendances: (Prisma.EventAttendanceGetPayload<{}> | null)[];
    allUncancelledSegmentAttendances: (Prisma.EventAttendanceGetPayload<{}> | null)[];

    anyAnswered: boolean;
    allUncancelledSegmentsAnswered: boolean;
    allAffirmative: boolean;
    allUncancelledSegmentsAffirmative: boolean;
    someUncancelledSegmentResponsesAffirmative: boolean;
    allUncancelledSegmentResponsesNegative: boolean;

    alertFlag: boolean;
    minimalBecauseNotAlert: boolean;
    visible: boolean;

    allowViewMode: boolean;

    allowInstrumentSelect: boolean;
};

export interface EventAttendanceCalculationInput {
    eventUserResponse: EventAttendanceResult["eventUserResponse"];
    segmentUserResponses: EventAttendanceResult["segmentUserResponses"];
    segments: Segment[];//(Omit<db3.EventSegmentPayloadMinimum, "dateTimeVersion">)[];
    eventTiming: Timing;
    eventIsCancelled: boolean;
    cancelledStatusIds: number[];
    attendances: Prisma.EventAttendanceGetPayload<{}>[];
}

// Shared by production and the scenario page. Keep behavioral changes separate
// from this extraction so scenarios expose the existing decisions faithfully.
export const calculateEventAttendance = (props: EventAttendanceCalculationInput): EventAttendanceResult => {
    const isCancelledSegment = (segment: { statusId: number | null }) =>
        !!segment.statusId && props.cancelledStatusIds.includes(segment.statusId);
    const segmentUserResponses = [...props.segmentUserResponses].sort((a, b) =>
        compareEventSegments(a.segment, b.segment, props.cancelledStatusIds));
    const uncancelledSegments = props.segments.filter(s => !isCancelledSegment(s));

    const ret: EventAttendanceResult = {
        eventUserResponse: props.eventUserResponse,
        segmentUserResponses,
        uncancelledSegmentUserResponses: segmentUserResponses.filter(s => !isCancelledSegment(s.segment)),

        uncancelledSegments,

        noSegments: (uncancelledSegments.length < 1),
        eventIsCancelled: (props.eventIsCancelled),
        eventTiming: props.eventTiming,
        eventIsPast: props.eventTiming === Timing.Past,

        isInvited: false,
        isSingleSegment: false,

        allAttendances: [],
        allUncancelledSegmentAttendances: [],

        anyAnswered: false,
        allUncancelledSegmentsAnswered: false,
        allAffirmative: false,
        allUncancelledSegmentsAffirmative: false,
        someUncancelledSegmentResponsesAffirmative: false,
        allUncancelledSegmentResponsesNegative: false,

        alertFlag: false,
        minimalBecauseNotAlert: false,
        visible: false,

        allowViewMode: false,

        allowInstrumentSelect: false,
    };


    ret.isInvited = ret.eventUserResponse.isInvited;
    ret.isSingleSegment = uncancelledSegments.length === 1;// ret.segmentUserResponses.length === 1;

    ret.allAttendances = ret.segmentUserResponses.map(sr => props.attendances.find(a => a.id === sr.response.attendanceId) || null);
    ret.allUncancelledSegmentAttendances = ret.uncancelledSegmentUserResponses.map(sr => props.attendances.find(a => a.id === sr.response.attendanceId) || null);

    ret.anyAnswered = ret.allAttendances.some(r => !!r);

    ret.allUncancelledSegmentsAnswered = ret.allUncancelledSegmentAttendances.every(r => !!r);

    ret.allAffirmative = ret.allAttendances.every(isAttendanceGoing);
    ret.allUncancelledSegmentsAffirmative = ret.allUncancelledSegmentAttendances.every(isAttendanceGoing);
    ret.someUncancelledSegmentResponsesAffirmative = ret.allUncancelledSegmentAttendances.some(isAttendanceGoing);
    ret.allUncancelledSegmentResponsesNegative = ret.allUncancelledSegmentAttendances.every(isAttendanceNotGoing);

    ret.alertFlag = ret.isInvited && !ret.allUncancelledSegmentsAnswered && !ret.eventIsPast && !ret.eventIsCancelled;
    ret.visible = !ret.eventIsCancelled && !ret.noSegments && (ret.anyAnswered || ret.isInvited);

    // there are really just 2 modes here for simplicity
    // view (compact, instrument & segments on same line)
    // edit (full, instrument & segments on separate lines with full text)
    ret.allowViewMode = !ret.alertFlag;
    //const editMode = userSelectedEdit || !allowViewMode;

    // try to make the process slightly more linear by first asking about attendance. when you've answered that, THEN ask on what instrument.
    // also don't ask about instrument if all answers are negative.
    ret.allowInstrumentSelect = ret.allUncancelledSegmentsAnswered && ret.someUncancelledSegmentResponsesAffirmative;

    return ret;
};

