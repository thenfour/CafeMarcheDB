import { Icon } from "@mui/material";
import { Prisma } from "@prisma/client";
import { Suspense } from "react";
import * as db3 from "src/core/db3/db3";
import { RenderMuiIcon } from "../../db3/components/IconMap";
import { useDb3Query } from "../../db3/DB3Client";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";

// we want the tooltip to actually be quite complete.
// - the attendance response & description
// - the event name & date
// - last updated date & by whom
interface AttendanceChipTooltipProps {
    value: db3.EventAttendanceBasePayload | null;
    eventResponse?: Prisma.EventUserResponseGetPayload<{ select: { instrumentId: true, userComment: true } }> | undefined;
    segmentResponse?: Prisma.EventSegmentUserResponseGetPayload<{ select: { attendanceId: true, createdByUserId: true, createdAt: true, updatedAt: true, updatedByUserId: true } }> | undefined;
    event?: Prisma.EventGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
    eventSegment?: Prisma.EventSegmentGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
};
export const AttendanceChipTooltip = (props: AttendanceChipTooltipProps) => {
    const dashboardContext = useDashboardContext();

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
            items: [],
        },
        enable: userIds.length > 0,
    });

    const updatedByUser = fetchedUsers && props.segmentResponse?.updatedByUserId ? fetchedUsers.items.find(u => u.id === props.segmentResponse!.updatedByUserId) : undefined;

    return <div>
        <div className="attendanceChipTooltip">
            <div className="attendanceChipTooltipResponse">
                {props.value?.text || "No response"}
            </div>
            <div className="attendanceChipTooltipDescription" style={{ marginTop: "4px" }}>
                {props.value?.description || "No description"}
            </div>
        </div>
        {props.event &&
            <div className="attendanceChipTooltipEvent" style={{ marginTop: "4px" }}>
                {db3.EventAPI.getLabel(props.event)}
            </div>
        }
        {props.eventSegment?.name &&
            <div className="attendanceChipTooltipEventSegment" style={{ marginTop: "4px" }}>
                {props.eventSegment.name}
            </div>
        }
        {/* updated by user on ... */}
        {props.segmentResponse && props.segmentResponse.updatedAt &&
            <div className="attendanceChipTooltipUpdated" style={{ marginTop: "4px" }}>
                Updated on <DateValue value={props.segmentResponse.updatedAt} />
                {updatedByUser && `by ${updatedByUser.name}`}
            </div>
        }
    </div>;
};

export interface AttendanceChipProps {
    event?: Prisma.EventGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
    eventSegment?: Prisma.EventSegmentGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
    eventResponse?: Prisma.EventUserResponseGetPayload<{ select: { instrumentId: true, userComment: true } }> | undefined;
    segmentResponse?: Prisma.EventSegmentUserResponseGetPayload<{ select: { attendanceId: true, createdByUserId: true, createdAt: true, updatedAt: true, updatedByUserId: true } }> | undefined;

    showLabel?: boolean | undefined;
    fadeNoResponse?: boolean | undefined;
    value: number | db3.EventAttendanceBasePayload | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const AttendanceChip = ({ fadeNoResponse = false, showLabel = true, ...props }: AttendanceChipProps) => {
    let value = props.value;
    const dashboardContext = useDashboardContext();
    if (typeof value === "number") {
        value = dashboardContext.eventAttendance.getById(value);
    }
    let label: React.ReactNode = showLabel && (value?.text || "No response");
    if (!label && !value?.iconName) {
        label = <Icon />;
    }

    const style: React.CSSProperties = {};
    if (fadeNoResponse && !value) {
        style.opacity = "40%";
    }

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={`${props.className} AttendanceChip`}
        color={value?.color || null}
        shape="rectangle"
        tooltip={<Suspense><AttendanceChipTooltip
            value={value}
            event={props.event}
            eventSegment={props.eventSegment}
            eventResponse={props.eventResponse}
            segmentResponse={props.segmentResponse}
        /></Suspense>}
        style={style}
    >
        {RenderMuiIcon(value?.iconName)}
        {label}
    </CMChip>
}
