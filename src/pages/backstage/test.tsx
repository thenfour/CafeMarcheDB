import { BlitzPage } from "@blitzjs/auth";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { CalcRelativeTiming, DateTimeRange, RelativeTimingBucket, RelativeTimingInfo, gMillisecondsPerHour } from "shared/time";
import DashboardLayout from "src/core/layouts/DashboardLayout";

interface TestResult {
    pass: boolean,
    name: string,
    failureMessage: string,
    expected: string,
    actual: string,
};

function CalcRelativeTimingTest(name: string, results: TestResult[], brk: boolean, refTime: Date, range: DateTimeRange, expected: RelativeTimingInfo) {
    if (brk) {
        debugger;
    }
    const actual = CalcRelativeTiming(refTime, range);
    //const name = `${refTime.toISOString()} vs ${range.toString()}`;
    let pass = true;
    if (actual.bucket !== expected.bucket) {
        pass = false;
        results.push({
            actual: actual.bucket,
            expected: expected.bucket,
            name: `${name}`,
            failureMessage: "Bucket incorrect",
            pass: false,
        });
    }
    if (actual.label !== expected.label) {
        pass = false;
        results.push({
            actual: actual.label,
            expected: expected.label,
            name: `${name}`,
            failureMessage: "label incorrect",
            pass: false,
        });
    }
    if (pass) {
        results.push({
            actual: "",
            expected: "",
            name: `${name}`,
            failureMessage: "",
            pass: true,
        });
    }
}


