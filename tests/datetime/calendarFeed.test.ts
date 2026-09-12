import { describe, expect, it } from "vitest"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

const policyGap = process.env.CMDB_DATETIME_AUDIT_STRICT === "1" ? it : it.fails

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
  | "timedCrossingMidnight" | "timedBrusselsSpring" | "timedBrusselsAutumn" | "tbd",
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
    // DT-FEED-02: reconstructing a stored all-day UTC date in a western host
    // timezone currently normalizes it to the previous calendar day.
    const allDayPolicy = zone === "America/Los_Angeles" ? policyGap : it

    describe(`server timezone ${zone}`, () => {
      allDayPolicy("preserves selected all-day dates with an exclusive date-only end", () => {
        expect(probe.ordinaryAllDay.dateLines).toEqual(allDayLines("20260710", "20260711"))
        expect(probe.multipleAllDay.dateLines).toEqual(allDayLines("20260710", "20260713"))
      })

      allDayPolicy("preserves all-day dates across Brussels daylight-saving changes", () => {
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
    })
  }

  policyGap("DT-FEED-01: preserves the exclusive end of the day before Sydney DST starts", () => {
    expect(probes.get("Australia/Sydney")!.sydneySpringEveAllDay.dateLines)
      .toEqual(allDayLines("20261003", "20261004"))
  })

  policyGap("DT-FEED-01: does not move Sydney's DST-start all-day event to the previous day", () => {
    expect(probes.get("Australia/Sydney")!.sydneySpringAllDay.dateLines)
      .toEqual(allDayLines("20261004", "20261005"))
  })

  policyGap("DT-FEED-01: unchanged all-day input has the same revision hash in UTC and Sydney", () => {
    const reference = probes.get("UTC")!.sydneyAutumnAllDay
    expect(probes.get("Australia/Sydney")!.sydneyAutumnAllDay.inputHash).toBe(reference.inputHash)
  })
})
