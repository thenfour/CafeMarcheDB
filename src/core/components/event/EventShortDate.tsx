import React from "react";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";

function formatShortDate(date: Date, now: Date, locale: string): string {
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {})
    });
    return formatter.formatToParts(date)
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

export interface EventShortDateProps {
    dateRange: DateTimeRange;
    now: Date;
    timeZone: string;
    locale?: string;
}

export const EventShortDate = ({ dateRange, now, timeZone, locale = navigator.language }: EventShortDateProps) => {
    // The range supplies a local calendar-date carrier for all-day events and
    // the exact instant for timed events. A raw stored start cannot do both.
    const start = dateRange.getStartDateTime();
    if (!start) return null;
    const relativeTiming = CalcRelativeTiming(now, dateRange, timeZone);
    return <>
        {formatShortDate(start, now, locale)}
        <span className={`EventDateField container ${relativeTiming.bucket}`}><span className="RelativeIndicator">{relativeTiming.label}</span></span>
    </>;
};
