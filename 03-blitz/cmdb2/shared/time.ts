import dayjs, { Dayjs } from "dayjs";
import { assert } from "blitz";
import { isInRange } from "./utils";

export const gMillisecondsPerMinute = 60 * 1000;
export const gMillisecondsPerHour = 60 * gMillisecondsPerMinute;
export const gMillisecondsPerDay = 24 * gMillisecondsPerHour;

export function formatMillisecondsToDHMS(milliseconds: number): string {
    if (milliseconds === 0) {
        return "--";
    }

    const days = Math.floor(milliseconds / 86400000); // 86400000 milliseconds in a day
    milliseconds %= 86400000;

    const hours = Math.floor(milliseconds / 3600000); // 3600000 milliseconds in an hour
    milliseconds %= 3600000;

    const minutes = Math.floor(milliseconds / 60000); // 60000 milliseconds in a minute
    milliseconds %= 60000;

    const seconds = milliseconds / 1000;

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
        parts.push(`${seconds.toFixed(3)}s`);
    }

    return parts.join(' ');
}

export function formatTimeSpan(a: Date | null | undefined, b: Date | null | undefined): string {
    if (!a || !b) return "-";
    return formatMillisecondsToDHMS(Math.abs(b.valueOf() - a.valueOf()));
}

// for debugging
export const DateToDebugString = (x: Date | null | undefined) => {
    if (!x) return "<null>";
    return `${x.toDateString()} ${x.toTimeString()}`;
}

export const DateToYYYYMMDDHHMMSS = (x: Date) => {
    // https://stackoverflow.com/questions/19448436/how-to-create-date-in-yyyymmddhhmmss-format-using-javascript    
    return x.toISOString().replace(/[^0-9]/gm, "").substr(0, 14);
}


