import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import { DateTimeRange } from "shared/time";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { migrateEventUtcSpans } from "src/server/migrateEventUtcSpans";
import { calculateEventDateBoundsUpdatePatch, fetchCancelledEventStatusIds, recalculateEventDateBounds } from "src/server/dateTime";
import { writeSettings } from "src/setting/server/settings";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "../support/settingsMysqlFixture";

const database = new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } });
const day = 86_400_000;

describe.skipIf(!settingsMysqlTestUrl)("band timezone transactions on MariaDB/MySQL", () => {
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    afterEach(() => { vi.unstubAllEnvs(); });

    async function withEvents(work: (tx: Prisma.TransactionClient, auth: CMServerAuthorization, bandId: number,
        eventIds: number[], fixture: SettingsMysqlFixture) => Promise<void>) {
        await withSettingsMysqlFixture(database, async (tx, fixture) => {
            const band = fixture.bands[0]!;
            const auth = await loadAuthorizationForUser(fixture.user, tx, { kind: "band", bandPublicId: parsePublicId<"Band">(band.publicId) });
            const segment = (isAllDay: boolean) => ({
                publicId: generatePublicId(), name: "Segment", description: "", isAllDay,
                startsAt: new Date(isAllDay ? "2026-07-09T22:00:00Z" : "2026-07-10T22:30:12.345Z"),
                durationMillis: BigInt(isAllDay ? day : 1_200_789),
            });
            const eventIds: number[] = [];
            for (const segments of [[segment(true)], [segment(false)], [segment(true), segment(false)]]) {
                const event = await tx.event.create({ data: { publicId: generatePublicId<"Event">(), bandId: band.id,
                    uid: generatePublicId(), name: "Policy fixture", revision: 1, segments: { create: segments } } });
                eventIds.push(event.id);
            }
            await recalculateEventDateBounds(tx, await fetchCancelledEventStatusIds(tx), band.id);
            await work(tx, auth, band.id, eventIds, fixture);
        });
    }

    const events = (tx: Prisma.TransactionClient, ids: number[]) => tx.event.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
    const segments = (tx: Prisma.TransactionClient, ids: number[]) => tx.eventSegment.findMany({ where: { eventId: { in: ids } }, orderBy: { id: "asc" } });
    const changeZone = (tx: Prisma.TransactionClient, auth: CMServerAuthorization, zone: string | null) => writeSettings(tx, auth, [
        { hive: "band", key: "dateTime.bandTimeZone", operation: zone === null ? { kind: "reset" } : { kind: "set", value: zone } },
    ], CreateChangeContext("band-policy-test"));

    it("preserves timed segments, mixed bounds, and feed revisions while reanchoring all-day spans", () => withEvents(async (tx, auth, _bandId, ids) => {
        const before = await events(tx, ids), authored = await segments(tx, ids);
        expect(before[2]!.durationMillis).toBe(BigInt(89_413_134));
        await changeZone(tx, auth, "America/Los_Angeles");
        const after = await events(tx, ids);
        expect(after[0]!.startsAt!.toISOString()).toBe("2026-07-10T07:00:00.000Z");
        expect(after[0]!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z");
        expect(after[0]!.revision).toBe(before[0]!.revision);
        expect(after[1]).toEqual(before[1]);
        expect(after[2]!.durationMillis).toBe(BigInt(day));
        expect(after[2]!.revision).toBe(before[2]!.revision);
        expect((await segments(tx, ids)).filter(segment => !segment.isAllDay)).toEqual(authored.filter(segment => !segment.isAllDay));
    }));

    it("reset restores default bounds", () => withEvents(async (tx, auth, bandId, ids) => {
        await changeZone(tx, auth, "Asia/Tokyo");
        expect((await events(tx, ids))[0]!.endDateTime!.toISOString()).toBe("2026-07-10T15:00:00.000Z");
        await changeZone(tx, auth, null);
        expect(await tx.bandSetting.count({ where: { bandId } })).toBe(0);
        expect((await events(tx, ids))[0]!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z");
    }));

    it("rolls back settings, segments, aggregates, and audits when aggregate recalculation fails", async () => {
        let ids: number[] = [];
        const failure = new Error("Injected aggregate failure");
        let writes = 0;
        await expect(withEvents(async (tx, auth, _bandId, fixtureIds) => {
            ids = fixtureIds;
            const failing = new Proxy(tx, { get(target, property, receiver) {
                if (property !== "event") return Reflect.get(target, property, receiver);
                return new Proxy(target.event, { get(delegate, operation, delegateReceiver) {
                    if (operation !== "update") return Reflect.get(delegate, operation, delegateReceiver);
                    return async (args: Parameters<typeof delegate.update>[0]) => {
                        if (++writes === 2) throw failure;
                        return delegate.update(args);
                    };
                } });
            } });
            await changeZone(failing, auth, "Asia/Tokyo");
        })).rejects.toBe(failure);
        expect(writes).toBe(2);
        // The setting, audit, and event/segment changes shared the rolled-back transaction.
        expect(await database.event.count({ where: { id: { in: ids } } })).toBe(0);
        expect(await database.eventSegment.count({ where: { eventId: { in: ids } } })).toBe(0);
        expect(await database.bandSetting.count()).toBe(0);
        expect(await database.change.count()).toBe(0);
    });

    it("previews and repairs stale bounds without changing authored segments", () => withEvents(async (tx, _auth, bandId, ids) => {
        const authored = await segments(tx, ids);
        await tx.event.update({ where: { id: ids[0]! }, data: { endDateTime: new Date("2026-07-11T00:00:00Z") } });
        const stale = await events(tx, ids), cancelled = await fetchCancelledEventStatusIds(tx);
        const preview = await calculateEventDateBoundsUpdatePatch(tx, ids[0]!, cancelled);
        expect(preview.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z");
        expect(await events(tx, ids)).toEqual(stale);
        await recalculateEventDateBounds(tx, cancelled, bandId);
        expect((await events(tx, ids))[0]!.endDateTime).toEqual(preview.endDateTime);
        expect(await segments(tx, ids)).toEqual(authored);
    }));

    it("preserves authored calendar dates when DST changes elapsed duration", () => withEvents(async (tx, auth, _bandId, ids) => {
        await tx.eventSegment.updateMany({ where: { eventId: { in: ids }, isAllDay: true },
            data: { startsAt: new Date("2026-03-28T23:00:00Z"), durationMillis: BigInt(23 * 3_600_000) } });
        await changeZone(tx, auth, "Asia/Tokyo");
        for (const segment of (await segments(tx, ids)).filter(segment => segment.isAllDay)) {
            expect(segment.durationMillis).toBe(BigInt(day));
            const range = new DateTimeRange({ startsAtDateTime: segment.startsAt, durationMillis: Number(segment.durationMillis), isAllDay: true });
            expect(getRangeCalendarDates(range, "Asia/Tokyo")!.dates).toEqual({ startDate: "2026-03-29", endDateExclusive: "2026-03-30" });
        }
    }));

    it("previews, converts, and safely reruns the versioned UTC-storage migration", () => withEvents(async (tx, _auth, bandId, ids) => {
        vi.stubEnv("CMDB_DEFAULT_BAND_ID", String(bandId));
        await tx.eventSegment.updateMany({ where: { eventId: { in: ids } }, data: { dateTimeVersion: 1 } });
        await tx.eventSegment.updateMany({ where: { eventId: { in: ids }, isAllDay: true },
            data: { startsAt: new Date("2026-03-29T00:00:00Z"), durationMillis: BigInt(day) } });
        const before = await segments(tx, ids);
        const preview = await migrateEventUtcSpans(tx, false);
        expect(preview.changes).toHaveLength(4);
        expect(await segments(tx, ids)).toEqual(before);
        const applied = await migrateEventUtcSpans(tx, true);
        expect(applied.changes).toEqual(preview.changes);
        const after = await segments(tx, ids);
        expect(after.every(segment => segment.dateTimeVersion === 2)).toBe(true);
        for (const segment of after.filter(segment => segment.isAllDay)) {
            expect(segment.startsAt!.toISOString()).toBe("2026-03-28T23:00:00.000Z");
            expect(segment.durationMillis).toBe(BigInt(23 * 3_600_000));
        }
        const again = await migrateEventUtcSpans(tx, true);
        expect(again.changes).toEqual([]);
        expect(again.aggregates).toEqual([]);
        expect(await segments(tx, ids)).toEqual(after);
    }));
});
