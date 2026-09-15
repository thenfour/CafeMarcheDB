import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { getCalendarWindow } from "shared/dateTimePolicy"
import { calendarWindowSql } from "src/core/db3/server/calendarWindowSql"

const url = process.env.DATETIME_TEST_DATABASE_URL
const db = new PrismaClient({ datasourceUrl: url })
describe.skipIf(!url)("calendar overlap SQL with real MySQL", () => {
  beforeAll(async () => {
    if (!url || !/^\/cmdb_datetime_test_[a-f0-9]{16}$/.test(new URL(url).pathname)) throw new Error("A disposable datetime-test database is required.")
    await db.eventStatus.create({ data: { id: 9, label: "Cancelled", description: "", significance: "Cancelled" } })
    const segment = (start: string | null, duration: number, allDay = false, statusId: number | null = null) => ({
      name: "Segment", description: "", startsAt: start ? new Date(start) : null, durationMillis: BigInt(duration), isAllDay: allDay, statusId,
    })
    const hour = 3_600_000
    const day = 86_400_000
    const fixtures = [
      ["tokyo-0030", [segment("2026-07-10T15:30:00Z", hour)]],
      ["ends-at-start", [segment("2026-07-10T14:00:00Z", hour)]],
      ["spans-window", [segment("2026-07-01T00:00:00Z", 20 * day)]],
      ["later-segment", [segment("2026-06-01T00:00:00Z", hour), segment("2026-07-11T01:00:00Z", hour)]],
      ["point-at-start", [segment("2026-07-10T15:00:00Z", 0)]],
      ["point-at-end", [segment("2026-07-11T15:00:00Z", 0)]],
      ["one-ms-overlap", [segment("2026-07-10T14:00:00Z", hour + 1)]],
      ["starts-at-end", [segment("2026-07-11T15:00:00Z", hour)]],
      ["tbd", [segment(null, day, true)]],
      ["cancelled", [segment("2026-07-11T01:00:00Z", hour, false, 9)]],
      ["all-day-selected", [segment("2026-07-11T00:00:00Z", day, true)]],
      ["all-day-previous", [segment("2026-07-10T00:00:00Z", day, true)]],
      ["all-day-spanning", [segment("2026-07-09T00:00:00Z", 3 * day, true)]],
      ["all-day-next", [segment("2026-07-12T00:00:00Z", day, true)]],
      ["all-day-minimum", [segment("2026-07-11T00:00:00Z", 0, true)]],
      ["all-day-rounded", [segment("2026-07-10T12:00:00Z", 1.5 * day, true)]],
      ["all-day-round-down", [segment("2026-07-10T00:00:00Z", 1.5 * day - 1, true)]],
      ["spring-last-ms", [segment("2026-03-29T21:59:59.999Z", 0)]],
      ["spring-end", [segment("2026-03-29T22:00:00Z", 0)]],
      ["fold-earlier", [segment("2026-10-25T00:30:00Z", 0)]],
      ["fold-later", [segment("2026-10-25T01:30:00Z", 0)]],
    ] as const
    for (const [name, segments] of fixtures) {
      // Deliberately stale aggregate starts must not control segment selection.
      await db.event.create({ data: { name, revision: 1, startsAt: new Date("2026-06-01T00:00:00Z"), segments: { create: [...segments] } } })
    }
  })
  afterAll(async () => db.$disconnect())

  async function matches(zone: string, date = "2026-07-11", end = "2026-07-12", sessionZone = "+00:00") {
    const predicate = calendarWindowSql(getCalendarWindow({ startDate: date, endDateExclusive: end }, zone))
    return db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET time_zone = '${sessionZone}'`)
      const rows = await tx.$queryRawUnsafe<{ name: string }[]>(`SELECT P.name FROM Event P WHERE ${predicate} ORDER BY P.name`)
      return rows.map(row => row.name)
    })
  }

  it.each(["+00:00", "-07:00", "+09:00"])("uses viewer bounds and exclusive segment overlap independently of SQL session %s", async sessionZone => {
    expect(await matches("Asia/Tokyo", undefined, undefined, sessionZone)).toEqual([
      "all-day-minimum", "all-day-rounded", "all-day-selected", "all-day-spanning",
      "later-segment", "one-ms-overlap", "point-at-start", "spans-window", "tokyo-0030",
    ])
  })

  it("keeps all-day dates stable in a western viewer timezone", async () => {
    const names = await matches("America/Los_Angeles")
    expect(names.filter(name => name.startsWith("all-day"))).toEqual([
      "all-day-minimum", "all-day-rounded", "all-day-selected", "all-day-spanning",
    ])
    expect(names).not.toContain("tokyo-0030")
  })

  it("uses the 23-hour spring calendar window", async () => {
    expect(await matches("Europe/Brussels", "2026-03-29", "2026-03-30")).toEqual(["spring-last-ms"])
  })

  it("includes both repeated-hour occurrences in the 25-hour autumn window", async () => {
    expect(await matches("Europe/Brussels", "2026-10-25", "2026-10-26")).toEqual(["fold-earlier", "fold-later"])
  })
})
