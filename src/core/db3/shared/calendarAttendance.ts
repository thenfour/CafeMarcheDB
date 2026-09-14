import { isAttendanceGoing, isAttendanceNotGoing } from "shared/eventAttendance";

type CalendarAttendanceSegment = {
    statusId: number | null;
    responses: readonly { userId: number; attendanceId: number | null }[];
};

// Applies the subscriber's invitation and attendance preferences to a whole event.
// Event visibility, deletion and other export filters are handled separately.
export const shouldIncludeEventInCalendarFeed = (args: {
    userId: number;
    showDeclinedEvents: boolean;
    showUninvitedEvents: boolean;
    isInvited: boolean;
    segments: readonly CalendarAttendanceSegment[];
    cancelledStatusIds: ReadonlySet<number>;
    attendanceById: ReadonlyMap<number, { strength: number }>;
}): boolean => {
    const requiresGoingResponse = !args.showUninvitedEvents && !args.isInvited;
    if (args.showDeclinedEvents && !requiresGoingResponse) {
        return true;
    }
    // An explicit going response always satisfies both preferences. An unanswered
    // segment qualifies only when the invitation preference is already satisfied.
    return args.segments.some(segment => {
        if (segment.statusId != null && args.cancelledStatusIds.has(segment.statusId)) {
            // segment cancelled. i wonder if we need to centralize this logic as well,
            // into somethnig that can decide if a segment is "attendable"
            return false;
        }
        const response = segment.responses.find(response => response.userId === args.userId);
        const attendance = response?.attendanceId == null
            ? undefined : args.attendanceById.get(response.attendanceId);
        return requiresGoingResponse ? isAttendanceGoing(attendance) : !isAttendanceNotGoing(attendance);
    });
};
