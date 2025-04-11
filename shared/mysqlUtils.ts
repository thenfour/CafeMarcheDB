import { ReportAggregateBy } from "src/core/db3/shared/apiTypes";

export function SqlCombineAndExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    AND `)})`;
};

export function SqlCombineOrExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    OR `)})`;
};


// https://stackoverflow.com/questions/7744912/making-a-javascript-string-sql-friendly
export function MysqlEscape(str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char; // prepends a backslash to backslash, percent,
            // and double/single quotes
            default:
                return char;
        }
    });
}

export function MysqlEscapeAllowingPercent(str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            default:
                return char;
        }
    });
}


export function MySqlSymbol(symbol: string): string {
    return `\`${symbol}\``;
}

// returns a string that can be used as a MySql date literal
export function MySqlDateTimeLiteral(date: Date): string {
    return `DATE('${date.toISOString()}')`; // will return UTC string like '2025-04-06T11:47:55.077Z'
}

export function MySqlStringLiteral(str: string): string {
    return `'${MysqlEscape(str)}'`;
}

export function MySqlStringLiteralAllowingPercent(str: string): string {
    return `'${MysqlEscapeAllowingPercent(str)}'`;
}

// returns a MySql date format string which allows aggregation (truncating to the desired level)
export function getMySqlAggregateDateFormat(aggregateBy: ReportAggregateBy) {
    switch (aggregateBy) {
        case ReportAggregateBy.hour:
            // E.g. 2025-03-15 13:00:00
            return "%Y-%m-%d %H:00:00";
        case ReportAggregateBy.day:
            // E.g. 2025-03-15
            return "%Y-%m-%d";
        case ReportAggregateBy.week:
            // E.g. "2025-11" for the 11th week of 2025. Another approach: YEARWEEK(createdAt, 1)
            // If you prefer a date, you might do something like:
            // DATE_FORMAT(createdAt, '%x-%v-1')
            // But usually year-week is enough
            return "%x-%v";
        case ReportAggregateBy.month:
            // E.g. "2025-03" or if you want a date: "2025-03-01"
            return "%Y-%m";
        default:
            throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
    }
}


interface MySqlDateRange {
    start: Date;
    end: Date;
}

// /**
//  * Given a "bucket" string from MySQL DATE_FORMAT + the aggregateBy,
//  * returns the [start, end] Date range for that "bucket."
//  */
// export function parseBucketToDateRange(
//     bucket: string,
//     aggregateBy: ReportAggregateBy
// ): MySqlDateRange {
//     switch (aggregateBy) {
//         case ReportAggregateBy.hour:
//             return parseHourBucket(bucket);
//         case ReportAggregateBy.day:
//             return parseDayBucket(bucket);
//         case ReportAggregateBy.week:
//             return parseWeekBucket(bucket);
//         case ReportAggregateBy.month:
//             return parseMonthBucket(bucket);
//         default:
//             throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
//     }
// }

// function parseHourBucket(bucket: string): MySqlDateRange {
//     // "2025-03-15 13:00:00" -> hour start + hour end
//     const normalized = bucket.replace(" ", "T");
//     const start = new Date(normalized);
//     const end = new Date(start.getTime() + 60 * 60 * 1000 - 1);
//     return { start, end };
// }

// function parseDayBucket(bucket: string): MySqlDateRange {
//     // "2025-03-15"
//     const [y, m, d] = bucket.split("-");
//     const year = parseInt(y!, 10);
//     const month = parseInt(m!, 10) - 1;
//     const day = parseInt(d!, 10);
//     const start = new Date(year, month, day, 0, 0, 0, 0);
//     const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
//     return { start, end };
// }

// function parseWeekBucket(bucket: string): MySqlDateRange {
//     // "2025-11"
//     const [yearStr, weekStr] = bucket.split("-");
//     const isoYear = parseInt(yearStr!, 10);
//     const isoWeek = parseInt(weekStr!, 10);
//     return getIsoWeekRange(isoYear, isoWeek);
// }

// function getIsoWeekRange(year: number, week: number): MySqlDateRange {
//     // see explanation above
//     const jan4 = new Date(year, 0, 4);
//     const jan4Day = jan4.getDay() || 7;
//     const mondayWeek1 = new Date(jan4);
//     mondayWeek1.setDate(jan4.getDate() + (1 - jan4Day));

//     const start = new Date(mondayWeek1);
//     start.setDate(mondayWeek1.getDate() + (week - 1) * 7);

//     const end = new Date(start);
//     end.setDate(start.getDate() + 6);
//     end.setHours(23, 59, 59, 999);

//     return { start, end };
// }

// function parseMonthBucket(bucket: string): MySqlDateRange {
//     // "2025-03"
//     const [y, m] = bucket.split("-");
//     const year = parseInt(y!, 10);
//     const month = parseInt(m!, 10) - 1;
//     const start = new Date(year, month, 1, 0, 0, 0, 0);
//     const nextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);
//     const end = new Date(nextMonth.getTime() - 1);
//     return { start, end };
// }



/**
 * Given a "bucket" string from MySQL DATE_FORMAT + the aggregateBy,
 * returns the [start, end] Date range in UTC.
 */
