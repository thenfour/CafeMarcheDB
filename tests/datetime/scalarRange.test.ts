import { describe, expect, it } from "vitest"
import { changeDateTimeRangeStartDate, createAllDayRange, DateTimeRange, Timing } from "shared/time"
import { CalendarDate } from "shared/dateTimePolicy"
import { getRangeCalendarDates } from "shared/dateTimePresentation"
import { convertLegacyAllDay } from "src/server/migrateEventUtcSpans"

describe("UTC span ownership", () => {
  it("does not expose mutable internal Dates through any accessor", () => {
    const range = createAllDayRange({ startDate: "2026-10-25", endDateExclusive: "2026-10-26" }, "Europe/Brussels")
    const before = range.toSerializableString()
    range.getSpec().startsAtDateTime!.setTime(0)
    range.getStartDateTime()!.setTime(0)
    range.getEndDateTime()!.setTime(0)
    range.getBounds()!.start.setTime(0)
    expect(range.toSerializableString()).toBe(before)
  })
  it.each([false, true])("uses identical millisecond arithmetic for all-day intent %s", isAllDay => {
    const range = new DateTimeRange({ startsAtDateTime: new Date("2026-10-25T00:30:12.345Z"), durationMillis: 25 * 3_600_000 + 7, isAllDay })
    expect(range.getBounds()!.end.toISOString()).toBe("2026-10-26T01:30:12.352Z")
    expect(range.hitTestDateTime(new Date("2026-10-26T01:30:12.351Z"))).toBe(Timing.Present)
    expect(range.hitTestDateTime(new Date("2026-10-26T01:30:12.352Z"))).toBe(Timing.Past)
  })
  it("keeps calendar length separate from elapsed length when moving an all-day selection", () => {
    const range = createAllDayRange({ startDate: "2026-03-28", endDateExclusive: "2026-03-31" }, "Europe/Brussels")
    expect(range.getDurationMillis()).toBe(71 * 3_600_000)
    expect(getRangeCalendarDates(range, "Europe/Brussels")!.dayCount).toBe(3)
    const moved = changeDateTimeRangeStartDate(range, "2026-04-10", "Europe/Brussels")
    expect(moved.getDurationMillis()).toBe(72 * 3_600_000)
    expect(getRangeCalendarDates(moved, "Europe/Brussels")!.dates)
      .toEqual({ startDate: "2026-04-10", endDateExclusive: "2026-04-13" })
  })
  it("requires explicit zones for calendar comparisons", () => {
    expect(() => new CalendarDate("2026-07-10", "Asia/Tokyo").daysUntil(new CalendarDate("2026-07-11", "UTC"))).toThrow()
  })
})

describe("legacy migration boundary", () => {
  it.each([
    ["2026-03-29", "2026-03-28T23:00:00.000Z", 23],
    ["2026-10-25", "2026-10-24T22:00:00.000Z", 25],
  ])("converts both start and duration for %s", (date, start, hours) => {
    const range = convertLegacyAllDay(new Date(`${date}T00:00:00Z`), 86_400_000, "Europe/Brussels")
    expect(range.getStartDateTime()!.toISOString()).toBe(start)
    expect(range.getDurationMillis()).toBe(Number(hours) * 3_600_000)
  })
})
