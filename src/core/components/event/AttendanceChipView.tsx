import type { EventAttendancePublicId } from "shared/publicId";
import { Icon } from "@mui/material";
import React from "react";
import type { Prisma } from "@prisma/client";
import type * as db3 from "src/core/db3/db3";
import { EventAPI } from "src/core/db3/shared/schema/event";
import { RenderMuiIcon } from "../../db3/components/IconMap";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import type { ColorVariationSpec } from "../color/palette";
import { DateValue } from "../DateTime/DateTimeComponents";

export interface AttendanceChipTooltipProps {
    value: db3.EventAttendanceDisplay | null;
    eventResponse?: Pick<db3.EventUserResponseClientPayload, "instrumentId" | "userComment"> | undefined;
    segmentResponse?: Pick<db3.EventSegmentUserResponseClientPayload, "attendanceId" | "createdByUserId" | "createdAt" | "updatedAt" | "updatedByUserId"> | undefined;
    event?: Prisma.EventGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
    eventSegment?: Pick<db3.EventVerbose_EventSegmentClient, "publicId" | "name" | "startsAt"> | undefined;
};
export const AttendanceChipTooltipContent = (props: AttendanceChipTooltipProps & { updatedByUserName?: string }) => {
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
                {EventAPI.getLabel(props.event)}
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
                {props.updatedByUserName && `by ${props.updatedByUserName}`}
            </div>
        }
    </div>;
};
export interface AttendanceChipProps {
    event?: Prisma.EventGetPayload<{ select: { id: true, name: true, startsAt: true } }> | undefined;
    eventSegment?: Pick<db3.EventVerbose_EventSegmentClient, "publicId" | "name" | "startsAt"> | undefined;
    eventResponse?: Pick<db3.EventUserResponseClientPayload, "instrumentId" | "userComment"> | undefined;
    segmentResponse?: Pick<db3.EventSegmentUserResponseClientPayload, "attendanceId" | "createdByUserId" | "createdAt" | "updatedAt" | "updatedByUserId"> | undefined;

    showLabel?: boolean | undefined;
    fadeNoResponse?: boolean | undefined;
    value: EventAttendancePublicId | db3.EventAttendanceDisplay | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export interface AttendanceChipViewProps extends Omit<AttendanceChipProps, "value"> {
    value: db3.EventAttendanceDisplay | null;
    tooltip: React.ReactNode;
}

export const AttendanceChipView = ({ fadeNoResponse = false, showLabel = true, ...props }: AttendanceChipViewProps) => {
    const value = props.value;
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
        tooltip={props.tooltip}
        style={style}
    >
        {RenderMuiIcon(value?.iconName)}
        {label}
    </CMChip>
}
