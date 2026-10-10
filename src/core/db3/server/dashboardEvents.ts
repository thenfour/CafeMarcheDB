import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { EventPublicId } from "shared/publicId";
import { gMillisecondsPerDay } from "shared/time";
import { BigintToNumberNullable } from "shared/utils";
import { GetRelevantEvents, gEventRelevanceClass, kMaxRelevantEventsToQuery, type EventRelevanceClassValue, type EventRelevanceContext } from "../shared/eventRelevance";
import { xEvent } from "../shared/schema/event";
import type { DB3ReadContext } from "./db3ReadExecution";

const candidateSchema = z.object({
    publicId: z.string(),
    startsAt: z.date().nullable(),
    durationMillis: z.bigint().nullable(),
    // Prisma raw MySQL reads expose Boolean columns as 0/1.
    isAllDay: z.union([
        z.literal(0),
        z.literal(1)
    ])
        .transform(value => value === 1).nullable(),
    endDateTime: z.date().nullable(),
    relevanceClassOverride: z.number().nullable(),
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

/** The reference's twenty nearest candidates feed its existing five-card classifier. */
export async function readDashboardRelevantEvents(context: DB3ReadContext, now: Date): Promise<EventPublicId[]> {
    const auth = context.authorization;
    if (!auth.user || !auth.band || !auth.hasPermission(Permission.view_events_nonpublic)) {
        return [];
    }
    if (!xEvent.authorizeTableForView(auth) || Object.keys(candidateSchema.shape).some(columnName =>
        !xEvent.authorizeColumnForView({ auth, model: null, columnName }))) {
        return [];
    }
    // These windows measure elapsed time; UTC spans already preserve authored all-day/DST intent.
    const timing: EventRelevanceContext = {
        now, twentyFourHoursAgo: new Date(now.valueOf() - gMillisecondsPerDay),
        sevenDaysFromNow: new Date(now.valueOf() + 7 * gMillisecondsPerDay)
    };
    const candidates = await loadRelevantEventCandidates(context, timing);
    return GetRelevantEvents(candidates, timing).map(event => event.publicId);
}

async function loadRelevantEventCandidates(context: DB3ReadContext, timing: EventRelevanceContext) {
    // The shared table policy owns band, deletion, visibility and private-owner predicates.
    // lsmb todo: don't put an ad-hoc query here. use the search mechanism. as if you did an event search for the given timing window.
    const visibility = Prisma.raw(xEvent.SqlGetVisFilterExpression({ auth: context.authorization, tableAlias: "e" }));
    const rows: unknown = await context.database.$queryRaw(Prisma.sql`
        SELECT 
          e.publicId,
          e.startsAt,
          e.durationMillis,
          e.isAllDay,
          e.endDateTime, 
          e.relevanceClassOverride
        FROM
          Event e LEFT JOIN EventStatus s ON s.id = e.statusId
        WHERE
          (${visibility})
          AND (e.relevanceClassOverride IS NULL OR e.relevanceClassOverride <> ${gEventRelevanceClass.Hidden})
          AND (e.relevanceClassOverride IS NOT NULL OR (
            (s.significance IS NULL OR s.significance <> 'Cancelled')
            AND e.startsAt IS NOT NULL AND e.endDateTime >= ${timing.twentyFourHoursAgo}
          ))
        ORDER BY
          e.relevanceClassOverride IS NULL ASC,
          ABS(TIMESTAMPDIFF(MINUTE, e.startsAt, ${timing.now})) ASC,
          e.publicId ASC
        LIMIT
          ${kMaxRelevantEventsToQuery}
    `);
    return z.array(candidateSchema).parse(rows).map(row => ({
        ...row,
        publicId: xEvent.parseIdentity(row.publicId),
        durationMillis: BigintToNumberNullable(row.durationMillis),
        relevanceClassOverride: parseRelevanceOverride(row.relevanceClassOverride),
    }));
}
