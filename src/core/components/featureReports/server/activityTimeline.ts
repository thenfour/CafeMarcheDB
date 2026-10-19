// TODO: all these adhoc queries need to be adjusted such that compiler would catch
// typos / schema changes

import { Temporal } from "@js-temporal/polyfill";
import { Prisma } from "@prisma/client";
import { BandTimeZoneSchema } from "shared/dateTimePolicy";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadPlatformSysadminWhere } from "src/auth/server/principalPredicates";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { GeneralFeatureReportInputSchema, type GeneralFeatureReportInput, type GeneralFeatureReportResult } from "../activityReportTypes";
import { authorizeActivityReport } from "./activityReportAuthorization";

export interface ActivityTimeZonePeriod {
    readonly start: Date;
    readonly endExclusive: Date;
    readonly offsetSeconds: number;
}

/** Offset periods preserve DST and do not depend on installed MySQL time-zone tables. */
export function activityTimeZonePeriods(start: Date, endExclusive: Date, timeZone: string): ActivityTimeZonePeriod[] {
    const zone = BandTimeZoneSchema.parse(timeZone);
    let cursor = Temporal.Instant.fromEpochMilliseconds(start.valueOf()).toZonedDateTimeISO(zone);
    const periods: ActivityTimeZonePeriod[] = [];
    while (cursor.epochMilliseconds < endExclusive.valueOf()) {
        const transition = cursor.getTimeZoneTransition("next");
        const nextMillis = Math.min(transition?.epochMilliseconds ?? endExclusive.valueOf(), endExclusive.valueOf());
        periods.push({ start: new Date(cursor.epochMilliseconds), endExclusive: new Date(nextMillis), offsetSeconds: cursor.offsetNanoseconds / 1_000_000_000 });
        cursor = Temporal.Instant.fromEpochMilliseconds(nextMillis).toZonedDateTimeISO(zone);
    }
    return periods;
}

const dateFormats = {
    hour: "%Y-%m-%d %H:00:00",
    day: "%Y-%m-%d",
    week: "%x-%v",
    month: "%Y-%m",
    year: "%Y",
};

function bucketExpression(args: GeneralFeatureReportInput, timeZone: string): Prisma.Sql {
    if (args.filterSpec.bucketSize === ActivityReportTimeBucketSize.all) {
        return Prisma.sql`'all'`;
    }
    const periods = activityTimeZonePeriods(args.startDate, args.endDateExclusive, timeZone);
    const branches = periods.map(period => Prisma.sql`WHEN createdAt >= ${period.start} AND createdAt < ${period.endExclusive}
        THEN DATE_ADD(createdAt, INTERVAL ${period.offsetSeconds} SECOND)`);
    const localDate = Prisma.sql`CASE ${Prisma.join(branches, " ")} END`;
    return Prisma.sql`DATE_FORMAT(${localDate}, ${dateFormats[args.filterSpec.bucketSize]})`;
}

function timelineConditions(args: GeneralFeatureReportInput, bandId: number, userId: number, administratorIds: number[]): Prisma.Sql[] {
    const filters = args.filterSpec;
    const conditions = [Prisma.sql`bandId = ${bandId}`, Prisma.sql`createdAt >= ${args.startDate}`, Prisma.sql`createdAt < ${args.endDateExclusive}`];
    if (filters.excludeYourself) {
        // NULL authors are anonymous activity, not the current person.
        conditions.push(Prisma.sql`(userId IS NULL OR userId <> ${userId})`);
    }
    if (filters.excludeSysadmins && administratorIds.length) {
        conditions.push(Prisma.sql`(userId IS NULL OR userId NOT IN (${Prisma.join(administratorIds)}))`);
    }
    if (filters.includeFeatures.length) {
        conditions.push(Prisma.sql`feature IN (${Prisma.join(filters.includeFeatures)})`);
    }
    if (filters.excludeFeatures.length) {
        conditions.push(Prisma.sql`feature NOT IN (${Prisma.join(filters.excludeFeatures)})`);
    }
    if (filters.contextBeginsWith) {
        // Escape special characters for SQL LIKE pattern.
        const prefix = filters.contextBeginsWith.replace(/[\\%_]/g, "\\$&") + "%";
        conditions.push(Prisma.sql`context LIKE ${prefix}`);
    }
    return conditions;
}

export function readActivityTimeline(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: GeneralFeatureReportInput): Promise<GeneralFeatureReportResult> {
    const args = GeneralFeatureReportInputSchema.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const { auth, band } = authorizeActivityReport(context.authorization, args.bandPublicId);
        const timeZone = await loadBandTimeZone(context.database, band.id);
        const administrators = args.filterSpec.excludeSysadmins
            ? await context.database.user.findMany({ where: await loadPlatformSysadminWhere(context.database), select: { id: true } }) : [];
        const conditions = timelineConditions(args, band.id, auth.userId, administrators.map(person => person.id));
        const start = performance.now();
        const rows = await context.database.$queryRaw<Array<{ bucket: string; count: bigint }>>(Prisma.sql`
            SELECT ${bucketExpression(args, timeZone)} AS bucket, COUNT(*) AS count
            FROM Action WHERE ${Prisma.join(conditions, " AND ")}
            GROUP BY bucket ORDER BY bucket ASC`);
        return {
            data: rows.map(row => ({ bucket: row.bucket, count: Number(row.count) })),
            timeZone, metrics: { queryTimeMs: Math.round(performance.now() - start) },
        };
    });
}
