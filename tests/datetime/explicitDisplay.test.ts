import { beforeAll, describe, expect, it } from "vitest"
import { DateTimeRange } from "shared/time"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["UTC", "Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"])("explicit display on a %s host", zone => {
  let result: { legacy: string; utc: string; tokyo: string; brussels: string; allDay: string[]; fold: string; overnight: string; point: string; unchanged: boolean }
  beforeAll(() => { result = runTimeZoneProbe("tests/datetime/fixtures/explicitDisplayProbe.ts", zone) }, 20_000)
  it("renders the requested timezone independently of the host and retains precision", () => {
    expect(result.utc).toContain("10 Jul 2026 @ 15:30:12.345 GMT")
    expect(result.utc).toContain("15:50:13.134 GMT")
    expect(result.tokyo).toContain("11 Jul 2026 @ 00:30:12.345 GMT+9")
    expect(result.brussels).toContain("10 Jul 2026 @ 17:30:12.345 GMT+2")
    expect(result.unchanged).toBe(true)
  })
  it("keeps all-day dates fixed and shows the included final date", () => {
    expect(new Set(result.allDay).size).toBe(1)
    expect(result.allDay[0]).toContain("31 Dec 2026")
    expect(result.allDay[0]).toContain("2 Jan 2027 (all day)")
    expect(result.allDay[0]).not.toContain("3 Jan")
  })
  it("distinguishes fold occurrences by offset and labels both dates across midnight", () => {
    expect(result.fold).toContain("02:30:00.000 GMT+2")
    expect(result.fold).toContain("02:30:00.000 GMT+1")
    expect(result.overnight).toContain("10 Jul 2026 @ 23:30")
    expect(result.overnight).toContain("11 Jul 2026 @ 02:30")
  })
  it("shows a zero-duration point once", () => {
    expect(result.point).toContain("15:30:12.345")
    expect(result.point).not.toContain(" – ")
  })
})

it("requires a valid explicit display timezone even for TBD and all-day values", () => {
  for (const range of [new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false }),
    new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T00:00:00Z"), durationMillis: 86_400_000, isAllDay: true })]) {
    expect(() => range.toDisplayString({ displayTimeZone: "Moon/Base" })).toThrow()
    expect(() => range.toDisplayString({ displayTimeZone: undefined as any })).toThrow()
  }
  expect(new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false }).toDisplayString({ displayTimeZone: "UTC" })).toBe("TBD")
})
