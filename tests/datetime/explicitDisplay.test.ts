import { beforeAll, describe, expect, it } from "vitest"
import { DateTimeRange } from "shared/time"
import { formatEventDateRange, formatZonedDate } from "shared/dateTimePresentation"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["UTC", "Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"])("compact explicit display on a %s host", zone => {
  let result: any
  beforeAll(() => { result = runTimeZoneProbe("tests/datetime/fixtures/explicitDisplayProbe.ts", zone) }, 20_000)
  it("renders the requested timezone while preserving stored precision", () => {
    expect(result.utc).toBe("Friday, 10 July 2026 @ 15:30-15:50h")
    expect(result.tokyo).toBe("Saturday, 11 July 2026 @ 0:30-0:50h")
    expect(result.brussels).toBe("Friday, 10 July 2026 @ 17:30-17:50h")
    expect(result.unchanged).toBe(true)
  })
  it("keeps all-day dates fixed and excludes the ending midnight date", () => {
    expect(new Set(result.allDay).size).toBe(1)
    expect(result.allDay[0]).toBe("31 December 2026 - 2 January 2027")
    expect(result.spring).toBe("Sunday, 29 March 2026")
    expect(result.autumn).toBe("Sunday, 25 October 2026")
  })
  it("preserves compact clocks through folds, overnight spans and points", () => {
    expect(result.fold).toBe("Sunday, 25 October 2026 @ 2:30-2:30h")
    expect(result.overnight).toBe("Friday, 10 July 2026 @ 23:30-2:30h")
    expect(result.point).toBe("Friday, 10 July 2026 @ 15:30-15:30h")
    expect(result.longTimed).toBe("10 - 12 July 2026")
  })
  it("preserves multilingual day/month order and clock suffixes", () => {
    expect(result.translations).toEqual({
      en: { date: "Friday 10 July 2026", time: "17:30h - 17:50h" },
      fr: { date: "vendredi 10 juillet 2026", time: "17:30h - 17:50h" },
      nl: { date: "vrijdag 10 juli 2026", time: "17:30u - 17:50u" },
    })
    expect(result.allDayTranslations).toEqual({
      en: { date: "31 December 2026 - 2 January 2027" },
      fr: { date: "31 d\u00e9cembre 2026 - 2 janvier 2027" },
      nl: { date: "31 december 2026 - 2 januari 2027" },
    })
  })
})
it("requires a valid explicit presentation timezone even for TBD", () => {
  const range = new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false })
  expect(() => formatEventDateRange(range, { viewerTimeZone: "Moon/Base", bandTimeZone: "UTC", locale: "en" })).toThrow()
  expect(() => formatEventDateRange(range, { viewerTimeZone: undefined as any, bandTimeZone: "UTC", locale: "en" })).toThrow()
  expect(formatEventDateRange(range, { viewerTimeZone: "UTC", bandTimeZone: "UTC", locale: "en" })).toBe("TBD")
})

it("formats an instant through its required zone", () => {
  const value = new Date("2026-07-10T23:30:00Z")
  const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const
  expect(formatZonedDate({ value, timeZone: "Europe/Brussels" }, "en-GB", options)).toBe("Saturday, 11 July 2026")
  expect(formatZonedDate({ value, timeZone: "America/Los_Angeles" }, "en-GB", options)).toBe("Friday, 10 July 2026")
  expect(() => formatZonedDate({ value, timeZone: undefined as any }, "en-GB", options)).toThrow()
})
