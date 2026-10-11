import { Tooltip } from "@mui/material";
import React from "react";
import { CalendarDate } from "shared/dateTimePolicy";
import { getRelativeCalendarTiming } from "shared/time";


function formatShortDate(date: Date, formattingLocale: string, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat(formattingLocale, {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    // Use formatToParts to filter out punctuation
    const parts = formatter.formatToParts(date);
    return parts
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

interface DateValueProps {
    value: Date | undefined | null;
    formattingLocale: string;
    timeZone: string;
    className?: string;
    style?: React.CSSProperties;
    format?: (dateString: string) => React.ReactNode;
    showRelative?: boolean;
}

// file uploaded at, created at, event dates, etc.
export const DateValue = (props: DateValueProps) => {
    const now = React.useMemo(() => new Date(), []);
    if (!props.value) {
        return <span className={`DateValue null ${props.className}`} style={props.style}>--</span>;
    }

    const rel = getRelativeCalendarTiming(
        CalendarDate.fromInstant({ value: now, timeZone: props.timeZone }),
        CalendarDate.fromInstant({ value: props.value, timeZone: props.timeZone }),
    );
    const dateOptions = { timeZone: props.timeZone };
    const dayOfWeekLabel = props.value.toLocaleDateString(props.formattingLocale, { ...dateOptions, weekday: "long" });

    const valueString = formatShortDate(props.value, props.formattingLocale, props.timeZone);
    const valueNode = props.format ? props.format(valueString) : valueString;

    return <Tooltip title={
        <span>
            {dayOfWeekLabel}
            <br />
            {props.value.toLocaleDateString(props.formattingLocale, dateOptions)} {props.value.toLocaleTimeString(props.formattingLocale, dateOptions)}
            <br />
            {rel.label}
        </span>
    }>
        <span className={`DateValue ${props.className}`} style={props.style}>
            {valueNode}
            {props.showRelative && <> (<span className="RelativeIndicator">{rel.label}</span>)</>}
        </span>
    </Tooltip>;
}

