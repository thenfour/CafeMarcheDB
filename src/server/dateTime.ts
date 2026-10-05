import { getRangeCalendarDates } from "../../shared/dateTimePresentation";
import { Setting } from "../setting/shared/settingKeys";
import { createAllDayRange } from "../../shared/time";
import { EventStatusSignificance, getEventSegmentDateTimeRange } from "../core/db3/db3";
import { TransactionalPrismaClient } from "../core/db3/shared/apiTypes";
import { getEventDateRangeUpdateColumnsFromSegments } from "../core/db3/shared/schema/event";

export function isBandTimeZoneSetting(name: string | undefined): boolean {
    return name?.trim().toLowerCase() === Setting.BandTimeZone.toLowerCase();
}

export async function fetchCancelledEventStatusIds(client: TransactionalPrismaClient): Promise<number[]> {
    const cancelled = await client.eventStatus.findMany({
        select: { id: true },
        where: { significance: EventStatusSignificance.Cancelled },
    });
    return cancelled.map(status => status.id);
}

export async function calculateEventDateBoundsUpdatePatch(client: TransactionalPrismaClient, eventId: number, cancelledStatusIds: number[]) {
    const segments = await client.eventSegment.findMany({
        where: { eventId },
    });
    return getEventDateRangeUpdateColumnsFromSegments(
        segments,
        cancelledStatusIds
    );
}

// Refresh derived bounds after stored segment instants change.
export async function recalculateEventDateBounds(client: TransactionalPrismaClient, cancelledStatusIds: number[]): Promise<void> {
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
        const data = await calculateEventDateBoundsUpdatePatch(client, event.id, cancelledStatusIds);

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
    const cancelledStatusIds = await fetchCancelledEventStatusIds(client);
    await recalculateEventDateBounds(client, cancelledStatusIds);
}
