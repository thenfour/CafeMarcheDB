import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

export const DEFAULT_BAND_TIME_ZONE = "Europe/Brussels";

function isNamedTimeZone(value: string): boolean {
    if (!value || /^[+-]/.test(value)) return false;
    try {
        // Use a fixed instant: validation must not depend on today's season.
        const zone = Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
        // Temporal also accepts complete ISO timestamps as timezone-like input.
        // A setting must be the zone identifier itself, including supported aliases.
        return zone.timeZoneId.toLowerCase() === value.toLowerCase();
    } catch {
        return false;
    }
}

export const BandTimeZoneSchema = z.string().trim().refine(isNamedTimeZone, {
    message: "Use a named time zone such as Europe/Brussels, Asia/Tokyo, or UTC.",
});

// An absent setting uses the band's initial home zone. A malformed configured
// value is an error, so it cannot silently move event boundaries to another zone.
export function resolveBandTimeZone(value: string | null | undefined): string {
    return BandTimeZoneSchema.parse(value?.trim() || DEFAULT_BAND_TIME_ZONE);
}

export interface CalendarDateRange {
    startDate: string; // ISO YYYY-MM-DD, inclusive
    endDateExclusive: string; // ISO YYYY-MM-DD, exclusive
}

// kinda like DateTimeRange, but this is more of a simple value type to pass around
export interface InstantInterval {
    start: Date;
    end: Date; // exclusive
}

export interface ZonedDate {
    readonly value: Date;
    readonly timeZone: string;
}

/** A calendar day in a named zone; never a Date pretending to be an instant. */
export class CalendarDate {
    readonly date: string;
    readonly timeZone: string;
    constructor(date: string, timeZone: string) {
        this.date = calendarDate(date).toString();
        this.timeZone = BandTimeZoneSchema.parse(timeZone);
    }
    static fromInstant({ value, timeZone }: ZonedDate): CalendarDate {
        return new CalendarDate(getBandDateTimeFields(value, timeZone).date, timeZone);
    }
    addDays(days: number): CalendarDate { return new CalendarDate(addCalendarDays(this.date, days), this.timeZone); }
    daysUntil(other: CalendarDate): number {
        this.requireSameZone(other);
        return calendarDate(this.date).until(calendarDate(other.date)).days;
    }
    requireSameZone(other: CalendarDate): void {
        if (this.timeZone !== other.timeZone) throw new RangeError("Calendar dates must use the same timezone.");
    }
    toStartInstant(): Date {
        return new Date(calendarDate(this.date).toZonedDateTime(this.timeZone).epochMilliseconds);
    }
}

export interface CalendarDayHitTest { inRange: boolean; isFirstDay: boolean; isLastDay: boolean; }

// construct with getRangeCalendarDates
export class CalendarRange {
    constructor(readonly start: CalendarDate, readonly endExclusive: CalendarDate) {
        start.requireSameZone(endExclusive);
        if (start.date >= endExclusive.date) throw new RangeError("Calendar range must contain at least one day.");
    }
    get last(): CalendarDate { return this.endExclusive.addDays(-1); }
    get dayCount(): number { return this.start.daysUntil(this.endExclusive); }
    get dates(): CalendarDateRange { return { startDate: this.start.date, endDateExclusive: this.endExclusive.date }; }
    hitTest(day: CalendarDate): CalendarDayHitTest {
        this.start.requireSameZone(day);
        return {
            inRange: day.date >= this.start.date && day.date < this.endExclusive.date,
            isFirstDay: day.date === this.start.date,
            isLastDay: day.date === this.last.date,
        };
    }
}

// Calendar searches carry both representations: date-only events use calendar
// bounds, while timed events use the viewer's absolute midnight boundaries.
// dates are in format YYYY-MM-DD

export const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CalendarWindowSchema = z.object({
    startDate: CalendarDateSchema,
    endDateExclusive: CalendarDateSchema,
    startInstant: z.string().datetime(),
    endInstantExclusive: z.string().datetime(),
}).strict().superRefine((value, ctx) => {
    try {
        const calIsPositiveDuration = Temporal.PlainDate.compare(calendarDate(value.startDate), calendarDate(value.endDateExclusive)) < 0;
        const instIsPositiveDuration = Temporal.Instant.compare(Temporal.Instant.from(value.startInstant), Temporal.Instant.from(value.endInstantExclusive)) < 0;
        if (!calIsPositiveDuration || !instIsPositiveDuration) {
            throw new RangeError("Empty or reversed calendar window.");
        }
    } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use valid, increasing calendar and instant bounds." });
    }
});
export type CalendarWindow = z.infer<typeof CalendarWindowSchema>;

