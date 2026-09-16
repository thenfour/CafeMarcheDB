import { createAllDayRange } from "shared/time";
import { addCalendarDays } from "shared/dateTimePolicy";
import { DateTimeRange } from "../../../shared/time"
import { getEventDateTimeRangeFromSegments, getEventSegmentMinDate } from "../../../src/core/db3/shared/schema/event"
import { RecalcEventDateRangeAndIncrementRevision } from "../../../src/core/db3/server/db3mutationCore"
import type { TransactionalPrismaClient } from "../../../src/core/db3/shared/apiTypes"

const hour = 3_600_000
const tbd = () => new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true })
const allDay = (date: string, days = 1) => createAllDayRange({ startDate: date, endDateExclusive: addCalendarDays(date, days) }, "Europe/Brussels")
const timed = (start: Date | string, durationMillis: number) => new DateTimeRange({ startsAtDateTime: new Date(start), durationMillis, isAllDay: false })
const local = (month: number, day: number, hour = 0) => new Date(Date.UTC(2026, month - 1, day, hour))
const snapshot = (range: DateTimeRange) => ({
  start: range.getSpec().startsAtDateTime?.toISOString() ?? null,
  duration: range.getSpec().durationMillis,
  allDay: range.isAllDay(),
})
const calendarExpected = (date: string, days: number) => snapshot(allDay(date, days))

function permutations<T>(values: T[]): T[][] {
  if (!values.length) return [[]]
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]))
}

const fixtures = [
  { name: "audit reproducer", ranges: [timed(local(7, 9, 23), 2 * hour), allDay("2026-07-10"), timed(local(7, 11, 1), hour)], expected: { start: "2026-07-09T22:00:00.000Z", duration: 28 * hour, allDay: false } },
  { name: "Brussels autumn", ranges: [allDay("2026-10-25"), allDay("2026-10-25")], expected: calendarExpected("2026-10-25", 1) },
  { name: "Brussels spring", ranges: [allDay("2026-03-29"), timed(local(3, 29, 1), hour)], expected: { start: "2026-03-28T23:00:00.000Z", duration: 23 * hour, allDay: false } },
  { name: "Pacific autumn", ranges: [allDay("2026-11-01"), allDay("2026-11-01")], expected: calendarExpected("2026-11-01", 1) },
  { name: "Pacific spring", ranges: [allDay("2026-03-08"), allDay("2026-03-09")], expected: calendarExpected("2026-03-08", 2) },
  { name: "Sydney autumn", ranges: [allDay("2026-04-05"), allDay("2026-04-05")], expected: calendarExpected("2026-04-05", 1) },
  { name: "Sydney spring", ranges: [allDay("2026-10-03"), allDay("2026-10-04")], expected: calendarExpected("2026-10-03", 2) },
  { name: "leap day and gaps", ranges: [allDay("2024-02-28"), allDay("2024-03-02"), allDay("2024-02-29")], expected: calendarExpected("2024-02-28", 4) },
  { name: "year boundary", ranges: [allDay("2026-12-31", 2), allDay("2027-01-03")], expected: calendarExpected("2026-12-31", 4) },
  { name: "exclusive midnight end", ranges: [allDay("2026-07-09"), timed(local(7, 9, 23), hour)], expected: { start: "2026-07-08T22:00:00.000Z", duration: 26 * hour, allDay: false } },
  { name: "one millisecond after midnight", ranges: [allDay("2026-07-09"), timed(local(7, 9, 23), hour + 1)], expected: { start: "2026-07-08T22:00:00.000Z", duration: 26 * hour + 1, allDay: false } },
  { name: "terminal midnight point", ranges: [timed(local(7, 9, 23), hour), timed(local(7, 11), 0), allDay("2026-07-09")], expected: { start: "2026-07-08T22:00:00.000Z", duration: 50 * hour, allDay: false } },
  { name: "TBD does not force all-day", ranges: [tbd(), timed("2026-07-10T07:47:12.345Z", 120_001), tbd()], expected: { start: "2026-07-10T07:47:12.345Z", duration: 120_001, allDay: false } },
  { name: "timed precision and gaps", ranges: [timed("2026-07-10T07:47:12.345Z", 1), timed("2026-07-10T08:47:12.345Z", 123)], expected: { start: "2026-07-10T07:47:12.345Z", duration: hour + 123, allDay: false } },
  { name: "timed repeated hour", ranges: [timed("2026-10-25T00:30:12.345Z", 1), timed("2026-10-25T01:30:12.345Z", 1)], expected: { start: "2026-10-25T00:30:12.345Z", duration: hour + 1, allDay: false } },
]

