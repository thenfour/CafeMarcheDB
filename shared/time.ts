import { EventDatePresentation, eventPresentationTimeZone, getRangeCalendarDates } from './dateTimePresentation';
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { CalendarDate, addCalendarDays, CalendarDateRange, InstantInterval, getAllDayInterval, bandDateTimeToInstant, getBandDateTimeFields, getClockTimeOccurrences } from './dateTimePolicy';


dayjs.extend(weekOfYear);
dayjs.extend(utc);


export const gMillisecondsPerMinute = 60 * 1000;
export const gMillisecondsPerHour = 60 * gMillisecondsPerMinute;
export const gMillisecondsPerDay = 24 * gMillisecondsPerHour;


export function GetDateMinutesFromNow(minutes: number): Date {
    return new Date(Date.now() + minutes * gMillisecondsPerMinute);
};

export type DateInterval = {
    years?: number | undefined;
    months?: number | undefined;
    days?: number | undefined;
    hours?: number | undefined;
    minutes?: number | undefined;
    seconds?: number | undefined;
    milliseconds?: number | undefined;
}

export function DateAdd(date: Date, interval: DateInterval): Date {
    const newDate = new Date(date.getTime());
    if (interval.years) newDate.setFullYear(newDate.getFullYear() + interval.years);
    if (interval.months) newDate.setMonth(newDate.getMonth() + interval.months);
    if (interval.days) newDate.setDate(newDate.getDate() + interval.days);
    if (interval.hours) newDate.setHours(newDate.getHours() + interval.hours);
    if (interval.minutes) newDate.setMinutes(newDate.getMinutes() + interval.minutes);
    if (interval.seconds) newDate.setSeconds(newDate.getSeconds() + interval.seconds);
    if (interval.milliseconds) newDate.setMilliseconds(newDate.getMilliseconds() + interval.milliseconds);
    return newDate;
}

export function GetDateSecondsFromNow(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
};

// tests >= start and < end. start and end can be swapped
const isInRange = (number: number, a: number, b: number): boolean => {
    return number >= Math.min(a, b) && number < Math.max(a, b);
};


export enum Timing {
    Past = 'Past',
    Present = 'Present',
    Future = 'Future',
}


export function formatMillisecondsToDHMS(milliseconds: number): string {
    if (milliseconds === 0) {
        return "--";
    }

    //const isNegative = milliseconds < 0;
    milliseconds = Math.abs(milliseconds);

    const days = Math.floor(milliseconds / 86400000); // 86400000 milliseconds in a day
    milliseconds %= 86400000;

    const hours = Math.floor(milliseconds / 3600000); // 3600000 milliseconds in an hour
    milliseconds %= 3600000;

    const minutes = Math.floor(milliseconds / 60000); // 60000 milliseconds in a minute
    milliseconds %= 60000;

    const seconds = Math.floor(milliseconds / 1000);

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    if (seconds > 0) {
        parts.push(`${seconds}s`);
    }

    if (parts.length === 0) {
        return "--";
    }

    return parts.join(' ');
}

export function formatTimeSpan(a: Date | null | undefined, b: Date | null | undefined): string {
    if (!a || !b) return "-";
    return formatMillisecondsToDHMS(Math.abs(b.valueOf() - a.valueOf()));
}

export const DateToYYYYMMDDHHMMSS = (x: Date) => {
    // https://stackoverflow.com/questions/19448436/how-to-create-date-in-yyyymmddhhmmss-format-using-javascript    
    return x.toISOString().replace(/[^0-9]/gm, "").substr(0, 14);
}

// function to convert a Date object to a YYYYMMDD string format
export function DateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export function formatSongLength(totalSeconds: number): string | null {
    if (isNaN(totalSeconds) || totalSeconds < 0) return null;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds.toString();
    return `${minutes}:${formattedSeconds}`;
}

