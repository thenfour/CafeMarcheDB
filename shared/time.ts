import dayjs, { Dayjs } from "dayjs";
import weekOfYear from 'dayjs/plugin/weekOfYear';

import { assert } from "blitz";

dayjs.extend(weekOfYear);


export const gMillisecondsPerMinute = 60 * 1000;
export const gMillisecondsPerHour = 60 * gMillisecondsPerMinute;
export const gMillisecondsPerDay = 24 * gMillisecondsPerHour;


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

    const isNegative = milliseconds < 0;
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

export function formatSongLength(totalSeconds: number): string | null {
    if (isNaN(totalSeconds) || totalSeconds < 0) return null;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds.toString();
    return `${minutes}:${formattedSeconds}`;
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
function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

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
export type DateTimeDisplayString = {
    date: string;
    time?: string | undefined;
};
export type DateTimeDisplayStrings = {
    en: DateTimeDisplayString,
    fr: DateTimeDisplayString,
    nl: DateTimeDisplayString,
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeRangeSpec {
    // date or null = TBD.
    // if isAllDay, then the time part is to be ignored. in this case the date shall be a UTC date.
    startsAtDateTime: Date | null;
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
            if (args.isAllDay) {
                let days = Math.round(args.durationMillis / gMillisecondsPerDay);// all-day events have duration of 1-day increments always.
                if (days < 1) days = 1; // 0-length ranges are not useful and cause complexity
                const durationMillis = days * gMillisecondsPerDay;

                // all-day events also must start at midnight. use UTC tz for all-day events to keep a consistent midnight
                const startsAtDateTime = args.startsAtDateTime ? floorLocalTimeToDayUTC(args.startsAtDateTime) : null;

                this.spec = {
                    durationMillis,
                    startsAtDateTime,
                    isAllDay: args.isAllDay,
                };
                return;
            }

            // not all-day.
            // snap duration to 15-minute increments.
            const gIntervalLen = (gMillisecondsPerMinute * 15);
            let intervals = Math.round(args.durationMillis / gIntervalLen);// all-day events have duration of 1-day increments always.
            if (intervals < 1) intervals = 1; // 0-length ranges are not useful and cause complexity
            const durationMillis = intervals * gIntervalLen;

            // snap start time to 15-minute increment.
            const startsAtDateTime = args.startsAtDateTime ? roundToNearest15Minutes(args.startsAtDateTime) : null;

            this.spec = {
                durationMillis,
                startsAtDateTime,
                isAllDay: args.isAllDay,
            };
            return;
        }

        this.spec = {
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
            startsAtDateTime: new Date(),
        };
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

    // Enhanced toString method
    public toString(): string {
        if (this.isTBD()) {
            return "TBD";
        }

        // returns the time part, either as HH or HH:MM
        const formatTime = (date: Date): string => {
            const hour = dayjs(date).hour();
            const minutes = dayjs(date).minute();
            if (minutes === 0) {
                return `${hour}`; // Return only hour with 'h' if minutes are 0
            }
            return `${hour}:${minutes.toString().padStart(2, '0')}`; // Return full time with minutes and 'h' suffix
        };

        // formatting:
        // https://day.js.org/docs/en/display/format
        // dddd = weekday
        // D    = day of month (1-31)
        // MMMM = full month name
        // YYYY = 4-digit year

        // for tooltip kinda things we want a short and long version
        // ALL-DAY styles:
        // SHORT:                                    LONG: (actually just a fixed long verbose format + duration)    Note:               
        // -----------------                         -------                                                                        
        // Wednesday 29 June 2024                    Wednesday 29 June 2024 (1d)                                     same year, month, day
        // 29-30 June 2024                           Wednesday 29 June 2024 - Thursday 30 June 2024 (2d)             same year, month                
        // 29 June - 3 July 2024                     Wednesday 29 June 2024 - Wednesday 5 July 2024 (7d)             same year               
        // 29 December 2024 - 2 January 2025         Wednesday 29 December 2024 - Saturday 2 January 2025 (3d)       else               

        // NOT-ALL-DAY STYLES:
        // SHORT:                                               Note:
        // -----------------                                    -------
        // Wednesday 29 June 2024 @ 20-22h                      same year, month, day, zerominutes
        // Wednesday 29 June 2024 @ 20:15-22:30h                same year, month, day
        // 31 December 2024 @ 20:30 - 2 January 2025 @ 18:30    else (worst case)

        const startDate = this.getStartDateTime()!;
        const startDateDjs = dayjs(startDate);
        const endDate = this.getLastDateTime();// this.getEndDateTime()!;
        const endDateDjs = dayjs(endDate);
        // in fact a "same day" means the duration is <= 24 hours. Why? because events can start at 10pm and last 4 hours.
        // using the date would make this look like it spans 2 days. but it's clearer/more intuitive to count that as the same day.
        //const isSameDay = startDateDjs.isSame(endDateDjs, 'day');
        const isSameDay = this.getDurationDays() <= 1.00001;

        if (this.isAllDay()) {

            if (isSameDay) {
                return startDateDjs.format(`dddd, D MMMM YYYY`); // Wednesday 29 June 2024
            }
            const isSameMonth = startDateDjs.isSame(endDateDjs, 'month');
            if (isSameMonth) {
                // 29-30 June 2024
                return `${startDateDjs.format(`D`)} - ${endDateDjs.format(`D MMMM YYYY`)}`;
            }
            const isSameYear = startDateDjs.isSame(endDateDjs, 'year');
            if (isSameYear) {
                // 29 June - 3 July 2024
                return `${startDateDjs.format(`D MMMM`)} - ${endDateDjs.format(`D MMMM YYYY`)}`;
            }

            // 29 December 2024 - 2 January 2025
            return `${startDateDjs.format(`D MMMM YYYY`)} - ${endDateDjs.format(`D MMMM YYYY`)}`;
        }

        // not all-day (time specified)
        if (isSameDay) {
            return `${startDateDjs.format(`dddd, D MMMM YYYY`)} @ ${formatTime(startDate)}-${formatTime(endDate!)}h`;
        }

        return `${startDateDjs.format(`D MMMM YYYY`)} @ ${formatTime(startDate)} - ${endDateDjs.format(`D MMMM YYYY`)} @ ${formatTime(endDate!)}h`;

    }

    public toDisplayStrings(): {
        en: { date: string; time?: string };
        fr: { date: string; time?: string };
        nl: { date: string; time?: string };
    } {
        if (this.isTBD()) {
            return {
                en: { date: 'TBD' },
                fr: { date: 'À déterminer' },
                nl: { date: 'Nog te bepalen' },
            };
        }

        const startDate = dayjs(this.getStartDateTime()!);
        const endDate = dayjs(this.getEndDateTime()!);
        const durationDays = this.getDurationDays();

        const isAllDay = this.isAllDay();
        const isSameDay = durationDays <= 1.0;
        const isSameMonth = startDate.isSame(endDate, 'month');
        const isSameYear = startDate.isSame(endDate, 'year');

        const locales = ['en', 'fr', 'nl'] as const;

        const result: {
            en: { date: string; time?: string };
            fr: { date: string; time?: string };
            nl: { date: string; time?: string };
        } = {
            en: { date: '', time: undefined },
            fr: { date: '', time: undefined },
            nl: { date: '', time: undefined },
        };

        for (const locale of locales) {
            const formatDate = (
                date: dayjs.Dayjs,
                options: Intl.DateTimeFormatOptions,
                datePartsOrder: Intl.DateTimeFormatPartTypes[]
            ): string => {
                const formatter = new Intl.DateTimeFormat(`${locale}-BE`, options);
                const parts = formatter.formatToParts(date.toDate());
                const dateStr = datePartsOrder
                    .map((partType) => parts.find((part) => part.type === partType)?.value)
                    .filter(Boolean)
                    .join(' ');
                return dateStr;
            };

            const formatTime = (date: dayjs.Dayjs): string => {
                const hour = date.hour();
                const minutes = date.minute();
                const suffix = locale === 'nl' ? 'u' : 'h';
                if (minutes === 0) {
                    return `${hour}${suffix}`; // Return only hour with suffix if minutes are 0
                }
                return `${hour}:${minutes.toString().padStart(2, '0')}${suffix}`;
            };

            let dateStr = '';
            let timeStr: string | undefined = undefined;

            if (isAllDay) {
                if (isSameDay) {
                    // Single-day all-day event
                    dateStr = formatDate(
                        startDate,
                        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                        ['weekday', 'day', 'month', 'year']
                    );
                } else if (isSameMonth) {
                    // Multi-day event within the same month
                    const startDay = formatDate(startDate, { day: 'numeric' }, ['day']);
                    const endDateStr = formatDate(
                        endDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    dateStr = `${startDay} - ${endDateStr}`;
                } else if (isSameYear) {
                    // Multi-day event within the same year
                    const startDateStr = formatDate(
                        startDate,
                        { day: 'numeric', month: 'long' },
                        ['day', 'month']
                    );
                    const endDateStr = formatDate(
                        endDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    dateStr = `${startDateStr} - ${endDateStr}`;
                } else {
                    // Multi-day event spanning different years
                    const startDateStr = formatDate(
                        startDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    const endDateStr = formatDate(
                        endDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    dateStr = `${startDateStr} - ${endDateStr}`;
                }
            } else {
                if (isSameDay) {
                    // Single-day event with specific times
                    dateStr = formatDate(
                        startDate,
                        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                        ['weekday', 'day', 'month', 'year']
                    );
                    timeStr = `${formatTime(startDate)} - ${formatTime(endDate)}`;
                } else {
                    // Multi-day event with specific times
                    const startDateStr = formatDate(
                        startDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    const endDateStr = formatDate(
                        endDate,
                        { day: 'numeric', month: 'long', year: 'numeric' },
                        ['day', 'month', 'year']
                    );
                    dateStr = `${startDateStr} - ${endDateStr}`;
                    timeStr = `${formatTime(startDate)} - ${formatTime(endDate)}`;
                }
            }

            result[locale] = {
                date: dateStr,
                time: timeStr,
            };
        }

        return result;
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
    // NOTE that for all-day events there is no concept of timezone, but the time returned will have the local timezone, for consistency & simplicity with rest of codebase.
    getStartDateTime<T extends Date | undefined>(fallbackValue?: T): T extends Date ? Date : Date | null {
        if (!this.spec.startsAtDateTime) {
            return fallbackValue || null as any;
        }
        if (this.isAllDay()) {
            //return floorToDayUTC(this.spec.startsAtDateTime) as T extends Date ? Date : Date | null;
            return getLocalMidnightFromUTCMidnight(this.spec.startsAtDateTime);
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
            return new Date(startDate.valueOf() + this.spec.durationMillis - 1);
        }

        const durationDays = this.getDurationDays();
        let ret = dayjs(startDate);
        ret = ret.add(durationDays, "day");

        assert(ret.millisecond() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.second() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.minute() === 0, "expecting this time to land on a midnight boundary.");
        assert(ret.hour() === 0, "expecting this time to land on a midnight boundary.");

        ret = ret.add(-1, "millisecond");

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

    hitTestDateTime = (lhs?: Date | null): Timing => {
        const lhsx = lhs || new Date();
        const start = this.getStartDateTime();
        if (start === null) return Timing.Future; // TBD = future
        if (lhsx < start) return Timing.Future; // test date is before start; this range is in the future

        const end = this.getEndDateTime();
        if (end === null) throw new Error("TBD should have been handled already");
        if (lhsx >= end) return Timing.Past;
        return Timing.Present;
    };

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
            //let start = new Date(earliestStart);
            //let end = new Date(latestLast);
            // count days in duration, ceil, convert to duration millis
            let durationDays = (latestLast - earliestStart) / gMillisecondsPerDay; //Math.abs(startdjs.diff(enddjs, "day"));
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

// DateTimeRange is a class which includes the following useful functions:
// isAllDay() - returns true if the event is an all-day event. It means time info should be ignored (which implies time zone independent)
// isTBD()
// getStartDateTime() - returns a Date representing the moment the range begins (inclusive, similar to C++ .begin() iterator semantics); or null if the range is TBD.
// getEndDateTime() - returns a Date representing the first moment after the range (similar to C++ .end() iterator semantics); or null if the range is TBD.
export function CalcRelativeTiming(refTime: Date, range: DateTimeRange): RelativeTimingInfo {
    // Check if the range is TBD
    if (range.isTBD()) {
        return { bucket: RelativeTimingBucket.TBD, label: "TBD" };
    }

    const timing = range.hitTestDateTime(refTime);
    if (timing === Timing.Present) {
        // for all-day events, be more safe about this. Very often events are marked as all-day even though they're not 100% of the day.
        // either for laziness, or just because you can't specify the start/end times of day for all-day events.
        // and seeing "happening now" when it's not actually ongoing is worse than seeing "today".
        return { bucket: RelativeTimingBucket.HappeningNow, label: range.isAllDay() ? "Today" : "Happening now" };
    }

    // today can be in the past or present so do that first
    const startDate = dayjs(range.getStartDateTime());
    if (startDate.isSame(refTime, "day")) {
        return { bucket: RelativeTimingBucket.Today, label: "Today" };
    }

    const refTimeN = dayjs(floorLocalToLocalDay(refTime));
    const startDateN = dayjs(floorLocalToLocalDay(startDate.toDate()));
    const diffDays = Math.abs(startDateN.diff(refTimeN, "day"));

    if (timing === Timing.Past) {
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