function asSegment(range: DateTimeRange, index: number) {
  const spec = range.getSpec()
  return { id: index + 1, eventId: 1, name: "Segment", description: "", uid: `segment-${index}`, startsAt: spec.startsAtDateTime, durationMillis: BigInt(spec.durationMillis), isAllDay: spec.isAllDay, statusId: null as number | null }
}

async function collect() {
  process.env.CMDB_BASE_URL = "https://band.test"
  const results = fixtures.map(fixture => {
    const originals = fixture.ranges.map(snapshot)
    const orders = permutations(fixture.ranges).map(ranges => {
      const union = DateTimeRange.union(ranges)
      return {
        value: snapshot(union),
        hydrated: snapshot(new DateTimeRange(union.getSpec())),
        aggregate: snapshot(getEventDateTimeRangeFromSegments(ranges.map(asSegment), [])),
        coversAll: ranges.filter(range => !range.isTBD()).every(range =>
          range.getSpec().durationMillis === 0
            ? union.getStartDateTime()! <= range.getStartDateTime()! && union.getEndDateTime()! >= range.getStartDateTime()!
            : union.getStartDateTime()! <= range.getStartDateTime()! && union.getEndDateTime()! >= range.getEndDateTime()!),
      }
    })
    return { name: fixture.name, expected: fixture.expected, orders, inputsUnchanged: JSON.stringify(originals) === JSON.stringify(fixture.ranges.map(snapshot)) }
  })

  // Binary unions remain useful for two ranges. Aggregate original collections
  // together because a timed hull cannot retain terminal point-date membership.
  const pairCases = fixtures.flatMap(fixture =>
    permutations(fixture.ranges).map(ranges => ({
      expected: fixture.expected,
      left: snapshot(ranges.reduce((acc, range) => acc.unionWith(range), tbd())),
      right: snapshot(ranges.reduceRight((acc, range) => range.unionWith(acc), tbd())),
    })))
  const idempotence = fixtures.flatMap(fixture => fixture.ranges).filter(range => !range.isTBD()).map(range => ({
    expected: snapshot(range), actual: snapshot(range.unionWith(range)),
  }))

  const active = fixtures[11]!.ranges.map(asSegment)
  const cancelled = { ...asSegment(allDay("2026-06-01", 90), 10), statusId: 9 }
  const segments = [...active, cancelled, asSegment(tbd(), 11)]
  const filtered = snapshot(getEventDateTimeRangeFromSegments(segments, [9]))

  const writes: Array<{ start: string | null; duration: number; allDay: boolean; end: string | null }> = []
  let writerUsesEventFilter = true
  for (const ordered of permutations(active)) {
    // Execute the real writer with a small read/write boundary stub. No SQL or
    // transaction rollback is simulated; capture the actual persisted bounds.
    const rows = [...ordered, cancelled]
    const transaction = {
      setting: { findFirst: async () => ({ value: Intl.DateTimeFormat().resolvedOptions().timeZone }) },
      eventSegment: { findMany: async (args: { where: { eventId: number } }) => {
        writerUsesEventFilter &&= args.where.eventId === 1
        return rows
      } },
      eventStatus: { findMany: async () => [{ id: 9 }] },
      event: {
        findFirst: async () => ({ id: 1, name: "Event", revision: 1, calendarInputHash: "", locationDescription: "Hall", segments: rows, songLists: [] }),
        update: async ({ data }: { data: { startsAt: Date | null; durationMillis: number; isAllDay: boolean; endDateTime: Date | null } }) => {
          writes.push({ start: data.startsAt?.toISOString() ?? null, duration: data.durationMillis, allDay: data.isAllDay, end: data.endDateTime?.toISOString() ?? null })
        },
      },
    }
    await RecalcEventDateRangeAndIncrementRevision({ eventId: 1, updatingEventModel: {}, db: transaction as unknown as TransactionalPrismaClient })
  }
  const futureSegment = asSegment(timed("2099-07-10T07:47:12.345Z", hour), 0)
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    results, pairCases, idempotence, filtered, writes, writerUsesEventFilter,
    expectedWriteEnd: "2026-07-11T00:00:00.000Z",
    empty: snapshot(DateTimeRange.union([])),
    allTbd: snapshot(DateTimeRange.union([tbd(), tbd()])),
    allCancelled: snapshot(getEventDateTimeRangeFromSegments([cancelled], [9])),
    minFuture: getEventSegmentMinDate({ segments: [futureSegment] } as Parameters<typeof getEventSegmentMinDate>[0])?.toISOString(),
    minEmpty: getEventSegmentMinDate({ segments: [] } as unknown as Parameters<typeof getEventSegmentMinDate>[0]),
  }
}

export type UnionPolicyProbe = Awaited<ReturnType<typeof collect>>
void collect().then(result => process.stdout.write(JSON.stringify(result))).catch(error => {
  console.error(error)
  process.exitCode = 1
})