// Helper function to convert a Date object to a YYYY-MM-DD string format
export const DateToHyphenatedYYYYMMDD = (date: Date) =>
    `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

export function changeDateTimeRangeStartDate(range: DateTimeRange, date: string, timeZone: string): DateTimeRange {
    const spec = range.getSpec();
    if (spec.isAllDay) {
        const dates = getRangeCalendarDates(range, timeZone)!;
        return createAllDayRange({ startDate: date, endDateExclusive: addCalendarDays(date, dates.dayCount) }, timeZone);
    }
    const fields = getBandDateTimeFields(spec.startsAtDateTime!, timeZone);
    return new DateTimeRange({
        ...spec, startsAtDateTime: fields.date === date ? spec.startsAtDateTime
            : bandDateTimeToInstant({ date, time: fields.time }, timeZone)
    });
}

export function changeDateTimeRangeAllDay(range: DateTimeRange, isAllDay: boolean, timeZone: string, now: Date): DateTimeRange {
    const date = getRangeCalendarDates(range, timeZone)?.start.date ?? getBandDateTimeFields(now, timeZone).date;
    return isAllDay ? createAllDayRange({ startDate: date, endDateExclusive: addCalendarDays(date, 1) }, timeZone)
        : new DateTimeRange({
            isAllDay: false, durationMillis: gMillisecondsPerHour,
            startsAtDateTime: bandDateTimeToInstant({ date, time: getBandDateTimeFields(now, timeZone).time }, timeZone)
        });
}

// M:S format
// or just S format
export function parseSongLengthSeconds(value: string): number | null {
    if (value.includes(':')) {
        // Process "mm:ss" format
        const parts = value.split(':');
        if (parts.length !== 2) return null;

        const minutes = parseInt(parts[0]!, 10);
        const seconds = parseInt(parts[1]!, 10);

        if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds > 59) {
            return null;
        }

        return minutes * 60 + seconds;
    } else {
        // Process string as total seconds if it contains only digits
        const totalSeconds = parseInt(value, 10);
        if (isNaN(totalSeconds) || totalSeconds < 0) {
            return null;
        }

        return totalSeconds;
    }
}


export function combineDateAndTime(datePart: Date, timePart: Date): Date {
    // Extract year, month, and day from the datePart
    const year = datePart.getFullYear();
    const month = datePart.getMonth();
    const day = datePart.getDate();

    // Extract hours, minutes, and seconds from the timePart
    const hours = timePart.getHours();
    const minutes = timePart.getMinutes();
    const seconds = timePart.getSeconds();

    // Create a new Date object with the combined date and time
    const combinedDateTime = new Date(year, month, day, hours, minutes, seconds);

    return combinedDateTime;
}


export function floorToMinuteIntervalOfDay(minuteOfDay: number, intervalInMinutes: number) {
    const alignedMinuteOfDay = Math.floor(minuteOfDay / intervalInMinutes) * intervalInMinutes;
    return alignedMinuteOfDay;
}

export function roundToNearest15Minutes(date: Date) {
    const roundedMinutes = Math.ceil(date.getMinutes() / 15) * 15;
    const roundedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), roundedMinutes);
    return roundedDate;
}





export function floorLocalToLocalDay(x: Date) {
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

// the passed in date represents the correct date in local timezone. make a UTC date which represents that day.
export function floorLocalTimeToDayUTC(date: Date) {
    // Create a new Date object that represents midnight in UTC
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return utcDate;
}

export function getLocalMidnightFromUTCMidnight(utcMidnight) {
    const year = utcMidnight.getUTCFullYear();
    const month = utcMidnight.getUTCMonth();
    const day = utcMidnight.getUTCDate();
    const localMidnight = new Date(year, month, day);
    return localMidnight;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function getTimeOfDayInMillis(date: Date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes * gMillisecondsPerMinute;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function getTimeOfDayInMinutes(date: Date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = (hours * 60 + minutes);
    return totalMinutes;
}


// formats a single date; date must be valid.
// function formatDate(date: Date): string {
//     const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
//     return date.toLocaleDateString(undefined, options);
// }

// like a datediff or whatever to calculate age, measured in days.
export function DateSubtractInDays(a: Date, b: Date) {
    const ms = a.getTime() - b.getTime();
    return ms / gMillisecondsPerDay;
}

////////////////////////////////////////////////////////////////
export const IsEarlierDateWithLateNull = (a: Date | null, b: Date | null) => {
    if (a === null) {
        return false;// a is null; b must be earlier.
    }
    if (b === null) {
        return true; // b null; a must be earlier.
    }
    return a < b; // no nulls; return earliest date.
}

export const MinDateOrLateNull = (a: Date | null, b: Date | null) => {
    if (a === null) {
        if (b === null) {
            return null; // both null; forced null return.
        }
        return b;// a is null; b must be earlier.
    }
    if (b === null) {
        return a; // b null; a must be earlier.
    }
    return a < b ? a : b; // no nulls; return earliest date.
}

// null means in the future.
export const DateSortPredicateAsc = (a: Date | null, b: Date | null): number => {
    if (a === null && b === null) {
        return 0; // both are in the future, so they are considered equal
    }
    if (a === null) {
        return 1; // a is in the future, so it should come after b
    }
    if (b === null) {
        return -1; // b is in the future, so a should come before b
    }
    return a.getTime() - b.getTime(); // both are dates, so compare them
};
export const DateSortPredicateDesc = (a: Date | null, b: Date | null): number => {
    return DateSortPredicateAsc(a, b) * -1;
};




////////////////////////////////////////////////////////////////
export interface ClockTimeOption {
    clockTime: string; // HH:mm; a civil clock value, never an instant.
    millisecondOfDay: number;
}

export class TimeOptionsGenerator {
    private options: ClockTimeOption[] = [];

    constructor(minuteIncrement: number) {
        if (!Number.isInteger(minuteIncrement) || minuteIncrement <= 0 || minuteIncrement > 1440) {
            throw new Error("Invalid minute increment.");
        }
        for (let minute = 0; minute < 1440; minute += minuteIncrement) {
            const hours = Math.floor(minute / 60).toString().padStart(2, "0");
            const minutes = (minute % 60).toString().padStart(2, "0");
            this.options.push({ clockTime: `${hours}:${minutes}`, millisecondOfDay: minute * gMillisecondsPerMinute });
        }
    }

    getOptions(): readonly ClockTimeOption[] {
        return this.options;
    }
}

export interface DateTimeOption {
    instant: Date;
    label: string;
}

// Build choices for the event date, using the explicit authoring timezone.
// Each option owns the instant that will be saved, including a repeated hour for weird DST transitions
export function getDateTimeRangeTimeOptions(start: Date, end: Date, timeZone: string) {
    const clocks = new TimeOptionsGenerator(15).getOptions();
    const startFields = getBandDateTimeFields(start, timeZone);
    const endFields = getBandDateTimeFields(end, timeZone);

    // some instants occur multiple times due to repeated hours (e.g., during daylight saving time transitions)
    const makeOption = (instant: Date, repeated: boolean, includeDuration: boolean): DateTimeOption => {
        const fields = getBandDateTimeFields(instant, timeZone);
        const clock = fields.time.replace(/:00\.000$/, "").replace(/\.000$/, "");

        // offset is interesting informationally, to disambiguate repeated hours, but visually confusing,
        // and takes too much space for example in the datetime range dropdown,
        // which is already quite wide, and must be fixed-width (max width should stay small)
        //const offset = repeated ? ` (UTC${fields.offset})` : "";
        const offset = "";//repeated ? "*" : "";
        // this is also visually verbose; these timings are ordered and always within a day so it should be clear
        // without specifying this date. for the sake of UI space, omit.
        //const date = fields.date === startFields.date ? "" : ` on ${fields.date}`;
        const date = "";
        const elapsed = instant.valueOf() - start.valueOf();
        const milliseconds = elapsed % 1000;
        const duration = elapsed === 0 ? "0m" : [
            elapsed >= 1000 ? formatMillisecondsToDHMS(elapsed) : "",
            milliseconds ? `${milliseconds}ms` : "",
        ].filter(Boolean).join(" ");
        return { instant, label: `${clock}${offset}${date}${includeDuration ? ` (${duration})` : ""}` };
    };

    const startOptions: DateTimeOption[] = [];
    const endOptions: DateTimeOption[] = [];
    for (const clock of clocks) {
        const starts = getClockTimeOccurrences({ date: startFields.date, time: clock.clockTime }, timeZone);
        startOptions.push(...starts.map(instant => makeOption(instant, starts.length > 1, false)));

        // Preserve the current end date. On the start date, an earlier clock
        // rolls to tomorrow only when no remaining occurrence follows the start.
        let ends = endFields.date === startFields.date ? starts
            : getClockTimeOccurrences({ date: endFields.date, time: clock.clockTime }, timeZone);
        const clockHasPassed = ends.length ? ends.every(instant => instant < start)
            : clock.clockTime < startFields.time;
        if (clockHasPassed && endFields.date === startFields.date) {
            ends = getClockTimeOccurrences({ date: addCalendarDays(endFields.date, 1), time: clock.clockTime }, timeZone);
        }
        endOptions.push(...ends.filter(instant => instant >= start)
            .map(instant => makeOption(instant, ends.length > 1, true)));
    }

    const includeSelected = (options: DateTimeOption[], selected: Date, includeDuration: boolean): DateTimeOption => {
        let option = options.find(value => value.instant.valueOf() === selected.valueOf());
        if (!option) {
            const fields = getBandDateTimeFields(selected, timeZone);
            option = makeOption(new Date(selected), getClockTimeOccurrences(fields, timeZone).length > 1, includeDuration);
            options.push(option);
        }
        options.sort((a, b) => a.instant.valueOf() - b.instant.valueOf());
        return option;
    };
    const selectedStart = includeSelected(startOptions, start, false);
    const selectedEnd = includeSelected(endOptions, end, true);
    return { startOptions, endOptions, selectedStart, selectedEnd };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeRangeSpec {
    startsAtDateTime: Date | null;
    durationMillis: number;
    isAllDay: boolean;
}

/** An exact half-open UTC span. All-day intent never changes its arithmetic. */
export class DateTimeRange {
    private readonly spec: DateTimeRangeSpec;

    constructor(args: DateTimeRangeSpec = { startsAtDateTime: new Date(), durationMillis: gMillisecondsPerHour, isAllDay: false }) {
        if (!Number.isSafeInteger(args.durationMillis) || args.durationMillis < 0) throw new RangeError("Invalid elapsed duration.");
        if (args.startsAtDateTime && !Number.isFinite(new Date(args.startsAtDateTime.valueOf() + args.durationMillis).valueOf())) throw new RangeError("Invalid instant.");
        this.spec = { ...args, startsAtDateTime: args.startsAtDateTime ? new Date(args.startsAtDateTime) : null };
    }

    toSerializableString(): string { return JSON.stringify(this.spec); }
    getSpec(): DateTimeRangeSpec { return { ...this.spec, startsAtDateTime: this.getStartDateTime() }; }
    isTBD(): boolean { return this.spec.startsAtDateTime === null; }
    isAllDay(): boolean { return this.spec.isAllDay; }
    getDurationMillis(): number { return this.isTBD() ? 0 : this.spec.durationMillis; }

    getStartDateTime(): Date | null {
        return this.spec.startsAtDateTime ? new Date(this.spec.startsAtDateTime) : null;
    }

    getEndDateTime(): Date | null {
        const start = this.spec.startsAtDateTime;
        return start ? new Date(start.valueOf() + this.spec.durationMillis) : null;
    }

    getBounds(): InstantInterval | null {
        const start = this.getStartDateTime();
        return start ? { start, end: this.getEndDateTime()! } : null;
    }

    hitTestDateTime(instant: Date): Timing {
        if (!Number.isFinite(instant.valueOf())) throw new RangeError("Invalid comparison instant.");
        const bounds = this.getBounds();
        if (!bounds || instant < bounds.start) return Timing.Future;
        return instant >= bounds.end ? Timing.Past : Timing.Present;
    }

    isLessThan(rhs: DateTimeRange | null): boolean {
        return !this.isTBD() && (!rhs || rhs.isTBD() || this.spec.startsAtDateTime! < rhs.spec.startsAtDateTime!);
    }

    /** Smallest enclosing span, including gaps between its members. */
    static union(ranges: readonly DateTimeRange[]): DateTimeRange {
        const known = ranges.filter(range => !range.isTBD());
        if (!known.length) return new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true });
        const start = Math.min(...known.map(range => range.spec.startsAtDateTime!.valueOf()));
        const end = Math.max(...known.map(range => range.spec.startsAtDateTime!.valueOf() + range.spec.durationMillis));
        return new DateTimeRange({
            startsAtDateTime: new Date(start), durationMillis: end - start,
            isAllDay: known.every(range => range.isAllDay())
        });
    }

    unionWith(rhs: DateTimeRange): DateTimeRange { return DateTimeRange.union([this, rhs]); }
}

export function createAllDayRange(dates: CalendarDateRange, timeZone: string): DateTimeRange {
    const { start, end } = getAllDayInterval(dates, timeZone);
    return new DateTimeRange({ startsAtDateTime: start, durationMillis: end.valueOf() - start.valueOf(), isAllDay: true });
}

// true if lhs < rhs.
// NULL is considered LATE, because it suggests TBD in the future.
export const DateTimeRangeLessThan = (lhs: DateTimeRange | null, rhs: DateTimeRange | null): boolean => {
    if (lhs === null) {
        return false; // if LHS is null, it is either equalt to rhs (null) or later than it. either case, it's not less than (earlier).
    }
    return lhs.isLessThan(rhs);
};



export function calculateCalendarWeeksDistance(date1: dayjs.Dayjs, date2: dayjs.Dayjs): number {
    // Calculate the start of the week for each date
    const startOfWeek1 = date1.startOf('week');
    const startOfWeek2 = date2.startOf('week');

    // Calculate the difference in days between the start of the weeks
    const diffInDays = startOfWeek2.diff(startOfWeek1, 'day');

    // Calculate the difference in calendar weeks
    const diffInWeeks = Math.floor(diffInDays / 7);

    return diffInWeeks;
}

export function calculateCalendarMonthsDistance(date1: dayjs.Dayjs, date2: dayjs.Dayjs): number {
    // Calculate the year and month components of each date
    const year1 = date1.year();
    const month1 = date1.month();
    const year2 = date2.year();
    const month2 = date2.month();

    // Calculate the difference in months
    const diffInMonths = (year2 - year1) * 12 + (month2 - month1);

    return diffInMonths;
}



export enum RelativeTimingBucket {
    YearsAgo = "YearsAgo",
    MonthsAgo = "MonthsAgo",
    WeeksAgo = "WeeksAgo",
    LastWeek = "LastWeek",
    DaysAgo = "DaysAgo",
    Yesterday = "Yesterday",
    HappeningNow = "HappeningNow",
    Today = 'Today',
    Tomorrow = 'Tomorrow',
    InDays = 'InDays', // after tomorrow but no more than 4 days
    NextWeek = 'NextWeek',
    InWeeks = 'InWeeks', // after this week, but up to 7 weeks
    NextMonth = "NextMonth",
    InMonths = 'InMonths', // 8+ weeks expressed in months
    InYears = "InYears",
    TBD = "TBD", // indeterminate time is assumed to be in the future.
};

export interface RelativeTimingInfo {
    bucket: RelativeTimingBucket,
    label: string, // e.g. "in 4 months", "today", "last week", "2 weeks ago"
};

// Compare the dates printed on the viewer's calendar. All-day placement retains
// the band's selected dates; "today" is the viewer's date. Lifecycle is separate.
//
// why is context needed?
// because we're comparing date ranges and calendar-relative things, where we select
// bands or viewer's timezones based on isAllDay and other context.
export function CalcRelativeTiming(refTime: Date, range: DateTimeRange, context: EventDatePresentation): RelativeTimingInfo {
    // Check if the range is TBD
    if (range.isTBD()) {
        return {
            bucket: RelativeTimingBucket.TBD,
            label: "TBD",
        };
    }

    const timing = range.hitTestDateTime(refTime);
    if (!range.isAllDay() && timing === Timing.Present) {
        return {
            bucket: RelativeTimingBucket.HappeningNow,
            label: "Happening now",
        };
    }
    const dates = getRangeCalendarDates(range, eventPresentationTimeZone(range, context))!;
    const today = CalendarDate.fromInstant({ value: refTime, timeZone: context.viewerTimeZone });
    if (range.isAllDay() && dates.start.date <= today.date && today.date < dates.endExclusive.date) return { bucket: RelativeTimingBucket.Today, label: "Today" };
    return getRelativeCalendarTiming(today, dates.start);
}

// Calendar-relative labels are shared by event ranges and point timestamps.
// Only the event entry point above can supply an ongoing interval.
function getRelativeCalendarTiming(refDate: CalendarDate, date: CalendarDate): RelativeTimingInfo {
    // today can be in the past or future so do that first
    const refTime = dayjs.utc(refDate.date);
    const startDate = dayjs.utc(date.date);
    if (startDate.isSame(refTime, "day")) {
        return { bucket: RelativeTimingBucket.Today, label: "Today" };
    }

    const refTimeN = refTime.startOf("day");
    const startDateN = startDate.startOf("day");
    const diffDays = Math.abs(startDateN.diff(refTimeN, "day"));

    if (startDate.isBefore(refTime, "day")) {
        const yesterday = dayjs(refTimeN).add(-1, "d");
        const diffWeeks = Math.abs(calculateCalendarWeeksDistance(startDate, dayjs(refTime)));

        if (yesterday.isSame(startDate, "d")) return { bucket: RelativeTimingBucket.Yesterday, label: "Yesterday" };
        if (diffWeeks < 3) return { bucket: RelativeTimingBucket.DaysAgo, label: `${diffDays} days ago` };

        //if (diffWeeks <= 1) return { bucket: RelativeTimingBucket.LastWeek, label: `Last week` };

        if (diffWeeks < 8) return { bucket: RelativeTimingBucket.WeeksAgo, label: `${diffWeeks} weeks ago` };

        const diffMonths = Math.abs(calculateCalendarMonthsDistance(startDate, dayjs(refTime)));
        if (diffMonths <= 18) return { bucket: RelativeTimingBucket.MonthsAgo, label: `${diffMonths} months ago` };

        const diffYears = Math.round(Math.max(1, diffMonths / 12));
        return { bucket: RelativeTimingBucket.YearsAgo, label: `${diffYears} years ago` };
    }

    const tomorrow = dayjs(refTimeN).add(1, "d");

    const diffWeeks = Math.abs(calculateCalendarWeeksDistance(startDateN, refTimeN));

    if (tomorrow.isSame(startDate, "d")) return { bucket: RelativeTimingBucket.Tomorrow, label: "Tomorrow" };
    if (diffWeeks < 3) return { bucket: RelativeTimingBucket.InDays, label: `In ${diffDays} days` }; // days still count for quite a while. "in 12 days" e.g. is better than in 1 or 2 weeks; in 7 days is better than "next week" even.

    // "in 3 weeks"
    //if (diffWeeks === 1) return { bucket: RelativeTimingBucket.NextWeek, label: `Next week` };

    if (diffWeeks < 8) return { bucket: RelativeTimingBucket.InWeeks, label: `In ${diffWeeks} weeks` };

    const diffMonths = Math.abs(calculateCalendarMonthsDistance(startDate, dayjs(refTime)));//  Math.round(Math.max(1, diffDays / 30));
    //if (diffMonths <= 1) return { bucket: RelativeTimingBucket.NextMonth, label: `Next month` };
    if (diffMonths <= 18) return { bucket: RelativeTimingBucket.InMonths, label: `In ${diffMonths} months` };

    const diffYears = Math.round(Math.max(1, diffMonths / 12));
    return { bucket: RelativeTimingBucket.InYears, label: `In ${diffYears} years` };
}


export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;


export function CalcRelativeTimingFromNow(date: Date, now?: Date | undefined): RelativeTimingInfo {
    const refTime = now || new Date();
    const timeZone = localTimeZone();
    return getRelativeCalendarTiming(
        CalendarDate.fromInstant({ value: refTime, timeZone }),
        CalendarDate.fromInstant({ value: date, timeZone })
    );
}
