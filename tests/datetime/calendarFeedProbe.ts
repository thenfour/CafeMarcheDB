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
  const segment: EventSegmentForCal = {
    id: 1,
    name: "Set",
    description: "",
    startsAt: startsAt === null ? null : new Date(startsAt),
    durationMillis: BigInt(durationMillis),
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
  const input = GetEventSegmentCalendarInput({ segment, event, descriptionText: "" })
  const calendar = await createCalendar({ icalSettings: settings })
  addEventToCalendar2(calendar, null, input, event as never, [], settings)
  const lines = calendar.toString().split(/\r?\n/)
  return {
    start: input?.start.toISOString() ?? null,
    end: input?.end.toISOString() ?? null,
    dateLines: lines.filter(line => /^DT(?:START|END)[;:]/.test(line)),
    eventCount: lines.filter(line => line === "BEGIN:VEVENT").length,
    inputHash: GetEventCalendarInput(event, [])!.inputHash,
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
    tbd: await exportSegment(null, oneDay, true),
  }
  process.stdout.write(JSON.stringify(result))
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
