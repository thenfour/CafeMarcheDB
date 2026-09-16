import { EventStatusSignificance } from "src/core/db3/shared/schema/prismArgs";
import { createAllDayRange, DateTimeRange } from "shared/time";
import { addCalendarDays } from "shared/dateTimePolicy";
import { getEventDateBoundsFromSegments } from "src/core/db3/shared/schema/event";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { loadBandTimeZone } from "./dateTime";

/** Decode version 1 only. Never infer a representation from its hour or offset. */
export function getLegacyAllDayCalendarDates(start: Date, nominalDuration: number) {
    if (!Number.isFinite(nominalDuration)) throw new RangeError("Invalid legacy duration.");
    const startDate = start.toISOString().slice(0, 10);
    return { startDate,
        endDateExclusive: addCalendarDays(startDate, Math.max(1, Math.round(nominalDuration / 86_400_000))),
    };
}

export function convertLegacyAllDay(start: Date, nominalDuration: number, timeZone: string): DateTimeRange {
    return createAllDayRange(getLegacyAllDayCalendarDates(start, nominalDuration), timeZone);
}

/** Caller owns a serializable transaction. Dry-run calculates every resulting aggregate too. */
export async function migrateEventUtcSpans(client: TransactionalPrismaClient, apply: boolean) {
    const timeZone = await loadBandTimeZone(client);
    const segments = await client.eventSegment.findMany({ orderBy: { id: "asc" } });
    const cancelled = await client.eventStatus.findMany({ where: { significance: EventStatusSignificance.Cancelled }, select: { id: true } });
    const changes: object[] = [];
    const converted = segments.map(segment => {
        if (segment.dateTimeVersion === 2) return segment;
        if (segment.dateTimeVersion !== 1) throw new Error(`Unknown datetime version on segment ${segment.id}.`);
        const spec = segment.isAllDay && segment.startsAt
            ? convertLegacyAllDay(segment.startsAt, Number(segment.durationMillis), timeZone).getSpec() : null;
        const after = { startsAt: spec?.startsAtDateTime ?? segment.startsAt,
            durationMillis: spec ? BigInt(spec.durationMillis) : segment.durationMillis, dateTimeVersion: 2 };
        changes.push({ segmentId: segment.id, before: { startsAt: segment.startsAt, durationMillis: segment.durationMillis, dateTimeVersion: 1 }, after });
        return { ...segment, ...after };
    });
    for (let i = 0; i < segments.length; ++i) {
        if (apply && segments[i]!.dateTimeVersion === 1) {
            const row = converted[i]!;
            await client.eventSegment.update({ where: { id: row.id }, data: {
                startsAt: row.startsAt, durationMillis: row.durationMillis, dateTimeVersion: 2,
            } });
        }
    }
    const events = await client.event.findMany({ orderBy: { id: "asc" } });
    const aggregates: object[] = [];
    for (const event of events) {
        const after = getEventDateBoundsFromSegments(converted.filter(segment => segment.eventId === event.id), cancelled.map(status => status.id));
        if (event.startsAt?.valueOf() === after.startsAt?.valueOf() && Number(event.durationMillis) === after.durationMillis
            && event.endDateTime?.valueOf() === after.endDateTime?.valueOf() && event.isAllDay === after.isAllDay) continue;
        aggregates.push({ eventId: event.id, before: { startsAt: event.startsAt, durationMillis: event.durationMillis,
            endDateTime: event.endDateTime, isAllDay: event.isAllDay }, after });
        if (apply) await client.event.update({ where: { id: event.id }, data: after });
    }
    return { mode: apply ? "applied" : "dry-run", timeZone, inspectedSegments: segments.length, changes, aggregates };
}
