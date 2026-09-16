import { BandTimeZoneSchema, CalendarDate, CalendarRange, getBandDateTimeFields, ZonedDate } from "./dateTimePolicy";
import type { DateTimeRange } from "./time";

export interface EventDatePresentation {
    viewerTimeZone: string;
    bandTimeZone: string;
    locale: string;
}

// return the timezone name to be used for presenting the event datetime.
// for all-day events, the band's tz is always used to decide which calendar day to display ("5 September 2026")
// otherwise, the viewer's tz is used to present the event datetime.
//
// kinda odd to expose this to callers, but it will be used to call formatShortDate() for example.
export function eventPresentationTimeZone(range: DateTimeRange, context: EventDatePresentation): string//
{
    return BandTimeZoneSchema.parse(range.isAllDay() ? context.bandTimeZone : context.viewerTimeZone);
}

/** Calendar days to display. Exclusive midnight ends add no day; points use their timestamp's date. */
// effectively converts a DateTimeRange into a CalendarRange, in the specified time zone.
export function getRangeCalendarDates(range: DateTimeRange, timeZone: string): CalendarRange | null {
    BandTimeZoneSchema.parse(timeZone); // validate the provided time zone
    const start = range.getStartDateTime();
    if (!start) {
        return null;
    }
    const lastDisplayedInstant = new Date(start.valueOf() + Math.max(0, range.getDurationMillis() - 1));
    return new CalendarRange(
        CalendarDate.fromInstant({ value: start, timeZone }),
        CalendarDate.fromInstant({ value: lastDisplayedInstant, timeZone }).addDays(1));
}

export function formatCalendarDate(date: CalendarDate, locale: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: date.timeZone }).format(date.toStartInstant());
}

export function formatZonedDate(date: ZonedDate, locale: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: BandTimeZoneSchema.parse(date.timeZone) }).format(date.value);
}

function dateParts(date: CalendarDate, locale: string, fields: Intl.DateTimeFormatPartTypes[]): string {
    const parts = new Intl.DateTimeFormat(locale, {
        timeZone: date.timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).formatToParts(date.toStartInstant());
    return fields.map(field => parts.find(part => part.type === field)!.value).join(" ");
}

function clock(value: Date, timeZone: string): string {
    const time = getBandDateTimeFields(value, timeZone).time;
    return `${Number(time.slice(0, 2))}${time.slice(3, 5) === "00" ? "" : `:${time.slice(3, 5)}`}`;
}

function presentRange(range: DateTimeRange, context: EventDatePresentation) {
    const timeZone = eventPresentationTimeZone(range, context);
    const dates = getRangeCalendarDates(range, timeZone);
    if (!dates) return null;
    const { start, last } = dates;
    const shortTimed = !range.isAllDay() && range.getDurationMillis() <= 86_400_000;
    const full = (date: CalendarDate) => dateParts(date, context.locale, ["day", "month", "year"]);
    const single = dates.dayCount === 1 || shortTimed;
    const date = single ? dateParts(start, context.locale, ["weekday", "day", "month", "year"])
        : start.date.slice(0, 7) === last.date.slice(0, 7) ? `${Number(start.date.slice(8))} - ${full(last)}`
            : start.date.slice(0, 4) === last.date.slice(0, 4) ? `${dateParts(start, context.locale, ["day", "month"])} - ${full(last)}`
                : `${full(start)} - ${full(last)}`;
    return { date, single, shortTimed, startClock: clock(range.getStartDateTime()!, timeZone), endClock: clock(range.getEndDateTime()!, timeZone) };
}

/** Compact event label: all-day dates in the band zone, timed dates in the viewer zone. */
export function formatEventDateRange(range: DateTimeRange, context: EventDatePresentation): string {
    const result = presentRange(range, context);
    if (!result) {
        return "TBD";
    }
    const date = result.single ? result.date.replace(/^([^ ]+) /, "$1, ") : result.date;
    return result.shortTimed ? `${date} @ ${result.startClock}-${result.endClock}h` : date;
}

export function formatEventDateRangeTranslations(range: DateTimeRange, context: EventDatePresentation) {
    const format = (locale: "en" | "fr" | "nl") => {
        const result = presentRange(range, { ...context, locale });
        if (!result) {
            return {
                date: {
                    en: "TBD",
                    fr: "À déterminer",
                    nl: "Nog te bepalen",
                }[locale]
            };
        }
        const suffix = locale === "nl" ? "u" : "h";
        return {
            date: result.date,
            time: result.shortTimed ? `${result.startClock}${suffix} - ${result.endClock}${suffix}` : undefined,
        };
    };
    return {
        en: format("en"),
        fr: format("fr"),
        nl: format("nl"),
    };
}
