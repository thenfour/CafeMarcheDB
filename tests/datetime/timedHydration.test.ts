import { beforeAll, describe, expect, it } from "vitest"
import type { TimedHydrationProbe } from "./fixtures/timedHydrationProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles", "Australia/Sydney"])(
  "DT-02 exact timed ranges in %s",
  timeZone => {
    let result: TimedHydrationProbe
    beforeAll(() => {
      result = runTimeZoneProbe("tests/datetime/fixtures/timedHydrationProbe.ts", timeZone)
    })

    it("runs in the requested native timezone", () => {
      expect(result.timeZone).toBe(timeZone)
    })

    it("preserves milliseconds, short and zero durations, midnight crossings and both DST occurrences", () => {
      for (const value of result.values) expect(value.loaded).toEqual(value.expected)
    })

    it("preserves instants and durations through repeated spec copies and JSON restoration", () => {
      for (const value of result.values) {
        expect(value.copied).toEqual(value.expected)
        expect(value.restored).toEqual(value.expected)
      }
    })

    it("passes timed inputs through the local-date adapter without reconstructing clock fields", () => {
      for (const value of result.values) expect(value.authoring).toEqual(value.expected)
    })

    it("preserves timed self-unions and both TBD union copy paths", () => {
      for (const value of result.values) expect(value.copiesThroughUnion).toEqual([value.expected, value.expected, value.expected])
    })

    it("does not retain the caller's mutable Date reference", () => {
      for (const value of result.values) expect(value.afterInputMutation).toEqual(value.expected)
    })

    it("classifies exact millisecond boundaries without extending zero-duration values", () => {
      for (const value of result.values) {
        expect(value.boundaries).toEqual(value.expected.duration === 0
          ? ["Future", "Past", "Future", "Past"]
          : ["Future", "Present", "Present", "Past"])
      }
    })

    it("retains a TBD range's specified duration without inventing dates", () => {
      expect(result.tbd).toEqual({ start: null, end: null, duration: 123, isAllDay: false })
    })

    it("uses a midnight point's own calendar day as its display anchor", () => {
      const point = result.midnightPoint
      expect(point.end).toBe(point.start)
      expect(point.last).toBe(point.start)
      expect(point.days).toEqual([false, true, false])
      expect(point.timing).toEqual(["Future", "Past", "Past"])
    })

    it("DT-08: labels point timestamps at their exact dates without an ongoing interval", () => {
      expect(result.pointLabels).toEqual([
        { bucket: "Today", label: "Today" },
        { bucket: "Today", label: "Today" },
        { bucket: "Tomorrow", label: "Tomorrow" },
      ])
    })
  },
)
