import { formatEventDateRange } from "shared/dateTimePresentation";
import { DateTimeRange } from "shared/time"
const cases = [
  ["2026-07-10T20:00:00Z", 7200000, false],
  ["2026-07-10T20:15:00Z", 8100000, false],
  ["2026-07-10T23:00:00Z", 14400000, false],
  ["2026-07-10T00:00:00Z", 86400000, true],
  ["2026-07-10T00:00:00Z", 172800000, true],
  ["2026-07-31T00:00:00Z", 172800000, true],
  ["2026-12-31T00:00:00Z", 259200000, true],
  [null, 0, false],
] as const
console.log(JSON.stringify(cases.map(([start, durationMillis, isAllDay]) => formatEventDateRange(new DateTimeRange({
  startsAtDateTime: start ? new Date(start) : null, durationMillis, isAllDay,
}), { viewerTimeZone: "UTC", bandTimeZone: "UTC", locale: "en" }))))
