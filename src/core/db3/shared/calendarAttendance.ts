import { isAttendanceNotGoing } from "shared/eventAttendance";

type CalendarAttendanceSegment = {
    statusId: number | null;
    responses: readonly { userId: number; attendanceId: number | null }[];
};

// technically this is only part of the logic; this is about checking whether it should
// be included based on user attendance (for example it doesn't check deletion, authorization, or other filters...)
export const shouldIncludeEventInCalendarFeed = (args: {
    userId: number;
    showDeclinedEvents: boolean;
    segments: readonly CalendarAttendanceSegment[];
    cancelledStatusIds: ReadonlySet<number>;
    attendanceById: ReadonlyMap<number, { strength: number }>;
}): boolean => {
    if (args.showDeclinedEvents) {
        return true;
    }
    // return true if the user is going to or hasn't responded to at least 1 valid event segment.
    return args.segments.some(segment => {
        if (segment.statusId != null && args.cancelledStatusIds.has(segment.statusId)) {
            // segment cancelled. i wonder if we need to centralize this logic as well,
            // into somethnig that can decide if a segment is "attendable"
            return false;
        }
        const response = segment.responses.find(response => response.userId === args.userId);
        if (!response) {
            // user hasn't responded to this segment yet
            return true;
        }

        const attendance = response.attendanceId == null
            ? undefined : args.attendanceById.get(response.attendanceId);
        return !isAttendanceNotGoing(attendance);
    });
};
