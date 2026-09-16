import { CalendarDate } from "shared/dateTimePolicy";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import { CalcRelativeTimingFromNow, DateTimeRange } from "../../../shared/time"

const cases = [
  { start: "2026-07-10T07:47:12.345Z", duration: 1_200_789 },
  { start: "2026-07-10T07:45:00.001Z", duration: 1 },
  { start: "2026-07-10T23:59:59.999Z", duration: 999 },
  { start: "2026-10-25T00:30:12.345Z", duration: 3_600_001 },
  { start: "2026-10-25T01:30:12.345Z", duration: 1_200_789 },
  { start: "2026-11-01T08:30:12.345Z", duration: 3_600_001 },
  { start: "2026-11-01T09:30:12.345Z", duration: 1_200_789 },
  { start: "2026-03-29T00:59:59.999Z", duration: 2 },
  { start: "2026-03-08T09:59:59.999Z", duration: 2 },
  { start: "2026-07-10T07:47:12.345Z", duration: 0 },
]

const iso = (value: Date | null) => value?.toISOString() ?? null
function snapshot(range: DateTimeRange) {
  return {
    start: iso(range.getStartDateTime()),
    end: iso(range.getEndDateTime()),
    duration: range.getSpec().durationMillis,
    isAllDay: range.isAllDay(),
  }
}

function collect() {
  const tbd = new DateTimeRange({ startsAtDateTime: null, durationMillis: 123, isAllDay: false })
  const values = cases.map(({ start, duration }) => {
    const input = new Date(start)
    const range = new DateTimeRange({ startsAtDateTime: input, durationMillis: duration, isAllDay: false })
    const expectedEnd = new Date(input.valueOf() + duration)
    const loaded = snapshot(range)
    let copy = range
    for (let i = 0; i < 10; i++) copy = new DateTimeRange(copy.getSpec())
    const serialized = JSON.parse(copy.toSerializableString())
    const restored = new DateTimeRange({ ...serialized, startsAtDateTime: new Date(serialized.startsAtDateTime) })
    const authoring = new DateTimeRange(range.getSpec())
    const boundaries = [input.valueOf() - 1, input.valueOf(), expectedEnd.valueOf() - 1, expectedEnd.valueOf()]
      .map(time => range.hitTestDateTime(new Date(time)))
    input.setTime(0)
    return {
      expected: { start, end: expectedEnd.toISOString(), duration, isAllDay: false },
      loaded,
      copied: snapshot(copy),
      restored: snapshot(restored),
      authoring: snapshot(authoring),
      copiesThroughUnion: [snapshot(range.unionWith(tbd)), snapshot(tbd.unionWith(range)), snapshot(range.unionWith(range))],
      afterInputMutation: snapshot(range),
      boundaries,
    }
  })
  const midnight = new Date(2026, 6, 10)
  const point = new DateTimeRange({ startsAtDateTime: midnight, durationMillis: 0, isAllDay: false })
  const now = new Date(2026, 6, 10, 23, 59, 59, 999)
  const pointLabels = [-60_000, 0, 1].map(delta => CalcRelativeTimingFromNow(new Date(now.valueOf() + delta), now))
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    values,
    tbd: snapshot(tbd),
    midnightPoint: {
      start: iso(point.getStartDateTime()),
      end: iso(point.getEndDateTime()),
      days: [9, 10, 11].map(day => getRangeCalendarDates(point, Intl.DateTimeFormat().resolvedOptions().timeZone)!.hitTest(new CalendarDate(`2026-07-${String(day).padStart(2, "0")}`, Intl.DateTimeFormat().resolvedOptions().timeZone)).inRange),
      timing: [-1, 0, 1].map(delta => point.hitTestDateTime(new Date(midnight.valueOf() + delta))),
    },
    pointLabels,
  }
}

export type TimedHydrationProbe = ReturnType<typeof collect>
process.stdout.write(JSON.stringify(collect()))
