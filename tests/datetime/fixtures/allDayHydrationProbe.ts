import { DateTimeRange, gMillisecondsPerDay } from "../../../shared/time"

const iso = (value: Date | null) => value?.toISOString() ?? null
const localDay = (value: Date | null) => value
  ? [value.getFullYear(), value.getMonth() + 1, value.getDate()]
  : null

const cases = [
  { date: "2026-07-10", days: 1, end: [2026, 7, 11] },
  { date: "2026-12-31", days: 2, end: [2027, 1, 2] },
  { date: "2024-02-28", days: 3, end: [2024, 3, 2] },
  { date: "2026-03-29", days: 1, end: [2026, 3, 30] },
  { date: "2026-10-25", days: 1, end: [2026, 10, 26] },
  { date: "2026-03-08", days: 1, end: [2026, 3, 9] },
  { date: "2026-11-01", days: 1, end: [2026, 11, 2] },
  { date: "2026-10-04", days: 1, end: [2026, 10, 5] },
]

function snapshot(range: DateTimeRange) {
  return {
    stored: iso(range.getSpec().startsAtDateTime),
    duration: range.getSpec().durationMillis,
    start: localDay(range.getStartDateTime()),
    end: localDay(range.getEndDateTime()),
    isAllDay: range.isAllDay(),
  }
}

function collect() {
  const tbd = new DateTimeRange({ startsAtDateTime: null, durationMillis: gMillisecondsPerDay, isAllDay: true })
  const dates = cases.map(({ date, days, end }) => {
    const start = date.split("-").map(Number)
    const stored = `${date}T00:00:00.000Z`
    const duration = days * gMillisecondsPerDay
    const input = new Date(stored)
    const loaded = new DateTimeRange({ startsAtDateTime: input, durationMillis: duration, isAllDay: true })
    let copy = loaded
    for (let i = 0; i < 10; i++) copy = new DateTimeRange(copy.getSpec())
    const serialized = JSON.parse(copy.toSerializableString())
    const restored = new DateTimeRange({ ...serialized, startsAtDateTime: new Date(serialized.startsAtDateTime) })
    // Early and late local selections straddle UTC dates in opposite directions.
    const authored = [0, 12, 23].map(hour => {
      const selection = new Date(start[0]!, start[1]! - 1, start[2]!, hour, 30)
      const original = selection.valueOf()
      const range = DateTimeRange.fromLocalDate({ startsAtDateTime: selection, durationMillis: duration, isAllDay: true })
      return { value: snapshot(new DateTimeRange(range.getSpec())), inputUnchanged: selection.valueOf() === original }
    })
    return {
      date,
      expected: { stored, duration, start, end, isAllDay: true },
      loaded: snapshot(loaded),
      copied: snapshot(copy),
      restored: snapshot(restored),
      copiedThroughTbd: [snapshot(tbd.unionWith(loaded)), snapshot(loaded.unionWith(tbd))],
      inputAfterLoading: iso(input),
      authored,
    }
  })
  const regular = new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T00:00:00.000Z"), durationMillis: gMillisecondsPerDay, isAllDay: true })
  const withTime = new Date("2026-07-10T23:45:12.345Z")
  const normalized = new DateTimeRange({ startsAtDateTime: withTime, durationMillis: gMillisecondsPerDay, isAllDay: true })
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dates,
    ordinarySelfUnion: snapshot(regular.unionWith(regular)),
    tbd: snapshot(DateTimeRange.fromLocalDate(tbd.getSpec())),
    ignoredTime: { stored: iso(normalized.getSpec().startsAtDateTime), input: iso(withTime) },
  }
}

export type AllDayHydrationProbe = ReturnType<typeof collect>
process.stdout.write(JSON.stringify(collect()))