export function formatSongLength(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
        return "Invalid duration";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
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

export function floorToDay(x: Date) {
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

export function ceilToDay(x: Date): Date {
    if (x.getHours() === 0 && x.getMinutes() === 0 && x.getSeconds() === 0 && x.getMilliseconds() === 0) {
        return x;
    }

    const nextDay = new Date(x);
    nextDay.setDate(x.getDate() + 1);
    return floorToDay(nextDay);
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
function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
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





////////////////////////////////////////////////////////////////
export interface TimeOption {
    beginMillisecondOfDay: number;
    endMillisecondOfDay: number;
    millisSinceStart: number;
    time: Date;
    label: string;
    labelWithDuration: string;
    index: number;
}




export class TimeOptionsGenerator {
    private options: TimeOption[] = [];

    constructor(minuteIncrement: number, startFromMinuteOfDay: number) {
        if (minuteIncrement <= 0) {
            throw new Error("Invalid minute increment.");
        }

        startFromMinuteOfDay = floorToMinuteIntervalOfDay(startFromMinuteOfDay, minuteIncrement);

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const startFromMillisOfDay = startFromMinuteOfDay * gMillisecondsPerMinute;
        const millisecondIncrement = minuteIncrement * gMillisecondsPerMinute;
        for (let millisCursor = 0; millisCursor < gMillisecondsPerDay; millisCursor += millisecondIncrement) {
            const beginMillisecondOfDay = (startFromMillisOfDay + millisCursor) % gMillisecondsPerDay;
            const endMillisecondOfDay = (beginMillisecondOfDay + millisecondIncrement); // do not wrap! otherwise last entry would have a 0 and wouldn't match queries.
            const time = new Date(startDate.getTime() + beginMillisecondOfDay);
            const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            this.options.push({
                time,
                label,
                labelWithDuration: `${label} (${formatMillisecondsToDHMS(millisCursor)})`,
                beginMillisecondOfDay,
                endMillisecondOfDay,
                millisSinceStart: millisCursor,
                index: this.options.length,
            });
        }
    }

    getOptions(): TimeOption[] {
        return this.options;
    }

    findTime(time: Date): TimeOption {
        const millisecondOfDayToMatch = time.getHours() * 3600000 + time.getMinutes() * 60000;
        return this.options.find((n) => n.beginMillisecondOfDay <= millisecondOfDayToMatch && n.endMillisecondOfDay > millisecondOfDayToMatch)!;
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeRangeSpec {
    startsAtDateTime: Date | null; // date or null = TBD. if isAllDay, then the time part is ignored.
    // the idea is that startDateTime + durationDays = END time (exclusive).
    // for isAllDay=false, that's obvious.
    // for isAllDay=true, this should be treated as (durationDays * gMillisecondsPerDay). it is NOT safe to just add startDateTime + durationMillis in this case, 
    // because not all days are exactly the same duration, but for isAllDay=true, we want to always land on day boundaries.
    durationMillis: number;
    isAllDay: boolean;
};

export interface DateTimeRangeHitTestResult {
    inRange: boolean, // is the given datetime in the range? (false for TBD)
    isFirstDay: boolean, // does the given day represent the DAY of the beginning of the range?
    isLastDay: boolean, // does the given day represent the DAY of the end of the range? for a 1-day event on 12 Oct, testing any datetime with 12 Oct as the day will return true.
}

export class DateTimeRange {
    private spec: DateTimeRangeSpec;
    constructor(args?: DateTimeRangeSpec) {
        if (args) {
            // sanitize spec to conform to assertions.

            // all-day events have duration of 1-day increments always.
            const durationMillis = (args.isAllDay) ? (
                Math.round(args.durationMillis / gMillisecondsPerDay) * gMillisecondsPerDay
            ) : (
                args.durationMillis
            );

            // all-day events also must start at midnight.
            const startsAtDateTime = (args.startsAtDateTime && args.isAllDay) ? (
                floorToDay(args.startsAtDateTime)
            ) : (
                args.startsAtDateTime
            );

            this.spec = {
                durationMillis,
                startsAtDateTime,
                isAllDay: args.isAllDay,
            };
        }
        else {
            this.spec = {
                durationMillis: gMillisecondsPerHour,
                isAllDay: false,
                startsAtDateTime: new Date(),
            };
        }
    }

    getSpec(): DateTimeRangeSpec {
        return this.spec;
    }

    isTBD() {
        return !this.spec.startsAtDateTime;
    }

    isAllDay() {
        return this.spec.isAllDay;
    }

    // returns the same concept as spec.durationMillis really.
    getDurationMillis(): number {
        if (!this.spec.startsAtDateTime) {
            return 0; // TBD should probably return null, but this seems reasonable too.
        }
        if (!this.isAllDay()) {
            return this.spec.durationMillis;
        }
        // all-day event. means the duration should be aligned to day.
        assert(this.spec.durationMillis % gMillisecondsPerDay === 0, "for all-day events, durationMillis is expected to be aligned to day-long intervals.");
        return this.spec.durationMillis;
        // const start = this.getStartDateTime()!;
        // const end = this.getEndDateTime()!;
        //return (Math.round((end.valueOf() - start.valueOf()) / gMillisecondsPerDay) + 1) * gMillisecondsPerDay;
    }

    getDurationDays(): number {
        if (!this.spec.startsAtDateTime) {
            return 0; // TBD should probably return null, but this seems reasonable too.
        }
        // all-day event. means the duration should be aligned to day.
        if (this.isAllDay()) {
            assert(this.spec.durationMillis % gMillisecondsPerDay === 0, "for all-day events, durationMillis is expected to be aligned to day-long intervals.");
        }

        return this.spec.durationMillis / gMillisecondsPerDay;
    }

    toString() {
        if (this.isTBD()) {
            return "TBD";
        }
        if (this.isAllDay()) {
            return `${formatDate(this.getStartDateTime(new Date()))} - ${formatDate(this.getEndDateTime(new Date()))}`;
        }
        return `${formatDate(this.getStartDateTime(new Date()))} - ${formatDate(this.getEndDateTime(new Date()))}`;
        // Monday 4 October 2023, 18-19h
        // Monday 4 October 2023 - Wednesday 6 October 2023
    }

    durationToString() {
        return formatMillisecondsToDHMS(this.getDurationMillis());
    }

    isLessThan(rhs: DateTimeRange | null): boolean {
        if (this.isTBD()) return false; // TBD is considered late; in all cases it cannot be EARLIER (less than) rhs.
        if (rhs === null || rhs.isTBD()) {
            return true; // we have a date, but RHS does not. this < RHS always.
        }
        // both dates exist; no point in being more detailed than just comparing the start times.
        const lhsStart = this.getStartDateTime()!;
        const rhsStart = rhs.getStartDateTime()!;
        return lhsStart.valueOf() < rhsStart.valueOf();
    }

    // returns a datetime representing the start date + time.
    // returns null if "TBD"
    // if all-day, date part is correct and time is midnight.
    getStartDateTime<T extends Date | undefined>(fallbackValue?: T): T extends Date ? Date : Date | null {
        if (!this.spec.startsAtDateTime) {
            return fallbackValue || null as any;
        }
        if (this.isAllDay()) {
            return floorToDay(this.spec.startsAtDateTime) as T extends Date ? Date : Date | null;
        }
        return this.spec.startsAtDateTime as T extends Date ? Date : Date | null;
    }

    // returns a valid date/time for the end of the period.
    // it's trickier than it seems, because "end" can sometimes want to be inclusive or exclusive depending on how it's to be used.
    // for example a 1-day all-day event that starts on 12-Oct. Is the "end" midnight of 13-oct? Or 11:59.59.999 of 12-Oct?
    // this will follow idiomatic "END" meaning. therefore it returns effectively (startDateTime + days(durationMillis/gMillisecondsPerDay))
    // and this date will always fall JUST past the end of the range.
    getEndDateTime<T extends Date | undefined>(fallbackStartDate?: T): T extends Date ? Date : Date | null {
        const startDate = this.getStartDateTime(fallbackStartDate);
        if (!startDate) {
            return null as any;
        }
        if (!this.isAllDay()) {
            return new Date(startDate.valueOf() + this.spec.durationMillis);
        }

        const durationDays = this.getDurationDays();
        let ret = dayjs(startDate);
        ret = ret.add(durationDays, "day");
        return ret.toDate();
    }

    // returns a valid date/time for the last valid time of the period (this date will be IN range)
    getLastDateTime<T extends Date | undefined>(fallbackStartDate?: T): T extends Date ? Date : Date | null {
        const startDate = this.getStartDateTime(fallbackStartDate);
        if (!startDate) {
            return null as any;
        }
        if (!this.isAllDay()) {
            // console.log(`getLastDateTime: not all day`);
            return new Date(startDate.valueOf() + this.spec.durationMillis - 1);
        }

        const durationDays = this.getDurationDays();
        let ret = dayjs(startDate);
        ret = ret.add(durationDays, "day");

        // console.log(`getLastDateTime: duration days: ${durationDays}`);
        // console.log(`getLastDateTime: start date: ${startDate.toISOString()}`);
        // console.log(`getLastDateTime: END date (+days): ${ret.toISOString()}`);

        assert(ret.millisecond() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.second() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.minute() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.hour() === 0, "expecting this time to land on a midnight boundary.");

        ret = ret.add(-1, "millisecond");
        // console.log(`getLastDateTime: return date: ${ret.toISOString()}`);

        return ret.toDate();
    }

    // test a DAY and report significance
    hitTestDay(day: Dayjs): DateTimeRangeHitTestResult {
        const ret: DateTimeRangeHitTestResult = {
            inRange: false,
            isFirstDay: false,
            isLastDay: false,
        };

        const rangeBeginDate = this.getStartDateTime();
        if (!rangeBeginDate) return ret;
        const rangeBeginDjs = dayjs(rangeBeginDate);

        const rangeLastDate = this.getLastDateTime();
        if (!rangeLastDate) return ret;
        const rangeLastDjs = dayjs(rangeLastDate);

        const rangeEndDate = this.getEndDateTime();
        if (!rangeEndDate) return ret;
        //const rangeEndDjs = dayjs(rangeEndDate);

        if (rangeBeginDjs.isSame(day, "day")) {
            //ret.inRange = true;
            ret.isFirstDay = true;
        }
        if (rangeLastDjs.isSame(day, "day")) {
            //ret.inRange = true;
            ret.isLastDay = true;
        }
        if (isInRange(day.valueOf(), rangeBeginDate.valueOf(), rangeEndDate.valueOf())) {
            ret.inRange = true;
        }

        return ret;
    }

    unionWith(rhs: DateTimeRange): DateTimeRange {
        // between TBD and isAllDay, and the fact that our spec cannot represent certain things
        // (like known beginning but no known end, or different all-day-ness between start & end),
        // there's some discretion in doing this.

        if (rhs.isTBD()) {
            if (this.isTBD()) {
                return new DateTimeRange({ startsAtDateTime: null, isAllDay: true, durationMillis: 0 }); // both TBD.
            }
            // RHS is TBD but this is not. just return the range which is known.
            return new DateTimeRange(this.spec);
        } else {
            if (this.isTBD()) {
                // this is TBD but RHS is not.
                return new DateTimeRange(rhs.getSpec());
            }
        }

        // no TBD.
        const now = new Date();

        // success of this function is mesaured in some specific cases:
        // - identical 1-day events == the same 1-day event
        // - a 1-day event + similar <1day event == a 1-day event. (1-day + [midnight - 11:59] = 1-day.)
        // - ...
        const earliestStart = Math.min(this.getStartDateTime(now).valueOf(), rhs.getStartDateTime(now).valueOf());
        const isAllDay = this.isAllDay() || rhs.isAllDay(); // if either is all-day, then the union becomes all-day.

        if (isAllDay) {
            const latestLast = Math.max(this.getLastDateTime(now).valueOf(), rhs.getLastDateTime(now).valueOf());
            // operate in all-day terms. how do we convert a range from !allday to all-day?
            // look at the days it touches. if it even covers 1 millisecond of a day, include that day.
            let startdjs = new Dayjs(earliestStart);
            let enddjs = new Dayjs(latestLast);
            // count days in duration, ceil, convert to duration millis
            let durationDays = startdjs.diff(enddjs, "day");
            durationDays = Math.ceil(durationDays);

            return new DateTimeRange({
                startsAtDateTime: new Date(earliestStart),
                isAllDay: true,
                durationMillis: durationDays * gMillisecondsPerDay,
            });
        }

        const latestEnd = Math.max(this.getEndDateTime(now).valueOf(), rhs.getEndDateTime(now).valueOf());
        return new DateTimeRange({
            startsAtDateTime: new Date(earliestStart),
            isAllDay: false,
            durationMillis: latestEnd - earliestStart,
        });
    }
};

// true if lhs < rhs.
// NULL is considered LATE, because it suggests TBD in the future.
export const DateTimeRangeLessThan = (lhs: DateTimeRange | null, rhs: DateTimeRange | null): boolean => {
    if (lhs === null) {
        return false; // if LHS is null, it is either equalt to rhs (null) or later than it. either case, it's not less than (earlier).
    }
    return lhs.isLessThan(rhs);
};
