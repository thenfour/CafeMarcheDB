import { createAllDayRange } from "shared/time";
import { addCalendarDays } from "shared/dateTimePolicy";
import { DateTimeRange, CalcRelativeTiming, changeDateTimeRangeStartDate, changeDateTimeRangeAllDay } from "../../../shared/time"
import { RecalcEventDateRangeAndIncrementRevision } from "../../../src/core/db3/server/db3mutationCore"

const day = 86_400_000
const allDay = (date: string, timeZone = "Europe/Brussels") => createAllDayRange({ startDate: date, endDateExclusive: addCalendarDays(date, 1) }, timeZone)
const timed = (start: string) => new DateTimeRange({ startsAtDateTime: new Date(start), durationMillis: 1_200_789, isAllDay: false })
const snapshot = (range: DateTimeRange) => ({ ...range.getSpec(), startsAtDateTime: range.getSpec().startsAtDateTime?.toISOString() })
const event = allDay("2026-07-10")
const bounds = [
  ["Europe/Brussels", "2026-07-09T22:00:00Z", "2026-07-10T22:00:00Z"],
  ["Asia/Tokyo", "2026-07-09T15:00:00Z", "2026-07-10T15:00:00Z"],
  ["America/Los_Angeles", "2026-07-10T07:00:00Z", "2026-07-11T07:00:00Z"],
].map(([zone, start, end]) => ({
  zone,
  timing: [Date.parse(start!) - 1, Date.parse(start!), Date.parse(end!) - 1, Date.parse(end!)]
    .map(time => allDay("2026-07-10", zone!).hitTestDateTime(new Date(time))),
  interval: allDay("2026-07-10", zone!).getBounds()!,
}))
const fold = timed("2026-10-25T01:30:12.345Z")
const late = timed("2026-07-10T22:30:12.345Z")

async function collect() {
  process.env.CMDB_BASE_URL = "https://band.test"
  let persisted: unknown
  const segments = [event, late].map((range, id) => ({ id, eventId: 1, name: "Segment", startsAt: range.getSpec().startsAtDateTime,
    durationMillis: BigInt(range.getDurationMillis()), isAllDay: range.isAllDay(), statusId: null }))
  await RecalcEventDateRangeAndIncrementRevision({ eventId: 1, updatingEventModel: {}, db: {
    setting: { findFirst: async () => ({ value: "Europe/Brussels" }) },
    eventSegment: { findMany: async () => segments }, eventStatus: { findMany: async () => [] },
    event: { findFirst: async () => ({ id: 1, revision: 1, name: "Event", locationDescription: "", segments, songLists: [] }),
      update: async ({ data }: { data: unknown }) => { persisted = data } },
  } })
  return {
    bounds,
    spring: allDay("2026-03-29").getBounds(),
    fall: allDay("2026-10-25").getBounds(),
    foldInterval: fold.getBounds(),
    ongoingLabel: CalcRelativeTiming(new Date("2026-07-09T23:00:00Z"), event, { viewerTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, bandTimeZone: "Europe/Brussels" }),
    endedLabel: CalcRelativeTiming(new Date("2026-07-10T23:00:00Z"), event, { viewerTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, bandTimeZone: "Europe/Brussels" }),
    mixed: snapshot(DateTimeRange.union([event, late])),
    mixedWestern: snapshot(DateTimeRange.union([event, late])),
    changedDate: snapshot(changeDateTimeRangeStartDate(late, "2026-07-12", "Europe/Brussels")),
    sameFoldDate: snapshot(changeDateTimeRangeStartDate(fold, "2026-10-25", "Europe/Brussels")),
    gap: snapshot(changeDateTimeRangeStartDate(timed("2026-03-28T01:30:00Z"), "2026-03-29", "Europe/Brussels")),
    foldAuthoring: snapshot(changeDateTimeRangeStartDate(timed("2026-10-24T00:30:00Z"), "2026-10-25", "Europe/Brussels")),
    toAllDay: snapshot(changeDateTimeRangeAllDay(late, true, "Europe/Brussels", new Date("2026-07-09T21:59:12Z"))),
    toTimed: snapshot(changeDateTimeRangeAllDay(allDay("2026-07-11"), false, "Europe/Brussels", new Date("2026-07-09T21:59:12Z"))),
    persisted,
  }
}
export type BandPolicyConsumersProbe = Awaited<ReturnType<typeof collect>>
void collect().then(result => process.stdout.write(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1 })
