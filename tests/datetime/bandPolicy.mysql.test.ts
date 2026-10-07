import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
const day = 86_400_000;

describe.skipIf(!settingsMysqlTestUrl)("band timezone transactions on MariaDB/MySQL", () => {
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    async function withEvents(work: (tx: Prisma.TransactionClient, auth: CMServerAuthorization, bandId: number,
        eventIds: number[], fixture: SettingsMysqlFixture) => Promise<void>) {
        await withSettingsMysqlFixture(database, async (tx, fixture) => {
            const band = fixture.bands[0]!;
            const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
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

    it("previews, converts, and safely reruns the UTC migration for only the selected band", () => withEvents(async (tx, _auth, bandId, ids, fixture) => {
        const other = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id,
            uid: generatePublicId(), name: "Other band's legacy event", revision: 1, segments: { create: {
                publicId: generatePublicId(), name: "Legacy segment", description: "", isAllDay: true,
                dateTimeVersion: 1, startsAt: new Date("2026-03-29T00:00:00Z"), durationMillis: BigInt(day),
            } } }, include: { segments: true } });
        await tx.eventSegment.updateMany({ where: { eventId: { in: ids } }, data: { dateTimeVersion: 1 } });
        await tx.eventSegment.updateMany({ where: { eventId: { in: ids }, isAllDay: true },
            data: { startsAt: new Date("2026-03-29T00:00:00Z"), durationMillis: BigInt(day) } });
        const before = await segments(tx, ids);
        const preview = await migrateEventUtcSpans(tx, bandId, false);
        expect(preview.changes).toHaveLength(4);
        expect(await segments(tx, ids)).toEqual(before);
        const applied = await migrateEventUtcSpans(tx, bandId, true);
        expect(await tx.event.findUniqueOrThrow({ where: { id: other.id }, include: { segments: true } })).toEqual(other);
        expect(applied.changes).toEqual(preview.changes);
        const after = await segments(tx, ids);
        expect(after.every(segment => segment.dateTimeVersion === 2)).toBe(true);
        for (const segment of after.filter(segment => segment.isAllDay)) {
            expect(segment.startsAt!.toISOString()).toBe("2026-03-28T23:00:00.000Z");
            expect(segment.durationMillis).toBe(BigInt(23 * 3_600_000));
        }
        const again = await migrateEventUtcSpans(tx, bandId, true);
        expect(again.changes).toEqual([]);
        expect(again.aggregates).toEqual([]);
        expect(await segments(tx, ids)).toEqual(after);
    }));
});


