
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

//import dynamic from 'next/dynamic';
import { Prisma } from "db";
import React from "react";
import { CoalesceBool, getHashedColor, IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { CMChip, CMChipSizeOptions, CMStandardDBChip } from "../CMChip";
import { useDashboardContext } from "../DashboardContext";
import { getURIForEvent } from "../../db3/clientAPILL";
import { CMStatusIndicator } from "../CMCoreComponents";
import { Tooltip } from "@mui/material";
import { Markdown } from "../markdown/Markdown";
import { RenderMuiIcon } from "../../db3/components/IconMap";
import { ColorVariationSpec, StandardVariationSpec } from "../color/palette";
import { GetStyleVariablesForColor } from "../color/ColorClientUtils";
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency

export interface EventStatusChipProps {
    statusId: number | null | undefined;
    highlightStatusIds?: number[];
    displayStyle?: "default" | "iconOnly";
    size?: "small" | "big";
};


export const EventStatusChip = ({ statusId, highlightStatusIds = [], displayStyle = "default", size }: EventStatusChipProps) => {
    const dashboardContext = useDashboardContext();
    const status = dashboardContext.eventStatus.getById(statusId);
    if (!status) return null;
    return <CMStandardDBChip
        variation={{ ...StandardVariationSpec.Strong, selected: highlightStatusIds.includes(statusId || -1) }}
        border='border'
        shape="rectangle"
        model={status}
        getTooltip={_ => status?.description || null}
        iconOnly={displayStyle === "iconOnly"}
        size={size}
    />

};


export interface EventChipProps {
    value: Prisma.EventGetPayload<{
        select: {
            id: true,
            name: true,
            startsAt: true,
            statusId: true,
            typeId: true
        }
    }>;
    showDate?: boolean;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const EventChip = (props: EventChipProps) => {
    const dashboardContext = useDashboardContext();

    // cancelled events should be shown with a strikethrough
    const status = dashboardContext.eventStatus.getById(props.value.statusId);
    //const isCancelled = status?.significance === db3.EventStatusSignificance.Cancelled;

    return <CMChip
        variation={props.variation}
        size={props.size}
        href={getURIForEvent(props.value)}
        className={`eventChip ${status?.significance} ${props.className}`}
        color={props.useHashedColor ? undefined : dashboardContext.eventType.getById(props.value.typeId)?.color}
        tooltip={<div>
            <div>{db3.EventAPI.getLabel(props.value, { truncate: false })}</div>
            <div><EventStatusChip statusId={props.value.statusId} /></div>
        </div>
        }
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {db3.EventAPI.getLabel(props.value, { showDate: CoalesceBool(props.showDate, true) })}
        </span>
        {props.endAdornment}
    </CMChip>
}



export const EventStatusMinimal = ({ statusId }: { statusId: number | null | undefined }) => {
    const dashboardContext = useDashboardContext();
    const status = dashboardContext.eventStatus.getById(statusId);
    if (!status) return null;
    const style = GetStyleVariablesForColor({ color: status.color, ...StandardVariationSpec.Strong });

    return <Tooltip title={<div>
        <div className="tooltipTitle">{status.label}</div>
        <Markdown markdown={status.description || ""} />
    </div>}>
        <span className={`iconIndicator ${style.cssClass}`} style={style.style}>
            {IsNullOrWhitespace(status.iconName) ? status.label : RenderMuiIcon(status.iconName)}
        </span>
    </Tooltip>;

};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EventStatusValueProps {
    onClick?: () => void;
    statusId: number | null | undefined;
    size: "small";
};
export const EventStatusValue = (props: EventStatusValueProps) => {
    const dashboardContext = useDashboardContext();
    const status = dashboardContext.eventStatus.getById(props.statusId);
    return status && (<CMStatusIndicator size={props.size} model={status} onClick={props.onClick} getText={o => o?.label || ""} />);
};

