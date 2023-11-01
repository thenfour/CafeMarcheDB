import dayjs, { Dayjs } from "dayjs";
import { isBetween } from "./utils";

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
    startsAtDateTime: Date | null; // date or null = TBD
    durationMillis: number;
    isAllDay: boolean; // care about time or ignore it?
};

export interface DateTimeRangeHitTestResult {
    inRange: boolean,
    rangeStart: boolean,
    rangeEnd: boolean,
}

export class DateTimeRange {
    private spec: DateTimeRangeSpec;
    constructor(args?: DateTimeRangeSpec) {
        if (args) this.spec = { ...args };
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

    getDurationMillis(): number {
        if (this.isAllDay()) {
            if (!this.spec.startsAtDateTime) {
                return 0;
            }
            // will most always be aligned to day
            const start = this.getStartDateTime()!;
            const end = this.getEndDateTime()!;
            return (Math.round((end.valueOf() - start.valueOf()) / gMillisecondsPerDay) + 1) * gMillisecondsPerDay;
        }
        return this.spec.durationMillis;
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

    getStartDateTime<T extends Date | undefined>(fallbackValue?: T): T extends Date ? Date : Date | null {
        if (!this.spec.startsAtDateTime) {
            return fallbackValue || null as any;
        }
        if (this.isAllDay()) {
            return floorToDay(this.spec.startsAtDateTime) as T extends Date ? Date : Date | null;
        }
        return this.spec.startsAtDateTime as T extends Date ? Date : Date | null;
    }

    // returns the advertised end date (for 1 day events it will be the same as start date)
    getEndDateTime<T extends Date | undefined>(fallbackStartDate?: T): T extends Date ? Date : Date | null {
        const startDate = this.getStartDateTime(fallbackStartDate);
        if (!startDate) {
            return null as any;
        }
        const ret = new Date(startDate.valueOf() + this.spec.durationMillis);
        if (this.isAllDay()) {
            const x = ceilToDay(ret);
            x.setDate(x.getDate() - 1); // -1 to day
            return x;
        }
        return ret;
    }

    // returns the theoretical, comparable, end boundary time. this represents like C++ iterators the first value which is out of the range's bounds.
    getEndBound<T extends Date | undefined>(fallbackStartDate?: T): T extends Date ? Date : Date | null {
        const startDate = this.getStartDateTime(fallbackStartDate);
        if (!startDate) {
            return null as any;
        }
        const ret = new Date(startDate.valueOf() + this.getDurationMillis());
        return ret;
    }

    // for day comparisons, returns the 1st DAY which does not touch this range
    getEndBoundDay<T extends Date | undefined>(fallbackStartDate?: T): T extends Date ? Date : Date | null {
        if (this.spec.isAllDay) return this.getEndBound(fallbackStartDate); // for all-day, the normal getEndBound lands on midnight and represents this fine.
        const startDate = this.getStartDateTime(fallbackStartDate);
        if (!startDate) {
            return null as any;
        }
        const end = new Date(startDate.valueOf() + this.spec.durationMillis);
        // chop down to midnight, then add a day.
        const a = floorToDay(end);
        a.setDate(a.getDate() + 1);
        return a;
    }

    // test a DAY and report significance
    hitTestDay(day: Dayjs): DateTimeRangeHitTestResult {
        const ret = {
            inRange: false,
            rangeStart: false,
            rangeEnd: false,
        };

        const rangeBeginDate = this.getStartDateTime();
        if (!rangeBeginDate) return ret;
        const rangeBeginDjs = dayjs(rangeBeginDate);

        const rangeEndDate = this.getEndDateTime();
        if (!rangeEndDate) return ret;
        const rangeEndDjs = dayjs(rangeEndDate);

        if (rangeBeginDjs.isSame(day, "day")) {
            ret.inRange = true;
            ret.rangeStart = true;
        }
        if (rangeEndDjs.isSame(day, "day")) {
            ret.inRange = true;
            ret.rangeEnd = true;
        }
        if (isBetween(day.valueOf(), rangeBeginDate.valueOf(), rangeEndDate.valueOf())) {
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
        const laterEndBound = Math.max(this.getEndBound(now).valueOf(), rhs.getEndBound(now).valueOf());
        const earlierStartBound = Math.max(this.getStartDateTime(now).valueOf(), rhs.getStartDateTime(now).valueOf());
        return new DateTimeRange({
            startsAtDateTime: new Date(earlierStartBound),
            durationMillis: laterEndBound - earlierStartBound,
            isAllDay: this.isAllDay() || rhs.isAllDay(), // if either is all-day, then the union becomes all-day.
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
