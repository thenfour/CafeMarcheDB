import { afterEach, describe, expect, it, vi } from "vitest"
import {
  BandTimeZoneSchema,
  bandDateTimeToInstant,
  calendarDateToUtcDate,
  getAllDayInterval,
  getBandDateTimeFields,
  getStoredAllDayCalendarRange,
  resolveBandTimeZone,
} from "shared/dateTimePolicy"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

afterEach(() => { vi.useRealTimers() })

describe("band timezone configuration", () => {
  it.each([undefined, null, "", "   "])("defaults an unset value %j to Brussels", value => {
    expect(resolveBandTimeZone(value)).toBe("Europe/Brussels")
  })

  it.each(["Europe/Brussels", "Asia/Tokyo", "UTC", "America/Los_Angeles", "US/Pacific"])(
    "accepts the named zone %s", value => {
      expect(BandTimeZoneSchema.parse(value)).toBe(value)
    },
  )

  it("trims a configured name without replacing it", () => {
    expect(resolveBandTimeZone("  Asia/Tokyo  ")).toBe("Asia/Tokyo")
  })

  it.each([
    "Moon/Base", "+02:00", "-0700", "2026-07-10", "",
    "2026-07-10T09:45+02:00", "2026-07-10T09:45Z", "2026-07-10[Europe/Brussels]",
  ])("rejects invalid setting %j", value => {
    expect(BandTimeZoneSchema.safeParse(value).success).toBe(false)
  })

  it("does not silently default a malformed persisted zone", () => {
    expect(() => resolveBandTimeZone("Moon/Base")).toThrow()
  })
})

describe("band-time authoring operations", () => {
  it.each([
    ["Europe/Brussels", "2026-07-10T07:45:00.000Z"],
    ["Asia/Tokyo", "2026-07-10T00:45:00.000Z"],
    ["America/New_York", "2026-07-10T13:45:00.000Z"],
    ["America/Los_Angeles", "2026-07-10T16:45:00.000Z"],
    ["Asia/Kathmandu", "2026-07-10T04:00:00.000Z"],
  ])("interprets 09:45 using %s", (zone, expected) => {
    expect(bandDateTimeToInstant({ date: "2026-07-10", time: "09:45" }, zone).toISOString()).toBe(expected)
  })

  it("preserves seconds and milliseconds without snapping to picker increments", () => {
    const instant = bandDateTimeToInstant({ date: "2026-07-10", time: "09:47:12.345" }, "Europe/Brussels")
    expect(instant.toISOString()).toBe("2026-07-10T07:47:12.345Z")
    expect(getBandDateTimeFields(instant, "Europe/Brussels")).toEqual({
      date: "2026-07-10", time: "09:47:12.345", offset: "+02:00",
    })
  })

  it.each([
    ["2026-03-29", "02:30", "Europe/Brussels", "2026-03-29T01:30:00.000Z"],
    ["2026-10-25", "02:30", "Europe/Brussels", "2026-10-25T00:30:00.000Z"],
    ["2026-03-08", "02:30", "America/Los_Angeles", "2026-03-08T10:30:00.000Z"],
    ["2026-11-01", "01:30", "America/Los_Angeles", "2026-11-01T08:30:00.000Z"],
    ["2026-10-04", "02:15", "Australia/Lord_Howe", "2026-10-03T15:45:00.000Z"],
  ])("resolves %s %s in %s with conventional DST disambiguation", (date, time, zone, expected) => {
    expect(bandDateTimeToInstant({ date, time }, zone).toISOString()).toBe(expected)
  })

  it("chooses the same repeated-hour occurrence regardless of today's season", () => {
    vi.useFakeTimers()
    for (const today of ["2026-01-10T12:00Z", "2026-07-10T12:00Z"]) {
      vi.setSystemTime(new Date(today))
      expect(bandDateTimeToInstant({ date: "2026-10-25", time: "02:30" }, "Europe/Brussels").toISOString())
        .toBe("2026-10-25T00:30:00.000Z")
    }
  })

  it("formats both repeated-hour instants without changing their occurrence", () => {
    const first = new Date("2026-10-25T00:30:00.000Z")
    const second = new Date("2026-10-25T01:30:00.000Z")
    expect(getBandDateTimeFields(first, "Europe/Brussels"))
      .toEqual({ date: "2026-10-25", time: "02:30:00.000", offset: "+02:00" })
    expect(getBandDateTimeFields(second, "Europe/Brussels"))
      .toEqual({ date: "2026-10-25", time: "02:30:00.000", offset: "+01:00" })
    expect(first.toISOString()).toBe("2026-10-25T00:30:00.000Z")
    expect(second.toISOString()).toBe("2026-10-25T01:30:00.000Z")
  })

  it.each([
    ["2026-02-30", "09:45"],
    ["2026-7-10", "09:45"],
    ["2026-07-10T09:45Z", "09:45"],
    ["2026-07-10", "09:45+09:00"],
    ["2026-07-10", "09:45Z"],
    ["2026-07-10", "24:00"],
    ["2026-07-10", "09:60"],
    ["2026-07-10", "09:45:60"],
  ])("rejects malformed or offset-bearing civil input %s %s", (date, time) => {
    expect(() => bandDateTimeToInstant({ date, time }, "Europe/Brussels")).toThrow()
  })
})

