import { beforeAll, describe, expect, it } from "vitest"
import type { AllDayHydrationProbe } from "./fixtures/allDayHydrationProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles", "Australia/Sydney"])(
  "DT-01 all-day storage and local authoring in %s",
  timeZone => {
    let result: AllDayHydrationProbe
    beforeAll(() => {
      result = runTimeZoneProbe("tests/datetime/fixtures/allDayHydrationProbe.ts", timeZone)
    })

    it("runs in the requested native timezone", () => {
      expect(result.timeZone).toBe(timeZone)
    })

    it("preserves stored dates and exclusive ends across year, leap-day and DST boundaries", () => {
      for (const value of result.dates) expect(value.loaded).toEqual(value.expected)
    })

    it("preserves dates and durations through repeated spec copies and JSON restoration", () => {
      for (const value of result.dates) {
        expect(value.copied).toEqual(value.expected)
        expect(value.restored).toEqual(value.expected)
      }
    })

    it("encodes early and late picker selections once and preserves them when loaded", () => {
      for (const value of result.dates) {
        for (const authored of value.authored) {
          expect(authored.value).toEqual(value.expected)
          expect(authored.inputUnchanged).toBe(true)
        }
      }
    })

    it("preserves both TBD union copy paths", () => {
      for (const value of result.dates) expect(value.copiedThroughTbd).toEqual([value.expected, value.expected])
    })

    it("encodes a locally calculated union start back into the stored calendar date", () => {
      expect(result.ordinarySelfUnion).toEqual(result.dates[0]!.expected)
    })

    it("keeps TBD null through the local authoring boundary", () => {
      expect(result.tbd).toEqual({ stored: null, duration: 86_400_000, start: null, end: null, isAllDay: true })
    })

    it("ignores the time component using UTC fields without mutating caller Dates", () => {
      expect(result.ignoredTime).toEqual({ stored: "2026-07-10T00:00:00.000Z", input: "2026-07-10T23:45:12.345Z" })
      for (const value of result.dates) expect(value.inputAfterLoading).toBe(value.expected.stored)
    })
  },
)
