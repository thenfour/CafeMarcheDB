import { createAllDayRange } from "shared/time";
import { CalendarDate } from "shared/dateTimePolicy";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
import {
  CalcRelativeTiming,
  CalcRelativeTimingFromNow,
  DateSortPredicateAsc,
  DateTimeRange,
  gMillisecondsPerHour,
} from "shared/time"

const minute = 60_000
const iso = (value: Date | null) => value?.toISOString() ?? null
const dateParts = (value: Date | null) => value
  ? [value.getFullYear(), value.getMonth() + 1, value.getDate()]
  : null

function allDay(year: number, month: number, day: number, days = 1) {
  const date = new CalendarDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "Europe/Brussels")
  return createAllDayRange({ startDate: date.date, endDateExclusive: date.addDays(days).date }, date.timeZone)
}

function timed(start: string | Date, durationMillis: number) {
  return new DateTimeRange({
    startsAtDateTime: typeof start === "string" ? new Date(start) : start,
    durationMillis,
    isAllDay: false,
  })
}

function collect() {
  const authored = allDay(2026, 7, 10)
  const loaded = new DateTimeRange(authored.getSpec())
  const loadedAgain = new DateTimeRange(loaded.getSpec())
  const regular = timed("2026-07-10T07:45:00.000Z", gMillisecondsPerHour)
  const offGrid = timed("2026-07-10T07:47:12.345Z", 20 * minute)
  const tbd = new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true })
  const springDay = allDay(2026, 3, 29)
  const autumnDay = allDay(2026, 10, 25)
  const union = autumnDay.unionWith(autumnDay)
  const localMidnightEnd = timed(new Date(2026, 6, 10, 23, 30), 30 * minute)
  const bandBoundaryInstants = [
    "2026-07-09T21:59:59.999Z",
    "2026-07-09T22:00:00.000Z",
    "2026-07-10T21:59:59.999Z",
    "2026-07-10T22:00:00.000Z",
  ]
  const foldStart = "2026-10-25T01:30:00.000Z"
  const fold = timed(foldStart, gMillisecondsPerHour)
  const pacificFold = timed("2026-11-01T09:30:00.000Z", gMillisecondsPerHour)
  const mixedSegments = [
    timed(new Date(2026, 6, 9, 23), 2 * gMillisecondsPerHour),
    allDay(2026, 7, 10),
    timed(new Date(2026, 6, 11, 1), gMillisecondsPerHour),
  ]
  const permutations = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]]
  const mixedUnions = permutations.map(indices => {
    const range = mixedSegments[indices[0]!]!
      .unionWith(mixedSegments[indices[1]!]!)
      .unionWith(mixedSegments[indices[2]!]!)
    return {
      start: iso(range.getStartDateTime()),
      end: iso(range.getEndDateTime()),
      coversEverySegment: mixedSegments.every(segment =>
        range.getStartDateTime()! <= segment.getStartDateTime()!
        && range.getEndDateTime()! >= segment.getEndDateTime()!),
    }
  })
  const today = new Date(2026, 6, 10, 12)
  const localNearMidnight = new Date(2026, 6, 10, 23, 55)
  const tomorrow = timed(new Date(2026, 6, 11, 0, 15), gMillisecondsPerHour)
  const timestamp = new Date("2026-07-10T07:45:00.000Z")

  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    authoredDate: iso(authored.getSpec().startsAtDateTime),
    loadedDate: iso(loaded.getSpec().startsAtDateTime),
    loadedAgainDate: iso(loadedAgain.getSpec().startsAtDateTime),
    displayedAllDayDate: getRangeCalendarDates(loaded, "Europe/Brussels")!.start.date.split("-").map(Number),
    timedStart: iso(regular.getStartDateTime()),
    timedEnd: iso(regular.getEndDateTime()),
    timedBoundaries: ["2026-07-10T07:44:59.999Z", "2026-07-10T07:45:00.000Z", "2026-07-10T08:44:59.999Z", "2026-07-10T08:45:00.000Z"]
      .map(now => regular.hitTestDateTime(new Date(now))),
    offGridStart: iso(offGrid.getStartDateTime()),
    offGridDuration: offGrid.getSpec().durationMillis,
    tbd: {
      start: tbd.getStartDateTime(),
      end: tbd.getEndDateTime(),
      timing: tbd.hitTestDateTime(today),
      relative: CalcRelativeTiming(today, tbd, { viewerTimeZone: timeZone, bandTimeZone: "Europe/Brussels", locale: "en-US" }),
    },
    allDayBandBoundaries: bandBoundaryInstants.map(now => authored.hitTestDateTime(new Date(now))),
    springDayElapsedHours: (springDay.getEndDateTime()!.valueOf() - springDay.getStartDateTime()!.valueOf()) / gMillisecondsPerHour,
    autumnDayElapsedHours: (autumnDay.getEndDateTime()!.valueOf() - autumnDay.getStartDateTime()!.valueOf()) / gMillisecondsPerHour,
    identicalAutumnUnionHours: union.getDurationMillis() / gMillisecondsPerHour,
    foldStart: iso(fold.getStartDateTime()),
    pacificFoldStart: iso(pacificFold.getStartDateTime()),
    mixedUnions,
    midnightEndMembership: [10, 11].map(day => getRangeCalendarDates(localMidnightEnd, timeZone)!.hitTest(new CalendarDate(`2026-07-${day}`, timeZone)).inRange),
    tomorrowLabel: CalcRelativeTiming(localNearMidnight, tomorrow, { viewerTimeZone: timeZone, bandTimeZone: "Europe/Brussels", locale: "en-US" }).label,
    todayLabelAgreesWithCalendar: CalcRelativeTiming(today, authored, { viewerTimeZone: timeZone, bandTimeZone: "Europe/Brussels", locale: "en-US" }).label === "Today"
      && getRangeCalendarDates(authored, "Europe/Brussels")!.hitTest(CalendarDate.fromInstant({ value: today, timeZone: "Europe/Brussels" })).inRange,
    timestampLabelAfterOneMinute: CalcRelativeTimingFromNow(timestamp, new Date(timestamp.valueOf() + minute)).label,
    sortedDates: [null, new Date("2026-07-11T00:00:00Z"), new Date("2026-07-10T00:00:00Z")]
      .sort(DateSortPredicateAsc).map(iso),
    leapDayUnionHours: allDay(2024, 2, 28).unionWith(allDay(2024, 2, 29)).getDurationMillis() / gMillisecondsPerHour,
  }
}

export type TimePolicyProbe = ReturnType<typeof collect>

if (require.main === module) {
  process.stdout.write(JSON.stringify(collect()))
}
