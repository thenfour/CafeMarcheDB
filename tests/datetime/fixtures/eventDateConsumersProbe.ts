import { createAllDayRange } from "shared/time";
import { addCalendarDays } from "shared/dateTimePolicy";
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DateTimeRange } from "../../../shared/time"
import { EventShortDate } from "../../../src/core/components/event/EventShortDate"

// Render the production component with an explicit reference time and locale.
// The child process supplies the viewer timezone; no modules or clocks are mocked.
function renderEvent(startsAt: string | null, durationMillis: number, isAllDay: boolean, refTime: string) {
  const dateRange = isAllDay && startsAt ? createAllDayRange({ startDate: startsAt.slice(0, 10), endDateExclusive: addCalendarDays(startsAt.slice(0, 10), durationMillis / 86400000) }, "Europe/Brussels") : new DateTimeRange({
    startsAtDateTime: startsAt === null ? null : new Date(startsAt),
    durationMillis,
    isAllDay,
  })
  return renderToStaticMarkup(React.createElement(EventShortDate, {
    dateRange, now: new Date(refTime), locale: "en-US", bandTimeZone: "Europe/Brussels",
  }))
}

const start = "2026-07-10T16:00:00.000Z"
const duration = 4 * 3_600_000
const result = {
  ongoingTimed: renderEvent(start, duration, false, "2026-07-10T18:00:00.000Z"),
  boundaries: {
    before: renderEvent(start, duration, false, "2026-07-10T15:59:59.999Z"),
    start: renderEvent(start, duration, false, start),
    lastMillisecond: renderEvent(start, duration, false, "2026-07-10T19:59:59.999Z"),
    end: renderEvent(start, duration, false, "2026-07-10T20:00:00.000Z"),
    after: renderEvent(start, duration, false, "2026-07-10T20:00:00.001Z"),
  },
  zeroDuration: renderEvent(start, 0, false, start),
  overnight: renderEvent("2026-07-09T16:00:00.000Z", 48 * 3_600_000, false, "2026-07-10T18:00:00.000Z"),
  allDay: renderEvent("2026-07-10T00:00:00.000Z", 86_400_000, true, "2026-07-10T12:00:00.000Z"),
  multiDay: renderEvent("2026-07-10T00:00:00.000Z", 3 * 86_400_000, true, "2026-07-11T12:00:00.000Z"),
  tokyoToday: renderEvent("2026-07-10T15:30:00.000Z", 3_600_000, false, "2026-07-10T15:10:00.000Z"),
  priorYear: renderEvent("2025-07-10T00:00:00.000Z", 86_400_000, true, "2026-07-10T12:00:00.000Z"),
  sameYear: renderEvent("2025-07-10T00:00:00.000Z", 86_400_000, true, "2025-07-10T12:00:00.000Z"),
  tbd: renderEvent(null, duration, false, "2026-07-10T18:00:00.000Z"),
}
process.stdout.write(JSON.stringify(result))

export type EventDateConsumersProbe = typeof result
