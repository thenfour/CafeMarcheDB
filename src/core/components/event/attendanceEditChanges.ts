import type { EventAttendancePublicId, EventSegmentPublicId } from "shared/publicId";
import type { TupdateUserEventAttendanceMutationArgs } from "src/core/db3/shared/apiTypes";
import type { EventResponses_MinimalEventUserResponse } from "src/core/db3/shared/schema/event";

type EventAnswer = Pick<EventResponses_MinimalEventUserResponse, "userComment" | "bandInstrumentId" | "isInvited">;
type SegmentAnswers = Readonly<Record<EventSegmentPublicId, { attendanceId: EventAttendancePublicId | null }>>;
type AttendanceChanges = Pick<TupdateUserEventAttendanceMutationArgs, "comment" | "instrumentId" | "isInvited" | "segmentResponses">;

/** Unchanged historical answers are retained without submitting them as new catalog choices. */
export function getAttendanceEditChanges(args: {
    initialEvent: EventAnswer;
    event: EventAnswer;
    initialSegments: SegmentAnswers;
    segments: SegmentAnswers;
    canManageInvitations: boolean;
}): AttendanceChanges {
    const initialSegments = new Map(Object.entries(args.initialSegments));
    const changedSegments = Object.entries(args.segments)
        .filter(([id, response]) =>
            initialSegments.get(id)?.attendanceId !== response.attendanceId);
    return {
        // event-level changes...
        ...(args.event.userComment !== args.initialEvent.userComment ? { comment: args.event.userComment } : {}),
        ...(args.event.bandInstrumentId !== args.initialEvent.bandInstrumentId ? { instrumentId: args.event.bandInstrumentId } : {}),
        ...(args.canManageInvitations && args.event.isInvited !== args.initialEvent.isInvited ? { isInvited: args.event.isInvited } : {}),

        // segment-level changes...
        ...(changedSegments.length > 0 ? {
            segmentResponses: Object.fromEntries(changedSegments.map(([id, response]) =>
                [id, { attendanceId: response.attendanceId }]))
        } : {}),
    };
}
