// Benchmark-only snapshot of dashboardEvents.ts at 350e3ac5. Never use this in product readers.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { gMillisecondsPerDay } from "shared/time";
import { BigintToNumberNullable } from "shared/utils";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { GetRelevantEvents, gEventRelevanceClass, kMaxRelevantEventsToQuery, type EventRelevanceClassValue } from "src/core/db3/shared/eventRelevance";
import { xEvent } from "src/core/db3/shared/schema/event";

const candidateSchema = z.object({
    publicId: z.string(), startsAt: z.date().nullable(), durationMillis: z.bigint().nullable(),
    isAllDay: z.union([z.literal(0), z.literal(1)]).transform(value => value === 1).nullable(),
    endDateTime: z.date().nullable(), relevanceClassOverride: z.number().nullable(),
});

function parseRelevanceOverride(value: number | null): EventRelevanceClassValue | null {
    if (value === null) {
        return null;
    }
    const classification = Object.values(gEventRelevanceClass).find(classification => classification === value);
    if (classification === undefined) {
        throw new Error("Unknown Event relevance override.");
    }
    return classification;
}

export async function historicalDashboardRelevance(context: DB3ReadContext, now: Date) {
    const auth = context.authorization;
    if (!auth.user || !auth.band || !auth.hasPermission(Permission.view_events_nonpublic)) {
        return [];
    }
    if (!xEvent.authorizeTableForView(auth) || Object.keys(candidateSchema.shape).some(columnName =>
        !xEvent.authorizeColumnForView({ auth, model: null, columnName }))) {
        return [];
    }
    const timing = { now, twentyFourHoursAgo: new Date(now.valueOf() - gMillisecondsPerDay),
        sevenDaysFromNow: new Date(now.valueOf() + 7 * gMillisecondsPerDay) };
    const visibility = Prisma.raw(xEvent.SqlGetVisFilterExpression({ auth, tableAlias: "e" }));
    const rows: unknown = await context.database.$queryRaw(Prisma.sql`
        SELECT e.publicId, e.startsAt, e.durationMillis, e.isAllDay, e.endDateTime, e.relevanceClassOverride
        FROM Event e LEFT JOIN EventStatus s ON s.id = e.statusId
        WHERE (${visibility})
          AND (e.relevanceClassOverride IS NULL OR e.relevanceClassOverride <> ${gEventRelevanceClass.Hidden})
          AND (e.relevanceClassOverride IS NOT NULL OR (
            (s.significance IS NULL OR s.significance <> 'Cancelled')
            AND e.startsAt IS NOT NULL AND e.endDateTime >= ${timing.twentyFourHoursAgo}
          ))
        ORDER BY e.relevanceClassOverride IS NULL ASC,
          ABS(TIMESTAMPDIFF(MINUTE, e.startsAt, ${timing.now})) ASC, e.publicId ASC
        LIMIT ${kMaxRelevantEventsToQuery}
    `);
    const candidates = z.array(candidateSchema).parse(rows).map(row => ({
        ...row, publicId: xEvent.parseIdentity(row.publicId), durationMillis: BigintToNumberNullable(row.durationMillis),
        relevanceClassOverride: parseRelevanceOverride(row.relevanceClassOverride),
    }));
    return GetRelevantEvents(candidates, timing).map(event => event.publicId);
}
