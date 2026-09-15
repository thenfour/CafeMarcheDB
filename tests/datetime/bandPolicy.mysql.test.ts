import { Prisma, PrismaClient } from "@prisma/client"
import type { Ctx } from "@blitzjs/next"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { CreateChangeContext } from "shared/activityLog"
import { Setting } from "shared/settingKeys"
import { writeSettingValue } from "src/auth/server/settingWrite"
import { CallMutateEventHooks } from "src/core/db3/server/db3mutationCore"
import { recalculateEventDateBounds, calculateEventDateBounds } from "src/server/dateTime"

const url = process.env.DATETIME_TEST_DATABASE_URL
const db = new PrismaClient({ datasourceUrl: url })
const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }
const day = 86_400_000
const eventIds = [5001, 5002, 5003]

describe.skipIf(!url)("band policy writes with real MySQL", () => {
  beforeAll(() => {
    if (!url || !/^\/cmdb_datetime_test_[a-f0-9]{16}$/.test(new URL(url).pathname)) throw new Error("A disposable datetime-test database is required.")
    process.env.CMDB_BASE_URL = "https://band.test"
  })
  beforeEach(async () => {
    await db.eventSegment.deleteMany({ where: { eventId: { in: eventIds } } })
    await db.event.deleteMany({ where: { id: { in: eventIds } } })
    await db.setting.deleteMany()
    await db.change.deleteMany()
    await db.setting.create({ data: { name: Setting.BandTimeZone, value: "Europe/Brussels" } })
    const segment = (allDay: boolean) => ({ name: "Segment", description: "", isAllDay: allDay,
      startsAt: new Date(allDay ? "2026-07-10T00:00:00Z" : "2026-07-10T22:30:12.345Z"),
      durationMillis: BigInt(allDay ? day : 1_200_789) })
    for (const [id, segments] of [[5001, [segment(true)]], [5002, [segment(false)]], [5003, [segment(true), segment(false)]]] as const) {
      await db.event.create({ data: { id, name: "Policy fixture", locationDescription: "", revision: 1, segments: { create: [...segments] } } })
    }
    await db.$transaction(tx => recalculateEventDateBounds(tx), transactionOptions)
  })
  afterAll(async () => {
    if (url) {
      await db.eventSegment.deleteMany({ where: { eventId: { in: eventIds } } })
      await db.event.deleteMany({ where: { id: { in: eventIds } } })
      await db.setting.deleteMany()
      await db.change.deleteMany()
    }
    await db.$disconnect()
  })

  const events = () => db.event.findMany({ where: { id: { in: eventIds } }, orderBy: { id: "asc" } })
  const segments = () => db.eventSegment.findMany({ where: { eventId: { in: eventIds } }, orderBy: { id: "asc" } })
  const changeZone = (value: string | null) => db.$transaction(tx => writeSettingValue({ db: tx, ctx: {} as Ctx,
    changeContext: CreateChangeContext("band-policy-test"), name: Setting.BandTimeZone, value }), transactionOptions)

  it("refreshes absolute ends and mixed band dates without rewriting authored segments or timed events", async () => {
    const before = await events()
    const authored = await segments()
    expect(before[0]!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
    expect(before[2]!.durationMillis).toBe(BigInt(2 * day))
    await changeZone("America/Los_Angeles")
    const after = await events()
    expect(after[0]!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
    expect(after[0]!.startsAt).toEqual(before[0]!.startsAt)
    expect(after[0]!.revision).toBe(before[0]!.revision) // all-day calendar feed remains the same
    expect(after[1]).toEqual(before[1])
    expect(after[2]!.durationMillis).toBe(BigInt(day))
    expect(after[2]!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
    expect(after[2]!.revision).toBe(before[2]!.revision)
    expect(await segments()).toEqual(authored)
    expect(await db.change.count()).toBe(1)
  })

  it("clearing the setting restores default bounds", async () => {
    await changeZone("Asia/Tokyo")
    expect((await events())[0]!.endDateTime!.toISOString()).toBe("2026-07-10T15:00:00.000Z")
    await changeZone(null)
    expect(await db.setting.count()).toBe(0)
    expect((await events())[0]!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
  })

  it("raw setting update, rename, insert and delete hooks refresh bounds in the same transaction", async () => {
    await db.$transaction(async tx => {
      let oldModel = (await tx.setting.findFirst())!
      let model = await tx.setting.update({ where: { id: oldModel.id }, data: { value: "Asia/Tokyo" } })
      await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, oldModel, db: tx })
      expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T15:00:00.000Z")
      oldModel = model
      model = await tx.setting.update({ where: { id: model.id }, data: { name: "OtherSetting" } })
      await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, oldModel, db: tx })
      expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
      model = await tx.setting.create({ data: { name: Setting.BandTimeZone, value: "America/Los_Angeles" } })
      await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, db: tx })
      expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-11T07:00:00.000Z")
      await tx.setting.delete({ where: { id: model.id } })
      await CallMutateEventHooks({ tableNameOrSpecialMutationKey: "Setting", model, db: tx })
      expect((await tx.event.findUnique({ where: { id: 5001 } }))!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
    }, transactionOptions)
  })

  it("rolls back configuration, prior aggregate writes and audit when recalculation fails", async () => {
    const before = await events()
    let writes = 0
    await expect(db.$transaction(async tx => {
      const failingDb = new Proxy(tx, { get(target, key) {
        if (key !== "event") return target[key as keyof typeof target]
        return new Proxy(target.event, { get(delegate, operation) {
          if (operation !== "update") return delegate[operation as keyof typeof delegate]
          return async (args: Parameters<typeof delegate.update>[0]) => {
            if (++writes === 2) throw new Error("Injected aggregate failure")
            return delegate.update(args)
          }
        } })
      } })
      await writeSettingValue({ db: failingDb, ctx: {} as Ctx, changeContext: CreateChangeContext("rollback-test"),
        name: Setting.BandTimeZone, value: "Asia/Tokyo" })
    }, transactionOptions)).rejects.toThrow("Injected aggregate failure")
    expect(writes).toBe(2)
    expect((await db.setting.findFirst())!.value).toBe("Europe/Brussels")
    expect(await events()).toEqual(before)
    expect(await db.change.count()).toBe(0)
  })

  it("previews and repairs stale derived fields without changing authored values", async () => {
    const authored = await segments()
    await db.event.update({ where: { id: 5001 }, data: { endDateTime: new Date("2026-07-11T00:00:00Z") } })
    const stale = await events()
    const preview = await calculateEventDateBounds(db, 5001)
    expect(preview!.endDateTime!.toISOString()).toBe("2026-07-10T22:00:00.000Z")
    expect(await events()).toEqual(stale)
    await db.$transaction(tx => recalculateEventDateBounds(tx), transactionOptions)
    expect((await events())[0]!.endDateTime).toEqual(preview!.endDateTime)
    expect(await segments()).toEqual(authored)
  })
})
