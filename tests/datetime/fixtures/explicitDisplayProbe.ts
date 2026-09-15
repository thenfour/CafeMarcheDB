import { DateTimeRange } from "../../../shared/time"

const timed = new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T15:30:12.345Z"), durationMillis: 1_200_789, isAllDay: false })
const allDay = new DateTimeRange({ startsAtDateTime: new Date("2026-12-31T00:00:00Z"), durationMillis: 3 * 86_400_000, isAllDay: true })
const fold = new DateTimeRange({ startsAtDateTime: new Date("2026-10-25T00:30:00Z"), durationMillis: 3_600_000, isAllDay: false })
const overnight = new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T21:30:00Z"), durationMillis: 3 * 3_600_000, isAllDay: false })
const point = new DateTimeRange({ ...timed.getSpec(), durationMillis: 0 })
const before = timed.toSerializableString()
console.log(JSON.stringify({
  legacy: timed.toString(),
  utc: timed.toDisplayString({ displayTimeZone: "UTC", locale: "en-GB" }),
  tokyo: timed.toDisplayString({ displayTimeZone: "Asia/Tokyo", locale: "en-GB" }),
  brussels: timed.toDisplayString({ displayTimeZone: "Europe/Brussels", locale: "en-GB" }),
  allDay: ["UTC", "Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo"].map(displayTimeZone => allDay.toDisplayString({ displayTimeZone, locale: "en-GB" })),
  fold: fold.toDisplayString({ displayTimeZone: "Europe/Brussels", locale: "en-GB" }),
  overnight: overnight.toDisplayString({ displayTimeZone: "Europe/Brussels", locale: "en-GB" }),
  point: point.toDisplayString({ displayTimeZone: "UTC", locale: "en-GB" }),
  unchanged: before === timed.toSerializableString(),
}))
