import type { Prisma } from "@prisma/client";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import { createAllDayRange, DateTimeRange } from "shared/time";

type EventDateDatabase = Pick<Prisma.TransactionClient, "eventStatus" | "eventSegment" | "event">;

// export function isBandTimeZoneSetting(name: string | undefined): boolean {
//     return name === "dateTime.bandTimeZone";
// }

export async function fetchCancelledEventStatusIds(client: EventDateDatabase): Promise<number[]> {
    const cancelled = await client.eventStatus.findMany({ select: { id: true }, where: { significance: "Cancelled" } });
    return cancelled.map(status => status.id);
}

function segmentRange(segment: { startsAt: Date | null; durationMillis: bigint; isAllDay: boolean }): DateTimeRange {
    return new DateTimeRange({ startsAtDateTime: segment.startsAt, durationMillis: Number(segment.durationMillis), isAllDay: segment.isAllDay });
}

export async function calculateEventDateBoundsUpdatePatch(client: EventDateDatabase, eventId: number, cancelledStatusIds: number[]) {
    const segments = await client.eventSegment.findMany({ where: { eventId } });
    const range = DateTimeRange.union(segments.filter(segment => segment.statusId === null || !cancelledStatusIds.includes(segment.statusId)).map(segmentRange));
    const spec = range.getSpec();
    return { startsAt: spec.startsAtDateTime, durationMillis: spec.durationMillis, isAllDay: spec.isAllDay, endDateTime: range.getBounds()?.end ?? null };
}

// The band filter is mandatory for settings writes; older recovery callers can still refresh every event.
export async function recalculateEventDateBounds(client: EventDateDatabase, cancelledStatusIds: number[], bandId?: number): Promise<void> {
    const events = await client.event.findMany({
        where: bandId === undefined ? {} : { bandId },
        select: { id: true, startsAt: true, durationMillis: true, isAllDay: true, endDateTime: true }, orderBy: { id: "asc" }
    });
    for (const event of events) {
        const data = await calculateEventDateBoundsUpdatePatch(client, event.id, cancelledStatusIds);
        if (event.startsAt?.valueOf() !== data.startsAt?.valueOf() || Number(event.durationMillis) !== data.durationMillis
            || event.isAllDay !== data.isAllDay || event.endDateTime?.valueOf() !== data.endDateTime?.valueOf()) {
            await client.event.update({ where: { id: event.id }, data });
        }
    }
}

/** Caller owns the transaction containing the setting write and this reanchor. */
export async function reanchorAllDayEvents(client: EventDateDatabase, oldTimeZone: string, newTimeZone: string, bandId: number): Promise<void> {
    if (oldTimeZone === newTimeZone) return;
    const segments = await client.eventSegment.findMany({ where: { event: { bandId }, isAllDay: true, startsAt: { not: null } } });
    for (const segment of segments) {
        const dates = getRangeCalendarDates(segmentRange(segment), oldTimeZone)!;
        const spec = createAllDayRange(dates.dates, newTimeZone).getSpec();
        await client.eventSegment.update({ where: { id: segment.id }, data: { startsAt: spec.startsAtDateTime, durationMillis: spec.durationMillis } });
    }
    await recalculateEventDateBounds(client, await fetchCancelledEventStatusIds(client), bandId);
}
