import { Temporal } from "@js-temporal/polyfill";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import type { GeneralFeatureReportInput } from "../activityReportTypes";
import { activityTimeZonePeriods } from "./activityTimeline";

export interface ActivityBucketInterval {
    readonly start: Date;
    readonly endExclusive: Date;
}

function localBucketBounds(bucket: string, size: ActivityReportTimeBucketSize) {
    if (size === ActivityReportTimeBucketSize.hour && /^\d{4}-\d{2}-\d{2} \d{2}:00:00$/.test(bucket)) {
        const start = Temporal.PlainDateTime.from(bucket.replace(" ", "T"));
        return { start, end: start.add({ hours: 1 }) };
    }
    if (size === ActivityReportTimeBucketSize.day && /^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
        const start = Temporal.PlainDate.from(bucket).toPlainDateTime();
        return { start, end: start.add({ days: 1 }) };
    }
    if (size === ActivityReportTimeBucketSize.week && /^\d{4}-\d{2}$/.test(bucket)) {
        const year = Number(bucket.slice(0, 4));
        const week = Number(bucket.slice(5));
        const fourth = Temporal.PlainDate.from({ year, month: 1, day: 4 });
        const monday = fourth.subtract({ days: fourth.dayOfWeek - 1 }).add({ weeks: week - 1 });
        if (monday.yearOfWeek !== year || monday.weekOfYear !== week) {
            throw new Error("Invalid activity week.");
        }
        const start = monday.toPlainDateTime();
        return { start, end: start.add({ weeks: 1 }) };
    }
    if (size === ActivityReportTimeBucketSize.month && /^\d{4}-\d{2}$/.test(bucket)) {
        const start = Temporal.PlainDate.from(`${bucket}-01`).toPlainDateTime();
        return { start, end: start.add({ months: 1 }) };
    }
    if (size === ActivityReportTimeBucketSize.year && /^\d{4}$/.test(bucket)) {
        const start = Temporal.PlainDate.from(`${bucket}-01-01`).toPlainDateTime();
        return { start, end: start.add({ years: 1 }) };
    }
    throw new Error("Invalid activity bucket.");
}

/** Match the timeline's local bucket across every UTC offset, including repeated hours. */
export function activityBucketIntervals(input: GeneralFeatureReportInput, bucket: string, timeZone: string): ActivityBucketInterval[] {
    if (input.filterSpec.bucketSize === ActivityReportTimeBucketSize.all) {
        if (bucket !== "all") {
            throw new Error("Invalid activity bucket.");
        }
        return [{ start: input.startDate, endExclusive: input.endDateExclusive }];
    }
    const bounds = localBucketBounds(bucket, input.filterSpec.bucketSize);
    const localStart = bounds.start.toZonedDateTime("UTC").epochMilliseconds;
    const localEnd = bounds.end.toZonedDateTime("UTC").epochMilliseconds;
    return activityTimeZonePeriods(input.startDate, input.endDateExclusive, timeZone).flatMap(period => {
        const start = Math.max(period.start.valueOf(), localStart - period.offsetSeconds * 1000);
        const end = Math.min(period.endExclusive.valueOf(), localEnd - period.offsetSeconds * 1000);
        return start < end ? [{ start: new Date(start), endExclusive: new Date(end) }] : [];
    });
}
