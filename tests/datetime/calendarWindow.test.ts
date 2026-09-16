import { describe, expect, it } from "vitest"
import { CalendarWindowSchema, getCalendarWindow } from "shared/dateTimePolicy"
import { ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes"
import { calendarWindowSql } from "src/core/db3/server/calendarWindowSql"

const dates = { startDate: "2026-07-11", endDateExclusive: "2026-07-12" }
describe("structured calendar windows", () => {
  it.each([
    ["Asia/Tokyo", "2026-07-10T15:00:00.000Z", "2026-07-11T15:00:00.000Z"],
    ["America/Los_Angeles", "2026-07-11T07:00:00.000Z", "2026-07-12T07:00:00.000Z"],
    ["Europe/Brussels", "2026-07-10T22:00:00.000Z", "2026-07-11T22:00:00.000Z"],
    ["UTC", "2026-07-11T00:00:00.000Z", "2026-07-12T00:00:00.000Z"],
  ])("keeps dates and resolves instants in %s", (zone, startInstant, endInstantExclusive) => {
    expect(getCalendarWindow(dates, zone)).toEqual({ ...dates, startInstant, endInstantExclusive })
  })

  it.each([
    ["2026-03-29", "2026-03-30", 23],
    ["2026-10-25", "2026-10-26", 25],
  ])("resolves each midnight independently for %s", (startDate, endDateExclusive, hours) => {
    const window = getCalendarWindow({ startDate: String(startDate), endDateExclusive: String(endDateExclusive) }, "Europe/Brussels")
    expect(Date.parse(window.endInstantExclusive) - Date.parse(window.startInstant)).toBe(Number(hours) * 3_600_000)
  })

  const window = getCalendarWindow(dates, "Asia/Tokyo")
  it.each([
    { startDate: "2026-02-30" }, { startDate: "2026-07-12" },
    { endDateExclusive: "2026-07-10" }, { startDate: "2026-07-11' OR 1=1 --" },
    { startInstant: "2026-07-11 00:00:00" }, { startInstant: window.endInstantExclusive },
    { endInstantExclusive: "invalid" }, { endInstantExclusive: "2026-07-09T00:00:00Z" },
  ])("rejects invalid or reversed bounds %j before SQL", invalid => {
    expect(() => CalendarWindowSchema.parse({ ...window, ...invalid })).toThrow()
    expect(() => calendarWindowSql({ ...window, ...invalid }, "Europe/Brussels")).toThrow()
  })

  it("retains the window through the real search request schema", () => {
    const args = { tableID: "Event", offset: 0, take: 100, sort: [], quickFilter: "", discreteCriteria: [], calendarWindow: window }
    expect(ZGetSearchResultsInput.parse(args).calendarWindow).toEqual(window)
  })
})
