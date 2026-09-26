import type { EventAttendancePublicId, EventPublicId } from "shared/publicId";
import { Icon } from "@mui/material";
import React from "react";
import type * as db3 from "src/core/db3/db3";
import { EventAPI } from "src/core/db3/shared/schema/event";
import { RenderMuiIcon } from "../../db3/components/IconMap";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import type { ColorVariationSpec } from "../color/palette";
import { DateValue } from "../DateTime/DateTimeComponents";

export interface AttendanceChipTooltipProps {
    value: db3.EventAttendanceDisplay | null;
    eventResponse?: Pick<db3.EventUserResponseClientPayload, "instrumentId" | "userComment"> | undefined;
    segmentResponse?: Pick<db3.EventDetailSegmentResponse, "attendanceId" | "createdAt" | "updatedAt" | "updatedByUser"> | undefined;
    event?: { publicId: EventPublicId; name: string; startsAt: Date | null } | undefined;
    eventSegment?: Pick<db3.EventDetailSegmentClient, "publicId" | "name" | "startsAt"> | undefined;
};
export const AttendanceChipTooltipContent = (props: AttendanceChipTooltipProps) => {
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
                {props.segmentResponse.updatedByUser?.name && `by ${props.segmentResponse.updatedByUser.name}`}
            </div>
        }
    </div>;
};
export interface AttendanceChipProps {
    event?: { publicId: EventPublicId; name: string; startsAt: Date | null } | undefined;
    eventSegment?: Pick<db3.EventDetailSegmentClient, "publicId" | "name" | "startsAt"> | undefined;
    eventResponse?: Pick<db3.EventUserResponseClientPayload, "instrumentId" | "userComment"> | undefined;
    segmentResponse?: Pick<db3.EventDetailSegmentResponse, "attendanceId" | "createdAt" | "updatedAt" | "updatedByUser"> | undefined;

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