// MIGRATION_RESTORE: settings-editors
// Source: 1cdb8299f3f0b373ade44adc44de26e06fd59b6a:tests/datetime/bandPolicy.mysql.test.ts:1-207
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: dbec63f32dcf6f9039293011ec1e412f1188575ee053e1f3207e2208cb27dc01
// MIGRATION_REFERENCE_BEGIN
// import { CreateChangeContext } from "@/src/auth/server/activityLog";
// import { generatePublicId } from "src/server/publicId";
// import { Prisma, PrismaClient } from "@prisma/client"
// import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet"
// import { testServerAuthorization } from "tests/support/serverAuthorization"
// import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
// import { Setting } from "@/src/setting/shared/settingKeys"
// import { writeSettingValue } from "@/src/setting/server/settingWrite"
// import { CallMutateEventHooks } from "src/core/db3/server/db3mutationCore"
// import { recalculateEventDateBounds, calculateEventDateBoundsUpdatePatch, fetchCancelledEventStatusIds } from "src/server/dateTime"
// import { migrateEventUtcSpans } from "src/server/migrateEventUtcSpans"
// import { getRangeCalendarDates } from "shared/dateTimePresentation"
// import { getEventSegmentDateTimeRange } from "src/core/db3/shared/schema/event"
//
// const url = process.env.DATETIME_TEST_DATABASE_URL
// const db = new PrismaClient({ datasourceUrl: url })
// const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }
// const day = 86_400_000
// const eventIds = [5001, 5002, 5003]
// const testAuth = testServerAuthorization(null, new ServerPermissionSet([]))
//
// describe.skipIf(!url)("band policy writes with real MySQL", () => {
//   beforeAll(() => {
//     if (!url || !/^\/cmdb_datetime_test_[a-f0-9]{16}$/.test(new URL(url).pathname)) throw new Error("A disposable datetime-test database is required.")
//     process.env.CMDB_BASE_URL = "https://band.test"
//   })
//   beforeEach(async () => {
//     await db.eventSegment.deleteMany({ where: { eventId: { in: eventIds } } })
//     await db.event.deleteMany({ where: { id: { in: eventIds } } })
//     await db.setting.deleteMany()
//     await db.change.deleteMany()
//     await db.setting.create({ data: { publicId: generatePublicId<"Setting">(), name: Setting.BandTimeZone, value: "Europe/Brussels" } })
//     const segment = (allDay: boolean) => ({
//       publicId: generatePublicId(), name: "Segment", description: "", isAllDay: allDay,
//       startsAt: new Date(allDay ? "2026-07-09T22:00:00Z" : "2026-07-10T22:30:12.345Z"),
//       durationMillis: BigInt(allDay ? day : 1_200_789)
//     })
//     for (const [id, segments] of [[5001, [segment(true)]], [5002, [segment(false)]], [5003, [segment(true), segment(false)]]] as const) {
//       await db.event.create({ data: { id, publicId: generatePublicId<"Event">(), name: "Policy fixture", locationDescription: "", revision: 1, segments: { create: [...segments] } } })
//     }
//     const cancelledStatusIds = await fetchCancelledEventStatusIds(db)
//     await db.$transaction(tx => recalculateEventDateBounds(tx, cancelledStatusIds), transactionOptions)
//   })
//   afterAll(async () => {
//     if (url) {
//       await db.eventSegment.deleteMany({ where: { eventId: { in: eventIds } } })
//       await db.event.deleteMany({ where: { id: { in: eventIds } } })
//       await db.setting.deleteMany()
//       await db.change.deleteMany()
//     }
//     await db.$disconnect()
//   })
//
//   const events = () => db.event.findMany({ where: { id: { in: eventIds } }, orderBy: { id: "asc" } })
//   const segments = () => db.eventSegment.findMany({ where: { eventId: { in: eventIds } }, orderBy: { id: "asc" } })
//   const changeZone = (value: string | null) => db.$transaction(tx => writeSettingValue({
//     db: tx, auth: testAuth,
//     changeContext: CreateChangeContext("band-policy-test"), name: Setting.BandTimeZone, value
//   }), transactionOptions)
//
//   it("reanchors all-day segments and exact mixed bounds while preserving timed segments", async () => {
//     const before = await events()
//     const authored = await segments()
//     expect(before[0]!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
//     expect(before[2]!.durationMillis).toBe(BigInt(89_413_134))
//     await changeZone("America/Los_Angeles")
//     const after = await events()
//     expect(after[0]!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
//     expect(after[0]!.startsAt!.toISOString()).toBe("2026-07-10T07:00:00.000Z")
//     expect(after[0]!.revision).toBe(before[0]!.revision) // all-day calendar feed remains the same
//     expect(after[1]).toEqual(before[1])
//     expect(after[2]!.durationMillis).toBe(BigInt(day))
//     expect(after[2]!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
//     expect(after[2]!.revision).toBe(before[2]!.revision)
//     expect((await segments()).filter(segment => !segment.isAllDay)).toEqual(authored.filter(segment => !segment.isAllDay))
//     expect((await segments()).filter(segment => segment.isAllDay).map(segment => segment.startsAt!.toISOString())).toEqual(["2026-07-10T07:00:00.000Z", "2026-07-10T07:00:00.000Z"])
//     expect(await db.change.count()).toBe(1)
//   })
//
//   it("clearing the setting restores default bounds", async () => {
//     await changeZone("Asia/Tokyo")
//     expect((await events())[0]!.endDateTime!.toISOString()).toBe("2026-07-10T15:00:00.000Z")
//     await changeZone(null)
//     expect(await db.setting.count()).toBe(0)
//     expect((await events())[0]!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
//   })
//
//   it("raw setting update, rename, insert and delete hooks refresh bounds in the same transaction", async () => {
//     await db.$transaction(async tx => {
//       let oldModel = (await tx.setting.findFirst())!
//       let model = await tx.setting.update({ where: { id: oldModel.id }, data: { value: "Asia/Tokyo" } })
//       await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, oldModel, db: tx })
//       expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T15:00:00.000Z")
//       oldModel = model
//       model = await tx.setting.update({ where: { id: model.id }, data: { name: "OtherSetting" } })
//       await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, oldModel, db: tx })
//       expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
//       model = await tx.setting.create({ data: { publicId: generatePublicId<"Setting">(), name: Setting.BandTimeZone, value: "America/Los_Angeles" } })
//       await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, db: tx })
//       expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
//       await tx.setting.delete({ where: { id: model.id } })
//       await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, oldModel: model, db: tx })
//       expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
//     }, transactionOptions)
//   })
//
//   it("rolls back configuration, prior aggregate writes and audit when recalculation fails", async () => {
//     const before = await events()
//     const segmentsBefore = await segments()
//     let writes = 0
//     await expect(db.$transaction(async tx => {
//       const failingDb = new Proxy(tx, {
//         get(target, key) {
//           if (key !== "event") return target[key as keyof typeof target]
//           return new Proxy(target.event, {
//             get(delegate, operation) {
//               if (operation !== "update") return delegate[operation as keyof typeof delegate]
//               return async (args: Parameters<typeof delegate.update>[0]) => {
//                 if (++writes === 2) throw new Error("Injected aggregate failure")
//                 return delegate.update(args)
//               }
//             }
//           })
//         }
//       })
//       await writeSettingValue({
//         db: failingDb, auth: testAuth, changeContext: CreateChangeContext("rollback-test"),
//         name: Setting.BandTimeZone, value: "Asia/Tokyo"
//       })
//     }, transactionOptions)).rejects.toThrow("Injected aggregate failure")
//     expect(writes).toBe(2)
//     expect((await db.setting.findFirst())!.value).toBe("Europe/Brussels")
//     expect(await events()).toEqual(before)
//     expect(await segments()).toEqual(segmentsBefore)
//     expect(await db.change.count()).toBe(0)
//   })
//
//   it("previews and repairs stale derived fields without changing authored values", async () => {
//     const authored = await segments()
//     await db.event.update({ where: { id: 5001 }, data: { endDateTime: new Date("2026-07-11T00:00:00Z") } })
//     const stale = await events()
//     const cancelledStatusIds = await fetchCancelledEventStatusIds(db)
//     const preview = await calculateEventDateBoundsUpdatePatch(db, 5001, cancelledStatusIds)
//     expect(preview!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
//     expect(await events()).toEqual(stale)
//     await db.$transaction(tx => recalculateEventDateBounds(tx, cancelledStatusIds), transactionOptions)
//     expect((await events())[0]!.endDateTime).toEqual(preview!.endDateTime)
//     expect(await segments()).toEqual(authored)
//   })
//
//   it("previews, converts and safely reruns the versioned storage migration", async () => {
//     await db.eventSegment.updateMany({ where: { eventId: { in: eventIds } }, data: { dateTimeVersion: 1 } })
//     await db.eventSegment.updateMany({
//       where: { eventId: { in: eventIds }, isAllDay: true },
//       data: { startsAt: new Date("2026-03-29T00:00:00Z"), durationMillis: BigInt(day) }
//     })
//     const before = await segments()
//     const preview = await db.$transaction(tx => migrateEventUtcSpans(tx, false), transactionOptions)
//     expect(preview.changes).toHaveLength(4)
//     expect(await segments()).toEqual(before)
//     const applied = await db.$transaction(tx => migrateEventUtcSpans(tx, true), transactionOptions)
//     expect(applied.changes).toEqual(preview.changes)
//     const after = await segments()
//     expect(after.every(segment => segment.dateTimeVersion === 2)).toBe(true)
//     for (const segment of after.filter(segment => segment.isAllDay)) {
//       expect(segment.startsAt!.toISOString()).toBe("2026-03-28T23:00:00.000Z")
//       expect(segment.durationMillis).toBe(BigInt(23 * 3_600_000))
//     }
//     const again = await db.$transaction(tx => migrateEventUtcSpans(tx, true), transactionOptions)
//     expect(again.changes).toEqual([])
//     expect(again.aggregates).toEqual([])
//     expect(await segments()).toEqual(after)
//   })
//
//   it("preserves selected calendar dates while a setting change alters elapsed DST duration", async () => {
//     await db.eventSegment.updateMany({
//       where: { eventId: { in: eventIds }, isAllDay: true },
//       data: { startsAt: new Date("2026-03-28T23:00:00Z"), durationMillis: BigInt(23 * 3_600_000) }
//     })
//     await changeZone("Asia/Tokyo")
//     for (const segment of (await segments()).filter(segment => segment.isAllDay)) {
//       expect(segment.startsAt!.toISOString()).toBe("2026-03-28T15:00:00.000Z")
//       expect(segment.durationMillis).toBe(BigInt(day))
//       expect(getRangeCalendarDates(getEventSegmentDateTimeRange(segment), "Asia/Tokyo")!.dates)
//         .toEqual({ startDate: "2026-03-29", endDateExclusive: "2026-03-30" })
//     }
//   })
//
//   // tests like this are cancer; new code needs to be testable units
//   // it("the actual schema migration distinguishes existing rows from new rows", async () => {
//   //   // This table lives only in the runner's disposable database.
//   //   await db.$executeRawUnsafe("CREATE TABLE LegacySegment LIKE EventSegment")
//   //   try {
//   //     await db.$executeRawUnsafe("ALTER TABLE LegacySegment DROP COLUMN dateTimeVersion")
//   //     const insert = "INSERT INTO LegacySegment (eventId, name, description, durationMillis) VALUES (5001, 'fixture', '', 86400000)"
//   //     await db.$executeRawUnsafe(insert)
//   //     const migration = readFileSync("db/migrations/20260915230000_event_utc_spans/migration.sql", "utf8")
//   //       .replace(/--[^\n]*/g, "").replace(/EventSegment/g, "LegacySegment")
//   //     for (const statement of migration.split(";").map(sql => sql.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement)
//   //     await db.$executeRawUnsafe(insert)
//   //     const rows = await db.$queryRawUnsafe<{ dateTimeVersion: number }[]>("SELECT dateTimeVersion FROM LegacySegment ORDER BY id")
//   //     expect(rows.map(row => row.dateTimeVersion)).toEqual([1, 2])
//   //   } finally {
//   //     await db.$executeRawUnsafe("DROP TABLE LegacySegment")
//   //   }
//   // })
// })
// MIGRATION_REFERENCE_END
