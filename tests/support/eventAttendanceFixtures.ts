import { parsePublicId } from "shared/publicId";

export const attendancePublicId = (id: number) =>
    parsePublicId<"EventAttendance">(`Attendance${id.toString().padStart(6, "0")}`);
