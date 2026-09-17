import { getRangeCalendarDates } from "../../shared/dateTimePresentation";
import { createAllDayRange } from "../../shared/time";
import { Setting } from "../../shared/settingKeys";
import { EventStatusSignificance, getEventDateBoundsFromSegments, getEventSegmentDateTimeRange } from "../core/db3/db3";
import { TransactionalPrismaClient } from "../core/db3/shared/apiTypes";
//import db from "db";

export function isBandTimeZoneSetting(name: string | undefined): boolean {
    return name?.trim().toLowerCase() === Setting.BandTimeZone.toLowerCase();
}

// Read-only calculation shared by the review command and transactional refresh.
export async function calculateEventDateBounds(client: TransactionalPrismaClient, eventId: number) {
    // todo: optimize. either join or pass in the cancelled statuses to avoid an extra query.
    const segments = await client.eventSegment.findMany({
        where: { eventId },
    });
    const cancelled = await client.eventStatus.findMany({
        select: { id: true },
        where: { significance: EventStatusSignificance.Cancelled },
    });
    return getEventDateBoundsFromSegments(
        segments,
        cancelled.map(status => status.id)
    );
}

// Refresh derived bounds after stored segment instants change.
export async function recalculateEventDateBounds(client: TransactionalPrismaClient): Promise<void> {
    const events = await client.event.findMany({
        select: {
            id: true,
            startsAt: true,
            durationMillis: true,
            isAllDay: true,
            endDateTime: true,
        },
        orderBy: { id: "asc" },
    });
    for (const event of events) {
        // this incurs more db queres; consider optimizing by joins.
        const data = await calculateEventDateBounds(client, event.id);

        const startsAtChanged = event.startsAt?.valueOf() !== data.startsAt?.valueOf();
        const durationChanged = Number(event.durationMillis) !== data.durationMillis;
        const isAllDayChanged = event.isAllDay !== data.isAllDay;
        const endDateTimeChanged = event.endDateTime?.valueOf() !== data.endDateTime?.valueOf();
        if (startsAtChanged || durationChanged || isAllDayChanged || endDateTimeChanged) {
            await client.event.update({
                where: { id: event.id },
                data,
            });
        }
    }
}

/** Caller owns the transaction containing the setting write and this reanchor. */
export async function reanchorAllDayEvents(client: TransactionalPrismaClient, oldTimeZone: string, newTimeZone: string): Promise<void> {
    if (oldTimeZone === newTimeZone) return;
    const segments = await client.eventSegment.findMany({ where: { isAllDay: true, startsAt: { not: null } } });
    for (const segment of segments) {
        const dates = getRangeCalendarDates(getEventSegmentDateTimeRange(segment), oldTimeZone)!;
        const spec = createAllDayRange(dates.dates, newTimeZone).getSpec();
        await client.eventSegment.update({
            where: { id: segment.id },
            data: {
                startsAt: spec.startsAtDateTime,
                durationMillis: spec.durationMillis,
            }
        });
    }
    await recalculateEventDateBounds(client);
}
