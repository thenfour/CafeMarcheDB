import { createAllDayRange } from "shared/time";
import { addCalendarDays } from "shared/dateTimePolicy";
import "tsconfig-paths/register"
import { createCalendar, addEventToCalendar2 } from "../../src/core/db3/server/ical"
import {
  EventForCal,
  EventSegmentForCal,
  GetEventCalendarInput,
  GetEventSegmentCalendarInput,
} from "../../src/core/db3/server/icalUtils"

// This is a child-process probe, so each run has a real, isolated host timezone.
// It exercises both the application's feed adapter and the installed serializer.
process.env.CMDB_BASE_URL = "https://band.test"

const settings = {
  calendarName: "Band agenda",
  calendarCompany: "Band",
  calendarProduct: "Backstage",
  eventNamePrefix: "Band: ",
}

async function exportSegment(startsAt: string | null, durationMillis: number, isAllDay: boolean) {
  const authored = isAllDay && startsAt ? createAllDayRange({ startDate: startsAt.slice(0, 10), endDateExclusive: addCalendarDays(startsAt.slice(0, 10), durationMillis / 86400000) }, "Europe/Brussels") : null
  const segment: EventSegmentForCal = {
    id: 1,
    name: "Set",
    description: "",
    startsAt: authored ? authored.getStartDateTime() : startsAt === null ? null : new Date(startsAt),
    durationMillis: BigInt(authored ? authored.getDurationMillis() : durationMillis),
    isAllDay,
    uid: "date-policy-segment",
    statusId: null,
  }
  const event: Partial<EventForCal> = {
    id: 1,
    name: "Concert",
    revision: 1,
    locationDescription: "Hall",
    segments: [segment],
    songLists: [],
    status: { significance: null },
  }
  const input = GetEventSegmentCalendarInput({ segment, event, descriptionText: "", bandTimeZone: "Europe/Brussels" })
  const calendar = await createCalendar({ icalSettings: settings })
  addEventToCalendar2(calendar, null, input, event as never, [], settings)
  const lines = calendar.toString().split(/\r?\n/)
  return {
    start: input?.start.toISOString() ?? null,
    end: input?.end.toISOString() ?? null,
    dateLines: lines.filter(line => /^DT(?:START|END)[;:]/.test(line)),
    eventCount: lines.filter(line => line === "BEGIN:VEVENT").length,
    inputHash: GetEventCalendarInput(event, [], "Europe/Brussels")!.inputHash,
  }
}

async function main() {
  const oneDay = 86_400_000
  const oneHour = 3_600_000
  const result = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ordinaryAllDay: await exportSegment("2026-07-10T00:00:00.000Z", oneDay, true),
    multipleAllDay: await exportSegment("2026-07-10T00:00:00.000Z", 3 * oneDay, true),
    brusselsSpringAllDay: await exportSegment("2026-03-29T00:00:00.000Z", oneDay, true),
    brusselsAutumnAllDay: await exportSegment("2026-10-25T00:00:00.000Z", oneDay, true),
    sydneySpringEveAllDay: await exportSegment("2026-10-03T00:00:00.000Z", oneDay, true),
    sydneySpringAllDay: await exportSegment("2026-10-04T00:00:00.000Z", oneDay, true),
    sydneyAutumnAllDay: await exportSegment("2026-04-05T00:00:00.000Z", oneDay, true),
    timedCrossingMidnight: await exportSegment("2026-07-10T23:30:00.000Z", oneHour, false),
    timedBrusselsSpring: await exportSegment("2026-03-29T00:30:00.000Z", oneHour, false),
    timedBrusselsAutumn: await exportSegment("2026-10-25T00:30:00.000Z", oneHour, false),
    timedOffGrid: await exportSegment("2026-07-10T07:47:12.345Z", 1_200_789, false),
    timedBrusselsSecondOccurrence: await exportSegment("2026-10-25T01:30:12.345Z", 1_200_789, false),
    timedPacificSecondOccurrence: await exportSegment("2026-11-01T09:30:12.345Z", 1_200_789, false),
    timedZeroDuration: await exportSegment("2026-07-10T07:47:12.345Z", 0, false),
    timedSubsecond: await exportSegment("2026-07-10T07:47:12.345Z", 1, false),
    tbd: await exportSegment(null, oneDay, true),
  }
  process.stdout.write(JSON.stringify(result))
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
