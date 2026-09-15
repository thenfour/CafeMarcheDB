import { afterEach, describe, expect, it, vi } from "vitest"
import { getClockTimeOccurrences, getBandDateTimeFields } from "shared/dateTimePolicy"
import { getDateTimeRangeTimeOptions, TimeOptionsGenerator } from "shared/time"

afterEach(() => { vi.useRealTimers() })

describe("DT-04 civil clock grid", () => {
  it("contains each quarter-hour exactly once, independent of the current day", () => {
    vi.useFakeTimers()
    const expected = Array.from({ length: 96 }, (_, index) => ({
      clockTime: `${Math.floor(index / 4).toString().padStart(2, "0")}:${((index % 4) * 15).toString().padStart(2, "0")}`,
      millisecondOfDay: index * 15 * 60_000,
    }))
    for (const now of ["2026-01-01", "2026-03-29", "2026-07-10", "2026-10-25", "2026-11-01"]) {
      vi.setSystemTime(new Date(`${now}T12:00:00Z`))
      expect(new TimeOptionsGenerator(15).getOptions()).toEqual(expected)
    }
  })

  it.each([0, -1, NaN, Infinity, 0.5, 1441])("rejects invalid clock increments: %s", increment => {
    expect(() => new TimeOptionsGenerator(increment)).toThrow("Invalid minute increment")
  })

  it("keeps resolved July choices unchanged when the editor opens in different seasons", () => {
    vi.useFakeTimers()
    const start = new Date("2026-07-10T07:47:12.345Z")
    const end = new Date("2026-07-10T08:07:13.134Z")
    const expected = getDateTimeRangeTimeOptions(start, end, "Europe/Brussels")
    for (const now of ["2026-01-01", "2026-03-29", "2026-10-25"]) {
      vi.setSystemTime(new Date(`${now}T12:00:00Z`))
      expect(getDateTimeRangeTimeOptions(start, end, "Europe/Brussels")).toEqual(expected)
    }
  })
})

const transitions = [
  { zone: "Europe/Brussels", day: "2026-03-29", start: "2026-03-29T00:30:00Z", end: "2026-03-29T01:30:00Z", count: 92, duration: "1h" },
  { zone: "Europe/Brussels", day: "2026-10-25", start: "2026-10-24T23:30:00Z", end: "2026-10-25T02:30:00Z", count: 100, duration: "3h" },
  { zone: "America/Los_Angeles", day: "2026-03-08", start: "2026-03-08T09:30:00Z", end: "2026-03-08T10:30:00Z", count: 92, duration: "1h" },
  { zone: "America/Los_Angeles", day: "2026-11-01", start: "2026-11-01T08:30:00Z", end: "2026-11-01T11:30:00Z", count: 100, duration: "3h" },
  { zone: "Australia/Sydney", day: "2026-10-04", start: "2026-10-03T15:30:00Z", end: "2026-10-03T16:30:00Z", count: 92, duration: "1h" },
  { zone: "Australia/Sydney", day: "2026-04-05", start: "2026-04-04T14:30:00Z", end: "2026-04-04T17:30:00Z", count: 100, duration: "3h" },
  { zone: "Australia/Lord_Howe", day: "2026-10-04", start: "2026-10-03T15:00:00Z", end: "2026-10-03T16:30:00Z", count: 94, duration: "1h 30m" },
  { zone: "Australia/Lord_Howe", day: "2026-04-05", start: "2026-04-04T14:30:00Z", end: "2026-04-04T17:00:00Z", count: 98, duration: "2h 30m" },
]

describe.each(transitions)("resolved clocks in $zone on $day", fixture => {
  it("offers each real quarter-hour occurrence with a unique label and instant", () => {
    const choices = getDateTimeRangeTimeOptions(new Date(fixture.start), new Date(fixture.end), fixture.zone)
    expect(choices.startOptions).toHaveLength(fixture.count)
    expect(new Set(choices.startOptions.map(option => option.label)).size).toBe(fixture.count)
    expect(new Set(choices.startOptions.map(option => option.instant.valueOf())).size).toBe(fixture.count)
    expect(choices.startOptions.every(option => getBandDateTimeFields(option.instant, fixture.zone).date === fixture.day)).toBe(true)
  })

  it("DT-05: displays 03:30 with the actual elapsed duration and the correct saved instant", () => {
    const choices = getDateTimeRangeTimeOptions(new Date(fixture.start), new Date(fixture.end), fixture.zone)
    const end = choices.endOptions.find(option => option.label === `03:30 (${fixture.duration})`)!
    expect(end.instant.toISOString()).toBe(new Date(fixture.end).toISOString())
    expect(choices.endOptions.every(option => option.instant >= new Date(fixture.start))).toBe(true)
  })
})

