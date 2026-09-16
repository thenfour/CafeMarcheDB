import { createAllDayRange } from "shared/time";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import { getEventSegmentDateTimeRange } from "src/core/db3/shared/schema/event";
import db from "db";
import { resolveBandTimeZone } from "shared/dateTimePolicy";
import { Setting } from "shared/settingKeys";
import { EventStatusSignificance, getEventDateBoundsFromSegments } from "src/core/db3/db3";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

// Scheduling configuration is read fresh; it must not inherit the branding
// cache's last-known-good fallback when deciding event boundaries.
export async function loadBandTimeZone(client: TransactionalPrismaClient = db): Promise<string> {
    const setting = await client.setting.findFirst({ where: { name: Setting.BandTimeZone } });
    return resolveBandTimeZone(setting?.value);
}

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
        await client.eventSegment.update({ where: { id: segment.id }, data: {
            startsAt: spec.startsAtDateTime, durationMillis: spec.durationMillis,
        } });
    }
    await recalculateEventDateBounds(client);
}