describe("all-day policy separates calendar dates from absolute boundaries", () => {
  it.each([
    ["2026-03-29", "2026-03-30", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z", 23],
    ["2026-10-25", "2026-10-26", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", 25],
    ["2024-02-28", "2024-03-01", "2024-02-27T23:00:00.000Z", "2024-02-29T23:00:00.000Z", 48],
  ])("resolves calendar midnights for %s through %s", (startDate, endDateExclusive, start, end, hours) => {
    const interval = getAllDayInterval({ startDate, endDateExclusive }, "Europe/Brussels")
    expect(interval.start.toISOString()).toBe(start)
    expect(interval.end.toISOString()).toBe(end)
    expect(interval.end.valueOf() - interval.start.valueOf()).toBe(Number(hours) * 3_600_000)
  })

  it("uses the first valid instant of a day whose midnight was skipped", () => {
    const interval = getAllDayInterval({ startDate: "2018-11-04", endDateExclusive: "2018-11-05" }, "America/Sao_Paulo")
    expect(interval.start.toISOString()).toBe("2018-11-04T03:00:00.000Z")
    expect(interval.end.toISOString()).toBe("2018-11-05T02:00:00.000Z")
  })

  it("allows local date presentation to differ while keeping one band interval", () => {
    const interval = getAllDayInterval({ startDate: "2026-07-10", endDateExclusive: "2026-07-11" }, "Europe/Brussels")
    const now = new Date("2026-07-10T16:00:00.000Z")
    expect(interval.start.toISOString()).toBe("2026-07-09T22:00:00.000Z")
    expect(interval.end.toISOString()).toBe("2026-07-10T22:00:00.000Z")
    expect(getBandDateTimeFields(now, "Asia/Tokyo").date).toBe("2026-07-11")
  })

  it.each([
    ["2026-07-11", "2026-07-10"],
    ["2026-07-10", "2026-07-10"],
    ["2026-02-30", "2026-03-01"],
  ])("rejects an invalid all-day range %s to %s", (startDate, endDateExclusive) => {
    expect(() => getAllDayInterval({ startDate, endDateExclusive }, "Europe/Brussels")).toThrow()
  })

  it("keeps adjacent years contiguous in the stored calendar-date representation", () => {
    expect(getStoredAllDayCalendarRange(new Date("2024-12-31T00:00Z"), 2 * 86_400_000))
      .toEqual({ startDate: "2024-12-31", endDateExclusive: "2025-01-02" })
    expect(calendarDateToUtcDate("2025-01-01").toISOString()).toBe("2025-01-01T00:00:00.000Z")
  })

  it("preserves the legacy minimum one-day interpretation at the storage boundary", () => {
    expect(getStoredAllDayCalendarRange(new Date("2026-07-10T00:00Z"), 0))
      .toEqual({ startDate: "2026-07-10", endDateExclusive: "2026-07-11" })
  })
})

describe.each(["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles"])(
  "policy operations on a host in %s", hostTimeZone => {
    it("resolves the configured band zone without inheriting the host zone", () => {
      expect(runTimeZoneProbe("tests/datetime/fixtures/bandTimePolicyProbe.ts", hostTimeZone)).toEqual({
        authored: "2026-07-10T07:45:00.000Z",
        repeatedHour: "2026-10-25T00:30:00.000Z",
        bandStart: "2026-07-09T22:00:00.000Z",
        bandEnd: "2026-07-10T22:00:00.000Z",
        calendarDates: { startDate: "2026-07-10", endDateExclusive: "2026-07-11" },
        encodedDate: "2026-07-10T00:00:00.000Z",
      })
    })
  },
)
