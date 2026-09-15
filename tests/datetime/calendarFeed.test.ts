import { describe, expect, it } from "vitest"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

type ExportedSegment = {
  start: string | null
  end: string | null
  dateLines: string[]
  eventCount: number
  inputHash: string
}

type FeedProbe = Record<
  "ordinaryAllDay" | "multipleAllDay" | "brusselsSpringAllDay" | "brusselsAutumnAllDay"
  | "sydneySpringEveAllDay" | "sydneySpringAllDay" | "sydneyAutumnAllDay"
  | "timedCrossingMidnight" | "timedBrusselsSpring" | "timedBrusselsAutumn" | "tbd"
  | "timedOffGrid" | "timedBrusselsSecondOccurrence" | "timedPacificSecondOccurrence" | "timedZeroDuration" | "timedSubsecond",
  ExportedSegment
> & { timeZone: string }

const zones = ["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles", "Australia/Sydney"]
const probes = new Map(zones.map(zone => [
  zone,
  runTimeZoneProbe<FeedProbe>("tests/datetime/calendarFeedProbe.ts", zone),
]))

const allDayLines = (start: string, exclusiveEnd: string) => [
  `DTSTART;VALUE=DATE:${start}`,
  `DTEND;VALUE=DATE:${exclusiveEnd}`,
]

describe("calendar feed date/time policy", () => {
  for (const zone of zones) {
    const probe = probes.get(zone)!
    describe(`server timezone ${zone}`, () => {
      it("preserves selected all-day dates with an exclusive date-only end", () => {
        expect(probe.ordinaryAllDay.dateLines).toEqual(allDayLines("20260710", "20260711"))
        expect(probe.multipleAllDay.dateLines).toEqual(allDayLines("20260710", "20260713"))
      })

      it("preserves all-day dates across Brussels daylight-saving changes", () => {
        expect(probe.brusselsSpringAllDay.dateLines).toEqual(allDayLines("20260329", "20260330"))
        expect(probe.brusselsAutumnAllDay.dateLines).toEqual(allDayLines("20261025", "20261026"))
      })

      it("exports timed events as the original UTC instants across midnight and DST", () => {
        expect(probe.timedCrossingMidnight.dateLines).toEqual([
          "DTSTART:20260710T233000Z", "DTEND:20260711T003000Z",
        ])
        expect(probe.timedBrusselsSpring.dateLines).toEqual([
          "DTSTART:20260329T003000Z", "DTEND:20260329T013000Z",
        ])
        expect(probe.timedBrusselsAutumn.dateLines).toEqual([
          "DTSTART:20261025T003000Z", "DTEND:20261025T013000Z",
        ])
      })

      it("omits TBD segments without inventing calendar dates", () => {
        expect(probe.tbd.start).toBeNull()
        expect(probe.tbd.end).toBeNull()
        expect(probe.tbd.dateLines).toEqual([])
        expect(probe.tbd.eventCount).toBe(0)
      })

      it("DT-02: keeps exact timed feed inputs and serializes their seconds without quarter-hour snapping", () => {
        const cases = [
          [probe.timedOffGrid, "2026-07-10T07:47:12.345Z", "2026-07-10T08:07:13.134Z", "20260710T074712Z", "20260710T080713Z"],
          [probe.timedBrusselsSecondOccurrence, "2026-10-25T01:30:12.345Z", "2026-10-25T01:50:13.134Z", "20261025T013012Z", "20261025T015013Z"],
          [probe.timedPacificSecondOccurrence, "2026-11-01T09:30:12.345Z", "2026-11-01T09:50:13.134Z", "20261101T093012Z", "20261101T095013Z"],
        ] as const
        for (const [value, start, end, startLine, endLine] of cases) {
          expect(value.start).toBe(start)
          expect(value.end).toBe(end)
          expect(value.dateLines).toEqual([`DTSTART:${startLine}`, `DTEND:${endLine}`])
          expect(value.eventCount).toBe(1)
        }
        // RFC 5545 represents a timed point without DTEND; equal serialized
        // endpoints would be invalid. Subsecond input bounds remain exact.
        expect(probe.timedZeroDuration.start).toBe("2026-07-10T07:47:12.345Z")
        expect(probe.timedZeroDuration.end).toBe("2026-07-10T07:47:12.345Z")
        expect(probe.timedSubsecond.start).toBe("2026-07-10T07:47:12.345Z")
        expect(probe.timedSubsecond.end).toBe("2026-07-10T07:47:12.346Z")
        for (const value of [probe.timedZeroDuration, probe.timedSubsecond]) {
          expect(value.dateLines).toEqual(["DTSTART:20260710T074712Z"])
          expect(value.eventCount).toBe(1)
        }
      })
    })
  }

  it("DT-FEED-01: preserves the exclusive end of the day before Sydney DST starts", () => {
    expect(probes.get("Australia/Sydney")!.sydneySpringEveAllDay.dateLines)
      .toEqual(allDayLines("20261003", "20261004"))
  })

  it("DT-FEED-01: does not move Sydney's DST-start all-day event to the previous day", () => {
    expect(probes.get("Australia/Sydney")!.sydneySpringAllDay.dateLines)
      .toEqual(allDayLines("20261004", "20261005"))
  })

  it("DT-FEED-01: unchanged all-day input has the same revision hash in UTC and Sydney", () => {
    const reference = probes.get("UTC")!.sydneyAutumnAllDay
    expect(probes.get("Australia/Sydney")!.sydneyAutumnAllDay.inputHash).toBe(reference.inputHash)
  })

  it("DT-02: exact timed feed input and revision hashes are independent of server timezone", () => {
    for (const zone of zones) {
      for (const key of ["timedOffGrid", "timedBrusselsSecondOccurrence", "timedPacificSecondOccurrence", "timedZeroDuration", "timedSubsecond"] as const) {
        expect(probes.get(zone)![key]).toEqual(probes.get("UTC")![key])
      }
    }
  })
})
