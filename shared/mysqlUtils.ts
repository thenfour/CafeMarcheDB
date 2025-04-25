import { ActivityReportTimeBucketSize } from "@/src/core/components/featureReports/activityReportTypes";

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
    return `('${date.toISOString()}')`; // will return UTC string like '2025-04-06T11:47:55.077Z'
    //return `DATE('${date.toISOString()}')`; // will return UTC string like '2025-04-06T11:47:55.077Z'
}

export function MySqlStringLiteral(str: string): string {
    return `'${MysqlEscape(str)}'`;
}

export function MySqlStringLiteralAllowingPercent(str: string): string {
    return `'${MysqlEscapeAllowingPercent(str)}'`;
}

// // returns a MySql date format string which allows aggregation (truncating to the desired level)
// export function getMySqlAggregateDateFormat(aggregateBy: ActivityReportTimeBucketSize) {
//     switch (aggregateBy) {
//         case ActivityReportTimeBucketSize.hour:
//             // E.g. 2025-03-15 13:00:00
//             return "%Y-%m-%d %H:00:00";
//         case ActivityReportTimeBucketSize.day:
//             // E.g. 2025-03-15
//             return "%Y-%m-%d";
//         case ActivityReportTimeBucketSize.week:
//             // E.g. "2025-11" for the 11th week of 2025. Another approach: YEARWEEK(createdAt, 1)
//             // If you prefer a date, you might do something like:
//             // DATE_FORMAT(createdAt, '%x-%v-1')
//             // But usually year-week is enough
//             return "%x-%v";
//         case ActivityReportTimeBucketSize.month:
//             // E.g. "2025-03" or if you want a date: "2025-03-01"
//             return "%Y-%m";
//         case ActivityReportTimeBucketSize.year: return "%Y";           // 2025, 2026, …
//         case ActivityReportTimeBucketSize.all: return "'all'";        // literal const string
//         default:
//             throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
//     }
// }


// return a SQL select expression which returns the distinct bucket grouping.
export function getMySqlTimeBucketSelectExpression(dateColumnName: string, aggregateBy: ActivityReportTimeBucketSize) {
    switch (aggregateBy) {
        case ActivityReportTimeBucketSize.hour:
            // E.g. 2025-03-15 13:00:00
            // DATE_FORMAT(\`createdAt\`, '${dateFormat}') AS bucket,
            return `DATE_FORMAT(${MySqlSymbol(dateColumnName)}, '%Y-%m-%d %H:00:00')`;
        //return "%Y-%m-%d %H:00:00";
        case ActivityReportTimeBucketSize.day:
            // E.g. 2025-03-15
            return `DATE_FORMAT(${MySqlSymbol(dateColumnName)}, '%Y-%m-%d')`;
        //return "%Y-%m-%d";
        case ActivityReportTimeBucketSize.week:
            // E.g. "2025-11" for the 11th week of 2025. Another approach: YEARWEEK(createdAt, 1)
            // If you prefer a date, you might do something like:
            // DATE_FORMAT(createdAt, '%x-%v-1')
            // But usually year-week is enough
            return `DATE_FORMAT(${MySqlSymbol(dateColumnName)}, '%x-%v')`;
        //return "%x-%v";
        case ActivityReportTimeBucketSize.month:
            // E.g. "2025-03" or if you want a date: "2025-03-01"
            return `DATE_FORMAT(${MySqlSymbol(dateColumnName)}, '%Y-%m')`;
        //return "%Y-%m";
        case ActivityReportTimeBucketSize.year:
            return `DATE_FORMAT(${MySqlSymbol(dateColumnName)}, '%Y')`;
        //return "%Y";           // 2025, 2026, …

        case ActivityReportTimeBucketSize.all:
            return "'all'";        // literal const string
        default:
            throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
    }
}






interface MySqlDateRange {
    start: Date;
    end: Date;
}


/**
 * Given a "bucket" string from MySQL DATE_FORMAT + the aggregateBy,
 * returns the [start, end] Date range in UTC.
 */
export function parseBucketToDateRange(
    bucket: string,
    aggregateBy: ActivityReportTimeBucketSize
): MySqlDateRange {
    switch (aggregateBy) {
        case ActivityReportTimeBucketSize.hour:
            return parseHourBucketUTC(bucket);
        case ActivityReportTimeBucketSize.day:
            return parseDayBucketUTC(bucket);
        case ActivityReportTimeBucketSize.week:
            return parseWeekBucketUTC(bucket);
        case ActivityReportTimeBucketSize.month:
            return parseMonthBucketUTC(bucket);
        case ActivityReportTimeBucketSize.year: return parseYearBucketUTC(bucket);
        case ActivityReportTimeBucketSize.all: return parseAllTimeBucketUTC();
        default:
            throw new Error(`Unsupported aggregateBy: ${aggregateBy}`);
    }
}


// 3a) YEAR  ─ e.g. bucket = "2025"
function parseYearBucketUTC(bucket: string): MySqlDateRange {
    const year = parseInt(bucket, 10);

    const startMillis = Date.UTC(year, 0, 1, 0, 0, 0, 0);                // 1 Jan 00:00
    const endMillis = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - 1;         // 31 Dec 23:59:59.999

    return {
        start: new Date(startMillis),
        end: new Date(endMillis),
    };
}

// 3b) ALL TIME  ─ single bucket that spans “forever”.
// You may want to replace these sentinel dates with your real data limits.
function parseAllTimeBucketUTC(): MySqlDateRange {
    return {
        start: new Date(0),                        // 1970-01-01T00:00:00Z
        end: new Date(`2999-01-01`),     // Max safe JS date ≈ +275 000 yrs
    };
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