type Attendance = { strength: number } | null | undefined;

export const isAttendanceGoing = (attendance: Attendance): boolean =>
    attendance != null && attendance.strength > 50;

// An unanswered response is neither going nor explicitly not going.
export const isAttendanceNotGoing = (attendance: Attendance): boolean =>
    attendance != null && !isAttendanceGoing(attendance);
