import { Suspense } from "react";
import * as db3 from "src/core/db3/db3";
import { useDb3Query } from "../../db3/DB3Client";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { AttendanceChipProps, AttendanceChipTooltipProps, AttendanceChipTooltipContent, AttendanceChipView } from "./AttendanceChipView";
export type { AttendanceChipProps } from "./AttendanceChipView";

export const AttendanceChipTooltip = (props: AttendanceChipTooltipProps) => {

    const userIds: number[] = [];
    if (props.segmentResponse?.updatedByUserId) {
        userIds.push(props.segmentResponse.updatedByUserId);
    }
    if (props.segmentResponse?.createdByUserId) {
        userIds.push(props.segmentResponse.createdByUserId);
    }
    const fetchedUsers = useDb3Query<db3.UserPayloadMinimum>({
        schema: db3.xUser,
        filterSpec: {
            pks: userIds,
        },
        enable: userIds.length > 0,
    });

    const updatedByUser = fetchedUsers && props.segmentResponse?.updatedByUserId ? fetchedUsers.items.find(u => u.id === props.segmentResponse!.updatedByUserId) : undefined;

    return <AttendanceChipTooltipContent {...props} updatedByUserName={updatedByUser?.name} />;
};

export const AttendanceChip = (props: AttendanceChipProps) => {
    const dashboardContext = useDashboardContext();
    const value = typeof props.value === "string" ? dashboardContext.eventAttendance.getById(props.value) : props.value;
    return <AttendanceChipView {...props} value={value} tooltip={<Suspense>
        <AttendanceChipTooltip
            value={value}
            event={props.event}
            eventSegment={props.eventSegment}
            eventResponse={props.eventResponse}
            segmentResponse={props.segmentResponse}
        />
    </Suspense>} />;
};