describe("precise and dated selections", () => {
  it("omits skipped clocks and distinguishes both occurrences of a repeated clock", () => {
    expect(getClockTimeOccurrences({ date: "2026-03-29", time: "02:30" }, "Europe/Brussels")).toEqual([])
    expect(getClockTimeOccurrences({ date: "2026-10-25", time: "02:30" }, "Europe/Brussels").map(value => value.toISOString()))
      .toEqual(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"])
    const choices = getDateTimeRangeTimeOptions(new Date("2026-10-25T01:30:00Z"), new Date("2026-10-25T02:00:00Z"), "Europe/Brussels")
    expect(choices.startOptions.filter(option => option.label.startsWith("02:30")).map(option => option.label))
      .toEqual(["02:30 (UTC+02:00)", "02:30 (UTC+01:00)"])
    expect(choices.selectedStart.label).toBe("02:30 (UTC+01:00)")
  })

  it("retains off-grid seconds, milliseconds and the existing repeated-hour occurrence", () => {
    const start = new Date("2026-10-25T01:30:12.345Z")
    const end = new Date("2026-10-25T01:50:13.134Z")
    const choices = getDateTimeRangeTimeOptions(start, end, "Europe/Brussels")
    expect(choices.selectedStart.label).toBe("02:30:12.345 (UTC+01:00)")
    expect(choices.selectedEnd.label).toBe("02:50:13.134 (UTC+01:00) (20m 789ms)")
    expect(choices.selectedStart.instant).toEqual(start)
    expect(choices.selectedEnd.instant).toEqual(end)
    expect(choices.startOptions).toContain(choices.selectedStart)
    expect(choices.endOptions).toContain(choices.selectedEnd)
    expect(start.toISOString()).toBe("2026-10-25T01:30:12.345Z")
  })

  it("wraps earlier end clocks to the next calendar date and labels that date", () => {
    const choices = getDateTimeRangeTimeOptions(new Date("2026-07-10T21:30:00Z"), new Date("2026-07-10T21:45:00Z"), "Europe/Brussels")
    const midnight = choices.endOptions.find(option => option.label === "00:30 on 2026-07-11 (1h)")!
    expect(midnight.instant.toISOString()).toBe("2026-07-10T22:30:00.000Z")
  })

  it("offers tomorrow's early clock even if that clock was skipped earlier today", () => {
    const choices = getDateTimeRangeTimeOptions(new Date("2026-03-29T15:00:00Z"), new Date("2026-03-29T16:00:00Z"), "Europe/Brussels")
    const end = choices.endOptions.find(option => option.label === "02:30 on 2026-03-30 (9h 30m)")!
    expect(end.instant.toISOString()).toBe("2026-03-30T00:30:00.000Z")
  })

  it("keeps a later repeated occurrence on the same date even when its clock is earlier", () => {
    const choices = getDateTimeRangeTimeOptions(new Date("2026-10-25T00:45:00Z"), new Date("2026-10-25T01:15:00Z"), "Europe/Brussels")
    const end = choices.endOptions.find(option => option.label === "02:15 (UTC+01:00) (30m)")!
    expect(end.instant.toISOString()).toBe("2026-10-25T01:15:00.000Z")
  })

  it("keeps the existing end date when changing the clock of a multi-day range", () => {
    const choices = getDateTimeRangeTimeOptions(new Date("2026-07-10T07:00:00Z"), new Date("2026-07-12T01:30:00Z"), "Europe/Brussels")
    const end = choices.endOptions.find(option => option.label === "04:00 on 2026-07-12 (1d 19h)")!
    expect(end.instant.toISOString()).toBe("2026-07-12T02:00:00.000Z")
  })

  it("keeps a precise zero-duration value available without rounding", () => {
    const instant = new Date("2026-07-10T21:50:00.001Z")
    const choices = getDateTimeRangeTimeOptions(instant, instant, "Europe/Brussels")
    expect(choices.selectedEnd.label).toBe("23:50:00.001 (0m)")
    expect(choices.selectedEnd.instant).toEqual(instant)
  })
})
