import { CalendarDate } from "shared/dateTimePolicy";
import { eventPresentationTimeZone } from "shared/dateTimePresentation";
import React from "react";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

function formatShortDate(date: Date, now: Date, locale: string, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(CalendarDate.fromInstant({ value: date, timeZone }).date.slice(0, 4) !== CalendarDate.fromInstant({ value: now, timeZone }).date.slice(0, 4) ? { year: "numeric" } : {})
    });
    return formatter.formatToParts(date)
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

export interface EventShortDateProps {
    dateRange: DateTimeRange;
    now: Date;
    locale?: string;
}

// Shared event-date presentation follows the dashboard's band/viewer policy.
export const EventShortDate = ({ dateRange, now, locale = navigator.language }: EventShortDateProps) => {
    const dashboardContext = useDashboardContext();
    const start = dateRange.getStartDateTime();
    if (!start) {
        // todo: TBD? or null?
        return null;
    }

    const displayTimeZone = eventPresentationTimeZone(dateRange, dashboardContext.eventDatePresentation);

    const relativeTiming = CalcRelativeTiming(now, dateRange, dashboardContext.eventDatePresentation);
    return <>
        {formatShortDate(start, now, locale, displayTimeZone)}
        <span className={`EventDateField container ${relativeTiming.bucket}`}><span className="RelativeIndicator">{relativeTiming.label}</span></span>
    </>;
};