export function getCalendarWindow(dates: CalendarDateRange, viewerTimeZone: string): CalendarWindow {
    const interval = getAllDayInterval(dates, viewerTimeZone);
    return CalendarWindowSchema.parse({
        ...dates,
        startInstant: interval.start.toISOString(),
        endInstantExclusive: interval.end.toISOString(),
    });
}

export interface BandDateTimeFields {
    date: string; // ISO YYYY-MM-DD
    time: string; // HH:mm, with optional seconds and milliseconds
}

// parses YYYY-MM-DD formatted calendar date into a Temporal.PlainDate object.
function calendarDate(value: string): Temporal.PlainDate {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new RangeError("Expected a calendar date in YYYY-MM-DD format.");
    }
    return Temporal.PlainDate.from(value);
}

// parses HH:mm[:ss[.SSS]] formatted clock time into a Temporal.PlainTime object.
function clockTime(value: string): Temporal.PlainTime {
    if (!/^\d{2}:[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value)) {
        throw new RangeError("Expected a clock time in HH:mm or HH:mm:ss.SSS format.");
    }
    return Temporal.PlainTime.from(value);
}

// This is an authoring operation, never a way to hydrate a stored UTC instant.
// Conventional "compatible" disambiguation chooses the earlier occurrence of a
// repeated clock time and moves a nonexistent time forward by the DST gap.
export function bandDateTimeToInstant(fields: BandDateTimeFields, bandTimeZone: string): Date {
    const dateTime = calendarDate(fields.date).toPlainDateTime(clockTime(fields.time));
    const zoned = dateTime.toZonedDateTime(BandTimeZoneSchema.parse(bandTimeZone), {
        disambiguation: "compatible",
    });
    return new Date(zoned.epochMilliseconds);
}

// A clock-choice list can offer both repeated occurrences explicitly and omit
// skipped clocks. Free-form authoring still uses compatible disambiguation above.
export function getClockTimeOccurrences(fields: BandDateTimeFields, timeZone: string): Date[] {
    const dateTime = calendarDate(fields.date).toPlainDateTime(clockTime(fields.time));
    const zone = BandTimeZoneSchema.parse(timeZone);
    const candidates = [
        dateTime.toZonedDateTime(zone, { disambiguation: "earlier" }),
        dateTime.toZonedDateTime(zone, { disambiguation: "later" }),
    ];
    return candidates
        .filter(candidate => candidate.toPlainDateTime().equals(dateTime))
        .filter((candidate, index, values) => index === 0 || candidate.epochMilliseconds !== values[0]!.epochMilliseconds)
        .map(candidate => new Date(candidate.epochMilliseconds));
}

export function addCalendarDays(date: string, days: number): string {
    return calendarDate(date).add({ days }).toString();
}

// Formatting preserves the instant, including its exact occurrence during a
// repeated hour. The offset lets a later editor retain that distinction.
export function getBandDateTimeFields(instant: Date, bandTimeZone: string): BandDateTimeFields & { offset: string } {
    const zoned = Temporal.Instant.fromEpochMilliseconds(instant.valueOf())
        .toZonedDateTimeISO(BandTimeZoneSchema.parse(bandTimeZone));
    return {
        date: zoned.toPlainDate().toString(),
        time: zoned.toPlainTime().toString({ smallestUnit: "millisecond" }),
        offset: zoned.offset,
    };
}

// Resolve authored calendar bounds once, before storing the UTC span.
// Resolve each midnight separately: DST days need not last 24 hours.
export function getAllDayInterval(range: CalendarDateRange, bandTimeZone: string): InstantInterval {
    const startDate = calendarDate(range.startDate);
    const endDate = calendarDate(range.endDateExclusive);
    if (Temporal.PlainDate.compare(startDate, endDate) >= 0) {
        throw new RangeError("An all-day range must end after its start date.");
    }
    const timeZone = BandTimeZoneSchema.parse(bandTimeZone);
    return {
        start: new Date(startDate.toZonedDateTime(timeZone).epochMilliseconds),
        end: new Date(endDate.toZonedDateTime(timeZone).epochMilliseconds),
    };
}