const TestCalcRelativeTiming = () => {

    const results: TestResult[] = [];
    // happening now
    CalcRelativeTimingTest(
        "happening now",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-07 18:00:00"),
            durationMillis: 0,
            isAllDay: true,
        }), {
        bucket: RelativeTimingBucket.HappeningNow,
        label: "Happening now"
    });

    // today (later)
    CalcRelativeTimingTest(
        "today (later)",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-07 18:15:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Today,
        label: "Today"
    });

    // today (earlier)
    CalcRelativeTimingTest(
        "today (earlier)",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-07 16:15:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Today,
        label: "Today"
    });

    // yesterday (but later in the day)
    CalcRelativeTimingTest(
        "yesterday (but later in the day)",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-06 20:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Yesterday,
        label: "Yesterday"
    });

    // yesterday (but earlier in the day)
    CalcRelativeTimingTest(
        "yesterday (but earlier in the day)",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-06 13:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Yesterday,
        label: "Yesterday"
    });

    CalcRelativeTimingTest(
        "2 days ago (threshold of yesterday)",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-05 20:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.DaysAgo,
        label: "2 days ago"
    });

    CalcRelativeTimingTest(
        "5 days ago",
        results,
        false,
        new Date("2020-07-07 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-02 20:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.DaysAgo,
        label: "5 days ago"
    });

    CalcRelativeTimingTest(
        "6 days (1 week) ago",
        results,
        false,
        new Date("2020-07-07 18:00:00"), // a tuesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-01 20:00:00"), // last wednesday.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.LastWeek,
        label: "Last week"
    });

    CalcRelativeTimingTest(
        "last week (but earlier in the week)",
        results,
        false,
        new Date("2020-07-22 18:00:00"), // a wednesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-14 20:00:00"), // last tuesday.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.LastWeek,
        label: "Last week"
    });

    CalcRelativeTimingTest(
        "2 fridays ago",
        results,
        false,
        new Date("2020-07-22 18:00:00"), // a wednesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-10 20:00:00"), // 2 fridays ago
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.WeeksAgo,
        label: "2 weeks ago"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2020/7/1?tab=mc
    CalcRelativeTimingTest(
        "3 mondays ago",
        results,
        false,
        new Date("2020-07-22 18:00:00"), // a wednesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-07-06 20:00:00"), // 3 mondays ago should still be 2 calendar weeks
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.WeeksAgo,
        label: "2 weeks ago"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2020/7/1?tab=mc
    CalcRelativeTimingTest(
        "6 weeks",
        results,
        false,
        new Date("2020-07-22 18:00:00"), // a wednesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-06-12 20:00:00"), // friday, 6 weeks ago
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.WeeksAgo,
        label: "6 weeks ago"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2020/7/1?tab=mc
    CalcRelativeTimingTest(
        "2 months (7 weeks)",
        results,
        false,
        new Date("2020-07-22 18:00:00"), // a wednesday.
        new DateTimeRange({
            startsAtDateTime: new Date("2020-05-29 20:00:00"), // friday, 7 weeks ago
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.MonthsAgo,
        label: "2 months ago"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2020/7/1?tab=mc
    CalcRelativeTimingTest(
        "18 months",
        results,
        false,
        new Date("2021-09-14 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-03-1 20:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.MonthsAgo,
        label: "18 months ago"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2020/7/1?tab=mc
    CalcRelativeTimingTest(
        "2 years",
        results,
        false,
        new Date("2021-09-14 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2020-01-1 20:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.YearsAgo,
        label: "2 years ago"
    });

    // FUTURE TESTS

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "Tomorrow",
        results,
        false,
        new Date("2024-05-1 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-2 03:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Tomorrow,
        label: "Tomorrow"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "Tomorrow (later)",
        results,
        false,
        new Date("2024-05-1 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-2 21:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.Tomorrow,
        label: "Tomorrow"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 2 days",
        results,
        false,
        new Date("2024-05-1 18:00:00"),
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-3 10:00:00"),
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InDays,
        label: "In 2 days"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 5 days",
        results,
        false,
        new Date("2024-05-6 18:00:00"), // MONDAY
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-11 20:00:00"), // saturday
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InDays,
        label: "In 5 days"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "next week",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-13 10:00:00"), // next monday
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.NextWeek,
        label: "Next week"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 2 weeks (earlier in week)",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-20 10:00:00"), // next monday
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InWeeks,
        label: "In 2 weeks"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 2 weeks (later in week)",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-05-24 10:00:00"), // next monday
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InWeeks,
        label: "In 2 weeks"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 6 weeks",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-06-17 10:00:00"), // 19th is 6 weeks exactly.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InWeeks,
        label: "In 6 weeks"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "next month",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-06-24 10:00:00"), // 19th is 6 weeks exactly.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.NextMonth,
        label: "Next month"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 2 months",
        results,
        false,
        new Date("2024-05-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2024-07-24 10:00:00"), // 19th is 6 weeks exactly.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InMonths,
        label: "In 2 months"
    });

    // https://calendar.google.com/calendar/u/0/r/month/2024/5/1?tab=mc
    CalcRelativeTimingTest(
        "in 2 months",
        results,
        false,
        new Date("2024-02-8 18:00:00"), // wednesday
        new DateTimeRange({
            startsAtDateTime: new Date("2025-10-24 10:00:00"), // 19th is 6 weeks exactly.
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        }), {
        bucket: RelativeTimingBucket.InYears,
        label: "In 2 years"
    });

    return <table className="testResults">
        <thead>
            <tr>
                <th>Result</th>
                <th>Name</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            {
                results.map((r, i) => {
                    return <React.Fragment key={i}>
                        <tr key={i} className={`testResult ${r.pass ? "pass" : "fail"}`}>
                            <td>{r.pass ? "pass" : "FAIL"}</td>
                            <td>{r.name}</td>
                            <td>{r.failureMessage}</td>
                        </tr>
                        {r.failureMessage && <tr><td></td><td colSpan={2}>
                            <div>Expected: {r.expected}</div>
                            <div>Actual: {r.actual}</div>
                        </td></tr>}
                    </React.Fragment>
                })
            }
        </tbody>
    </table>;

    //return <KeyValueDisplay data={Object.fromEntries(results.map(r => [r.label, `${r.pass ? "pass" : "FAIL"} ${r.label}`]))} />;
};

const TestsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="tests" basePermission={Permission.sysadmin}>
            <TestCalcRelativeTiming />
        </DashboardLayout>
    )
}

export default TestsPage;