export function parseBucketToDateRange(
    bucket: string,
    aggregateBy: ReportAggregateBy
): MySqlDateRange {
    switch (aggregateBy) {
        case ReportAggregateBy.hour:
            return parseHourBucketUTC(bucket);
        case ReportAggregateBy.day:
            return parseDayBucketUTC(bucket);
        case ReportAggregateBy.week:
            return parseWeekBucketUTC(bucket);
        case ReportAggregateBy.month:
            return parseMonthBucketUTC(bucket);
        default:
            throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
    }
}

// --------------------
// 1) HOUR BUCKET (e.g. "%Y-%m-%d %H:00:00")
//    Example: "2025-03-15 13:00:00" -> 13:00:00 UTC

function parseHourBucketUTC(bucket: string): MySqlDateRange {
    // "2025-03-15 13:00:00" => [start=2025-03-15T13:00:00.000Z, end=+1h-1ms]
    const [datePart, timePart] = bucket.split(" "); // e.g. ["2025-03-15", "13:00:00"]
    const [yearStr, monthStr, dayStr] = datePart!.split("-").map(s => parseInt(s, 10));
    const [hh, mm, ss] = timePart!.split(":").map(s => parseInt(s, 10));

    const startMillis = Date.UTC(yearStr!, monthStr! - 1, dayStr, hh, mm, ss, 0);
    const endMillis = startMillis + 60 * 60 * 1000 - 1; // +1 hour, minus 1ms
    return {
        start: new Date(startMillis),
        end: new Date(endMillis),
    };
}

// --------------------
// 2) DAY BUCKET (e.g. "%Y-%m-%d")
//    Example: "2025-03-15" -> entire day in UTC

function parseDayBucketUTC(bucket: string): MySqlDateRange {
    // "2025-03-15" => 2025-03-15T00:00:00.000Z through 2025-03-15T23:59:59.999Z
    const [yearStr, monthStr, dayStr] = bucket.split("-").map(s => parseInt(s, 10));
    const startMillis = Date.UTC(yearStr!, monthStr! - 1, dayStr, 0, 0, 0, 0);
    const endMillis = startMillis + 24 * 60 * 60 * 1000 - 1;
    return {
        start: new Date(startMillis),
        end: new Date(endMillis),
    };
}

// --------------------
// 3) WEEK BUCKET (e.g. "%x-%v")
//    Example: "2025-11" => 11th ISO week of 2025
//    We'll convert that to Monday 00:00:00 UTC through Sunday 23:59:59.999 UTC.

function parseWeekBucketUTC(bucket: string): MySqlDateRange {
    // e.g. "2025-11"
    const [yearStr, weekStr] = bucket.split("-");
    const isoYear = parseInt(yearStr!, 10);
    const isoWeek = parseInt(weekStr!, 10);
    return getIsoWeekRangeUTC(isoYear, isoWeek);
}

/**
 * Returns the start (Monday 00:00:00 UTC) and end (Sunday 23:59:59.999 UTC)
 * for a given ISO week/year in UTC.
 */
function getIsoWeekRangeUTC(year: number, week: number): MySqlDateRange {
    // 1) Per ISO 8601, week 1 is the week that has the first Thursday in it.
    //    A common approach: 4th Jan is always in week 1.
    // 2) We'll find Monday of week 1, then add (week-1)*7 days.

    // Step A: Date for Jan 4, 00:00 UTC:
    const jan4Millis = Date.UTC(year, 0, 4, 0, 0, 0, 0);
    // Convert to a Date object
    const jan4Date = new Date(jan4Millis);

    // Step B: day of week for Jan 4 (1=Mon, ..., 7=Sun in ISO, but in JS getUTCDay() 0=Sun)
    let dayOfWeek = jan4Date.getUTCDay();
    if (dayOfWeek === 0) {
        dayOfWeek = 7; // treat Sunday as 7
    }

    // Monday of ISO week 1 is (dayOfWeek=1)
    // so shift backwards (dayOfWeek - 1) days to get that Monday:
    const mondayWeek1Millis = jan4Millis - (dayOfWeek - 1) * 24 * 60 * 60 * 1000;

    // Step C: Monday of the target ISO week:
    const startMillis = mondayWeek1Millis + (week - 1) * 7 * 24 * 60 * 60 * 1000;

    // Step D: End is Sunday 23:59:59.999 => +6 days from Monday + (nearly) 24 hours
    const endMillis = startMillis + 6 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1);

    return {
        start: new Date(startMillis), // 00:00:00 Monday (UTC)
        end: new Date(endMillis),     // 23:59:59.999 Sunday (UTC)
    };
}

// --------------------
// 4) MONTH BUCKET (e.g. "%Y-%m")
//    Example: "2025-03" => entire March 2025 in UTC

function parseMonthBucketUTC(bucket: string): MySqlDateRange {
    // "2025-03" => March 1, 2025 (00:00:00 UTC) through March 31, 2025 (23:59:59.999 UTC)
    const [yearStr, monthStr] = bucket.split("-").map(s => parseInt(s, 10));
    // Start is the 1st of that month in UTC:
    const startMillis = Date.UTC(yearStr!, monthStr! - 1, 1, 0, 0, 0, 0);
    // Next month:
    const nextMonthMillis = Date.UTC(yearStr!, monthStr, 1, 0, 0, 0, 0);
    // End is nextMonth - 1ms
    const endMillis = nextMonthMillis - 1;
    return {
        start: new Date(startMillis),
        end: new Date(endMillis),
    };
}