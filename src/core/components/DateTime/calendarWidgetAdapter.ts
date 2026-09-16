import { CalendarDate, getCalendarWindow } from "shared/dateTimePolicy";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import type { DateTimeRange } from "shared/time";

// react-big-calendar requires native local Dates for calendar-only fields.
// These carriers stay inside this adapter and the widget's props.
export interface CalendarDisplayRange { start: Date; end: Date; allDay: boolean; }
export function calendarDateToWidgetDate(date: CalendarDate): Date {
    const [year, month, day] = date.date.split("-").map(Number);
    return new Date(year!, month! - 1, day!);
}
export function widgetDateToCalendarDate(date: Date, timeZone: string): CalendarDate {
    return new CalendarDate(`${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`, timeZone);
}
export function getCalendarWidgetRange(range: DateTimeRange, bandTimeZone: string): CalendarDisplayRange | null {
    const bounds = range.getBounds();
    if (!bounds) return null;
    if (!range.isAllDay()) return { ...bounds, allDay: false };
    const dates = getRangeCalendarDates(range, bandTimeZone)!;
    return { start: calendarDateToWidgetDate(dates.start), end: calendarDateToWidgetDate(dates.endExclusive), allDay: true };
}

export function getWidgetCalendarWindow(start: Date, endExclusive: Date, timeZone: string) {
    return getCalendarWindow({ startDate: widgetDateToCalendarDate(start, timeZone).date,
        endDateExclusive: widgetDateToCalendarDate(endExclusive, timeZone).date }, timeZone);
}
