import { formatEventDateRange, formatEventDateRangeTranslations } from "shared/dateTimePresentation";
import { createAllDayRange } from "shared/time";
import { DateTimeRange } from "../../../shared/time"

const timed = new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T15:30:12.345Z"), durationMillis: 1_200_789, isAllDay: false })
const allDay = createAllDayRange({ startDate: "2026-12-31", endDateExclusive: "2027-01-03" }, "Europe/Brussels")
const fold = new DateTimeRange({ startsAtDateTime: new Date("2026-10-25T00:30:00Z"), durationMillis: 3_600_000, isAllDay: false })
const overnight = new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T21:30:00Z"), durationMillis: 3 * 3_600_000, isAllDay: false })
const point = new DateTimeRange({ ...timed.getSpec(), durationMillis: 0 })
const before = timed.toSerializableString()
console.log(JSON.stringify({
  utc: formatEventDateRange(timed, { viewerTimeZone: "UTC", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  tokyo: formatEventDateRange(timed, { viewerTimeZone: "Asia/Tokyo", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  brussels: formatEventDateRange(timed, { viewerTimeZone: "Europe/Brussels", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  allDay: ["UTC", "Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo"].map(displayTimeZone => formatEventDateRange(allDay, { viewerTimeZone: displayTimeZone, bandTimeZone: "Europe/Brussels", locale: "en-GB" })),
  fold: formatEventDateRange(fold, { viewerTimeZone: "Europe/Brussels", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  overnight: formatEventDateRange(overnight, { viewerTimeZone: "Europe/Brussels", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  point: formatEventDateRange(point, { viewerTimeZone: "UTC", bandTimeZone: "Europe/Brussels", locale: "en-GB" }),
  translations: formatEventDateRangeTranslations(timed, { viewerTimeZone: "Europe/Brussels", bandTimeZone: "Europe/Brussels", locale: "en-US" }),
  allDayTranslations: formatEventDateRangeTranslations(allDay, { viewerTimeZone: "Asia/Tokyo", bandTimeZone: "Europe/Brussels", locale: "en-US" }),
  spring: formatEventDateRange(createAllDayRange({ startDate: "2026-03-29", endDateExclusive: "2026-03-30" }, "Europe/Brussels"), { viewerTimeZone: "America/Los_Angeles", bandTimeZone: "Europe/Brussels", locale: "en" }),
  autumn: formatEventDateRange(createAllDayRange({ startDate: "2026-10-25", endDateExclusive: "2026-10-26" }, "Europe/Brussels"), { viewerTimeZone: "Asia/Tokyo", bandTimeZone: "Europe/Brussels", locale: "en" }),
  longTimed: formatEventDateRange(new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T15:30:00Z"), durationMillis: 2 * 86400000, isAllDay: false }), { viewerTimeZone: "Europe/Brussels", bandTimeZone: "Europe/Brussels", locale: "en" }),
  unchanged: before === timed.toSerializableString(),
}))
