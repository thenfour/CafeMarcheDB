import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { AttendanceChipProps, AttendanceChipTooltipContent, AttendanceChipView } from "./AttendanceChipView";
export type { AttendanceChipProps } from "./AttendanceChipView";

export const AttendanceChip = (props: AttendanceChipProps) => {
    const dashboardContext = useDashboardContext();
    const value = typeof props.value === "string" ? dashboardContext.eventAttendance.getById(props.value) : props.value;
    return <AttendanceChipView {...props} value={value} tooltip={<AttendanceChipTooltipContent {...props} value={value} />} />;
};
